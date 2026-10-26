"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  addMaterialAction,
  addModuleAction,
  createCurriculumAction,
  deleteDraftAction,
  deleteMaterialAction,
  deleteModuleAction,
  deleteTaskAction,
  fileUrlAction,
  moveModuleAction,
  newVersionAction,
  prepareMaterialUpload,
  publishCurriculumAction,
  saveTaskAction,
  updateCurriculumAction,
  updateModuleAction,
} from "@/app/portal/learning-actions";
import { ASSESSMENT_LABEL } from "@/lib/academic";
import type { MaterialRow, ModuleRow, SubmissionType, TaskRow } from "@/lib/curriculum";
import { createClient } from "@/lib/supabase/client";

const TYPE_OPTIONS: { value: SubmissionType; label: string }[] = [
  { value: "any", label: "Teks, rekaman, atau file" },
  { value: "text", label: "Teks" },
  { value: "audio", label: "Rekaman suara" },
  { value: "file", label: "File" },
];

export function ErrorText({ error }: { error: string }) {
  return error ? (
    <p className="text-sm font-bold text-rose-300" role="alert">
      {error}
    </p>
  ) : null;
}

export function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-2 block text-xs font-bold text-amber-100">{label}</span>
      {children}
      {hint && <span className="mt-1.5 block text-xs text-amber-200/70">{hint}</span>}
    </label>
  );
}

// Menjalankan aksi server lalu memuat ulang halaman; mengembalikan pesan error bila gagal.
export function useAction() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState("");
  const act = <T extends { ok: boolean; error?: string }>(fn: () => Promise<T>, after?: (res: T) => void) =>
    start(async () => {
      setError("");
      const res = await fn();
      if (!res.ok) return setError(res.error ?? "Terjadi kesalahan.");
      if (after) after(res);
      else router.refresh();
    });
  return { pending, error, act, router };
}

export const ghost = "rounded-full border border-orange/40 px-4 py-2 text-xs font-black text-orange hover:bg-orange/10 disabled:opacity-50";
export const danger = "rounded-full border border-rose-400/50 px-4 py-2 text-xs font-black text-rose-300 hover:bg-rose-500/10 disabled:opacity-50";

export function CreateCurriculumButton({ programId }: { programId: string }) {
  const { pending, error, act, router } = useAction();
  return (
    <div className="space-y-1">
      <button disabled={pending} onClick={() => act(() => createCurriculumAction(programId), (r) => router.push(`/portal/lead/kurikulum?id=${(r as { id: string }).id}`))} className={ghost}>
        {pending ? "Membuat..." : "Buat kurikulum"}
      </button>
      <ErrorText error={error} />
    </div>
  );
}

export function CurriculumActions({ id, status, hasDraft }: { id: string; status: "draft" | "published" | "archived"; hasDraft: boolean }) {
  const { pending, error, act, router } = useAction();
  const [confirm, setConfirm] = useState<"" | "publish" | "delete">("");
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        {status === "draft" && !confirm && (
          <>
            <button disabled={pending} onClick={() => setConfirm("publish")} className="btn-orange rounded-full px-5 py-2.5 text-sm">
              Terbitkan kurikulum
            </button>
            <button disabled={pending} onClick={() => setConfirm("delete")} className={danger}>
              Hapus draf
            </button>
          </>
        )}
        {status !== "draft" && !hasDraft && (
          <button disabled={pending} onClick={() => act(() => newVersionAction(id), (r) => router.push(`/portal/lead/kurikulum?id=${(r as { id: string }).id}`))} className={ghost}>
            {pending ? "Menyalin..." : "Buat versi baru"}
          </button>
        )}
      </div>
      {confirm === "publish" && (
        <div className="space-y-3 rounded-xl border border-orange/30 bg-navy-dark/70 p-4">
          <p className="text-sm text-amber-100">
            Setelah terbit, Admin bisa memakai kurikulum ini untuk membuka batch. Isi modul dan teks rubrik tetap bisa diubah, tetapi jumlah dan urutan sesi, daftar indikator rubrik, serta titik assessment terkunci. Versi terbit sebelumnya diarsipkan dan tetap dipakai batch yang sudah memakainya.
          </p>
          <div className="flex gap-2">
            <button disabled={pending} onClick={() => act(() => publishCurriculumAction(id).then((r) => (r.ok && setConfirm(""), r)))} className="btn-orange rounded-full px-5 py-2.5 text-sm">
              {pending ? "Menerbitkan..." : "Ya, terbitkan"}
            </button>
            <button disabled={pending} onClick={() => setConfirm("")} className="rounded-full border border-orange/40 px-5 py-2.5 text-sm font-bold text-amber-100">
              Batal
            </button>
          </div>
        </div>
      )}
      {confirm === "delete" && (
        <div className="space-y-3 rounded-xl border border-rose-400/30 p-4">
          <p className="text-sm text-amber-100">Draf beserta modul, materi, dan template tugasnya dihapus permanen.</p>
          <div className="flex gap-2">
            <button disabled={pending} onClick={() => act(() => deleteDraftAction(id), () => router.push("/portal/lead/kurikulum"))} className="rounded-full bg-rose-500 px-5 py-2.5 text-sm font-black text-white">
              {pending ? "Menghapus..." : "Ya, hapus draf"}
            </button>
            <button disabled={pending} onClick={() => setConfirm("")} className="rounded-full border border-orange/40 px-5 py-2.5 text-sm font-bold text-amber-100">
              Batal
            </button>
          </div>
        </div>
      )}
      <ErrorText error={error} />
    </div>
  );
}

