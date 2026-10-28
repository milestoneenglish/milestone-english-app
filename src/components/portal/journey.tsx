import Link from "next/link";
import { startStudentTest } from "@/app/placement/actions";
import { Icon } from "@/components/icons";
import { formatRupiah } from "@/lib/content";
import { LevelGuide } from "@/components/level-guide";
import { levelTitle, LEVELS, SECTION_LABEL, SECTIONS, SPEAKING_CRITERIA, WRITING_CRITERIA, type Level } from "@/lib/placement/levels";
import type { AttemptRow } from "@/lib/placement/server";
import { formatDateTime } from "./ui";

export const JOURNEY = ["Daftar", "Placement", "Pilih kelas & bayar", "Onboarding", "Belajar", "Laporan & lanjut"] as const;

// Tahap saat ini (0-based): placement, lalu kelas dan pembayaran, onboarding, belajar, laporan.
export function journeyStage(attempt: AttemptRow | null, enrollment?: { status: string; onboarded_at: string | null } | null) {
  if (enrollment?.status === "completed") return 5;
  if (enrollment?.status === "active") return enrollment.onboarded_at ? 4 : 3;
  if (enrollment) return 2;
  if (!attempt || attempt.status !== "published") return 1;
  return 2;
}

export function JourneyStepper({ stage }: { stage: number }) {
  return (
    <ol className="grid grid-cols-3 gap-2 sm:grid-cols-6" aria-label="Perjalanan belajar">
      {JOURNEY.map((label, i) => {
        const state = i < stage ? "done" : i === stage ? "current" : "next";
        return (
          <li key={label} aria-current={state === "current" ? "step" : undefined} className="flex flex-col items-center gap-2 text-center">
            <span
              className={`flex h-9 w-9 items-center justify-center rounded-full border-2 text-sm font-black ${
                state === "done" ? "border-orange bg-orange text-navy" : state === "current" ? "border-orange text-orange" : "border-slate-600 text-slate-500"
              }`}
            >
              {state === "done" ? <Icon name="check" className="h-4 w-4" /> : i + 1}
            </span>
            <span className={`text-[11px] font-bold leading-tight ${state === "next" ? "text-slate-500" : "text-amber-100"}`}>{label}</span>
          </li>
        );
      })}
    </ol>
  );
}

export type ProgramLite = { id: string; slug: string; name: string; category: string; duration_label: string; price_idr: number };

const levelTone = (l?: Level) => (l ? ["text-slate-300", "text-amber-200", "text-orange-light", "text-orange", "text-emerald-300"][LEVELS.indexOf(l)] : "text-slate-500");

