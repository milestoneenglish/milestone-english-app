"use client";

import { useRouter } from "next/navigation";
import { toast } from "@/components/toast";
import { useState, useTransition } from "react";
import { publishAssignmentAction, recordAttendanceAction, saveFeedbackAction } from "@/app/portal/learning-actions";
import type { SubmissionType } from "@/lib/curriculum";

type Status = "present" | "late" | "excused" | "absent";
const STATUSES: { value: Status; label: string; on: string }[] = [
  { value: "present", label: "Hadir", on: "border-emerald-400 bg-emerald-500/20 text-emerald-200" },
  { value: "late", label: "Terlambat", on: "border-amber-400 bg-amber-500/20 text-amber-100" },
  { value: "excused", label: "Izin", on: "border-sky-400 bg-sky-500/20 text-sky-100" },
  { value: "absent", label: "Tidak hadir", on: "border-rose-400 bg-rose-500/20 text-rose-200" },
];

const TYPE_OPTIONS: { value: SubmissionType; label: string }[] = [
  { value: "any", label: "Teks, rekaman, atau file" },
  { value: "text", label: "Teks" },
  { value: "audio", label: "Rekaman suara" },
  { value: "file", label: "File" },
];

function ErrorText({ error }: { error: string }) {
  return error ? (
    <p className="text-sm font-bold text-rose-300" role="alert">
      {error}
    </p>
  ) : null;
}