export function CurriculumMetaForm({ id, title, notes }: { id: string; title: string; notes: string }) {
  const { pending, error, act } = useAction();
  const [f, setF] = useState({ title, notes });
  const [saved, setSaved] = useState(false);
  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        setSaved(false);
        act(() => updateCurriculumAction(id, f).then((r) => (r.ok && setSaved(true), r)));
      }}
    >
      <div className="grid gap-4 sm:grid-cols-[1fr_2fr]">
        <Field label="Judul kurikulum">
          <input value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} maxLength={160} className="field" />
        </Field>
        <Field label="Catatan untuk tutor (opsional)">
          <input value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} maxLength={2000} placeholder="Misalnya: fokus kelancaran, bukan kesempurnaan grammar" className="field" />
        </Field>
      </div>
      <ErrorText error={error} />
      <div className="flex items-center gap-3">
        <button disabled={pending} className={ghost}>
          {pending ? "Menyimpan..." : "Simpan judul & catatan"}
        </button>
        {saved && <span className="text-sm font-bold text-emerald-300">Tersimpan</span>}
      </div>
    </form>
  );
}

export function FileButton({ kind, id, label = "Buka" }: { kind: "material" | "submission" | "report"; id: string; label?: string }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState("");
  return (
    <span className="inline-flex items-center gap-2">
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          start(async () => {
            setError("");
            const res = await fileUrlAction(kind, id);
            if (!res.ok) return setError(res.error);
            window.open(res.url, "_blank", "noopener,noreferrer");
          })
        }
        className="rounded-full border border-orange/40 px-3 py-1 text-[11px] font-black text-orange hover:bg-orange/10"
      >
        {pending ? "Membuka..." : label}
      </button>
      {error && <span className="text-xs font-bold text-rose-300">{error}</span>}
    </span>
  );
}

function MaterialList({ materials, editable }: { materials: MaterialRow[]; editable: boolean }) {
  const { pending, error, act } = useAction();
  if (!materials.length) return <p className="text-sm text-slate-400">Belum ada materi.</p>;
  return (
    <div>
      <ul className="space-y-2">
        {materials.map((m) => (
          <li key={m.id} className="lp-card-soft flex flex-wrap items-center justify-between gap-2 px-4 py-2 text-sm">
            <span className="min-w-0">
              <span className="mr-2 text-[11px] font-black uppercase text-amber-200/70">{m.kind === "link" ? "Link" : m.kind === "audio" ? "Audio" : "File"}</span>
              <span className="font-bold text-white">{m.title}</span>
            </span>
            <span className="flex items-center gap-2">
              {m.kind === "link" ? (
                <a href={m.url!} target="_blank" rel="noopener noreferrer" className="rounded-full border border-orange/40 px-3 py-1 text-[11px] font-black text-orange hover:bg-orange/10">
                  Buka
                </a>
              ) : (
                <FileButton kind="material" id={m.id} />
              )}
              {editable && (
                <button disabled={pending} onClick={() => act(() => deleteMaterialAction(m.id))} className="rounded-full border border-rose-400/50 px-3 py-1 text-[11px] font-black text-rose-300">
                  Hapus
                </button>
              )}
            </span>
          </li>
        ))}
      </ul>
      <ErrorText error={error} />
    </div>
  );
}

