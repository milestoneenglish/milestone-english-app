import Link from "next/link";
import { AuthShell } from "@/components/auth-shell";
import { dict, localePath, type Lang } from "@/lib/i18n";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { LoginForm } from "./login-form";

// Halaman Masuk siswa & wali, dipakai /masuk (Indonesia) dan /en/masuk (English).
export async function LoginView({ lang, searchParams }: { lang: Lang; searchParams: Promise<{ galat?: string; status?: string }> }) {
  const { galat, status } = await searchParams;
  const t = dict(lang).login;
  const initialError = t.errors[galat ?? ""] ?? t.errors[status ?? ""] ?? "";

  return (
    <AuthShell
      lang={lang}
      languages={{ id: "/masuk", en: "/en/masuk" }}
      kicker={t.kicker}
      title={t.title}
      intro={t.intro}
      aside={
        <div className="border-t border-orange/20 pt-6">
          <p className="text-xs text-amber-200/80">{t.noAccount}</p>
          <Link href={localePath(lang, "/daftar")} className="mt-3 block rounded-xl border-2 border-orange/50 px-4 py-3 text-center text-sm font-black text-orange hover:bg-orange/10">
            {t.register}
          </Link>
        </div>
      }
    >
      <LoginForm enabled={isSupabaseConfigured} initialError={initialError} lang={lang} />
    </AuthShell>
  );
}
