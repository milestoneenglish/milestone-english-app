"use client";

import { useState } from "react";
import { dict, type Lang } from "@/lib/i18n";
import { createClient } from "@/lib/supabase/client";

// Kirim ulang link konfirmasi akun dari Supabase (email belum terverifikasi atau email pertama tidak sampai).
export function ResendConfirmation({ email, lang = "id" }: { email: string; lang?: Lang }) {
  const [state, setState] = useState<"idle" | "busy" | "sent" | "limited" | "failed">("idle");
  const t = dict(lang).resend;
  async function resend() {
    setState("busy");
    const { error } = await createClient().auth.resend({ type: "signup", email, options: { emailRedirectTo: `${window.location.origin}/auth/callback?next=/portal` } });
    setState(!error ? "sent" : error.status === 429 ? "limited" : "failed");
  }
  if (state === "sent") return <p className="text-xs font-bold text-emerald-300">{t.sent(email)}</p>;
  return (
    <p className="text-xs text-amber-200/80">
      {state === "limited" ? t.limited : state === "failed" ? t.failed : t.prompt}
      <button type="button" disabled={state === "busy"} onClick={() => void resend()} className="font-black text-orange hover:underline disabled:opacity-60">
        {state === "busy" ? t.busy : t.action}
      </button>
    </p>
  );
}
