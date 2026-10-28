import {
  ASSESSMENT_LABEL,
  ASSESSMENT_SHORT,
  attendanceRate,
  averageScore,
  overallReportLevel,
  REPORT_STATUS_LABEL,
  SCORE_LABEL,
  SKILL_LABEL,
  SKILLS,
  skillAverages,
  type AssessmentKind,
  type ReportStatus,
  type ReportSummary,
  type SkillLevels,
} from "@/lib/academic";
import type { Evidence } from "@/lib/assessment";
import { levelTitle } from "@/lib/placement/levels";
import { Badge, formatDateTime } from "../ui";
import { FileButton } from "./curriculum-forms";

// Tampilan bersama progres dan laporan untuk tutor, Academic Lead, siswa, dan wali.

const KIND_BAR: Record<AssessmentKind, string> = { baseline: "bg-slate-400", mid: "bg-orange-light", final: "bg-orange" };

const STATUS_TONE: Record<ReportStatus | "none" | "waiting", "slate" | "amber" | "orange" | "red" | "green"> = {
  waiting: "slate",
  none: "amber",
  draft: "amber",
  submitted: "orange",
  returned: "red",
  published: "green",
};

export function ReportStatusBadge({ state }: { state: ReportStatus | "none" | "waiting" }) {
  return <Badge tone={STATUS_TONE[state]}>{REPORT_STATUS_LABEL[state]}</Badge>;
}

const fmt = (n: number | null) => (n === null ? "-" : n.toFixed(1).replace(".", ","));

export function ProgressStats({ summary, levels }: { summary: ReportSummary; levels?: SkillLevels }) {
  const first = summary.kinds[0];
  const scored = summary.kinds.filter((k) => averageScore(summary.indicators, k) !== null);
  const last = scored[scored.length - 1];
  const rate = attendanceRate(summary.attendance);
  const overall = levels ? overallReportLevel(levels) : null;
  const cards = [
    { value: rate === null ? "-" : `${rate}%`, label: `Kehadiran (${summary.attendance.present + summary.attendance.late} dari ${summary.attendance.sessions} sesi)` },
    { value: `${summary.tasks.done}/${summary.tasks.total}`, label: "Tugas selesai" },
    {
      value: first && last && last !== first ? `${fmt(averageScore(summary.indicators, first))} → ${fmt(averageScore(summary.indicators, last))}` : fmt(first ? averageScore(summary.indicators, first) : null),
      label: last && last !== first ? `Rata-rata skor ${ASSESSMENT_SHORT[first].toLowerCase()} ke ${ASSESSMENT_SHORT[last].toLowerCase()}` : "Rata-rata skor awal (1–4)",
    },
    ...(overall ? [{ value: overall, label: "Level akhir keseluruhan" }] : []),
  ];
  return (
    <div className={`grid gap-3 sm:grid-cols-2 ${cards.length > 3 ? "lg:grid-cols-4" : "lg:grid-cols-3"}`}>
      {cards.map((c) => (
        <div key={c.label} className="lp-card-soft p-4">
          <p className="text-2xl font-black text-white">{c.value}</p>
          <p className="text-xs text-amber-200/80">{c.label}</p>
        </div>
      ))}
    </div>
  );
}

