// Menjalankan migrasi database yang belum terpasang, mengisi seed, dan menyiapkan storage.
// Jalankan: npm run db:migrate   (butuh SUPABASE_DB_URL di .env.local)
import { createClient } from "@supabase/supabase-js";
import { readdirSync, readFileSync } from "node:fs";
import postgres from "postgres";

const dbUrl = process.env.SUPABASE_DB_URL;
if (!dbUrl) {
  console.error("SUPABASE_DB_URL belum diisi di .env.local (lihat docs/SETUP.md).");
  process.exit(1);
}

const sql = postgres(dbUrl, { ssl: "require", max: 1, onnotice: () => {} });
const dir = new URL("../supabase/migrations/", import.meta.url);
const files = readdirSync(dir).filter((f) => f.endsWith(".sql")).sort();

try {
  await sql`create schema if not exists app_private`;
  await sql`create table if not exists app_private.schema_migrations (name text primary key, applied_at timestamptz not null default now())`;

  // Migrasi yang dulu ditempel manual di SQL Editor dicatat sebagai sudah terpasang.
  const [{ count }] = await sql`select count(*)::int as count from app_private.schema_migrations`;
  if (count === 0) {
    const [state] = await sql`
      select to_regclass('public.profiles') is not null as foundation,
             exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'profiles' and column_name = 'must_change_password') as password_login,
             to_regclass('public.students') is not null as registration`;
    const known = { "20261026000001_foundation.sql": state.foundation, "20261026000002_password_login.sql": state.password_login, "20261026000003_registration_placement.sql": state.registration };
    for (const [name, applied] of Object.entries(known)) {
      if (applied) await sql`insert into app_private.schema_migrations (name) values (${name})`;
    }
  }

  const applied = new Set((await sql`select name from app_private.schema_migrations`).map((r) => r.name));
  const pending = files.filter((f) => !applied.has(f));

  for (const file of pending) {
    const body = readFileSync(new URL(file, dir), "utf8");
    await sql.begin(async (tx) => {
      await tx.unsafe(body);
      await tx`insert into app_private.schema_migrations (name) values (${file})`;
    });
    console.log(`Terpasang: ${file}`);
  }
  if (pending.length === 0) console.log("Semua migrasi sudah terpasang.");

  // Seed hanya mengisi data yang belum ada, aman dijalankan berulang.
  await sql.unsafe(readFileSync(new URL("../supabase/seed.sql", import.meta.url), "utf8"));
  console.log("Seed diperiksa.");
} finally {
  await sql.end();
}

// Bucket storage privat untuk rekaman placement, media soal, dan bukti bayar.
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (url && serviceKey) {
  const admin = createClient(url, serviceKey, { auth: { persistSession: false } });
  const buckets = [
    { name: "placement-answers", options: { public: false, fileSizeLimit: "10MB", allowedMimeTypes: ["audio/webm", "audio/ogg", "audio/mp4", "audio/mpeg", "audio/wav"] } },
    { name: "placement-media", options: { public: false, fileSizeLimit: "20MB", allowedMimeTypes: ["audio/mpeg", "audio/mp4", "audio/wav", "audio/webm", "audio/ogg"] } },
    { name: "payment-proofs", options: { public: false, fileSizeLimit: "5MB", allowedMimeTypes: ["image/jpeg", "image/png", "image/webp", "application/pdf"] } },
  ];
  const { data: existing } = await admin.storage.listBuckets();
  for (const b of buckets) {
    if (existing?.some((x) => x.name === b.name)) continue;
    const { error } = await admin.storage.createBucket(b.name, b.options);
    console.log(error ? `Gagal membuat bucket ${b.name}: ${error.message}` : `Bucket dibuat: ${b.name}`);
  }
}