function AddMaterialForm({ moduleId }: { moduleId: string }) {
  const router = useRouter();
  const [mode, setMode] = useState<"link" | "file">("link");
  const [title, setTitle] = useState("");
  const [url, setUrl] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [step, setStep] = useState("");
  const [error, setError] = useState("");

  async function submit() {
    setError("");
    if (title.trim().length < 2) return setError("Beri judul materi.");
    if (mode === "link") {
      setStep("Menyimpan...");
      const res = await addMaterialAction(moduleId, { kind: "link", title, url });
      setStep("");
      if (!res.ok) return setError(res.error);
    } else {
      if (!file) return setError("Pilih file materi.");
      setStep("Mengunggah...");
      const target = await prepareMaterialUpload(moduleId, file.type, file.size);
      if (!target.ok) {
        setStep("");
        return setError(target.error);
      }
      const up = await createClient().storage.from("learning-materials").uploadToSignedUrl(target.path, target.token, file, { contentType: file.type });
      if (up.error) {
        setStep("");
        return setError("File gagal diunggah. Periksa koneksi lalu coba lagi.");
      }
      setStep("Menyimpan...");
      const res = await addMaterialAction(moduleId, { kind: "file", title, path: target.path, mime: file.type, size: file.size });
      setStep("");
      if (!res.ok) return setError(res.error);
    }
    setTitle("");
    setUrl("");
    setFile(null);
    router.refresh();
  }

  return (
    <div className="space-y-3 rounded-xl border border-dashed border-orange/30 p-4">
      <div className="flex gap-2">
        {(["link", "file"] as const).map((m) => (
          <button key={m} type="button" onClick={() => setMode(m)} className={`rounded-full border px-3 py-1 text-[11px] font-black ${mode === m ? "border-orange bg-orange text-white" : "border-orange/30 text-amber-100"}`}>
            {m === "link" ? "Link (YouTube, Slides, artikel)" : "File atau audio"}
          </button>
        ))}
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={160} placeholder="Judul materi" className="field py-2!" aria-label="Judul materi" />
        {mode === "link" ? (
          <input key="link" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://..." className="field py-2!" aria-label="Link materi" />
        ) : (
          <input
            key="file"
            type="file"
            aria-label="File materi"
            accept=".pdf,.doc,.docx,.ppt,.pptx,image/*,audio/*"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            className="field py-2! file:mr-3 file:rounded-full file:border-0 file:bg-orange file:px-3 file:py-1 file:text-xs file:font-black file:text-navy"
          />
        )}
      </div>
      <p className="text-xs text-amber-200/70">File maksimal 10 MB: PDF, Word, PowerPoint, gambar, atau audio. Video cukup ditambahkan sebagai link.</p>
      <ErrorText error={error} />
      <button type="button" disabled={step !== ""} onClick={() => void submit()} className={ghost}>
        {step || "+ Tambah materi"}
      </button>
    </div>
  );
}

