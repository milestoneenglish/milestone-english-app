"use server";

import { redirect } from "next/navigation";
import { dict, isLang, localePath } from "@/lib/i18n";
import { passwordProblem } from "@/lib/password";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export type ChangePasswordState = { error: string };

export async function changePassword(_prev: ChangePasswordState, form: FormData): Promise<ChangePasswordState> {
  const password = String(form.get("password") ?? "");
  const confirm = String(form.get("confirm") ?? "");
  const lang = isLang(form.get("lang")) ? (form.get("lang") as "id" | "en") : "id";
  const t = dict(lang).newPassword;

  const problem = passwordProblem(password, lang);
  if (problem) return { error: problem };
  if (password !== confirm) return { error: t.mismatch };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`${localePath(lang, "/masuk")}?galat=link`);

  const { error } = await supabase.auth.updateUser({ password });
  if (error) {
    if (error.code === "same_password") return { error: t.same };
    if (error.code === "weak_password") return { error: t.weak };
    return { error: t.failed };
  }

  // Password sudah diganti oleh pemilik akun; tanda wajib ganti dihapus lewat server.
  const { error: flagError } = await createAdminClient().from("profiles").update({ must_change_password: false }).eq("id", user.id);
  if (flagError) return { error: t.flag };

  redirect("/portal");
}
