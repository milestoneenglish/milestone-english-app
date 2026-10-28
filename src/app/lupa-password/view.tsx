import Link from "next/link";
import { AuthShell } from "@/components/auth-shell";
import { WhatsappIcon } from "@/components/icons";
import { authEmailEnabled } from "@/lib/auth-email";
import { getLandingContent, whatsappLink } from "@/lib/content";
import { dict, localePath, type Lang } from "@/lib/i18n";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { ForgotForm } from "./forgot-form";

// Saat link email Supabase aktif (lihat lib/auth-email), pengguna meminta link reset sendiri. Selama belum aktif,
// password diatur ulang oleh tim: siswa/wali menghubungi admin, staf menghubungi Owner (halaman tim selalu bahasa Indonesia).
export async function ForgotView({ lang, searchParams }: { lang: Lang; searchParams: Promise<{ untuk?: string }> }) {
  const team = (await searchParams).untuk === "tim";
  const t = dict(team ? "id" : lang).forgot;
  const back = team ? "/tim" : localePath(lang, "/masuk");
  const languages = team ? undefined : { id: "/lupa-password", en: "/en/lupa-password" };

  if (await authEmailEnabled()) {
    return (
      <AuthShell lang={lang} languages={languages} kicker={t.kicker} title={t.title} intro={t.introEmail}>
        <ForgotForm enabled={isSupabaseConfigured} back={back} lang={team ? "id" : lang} />
      </AuthShell>
    );
  }

  const { contact } = await getLandingContent();
  return (
    <AuthShell lang={lang} languages={languages} kicker={t.kicker} title={t.title} intro={t.introAdmin}>
      {team ? (
        <div className="space-y-4 text-sm leading-relaxed text-amber-100">
          <h2 className="text-xl font-black text-orange">Hubungi Owner</h2>
          <p>
            Minta Owner membuat password sementara untuk akunmu dari menu <span className="font-bold text-white">Staf &amp; Role</span>.
          </p>
        </div>
      ) : (
        <div className="space-y-4 text-sm leading-relaxed text-amber-100">
          <h2 className="text-xl font-black text-orange">{t.adminTitle}</h2>
          <p>{t.adminText}</p>
          {contact.whatsapp && (
            <a href={whatsappLink(contact.whatsapp, t.adminWa)} target="_blank" rel="noopener noreferrer" className="btn-orange inline-flex items-center gap-2 rounded-xl px-6 py-3 text-sm">
              <WhatsappIcon className="h-5 w-5" /> {t.adminChat}
            </a>
          )}
        </div>
      )}
      <Link href={back} className="mt-8 block text-xs font-bold text-orange hover:text-orange-light">
        {dict(team ? "id" : lang).auth.backLogin}
      </Link>
    </AuthShell>
  );
}
