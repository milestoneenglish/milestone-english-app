// Postgres sungguhan (PGlite) dengan tiruan minimal skema auth milik Supabase,
// lalu semua migrasi dan seed dijalankan berurutan.
import { PGlite } from "@electric-sql/pglite";
import { pgcrypto } from "@electric-sql/pglite/contrib/pgcrypto";
import { readdirSync, readFileSync } from "node:fs";

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

// Supabase memberi hak dasar ke anon/authenticated; pembatasan kolom dari migrasi diterapkan ulang.
const GRANTS = `
grant select, insert, update, delete on all tables in schema public to anon, authenticated;
revoke update on public.profiles from authenticated;
grant update (full_name, phone) on public.profiles to authenticated;
revoke update on public.students from authenticated;
grant update (full_name, birth_year, learning_goal, interested_program_id) on public.students to authenticated;
revoke update on public.guardian_links from authenticated;
grant update (status, decided_by, decided_at) on public.guardian_links to authenticated;
revoke insert, update, delete on public.enrollments, public.invoices, public.payment_proofs, public.notifications from authenticated, anon;
revoke insert, update, delete on public.curricula, public.curriculum_modules from authenticated, anon;
grant update (title, notes) on public.curricula to authenticated;
grant update (title, objectives, content, week) on public.curriculum_modules to authenticated;
revoke insert, update, delete on public.attendance, public.assignments, public.submissions, public.feedback from authenticated, anon;
revoke insert, update, delete on public.rubric_indicators from authenticated, anon;
grant update (label, descriptors) on public.rubric_indicators to authenticated;
revoke insert, update, delete on public.assessments, public.reports from authenticated, anon;
revoke insert, update, delete on public.tickets, public.ticket_messages, public.tutor_observations, public.tutor_surveys from authenticated, anon;
revoke insert, update, delete on public.inbox from authenticated, anon;
`;

export async function createTestDb() {
  const db = new PGlite({ extensions: { pgcrypto } });
  await db.exec(AUTH_STUB);
  for (const file of readdirSync(new URL("migrations/", root)).sort()) {
    await db.exec(readFileSync(new URL(`migrations/${file}`, root), "utf8"));
  }
  await db.exec(GRANTS);
  await db.exec(readFileSync(new URL("seed.sql", root), "utf8"));

  async function createUser(email: string, meta: object = {}, app: object = {}) {
    const res = await db.query<{ id: string }>(
      "insert into auth.users (email, raw_user_meta_data, raw_app_meta_data) values ($1, $2, $3) returning id",
      [email, JSON.stringify(meta), JSON.stringify(app)],
    );
    return res.rows[0].id;
  }

  async function createStaff(email: string, role: string) {
    const id = await createUser(email, {}, { provisioned: true });
    await db.query("insert into public.user_roles (user_id, role) values ($1, $2)", [id, role]);
    return id;
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

  return { db, createUser, createStaff, as, rolesOf };
}