export function ScoreTable({ summary }: { summary: ReportSummary }) {
  const kinds = summary.kinds;
  const first = kinds[0];
  const scored = kinds.filter((k) => summary.indicators.some((i) => typeof i.scores[k] === "number"));
  const last = scored[scored.length - 1];
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[560px] text-sm">
        <thead>
          <tr className="border-b border-orange/30 text-left text-xs text-amber-200/80">
            <th className="py-2 pr-3 font-black">Indikator</th>
            {kinds.map((k) => (
              <th key={k} className="py-2 pr-3 text-center font-black">
                {ASSESSMENT_SHORT[k]}
              </th>
            ))}
            <th className="py-2 text-center font-black">Perubahan</th>
          </tr>
        </thead>
        <tbody>
          {summary.indicators.map((ind) => {
            const from = first ? ind.scores[first] : undefined;
            const to = last && last !== first ? ind.scores[last] : undefined;
            const d = from != null && to != null ? to - from : null;
            return (
              <tr key={ind.id} className="border-b border-orange/10">
                <td className="py-2.5 pr-3">
                  <p className="font-bold text-white">{ind.label}</p>
                  <p className="text-[11px] text-amber-200/70">{SKILL_LABEL[ind.skill]}</p>
                </td>
                {kinds.map((k) => (
                  <td key={k} className="py-2.5 pr-3 text-center font-black text-amber-50" title={ind.scores[k] ? SCORE_LABEL[ind.scores[k]!] : "Belum dinilai"}>
                    {ind.scores[k] ?? <span className="font-normal text-slate-500">-</span>}
                  </td>
                ))}
                <td className={`py-2.5 text-center font-black ${d === null ? "text-slate-500" : d > 0 ? "text-emerald-300" : d < 0 ? "text-rose-300" : "text-amber-100"}`}>
                  {d === null ? "-" : d > 0 ? `+${d}` : d}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <p className="mt-2 text-[11px] text-amber-200/70">Skala 1–4: {[1, 2, 3, 4].map((n) => `${n} ${SCORE_LABEL[n]}`).join(" · ")}</p>
    </div>
  );
}

export function ScoreBars({ summary }: { summary: ReportSummary }) {
  const kinds = summary.kinds.filter((k) => summary.indicators.some((i) => typeof i.scores[k] === "number"));
  if (!kinds.length) return null;
  return (
    <div className="space-y-3">
      {summary.indicators.map((ind) => (
        <div key={ind.id} className="grid gap-2 sm:grid-cols-[200px_1fr] sm:items-center">
          <p className="text-xs font-bold text-amber-100">{ind.label}</p>
          <div className="space-y-1">
            {kinds.map((k) => (
              <div key={k} className="h-2 rounded-full bg-navy-dark" aria-label={`${ind.label} ${ASSESSMENT_SHORT[k]}: ${ind.scores[k] ?? "belum dinilai"}`}>
                <div className={`h-2 rounded-full ${KIND_BAR[k]}`} style={{ width: `${((ind.scores[k] ?? 0) / 4) * 100}%` }} />
              </div>
            ))}
          </div>
        </div>
      ))}
      <div className="flex flex-wrap gap-4 pt-1 text-[11px] text-amber-200/80">
        {kinds.map((k) => (
          <span key={k} className="inline-flex items-center gap-1.5">
            <span className={`h-2.5 w-2.5 rounded-sm ${KIND_BAR[k]}`} /> Assessment {ASSESSMENT_SHORT[k].toLowerCase()}
          </span>
        ))}
      </div>
    </div>
  );
}

export function SkillChart({ summary }: { summary: ReportSummary }) {
  const { kinds, rows } = skillAverages(summary);
  if (!kinds.length) return null;
  return (
    <div className="space-y-3">
      {rows.map((r) => (
        <div key={r.skill} className="grid gap-2 sm:grid-cols-[110px_1fr] sm:items-center">
          <p className="text-xs font-black text-amber-100">{SKILL_LABEL[r.skill]}</p>
          <div className="space-y-1">
            {kinds.map((k) => {
              const v = r.values[k] ?? null;
              return (
                <div key={k} className="flex items-center gap-2" aria-label={`${SKILL_LABEL[r.skill]} assessment ${ASSESSMENT_SHORT[k].toLowerCase()}: ${v === null ? "belum dinilai" : fmt(v)}`}>
                  <div className="h-2.5 flex-1 rounded-full bg-navy-dark">
                    <div className={`h-2.5 rounded-full ${KIND_BAR[k]}`} style={{ width: `${((v ?? 0) / 4) * 100}%` }} />
                  </div>
                  <span className="w-8 text-right text-[11px] font-bold text-amber-100">{fmt(v)}</span>
                </div>
              );
            })}
          </div>
        </div>
      ))}
      <div className="flex flex-wrap gap-4 pt-1 text-[11px] text-amber-200/80">
        {kinds.map((k) => (
          <span key={k} className="inline-flex items-center gap-1.5">
            <span className={`h-2.5 w-2.5 rounded-sm ${KIND_BAR[k]}`} /> Assessment {ASSESSMENT_SHORT[k].toLowerCase()}
          </span>
        ))}
        <span>Skala 1–4</span>
      </div>
    </div>
  );
}

export function LevelChips({ levels }: { levels: SkillLevels }) {
  const skills = SKILLS.filter((k) => levels[k]);
  const overall = overallReportLevel(levels);
  if (!skills.length) return null;
  return (
    <div className="flex flex-wrap gap-2">
      {skills.map((k) => (
        <div key={k} className="min-w-20 rounded-xl border border-orange/40 px-3 py-2 text-center" title={levelTitle(levels[k])}>
          <p className="text-[11px] text-amber-200/80">{SKILL_LABEL[k]}</p>
          <p className="text-lg font-black text-white">{levels[k]}</p>
        </div>
      ))}
      {overall && (
        <div className="min-w-20 rounded-xl bg-orange px-3 py-2 text-center text-navy" title={levelTitle(overall)}>
          <p className="text-[11px] font-bold">Keseluruhan</p>
          <p className="text-lg font-black">{overall}</p>
        </div>
      )}
    </div>
  );
}

export function AssessmentNotes({ summary }: { summary: ReportSummary }) {
  const notes = summary.kinds.filter((k) => summary.notes[k]);
  if (!notes.length) return null;
  return (
    <ul className="space-y-2">
      {notes.map((k) => (
        <li key={k} className="rounded-xl border border-orange/20 p-3 text-sm">
          <p className="text-[11px] font-black uppercase tracking-wider text-amber-200/80">Catatan assessment {ASSESSMENT_LABEL[k].toLowerCase()}</p>
          <p className="mt-1 whitespace-pre-line text-amber-50">{summary.notes[k]}</p>
        </li>
      ))}
    </ul>
  );
}

function EvidenceCard({ label, evidence }: { label: string; evidence: NonNullable<Evidence> }) {
  const v = evidence.version;
  return (
    <div className="rounded-xl border border-orange/20 p-4">
      <p className="text-[11px] font-black uppercase tracking-wider text-amber-200/80">{label}</p>
      <p className="mt-1 font-bold text-white">{evidence.title}</p>
      <p className="text-xs text-amber-200/70">Dikumpulkan {formatDateTime(v.submitted_at)}</p>
      {v.text_answer && <p className="mt-2 line-clamp-6 whitespace-pre-line text-sm text-amber-50">{v.text_answer}</p>}
      {v.file_path && (
        <div className="mt-2">
          <FileButton kind="submission" id={v.id} label={v.mime?.startsWith("audio/") ? "Putar rekaman" : "Buka file"} />
        </div>
      )}
    </div>
  );
}

// Bukti awal (tugas sesi baseline) dibanding bukti terbaru (tugas sesi akhir, atau pengumpulan terakhir).
export function EvidenceCompare({ evidence }: { evidence: { baseline: Evidence; latest: Evidence } }) {
  const latest = evidence.latest && evidence.latest.version.id !== evidence.baseline?.version.id ? evidence.latest : null;
  if (!evidence.baseline && !latest) return <p className="text-sm text-slate-400">Bukti awal tampil setelah tugas sesi baseline dikumpulkan.</p>;
  return (
    <div className="grid gap-3 md:grid-cols-2">
      {evidence.baseline ? <EvidenceCard label="Bukti awal" evidence={evidence.baseline} /> : <p className="text-sm text-slate-400">Belum ada bukti awal.</p>}
      {latest ? <EvidenceCard label="Bukti terbaru" evidence={latest} /> : <p className="self-center text-sm text-slate-400">Bukti terbaru tampil setelah tugas berikutnya dikumpulkan.</p>}
    </div>
  );
}
