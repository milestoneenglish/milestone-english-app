// Menguji migrasi dan aturan keamanan (RLS) fondasi di Postgres sungguhan (PGlite).
import { beforeAll, describe, expect, it } from "vitest";
import { createTestDb } from "./db-helpers";

let db: Awaited<ReturnType<typeof createTestDb>>["db"];
let createUser: Awaited<ReturnType<typeof createTestDb>>["createUser"];
let as: Awaited<ReturnType<typeof createTestDb>>["as"];
let rolesOf: Awaited<ReturnType<typeof createTestDb>>["rolesOf"];

beforeAll(async () => {
  ({ db, createUser, as, rolesOf } = await createTestDb());
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

  it("akun staf dengan password sementara ditandai wajib ganti password", async () => {
    const id = await createUser("staf@contoh.id", {}, { provisioned: true, must_change_password: true });
    const p = await db.query<{ must: boolean }>("select must_change_password as must from public.profiles where id = $1", [id]);
    expect(p.rows[0].must).toBe(true);
  });

  it("pendaftar publik tidak bisa menandai dirinya lewat metadata", async () => {
    const id = await createUser("publik@contoh.id", { must_change_password: true }, { must_change_password: true });
    const p = await db.query<{ must: boolean }>("select must_change_password as must from public.profiles where id = $1", [id]);
    expect(p.rows[0].must).toBe(false);
  });

  it("pengguna tidak bisa menghapus sendiri tanda wajib ganti password", async () => {
    const id = await createUser("staf2@contoh.id", {}, { provisioned: true, must_change_password: true });
    await expect(as(id, "update public.profiles set must_change_password = false where id = $1", [id])).rejects.toThrow(/permission denied/);
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
