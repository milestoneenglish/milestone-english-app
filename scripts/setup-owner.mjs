// Membuat akun Owner pertama (atau memberi role Owner ke akun yang sudah ada).
// Akun baru mendapat password sementara yang wajib diganti saat pertama masuk.
// Jalankan: npm run setup:owner -- email@domain.com "Nama Lengkap"
// Akun yang sudah ada dan perlu password sementara baru: tambahkan --reset di akhir.
import { createClient } from "@supabase/supabase-js";
import { randomInt } from "node:crypto";

const args = process.argv.slice(2);
const reset = args.includes("--reset");
const [email, fullName = ""] = args.filter((a) => a !== "--reset");
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

// 12 karakter acak, selalu berisi huruf dan angka. Tanpa karakter yang mirip (0/O, 1/l).
function temporaryPassword() {
  const letters = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ";
  const digits = "23456789";
  const all = letters + digits;
  const chars = [letters[randomInt(letters.length)], digits[randomInt(digits.length)]];
  while (chars.length < 12) chars.push(all[randomInt(all.length)]);
  for (let i = chars.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join("");
}

const admin = createClient(url, serviceKey, { auth: { persistSession: false } });
const normalized = email.trim().toLowerCase();

let { data: profile } = await admin.from("profiles").select("id").eq("email", normalized).maybeSingle();
let password = null;

if (!profile) {
  password = temporaryPassword();
  const { data, error } = await admin.auth.admin.createUser({
    email: normalized,
    password,
    email_confirm: true,
    user_metadata: { full_name: fullName },
    app_metadata: { provisioned: true, must_change_password: true },
  });
  if (error) {
    console.error(`Gagal membuat akun: ${error.message}`);
    process.exit(1);
  }
  profile = { id: data.user.id };
} else if (reset) {
  password = temporaryPassword();
  const { error } = await admin.auth.admin.updateUserById(profile.id, { password, email_confirm: true });
  if (error) {
    console.error(`Gagal mengganti password: ${error.message}`);
    process.exit(1);
  }
  const { error: flagError } = await admin.from("profiles").update({ must_change_password: true }).eq("id", profile.id);
  if (flagError) {
    console.error(`Password diganti, tetapi tanda wajib ganti gagal disimpan: ${flagError.message}`);
    console.error("Pastikan migrasi supabase/migrations/20261026000002_password_login.sql sudah dijalankan.");
    process.exit(1);
  }
}

const { error: roleError } = await admin.from("user_roles").upsert({ user_id: profile.id, role: "owner" }, { onConflict: "user_id,role" });
if (roleError) {
  console.error(`Gagal memberi role Owner: ${roleError.message}`);
  process.exit(1);
}

console.log("");
console.log(`Selesai. ${normalized} sekarang Owner.`);
if (password) {
  console.log(`Password sementara: ${password}`);
  console.log("Masuk di /masuk dengan password ini. Kamu akan diminta membuat password pribadi.");
} else {
  console.log("Akun sudah ada sebelumnya; passwordnya tidak diubah.");
  console.log("Untuk membuat password sementara baru, jalankan lagi perintah yang sama dengan --reset di akhir.");
}
