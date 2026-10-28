"use client";

import Link from "next/link";
import { useState } from "react";
import { Modal } from "../modal";

// Rincian satu tagihan untuk siswa/wali: isi invoice, riwayat status, dan bukti transfer yang pernah dikirim.

export type PaymentDetail = {
  number: string;
  description: string;
  student: string;
  program: string;
  batch: string;
  schedule: string;
  amount: string;
  status: string;
  timeline: { label: string; at: string }[];
  rejectReason: string | null;
  proofs: { sent: string; bank: string; sender: string; amount: string; transferDate: string; status: "pending" | "approved" | "rejected"; reason: string | null }[];
  receiptHref: string | null;
};

const PROOF_STATUS = { pending: "Menunggu verifikasi", approved: "Diterima", rejected: "Ditolak" } as const;
const PROOF_TONE = { pending: "text-orange", approved: "text-emerald-300", rejected: "text-rose-300" } as const;

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-4 py-2 text-sm">
      <dt className="text-amber-200/70">{label}</dt>
      <dd className="text-right font-bold text-white">{children}</dd>
    </div>
  );
}

export function PaymentDetailButton({ detail }: { detail: PaymentDetail }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="rounded-full border border-orange/40 px-4 py-2 text-xs font-black text-orange hover:bg-orange/10">
        Detail
      </button>
      {open && (
        <Modal title={`Tagihan ${detail.number}`} onClose={() => setOpen(false)}>
          <div className="space-y-5">
            <dl className="divide-y divide-orange/10">
              <Row label="Siswa">{detail.student}</Row>
              <Row label="Program">{detail.program}</Row>
              <Row label="Batch">{detail.batch}</Row>
              <Row label="Jadwal">{detail.schedule}</Row>
              <Row label="Keterangan">{detail.description}</Row>
              <Row label="Jumlah">{detail.amount}</Row>
              <Row label="Status">{detail.status}</Row>
            </dl>
            {detail.rejectReason && <p className="rounded-xl border border-rose-400/40 bg-rose-500/10 px-4 py-3 text-sm font-bold text-rose-300">Bukti terakhir ditolak: {detail.rejectReason}</p>}
            <div>
              <p className="mb-2 text-[11px] font-black uppercase tracking-[0.18em] text-amber-200/80">Riwayat</p>
              <ol className="space-y-2 border-l border-orange/30 pl-4">
                {detail.timeline.map((t) => (
                  <li key={t.label} className="text-sm">
                    <span className="font-bold text-white">{t.label}</span>
                    <span className="block text-xs text-amber-200/70">{t.at}</span>
                  </li>
                ))}
              </ol>
            </div>
            <div>
              <p className="mb-2 text-[11px] font-black uppercase tracking-[0.18em] text-amber-200/80">Bukti transfer ({detail.proofs.length})</p>
              {detail.proofs.length === 0 ? (
                <p className="text-sm text-slate-400">Belum ada bukti yang dikirim.</p>
              ) : (
                <ul className="space-y-2">
                  {detail.proofs.map((p, i) => (
                    <li key={i} className="rounded-xl border border-orange/20 px-4 py-3 text-sm">
                      <p className="flex flex-wrap justify-between gap-2">
                        <span className="font-bold text-white">
                          {p.bank} a.n. {p.sender}
                        </span>
                        <span className={`text-xs font-black ${PROOF_TONE[p.status]}`}>{PROOF_STATUS[p.status]}</span>
                      </p>
                      <p className="text-xs text-amber-200/70">
                        {p.amount} · transfer {p.transferDate} · dikirim {p.sent}
                      </p>
                      {p.reason && <p className="mt-1 text-xs text-rose-300">Alasan: {p.reason}</p>}
                    </li>
                  ))}
                </ul>
              )}
            </div>
            {detail.receiptHref && (
              <Link href={detail.receiptHref} target="_blank" className="btn-orange inline-block rounded-full px-5 py-2.5 text-sm">
                Buka kuitansi
              </Link>
            )}
          </div>
        </Modal>
      )}
    </>
  );
}
