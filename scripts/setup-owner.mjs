// Membuat akun Owner pertama (atau memberi role Owner ke akun yang sudah ada).
// Jalankan: npm run setup:owner -- email@domain.com "Nama Lengkap"
import { createClient } from "@supabase/supabase-js";

const [email, fullName = ""] = process.argv.slice(2);
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
  console.error('Pemakaian: npm run setup:owner -- email@domain.com "Nama Lengkap"');
  process.exit(1);
}
if (!url || !serviceKey) {
  console.error("NEXT_PUBLIC_SUPABASE_URL dan SUPABASE_SERVICE_ROLE_KEY harus diisi di .env.local.");
  process.exit(1);
}

const admin = createClient(url, serviceKey, { auth: { persistSession: false } });
const normalized = email.trim().toLowerCase();

let { data: profile } = await admin.from("profiles").select("id").eq("email", normalized).maybeSingle();

if (!profile) {
  const { data, error } = await admin.auth.admin.createUser({
    email: normalized,
    email_confirm: true,
    user_metadata: { full_name: fullName },
    app_metadata: { provisioned: true },
  });
  if (error) {
    console.error(`Gagal membuat akun: ${error.message}`);
    process.exit(1);
  }
  profile = { id: data.user.id };
  console.log(`Akun ${normalized} dibuat.`);
}

const { error: roleError } = await admin.from("user_roles").upsert({ user_id: profile.id, role: "owner" }, { onConflict: "user_id,role" });
if (roleError) {
  console.error(`Gagal memberi role Owner: ${roleError.message}`);
  process.exit(1);
}

console.log(`Selesai. ${normalized} sekarang Owner. Masuk di /masuk lewat email yang dikirim ke alamat tersebut.`);
