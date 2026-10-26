"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { enrollAction, onboardingDoneAction, prepareProofUpload, submitProofAction } from "@/app/portal/class-actions";
import { Icon } from "@/components/icons";
import { createClient } from "@/lib/supabase/client";

const rupiah = (n: number) => `Rp${n.toLocaleString("id-ID")}`;

function ErrorText({ error }: { error: string }) {
  return error ? (
    <p className="text-sm font-bold text-rose-300" role="alert">
      {error}
    </p>
  ) : null;
}

export type PickableBatch = {
  id: string;
  code: string;
  programName: string;
  category: string;
  entryLevel: string;
  price: number;
  startLabel: string;
  schedule: string;
  sessions: number;
  tutor: string | null;
  seatsLeft: number;
  recommended: boolean;
};

// Kartu batch dengan konfirmasi sebelum kursi dipegang dan invoice terbit.
export function BatchPicker({ studentId, batch, level, payHref }: { studentId: string; batch: PickableBatch; level: string | null; payHref: string }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  const full = batch.seatsLeft <= 0;

  const choose = () =>
    start(async () => {
      setError("");
      const res = await enrollAction(studentId, batch.id);
      if (!res.ok) return setError(res.error);
      router.push(`${payHref}${payHref.includes("?") ? "&" : "?"}invoice=${res.invoiceId}`);
    });

  return (
    <div className={`rounded-2xl border p-5 ${batch.recommended ? "border-orange/60 bg-orange/10" : "border-orange/20 bg-navy/40"}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-bold text-amber-200/80">
            {batch.category} · {batch.entryLevel}
          </p>
          <p className="text-lg font-black text-orange">{batch.programName}</p>
          <p className="text-[11px] font-bold text-slate-400">Batch {batch.code}</p>
        </div>
        {batch.recommended && <span className="rounded-full bg-orange px-3 py-1 text-[11px] font-black text-navy">Direkomendasikan</span>}
      </div>
      <dl className="mt-4 grid gap-2 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-[11px] font-bold text-amber-200/70">Mulai</dt>
          <dd className="text-amber-100">{batch.startLabel}</dd>
        </div>
        <div>
          <dt className="text-[11px] font-bold text-amber-200/70">Jadwal</dt>
          <dd className="text-amber-100">
            {batch.schedule} · {batch.sessions} sesi
          </dd>
        </div>
        <div>
          <dt className="text-[11px] font-bold text-amber-200/70">Tutor</dt>
          <dd className="text-amber-100">{batch.tutor ?? "Diumumkan sebelum kelas mulai"}</dd>
        </div>
        <div>
          <dt className="text-[11px] font-bold text-amber-200/70">Kursi</dt>
          <dd className={full ? "font-bold text-rose-300" : "text-amber-100"}>{full ? "Penuh" : `Tersisa ${batch.seatsLeft}`}</dd>
        </div>
      </dl>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-orange/15 pt-4">
        <p className="text-xl font-black text-white">{rupiah(batch.price)}</p>
        {!confirming && (
          <button disabled={full} onClick={() => setConfirming(true)} className="btn-orange rounded-full px-5 py-2.5 text-sm">
            Pilih batch ini
          </button>
        )}
      </div>
      {confirming && (
        <div className="mt-4 space-y-3 rounded-xl border border-orange/30 bg-navy-dark/70 p-4">
          {!batch.recommended && (
            <p className="rounded-lg border border-amber-400/40 bg-amber-500/10 px-3 py-2 text-xs font-bold text-amber-200">
              Program ini tidak termasuk rekomendasi placement atau laporan terakhir{level ? ` (level ${level})` : ""}. Materinya mungkin terlalu mudah atau terlalu sulit. Tetap lanjut bila kamu yakin.
            </p>
          )}
          <p className="text-sm text-amber-100">
            Kursi dipegang selama <span className="font-black text-white">2x24 jam</span> dan invoice {rupiah(batch.price)} langsung terbit. Lewat batas itu, kursi dilepas otomatis.
          </p>
          <ErrorText error={error} />
          <div className="flex flex-wrap gap-2">
            <button disabled={pending} onClick={choose} className="btn-orange rounded-full px-5 py-2.5 text-sm">
              {pending ? "Memproses..." : "Ya, pegang kursi dan buat invoice"}
            </button>
            <button disabled={pending} onClick={() => setConfirming(false)} className="rounded-full border border-orange/40 px-5 py-2.5 text-sm font-bold text-amber-100">
              Batal
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={() => {
        void navigator.clipboard?.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}
      className="rounded-full border border-orange/40 px-3 py-1 text-[11px] font-black text-orange hover:bg-orange/10"
    >
      {copied ? "Tersalin" : "Salin"}
    </button>
  );
}

const BANKS = ["BCA", "Mandiri", "BNI", "BRI", "BSI", "CIMB Niaga", "Permata", "Bank Jago", "SeaBank", "GoPay", "OVO", "DANA", "ShopeePay", "Lainnya"];

function todayJakarta() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta" }).format(new Date());
}

export function ProofForm({ invoiceId, amount }: { invoiceId: string; amount: number }) {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [bank, setBank] = useState("");
  const [sender, setSender] = useState("");
  const [date, setDate] = useState(todayJakarta());
  const [nominal, setNominal] = useState(String(amount));
  const [error, setError] = useState("");
  const [step, setStep] = useState<"" | "upload" | "save">("");

  async function submit() {
    setError("");
    if (!file) return setError("Pilih foto atau PDF bukti transfer.");
    if (!bank) return setError("Pilih bank pengirim.");
    if (sender.trim().length < 2) return setError("Isi nama pemilik rekening pengirim.");
    const amountValue = Number(nominal.replace(/\D/g, ""));
    if (!amountValue) return setError("Isi nominal yang ditransfer.");
    setStep("upload");
    const target = await prepareProofUpload(invoiceId, file.type, file.size);
    if (!target.ok) {
      setStep("");
      return setError(target.error);
    }
    const up = await createClient().storage.from("payment-proofs").uploadToSignedUrl(target.path, target.token, file, { contentType: file.type });
    if (up.error) {
      setStep("");
      return setError("File gagal diunggah. Periksa koneksi lalu coba lagi.");
    }
    setStep("save");
    const res = await submitProofAction(invoiceId, { path: target.path, bank, sender, transferDate: date, amount: amountValue });
    setStep("");
    if (!res.ok) return setError(res.error);
    router.refresh();
  }

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        void submit();
      }}
    >
      <label className="block">
        <span className="mb-2 block text-xs font-bold text-amber-100">Foto atau PDF bukti transfer</span>
        <input type="file" accept="image/jpeg,image/png,image/webp,application/pdf" onChange={(e) => setFile(e.target.files?.[0] ?? null)} className="field file:mr-3 file:rounded-full file:border-0 file:bg-orange file:px-3 file:py-1 file:text-xs file:font-black file:text-navy" />
        <span className="mt-1.5 block text-xs text-amber-200/70">Maksimal 5 MB. Pastikan nominal, tanggal, dan rekening tujuan terlihat jelas.</span>
      </label>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="mb-2 block text-xs font-bold text-amber-100">Bank pengirim</span>
          <select value={bank} onChange={(e) => setBank(e.target.value)} className="field">
            <option value="">Pilih bank</option>
            {BANKS.map((b) => (
              <option key={b}>{b}</option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="mb-2 block text-xs font-bold text-amber-100">Nama pemilik rekening pengirim</span>
          <input value={sender} onChange={(e) => setSender(e.target.value)} maxLength={120} placeholder="Sesuai buku tabungan" className="field" />
        </label>
        <label className="block">
          <span className="mb-2 block text-xs font-bold text-amber-100">Tanggal transfer</span>
          <input type="date" value={date} max={todayJakarta()} onChange={(e) => setDate(e.target.value)} className="field" />
        </label>
        <label className="block">
          <span className="mb-2 block text-xs font-bold text-amber-100">Nominal ditransfer (Rp)</span>
          <input value={nominal} onChange={(e) => setNominal(e.target.value)} inputMode="numeric" className="field" />
        </label>
      </div>
      <ErrorText error={error} />
      <button disabled={step !== ""} className="btn-orange w-full rounded-xl py-3 text-sm sm:w-auto sm:px-8">
        {step === "upload" ? "Mengunggah file..." : step === "save" ? "Mengirim..." : "Kirim bukti transfer"}
      </button>
    </form>
  );
}

export function OnboardingButton({ enrollmentId }: { enrollmentId: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState("");
  return (
    <div className="flex flex-wrap items-center gap-3">
      <button
        disabled={pending}
        onClick={() =>
          start(async () => {
            const res = await onboardingDoneAction(enrollmentId);
            if (!res.ok) setError(res.error);
            else router.refresh();
          })
        }
        className="btn-orange flex items-center gap-2 rounded-full px-6 py-3 text-sm"
      >
        {pending ? "Menyimpan..." : "Saya siap mulai"} <Icon name="arrow" className="h-4 w-4" />
      </button>
      <ErrorText error={error} />
    </div>
  );
}
