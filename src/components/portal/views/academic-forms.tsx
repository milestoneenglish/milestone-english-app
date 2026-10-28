"use client";

import { useState } from "react";
import {
  addIndicatorAction,
  deleteIndicatorAction,
  reviewReportAction,
  saveAssessmentAction,
  saveReportAction,
  setModuleAssessmentAction,
  updateIndicatorAction,
} from "@/app/portal/learning-actions";
import {
  ASSESSMENT_LABEL,
  REPORT_LEVELS,
  SCORE_LABEL,
  SKILL_LABEL,
  SKILLS,
  type AssessmentKind,
  type Indicator,
  type ReportLevel,
  type Skill,
  type SkillLevels,
} from "@/lib/academic";
import { danger, ErrorText, Field, ghost, useAction } from "./curriculum-forms";

// ---------------------------------------------------------------------------
// Academic Lead: rubrik dan titik assessment
// ---------------------------------------------------------------------------

export function AssessmentPointSelect({ moduleId, value }: { moduleId: string; value: AssessmentKind | null }) {
  const { pending, error, act } = useAction();
  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      <select
        aria-label="Titik assessment"
        disabled={pending}
        value={value ?? ""}
        onChange={(e) => act(() => setModuleAssessmentAction(moduleId, (e.target.value || null) as AssessmentKind | null))}
        className="field w-auto py-1.5! text-xs"
      >
        <option value="">Bukan sesi assessment</option>
        {(["baseline", "mid", "final"] as const).map((k) => (
          <option key={k} value={k}>
            Assessment {ASSESSMENT_LABEL[k].toLowerCase()}
          </option>
        ))}
      </select>
      <ErrorText error={error} />
    </span>
  );
}

function IndicatorEditor({ indicator, draft }: { indicator: Indicator; draft: boolean }) {
  const { pending, error, act } = useAction();
  const [label, setLabel] = useState(indicator.label);
  const [levels, setLevels] = useState<string[]>([0, 1, 2, 3].map((i) => indicator.descriptors[i] ?? ""));
  const [saved, setSaved] = useState(false);
  return (
    <details className="rounded-xl border border-orange/20 open:border-orange/50">
      <summary className="flex cursor-pointer list-none flex-wrap items-center justify-between gap-2 px-4 py-3">
        <span>
          <span className="mr-2 text-xs font-black text-amber-200/80">{indicator.seq}.</span>
          <span className="font-bold text-white">{indicator.label}</span>
          <span className="ml-2 text-[11px] font-bold text-amber-200/70">{SKILL_LABEL[indicator.skill]}</span>
        </span>
        <span className="text-xs text-orange">Ubah ▾</span>
      </summary>
      <div className="space-y-3 border-t border-orange/15 px-4 py-4">
        <Field label="Nama indikator">
          <input value={label} onChange={(e) => (setSaved(false), setLabel(e.target.value))} maxLength={120} className="field py-2!" />
        </Field>
        <div className="grid gap-3 sm:grid-cols-2">
          {levels.map((text, i) => (
            <Field key={i} label={`Skor ${i + 1} · ${SCORE_LABEL[i + 1]}`}>
              <textarea
                value={text}
                rows={2}
                maxLength={300}
                onChange={(e) => {
                  setSaved(false);
                  setLevels((l) => l.map((x, j) => (j === i ? e.target.value : x)));
                }}
                className="field text-sm"
              />
            </Field>
          ))}
        </div>
        <ErrorText error={error} />
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" disabled={pending} onClick={() => act(() => updateIndicatorAction(indicator.id, { label, descriptors: levels }).then((r) => (r.ok && setSaved(true), r)))} className={ghost}>
            {pending ? "Menyimpan..." : "Simpan indikator"}
          </button>
          {draft && (
            <button type="button" disabled={pending} onClick={() => act(() => deleteIndicatorAction(indicator.id), undefined, "Dihapus")} className={danger}>
              Hapus indikator
            </button>
          )}
          {saved && <span className="text-sm font-bold text-emerald-300">Tersimpan</span>}
        </div>
      </div>
    </details>
  );
}

