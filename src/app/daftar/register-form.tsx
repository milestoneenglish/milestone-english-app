"use client";

import Link from "next/link";
import { useState } from "react";
import { LEARNING_GOALS } from "@/lib/placement/levels";
import { passwordProblem } from "@/lib/password";
import { normalizePhone } from "@/lib/phone";
import { ResendConfirmation } from "@/components/resend-confirmation";
import { dict, goalLabelFor, localePath, type Lang } from "@/lib/i18n";
import { createClient } from "@/lib/supabase/client";

type ProgramOption = { slug: string; name: string; category: string };

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const THIS_YEAR = new Date().getFullYear();

function Field({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <label className="block">
      <span className="mb-2 block text-xs font-bold text-amber-100">{label}</span>
      {children}
      {hint && <span className="mt-1.5 block text-xs text-amber-200/70">{hint}</span>}
    </label>
  );
}

export function RegisterForm({ programs, initialProgram, lang = "id" }: { programs: ProgramOption[]; initialProgram: string; lang?: Lang }) {
  const t = dict(lang).register;
  const e = t.errors;
  const [type, setType] = useState<"student" | "guardian">("student");
  const [form, setForm] = useState({
    fullName: "",
    email: "",
    phone: "",
    birthYear: "",
    childName: "",
    childBirthYear: "",
    relationship: "orang_tua",
    goal: "",
    program: programs.some((p) => p.slug === initialProgram) ? initialProgram : "",
    password: "",
    confirm: "",
    agree: false,
  });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [sentTo, setSentTo] = useState("");

  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((f) => ({ ...f, [key]: e.target.type === "checkbox" ? (e.target as HTMLInputElement).checked : e.target.value }));

  function validYear(value: string, min: number, max: number) {
    const n = Number(value);
    return Number.isInteger(n) && n >= min && n <= max;
  }

  async function submit() {
    setError("");
    const email = form.email.trim().toLowerCase();
    const phone = normalizePhone(form.phone);
    if (form.fullName.trim().length < 2) return setError(e.name);
    if (!EMAIL_PATTERN.test(email)) return setError(e.email);
    if (!phone) return setError(e.phone);
    if (type === "student" && !validYear(form.birthYear, THIS_YEAR - 90, THIS_YEAR - 13)) return setError(e.birthYear);
    if (type === "guardian" && form.childName.trim().length < 2) return setError(e.childName);
    if (type === "guardian" && !validYear(form.childBirthYear, THIS_YEAR - 25, THIS_YEAR - 4)) return setError(e.childBirthYear);
    if (!form.goal) return setError(e.goal);
    const problem = passwordProblem(form.password, lang);
    if (problem) return setError(problem);
    if (form.password !== form.confirm) return setError(e.mismatch);
    if (!form.agree) return setError(e.agree);

    setBusy(true);
    const data: Record<string, string> = {
      account_type: type,
      full_name: form.fullName.trim(),
      phone,
      learning_goal: form.goal,
      program_slug: form.program,
    };
    if (type === "student") data.birth_year = form.birthYear;
    else Object.assign(data, { child_name: form.childName.trim(), child_birth_year: form.childBirthYear, relationship: form.relationship });

    const { data: result, error: err } = await createClient().auth.signUp({
      email,
      password: form.password,
      options: { data, emailRedirectTo: `${window.location.origin}/auth/callback?next=/portal` },
    });
    setBusy(false);
    if (err) {
      if (err.code === "over_email_send_rate_limit") return setError(e.emailLimit);
      if (err.status === 429) return setError(e.tooMany);
      if (err.code === "email_address_invalid") return setError(e.emailInvalid);
      if (err.code === "weak_password") return setError(e.weak);
      return setError(e.failed);
    }
    // Saat verifikasi email dinonaktifkan di Supabase, sesi langsung aktif.
    if (result.session) {
      window.location.assign("/portal");
      return;
    }
    setSentTo(email);
  }

  if (sentTo) {
    return (
      <div>
        <h2 className="text-xl font-black text-orange">{t.sentTitle}</h2>
        <p className="lp-muted mt-3 text-sm leading-relaxed">{t.sentText(sentTo)}</p>
        <p className="mt-3 text-xs text-amber-200/80">{t.sentHint}</p>
        <div className="mt-3">
          <ResendConfirmation email={sentTo} lang={lang} />
        </div>
        <Link href={localePath(lang, "/masuk")} className="btn-orange mt-6 inline-block rounded-xl px-6 py-3 text-sm">
          {t.toLogin}
        </Link>
      </div>
    );
  }

  return (
    <form
      className="space-y-5"
      onSubmit={(e) => {
        e.preventDefault();
        void submit();
      }}
    >
      <div className="grid grid-cols-2 gap-2 rounded-2xl border border-orange/30 bg-navy p-1.5" role="radiogroup" aria-label={t.typeAria}>
        {(
          [
            ["student", t.student, t.studentSub],
            ["guardian", t.guardian, t.guardianSub],
          ] as const
        ).map(([value, title, sub]) => (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={type === value}
            onClick={() => setType(value)}
            className={`rounded-xl px-3 py-3 text-left transition ${type === value ? "btn-orange" : "text-amber-100 hover:bg-orange/10"}`}
          >
            <span className="block text-sm font-black">{title}</span>
            <span className="block text-[11px] opacity-80">{sub}</span>
          </button>
        ))}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={type === "guardian" ? t.guardianName : t.fullName}>
          <input value={form.fullName} onChange={set("fullName")} autoComplete="name" required maxLength={120} className="field" />
        </Field>
        <Field label={t.phone} hint={t.phoneHint}>
          <input value={form.phone} onChange={set("phone")} type="tel" inputMode="tel" autoComplete="tel" required placeholder="081234567890" className="field" />
        </Field>
        <Field label={t.email}>
          <input value={form.email} onChange={set("email")} type="email" inputMode="email" autoComplete="email" required className="field" />
        </Field>
        {type === "student" ? (
          <Field label={t.birthYear}>
            <input value={form.birthYear} onChange={set("birthYear")} inputMode="numeric" required maxLength={4} placeholder="2001" className="field" />
          </Field>
        ) : (
          <Field label={t.relationship}>
            <select value={form.relationship} onChange={set("relationship")} className="field">
              {Object.entries(t.relations).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </Field>
        )}
      </div>

      {type === "guardian" && (
        <div className="grid gap-4 rounded-2xl border border-orange/25 p-4 sm:grid-cols-2">
          <Field label={t.childName}>
            <input value={form.childName} onChange={set("childName")} required maxLength={120} className="field" />
          </Field>
          <Field label={t.childBirthYear}>
            <input value={form.childBirthYear} onChange={set("childBirthYear")} inputMode="numeric" required maxLength={4} placeholder="2015" className="field" />
          </Field>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t.goal}>
          <select value={form.goal} onChange={set("goal")} required className="field">
            <option value="">{t.goalPick}</option>
            {LEARNING_GOALS.map((g) => (
              <option key={g.value} value={g.value}>
                {goalLabelFor(lang, g.value, g.label)}
              </option>
            ))}
          </select>
        </Field>
        <Field label={t.program} hint={t.programHint}>
          <select value={form.program} onChange={set("program")} className="field">
            <option value="">{t.programNone}</option>
            {programs.map((p) => (
              <option key={p.slug} value={p.slug}>
                {p.name} · {p.category}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t.password} hint={dict(lang).password.rule}>
          <input value={form.password} onChange={set("password")} type="password" autoComplete="new-password" required minLength={8} maxLength={72} className="field" />
        </Field>
        <Field label={t.confirm}>
          <input value={form.confirm} onChange={set("confirm")} type="password" autoComplete="new-password" required minLength={8} maxLength={72} className="field" />
        </Field>
      </div>

      <label className="flex items-start gap-3 text-xs leading-relaxed text-amber-100">
        <input type="checkbox" checked={form.agree} onChange={set("agree")} className="mt-0.5 h-4 w-4 shrink-0 accent-orange" />
        {t.agree}
      </label>

      {error && (
        <p className="text-sm font-bold text-rose-300" role="alert">
          {error}
        </p>
      )}
      <button type="submit" disabled={busy} className="btn-orange w-full rounded-xl py-3.5 text-sm">
        {busy ? t.busy : t.submit}
      </button>
    </form>
  );
}
