import type { Metadata } from "next";
import { AuthShell } from "@/components/auth-shell";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { LOGIN_ERRORS } from "../masuk/errors";
import { LoginForm } from "../masuk/login-form";

export const metadata: Metadata = { title: "Masuk tim", robots: { index: false } };

// Pintu masuk tim Milestone (Owner, Admin, Academic Lead, Tutor). Tidak ditautkan dari website publik.
export default async function TeamLoginPage({ searchParams }: { searchParams: Promise<{ galat?: string; status?: string }> }) {
  const { galat, status } = await searchParams;
  const initialError = LOGIN_ERRORS[galat ?? ""] ?? LOGIN_ERRORS[status ?? ""] ?? "";

  return (
    <AuthShell
      kicker="Tim Milestone English"
      title="Masuk tim"
      intro="Untuk Owner, Admin Operasional, Academic Lead, dan Tutor. Akun tim dibuat oleh Owner dari menu Staf & Role."
      aside={
        <p className="border-t border-orange/20 pt-6 text-xs leading-relaxed text-amber-200/80">
          Memegang lebih dari satu role, misalnya Academic Lead yang juga mengajar? Masuk sekali, lalu pindah role dari menu di kiri atas portal.
        </p>
      }
    >
      <LoginForm enabled={isSupabaseConfigured} initialError={initialError} audience="team" />
    </AuthShell>
  );
}
