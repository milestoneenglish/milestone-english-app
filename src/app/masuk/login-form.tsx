"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ResendConfirmation } from "@/components/resend-confirmation";
import { dict, localePath, type Lang } from "@/lib/i18n";
import { createClient } from "@/lib/supabase/client";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const STAFF = ["owner", "admin", "lead", "tutor"];

// Dua pintu masuk: /masuk untuk siswa dan wali, /tim untuk tim Milestone. Akun yang salah pintu dikeluarkan lagi
// dengan petunjuk halaman yang benar; akun yang memegang keduanya boleh lewat mana saja.
// Halaman siswa & wali tersedia dalam dua bahasa; halaman tim selalu bahasa Indonesia.
export type Audience = "learner" | "team";

export function LoginForm({ enabled, initialError = "", audience = "learner", lang = "id" }: { enabled: boolean; initialError?: string; audience?: Audience; lang?: Lang }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(initialError);
  const [wrongDoor, setWrongDoor] = useState(false);
  const [unconfirmed, setUnconfirmed] = useState("");
  const team = audience === "team";
  const t = dict(team ? "id" : lang).login;

  async function signIn() {
    setError("");
    setWrongDoor(false);
    setUnconfirmed("");
    const normalized = email.trim().toLowerCase();
    if (!EMAIL_PATTERN.test(normalized)) {
      setError(t.invalidEmail);
      return;
    }
    if (!password) {
      setError(t.needPassword);
      return;
    }
    setBusy(true);
    const supabase = createClient();
    const { data, error: err } = await supabase.auth.signInWithPassword({ email: normalized, password });
    if (err) {
      setBusy(false);
      if (err.status === 429) setError(t.tooMany);
      else if (err.code === "email_not_confirmed") {
        setError(t.unconfirmed);
        setUnconfirmed(normalized);
      } else setError(t.wrong);
      return;
    }
    const { data: rows } = await supabase.from("user_roles").select("role").eq("user_id", data.user.id);
    const roles = (rows ?? []).map((r) => r.role as string);
    const staff = roles.some((r) => STAFF.includes(r));
    const learner = roles.find((r) => r === "student" || r === "guardian");
    if (audience === "learner" && staff && !learner) {
      await supabase.auth.signOut();
      setBusy(false);
      setWrongDoor(true);
      return;
    }
    if (audience === "team" && !staff) {
      await supabase.auth.signOut();
      setBusy(false);
      setWrongDoor(true);
      return;
    }
    // Akun yang memegang role tim sekaligus siswa/wali dibuka sesuai pintu yang dipakai.
    router.replace(audience === "learner" && learner ? `/portal/${learner === "student" ? "student" : "guardian"}` : "/portal");
    router.refresh();
  }

  if (!enabled) {
    return (
      <div className="rounded-xl border border-orange/40 bg-orange/10 p-5 text-sm text-amber-100">
        <p className="font-black text-orange">{t.previewTitle}</p>
        <p className="mt-2">{t.previewText}</p>
      </div>
    );
  }

  return (
    <div>
      <h2 className="text-xl font-black text-orange">{t.heading}</h2>
      <p className="mt-1 text-xs text-amber-200/80">{team ? "Gunakan email dan password akun tim yang dibuatkan Owner." : t.sub}</p>

      <form
        className="mt-6 space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          void signIn();
        }}
      >
        <label className="block">
          <span className="mb-2 block text-xs font-bold text-amber-100">{t.email}</span>
          <input
            type="email"
            inputMode="email"
            autoComplete="email"
            autoFocus
            required
            value={email}
            onChange={(e) => (setWrongDoor(false), setEmail(e.target.value))}
            placeholder={t.emailPlaceholder}
            className="field"
          />
        </label>
        <label className="block">
          <span className="mb-2 flex items-center justify-between text-xs font-bold text-amber-100">
            {t.password}
            <Link href={team ? "/lupa-password?untuk=tim" : localePath(lang, "/lupa-password")} className="font-bold text-orange hover:text-orange-light">
              {t.forgot}
            </Link>
          </span>
          <div className="relative">
            <input
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={t.password}
              className="field pr-24"
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-orange hover:text-orange-light"
              aria-label={showPassword ? t.hideAria : t.showAria}
            >
              {showPassword ? t.hide : t.show}
            </button>
          </div>
        </label>
        {error && (
          <p className="text-sm font-bold text-rose-300" role="alert">
            {error}
          </p>
        )}
        {unconfirmed && <ResendConfirmation email={unconfirmed} lang={lang} />}
        {wrongDoor && (
          <p className="rounded-xl border border-orange/40 bg-orange/10 p-4 text-sm font-bold text-amber-100" role="alert">
            {team ? "Halaman ini khusus tim Milestone English. Siswa dan wali masuk lewat " : t.wrongDoor}
            <Link href={team ? "/masuk" : "/tim"} className="text-orange underline">
              {team ? "halaman Masuk siswa & wali" : t.wrongDoorLink}
            </Link>
            .
          </p>
        )}
        <button type="submit" disabled={busy} className="btn-orange w-full rounded-xl py-3.5 text-sm">
          {busy ? t.busy : t.submit}
        </button>
      </form>
    </div>
  );
}
