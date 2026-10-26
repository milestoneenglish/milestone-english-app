"use client";

import { useActionState, useState } from "react";
import { PASSWORD_RULE } from "@/lib/password";
import { changePassword, type ChangePasswordState } from "./actions";

export function PasswordForm({ email }: { email: string }) {
  const [state, action, pending] = useActionState<ChangePasswordState, FormData>(changePassword, { error: "" });
  const [show, setShow] = useState(false);

  return (
    <form action={action} className="space-y-4">
      {/* Membantu pengelola password browser menyimpan password untuk email yang benar. */}
      <input type="email" name="username" autoComplete="username" value={email} readOnly hidden />
      <label className="block">
        <span className="mb-2 block text-xs font-bold text-amber-100">Password baru</span>
        <input type={show ? "text" : "password"} name="password" autoComplete="new-password" autoFocus required minLength={8} maxLength={72} className="field" />
        <span className="mt-2 block text-xs text-amber-200/70">{PASSWORD_RULE}</span>
      </label>
      <label className="block">
        <span className="mb-2 block text-xs font-bold text-amber-100">Ulangi password baru</span>
        <input type={show ? "text" : "password"} name="confirm" autoComplete="new-password" required minLength={8} maxLength={72} className="field" />
      </label>
      <label className="flex items-center gap-2 text-xs font-bold text-amber-100">
        <input type="checkbox" checked={show} onChange={(e) => setShow(e.target.checked)} className="h-4 w-4 accent-orange" />
        Tampilkan password
      </label>
      {state.error && (
        <p className="text-sm font-bold text-rose-300" role="alert">
          {state.error}
        </p>
      )}
      <button type="submit" disabled={pending} className="btn-orange w-full rounded-xl py-3.5 text-sm">
        {pending ? "Menyimpan..." : "Simpan password"}
      </button>
    </form>
  );
}
