import type { Metadata } from "next";
import Link from "next/link";
import { AuthShell } from "@/components/auth-shell";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Masuk" };

const ERRORS: Record<string, string> = {
  link: "Link tidak valid atau sudah kedaluwarsa. Minta link baru, lalu buka di browser yang sama.",
  nonaktif: "Akun ini sedang nonaktif. Hubungi tim Milestone English.",
};

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ galat?: string; status?: string }> }) {
  const { galat, status } = await searchParams;
  const initialError = ERRORS[galat ?? ""] ?? ERRORS[status ?? ""] ?? "";

  return (
    <AuthShell
      kicker="Portal Milestone English"
      title="Masuk ke portal"
      intro="Satu pintu untuk siswa, wali, tutor, dan tim Milestone. Masuk dengan email dan password akunmu."
      aside={
        <div className="border-t border-orange/20 pt-6">
          <p className="text-xs text-amber-200/80">Belum punya akun?</p>
          <Link href="/daftar" className="mt-3 block rounded-xl border-2 border-orange/50 px-4 py-3 text-center text-sm font-black text-orange hover:bg-orange/10">
            Daftar akun baru
          </Link>
        </div>
      }
    >
      <LoginForm enabled={isSupabaseConfigured} initialError={initialError} />
    </AuthShell>
  );
}
