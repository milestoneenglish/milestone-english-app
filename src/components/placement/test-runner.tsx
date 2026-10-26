"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { answerChoices, answerText, confirmSpeaking, playListening, prepareSpeakingUpload, submitTest } from "@/app/placement/actions";
import { Icon } from "@/components/icons";
import { Logo } from "@/components/logo";
import { SECTION_LABEL, type SectionName } from "@/lib/placement/levels";
import type { Paper, PaperQuestion } from "@/lib/placement/server";
import { createClient } from "@/lib/supabase/client";

const MAX_RECORD_SECONDS = 120;
const SECTION_HINT: Record<SectionName, string> = {
  grammar: "Pilih jawaban yang paling tepat untuk melengkapi kalimat.",
  reading: "Baca teks dengan teliti, lalu jawab pertanyaannya.",
  listening: "Dengarkan audio, lalu jawab pertanyaannya. Setiap audio hanya bisa diputar 2 kali.",
  writing: "Tulis jawabanmu dalam bahasa Inggris. Jawaban tersimpan otomatis.",
  speaking: "Rekam jawabanmu dalam bahasa Inggris. Pastikan mikrofon diizinkan dan ruangan cukup tenang.",
};

type AnswerState = { choice: number | null; text: string; audioUrl: string | null; plays: number };

