import { redirect } from "next/navigation";
import { AuthShell } from "@/components/auth-shell";
import { dict, localePath, type Lang } from "@/lib/i18n";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";
import { PasswordForm } from "./password-form";

// Halaman Buat password baru, dipakai /password-baru (Indonesia) dan /en/password-baru (English).
export async function NewPasswordView({ lang }: { lang: Lang }) {
  if (!isSupabaseConfigured) redirect(localePath(lang, "/masuk"));
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`${localePath(lang, "/masuk")}?galat=link`);

  const { data: profile } = await supabase.from("profiles").select("must_change_password").eq("id", user.id).single();
  const temporary = profile?.must_change_password ?? false;
  const t = dict(lang).newPassword;

  return (
    <AuthShell lang={lang} languages={{ id: "/password-baru", en: "/en/password-baru" }} kicker={t.kicker} title={t.title} intro={temporary ? t.introTemporary : t.intro}>
      <PasswordForm email={user.email ?? ""} lang={lang} />
    </AuthShell>
  );
}
