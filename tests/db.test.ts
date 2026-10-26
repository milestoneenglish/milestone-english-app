// Menguji migrasi dan aturan keamanan (RLS) di Postgres sungguhan (PGlite),
// dengan tiruan minimal skema auth milik Supabase.
import { PGlite } from "@electric-sql/pglite";
import { pgcrypto } from "@electric-sql/pglite/contrib/pgcrypto";
import { readdirSync, readFileSync } from "node:fs";
import { beforeAll, describe, expect, it } from "vitest";

const root = new URL("../supabase/", import.meta.url);

const AUTH_STUB = `
create role anon nologin;
create role authenticated nologin;
create schema auth;
create table auth.users (
  id uuid primary key default gen_random_uuid(),
  email text,
  raw_user_meta_data jsonb default '{}'::jsonb,
  raw_app_meta_data jsonb default '{}'::jsonb
);
create function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;
grant usage on schema public, auth to anon, authenticated;
grant execute on function auth.uid() to anon, authenticated;
`;

const GRANTS = `
grant select, insert, update, delete on all tables in schema public to anon, authenticated;
`;

let db: PGlite;

async function createUser(email: string, meta: object = {}, app: object = {}) {
  const res = await db.query<{ id: string }>(
    "insert into auth.users (email, raw_user_meta_data, raw_app_meta_data) values ($1, $2, $3) returning id",
    [email, JSON.stringify(meta), JSON.stringify(app)],
  );
  return res.rows[0].id;
}

// Menjalankan query sebagai pengguna tertentu (atau anon), lalu kembali ke superuser.
async function as<T>(userId: string | null, sql: string, params: unknown[] = []) {
  await db.exec("reset role");
  await db.query("select set_config('request.jwt.claim.sub', $1, false)", [userId ?? ""]);
  await db.exec(userId ? "set role authenticated" : "set role anon");
  try {
    return await db.query<T>(sql, params);
  } finally {
    await db.exec("reset role");
  }
}

async function rolesOf(userId: string) {
  const res = await db.query<{ role: string }>("select role::text from public.user_roles where user_id = $1 order by role", [userId]);
  return res.rows.map((r) => r.role);
}

beforeAll(async () => {
  db = new PGlite({ extensions: { pgcrypto } });
  await db.exec(AUTH_STUB);
  for (const file of readdirSync(new URL("migrations/", root)).sort()) {
    await db.exec(readFileSync(new URL(`migrations/${file}`, root), "utf8"));
  }
  await db.exec(GRANTS);
  // GRANTS di atas memberi update penuh; kembalikan pembatasan kolom profil seperti di Supabase.
  await db.exec("revoke update on public.profiles from authenticated; grant update (full_name, phone) on public.profiles to authenticated;");
  await db.exec(readFileSync(new URL("seed.sql", root), "utf8"));
});

describe("pendaftaran akun", () => {
  it("akun publik baru menjadi siswa dan profilnya terbentuk", async () => {
    const id = await createUser("Siswa@Contoh.id", { full_name: "Siswa Satu" });
    expect(await rolesOf(id)).toEqual(["student"]);
    const p = await db.query<{ email: string; full_name: string }>("select email, full_name from public.profiles where id = $1", [id]);
    expect(p.rows[0]).toEqual({ email: "siswa@contoh.id", full_name: "Siswa Satu" });
  });

  it("akun wali mendapat role wali", async () => {
    const id = await createUser("wali@contoh.id", { account_type: "guardian" });
    expect(await rolesOf(id)).toEqual(["guardian"]);
  });

  it("metadata publik tidak bisa meminta role staf", async () => {
    const id = await createUser("nakal@contoh.id", { account_type: "owner", role: "owner" });
    expect(await rolesOf(id)).toEqual(["student"]);
  });

  it("akun staf yang dibuat server tidak otomatis mendapat role", async () => {
    const id = await createUser("tutor@contoh.id", {}, { provisioned: true });
    expect(await rolesOf(id)).toEqual([]);
  });
});

