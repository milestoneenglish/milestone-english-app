import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthShell } from "@/components/auth-shell";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";
import { PasswordForm } from "./password-form";

export const metadata: Metadata = { title: "Buat password baru" };
export const dynamic = "force-dynamic";

export default async function NewPasswordPage() {
  if (!isSupabaseConfigured) redirect("/masuk");
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/masuk?galat=link");

  const { data: profile } = await supabase.from("profiles").select("must_change_password").eq("id", user.id).single();
  const temporary = profile?.must_change_password ?? false;

  return (
    <AuthShell
      kicker="Keamanan akun"
      title="Buat password baru"
      intro={
        temporary
          ? "Akunmu memakai password sementara. Buat password pribadi sebelum membuka portal."
          : "Buat password baru untuk akunmu. Setelah disimpan, kamu langsung masuk ke portal."
      }
    >
      <PasswordForm email={user.email ?? ""} />
    </AuthShell>
  );
}
