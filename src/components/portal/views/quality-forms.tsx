"use client";

import { useState } from "react";
import { saveObservationAction, submitSurveyAction } from "@/app/portal/ops-actions";
import { OBSERVATION_ASPECTS, OBSERVATION_SCALE, type ObservationAspect } from "@/lib/ops";
import { ErrorText, Field, useAction } from "./curriculum-forms";

export function ObservationForm({ batches, today }: { batches: { id: string; label: string }[]; today: string }) {
  const { pending, error, act, router } = useAction();
  const blank = { batchId: batches[0]?.id ?? "", observedOn: today, scores: {} as Partial<Record<ObservationAspect, number>>, strengths: "", improvements: "" };
  const [f, setF] = useState(blank);
  const [saved, setSaved] = useState(false);
  if (!batches.length) return <p className="text-sm text-slate-400">Tutor ini belum punya batch berjalan atau selesai untuk diobservasi.</p>;
  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        setSaved(false);
        act(
          () => saveObservationAction(f.batchId, { observedOn: f.observedOn, scores: f.scores as Record<string, number>, strengths: f.strengths, improvements: f.improvements }),
          () => {
            setSaved(true);
            setF(blank);
            router.refresh();
          },
        );
      }}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Batch yang diobservasi">
          <select value={f.batchId} onChange={(e) => setF({ ...f, batchId: e.target.value })} className="field" required>
            {batches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Tanggal observasi">
          <input type="date" value={f.observedOn} max={today} onChange={(e) => setF({ ...f, observedOn: e.target.value })} className="field" required />
        </Field>
      </div>
      <div className="space-y-3">
        {(Object.keys(OBSERVATION_ASPECTS) as ObservationAspect[]).map((k) => (
          <div key={k} role="radiogroup" aria-label={OBSERVATION_ASPECTS[k]} className="grid gap-2 sm:grid-cols-[180px_1fr] sm:items-center">
            <p className="text-sm font-bold text-white">{OBSERVATION_ASPECTS[k]}</p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {[1, 2, 3, 4].map((n) => (
                <label key={n} className="cursor-pointer rounded-xl border border-orange/20 px-3 py-2 text-xs text-amber-100 has-[:checked]:border-orange has-[:checked]:bg-orange/15">
                  <input type="radio" name={`obs-${k}`} className="sr-only" checked={f.scores[k] === n} onChange={() => setF({ ...f, scores: { ...f.scores, [k]: n } })} aria-label={`${n} · ${OBSERVATION_SCALE[n]}`} />
                  <span className="font-black text-white">{n}</span> · {OBSERVATION_SCALE[n]}
                </label>
              ))}
            </div>
          </div>
        ))}
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Kekuatan tutor">
          <textarea value={f.strengths} onChange={(e) => setF({ ...f, strengths: e.target.value })} rows={3} className="field" required />
        </Field>
        <Field label="Saran perbaikan">
          <textarea value={f.improvements} onChange={(e) => setF({ ...f, improvements: e.target.value })} rows={3} className="field" required />
        </Field>
      </div>
      <ErrorText error={error} />
      <div className="flex items-center gap-3">
        <button disabled={pending} className="btn-orange rounded-full px-6 py-2.5 text-sm">
          {pending ? "Menyimpan..." : "Simpan observasi"}
        </button>
        {saved && <span className="text-sm font-bold text-emerald-300">Observasi tersimpan</span>}
      </div>
    </form>
  );
}

const STARS = ["", "Kurang", "Cukup", "Baik", "Sangat baik", "Luar biasa"];

export function SurveyForm({ enrollmentId, tutor }: { enrollmentId: string; tutor: string }) {
  const { pending, error, act, router } = useAction();
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        act(() => submitSurveyAction(enrollmentId, rating, comment), () => router.refresh());
      }}
    >
      <div role="radiogroup" aria-label={`Nilai untuk ${tutor}`} className="flex flex-wrap gap-2">
        {[1, 2, 3, 4, 5].map((n) => (
          <label key={n} className="cursor-pointer rounded-xl border border-orange/30 px-3 py-2 text-center text-xs text-amber-100 has-[:checked]:border-orange has-[:checked]:bg-orange has-[:checked]:text-navy">
            <input type="radio" name={`survey-${enrollmentId}`} className="sr-only" checked={rating === n} onChange={() => setRating(n)} aria-label={`${n} · ${STARS[n]}`} />
            <span className="block text-lg font-black">{n}</span>
            {STARS[n]}
          </label>
        ))}
      </div>
      <Field label="Komentar (opsional)" hint="Tidak ditampilkan dengan namamu; tim akademik hanya melihat rekap.">
        <textarea value={comment} onChange={(e) => setComment(e.target.value)} rows={2} maxLength={1000} className="field" />
      </Field>
      <ErrorText error={error} />
      <button disabled={pending || !rating} className="btn-orange rounded-full px-5 py-2 text-xs">
        {pending ? "Mengirim..." : "Kirim penilaian"}
      </button>
    </form>
  );
}