export function RubricEditor({ curriculumId, indicators, draft }: { curriculumId: string; indicators: Indicator[]; draft: boolean }) {
  const { pending, error, act } = useAction();
  const [skill, setSkill] = useState<Skill>("speaking");
  const [label, setLabel] = useState("");
  return (
    <div className="space-y-3">
      {indicators.length === 0 && <p className="text-sm text-slate-400">Belum ada indikator. Tambahkan 4–6 indikator sesuai fokus program.</p>}
      {indicators.map((ind) => (
        <IndicatorEditor key={`${ind.id}-${ind.seq}`} indicator={ind} draft={draft} />
      ))}
      {draft && indicators.length < 8 && (
        <form
          className="flex flex-wrap items-center gap-2 rounded-xl border border-dashed border-orange/30 p-3"
          onSubmit={(e) => {
            e.preventDefault();
            act(() => addIndicatorAction(curriculumId, skill, label).then((r) => (r.ok && setLabel(""), r)));
          }}
        >
          <select value={skill} onChange={(e) => setSkill(e.target.value as Skill)} className="field w-auto py-2!" aria-label="Keterampilan indikator">
            {SKILLS.map((k) => (
              <option key={k} value={k}>
                {SKILL_LABEL[k]}
              </option>
            ))}
          </select>
          <input value={label} onChange={(e) => setLabel(e.target.value)} maxLength={120} placeholder="Nama indikator baru" className="field max-w-sm py-2!" aria-label="Nama indikator baru" />
          <button disabled={pending || label.trim().length < 2} className={ghost}>
            {pending ? "Menambah..." : "+ Tambah indikator"}
          </button>
        </form>
      )}
      <ErrorText error={error} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tutor: lembar assessment satu siswa
// ---------------------------------------------------------------------------

export function AssessmentForm({
  batchId,
  studentId,
  studentName,
  kind,
  indicators,
  initial,
  published,
  locked,
}: {
  batchId: string;
  studentId: string;
  studentName: string;
  kind: AssessmentKind;
  indicators: Indicator[];
  initial: { scores: Record<string, number>; note: string } | null;
  published: boolean;
  locked: boolean;
}) {
  const { pending, error, act } = useAction();
  const [scores, setScores] = useState<Record<string, number>>(initial?.scores ?? {});
  const [note, setNote] = useState(initial?.note ?? "");
  const [saved, setSaved] = useState("");
  const complete = indicators.every((i) => scores[i.id]);
  const save = (publish: boolean) =>
    act(() =>
      saveAssessmentAction({ batchId, studentId, kind, scores, note, publish }).then((r) => {
        if (r.ok) setSaved(publish || published ? "Nilai terbit dan tampil di progres siswa" : "Draf tersimpan");
        return r;
      }),
    );
  return (
    <div className="space-y-4">
      {indicators.map((ind) => (
        <fieldset key={ind.id} disabled={locked || pending} className="rounded-xl border border-orange/15 p-3">
          <legend className="px-1 text-sm font-bold text-white">
            {ind.label} <span className="text-[11px] font-bold text-amber-200/70">· {SKILL_LABEL[ind.skill]}</span>
          </legend>
          <div role="radiogroup" aria-label={`${ind.label} ${studentName}`} className="grid gap-2 sm:grid-cols-4">
            {[1, 2, 3, 4].map((n) => {
              const active = scores[ind.id] === n;
              return (
                <button
                  key={n}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  onClick={() => {
                    setSaved("");
                    setScores((s) => ({ ...s, [ind.id]: n }));
                  }}
                  className={`rounded-lg border px-3 py-2 text-left text-xs transition ${active ? "border-orange bg-orange/20 text-white" : "border-orange/20 text-amber-100 hover:border-orange/60"}`}
                >
                  <span className="block font-black">
                    {n} · {SCORE_LABEL[n]}
                  </span>
                  {ind.descriptors[n - 1] && <span className="mt-0.5 block text-[11px] leading-snug text-amber-200/80">{ind.descriptors[n - 1]}</span>}
                </button>
              );
            })}
          </div>
        </fieldset>
      ))}
      <Field label="Catatan (tampil di progres siswa setelah terbit)">
        <textarea value={note} onChange={(e) => (setSaved(""), setNote(e.target.value))} rows={2} maxLength={2000} disabled={locked} aria-label={`Catatan assessment ${studentName}`} className="field" />
      </Field>
      <ErrorText error={error} />
      {locked ? (
        <p className="text-sm text-amber-200/80">Laporan akhir sudah diajukan; nilai ini terkunci.</p>
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          {!published && (
            <button type="button" disabled={pending} onClick={() => save(false)} className={ghost}>
              Simpan draf
            </button>
          )}
          <button type="button" disabled={pending || !complete} onClick={() => save(true)} className="btn-orange rounded-full px-5 py-2 text-xs">
            {pending ? "Menyimpan..." : published ? "Simpan perubahan nilai" : "Terbitkan nilai"}
          </button>
          {!complete && <span className="text-xs text-amber-200/70">Isi semua indikator untuk menerbitkan.</span>}
          {saved && <span className="text-sm font-bold text-emerald-300">{saved}</span>}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tutor: menyusun laporan; Academic Lead: meninjau
// ---------------------------------------------------------------------------

function LevelSelects({ skills, levels, onChange, label }: { skills: Skill[]; levels: SkillLevels; onChange: (l: SkillLevels) => void; label: string }) {
  return (
    <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-5">
      {skills.map((k) => (
        <Field key={k} label={SKILL_LABEL[k]}>
          <select value={levels[k] ?? ""} onChange={(e) => onChange({ ...levels, [k]: (e.target.value || undefined) as ReportLevel | undefined })} className="field py-2!" aria-label={`${label} ${SKILL_LABEL[k]}`}>
            <option value="">Pilih level</option>
            {REPORT_LEVELS.map((l) => (
              <option key={l} value={l}>
                {l}
              </option>
            ))}
          </select>
        </Field>
      ))}
    </div>
  );
}

export function ReportForm({
  enrollmentId,
  skills,
  programs,
  initial,
  returned,
}: {
  enrollmentId: string;
  skills: Skill[];
  programs: { id: string; name: string; category: string; entry_level: string }[];
  initial: { strengths: string; improvements: string; levels: SkillLevels; programIds: string[] };
  returned: boolean;
}) {
  const { pending, error, act } = useAction();
  const [f, setF] = useState(initial);
  const [saved, setSaved] = useState("");
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => {
    setSaved("");
    setF((x) => ({ ...x, [k]: v }));
  };
  const toggle = (id: string) => set("programIds", f.programIds.includes(id) ? f.programIds.filter((x) => x !== id) : f.programIds.length < 3 ? [...f.programIds, id] : f.programIds);
  const save = (submit: boolean) =>
    act(() =>
      saveReportAction(enrollmentId, { ...f, submit }).then((r) => {
        if (r.ok) setSaved(submit ? "Laporan diajukan ke Academic Lead" : "Draf tersimpan");
        return r;
      }),
    );
  return (
    <div className="space-y-5">
      <Field label="Kekuatan siswa" hint="Apa yang sudah bisa dilakukan di akhir program, dengan contoh konkret.">
        <textarea value={f.strengths} onChange={(e) => set("strengths", e.target.value)} rows={4} maxLength={3000} className="field" />
      </Field>
      <Field label="Yang perlu ditingkatkan" hint="Fokus latihan berikutnya dan cara melatihnya.">
        <textarea value={f.improvements} onChange={(e) => set("improvements", e.target.value)} rows={4} maxLength={3000} className="field" />
      </Field>
      <div>
        <p className="mb-2 text-xs font-bold text-amber-100">Level akhir per keterampilan (usulan tutor, dikonfirmasi Academic Lead)</p>
        <LevelSelects skills={skills} levels={f.levels} onChange={(l) => set("levels", l)} label="Level akhir" />
      </div>
      <div>
        <p className="mb-2 text-xs font-bold text-amber-100">Rekomendasi program berikutnya (maksimal 3)</p>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {programs.map((p) => {
            const on = f.programIds.includes(p.id);
            return (
              <label key={p.id} className={`flex cursor-pointer items-start gap-2 rounded-xl border p-3 text-sm ${on ? "border-orange bg-orange/10" : "border-orange/20"}`}>
                <input type="checkbox" checked={on} onChange={() => toggle(p.id)} className="mt-1 accent-orange" />
                <span>
                  <span className="block font-bold text-white">{p.name}</span>
                  <span className="block text-[11px] text-amber-200/70">
                    {p.category} · {p.entry_level}
                  </span>
                </span>
              </label>
            );
          })}
        </div>
      </div>
      <ErrorText error={error} />
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" disabled={pending} onClick={() => save(false)} className={ghost}>
          Simpan draf
        </button>
        <button type="button" disabled={pending} onClick={() => save(true)} className="btn-orange rounded-full px-5 py-2.5 text-sm">
          {pending ? "Menyimpan..." : returned ? "Ajukan ulang ke Academic Lead" : "Ajukan ke Academic Lead"}
        </button>
        {saved && <span className="text-sm font-bold text-emerald-300">{saved}</span>}
      </div>
    </div>
  );
}

export function ReviewForm({ reportId, skills, levels }: { reportId: string; skills: Skill[]; levels: SkillLevels }) {
  const { pending, error, act } = useAction();
  const [l, setL] = useState<SkillLevels>(levels);
  const [comment, setComment] = useState("");
  return (
    <div className="space-y-4">
      <div>
        <p className="mb-2 text-xs font-bold text-amber-100">Konfirmasi level akhir (dipakai untuk program berikutnya)</p>
        <LevelSelects skills={skills} levels={l} onChange={setL} label="Konfirmasi level" />
      </div>
      <Field label="Catatan untuk tutor" hint="Wajib diisi bila laporan dikembalikan. Tidak tampil di laporan siswa.">
        <textarea value={comment} onChange={(e) => setComment(e.target.value)} rows={3} maxLength={2000} className="field" />
      </Field>
      <ErrorText error={error} />
      <div className="flex flex-wrap gap-2">
        <button type="button" disabled={pending} onClick={() => act(() => reviewReportAction(reportId, true, comment, l), undefined, "Laporan diterbitkan")} className="btn-orange rounded-full px-5 py-2.5 text-sm">
          {pending ? "Memproses..." : "Terbitkan laporan & PDF"}
        </button>
        <button type="button" disabled={pending} onClick={() => act(() => reviewReportAction(reportId, false, comment, null), undefined, "Laporan dikembalikan ke tutor")} className={danger}>
          Kembalikan ke tutor
        </button>
      </div>
    </div>
  );
}
