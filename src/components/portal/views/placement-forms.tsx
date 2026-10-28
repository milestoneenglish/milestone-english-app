"use client";

import { useRouter } from "next/navigation";
import { toast } from "@/components/toast";
import { useState, useTransition } from "react";
import { assignAction, publishAction, retestAction, reviewAction, type StaffResult } from "@/app/portal/placement-actions";
import { RUBRIC_SCALE, SPEAKING_CRITERIA, WRITING_CRITERIA } from "@/lib/placement/levels";

function useStaffAction() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  function run(fn: () => Promise<StaffResult>, after?: string) {
    setError("");
    start(async () => {
      const res = await fn();
      if (!res.ok) { toast.error(res.error); return setError(res.error); }
      toast.success("Tersimpan");
      setDone(true);
      if (after) router.push(after);
      router.refresh();
    });
  }
  return { pending, error, done, run };
}

function Message({ error }: { error: string }) {
  return error ? (
    <p className="text-sm font-bold text-rose-300" role="alert">
      {error}
    </p>
  ) : null;
}

export function AssignForm({ attemptId, evaluators, current }: { attemptId: string; evaluators: { id: string; name: string }[]; current: string | null }) {
  const [value, setValue] = useState(current ?? "");
  const { pending, error, run } = useStaffAction();
  return (
    <div className="flex flex-wrap items-center gap-2">
      <select value={value} onChange={(e) => setValue(e.target.value)} className="field max-w-xs py-2!" aria-label="Pilih penilai">
        <option value="">Pilih penilai</option>
        {evaluators.map((e) => (
          <option key={e.id} value={e.id}>
            {e.name}
          </option>
        ))}
      </select>
      <button disabled={!value || pending || value === current} onClick={() => run(() => assignAction(attemptId, value))} className="btn-orange rounded-full px-4 py-2 text-xs">
        {pending ? "Menyimpan..." : current ? "Ganti penilai" : "Tugaskan"}
      </button>
      <Message error={error} />
    </div>
  );
}

function RubricFields({ title, criteria, value, onChange }: { title: string; criteria: readonly { key: string; label: string }[]; value: Record<string, number>; onChange: (v: Record<string, number>) => void }) {
  return (
    <fieldset className="space-y-3">
      <legend className="mb-2 text-sm font-black text-orange">{title}</legend>
      {criteria.map((c) => (
        <label key={c.key} className="grid items-center gap-2 sm:grid-cols-[1fr_220px]">
          <span className="text-sm text-amber-100">{c.label}</span>
          <select value={value[c.key] ?? ""} onChange={(e) => onChange({ ...value, [c.key]: Number(e.target.value) })} required className="field py-2!">
            <option value="">Pilih nilai</option>
            {RUBRIC_SCALE.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </label>
      ))}
    </fieldset>
  );
}

export function ReviewForm({ attemptId, hasWriting, hasSpeaking, backHref }: { attemptId: string; hasWriting: boolean; hasSpeaking: boolean; backHref: string }) {
  const [writing, setWriting] = useState<Record<string, number>>({});
  const [speaking, setSpeaking] = useState<Record<string, number>>({});
  const [comment, setComment] = useState("");
  const { pending, error, run } = useStaffAction();
  return (
    <form
      className="space-y-6"
      onSubmit={(e) => {
        e.preventDefault();
        run(() => reviewAction(attemptId, hasWriting ? writing : null, hasSpeaking ? speaking : null, comment), backHref);
      }}
    >
      {hasWriting && <RubricFields title="Nilai writing" criteria={WRITING_CRITERIA} value={writing} onChange={setWriting} />}
      {hasSpeaking && <RubricFields title="Nilai speaking" criteria={SPEAKING_CRITERIA} value={speaking} onChange={setSpeaking} />}
      {!hasWriting && !hasSpeaking && <p className="text-sm text-amber-100">Siswa tidak mengirim writing maupun speaking. Simpan untuk menetapkan level dari bagian pilihan ganda saja.</p>}
      <label className="block">
        <span className="mb-2 block text-sm font-black text-orange">Catatan untuk siswa</span>
        <textarea value={comment} onChange={(e) => setComment(e.target.value)} rows={4} maxLength={2000} className="field" placeholder="Kekuatan dan hal yang perlu dilatih." />
      </label>
      <Message error={error} />
      <button disabled={pending} className="btn-orange rounded-xl px-6 py-3 text-sm">
        {pending ? "Menyimpan..." : "Simpan penilaian"}
      </button>
    </form>
  );
}

export function PublishForm({ attemptId, programs, recommended }: { attemptId: string; programs: { id: string; name: string; category: string }[]; recommended: string[] }) {
  const [selected, setSelected] = useState<string[]>(recommended);
  const [note, setNote] = useState("");
  const { pending, error, run } = useStaffAction();
  const toggle = (id: string) => setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  return (
    <div className="space-y-5">
      <fieldset>
        <legend className="mb-3 text-sm font-black text-orange">Program rekomendasi (usulan sistem sudah dicentang)</legend>
        <div className="grid gap-2 sm:grid-cols-2">
          {programs.map((p) => (
            <label key={p.id} className={`flex cursor-pointer items-center gap-3 rounded-xl border px-3 py-2.5 text-sm ${selected.includes(p.id) ? "border-orange bg-orange/15 text-white" : "border-orange/20 text-amber-100"}`}>
              <input type="checkbox" checked={selected.includes(p.id)} onChange={() => toggle(p.id)} className="h-4 w-4 accent-orange" />
              <span className="font-bold">{p.name}</span>
              <span className="text-xs opacity-70">{p.category}</span>
            </label>
          ))}
        </div>
      </fieldset>
      <label className="block">
        <span className="mb-2 block text-sm font-black text-orange">Catatan Academic Lead (opsional)</span>
        <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3} maxLength={2000} className="field" />
      </label>
      <Message error={error} />
      <button disabled={pending || selected.length === 0} onClick={() => run(() => publishAction(attemptId, selected, note), "/portal/lead/placement?tab=terbit")} className="btn-orange rounded-xl px-6 py-3 text-sm">
        {pending ? "Menerbitkan..." : "Terbitkan hasil"}
      </button>
    </div>
  );
}

export function RetestForm({ attemptId }: { attemptId: string }) {
  const [reason, setReason] = useState("");
  const { pending, error, done, run } = useStaffAction();
  if (done) return <p className="text-sm font-bold text-emerald-300">Tes ulang dibuat. Siswa bisa mengerjakannya dari portal.</p>;
  return (
    <div className="space-y-3">
      <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={2} maxLength={500} className="field" placeholder="Alasan tes ulang, misalnya gangguan audio saat tes." />
      <Message error={error} />
      <button disabled={pending || reason.trim().length < 5} onClick={() => run(() => retestAction(attemptId, reason))} className="rounded-full border border-orange/50 px-5 py-2.5 text-xs font-black text-orange hover:bg-orange/10">
        {pending ? "Memproses..." : "Izinkan tes ulang"}
      </button>
    </div>
  );
}
