import type { Metadata } from "next";
import { cookies } from "next/headers";
import Link from "next/link";
import { AuthShell } from "@/components/auth-shell";
import { getLandingContent } from "@/lib/content";
import { GUEST_COOKIE } from "@/lib/placement/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { RegisterForm } from "./register-form";

export const metadata: Metadata = { title: "Daftar" };

export default async function RegisterPage({ searchParams }: { searchParams: Promise<{ program?: string }> }) {
  const { program } = await searchParams;
  const { programs } = await getLandingContent();
  const hasGuestTest = Boolean((await cookies()).get(GUEST_COOKIE));

  return (
    <AuthShell
      kicker="Pendaftaran"
      title="Daftar Milestone English"
      intro="Untuk siswa dewasa atau wali yang mendaftarkan anak. Setelah verifikasi email, langkah berikutnya adalah placement test."
      aside={
        <div className="space-y-4 border-t border-orange/20 pt-6">
          {hasGuestTest && (
            <p className="rounded-xl border border-emerald-400/40 bg-emerald-500/10 px-4 py-3 text-xs font-bold text-emerald-200">
              Placement test gratis yang kamu kerjakan di browser ini akan otomatis tersambung ke akunmu.
            </p>
          )}
          <p className="text-xs text-amber-200/80">
            Sudah punya akun? <Link href="/masuk" className="font-bold text-orange">Masuk</Link>
          </p>
        </div>
      }
    >
      {isSupabaseConfigured ? (
        <RegisterForm programs={programs.map((p) => ({ slug: p.slug, name: p.name, category: p.category }))} initialProgram={program ?? ""} />
      ) : (
        <p className="rounded-xl border border-orange/40 bg-orange/10 p-5 text-sm text-amber-100">Pendaftaran aktif setelah aplikasi tersambung ke Supabase.</p>
      )}
    </AuthShell>
  );
}
