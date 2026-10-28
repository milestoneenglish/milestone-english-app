"use client";

import { useState } from "react";
import { closeTicketAction, createTicketAction, reopenTicketAction, replyTicketAction } from "@/app/portal/ops-actions";
import { TICKET_CATEGORIES } from "@/lib/ops";
import { danger, ErrorText, Field, ghost, useAction } from "./curriculum-forms";

export function NewTicketForm({ base }: { base: string }) {
  const { pending, error, act, router } = useAction();
  const [f, setF] = useState({ category: "", subject: "", body: "" });
  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        act(
          () => createTicketAction(f.category, f.subject, f.body),
          (res) => "id" in res && router.push(`${base}?id=${res.id}`),
        );
      }}
    >
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Kategori">
          <select value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })} className="field" required>
            <option value="">Pilih kategori</option>
            {Object.entries(TICKET_CATEGORIES).map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
        </Field>
        <div className="sm:col-span-2">
          <Field label="Judul singkat">
            <input value={f.subject} onChange={(e) => setF({ ...f, subject: e.target.value })} maxLength={120} placeholder="Contoh: Bukti transfer belum diverifikasi" className="field" required />
          </Field>
        </div>
      </div>
      <Field label="Ceritakan kendalanya" hint="Sertakan nomor invoice, nama kelas, atau tangkapan layar (tautan) bila ada.">
        <textarea value={f.body} onChange={(e) => setF({ ...f, body: e.target.value })} rows={5} maxLength={4000} className="field" required />
      </Field>
      <ErrorText error={error} />
      <button disabled={pending} className="btn-orange rounded-full px-6 py-2.5 text-sm">
        {pending ? "Mengirim..." : "Kirim tiket"}
      </button>
    </form>
  );
}

export function ReplyForm({ ticketId, staff, canClose }: { ticketId: string; staff: boolean; canClose: boolean }) {
  const { pending, error, act, router } = useAction();
  const [body, setBody] = useState("");
  const [confirm, setConfirm] = useState(false);
  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        act(() => replyTicketAction(ticketId, body), () => (setBody(""), router.refresh()), "Balasan terkirim");
      }}
    >
      <Field label={staff ? "Balasan untuk pengirim" : "Balas"}>
        <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={4} maxLength={4000} className="field" required />
      </Field>
      <ErrorText error={error} />
      <div className="flex flex-wrap items-center gap-3">
        <button disabled={pending} className="btn-orange rounded-full px-6 py-2.5 text-sm">
          {pending ? "Mengirim..." : "Kirim balasan"}
        </button>
        {canClose &&
          (confirm ? (
            <>
              <span className="text-xs text-amber-100">Tutup tiket? Pengirim masih bisa membukanya lagi dalam 7 hari.</span>
              <button type="button" disabled={pending} onClick={() => act(() => closeTicketAction(ticketId), undefined, "Tiket ditutup")} className={danger}>
                Ya, tutup tiket
              </button>
              <button type="button" onClick={() => setConfirm(false)} className={ghost}>
                Batal
              </button>
            </>
          ) : (
            <button type="button" onClick={() => setConfirm(true)} className={ghost}>
              Tutup tiket
            </button>
          ))}
      </div>
    </form>
  );
}

export function ReopenForm({ ticketId }: { ticketId: string }) {
  const { pending, error, act, router } = useAction();
  const [body, setBody] = useState("");
  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        act(() => reopenTicketAction(ticketId, body), () => (setBody(""), router.refresh()), "Tiket dibuka kembali");
      }}
    >
      <Field label="Masih ada kendala? Buka lagi tiket ini">
        <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={3} maxLength={4000} className="field" required />
      </Field>
      <ErrorText error={error} />
      <button disabled={pending} className={ghost}>
        Buka lagi tiket
      </button>
    </form>
  );
}
