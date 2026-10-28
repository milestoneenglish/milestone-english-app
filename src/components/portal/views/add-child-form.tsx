"use client";

import { useActionState, useCallback, useEffect, useState } from "react";
import { Modal } from "../modal";
import { toast } from "@/components/toast";
import { addChildAction, type FormState } from "@/app/portal/student-actions";
import { LEARNING_GOALS } from "@/lib/placement/levels";

export function AddChildForm({ programs, onDone }: { programs: { id: string; name: string }[]; onDone?: () => void }) {
  const [state, action, pending] = useActionState<FormState, FormData>(addChildAction, { error: "", ok: false });
  useEffect(() => {
    if (state.ok) {
      toast.success("Anak ditambahkan. Mulai placement test dari daftar anak.");
      onDone?.();
    } else if (state.error) toast.error(state.error);
  }, [state, onDone]);
  return (
    <form action={action} className="grid gap-4 sm:grid-cols-2">
      <label className="block">
        <span className="mb-2 block text-xs font-bold text-amber-100">Nama lengkap anak</span>
        <input name="name" required maxLength={120} className="field" />
      </label>
      <label className="block">
        <span className="mb-2 block text-xs font-bold text-amber-100">Tahun lahir</span>
        <input name="birth_year" required inputMode="numeric" maxLength={4} placeholder="2015" className="field" />
      </label>
      <label className="block">
        <span className="mb-2 block text-xs font-bold text-amber-100">Hubungan</span>
        <select name="relationship" className="field" defaultValue="orang_tua">
          <option value="orang_tua">Orang tua</option>
          <option value="wali">Wali</option>
          <option value="lainnya">Lainnya</option>
        </select>
      </label>
      <label className="block">
        <span className="mb-2 block text-xs font-bold text-amber-100">Tujuan belajar</span>
        <select name="goal" required className="field" defaultValue="">
          <option value="">Pilih tujuan</option>
          {LEARNING_GOALS.map((g) => (
            <option key={g.value} value={g.value}>
              {g.label}
            </option>
          ))}
        </select>
      </label>
      <label className="block sm:col-span-2">
        <span className="mb-2 block text-xs font-bold text-amber-100">Program yang diminati (opsional)</span>
        <select name="program" className="field" defaultValue="">
          <option value="">Belum tahu</option>
          {programs.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </label>
      <div className="sm:col-span-2">
        {state.error && <p className="mb-3 text-sm font-bold text-rose-300">{state.error}</p>}
        {state.ok && <p className="mb-3 text-sm font-bold text-emerald-300">Anak berhasil ditambahkan. Mulai placement test dari daftar di atas.</p>}
        <button disabled={pending} className="btn-orange rounded-xl px-6 py-3 text-sm">
          {pending ? "Menyimpan..." : "Tambah anak"}
        </button>
      </div>
    </form>
  );
}

export function AddChildButton({ programs }: { programs: { id: string; name: string }[] }) {
  const [open, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="btn-orange rounded-full px-5 py-2.5 text-sm">
        + Tambah anak
      </button>
      {open && (
        <Modal title="Tambah anak" onClose={close}>
          <AddChildForm programs={programs} onDone={close} />
        </Modal>
      )}
    </>
  );
}
