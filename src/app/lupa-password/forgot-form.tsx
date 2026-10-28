"use client";

import Link from "next/link";
import { useState } from "react";
import { Icon } from "@/components/icons";
import { dict, localePath, type Lang } from "@/lib/i18n";
import { createClient } from "@/lib/supabase/client";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function ForgotForm({ enabled, back = "/masuk", lang = "id" }: { enabled: boolean; back?: string; lang?: Lang }) {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  const t = dict(lang).forgot;

  async function send() {
    setError("");
    const normalized = email.trim().toLowerCase();
    if (!EMAIL_PATTERN.test(normalized)) {
      setError(t.invalidEmail);
      return;
    }
    setBusy(true);
    // Link di email kembali ke halaman Buat password baru dalam bahasa yang sama.
    const { error: err } = await createClient().auth.resetPasswordForEmail(normalized, {
      redirectTo: `${window.location.origin}/auth/callback?next=${localePath(lang, "/password-baru")}`,
    });
    setBusy(false);
    if (err && err.status === 429) {
      setError(t.tooMany);
      return;
    }
    // Respons sama untuk email terdaftar maupun tidak, supaya daftar akun tidak bisa ditebak.
    setEmail(normalized);
    setSent(true);
  }

  if (!enabled) {
    return <p className="rounded-xl border border-orange/40 bg-orange/10 p-5 text-sm text-amber-100">{dict(lang).auth.preview}</p>;
  }

  if (sent) {
    return (
      <div>
        <h2 className="text-xl font-black text-orange">{t.sentTitle}</h2>
        <p className="lp-muted mt-3 text-sm leading-relaxed">{t.sentText(email)}</p>
        <Link href={back} className="btn-orange mt-6 inline-block rounded-xl px-6 py-3 text-sm">
          {t.toLogin}
        </Link>
      </div>
    );
  }

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        void send();
      }}
    >
      <label className="block">
        <span className="mb-2 block text-xs font-bold text-amber-100">{t.email}</span>
        <input type="email" inputMode="email" autoComplete="email" autoFocus required value={email} onChange={(e) => setEmail(e.target.value)} placeholder={dict(lang).login.emailPlaceholder} className="field" />
      </label>
      {error && (
        <p className="text-sm font-bold text-rose-300" role="alert">
          {error}
        </p>
      )}
      <button type="submit" disabled={busy} className="btn-orange flex w-full items-center justify-center gap-2 rounded-xl py-3.5 text-sm">
        <Icon name="mail" className="h-4 w-4" /> {busy ? t.busy : t.submit}
      </button>
      <Link href={back} className="block text-center text-xs font-bold text-orange hover:text-orange-light">
        {t.remember}
      </Link>
    </form>
  );
}
