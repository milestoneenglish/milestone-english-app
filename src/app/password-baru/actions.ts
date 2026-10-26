"use server";

import { redirect } from "next/navigation";
import { passwordProblem } from "@/lib/password";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export type ChangePasswordState = { error: string };

export async function changePassword(_prev: ChangePasswordState, form: FormData): Promise<ChangePasswordState> {
  const password = String(form.get("password") ?? "");
  const confirm = String(form.get("confirm") ?? "");

  const problem = passwordProblem(password);
  if (problem) return { error: problem };
  if (password !== confirm) return { error: "Konfirmasi password tidak sama." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/masuk?galat=link");

  const { error } = await supabase.auth.updateUser({ password });
  if (error) {
    if (error.code === "same_password") return { error: "Password baru harus berbeda dari password sebelumnya." };
    if (error.code === "weak_password") return { error: "Password terlalu lemah. Gunakan kombinasi huruf dan angka yang lebih panjang." };
    return { error: "Password gagal disimpan. Coba lagi." };
  }

  // Password sudah diganti oleh pemilik akun; tanda wajib ganti dihapus lewat server.
  const { error: flagError } = await createAdminClient().from("profiles").update({ must_change_password: false }).eq("id", user.id);
  if (flagError) return { error: "Password tersimpan, tetapi status akun gagal diperbarui. Muat ulang halaman." };

  redirect("/portal");
}
