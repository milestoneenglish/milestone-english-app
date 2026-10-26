"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function LoginForm({ enabled, initialError = "" }: { enabled: boolean; initialError?: string }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(initialError);

  async function signIn() {
    setError("");
    const normalized = email.trim().toLowerCase();
    if (!EMAIL_PATTERN.test(normalized)) {
      setError("Masukkan alamat email yang valid.");
      return;
    }
    if (!password) {
      setError("Masukkan password.");
      return;
    }
    setBusy(true);
    const { error: err } = await createClient().auth.signInWithPassword({ email: normalized, password });
    if (err) {
      setBusy(false);
      if (err.status === 429) setError("Terlalu banyak percobaan. Tunggu beberapa menit lalu coba lagi.");
      else if (err.code === "email_not_confirmed") setError("Email belum diverifikasi. Buka link verifikasi di email pendaftaranmu.");
      else setError("Email atau password salah.");
      return;
    }
    router.replace("/portal");
    router.refresh();
  }

  if (!enabled) {
    return (
      <div className="rounded-xl border border-orange/40 bg-orange/10 p-5 text-sm text-amber-100">
        <p className="font-black text-orange">Login belum aktif di mode pratinjau.</p>
        <p className="mt-2">Isi kunci Supabase di file .env.local (lihat docs/SETUP.md), lalu jalankan ulang aplikasi.</p>
      </div>
    );
  }

  return (
    <div>
      <h2 className="text-xl font-black text-orange">Masuk dengan email</h2>
      <p className="mt-1 text-xs text-amber-200/80">Gunakan email dan password akun Milestone English kamu.</p>

      <form
        className="mt-6 space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          void signIn();
        }}
      >
        <label className="block">
          <span className="mb-2 block text-xs font-bold text-amber-100">Email</span>
          <input
            type="email"
            inputMode="email"
            autoComplete="email"
            autoFocus
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="nama@email.com"
            className="field"
          />
        </label>
        <label className="block">
          <span className="mb-2 flex items-center justify-between text-xs font-bold text-amber-100">
            Password
            <Link href="/lupa-password" className="font-bold text-orange hover:text-orange-light">
              Lupa password?
            </Link>
          </span>
          <div className="relative">
            <input
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password"
              className="field pr-20"
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-orange hover:text-orange-light"
              aria-label={showPassword ? "Sembunyikan password" : "Tampilkan password"}
            >
              {showPassword ? "Sembunyikan" : "Tampilkan"}
            </button>
          </div>
        </label>
        {error && (
          <p className="text-sm font-bold text-rose-300" role="alert">
            {error}
          </p>
        )}
        <button type="submit" disabled={busy} className="btn-orange w-full rounded-xl py-3.5 text-sm">
          {busy ? "Memeriksa..." : "Masuk"}
        </button>
      </form>
    </div>
  );
}
