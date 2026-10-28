import Link from "next/link";
import { LanguageSwitch } from "@/components/landing/navbar";
import { Logo } from "@/components/logo";
import { dict, localePath, type Lang } from "@/lib/i18n";
import { HtmlLang } from "./landing/html-lang";

// Bingkai dua kolom untuk halaman masuk dan daftar, mengikuti desain portal login lama.
// `languages` berisi alamat halaman yang sama dalam tiap bahasa; tanpa itu tombol ID | EN tidak tampil (misalnya /tim).
export function AuthShell({
  kicker,
  title,
  intro,
  aside,
  children,
  lang = "id",
  languages,
}: {
  kicker: string;
  title: string;
  intro: string;
  aside?: React.ReactNode;
  children: React.ReactNode;
  lang?: Lang;
  languages?: Record<Lang, string>;
}) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-navy-dark px-4 py-10">
      {lang === "en" && <HtmlLang lang="en" />}
      <div className="grid w-full max-w-5xl grid-cols-1 gap-6 lg:grid-cols-12">
        <section className="workspace-panel flex flex-col justify-between p-7 sm:p-8 lg:col-span-5">
          <div>
            <Logo className="h-9 w-auto" plate />
            <p className="mt-8 text-[11px] font-black uppercase tracking-[0.24em] text-amber-200/80">{kicker}</p>
            <h1 className="mt-3 text-3xl font-black leading-tight text-orange">{title}</h1>
            <p className="lp-muted mt-3 text-sm leading-relaxed">{intro}</p>
          </div>
          {aside && <div className="mt-8">{aside}</div>}
        </section>
        <section className="workspace-panel p-7 sm:p-8 lg:col-span-7">
          <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
            {languages ? <LanguageSwitch lang={lang} hrefs={languages} /> : <span />}
            <Link href={localePath(lang, "/")} className="text-xs font-bold text-orange hover:text-orange-light">
              {dict(lang).auth.backHome}
            </Link>
          </div>
          {children}
        </section>
      </div>
    </main>
  );
}
