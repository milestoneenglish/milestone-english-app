"use server";

import { revalidatePath } from "next/cache";
import { MEDIA_BUCKET } from "@/lib/placement/server";
import { requireRole } from "@/lib/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export type BankResult = { ok: true; id?: string } | { ok: false; error: string };

const SECTIONS = ["grammar", "reading", "listening", "writing", "speaking"] as const;
const CEFR = ["A1", "A2", "B1", "B2"];

export type QuestionInput = {
  id?: string;
  section: string;
  group_key: string;
  passage: string;
  prompt: string;
  options: string[];
  answer_index: number | null;
  cefr: string;
  sort_order: number;
  active: boolean;
};

// Simpan soal. Ditulis dengan sesi pengguna, jadi aturan RLS (hanya Lead/Owner) ikut berlaku.
export async function saveQuestion(input: QuestionInput): Promise<BankResult> {
  const viewer = await requireRole("lead", "owner");
  if (!SECTIONS.includes(input.section as (typeof SECTIONS)[number])) return { ok: false, error: "Bagian soal tidak valid." };
  if (input.prompt.trim().length < 3) return { ok: false, error: "Isi pertanyaan atau instruksi soal." };
  const choice = ["grammar", "reading", "listening"].includes(input.section);
  const options = input.options.map((o) => o.trim()).filter(Boolean);
  if (choice) {
    if (options.length < 2) return { ok: false, error: "Soal pilihan ganda butuh minimal 2 pilihan." };
    if (input.answer_index === null || input.answer_index < 0 || input.answer_index >= options.length) return { ok: false, error: "Tandai jawaban yang benar." };
    if (input.section !== "grammar" && !input.group_key.trim()) return { ok: false, error: "Isi kode kelompok teks/audio agar soal satu teks tampil bersama." };
  }
  const row = {
    section: input.section,
    group_key: input.group_key.trim() || null,
    passage: input.passage.trim() || null,
    prompt: input.prompt.trim(),
    options: choice ? options : null,
    answer_index: choice ? input.answer_index : null,
    cefr: CEFR.includes(input.cefr) ? input.cefr : null,
    sort_order: Number.isInteger(input.sort_order) ? input.sort_order : 0,
    active: input.active,
  };
  const supabase = await createClient();
  const res = input.id
    ? await supabase.from("placement_questions").update(row).eq("id", input.id).select("id").single()
    : await supabase.from("placement_questions").insert({ ...row, created_by: viewer.id }).select("id").single();
  if (res.error) return { ok: false, error: "Soal gagal disimpan." };
  await createAdminClient().from("audit_log").insert({ actor_id: viewer.id, action: input.id ? "question_updated" : "question_created", entity: "placement_questions", entity_id: res.data.id });
  revalidatePath("/portal/lead/bank-soal");
  return { ok: true, id: res.data.id };
}

export async function audioUploadTarget(groupKey: string, mime: string): Promise<BankResult & { path?: string; token?: string }> {
  await requireRole("lead", "owner");
  const ext = { "audio/mpeg": "mp3", "audio/mp4": "m4a", "audio/wav": "wav", "audio/webm": "webm", "audio/ogg": "ogg" }[mime.split(";")[0]];
  if (!ext) return { ok: false, error: "Format audio harus MP3, M4A, WAV, WEBM, atau OGG." };
  if (!/^[a-z0-9-]+$/.test(groupKey)) return { ok: false, error: "Kode kelompok hanya boleh huruf kecil, angka, dan tanda hubung." };
  const path = `listening/${groupKey}-${Date.now()}.${ext}`;
  const { data, error } = await createAdminClient().storage.from(MEDIA_BUCKET).createSignedUploadUrl(path);
  if (error || !data) return { ok: false, error: "Audio gagal disiapkan untuk diunggah." };
  return { ok: true, path, token: data.token };
}

// Setelah audio terunggah, semua soal dalam kelompok yang sama memakai audio tersebut.
export async function attachAudio(groupKey: string, path: string): Promise<BankResult> {
  await requireRole("lead", "owner");
  if (!path.startsWith(`listening/${groupKey}-`)) return { ok: false, error: "Audio tidak valid." };
  const supabase = await createClient();
  const { error } = await supabase.from("placement_questions").update({ audio_path: path }).eq("section", "listening").eq("group_key", groupKey);
  if (error) return { ok: false, error: "Audio gagal dipasang ke soal." };
  revalidatePath("/portal/lead/bank-soal");
  return { ok: true };
}