function TaskEditor({ moduleId, task }: { moduleId: string; task: TaskRow | null }) {
  const { pending, error, act } = useAction();
  const [f, setF] = useState({ title: task?.title ?? "", instructions: task?.instructions ?? "", type: (task?.submission_type ?? "any") as SubmissionType });
  const [open, setOpen] = useState(Boolean(task));
  const [saved, setSaved] = useState(false);
  if (!open)
    return (
      <button type="button" onClick={() => setOpen(true)} className={ghost}>
        + Tambah template tugas
      </button>
    );
  return (
    <div className="space-y-3 rounded-xl border border-orange/20 p-4">
      <div className="grid gap-3 sm:grid-cols-[2fr_1fr]">
        <input value={f.title} onChange={(e) => (setSaved(false), setF({ ...f, title: e.target.value }))} maxLength={160} placeholder="Judul tugas" className="field py-2!" aria-label="Judul tugas" />
        <select value={f.type} onChange={(e) => (setSaved(false), setF({ ...f, type: e.target.value as SubmissionType }))} className="field py-2!" aria-label="Jenis pengumpulan">
          {TYPE_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </div>
      <textarea value={f.instructions} onChange={(e) => (setSaved(false), setF({ ...f, instructions: e.target.value }))} rows={3} maxLength={4000} placeholder="Instruksi untuk siswa" className="field" aria-label="Instruksi tugas" />
      <ErrorText error={error} />
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          disabled={pending}
          onClick={() =>
            act(() =>
              saveTaskAction(moduleId, task?.id ?? null, f).then((r) => {
                if (r.ok) {
                  setSaved(true);
                  if (!task) setF({ title: "", instructions: "", type: "any" });
                }
                return r;
              }),
            )
          }
          className={ghost}
        >
          {pending ? "Menyimpan..." : task ? "Simpan tugas" : "Tambah tugas"}
        </button>
        {task && (
          <button type="button" disabled={pending} onClick={() => act(() => deleteTaskAction(task.id))} className={danger}>
            Hapus tugas
          </button>
        )}
        {!task && (
          <button type="button" onClick={() => setOpen(false)} className="text-xs font-bold text-amber-100">
            Batal
          </button>
        )}
        {saved && <span className="text-sm font-bold text-emerald-300">Tersimpan</span>}
      </div>
    </div>
  );
}

export function ModuleEditor({ module, draft, isFirst, isLast, assessment }: { module: ModuleRow; draft: boolean; isFirst: boolean; isLast: boolean; assessment?: React.ReactNode }) {
  const { pending, error, act } = useAction();
  const [f, setF] = useState({ title: module.title, objectives: module.objectives, content: module.content, week: module.week });
  const [saved, setSaved] = useState(false);
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => {
    setSaved(false);
    setF((x) => ({ ...x, [k]: v }));
  };
  return (
    <details className="group rounded-2xl border border-orange/20 bg-navy/40 open:border-orange/50">
      <summary className="flex cursor-pointer list-none flex-wrap items-center justify-between gap-3 px-5 py-4">
        <span>
          <span className="text-xs font-black text-amber-200/80">Sesi {module.seq}</span>
          <span className="ml-3 font-black text-white">{module.title}</span>
          {module.assessment && (
            <span className="ml-3 rounded-full border border-orange/50 bg-orange/15 px-2.5 py-0.5 text-[11px] font-black text-orange">Assessment {ASSESSMENT_LABEL[module.assessment].toLowerCase()}</span>
          )}
        </span>
        <span className="text-xs text-amber-200/70">
          {module.materials.length} materi · {module.tasks.length} tugas <span className="ml-2 text-orange group-open:hidden">Ubah ▾</span>
        </span>
      </summary>
      <div className="space-y-5 border-t border-orange/15 px-5 py-5">
        {assessment && (
          <div className="flex flex-wrap items-center gap-3 rounded-xl border border-orange/20 p-3 text-xs text-amber-100">
            <span className="font-bold">Titik assessment:</span>
            {assessment}
          </div>
        )}
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            act(() => updateModuleAction(module.id, f).then((r) => (r.ok && setSaved(true), r)));
          }}
        >
          <div className="grid gap-4 sm:grid-cols-[3fr_1fr]">
            <Field label="Judul sesi">
              <input value={f.title} onChange={(e) => set("title", e.target.value)} maxLength={200} className="field" />
            </Field>
            <Field label="Minggu ke" hint={draft ? undefined : "Terkunci di versi terbit"}>
              <input type="number" min={1} max={52} value={f.week} disabled={!draft} onChange={(e) => set("week", Number(e.target.value))} className="field disabled:opacity-60" />
            </Field>
          </div>
          <Field label="Tujuan sesi">
            <textarea value={f.objectives} onChange={(e) => set("objectives", e.target.value)} rows={2} maxLength={2000} className="field" />
          </Field>
          <Field label="Isi materi" hint="Tampil untuk tutor dan siswa. Gunakan baris baru dan tanda • untuk poin.">
            <textarea value={f.content} onChange={(e) => set("content", e.target.value)} rows={7} maxLength={20000} className="field font-mono text-sm" />
          </Field>
          <div className="flex flex-wrap items-center gap-2">
            <button disabled={pending} className="btn-orange rounded-full px-5 py-2 text-xs">
              {pending ? "Menyimpan..." : "Simpan sesi"}
            </button>
            {draft && (
              <>
                <button type="button" disabled={pending || isFirst} onClick={() => act(() => moveModuleAction(module.id, -1))} className={ghost}>
                  ↑ Naikkan
                </button>
                <button type="button" disabled={pending || isLast} onClick={() => act(() => moveModuleAction(module.id, 1))} className={ghost}>
                  ↓ Turunkan
                </button>
                <button type="button" disabled={pending} onClick={() => act(() => deleteModuleAction(module.id))} className={danger}>
                  Hapus sesi
                </button>
              </>
            )}
            {saved && <span className="text-sm font-bold text-emerald-300">Tersimpan</span>}
          </div>
          <ErrorText error={error} />
        </form>
        <div className="space-y-3">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-amber-200/80">Materi</p>
          <MaterialList materials={module.materials} editable />
          <AddMaterialForm moduleId={module.id} />
        </div>
        <div className="space-y-3">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-amber-200/80">Template tugas</p>
          {module.tasks.map((t) => (
            <TaskEditor key={`${t.id}-${t.title}`} moduleId={module.id} task={t} />
          ))}
          <TaskEditor moduleId={module.id} task={null} />
        </div>
      </div>
    </details>
  );
}

export function AddModuleForm({ curriculumId }: { curriculumId: string }) {
  const { pending, error, act } = useAction();
  const [title, setTitle] = useState("");
  return (
    <form
      className="flex flex-wrap items-center gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        act(() => addModuleAction(curriculumId, title).then((r) => (r.ok && setTitle(""), r)));
      }}
    >
      <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} placeholder="Judul sesi baru" className="field max-w-md py-2!" aria-label="Judul sesi baru" />
      <button disabled={pending || title.trim().length < 2} className={ghost}>
        {pending ? "Menambah..." : "+ Tambah sesi"}
      </button>
      <ErrorText error={error} />
    </form>
  );
}

export { MaterialList };