function useElapsed(startedAt: string) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  const s = Math.max(0, Math.floor((now - Date.parse(startedAt)) / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

function groupBy(questions: PaperQuestion[]) {
  const groups: { key: string; passage: string | null; audioUrl: string | null; items: PaperQuestion[] }[] = [];
  for (const q of questions) {
    const key = q.group_key ?? q.id;
    let g = groups.find((x) => x.key === key);
    if (!g) {
      g = { key, passage: q.passage, audioUrl: q.audio_url, items: [] };
      groups.push(g);
    }
    g.items.push(q);
  }
  return groups;
}

function ChoiceQuestion({ q, number, value, onChange }: { q: PaperQuestion; number: number; value: number | null; onChange: (v: number) => void }) {
  return (
    <fieldset className="lp-card-soft p-5">
      <legend className="sr-only">Soal {number}</legend>
      <p className="font-bold text-white">
        <span className="mr-2 text-orange">{number}.</span>
        {q.prompt}
      </p>
      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        {(q.options ?? []).map((opt, i) => {
          const active = value === i;
          return (
            <label
              key={i}
              className={`flex cursor-pointer items-center gap-3 rounded-xl border px-4 py-3 text-sm transition ${
                active ? "border-orange bg-orange/15 font-bold text-white" : "border-orange/25 text-amber-100 hover:border-orange/60"
              }`}
            >
              <input type="radio" name={q.id} checked={active} onChange={() => onChange(i)} className="h-4 w-4 accent-orange" />
              <span className="mr-1 font-black text-orange">{String.fromCharCode(65 + i)}.</span>
              {opt}
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}

// Memutar naskah listening dengan suara browser bila audio asli belum diunggah.
function speakScript(script: string, onEnd: () => void) {
  const synth = window.speechSynthesis;
  synth.cancel();
  const voices = synth.getVoices().filter((v) => v.lang.startsWith("en"));
  const speakers = new Map<string, SpeechSynthesisVoice | undefined>();
  const lines = script.split("\n").map((l) => l.trim()).filter(Boolean);
  lines.forEach((line, i) => {
    const m = line.match(/^([A-Za-z]+):\s*(.*)$/);
    const speaker = m?.[1] ?? "narrator";
    if (!speakers.has(speaker)) speakers.set(speaker, voices[speakers.size % Math.max(voices.length, 1)]);
    const u = new SpeechSynthesisUtterance(m ? m[2] : line);
    u.lang = "en-US";
    u.rate = 0.9;
    const voice = speakers.get(speaker);
    if (voice) u.voice = voice;
    if (i === lines.length - 1) u.onend = onEnd;
    synth.speak(u);
  });
}

function ListeningPlayer({ attemptId, groupKey, audioUrl, script, plays, onPlays }: { attemptId: string; groupKey: string; audioUrl: string | null; script: string | null; plays: number; onPlays: (n: number) => void }) {
  const [playing, setPlaying] = useState(false);
  const [error, setError] = useState("");
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const remaining = Math.max(0, 2 - plays);

  async function play() {
    setError("");
    const res = await playListening(attemptId, groupKey);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    onPlays(2 - res.remaining);
    setPlaying(true);
    if (audioUrl) {
      const audio = audioRef.current ?? new Audio(audioUrl);
      audioRef.current = audio;
      audio.currentTime = 0;
      audio.onended = () => setPlaying(false);
      void audio.play();
    } else if (script) {
      speakScript(script, () => setPlaying(false));
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-4 rounded-xl border border-orange/40 bg-orange/10 p-4">
      <button type="button" onClick={() => void play()} disabled={playing || remaining === 0} className="btn-orange flex items-center gap-2 rounded-full px-5 py-2.5 text-sm">
        <Icon name="mic" className="h-4 w-4" /> {playing ? "Sedang diputar..." : remaining === 0 ? "Kesempatan habis" : "Putar audio"}
      </button>
      <span className="text-sm font-bold text-amber-100">Sisa putar: {remaining} dari 2</span>
      {error && <span className="text-sm font-bold text-rose-300">{error}</span>}
    </div>
  );
}

function SpeakingRecorder({ attemptId, q, number, savedUrl, onSaved }: { attemptId: string; q: PaperQuestion; number: number; savedUrl: string | null; onSaved: (url: string) => void }) {
  const [state, setState] = useState<"idle" | "recording" | "uploading">("idle");
  const [seconds, setSeconds] = useState(0);
  const [error, setError] = useState("");
  const recorder = useRef<MediaRecorder | null>(null);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => () => {
    if (timer.current) clearInterval(timer.current);
    recorder.current?.stream.getTracks().forEach((t) => t.stop());
  }, []);

  async function start() {
    setError("");
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      setError("Mikrofon tidak bisa diakses. Izinkan mikrofon di browser, lalu coba lagi.");
      return;
    }
    const mime = ["audio/webm;codecs=opus", "audio/webm", "audio/ogg", "audio/mp4"].find((m) => MediaRecorder.isTypeSupported(m)) ?? "";
    const rec = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
    const chunks: Blob[] = [];
    rec.ondataavailable = (e) => {
      if (e.data.size) chunks.push(e.data);
    };
    rec.onstop = async () => {
      stream.getTracks().forEach((t) => t.stop());
      if (timer.current) clearInterval(timer.current);
      const type = (rec.mimeType || "audio/webm").split(";")[0];
      const blob = new Blob(chunks, { type });
      setState("uploading");
      const target = await prepareSpeakingUpload(attemptId, q.id, type);
      if (!target.ok) {
        setError(target.error);
        setState("idle");
        return;
      }
      const up = await createClient().storage.from("placement-answers").uploadToSignedUrl(target.path, target.token, blob, { contentType: type });
      if (up.error) {
        setError("Rekaman gagal diunggah. Periksa koneksi lalu rekam ulang.");
        setState("idle");
        return;
      }
      const saved = await confirmSpeaking(attemptId, q.id, target.path);
      if (!saved.ok) setError(saved.error);
      else onSaved(URL.createObjectURL(blob));
      setState("idle");
    };
    recorder.current = rec;
    rec.start();
    setSeconds(0);
    setState("recording");
    timer.current = setInterval(() => {
      setSeconds((s) => {
        if (s + 1 >= MAX_RECORD_SECONDS && rec.state === "recording") rec.stop();
        return s + 1;
      });
    }, 1000);
  }

  return (
    <div className="lp-card-soft p-5">
      <p className="font-bold text-white">
        <span className="mr-2 text-orange">{number}.</span>
        {q.prompt}
      </p>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        {state === "recording" ? (
          <button type="button" onClick={() => recorder.current?.stop()} className="flex items-center gap-2 rounded-full bg-rose-500 px-5 py-2.5 text-sm font-black text-white">
            <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-white" /> Berhenti ({seconds}s / {MAX_RECORD_SECONDS}s)
          </button>
        ) : (
          <button type="button" onClick={() => void start()} disabled={state === "uploading"} className="btn-orange flex items-center gap-2 rounded-full px-5 py-2.5 text-sm">
            <Icon name="mic" className="h-4 w-4" /> {state === "uploading" ? "Mengunggah..." : savedUrl ? "Rekam ulang" : "Mulai rekam"}
          </button>
        )}
        {savedUrl && state === "idle" && (
          <span className="flex items-center gap-1 text-sm font-bold text-emerald-300">
            <Icon name="check" className="h-4 w-4" /> Tersimpan
          </span>
        )}
      </div>
      {savedUrl && state === "idle" && <audio controls src={savedUrl} className="mt-4 w-full" />}
      {error && (
        <p className="mt-3 text-sm font-bold text-rose-300" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

export function TestRunner({ paper, takerName }: { paper: Paper; takerName?: string }) {
  const router = useRouter();
  const elapsed = useElapsed(paper.startedAt);
  const sections = useMemo(() => (["grammar", "reading", "listening", "writing", "speaking"] as SectionName[]).filter((s) => paper.questions.some((q) => q.section === s)), [paper.questions]);
  const steps = [...sections, "kirim"] as const;
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Record<string, AnswerState>>(() =>
    Object.fromEntries(
      paper.questions.map((q) => {
        const a = paper.answers[q.id];
        return [q.id, { choice: a?.choice ?? null, text: a?.text_answer ?? "", audioUrl: a?.audio_url ?? null, plays: a?.plays ?? 0 }];
      }),
    ),
  );
  const [saveError, setSaveError] = useState("");
  const [saving, setSaving] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [submitting, startSubmit] = useTransition();
  const textTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  // Pilihan ganda dikumpulkan lalu disimpan berkelompok, supaya klik cepat tidak membuat antrean panjang ke server.
  const pendingChoices = useRef(new Map<string, number>());
  const flushTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inFlight = useRef<Promise<void> | null>(null);

  const numbering = useMemo(() => Object.fromEntries(paper.questions.map((q, i) => [q.id, i + 1])), [paper.questions]);
  const current = steps[step];

  function patch(id: string, value: Partial<AnswerState>) {
    setAnswers((prev) => ({ ...prev, [id]: { ...prev[id], ...value } }));
  }

  async function flushChoices(): Promise<void> {
    if (flushTimer.current) clearTimeout(flushTimer.current);
    flushTimer.current = null;
    if (inFlight.current) await inFlight.current;
    if (pendingChoices.current.size === 0) return;
    const items = [...pendingChoices.current].map(([questionId, choice]) => ({ questionId, choice }));
    pendingChoices.current.clear();
    setSaving(true);
    inFlight.current = (async () => {
      const res = await answerChoices(paper.attemptId, items);
      if (!res.ok) {
        // Jawaban yang gagal dikirim ulang bersama simpanan berikutnya.
        for (const i of items) if (!pendingChoices.current.has(i.questionId)) pendingChoices.current.set(i.questionId, i.choice);
        setSaveError(res.error);
      } else setSaveError("");
    })();
    await inFlight.current;
    inFlight.current = null;
    setSaving(pendingChoices.current.size > 0);
  }

  function choose(q: PaperQuestion, choice: number) {
    patch(q.id, { choice });
    pendingChoices.current.set(q.id, choice);
    setSaving(true);
    if (flushTimer.current) clearTimeout(flushTimer.current);
    flushTimer.current = setTimeout(() => void flushChoices(), 1200);
  }

  function write(q: PaperQuestion, text: string) {
    patch(q.id, { text });
    setSaving(true);
    clearTimeout(textTimers.current[q.id]);
    textTimers.current[q.id] = setTimeout(async () => {
      const res = await answerText(paper.attemptId, q.id, text);
      setSaveError(res.ok ? "" : res.error);
      setSaving(pendingChoices.current.size > 0);
    }, 800);
  }

  function goTo(index: number) {
    void flushChoices();
    setStep(index);
    window.scrollTo({ top: 0 });
  }

  // Simpan jawaban yang tertunda bila tab ditutup atau disembunyikan.
  useEffect(() => {
    const onHide = () => {
      if (document.visibilityState === "hidden") void flushChoices();
    };
    document.addEventListener("visibilitychange", onHide);
    return () => document.removeEventListener("visibilitychange", onHide);
  });

  const summary = sections.map((s) => {
    const list = paper.questions.filter((q) => q.section === s);
    const done = list.filter((q) => {
      const a = answers[q.id];
      return s === "writing" ? a.text.trim().length > 0 : s === "speaking" ? Boolean(a.audioUrl) : a.choice !== null;
    }).length;
    return { section: s, done, total: list.length };
  });
  const missing = summary.filter((s) => s.done < s.total);

  function submit() {
    startSubmit(async () => {
      // Pastikan semua jawaban dan tulisan terakhir tersimpan sebelum dikirim.
      await flushChoices();
      for (const q of paper.questions.filter((x) => x.section === "writing")) {
        clearTimeout(textTimers.current[q.id]);
        await answerText(paper.attemptId, q.id, answers[q.id].text);
      }
      const res = await submitTest(paper.attemptId);
      if (!res.ok) {
        setSaveError(res.error);
        setConfirming(false);
        return;
      }
      // Pindah halaman penuh supaya portal memuat data terbaru tanpa sisa state tes.
      window.location.assign(res.next);
    });
  }

  if (paper.status !== "in_progress") {
    return (
      <main className="flex min-h-screen items-center justify-center bg-navy-dark p-6">
        <div className="workspace-panel max-w-lg p-8 text-center">
          <h1 className="text-2xl font-black text-orange">Tes ini sudah dikirim</h1>
          <p className="lp-muted mt-3 text-sm">Jawaban tidak bisa diubah lagi.</p>
          <button onClick={() => router.replace("/portal")} className="btn-orange mt-6 rounded-xl px-6 py-3 text-sm">
            Lanjut
          </button>
        </div>
      </main>
    );
  }

  return (
    <div className="min-h-screen bg-navy-dark">
      <header className="sticky top-0 z-30 border-b border-orange/20 bg-navy-side/95 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-3">
          <Logo className="h-8 w-auto" plate />
          <div className="text-right">
            <p className="text-xs font-black uppercase tracking-[0.2em] text-orange">Placement Test{takerName ? ` · ${takerName}` : ""}</p>
            <p className="text-xs text-amber-200/80">Waktu berjalan {elapsed} · perkiraan 25–30 menit</p>
            <p className={`text-[11px] font-bold ${saving ? "text-amber-200" : "text-emerald-300"}`} aria-live="polite">
              {saving ? "Menyimpan jawaban..." : "Semua jawaban tersimpan"}
            </p>
          </div>
        </div>
        <nav className="mx-auto flex max-w-5xl gap-2 overflow-x-auto px-4 pb-3" aria-label="Bagian tes">
          {steps.map((s, i) => (
            <button
              key={s}
              type="button"
              onClick={() => goTo(i)}
              aria-current={i === step ? "step" : undefined}
              className={`shrink-0 rounded-full border px-4 py-1.5 text-xs font-black transition ${
                i === step ? "border-orange bg-orange text-white" : i < step ? "border-orange/50 text-orange" : "border-orange/20 text-amber-200/70"
              }`}
            >
              {i + 1}. {s === "kirim" ? "Kirim" : SECTION_LABEL[s]}
            </button>
          ))}
        </nav>
      </header>

      <main className="mx-auto max-w-5xl space-y-5 px-4 py-8">
        {current !== "kirim" ? (
          <>
            <div>
              <h1 className="text-2xl font-black text-orange">{SECTION_LABEL[current]}</h1>
              <p className="lp-muted mt-1 text-sm">{SECTION_HINT[current]}</p>
            </div>

            {current === "grammar" &&
              paper.questions
                .filter((q) => q.section === "grammar")
                .map((q) => <ChoiceQuestion key={q.id} q={q} number={numbering[q.id]} value={answers[q.id].choice} onChange={(v) => choose(q, v)} />)}

            {(current === "reading" || current === "listening") &&
              groupBy(paper.questions.filter((q) => q.section === current)).map((g, gi) => (
                <section key={g.key} className="workspace-panel space-y-4 p-5 sm:p-6">
                  <h2 className="text-sm font-black uppercase tracking-[0.2em] text-amber-200/80">
                    {current === "reading" ? "Teks" : "Audio"} {gi + 1}
                  </h2>
                  {current === "reading" ? (
                    <div className="whitespace-pre-line rounded-xl border border-orange/25 bg-navy p-5 text-sm leading-relaxed text-amber-50">{g.passage}</div>
                  ) : (
                    <ListeningPlayer
                      attemptId={paper.attemptId}
                      groupKey={g.key}
                      audioUrl={g.audioUrl}
                      script={g.passage}
                      plays={Math.max(...g.items.map((q) => answers[q.id].plays))}
                      onPlays={(n) => g.items.forEach((q) => patch(q.id, { plays: n }))}
                    />
                  )}
                  {g.items.map((q) => (
                    <ChoiceQuestion key={q.id} q={q} number={numbering[q.id]} value={answers[q.id].choice} onChange={(v) => choose(q, v)} />
                  ))}
                </section>
              ))}

            {current === "writing" &&
              paper.questions
                .filter((q) => q.section === "writing")
                .map((q) => {
                  const words = answers[q.id].text.trim() ? answers[q.id].text.trim().split(/\s+/).length : 0;
                  return (
                    <div key={q.id} className="lp-card-soft p-5">
                      <p className="font-bold text-white">
                        <span className="mr-2 text-orange">{numbering[q.id]}.</span>
                        {q.prompt}
                      </p>
                      <textarea value={answers[q.id].text} onChange={(e) => write(q, e.target.value)} rows={10} maxLength={5000} className="field mt-4" placeholder="Write your answer here..." />
                      <p className={`mt-2 text-xs font-bold ${words >= 80 && words <= 120 ? "text-emerald-300" : "text-amber-200/80"}`}>{words} kata · target 80–120 kata</p>
                    </div>
                  );
                })}

            {current === "speaking" &&
              paper.questions
                .filter((q) => q.section === "speaking")
                .map((q) => (
                  <SpeakingRecorder key={q.id} attemptId={paper.attemptId} q={q} number={numbering[q.id]} savedUrl={answers[q.id].audioUrl} onSaved={(url) => patch(q.id, { audioUrl: url })} />
                ))}
          </>
        ) : (
          <section className="workspace-panel p-6 sm:p-8">
            <h1 className="text-2xl font-black text-orange">Periksa lalu kirim</h1>
            <p className="lp-muted mt-1 text-sm">Setelah dikirim, jawaban tidak bisa diubah. Grammar, reading, dan listening langsung dinilai; writing dan speaking dinilai tutor paling lambat 1×24 jam.</p>
            <ul className="mt-6 grid gap-3 sm:grid-cols-2">
              {summary.map((s) => (
                <li key={s.section} className="lp-card-soft flex items-center justify-between px-4 py-3 text-sm">
                  <span className="font-black text-white">{SECTION_LABEL[s.section]}</span>
                  <span className={`font-bold ${s.done === s.total ? "text-emerald-300" : "text-amber-200"}`}>
                    {s.done}/{s.total} terjawab
                  </span>
                </li>
              ))}
            </ul>
            {missing.length > 0 && (
              <p className="mt-5 rounded-xl border border-amber-400/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
                Masih ada soal yang belum dijawab di {missing.map((m) => SECTION_LABEL[m.section]).join(", ")}. Soal pilihan ganda yang kosong dihitung salah.
              </p>
            )}
            <button type="button" onClick={() => setConfirming(true)} className="btn-orange mt-6 w-full rounded-xl py-3.5 text-sm sm:w-auto sm:px-10">
              Kirim jawaban
            </button>
          </section>
        )}

        {saveError && (
          <p className="text-sm font-bold text-rose-300" role="alert">
            {saveError}
          </p>
        )}

        <div className="flex justify-between gap-3 pt-2">
          <button type="button" disabled={step === 0} onClick={() => goTo(step - 1)} className="rounded-full border border-orange/50 px-6 py-3 text-sm font-black text-orange disabled:opacity-40">
            Sebelumnya
          </button>
          {step < steps.length - 1 && (
            <button
              type="button"
              onClick={() => goTo(step + 1)}
              className="btn-orange rounded-full px-6 py-3 text-sm"
            >
              Lanjut ke {steps[step + 1] === "kirim" ? "pengiriman" : SECTION_LABEL[steps[step + 1] as SectionName]}
            </button>
          )}
        </div>
      </main>

      {confirming && (
        <div className="modal-backdrop fixed inset-0 z-50 flex items-center justify-center p-4">
          <div role="dialog" aria-modal="true" className="workspace-panel w-full max-w-md p-6">
            <h2 className="text-lg font-black text-orange">Kirim placement test?</h2>
            <p className="lp-muted mt-2 text-sm">Jawaban tidak bisa diubah setelah dikirim.</p>
            <div className="mt-6 flex justify-end gap-3">
              <button type="button" onClick={() => setConfirming(false)} disabled={submitting} className="rounded-full border border-orange/50 px-5 py-2.5 text-sm font-black text-orange">
                Periksa lagi
              </button>
              <button type="button" onClick={submit} disabled={submitting} className="btn-orange rounded-full px-5 py-2.5 text-sm">
                {submitting ? "Mengirim..." : "Ya, kirim"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
