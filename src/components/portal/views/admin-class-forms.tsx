"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { createBatchAction, decidePaymentAction, enrollAction, proofUrlAction, savePaymentSettingsAction, updateBatchAction } from "@/app/portal/class-actions";
import { generateSessions, parseDurationLabel, scheduleLabel, WEEKDAYS } from "@/lib/schedule";

type Option = { id: string; name: string };
export type ProgramOption = { id: string; name: string; capacity: number; duration_label: string };

function ErrorText({ error }: { error: string }) {
  return error ? (
    <p className="text-sm font-bold text-rose-300" role="alert">
      {error}
    </p>
  ) : null;
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-2 block text-xs font-bold text-amber-100">{label}</span>
      {children}
      {hint && <span className="mt-1.5 block text-xs text-amber-200/70">{hint}</span>}
    </label>
  );
}

const DATE_FMT = new Intl.DateTimeFormat("id-ID", { weekday: "short", day: "numeric", month: "short", timeZone: "Asia/Jakarta" });

export function BatchCreateForm({ programs, tutors }: { programs: ProgramOption[]; tutors: Option[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState("");
  const [f, setF] = useState({ programId: "", startDate: "", weekdays: [] as number[], time: "19:00", minutes: 60, sessions: 8, capacity: 6, tutorId: "", meetingUrl: "", status: "open" as "draft" | "open", notes: "" });
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((x) => ({ ...x, [k]: v }));

  const preview = useMemo(() => generateSessions({ startDate: f.startDate, weekdays: f.weekdays, time: f.time, count: f.sessions }), [f.startDate, f.weekdays, f.time, f.sessions]);

  function pickProgram(id: string) {
    const p = programs.find((x) => x.id === id);
    const d = p ? parseDurationLabel(p.duration_label) : null;
    setF((x) => ({ ...x, programId: id, capacity: p?.capacity ?? x.capacity, sessions: d?.sessions ?? x.sessions, minutes: d?.minutes ?? x.minutes }));
  }

  const submit = () =>
    start(async () => {
      setError("");
      const res = await createBatchAction(f);
      if (!res.ok) return setError(res.error);
      router.push(`/portal/admin/batch?id=${res.batchId}`);
    });

  return (
    <form
      className="space-y-5"
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Program">
          <select value={f.programId} onChange={(e) => pickProgram(e.target.value)} className="field" required>
            <option value="">Pilih program</option>
            {programs.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} · {p.duration_label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Tanggal mulai" hint="Sesi pertama jatuh pada hari terpilih pertama sejak tanggal ini.">
          <input type="date" value={f.startDate} onChange={(e) => set("startDate", e.target.value)} className="field" required />
        </Field>
      </div>
      <fieldset>
        <legend className="mb-2 text-xs font-bold text-amber-100">Hari kelas</legend>
        <div className="flex flex-wrap gap-2">
          {WEEKDAYS.map((d) => {
            const on = f.weekdays.includes(d.value);
            return (
              <button
                key={d.value}
                type="button"
                aria-pressed={on}
                onClick={() => set("weekdays", on ? f.weekdays.filter((x) => x !== d.value) : [...f.weekdays, d.value].sort())}
                className={`rounded-full border px-4 py-2 text-xs font-black ${on ? "border-orange bg-orange text-white" : "border-orange/30 text-amber-100"}`}
              >
                {d.label}
              </button>
            );
          })}
        </div>
      </fieldset>
      <div className="grid gap-4 sm:grid-cols-4">
        <Field label="Jam mulai (WIB)">
          <input type="time" value={f.time} onChange={(e) => set("time", e.target.value)} className="field" required />
        </Field>
        <Field label="Durasi (menit)">
          <input type="number" min={15} max={240} value={f.minutes} onChange={(e) => set("minutes", Number(e.target.value))} className="field" />
        </Field>
        <Field label="Jumlah sesi">
          <input type="number" min={1} max={200} value={f.sessions} onChange={(e) => set("sessions", Number(e.target.value))} className="field" />
        </Field>
        <Field label="Kapasitas">
          <input type="number" min={1} max={30} value={f.capacity} onChange={(e) => set("capacity", Number(e.target.value))} className="field" />
        </Field>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Tutor" hint="Boleh diisi nanti; tutor mendapat pemberitahuan saat ditugaskan.">
          <select value={f.tutorId} onChange={(e) => set("tutorId", e.target.value)} className="field">
            <option value="">Belum ditentukan</option>
            {tutors.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Link kelas online" hint="Google Meet atau Zoom. Hanya terlihat oleh siswa yang sudah terdaftar dan tutor.">
          <input value={f.meetingUrl} onChange={(e) => set("meetingUrl", e.target.value)} placeholder="https://meet.google.com/..." className="field" />
        </Field>
      </div>
      <Field label="Catatan internal (opsional)">
        <input value={f.notes} onChange={(e) => set("notes", e.target.value)} maxLength={1000} className="field" />
      </Field>
      <fieldset className="flex flex-wrap gap-4 text-sm text-amber-100">
        <label className="flex items-center gap-2">
          <input type="radio" checked={f.status === "open"} onChange={() => set("status", "open")} className="accent-orange" /> Langsung buka pendaftaran
        </label>
        <label className="flex items-center gap-2">
          <input type="radio" checked={f.status === "draft"} onChange={() => set("status", "draft")} className="accent-orange" /> Simpan sebagai draf
        </label>
      </fieldset>

      {preview.length > 0 && (
        <div className="lp-card-soft p-4">
          <p className="text-sm font-black text-orange">{scheduleLabel(f.weekdays, f.time, f.minutes)}</p>
          <p className="mt-1 text-xs text-amber-100">
            {preview.length} sesi: {preview.map((s) => DATE_FMT.format(new Date(s.starts_at))).join(", ")}
          </p>
        </div>
      )}
      <ErrorText error={error} />
      <button disabled={pending} className="btn-orange rounded-full px-8 py-3 text-sm">
        {pending ? "Membuat batch..." : "Buat batch dan jadwal sesi"}
      </button>
    </form>
  );
}

export type EditableBatch = { id: string; tutorId: string; meetingUrl: string; capacity: number; status: "draft" | "open" | "running" | "completed" | "cancelled"; notes: string };

const STATUS_OPTIONS = [
  { value: "draft", label: "Draf (belum tampil)" },
  { value: "open", label: "Buka pendaftaran" },
  { value: "running", label: "Berjalan (pendaftaran ditutup)" },
  { value: "completed", label: "Selesai" },
  { value: "cancelled", label: "Dibatalkan" },
] as const;

export function BatchEditForm({ batch, tutors }: { batch: EditableBatch; tutors: Option[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [f, setF] = useState(batch);
  const set = <K extends keyof EditableBatch>(k: K, v: EditableBatch[K]) => {
    setSaved(false);
    setF((x) => ({ ...x, [k]: v }));
  };
  const save = () =>
    start(async () => {
      setError("");
      const res = await updateBatchAction(batch.id, f);
      if (!res.ok) return setError(res.error);
      setSaved(true);
      router.refresh();
    });
  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        save();
      }}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Status">
          <select value={f.status} onChange={(e) => set("status", e.target.value as EditableBatch["status"])} className="field">
            {STATUS_OPTIONS.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Tutor">
          <select value={f.tutorId} onChange={(e) => set("tutorId", e.target.value)} className="field">
            <option value="">Belum ditentukan</option>
            {tutors.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Link kelas online">
          <input value={f.meetingUrl} onChange={(e) => set("meetingUrl", e.target.value)} placeholder="https://meet.google.com/..." className="field" />
        </Field>
        <Field label="Kapasitas">
          <input type="number" min={1} max={30} value={f.capacity} onChange={(e) => set("capacity", Number(e.target.value))} className="field" />
        </Field>
      </div>
      <Field label="Catatan internal">
        <input value={f.notes} onChange={(e) => set("notes", e.target.value)} maxLength={1000} className="field" />
      </Field>
      <ErrorText error={error} />
      <div className="flex items-center gap-3">
        <button disabled={pending} className="btn-orange rounded-full px-6 py-2.5 text-sm">
          {pending ? "Menyimpan..." : "Simpan perubahan"}
        </button>
        {saved && <span className="text-sm font-bold text-emerald-300">Tersimpan</span>}
      </div>
    </form>
  );
}

export function AdminEnrollForm({ batchId, candidates }: { batchId: string; candidates: Option[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [value, setValue] = useState("");
  const [error, setError] = useState("");
  if (!candidates.length) return <p className="text-sm text-slate-400">Tidak ada siswa dengan hasil placement terbit yang belum terdaftar di batch ini.</p>;
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <select value={value} onChange={(e) => setValue(e.target.value)} className="field max-w-sm py-2!" aria-label="Pilih siswa">
          <option value="">Pilih siswa</option>
          {candidates.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <button
          disabled={!value || pending}
          onClick={() =>
            start(async () => {
              setError("");
              const res = await enrollAction(value, batchId);
              if (!res.ok) return setError(res.error);
              setValue("");
              router.refresh();
            })
          }
          className="btn-orange rounded-full px-4 py-2 text-xs"
        >
          {pending ? "Memproses..." : "Tempatkan dan terbitkan invoice"}
        </button>
      </div>
      <ErrorText error={error} />
    </div>
  );
}

const REJECT_REASONS = [
  "Nominal transfer tidak sesuai tagihan",
  "Bukti transfer tidak terbaca atau terpotong",
  "Nama penerima atau nomor rekening tujuan tidak cocok",
  "Dana belum masuk ke rekening Milestone English",
];

export function PaymentDecision({ proofId }: { proofId: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState("");
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState("");

  const open = () =>
    start(async () => {
      const res = await proofUrlAction(proofId);
      if (!res.ok) return setError(res.error);
      window.open(res.url, "_blank", "noopener,noreferrer");
    });
  const decide = (approve: boolean) =>
    start(async () => {
      setError("");
      const res = await decidePaymentAction(proofId, approve, approve ? "" : reason);
      if (!res.ok) return setError(res.error);
      router.refresh();
    });

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <button disabled={pending} onClick={open} className="rounded-full border border-orange/40 px-4 py-2 text-xs font-black text-orange hover:bg-orange/10">
          Lihat bukti
        </button>
        {!rejecting && (
          <>
            <button disabled={pending} onClick={() => setRejecting(true)} className="rounded-full border border-rose-400/50 px-4 py-2 text-xs font-black text-rose-300 hover:bg-rose-500/10">
              Tolak
            </button>
            <button disabled={pending} onClick={() => decide(true)} className="btn-orange rounded-full px-4 py-2 text-xs">
              {pending ? "Memproses..." : "Verifikasi dan aktifkan kelas"}
            </button>
          </>
        )}
      </div>
      {rejecting && (
        <div className="space-y-2 rounded-xl border border-rose-400/30 p-3">
          <select value={REJECT_REASONS.includes(reason) ? reason : ""} onChange={(e) => setReason(e.target.value)} className="field py-2!" aria-label="Alasan penolakan">
            <option value="">Pilih alasan</option>
            {REJECT_REASONS.map((r) => (
              <option key={r}>{r}</option>
            ))}
          </select>
          <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Atau tulis alasan lain" maxLength={300} className="field py-2!" aria-label="Alasan lain" />
          <p className="text-xs text-amber-200/80">Alasan dikirim ke siswa/wali. Mereka mendapat waktu minimal 24 jam untuk mengunggah ulang.</p>
          <div className="flex gap-2">
            <button disabled={pending || reason.trim().length < 5} onClick={() => decide(false)} className="rounded-full bg-rose-500 px-4 py-2 text-xs font-black text-white disabled:opacity-50">
              Kirim penolakan
            </button>
            <button disabled={pending} onClick={() => setRejecting(false)} className="rounded-full border border-orange/40 px-4 py-2 text-xs font-bold text-amber-100">
              Batal
            </button>
          </div>
        </div>
      )}
      <ErrorText error={error} />
    </div>
  );
}

export function PaymentSettingsForm({ initial }: { initial: { bank_name: string; account_number: string; account_name: string; note: string } }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [f, setF] = useState(initial);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setSaved(false);
    setF((x) => ({ ...x, [k]: e.target.value }));
  };
  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          setError("");
          const res = await savePaymentSettingsAction(f);
          if (!res.ok) return setError(res.error);
          setSaved(true);
          router.refresh();
        });
      }}
    >
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Nama bank">
          <input value={f.bank_name} onChange={set("bank_name")} placeholder="BCA" className="field" required />
        </Field>
        <Field label="Nomor rekening">
          <input value={f.account_number} onChange={set("account_number")} inputMode="numeric" className="field" required />
        </Field>
        <Field label="Nama pemilik rekening">
          <input value={f.account_name} onChange={set("account_name")} className="field" required />
        </Field>
      </div>
      <Field label="Catatan instruksi transfer (opsional)" hint="Tampil di halaman pembayaran siswa, misalnya: cantumkan nomor invoice di berita transfer.">
        <input value={f.note} onChange={set("note")} maxLength={600} className="field" />
      </Field>
      <ErrorText error={error} />
      <div className="flex items-center gap-3">
        <button disabled={pending} className="btn-orange rounded-full px-6 py-2.5 text-sm">
          {pending ? "Menyimpan..." : "Simpan rekening"}
        </button>
        {saved && <span className="text-sm font-bold text-emerald-300">Tersimpan</span>}
      </div>
    </form>
  );
}
