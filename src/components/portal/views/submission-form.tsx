"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { prepareSubmissionUpload, submitAssignmentAction } from "@/app/portal/learning-actions";
import { Icon } from "@/components/icons";
import { toast } from "@/components/toast";
import type { SubmissionType } from "@/lib/curriculum";
import { createClient } from "@/lib/supabase/client";

const MAX_SECONDS = 300;

function Recorder({ onChange }: { onChange: (blob: Blob | null) => void }) {
  const [state, setState] = useState<"idle" | "recording">("idle");
  const [seconds, setSeconds] = useState(0);
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState("");
  const recorder = useRef<MediaRecorder | null>(null);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(
    () => () => {
      if (timer.current) clearInterval(timer.current);
      recorder.current?.stream.getTracks().forEach((t) => t.stop());
    },
    [],
  );

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
    rec.onstop = () => {
      stream.getTracks().forEach((t) => t.stop());
      if (timer.current) clearInterval(timer.current);
      const blob = new Blob(chunks, { type: (rec.mimeType || "audio/webm").split(";")[0] });
      setUrl(URL.createObjectURL(blob));
      onChange(blob);
      setState("idle");
    };
    recorder.current = rec;
    rec.start();
    setSeconds(0);
    setUrl(null);
    onChange(null);
    setState("recording");
    timer.current = setInterval(() => {
      setSeconds((s) => {
        if (s + 1 >= MAX_SECONDS && rec.state === "recording") rec.stop();
        return s + 1;
      });
    }, 1000);
  }

  const mmss = `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
  return (
    <div className="space-y-2 rounded-xl border border-orange/30 bg-orange/5 p-4">
      <div className="flex flex-wrap items-center gap-3">
        {state === "recording" ? (
          <button type="button" onClick={() => recorder.current?.stop()} className="flex items-center gap-2 rounded-full bg-rose-500 px-5 py-2.5 text-sm font-black text-white">
            <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-white" /> Berhenti · {mmss}
          </button>
        ) : (
          <button type="button" onClick={() => void start()} className="btn-orange flex items-center gap-2 rounded-full px-5 py-2.5 text-sm">
            <Icon name="mic" className="h-4 w-4" /> {url ? "Rekam ulang" : "Mulai rekam"}
          </button>
        )}
        <span className="text-xs text-amber-200/80">Maksimal 5 menit.</span>
      </div>
      {url && <audio controls src={url} className="w-full" />}
      {error && <p className="text-sm font-bold text-rose-300">{error}</p>}
    </div>
  );
}

export function SubmissionForm({ assignmentId, studentId, type, revision }: { assignmentId: string; studentId: string; type: SubmissionType; revision: boolean }) {
  const router = useRouter();
  const [text, setText] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [recording, setRecording] = useState<Blob | null>(null);
  const [mode, setMode] = useState<"record" | "file">(type === "file" ? "file" : "record");
  const [step, setStep] = useState("");
  const [error, setError] = useState("");
  const allowText = type === "text" || type === "any";
  const allowAudio = type === "audio" || type === "any";
  const allowFile = type === "file" || type === "any" || type === "audio";

  async function submit() {
    setError("");
    const blob = mode === "record" && allowAudio ? recording : allowFile ? file : null;
    if (type === "text" && !text.trim()) return setError("Tulis jawabanmu.");
    if (type === "audio" && !blob) return setError("Rekam jawabanmu atau unggah file audio.");
    if (type === "file" && !blob) return setError("Pilih file yang akan dikumpulkan.");
    if (type === "any" && !blob && !text.trim()) return setError("Isi jawaban, rekam suara, atau unggah file.");
    let path: string | null = null;
    let mime: string | null = null;
    if (blob) {
      setStep("Mengunggah...");
      mime = blob.type || "application/octet-stream";
      const target = await prepareSubmissionUpload(assignmentId, studentId, mime, blob.size);
      if (!target.ok) {
        setStep("");
        return setError(target.error);
      }
      const up = await createClient().storage.from("assignment-files").uploadToSignedUrl(target.path, target.token, blob, { contentType: mime });
      if (up.error) {
        setStep("");
        return setError("File gagal diunggah. Periksa koneksi lalu coba lagi.");
      }
      path = target.path;
    }
    setStep("Mengirim...");
    const res = await submitAssignmentAction(assignmentId, studentId, { text, path, mime });
    setStep("");
    if (!res.ok) { toast.error(res.error); return setError(res.error); }
    toast.success("Tugas terkumpul. Tutor akan memberi feedback.");
    router.refresh();
  }

  return (
    <div className="space-y-3 rounded-xl border border-orange/30 bg-navy-dark/50 p-4">
      <p className="text-xs font-black uppercase tracking-[0.18em] text-amber-200/80">{revision ? "Kumpulkan revisi" : "Kumpulkan tugas"}</p>
      {allowText && (
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={4}
          maxLength={10000}
          placeholder={type === "any" ? "Tulis jawaban, atau tempel link video (Google Drive/YouTube) di sini" : "Tulis jawabanmu"}
          className="field"
          aria-label="Jawaban"
        />
      )}
      {allowAudio && allowFile && (
        <div className="flex gap-2">
          {(["record", "file"] as const).map((m) => (
            <button key={m} type="button" onClick={() => setMode(m)} className={`rounded-full border px-3 py-1 text-[11px] font-black ${mode === m ? "border-orange bg-orange text-white" : "border-orange/30 text-amber-100"}`}>
              {m === "record" ? "Rekam suara" : "Unggah file"}
            </button>
          ))}
        </div>
      )}
      {allowAudio && mode === "record" && <Recorder onChange={setRecording} />}
      {allowFile && (mode === "file" || !allowAudio) && (
        <label className="block">
          <input
            type="file"
            aria-label="File tugas"
            accept={type === "audio" ? "audio/*" : ".pdf,.doc,.docx,.ppt,.pptx,image/*,audio/*"}
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            className="field file:mr-3 file:rounded-full file:border-0 file:bg-orange file:px-3 file:py-1 file:text-xs file:font-black file:text-navy"
          />
          <span className="mt-1.5 block text-xs text-amber-200/70">Maksimal 10 MB. Untuk video, tempel link-nya di kolom jawaban.</span>
        </label>
      )}
      {error && (
        <p className="text-sm font-bold text-rose-300" role="alert">
          {error}
        </p>
      )}
      <button type="button" disabled={step !== ""} onClick={() => void submit()} className="btn-orange rounded-full px-6 py-2.5 text-sm">
        {step || (revision ? "Kirim revisi" : "Kumpulkan")}
      </button>
    </div>
  );
}