export function AttendanceForm({
  sessionId,
  roster,
  initial,
  note,
  done,
}: {
  sessionId: string;
  roster: { student_id: string; full_name: string }[];
  initial: { student_id: string; status: Status; note: string }[];
  note: string;
  done: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [rows, setRows] = useState(() =>
    roster.map((r) => {
      const a = initial.find((x) => x.student_id === r.student_id);
      return { studentId: r.student_id, name: r.full_name, status: (a?.status ?? "present") as Status, note: a?.note ?? "" };
    }),
  );
  const [sessionNote, setSessionNote] = useState(note);
  const update = (i: number, patch: Partial<(typeof rows)[number]>) => {
    setSaved(false);
    setRows((x) => x.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  };

  const save = () =>
    start(async () => {
      setError("");
      const res = await recordAttendanceAction(
        sessionId,
        rows.map((r) => ({ studentId: r.studentId, status: r.status, note: r.note })),
        sessionNote,
      );
      if (!res.ok) { toast.error(res.error); return setError(res.error); }
      toast.success("Absensi tersimpan");
      setSaved(true);
      router.refresh();
    });

  return (
    <div className="space-y-4">
      <ul className="divide-y divide-orange/10">
        {rows.map((r, i) => (
          <li key={r.studentId} className="space-y-2 py-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <span className="font-bold text-white">{r.name}</span>
              <span className="flex flex-wrap gap-1.5" role="radiogroup" aria-label={`Kehadiran ${r.name}`}>
                {STATUSES.map((s) => (
                  <button
                    key={s.value}
                    type="button"
                    role="radio"
                    aria-checked={r.status === s.value}
                    onClick={() => update(i, { status: s.value })}
                    className={`rounded-full border px-3 py-1 text-[11px] font-black ${r.status === s.value ? s.on : "border-orange/25 text-amber-100/80"}`}
                  >
                    {s.label}
                  </button>
                ))}
              </span>
            </div>
            {(r.status === "excused" || r.status === "absent" || r.note) && (
              <input value={r.note} onChange={(e) => update(i, { note: e.target.value })} maxLength={300} placeholder="Catatan (opsional), misalnya alasan izin" className="field py-2! text-sm" aria-label={`Catatan ${r.name}`} />
            )}
          </li>
        ))}
      </ul>
      <label className="block">
        <span className="mb-2 block text-xs font-bold text-amber-100">Catatan sesi (untuk tutor dan Academic Lead)</span>
        <textarea value={sessionNote} onChange={(e) => (setSaved(false), setSessionNote(e.target.value))} rows={2} maxLength={2000} placeholder="Materi yang dibahas, hal yang perlu diulang di sesi berikutnya" className="field" />
      </label>
      <p className="text-xs text-amber-200/70">Wali mendapat pemberitahuan bila anaknya tercatat tidak hadir.</p>
      <ErrorText error={error} />
      <div className="flex items-center gap-3">
        <button disabled={pending} onClick={save} className="btn-orange rounded-full px-6 py-2.5 text-sm">
          {pending ? "Menyimpan..." : done ? "Perbarui absensi" : "Simpan absensi"}
        </button>
        {saved && <span className="text-sm font-bold text-emerald-300">Tersimpan</span>}
      </div>
    </div>
  );
}

// Nilai input datetime-local dalam WIB dari ISO, dan sebaliknya.
const toWib = (iso: string) => new Date(Date.parse(iso) + 7 * 3600 * 1000).toISOString().slice(0, 16);
const fromWib = (local: string) => `${local}:00+07:00`;

export function PublishTaskForm({
  sessionId,
  task,
  defaultDue,
}: {
  sessionId: string;
  task: { id: string; title: string; instructions: string; submission_type: SubmissionType } | null;
  defaultDue: string;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState("");
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ title: task?.title ?? "", instructions: task?.instructions ?? "", type: task?.submission_type ?? ("any" as SubmissionType), due: toWib(defaultDue) });

  const publish = () =>
    start(async () => {
      setError("");
      const res = await publishAssignmentAction({ sessionId, taskId: task?.id ?? null, title: f.title, instructions: f.instructions, type: f.type, dueAt: fromWib(f.due) });
      if (!res.ok) { toast.error(res.error); return setError(res.error); }
      toast.success("Tugas diterbitkan");
      setOpen(false);
      router.refresh();
    });

  if (!open) {
    return (
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-orange/20 p-4">
        <div className="min-w-0">
          <p className="font-bold text-white">{task ? task.title : "Tugas di luar template"}</p>
          {task && <p className="line-clamp-2 text-xs text-amber-200/80">{task.instructions}</p>}
        </div>
        <button onClick={() => setOpen(true)} className={task ? "btn-orange rounded-full px-4 py-2 text-xs" : "rounded-full border border-orange/40 px-4 py-2 text-xs font-black text-orange hover:bg-orange/10"}>
          {task ? "Terbitkan tugas ini" : "+ Buat tugas lain"}
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-3 rounded-xl border border-orange/40 bg-navy-dark/60 p-4">
      <div className="grid gap-3 sm:grid-cols-[2fr_1fr]">
        <input value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} maxLength={160} placeholder="Judul tugas" className="field py-2!" aria-label="Judul tugas" />
        <select value={f.type} onChange={(e) => setF({ ...f, type: e.target.value as SubmissionType })} className="field py-2!" aria-label="Jenis pengumpulan">
          {TYPE_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </div>
      <textarea value={f.instructions} onChange={(e) => setF({ ...f, instructions: e.target.value })} rows={3} maxLength={4000} placeholder="Instruksi untuk siswa" className="field" aria-label="Instruksi tugas" />
      <label className="block max-w-xs">
        <span className="mb-2 block text-xs font-bold text-amber-100">Tenggat (WIB)</span>
        <input type="datetime-local" value={f.due} onChange={(e) => setF({ ...f, due: e.target.value })} className="field py-2!" />
        <span className="mt-1.5 block text-xs text-amber-200/70">Default: sebelum sesi berikutnya. Siswa mendapat pengingat H-1.</span>
      </label>
      <ErrorText error={error} />
      <div className="flex gap-2">
        <button disabled={pending} onClick={publish} className="btn-orange rounded-full px-5 py-2 text-xs">
          {pending ? "Menerbitkan..." : "Terbitkan ke siswa"}
        </button>
        <button disabled={pending} onClick={() => setOpen(false)} className="rounded-full border border-orange/40 px-4 py-2 text-xs font-bold text-amber-100">
          Batal
        </button>
      </div>
    </div>
  );
}

export function FeedbackForm({ submissionId, draft, canRevise }: { submissionId: string; draft: { body: string; decision: "accepted" | "revision" } | null; canRevise: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [body, setBody] = useState(draft?.body ?? "");
  const [decision, setDecision] = useState<"accepted" | "revision">(draft?.decision ?? "accepted");

  const save = (publish: boolean) =>
    start(async () => {
      setError("");
      setSaved(false);
      const res = await saveFeedbackAction(submissionId, body, decision, publish);
      if (!res.ok) { toast.error(res.error); return setError(res.error); }
      toast.success(publish ? "Feedback diterbitkan" : "Draf feedback tersimpan");
      if (!publish) setSaved(true);
      router.refresh();
    });

  return (
    <div className="space-y-3 rounded-xl border border-orange/30 p-4">
      <textarea value={body} onChange={(e) => (setSaved(false), setBody(e.target.value))} rows={4} maxLength={5000} placeholder="Tulis feedback: apa yang sudah baik, apa yang perlu diperbaiki, dan contoh perbaikannya." className="field" aria-label="Feedback" />
      <div className="flex flex-wrap gap-4 text-sm text-amber-100">
        <label className="flex items-center gap-2">
          <input type="radio" checked={decision === "accepted"} onChange={() => setDecision("accepted")} className="accent-orange" /> Terima, tugas selesai
        </label>
        <label className={`flex items-center gap-2 ${canRevise ? "" : "opacity-50"}`}>
          <input type="radio" disabled={!canRevise} checked={decision === "revision"} onChange={() => setDecision("revision")} className="accent-orange" /> Minta revisi
          {!canRevise && <span className="text-xs">(batas 2 revisi tercapai)</span>}
        </label>
      </div>
      <ErrorText error={error} />
      <div className="flex flex-wrap items-center gap-2">
        <button disabled={pending} onClick={() => save(true)} className="btn-orange rounded-full px-5 py-2 text-xs">
          {pending ? "Menyimpan..." : "Terbitkan feedback"}
        </button>
        <button disabled={pending} onClick={() => save(false)} className="rounded-full border border-orange/40 px-4 py-2 text-xs font-black text-orange hover:bg-orange/10">
          Simpan draf
        </button>
        {saved && <span className="text-sm font-bold text-emerald-300">Draf tersimpan, belum terlihat siswa</span>}
      </div>
    </div>
  );
}
