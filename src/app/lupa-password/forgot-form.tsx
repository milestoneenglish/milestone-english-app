"use client";

import Link from "next/link";
import { useState } from "react";
import { Icon } from "@/components/icons";
import { createClient } from "@/lib/supabase/client";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function ForgotForm({ enabled }: { enabled: boolean }) {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  async function send() {
    setError("");
    const normalized = email.trim().toLowerCase();
    if (!EMAIL_PATTERN.test(normalized)) {
      setError("Masukkan alamat email yang valid.");
      return;
    }
    setBusy(true);
    const { error: err } = await createClient().auth.resetPasswordForEmail(normalized, {
      redirectTo: `${window.location.origin}/auth/callback?next=/password-baru`,
    });
    setBusy(false);
    if (err && err.status === 429) {
      setError("Terlalu banyak permintaan. Tunggu beberapa menit lalu coba lagi.");
      return;
    }
    // Respons sama untuk email terdaftar maupun tidak, supaya daftar akun tidak bisa ditebak.
    setEmail(normalized);
    setSent(true);
  }

  if (!enabled) {
    return <p className="rounded-xl border border-orange/40 bg-orange/10 p-5 text-sm text-amber-100">Fitur ini aktif setelah aplikasi tersambung ke Supabase.</p>;
  }

  if (sent) {
    return (
      <div>
        <h2 className="text-xl font-black text-orange">Cek email kamu</h2>
        <p className="lp-muted mt-3 text-sm leading-relaxed">
          Jika <span className="font-bold text-white">{email}</span> terdaftar, link untuk membuat password baru sudah kami kirim. Buka link itu dari browser ini.
        </p>
        <Link href="/masuk" className="btn-orange mt-6 inline-block rounded-xl px-6 py-3 text-sm">
          Kembali ke halaman masuk
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
        <span className="mb-2 block text-xs font-bold text-amber-100">Email</span>
        <input type="email" inputMode="email" autoComplete="email" autoFocus required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="nama@email.com" className="field" />
      </label>
      {error && (
        <p className="text-sm font-bold text-rose-300" role="alert">
          {error}
        </p>
      )}
      <button type="submit" disabled={busy} className="btn-orange flex w-full items-center justify-center gap-2 rounded-xl py-3.5 text-sm">
        <Icon name="mail" className="h-4 w-4" /> {busy ? "Mengirim..." : "Kirim link atur ulang"}
      </button>
      <Link href="/masuk" className="block text-center text-xs font-bold text-orange hover:text-orange-light">
        Ingat password? Masuk
      </Link>
    </form>
  );
}
