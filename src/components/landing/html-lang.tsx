"use client";

import { useEffect } from "react";

// Halaman English memakai root layout yang sama (lang="id"); atribut bahasa dokumen disesuaikan di browser
// supaya pembaca layar dan penerjemah browser memakai bahasa yang benar.
export function HtmlLang({ lang }: { lang: string }) {
  useEffect(() => {
    const before = document.documentElement.lang;
    document.documentElement.lang = lang;
    return () => {
      document.documentElement.lang = before;
    };
  }, [lang]);
  return null;
}