describe("role dan hak akses", () => {
  let owner: string;
  let student: string;
  let other: string;

  beforeAll(async () => {
    owner = await createUser("owner@contoh.id", {}, { provisioned: true });
    await db.query("insert into public.user_roles (user_id, role) values ($1, 'owner')", [owner]);
    student = await createUser("murid@contoh.id");
    other = await createUser("lain@contoh.id");
  });

  it("siswa tidak bisa memberi dirinya role owner", async () => {
    await expect(as(student, "insert into public.user_roles (user_id, role) values ($1, 'owner')", [student])).rejects.toThrow(/row-level security/);
  });

  it("owner tidak bisa memberi role kepada dirinya sendiri", async () => {
    await expect(as(owner, "insert into public.user_roles (user_id, role) values ($1, 'admin')", [owner])).rejects.toThrow(/row-level security/);
  });

  it("owner bisa memberi role kepada orang lain dan tercatat di audit", async () => {
    await as(owner, "insert into public.user_roles (user_id, role, granted_by) values ($1, 'tutor', $2)", [other, owner]);
    expect(await rolesOf(other)).toContain("tutor");
    const audit = await db.query<{ actor_id: string; action: string }>(
      "select actor_id, action from public.audit_log where entity_id = $1 and action = 'role_granted' order by id desc limit 1",
      [other],
    );
    expect(audit.rows[0]).toEqual({ actor_id: owner, action: "role_granted" });
  });

  it("siswa hanya melihat profil dan role miliknya sendiri", async () => {
    const profiles = await as<{ id: string }>(student, "select id from public.profiles");
    expect(profiles.rows.map((r) => r.id)).toEqual([student]);
    const roles = await as<{ user_id: string }>(student, "select user_id from public.user_roles");
    expect(new Set(roles.rows.map((r) => r.user_id))).toEqual(new Set([student]));
  });

  it("owner melihat semua profil", async () => {
    const profiles = await as<{ n: number }>(owner, "select count(*)::int as n from public.profiles");
    expect(profiles.rows[0].n).toBeGreaterThan(3);
  });

  it("siswa bisa mengubah nama sendiri tetapi tidak status akunnya", async () => {
    await as(student, "update public.profiles set full_name = 'Nama Baru' where id = $1", [student]);
    const p = await db.query<{ full_name: string }>("select full_name from public.profiles where id = $1", [student]);
    expect(p.rows[0].full_name).toBe("Nama Baru");
    await expect(as(student, "update public.profiles set status = 'inactive' where id = $1", [student])).rejects.toThrow(/permission denied/);
  });

  it("role tidak berlaku saat akun dinonaktifkan", async () => {
    const admin = await createUser("admin@contoh.id", {}, { provisioned: true });
    await db.query("insert into public.user_roles (user_id, role) values ($1, 'admin')", [admin]);
    const before = await as<{ ok: boolean }>(admin, "select public.has_role('admin') as ok");
    expect(before.rows[0].ok).toBe(true);
    await db.query("update public.profiles set status = 'inactive' where id = $1", [admin]);
    const after = await as<{ ok: boolean }>(admin, "select public.has_role('admin') as ok");
    expect(after.rows[0].ok).toBe(false);
  });

  it("audit log hanya bisa dibaca owner dan tidak bisa ditulis langsung", async () => {
    const seen = await as<{ n: number }>(student, "select count(*)::int as n from public.audit_log");
    expect(seen.rows[0].n).toBe(0);
    await expect(as(student, "select public.write_audit('palsu', 'x', null)")).rejects.toThrow(/permission denied/);
    const ownerSeen = await as<{ n: number }>(owner, "select count(*)::int as n from public.audit_log");
    expect(ownerSeen.rows[0].n).toBeGreaterThan(0);
  });
});

describe("katalog dan konten publik", () => {
  it("pengunjung melihat 12 program aktif tanpa TravelReady", async () => {
    const res = await as<{ name: string }>(null, "select name from public.programs order by sort_order");
    expect(res.rows).toHaveLength(12);
    expect(res.rows.map((r) => r.name)).not.toContain("TravelReady");
  });

  it("program draft tidak terlihat oleh pengunjung", async () => {
    await db.query("update public.programs set status = 'draft' where code = 'SST'");
    const res = await as<{ n: number }>(null, "select count(*)::int as n from public.programs");
    expect(res.rows[0].n).toBe(11);
    await db.query("update public.programs set status = 'active' where code = 'SST'");
  });

  it("pengunjung tidak bisa mengubah program atau konten", async () => {
    await as(null, "update public.programs set price_idr = 1");
    const price = await db.query<{ min: number }>("select min(price_idr) as min from public.programs");
    expect(price.rows[0].min).toBeGreaterThan(1);
    await expect(as(null, "insert into public.faqs (question, answer) values ('x', 'y')")).rejects.toThrow(/row-level security/);
  });

  it("siswa tidak bisa mengubah harga program", async () => {
    const student = await createUser("murid2@contoh.id");
    await as(student, "update public.programs set price_idr = 1");
    const price = await db.query<{ min: number }>("select min(price_idr) as min from public.programs");
    expect(price.rows[0].min).toBeGreaterThan(1);
  });

  it("testimoni belum terbit tidak terlihat, FAQ dan pengaturan terlihat", async () => {
    await db.query("insert into public.testimonials (name, program_label, quote) values ('A', 'SpeakUp', 'Bagus')");
    const t = await as<{ n: number }>(null, "select count(*)::int as n from public.testimonials");
    expect(t.rows[0].n).toBe(0);
    const f = await as<{ n: number }>(null, "select count(*)::int as n from public.faqs");
    expect(f.rows[0].n).toBe(4);
    const s = await as<{ key: string }>(null, "select key from public.site_settings order by key");
    expect(s.rows.map((r) => r.key)).toEqual(["contact", "hero"]);
  });
});
