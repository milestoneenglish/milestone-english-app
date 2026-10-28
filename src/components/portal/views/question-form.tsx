"use client";

import { useRouter } from "next/navigation";
import { toast } from "@/components/toast";
import { useState, useTransition } from "react";
import { attachAudio, audioUploadTarget, saveQuestion, type QuestionInput } from "@/app/portal/bank-actions";
import { createClient } from "@/lib/supabase/client";

const SECTION_OPTIONS = [
  ["grammar", "Grammar"],
  ["reading", "Reading"],
  ["listening", "Listening"],
  ["writing", "Writing"],
  ["speaking", "Speaking"],
] as const;

export function QuestionForm({ initial, hasAudio }: { initial: QuestionInput; hasAudio: boolean }) {
  const router = useRouter();
  const [q, setQ] = useState<QuestionInput>({ ...initial, options: [...initial.options, "", "", "", ""].slice(0, Math.max(4, initial.options.length)) });
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [audioMsg, setAudioMsg] = useState("");
  const [pending, start] = useTransition();
  const choice = ["grammar", "reading", "listening"].includes(q.section);

  function set<K extends keyof QuestionInput>(key: K, value: QuestionInput[K]) {
    setSaved(false);
    setQ((prev) => ({ ...prev, [key]: value }));
  }

  function save() {
    setError("");
    start(async () => {
      const res = await saveQuestion(q);
      if (!res.ok) { toast.error(res.error); return setError(res.error); }
      toast.success("Soal tersimpan");
      setSaved(true);
      if (!q.id && res.id) router.replace(`/portal/lead/bank-soal?id=${res.id}`);
      router.refresh();
    });
  }

  async function uploadAudio(file: File) {
    setAudioMsg("");
    if (!q.group_key) return setAudioMsg("Isi dan simpan kode kelompok dulu.");
    const target = await audioUploadTarget(q.group_key, file.type);
    if (!target.ok || !target.path || !target.token) return setAudioMsg(target.ok ? "Gagal menyiapkan unggahan." : target.error);
    const up = await createClient().storage.from("placement-media").uploadToSignedUrl(target.path, target.token, file, { contentType: file.type });
    if (up.error) return setAudioMsg("Audio gagal diunggah.");
    const res = await attachAudio(q.group_key, target.path);
    setAudioMsg(res.ok ? "Audio terpasang untuk semua soal di kelompok ini." : res.error);
    if (res.ok) toast.success("Audio terpasang"); else toast.error(res.error);
    router.refresh();
  }

  return (
    <form
      className="space-y-5"
      onSubmit={(e) => {
        e.preventDefault();
        save();
      }}
    >
      <div className="grid gap-4 sm:grid-cols-3">
        <label className="block">
          <span className="mb-2 block text-xs font-bold text-amber-100">Bagian</span>
          <select value={q.section} onChange={(e) => set("section", e.target.value)} disabled={Boolean(q.id)} className="field">
            {SECTION_OPTIONS.map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="mb-2 block text-xs font-bold text-amber-100">Level (CEFR)</span>
          <select value={q.cefr} onChange={(e) => set("cefr", e.target.value)} className="field">
            <option value="">-</option>
            {["A1", "A2", "B1", "B2"].map((l) => (
              <option key={l}>{l}</option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="mb-2 block text-xs font-bold text-amber-100">Urutan</span>
          <input type="number" value={q.sort_order} onChange={(e) => set("sort_order", Number(e.target.value))} className="field" />
        </label>
      </div>

      {(q.section === "reading" || q.section === "listening") && (
        <>
          <label className="block">
            <span className="mb-2 block text-xs font-bold text-amber-100">Kode kelompok</span>
            <input value={q.group_key} onChange={(e) => set("group_key", e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-"))} placeholder="contoh: reading-club" className="field" />
            <span className="mt-1.5 block text-xs text-amber-200/70">Soal dengan kode yang sama memakai {q.section === "reading" ? "teks" : "audio"} yang sama dan tampil berurutan.</span>
          </label>
          <label className="block">
            <span className="mb-2 block text-xs font-bold text-amber-100">{q.section === "reading" ? "Teks bacaan" : "Naskah audio (dibacakan suara browser bila audio belum diunggah)"}</span>
            <textarea value={q.passage} onChange={(e) => set("passage", e.target.value)} rows={8} className="field" />
          </label>
        </>
      )}

      <label className="block">
        <span className="mb-2 block text-xs font-bold text-amber-100">{choice ? "Pertanyaan" : "Instruksi tugas"}</span>
        <textarea value={q.prompt} onChange={(e) => set("prompt", e.target.value)} rows={3} required className="field" />
      </label>

      {choice && (
        <fieldset className="space-y-2">
          <legend className="mb-2 text-xs font-bold text-amber-100">Pilihan jawaban (tandai yang benar)</legend>
          {q.options.map((opt, i) => (
            <div key={i} className="flex items-center gap-3">
              <input type="radio" name="answer" checked={q.answer_index === i} onChange={() => set("answer_index", i)} className="h-4 w-4 accent-orange" aria-label={`Pilihan ${String.fromCharCode(65 + i)} benar`} />
              <span className="w-5 font-black text-orange">{String.fromCharCode(65 + i)}</span>
              <input
                value={opt}
                onChange={(e) => {
                  const next = [...q.options];
                  next[i] = e.target.value;
                  set("options", next);
                }}
                className="field py-2"
              />
            </div>
          ))}
        </fieldset>
      )}

      <label className="flex items-center gap-2 text-sm font-bold text-amber-100">
        <input type="checkbox" checked={q.active} onChange={(e) => set("active", e.target.checked)} className="h-4 w-4 accent-orange" />
        Aktif (dipakai di tes)
      </label>

      {error && <p className="text-sm font-bold text-rose-300">{error}</p>}
      {saved && <p className="text-sm font-bold text-emerald-300">Soal tersimpan.</p>}
      <button disabled={pending} className="btn-orange rounded-xl px-6 py-3 text-sm">
        {pending ? "Menyimpan..." : "Simpan soal"}
      </button>

      {q.section === "listening" && q.id && (
        <div className="rounded-xl border border-orange/30 p-4">
          <p className="text-sm font-black text-orange">Audio kelompok “{q.group_key}”</p>
          <p className="mt-1 text-xs text-amber-200/80">{hasAudio ? "Audio asli sudah terpasang." : "Belum ada audio; tes memakai suara browser untuk membacakan naskah."}</p>
          <input type="file" accept="audio/*" onChange={(e) => e.target.files?.[0] && void uploadAudio(e.target.files[0])} className="mt-3 block text-sm text-amber-100" />
          {audioMsg && <p className="mt-2 text-sm font-bold text-amber-100">{audioMsg}</p>}
        </div>
      )}
    </form>
  );
}
