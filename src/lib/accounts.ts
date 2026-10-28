import "server-only";
import { randomInt } from "node:crypto";
import { ClassError } from "@/lib/classes";
import { createAdminClient } from "@/lib/supabase/admin";

// Selama email belum disambungkan, siswa/wali yang lupa password menghubungi admin. Admin membuat password
// sementara (ditampilkan sekali) yang wajib diganti saat pengguna masuk berikutnya. Akun staf tidak bisa
// diatur ulang dari sini; itu wewenang Owner di menu Staf & Role.

// 10 karakter acak, selalu berisi huruf dan angka. Tanpa karakter yang mirip (0/O, 1/l).
export function temporaryPassword() {
  const letters = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ";
  const digits = "23456789";
  const all = letters + digits;
  const chars = [letters[randomInt(letters.length)], digits[randomInt(digits.length)]];
  while (chars.length < 10) chars.push(all[randomInt(all.length)]);
  for (let i = chars.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join("");
}

export type ResetResult = { password: string; name: string; email: string; phone: string | null };

export async function resetLearnerPassword(actorId: string, userId: string): Promise<ResetResult> {
  const admin = createAdminClient();
  const [{ data: profile }, { data: roles }] = await Promise.all([
    admin.from("profiles").select("full_name, email, phone, status").eq("id", userId).maybeSingle(),
    admin.from("user_roles").select("role").eq("user_id", userId),
  ]);
  const held = (roles ?? []).map((r) => r.role as string);
  if (!profile || !held.length) throw new ClassError("Akun tidak ditemukan.");
  if (held.some((r) => r !== "student" && r !== "guardian")) throw new ClassError("Password akun tim diatur ulang oleh Owner dari menu Staf & Role.");
  if (profile.status !== "active") throw new ClassError("Akun ini nonaktif.");

  const password = temporaryPassword();
  const { error } = await admin.auth.admin.updateUserById(userId, { password });
  if (error) throw new ClassError("Password gagal diganti. Coba lagi.");
  await admin.from("profiles").update({ must_change_password: true }).eq("id", userId);
  await admin.from("audit_log").insert({ actor_id: actorId, action: "learner_password_reset", entity: "profiles", entity_id: userId, detail: { email: profile.email } });
  return { password, name: profile.full_name || profile.email, email: profile.email, phone: profile.phone };
}
