import { cookies } from "next/headers";
import Link from "next/link";
import { AuthShell } from "@/components/auth-shell";
import { getLandingContent } from "@/lib/content";
import { dict, localePath, type Lang } from "@/lib/i18n";
import { GUEST_COOKIE } from "@/lib/placement/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { RegisterForm } from "./register-form";

// Halaman Daftar, dipakai /daftar (Indonesia) dan /en/daftar (English).
export async function RegisterView({ lang, searchParams }: { lang: Lang; searchParams: Promise<{ program?: string }> }) {
  const { program } = await searchParams;
  const { programs } = await getLandingContent(lang);
  const hasGuestTest = Boolean((await cookies()).get(GUEST_COOKIE));
  const t = dict(lang).register;
  const query = program ? `?program=${encodeURIComponent(program)}` : "";

  return (
    <AuthShell
      lang={lang}
      languages={{ id: `/daftar${query}`, en: `/en/daftar${query}` }}
      kicker={t.kicker}
      title={t.title}
      intro={t.intro}
      aside={
        <div className="space-y-4 border-t border-orange/20 pt-6">
          {hasGuestTest && <p className="rounded-xl border border-emerald-400/40 bg-emerald-500/10 px-4 py-3 text-xs font-bold text-emerald-200">{t.guestTest}</p>}
          <p className="text-xs text-amber-200/80">
            {t.haveAccount}{" "}
            <Link href={localePath(lang, "/masuk")} className="font-bold text-orange">
              {t.login}
            </Link>
          </p>
        </div>
      }
    >
      {isSupabaseConfigured ? (
        <RegisterForm programs={programs.map((p) => ({ slug: p.slug, name: p.name, category: p.category }))} initialProgram={program ?? ""} lang={lang} />
      ) : (
        <p className="rounded-xl border border-orange/40 bg-orange/10 p-5 text-sm text-amber-100">{t.notConfigured}</p>
      )}
    </AuthShell>
  );
}
