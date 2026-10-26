import type { Metadata } from "next";
import { AuthShell } from "@/components/auth-shell";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { ForgotForm } from "./forgot-form";

export const metadata: Metadata = { title: "Lupa password" };

export default function ForgotPasswordPage() {
  return (
    <AuthShell
      kicker="Atur ulang password"
      title="Lupa password"
      intro="Masukkan email akunmu. Kami akan mengirim link untuk membuat password baru."
    >
      <ForgotForm enabled={isSupabaseConfigured} />
    </AuthShell>
  );
}
