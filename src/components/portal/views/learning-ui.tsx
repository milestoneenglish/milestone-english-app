import type { ModuleRow } from "@/lib/curriculum";
import { ATTENDANCE_LABEL, type AttendanceStatus, type SubmissionRow, type TaskState } from "@/lib/learning";
import { Badge, formatDateTime } from "../ui";
import { FileButton } from "./curriculum-forms";

// Tampilan bersama untuk tutor, siswa, dan wali: isi modul, status kehadiran dan tugas, serta riwayat pengumpulan.

const ATTENDANCE_TONE: Record<AttendanceStatus, "green" | "amber" | "slate" | "red"> = { present: "green", late: "amber", excused: "slate", absent: "red" };

export function AttendanceBadge({ status }: { status: AttendanceStatus | null }) {
  return status ? <Badge tone={ATTENDANCE_TONE[status]}>{ATTENDANCE_LABEL[status]}</Badge> : <Badge>Belum diisi</Badge>;
}

const TASK_STATE: Record<TaskState, { label: string; tone: "orange" | "green" | "amber" | "slate" | "red" }> = {
  todo: { label: "Belum dikumpulkan", tone: "amber" },
  waiting: { label: "Menunggu feedback", tone: "orange" },
  revision: { label: "Perlu revisi", tone: "red" },
  done: { label: "Selesai", tone: "green" },
};

export function TaskStateBadge({ state }: { state: TaskState }) {
  return <Badge tone={TASK_STATE[state].tone}>{TASK_STATE[state].label}</Badge>;
}

export function ModuleContent({ module }: { module: ModuleRow }) {
  return (
    <div className="space-y-4">
      {module.objectives && (
        <div>
          <p className="text-[11px] font-black uppercase tracking-[0.18em] text-amber-200/80">Tujuan</p>
          <p className="mt-1 text-sm text-amber-50">{module.objectives}</p>
        </div>
      )}
      {module.content && <div className="whitespace-pre-line rounded-xl border border-orange/20 bg-navy p-4 text-sm leading-relaxed text-amber-50">{module.content}</div>}
      {module.materials.length > 0 && (
        <ul className="space-y-2">
          {module.materials.map((m) => (
            <li key={m.id} className="lp-card-soft flex flex-wrap items-center justify-between gap-2 px-4 py-2 text-sm">
              <span>
                <span className="mr-2 text-[11px] font-black uppercase text-amber-200/70">{m.kind === "link" ? "Link" : m.kind === "audio" ? "Audio" : "File"}</span>
                <span className="font-bold text-white">{m.title}</span>
              </span>
              {m.kind === "link" ? (
                <a href={m.url!} target="_blank" rel="noopener noreferrer" className="rounded-full border border-orange/40 px-3 py-1 text-[11px] font-black text-orange hover:bg-orange/10">
                  Buka
                </a>
              ) : (
                <FileButton kind="material" id={m.id} label={m.kind === "audio" ? "Putar / unduh" : "Buka"} />
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// Riwayat versi pengumpulan, terbaru di atas, dengan feedback yang sudah terbit (atau draf untuk tutor).
export function SubmissionHistory({ versions, showDrafts = false }: { versions: SubmissionRow[]; showDrafts?: boolean }) {
  if (!versions.length) return null;
  return (
    <ol className="space-y-3">
      {[...versions].reverse().map((v) => (
        <li key={v.id} className="rounded-xl border border-orange/20 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
            <span className="font-black text-amber-200/80">
              {v.version === 1 ? "Pengumpulan pertama" : `Revisi ${v.version - 1}`} · {formatDateTime(v.submitted_at)}
            </span>
            {v.is_late && <Badge tone="amber">Terlambat</Badge>}
          </div>
          {v.text_answer && <p className="mt-2 whitespace-pre-line text-sm text-amber-50">{v.text_answer}</p>}
          {v.file_path && (
            <div className="mt-2">
              <FileButton kind="submission" id={v.id} label={v.mime?.startsWith("audio/") ? "Putar rekaman" : "Buka file"} />
            </div>
          )}
          {v.feedback && (showDrafts || v.feedback.status === "published") && (
            <div className={`mt-3 rounded-lg border px-3 py-2 text-sm ${v.feedback.decision === "revision" ? "border-rose-400/40 bg-rose-500/10" : "border-emerald-400/40 bg-emerald-500/10"}`}>
              <p className="text-[11px] font-black uppercase tracking-wider text-amber-100">
                {v.feedback.status === "draft" ? "Draf feedback (belum terlihat siswa)" : v.feedback.decision === "revision" ? "Feedback tutor · minta revisi" : "Feedback tutor · diterima"}
              </p>
              <p className="mt-1 whitespace-pre-line text-amber-50">{v.feedback.body}</p>
            </div>
          )}
        </li>
      ))}
    </ol>
  );
}
