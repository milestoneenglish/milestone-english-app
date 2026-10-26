"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Icon } from "@/components/icons";
import { createClient } from "@/lib/supabase/client";

const RESEND_SECONDS = 60;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function LoginForm({ enabled }: { enabled: boolean }) {
  const router = useRouter();
  const [step, setStep] = useState<"email" | "code">("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  async function requestCode() {
    setError("");
    const normalized = email.trim().toLowerCase();
    if (!EMAIL_PATTERN.test(normalized)) {
      setError("Masukkan alamat email yang valid.");
      return;
    }
    setBusy(true);
    const { error: err } = await createClient().auth.signInWithOtp({
      email: normalized,
      options: { shouldCreateUser: false },
    });
    setBusy(false);
    // Email yang belum terdaftar mendapat respons yang sama, supaya daftar akun tidak bisa ditebak.
    if (err && err.status === 429) {
      setError("Terlalu banyak permintaan kode. Tunggu sebentar lalu coba lagi.");
      return;
    }
    setEmail(normalized);
    setStep("code");
    setCooldown(RESEND_SECONDS);
  }

  async function verifyCode() {
    setError("");
    if (!/^\d{6}$/.test(code)) {
      setError("Kode terdiri dari 6 angka.");
      return;
    }
    setBusy(true);
    const { error: err } = await createClient().auth.verifyOtp({ email, token: code, type: "email" });
    if (err) {
      setBusy(false);
      setError("Kode salah atau sudah kedaluwarsa. Periksa lagi, atau minta kode baru.");
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
      <h2 className="text-xl font-black text-orange">{step === "email" ? "Masuk dengan email" : "Masukkan kode"}</h2>
      <p className="mt-1 text-xs text-amber-200/80">
        {step === "email" ? "Kami akan mengirim kode 6 digit ke email kamu." : `Jika ${email} terdaftar, kode 6 digit sudah kami kirim. Kode berlaku 10 menit.`}
      </p>

      {step === "email" ? (
        <form
          className="mt-6 space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            void requestCode();
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
          {error && <p className="text-sm font-bold text-rose-300" role="alert">{error}</p>}
          <button type="submit" disabled={busy} className="btn-orange flex w-full items-center justify-center gap-2 rounded-xl py-3.5 text-sm">
            <Icon name="mail" className="h-4 w-4" /> {busy ? "Mengirim kode..." : "Kirim kode masuk"}
          </button>
        </form>
      ) : (
        <form
          className="mt-6 space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            void verifyCode();
          }}
        >
          <label className="block">
            <span className="mb-2 block text-xs font-bold text-amber-100">Kode 6 digit</span>
            <input
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              autoFocus
              maxLength={6}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
              placeholder="000000"
              className="field text-center text-2xl tracking-[0.6em]"
            />
          </label>
          {error && <p className="text-sm font-bold text-rose-300" role="alert">{error}</p>}
          <button type="submit" disabled={busy || code.length !== 6} className="btn-orange w-full rounded-xl py-3.5 text-sm">
            {busy ? "Memeriksa..." : "Masuk"}
          </button>
          <div className="flex items-center justify-between text-xs">
            <button
              type="button"
              onClick={() => {
                setStep("email");
                setCode("");
                setError("");
              }}
              className="font-bold text-orange hover:text-orange-light"
            >
              Ganti email
            </button>
            <button type="button" disabled={cooldown > 0 || busy} onClick={() => void requestCode()} className="font-bold text-orange hover:text-orange-light disabled:text-amber-200/50">
              {cooldown > 0 ? `Kirim ulang dalam ${cooldown} detik` : "Kirim ulang kode"}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
