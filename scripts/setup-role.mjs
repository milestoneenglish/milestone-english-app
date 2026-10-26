// Memberi role staf ke akun yang sudah ada (misalnya Owner yang ingin mencoba portal Lead/Tutor/Admin),
// atau membuat akun staf baru dengan password sementara yang wajib diganti saat pertama masuk.
// Jalankan: npm run setup:role -- email@domain.com lead "Nama Lengkap"
// Role: owner | admin | lead | tutor. Menu Staf & Role untuk Owner menyusul di Fase 5.
import { createClient } from "@supabase/supabase-js";
import { randomInt } from "node:crypto";

const STAFF_ROLES = ["owner", "admin", "lead", "tutor"];
const [email, role, fullName = ""] = process.argv.slice(2);

if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !STAFF_ROLES.includes(role)) {
  console.error('Pemakaian: npm run setup:role -- email@domain.com <owner|admin|lead|tutor> "Nama Lengkap"');
  process.exit(1);
}

const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const normalized = email.trim().toLowerCase();

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
}

const { error } = await admin.from("user_roles").upsert({ user_id: profile.id, role }, { onConflict: "user_id,role" });
if (error) {
  console.error(`Gagal memberi role: ${error.message}`);
  process.exit(1);
}
console.log(`Selesai. ${normalized} sekarang memegang role ${role}.`);
if (password) console.log(`Password sementara: ${password} (wajib diganti saat pertama masuk)`);
else console.log("Akun sudah ada; masuk seperti biasa lalu pilih role dari menu di kiri atas portal.");
