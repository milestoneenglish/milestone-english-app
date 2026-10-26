"use client";

import Link from "next/link";
import { useState } from "react";
import { Icon } from "@/components/icons";
import { Logo } from "@/components/logo";

const LINKS = [
  { href: "#hero", label: "Beranda" },
  { href: "#programs", label: "Program" },
  { href: "#methodology", label: "Metode" },
  { href: "#why-us", label: "Keunggulan" },
  { href: "#faq", label: "FAQ" },
];

export function Navbar({ showTestimonials }: { showTestimonials: boolean }) {
  const [open, setOpen] = useState(false);
  const links = showTestimonials ? [...LINKS.slice(0, 4), { href: "#testimonials", label: "Testimoni" }, LINKS[4]] : LINKS;

  return (
    <div className="sticky top-3 z-50 mx-auto w-full max-w-7xl px-3 sm:top-5 sm:px-6 lg:px-8">
      <nav className="flex items-center justify-between rounded-full border border-slate-100/80 bg-white px-4 py-2.5 shadow-[0_12px_38px_rgba(0,0,0,0.30)] backdrop-blur sm:px-6 sm:py-3 lg:px-8">
        <Logo className="h-8 w-auto sm:h-9" />

        <div className="hidden items-center gap-6 text-sm font-bold text-slate-700 lg:flex xl:gap-8">
          {links.map((l) => (
            <a key={l.href} href={l.href} className="transition-colors hover:text-orange">
              {l.label}
            </a>
          ))}
        </div>

        <div className="flex items-center gap-2 sm:gap-2.5">
          <Link href="/daftar" className="btn-orange rounded-full px-3 py-1.5 text-xs sm:px-7 sm:py-2.5 sm:text-sm">
            Daftar
          </Link>
          <Link href="/masuk" className="btn-orange rounded-full px-3 py-1.5 text-xs sm:px-7 sm:py-2.5 sm:text-sm">
            Masuk
          </Link>
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-slate-700 transition hover:bg-slate-200 sm:h-9 sm:w-9 lg:hidden"
            aria-label={open ? "Tutup menu" : "Buka menu"}
            aria-expanded={open}
          >
            <Icon name={open ? "close" : "menu"} className="h-4 w-4 sm:h-5 sm:w-5" />
          </button>
        </div>
      </nav>

      {open && (
        <div className="mt-3 space-y-1 rounded-3xl border border-slate-100 bg-white p-5 text-slate-800 shadow-2xl lg:hidden">
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
        </div>
      )}
    </div>
  );
}
