"use client";

import Link from "next/link";
import { useState } from "react";
import { Icon } from "@/components/icons";
import { Logo } from "@/components/logo";
import { dict, localePath, type Lang } from "@/lib/i18n";

export type NavSection = "tutors" | "testimonials" | "gallery" | "faq";

// Tombol ID | EN. Versi Indonesia di "/", versi English di "/en".
export function LanguageSwitch({ lang, hrefs, light = false }: { lang: Lang; hrefs: Record<Lang, string>; light?: boolean }) {
  return (
    <div role="group" aria-label={dict(lang).nav.language} className={`flex items-center rounded-full border p-0.5 text-[11px] font-black ${light ? "border-slate-200 bg-slate-100" : "border-orange/40 bg-navy"}`}>
      {(["id", "en"] as const).map((l) => (
        <Link
          key={l}
          href={hrefs[l]}
          hrefLang={l}
          aria-current={l === lang ? "true" : undefined}
          className={`rounded-full px-2.5 py-1 transition ${l === lang ? "bg-orange text-white" : light ? "text-slate-600 hover:text-orange" : "text-amber-100 hover:text-orange"}`}
        >
          {l.toUpperCase()}
        </Link>
      ))}
    </div>
  );
}

export function Navbar({ lang, sections }: { lang: Lang; sections: NavSection[] }) {
  const [open, setOpen] = useState(false);
  const t = dict(lang).nav;
  const has = (s: NavSection) => sections.includes(s);
  const links = [
    { href: "#hero", label: t.home },
    { href: "#programs", label: t.programs },
    { href: "#methodology", label: t.method },
    has("tutors") && { href: "#tutors", label: t.tutors },
    { href: "#why-us", label: t.why },
    has("testimonials") && { href: "#testimonials", label: t.testimonials },
    has("gallery") && { href: "#gallery", label: t.gallery },
    has("faq") && { href: "#faq", label: t.faq },
  ].filter(Boolean) as { href: string; label: string }[];

  return (
    <div className="sticky top-3 z-50 mx-auto w-full max-w-7xl px-3 sm:top-5 sm:px-6 lg:px-8">
      <nav className="flex items-center justify-between gap-2 rounded-full border border-slate-100/80 bg-white px-4 py-2.5 shadow-[0_12px_38px_rgba(0,0,0,0.30)] backdrop-blur sm:px-6 sm:py-3 lg:px-8">
        <Logo className="h-8 w-auto shrink-0 sm:h-9" />

        <div className="hidden items-center gap-5 text-sm font-bold text-slate-700 xl:flex">
          {links.map((l) => (
            <a key={l.href} href={l.href} className="transition-colors hover:text-orange">
              {l.label}
            </a>
          ))}
        </div>

        <div className="flex items-center gap-1.5 sm:gap-2.5">
          <span className="hidden sm:block">
            <LanguageSwitch lang={lang} hrefs={{ id: "/", en: "/en" }} light />
          </span>
          <Link href={localePath(lang, "/daftar")} className="btn-orange rounded-full px-3 py-1.5 text-xs sm:px-6 sm:py-2.5 sm:text-sm">
            {t.register}
          </Link>
          <Link href={localePath(lang, "/masuk")} className="btn-orange rounded-full px-3 py-1.5 text-xs sm:px-6 sm:py-2.5 sm:text-sm">
            {t.login}
          </Link>
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-slate-700 transition hover:bg-slate-200 sm:h-9 sm:w-9 xl:hidden"
            aria-label={open ? t.closeMenu : t.openMenu}
            aria-expanded={open}
          >
            <Icon name={open ? "close" : "menu"} className="h-4 w-4 sm:h-5 sm:w-5" />
          </button>
        </div>
      </nav>

      {open && (
        <div className="mt-3 space-y-1 rounded-3xl border border-slate-100 bg-white p-5 text-slate-800 shadow-2xl xl:hidden">
          {links.map((l) => (
            <a
              key={l.href}
              href={l.href}
              onClick={() => setOpen(false)}
              className="block rounded-xl px-3.5 py-2.5 text-sm font-bold transition hover:bg-orange/10 hover:text-orange"
            >
              {l.label}
            </a>
          ))}
          <div className="flex items-center justify-between border-t border-slate-100 px-3.5 pt-4 sm:hidden">
            <span className="text-xs font-bold text-slate-500">{t.language}</span>
            <LanguageSwitch lang={lang} hrefs={{ id: "/", en: "/en" }} light />
          </div>
        </div>
      )}
    </div>
  );
}
