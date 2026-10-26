import type { Metadata } from "next";
import Link from "next/link";
import { AuthShell } from "@/components/auth-shell";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Masuk" };

export default function LoginPage() {
  return (
    <AuthShell
      kicker="Portal Milestone English"
      title="Masuk ke portal"
      intro="Satu pintu untuk siswa, wali, tutor, dan tim Milestone. Masukkan email yang terdaftar, lalu ketik kode 6 digit yang kami kirim."
      aside={
        <div className="border-t border-orange/20 pt-6">
          <p className="text-xs text-amber-200/80">Belum punya akun?</p>
          <Link href="/daftar" className="mt-3 block rounded-xl border-2 border-orange/50 px-4 py-3 text-center text-sm font-black text-orange hover:bg-orange/10">
            Daftar akun baru
          </Link>
        </div>
      }
    >
      <LoginForm enabled={isSupabaseConfigured} />
    </AuthShell>
  );
}