export function PlacementResult({ attempt, programs }: { attempt: AttemptRow; programs: ProgramLite[] }) {
  const recommended = attempt.recommended_program_ids.map((id) => programs.find((p) => p.id === id)).filter(Boolean) as ProgramLite[];
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-4">
        <div className="rounded-2xl bg-orange px-5 py-3 text-navy" title={levelTitle(attempt.levels.overall)}>
          <p className="text-[11px] font-black uppercase tracking-[0.18em]">Level keseluruhan</p>
          <p className="text-3xl font-black">{attempt.levels.overall ?? "-"}</p>
        </div>
        <p className="text-xs text-slate-400">Diterbitkan {formatDateTime(attempt.published_at)}</p>
      </div>
      <ul className="grid grid-cols-2 gap-2 sm:grid-cols-5">
        {SECTIONS.map((s) => (
          <li key={s} className="lp-card-soft px-3 py-3 text-center" title={levelTitle(attempt.levels[s])}>
            <p className="text-[11px] font-bold text-amber-200/80">{SECTION_LABEL[s]}</p>
            <p className={`mt-1 text-lg font-black ${levelTone(attempt.levels[s])}`}>{attempt.levels[s] ?? "—"}</p>
            {attempt.auto_scores[s] && (
              <p className="text-[11px] text-slate-400">
                {attempt.auto_scores[s].correct}/{attempt.auto_scores[s].total} benar
              </p>
            )}
          </li>
        ))}
      </ul>
      <LevelGuide current={attempt.levels.overall} />
      {(attempt.review_comment || attempt.lead_note) && (
        <div className="space-y-2 text-sm">
          {attempt.review_comment && (
            <p className="lp-card-soft p-4 text-amber-100">
              <span className="font-black text-orange">Catatan tutor: </span>
              {attempt.review_comment}
            </p>
          )}
          {attempt.lead_note && (
            <p className="lp-card-soft p-4 text-amber-100">
              <span className="font-black text-orange">Catatan Academic Lead: </span>
              {attempt.lead_note}
            </p>
          )}
        </div>
      )}
      {recommended.length > 0 && (
        <div>
          <p className="mb-2 text-xs font-black uppercase tracking-[0.18em] text-amber-200/80">Program yang direkomendasikan</p>
          <div className="grid gap-3 sm:grid-cols-2">
            {recommended.map((p) => (
              <div key={p.id} className="rounded-xl border border-orange/40 bg-orange/10 p-4">
                <p className="text-xs font-bold text-amber-200/80">{p.category}</p>
                <p className="text-lg font-black text-orange">{p.name}</p>
                <p className="mt-1 text-xs text-amber-100">
                  {p.duration_label} · {formatRupiah(p.price_idr)}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export function RubricSummary({ attempt }: { attempt: AttemptRow }) {
  const rows = [
    ...WRITING_CRITERIA.map((c) => ({ group: "Writing", label: c.label, value: attempt.writing_rubric?.[c.key] })),
    ...SPEAKING_CRITERIA.map((c) => ({ group: "Speaking", label: c.label, value: attempt.speaking_rubric?.[c.key] })),
  ].filter((r) => r.value);
  if (!rows.length) return null;
  return (
    <table className="w-full text-sm">
      <tbody>
        {rows.map((r) => (
          <tr key={r.group + r.label} className="border-b border-orange/10">
            <td className="py-2 pr-3 text-xs font-bold text-amber-200/80">{r.group}</td>
            <td className="py-2 pr-3 text-amber-100">{r.label}</td>
            <td className="py-2 text-right font-black text-orange">{r.value}/4</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

// Kartu langkah berikutnya untuk satu siswa, sesuai status placement-nya.
export function NextStepCard({
  attempt,
  studentId,
  returnTo,
  who,
  classStep,
}: {
  attempt: AttemptRow | null;
  studentId: string;
  returnTo: string;
  who?: string;
  classStep?: React.ReactNode;
}) {
  if (classStep && (!attempt || attempt.status === "published")) return <>{classStep}</>;
  const subject = who ? `${who} ` : "";
  if (!attempt) {
    return (
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-[11px] font-black uppercase tracking-[0.2em] text-amber-200/80">Langkah berikutnya</p>
          <p className="mt-1 text-lg font-black text-white">Kerjakan placement test{who ? ` untuk ${who}` : ""}</p>
          <p className="text-sm text-slate-400">Sekitar 25–30 menit. Hasilnya menentukan kelas yang paling cocok.</p>
        </div>
        <form action={startStudentTest.bind(null, studentId, returnTo)}>
          <button className="btn-orange flex items-center gap-2 rounded-full px-6 py-3 text-sm">
            Mulai placement <Icon name="arrow" className="h-4 w-4" />
          </button>
        </form>
      </div>
    );
  }
  if (attempt.status === "in_progress") {
    return (
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-[11px] font-black uppercase tracking-[0.2em] text-amber-200/80">Langkah berikutnya</p>
          <p className="mt-1 text-lg font-black text-white">{attempt.retest_of ? "Tes ulang placement sudah disetujui" : "Lanjutkan placement test"}</p>
          <p className="text-sm text-slate-400">Jawaban yang sudah diisi tersimpan.</p>
        </div>
        <Link href={`/placement/tes/${attempt.id}`} className="btn-orange flex items-center gap-2 rounded-full px-6 py-3 text-sm">
          {attempt.retest_of ? "Mulai tes ulang" : "Lanjutkan"} <Icon name="arrow" className="h-4 w-4" />
        </Link>
      </div>
    );
  }
  if (attempt.status !== "published") {
    const due = attempt.submitted_at ? new Date(Date.parse(attempt.submitted_at) + 24 * 3600 * 1000).toISOString() : null;
    return (
      <div>
        <p className="text-[11px] font-black uppercase tracking-[0.2em] text-amber-200/80">Sedang diproses</p>
        <p className="mt-1 text-lg font-black text-white">Placement {subject}sedang dinilai tutor</p>
        <p className="text-sm text-slate-400">Hasil lengkap terbit paling lambat {formatDateTime(due)}. Kamu akan melihatnya di sini.</p>
      </div>
    );
  }
  return (
    <div>
      <p className="text-[11px] font-black uppercase tracking-[0.2em] text-amber-200/80">Langkah berikutnya</p>
      <p className="mt-1 text-lg font-black text-white">Pilih jadwal kelas dan lakukan pembayaran</p>
      <p className="text-sm text-slate-400">Hasil placement sudah terbit. Pemilihan jadwal kelas segera tersedia di portal ini.</p>
    </div>
  );
}
