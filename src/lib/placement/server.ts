import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { AUTO_SECTIONS, levelFromPercent, type Level, type SectionName } from "./levels";

// Placement dibaca dan ditulis lewat server dengan service role, setelah akses
// pengguna atau tamu diperiksa di sini. Kunci jawaban tidak pernah dikirim ke browser.

export const GUEST_COOKIE = "me_placement";
export const ANSWER_BUCKET = "placement-answers";
export const MEDIA_BUCKET = "placement-media";
export const MAX_LISTENING_PLAYS = 2;

export class PlacementError extends Error {}

export type Actor = { kind: "guest"; tokenHash: string } | { kind: "user"; userId: string } | { kind: "none" };

export type AttemptRow = {
  id: string;
  student_id: string | null;
  guest_token_hash: string | null;
  status: "in_progress" | "awaiting_review" | "reviewed" | "published";
  started_at: string;
  submitted_at: string | null;
  auto_scores: Record<string, { correct: number; total: number }>;
  levels: Partial<Record<SectionName | "overall", Level>>;
  evaluator_id: string | null;
  writing_rubric: Record<string, number> | null;
  speaking_rubric: Record<string, number> | null;
  review_comment: string | null;
  recommended_program_ids: string[];
  lead_note: string | null;
  published_at: string | null;
  retest_of: string | null;
};

const ATTEMPT_COLUMNS =
  "id, student_id, guest_token_hash, status, started_at, submitted_at, auto_scores, levels, evaluator_id, writing_rubric, speaking_rubric, review_comment, recommended_program_ids, lead_note, published_at, retest_of";

export function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export async function currentActor(): Promise<Actor> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) return { kind: "user", userId: user.id };
  const token = (await cookies()).get(GUEST_COOKIE)?.value;
  return token ? { kind: "guest", tokenHash: hashToken(token) } : { kind: "none" };
}

export async function userCanAccessStudent(userId: string, studentId: string) {
  const admin = createAdminClient();
  const [{ data: own }, { data: link }] = await Promise.all([
    admin.from("students").select("id").eq("id", studentId).eq("user_id", userId).maybeSingle(),
    admin.from("guardian_links").select("id").eq("student_id", studentId).eq("guardian_id", userId).neq("status", "rejected").maybeSingle(),
  ]);
  return Boolean(own || link);
}

export async function loadAttempt(attemptId: string): Promise<AttemptRow | null> {
  const { data } = await createAdminClient().from("placement_attempts").select(ATTEMPT_COLUMNS).eq("id", attemptId).maybeSingle();
  return (data as AttemptRow | null) ?? null;
}

// Attempt yang boleh diakses pelaku saat ini (pemilik, wali anaknya, atau tamu pemegang cookie).
export async function attemptForActor(attemptId: string): Promise<AttemptRow> {
  const [actor, attempt] = await Promise.all([currentActor(), loadAttempt(attemptId)]);
  if (!attempt) throw new PlacementError("Tes tidak ditemukan.");
  if (actor.kind === "guest" && attempt.guest_token_hash === actor.tokenHash) return attempt;
  if (actor.kind === "user" && attempt.student_id && (await userCanAccessStudent(actor.userId, attempt.student_id))) return attempt;
  // Tamu yang kemudian login tetap bisa menyelesaikan tes yang ia mulai di browser ini.
  if (actor.kind === "user") {
    const token = (await cookies()).get(GUEST_COOKIE)?.value;
    if (token && attempt.guest_token_hash === hashToken(token)) return attempt;
  }
  throw new PlacementError("Kamu tidak memiliki akses ke tes ini.");
}

export async function latestAttemptForStudent(studentId: string): Promise<AttemptRow | null> {
  const { data } = await createAdminClient()
    .from("placement_attempts")
    .select(ATTEMPT_COLUMNS)
    .eq("student_id", studentId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return (data as AttemptRow | null) ?? null;
}

// Memulai (atau melanjutkan) tes untuk siswa terdaftar.
export async function startStudentAttempt(userId: string, studentId: string): Promise<string> {
  if (!(await userCanAccessStudent(userId, studentId))) throw new PlacementError("Kamu tidak memiliki akses ke siswa ini.");
  const latest = await latestAttemptForStudent(studentId);
  if (latest?.status === "in_progress") return latest.id;
  if (latest) throw new PlacementError("Placement test sudah dikerjakan. Tes ulang perlu persetujuan Academic Lead.");
  const { data, error } = await createAdminClient().from("placement_attempts").insert({ student_id: studentId }).select("id").single();
  if (error) throw new PlacementError("Tes gagal dimulai. Coba lagi.");
  return data.id;
}

// Memulai tes gratis untuk tamu; identitasnya disimpan sebagai cookie acak di browser.
export async function startGuestAttempt(): Promise<string> {
  const jar = await cookies();
  const existing = jar.get(GUEST_COOKIE)?.value;
  if (existing) {
    const { data } = await createAdminClient().from("placement_attempts").select("id, status").eq("guest_token_hash", hashToken(existing)).maybeSingle();
    if (data) return data.id;
  }
  const token = randomBytes(32).toString("base64url");
  const { data, error } = await createAdminClient().from("placement_attempts").insert({ guest_token_hash: hashToken(token) }).select("id").single();
  if (error) throw new PlacementError("Tes gagal dimulai. Coba lagi.");
  jar.set(GUEST_COOKIE, token, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", maxAge: 60 * 60 * 24 * 30, path: "/" });
  return data.id;
}

export type PaperQuestion = {
  id: string;
  section: SectionName;
  group_key: string | null;
  passage: string | null;
  audio_url: string | null;
  prompt: string;
  options: string[] | null;
};

export type PaperAnswer = { choice: number | null; text_answer: string | null; audio_url: string | null; plays: number };

export type Paper = {
  attemptId: string;
  status: AttemptRow["status"];
  startedAt: string;
  questions: PaperQuestion[];
  answers: Record<string, PaperAnswer>;
};

const SECTION_ORDER: SectionName[] = ["grammar", "reading", "listening", "writing", "speaking"];

export async function getPaper(attemptId: string): Promise<Paper> {
  const attempt = await attemptForActor(attemptId);
  const admin = createAdminClient();
  const [{ data: questions }, { data: answers }] = await Promise.all([
    admin.from("placement_questions").select("id, section, group_key, passage, audio_path, prompt, options, sort_order").eq("active", true).order("sort_order"),
    admin.from("placement_answers").select("question_id, choice, text_answer, audio_path, plays").eq("attempt_id", attemptId),
  ]);

  const audioPaths = [...new Set((questions ?? []).map((q) => q.audio_path).filter(Boolean) as string[])];
  const mediaUrls: Record<string, string> = {};
  if (audioPaths.length) {
    const { data } = await admin.storage.from(MEDIA_BUCKET).createSignedUrls(audioPaths, 60 * 60 * 3);
    for (const item of data ?? []) if (item.path && item.signedUrl) mediaUrls[item.path] = item.signedUrl;
  }
  const answerAudio = (answers ?? []).map((a) => a.audio_path).filter(Boolean) as string[];
  const answerUrls: Record<string, string> = {};
  if (answerAudio.length) {
    const { data } = await admin.storage.from(ANSWER_BUCKET).createSignedUrls(answerAudio, 60 * 60);
    for (const item of data ?? []) if (item.path && item.signedUrl) answerUrls[item.path] = item.signedUrl;
  }

  const sorted = [...(questions ?? [])].sort((a, b) => SECTION_ORDER.indexOf(a.section) - SECTION_ORDER.indexOf(b.section) || a.sort_order - b.sort_order);

  return {
    attemptId,
    status: attempt.status,
    startedAt: attempt.started_at,
    questions: sorted.map((q) => ({
      id: q.id,
      section: q.section,
      group_key: q.group_key,
      passage: q.section === "listening" && q.audio_path ? null : q.passage,
      audio_url: q.audio_path ? (mediaUrls[q.audio_path] ?? null) : null,
      prompt: q.prompt,
      options: q.options,
    })),
    answers: Object.fromEntries(
      (answers ?? []).map((a) => [a.question_id, { choice: a.choice, text_answer: a.text_answer, audio_url: a.audio_path ? (answerUrls[a.audio_path] ?? null) : null, plays: a.plays }]),
    ),
  };
}

async function questionFor(questionId: string) {
  const { data } = await createAdminClient().from("placement_questions").select("id, section, group_key, options, active").eq("id", questionId).maybeSingle();
  if (!data || !data.active) throw new PlacementError("Soal tidak ditemukan.");
  return data as { id: string; section: SectionName; group_key: string | null; options: string[] | null; active: boolean };
}

async function openAttempt(attemptId: string) {
  const attempt = await attemptForActor(attemptId);
  if (attempt.status !== "in_progress") throw new PlacementError("Tes sudah dikirim dan tidak bisa diubah lagi.");
  return attempt;
}

// Menyimpan beberapa jawaban pilihan ganda sekaligus (dikirim berkelompok dari browser).
export async function saveChoices(attemptId: string, items: { questionId: string; choice: number }[]) {
  if (items.length === 0) return;
  if (items.length > 60) throw new PlacementError("Terlalu banyak jawaban sekaligus.");
  const admin = createAdminClient();
  const [, { data: questions }] = await Promise.all([
    openAttempt(attemptId),
    admin.from("placement_questions").select("id, section, options, active").in("id", items.map((i) => i.questionId)),
  ]);
  const byId = new Map((questions ?? []).map((q) => [q.id, q]));
  const now = new Date().toISOString();
  const rows = items.map(({ questionId, choice }) => {
    const q = byId.get(questionId);
    const valid = q?.active && AUTO_SECTIONS.includes(q.section) && Number.isInteger(choice) && choice >= 0 && choice < (q.options?.length ?? 0);
    if (!valid) throw new PlacementError("Jawaban tidak valid.");
    return { attempt_id: attemptId, question_id: questionId, choice, updated_at: now };
  });
  const { error } = await admin.from("placement_answers").upsert(rows, { onConflict: "attempt_id,question_id" });
  if (error) throw new PlacementError("Jawaban gagal disimpan.");
}

export async function saveText(attemptId: string, questionId: string, text: string) {
  await openAttempt(attemptId);
  const q = await questionFor(questionId);
  if (q.section !== "writing") throw new PlacementError("Jawaban tidak valid.");
  const { error } = await createAdminClient()
    .from("placement_answers")
    .upsert({ attempt_id: attemptId, question_id: questionId, text_answer: text.slice(0, 5000), updated_at: new Date().toISOString() }, { onConflict: "attempt_id,question_id" });
  if (error) throw new PlacementError("Jawaban gagal disimpan.");
}

// Mencatat satu kali putar audio listening untuk seluruh soal dalam kelompok yang sama.
export async function recordPlay(attemptId: string, groupKey: string): Promise<number> {
  await openAttempt(attemptId);
  const admin = createAdminClient();
  const { data: group } = await admin.from("placement_questions").select("id").eq("section", "listening").eq("group_key", groupKey).eq("active", true);
  if (!group?.length) throw new PlacementError("Audio tidak ditemukan.");
  const ids = group.map((g) => g.id);
  const { data: existing } = await admin.from("placement_answers").select("question_id, plays").eq("attempt_id", attemptId).in("question_id", ids);
  const used = Math.max(0, ...(existing ?? []).map((a) => a.plays));
  if (used >= MAX_LISTENING_PLAYS) throw new PlacementError("Audio ini sudah diputar 2 kali.");
  // Baris yang sudah ada hanya diperbarui hitungan putarnya, supaya jawaban yang sudah dipilih tidak terhapus.
  const known = new Set((existing ?? []).map((a) => a.question_id));
  const fresh = ids.filter((id) => !known.has(id)).map((id) => ({ attempt_id: attemptId, question_id: id, plays: used + 1 }));
  const results = await Promise.all([
    known.size ? admin.from("placement_answers").update({ plays: used + 1 }).eq("attempt_id", attemptId).in("question_id", [...known]) : null,
    fresh.length ? admin.from("placement_answers").insert(fresh) : null,
  ]);
  if (results.some((r) => r?.error)) throw new PlacementError("Gagal memutar audio. Coba lagi.");
  return MAX_LISTENING_PLAYS - (used + 1);
}

const AUDIO_EXT: Record<string, string> = { "audio/webm": "webm", "audio/ogg": "ogg", "audio/mp4": "m4a", "audio/mpeg": "mp3", "audio/wav": "wav" };

export async function speakingUploadTarget(attemptId: string, questionId: string, mime: string) {
  await openAttempt(attemptId);
  const q = await questionFor(questionId);
  if (q.section !== "speaking") throw new PlacementError("Soal ini bukan speaking.");
  const base = mime.split(";")[0];
  const ext = AUDIO_EXT[base];
  if (!ext) throw new PlacementError("Format rekaman tidak didukung browser ini.");
  const path = `${attemptId}/${questionId}.${ext}`;
  const { data, error } = await createAdminClient().storage.from(ANSWER_BUCKET).createSignedUploadUrl(path, { upsert: true });
  if (error || !data) throw new PlacementError("Rekaman gagal disiapkan untuk diunggah.");
  return { path, token: data.token };
}

export async function saveSpeaking(attemptId: string, questionId: string, path: string) {
  await openAttempt(attemptId);
  const q = await questionFor(questionId);
  if (q.section !== "speaking" || !path.startsWith(`${attemptId}/${questionId}.`)) throw new PlacementError("Rekaman tidak valid.");
  const admin = createAdminClient();
  const folder = await admin.storage.from(ANSWER_BUCKET).list(attemptId, { search: questionId });
  if (!folder.data?.some((f) => `${attemptId}/${f.name}` === path)) throw new PlacementError("Rekaman belum terunggah.");
  const { error } = await admin
    .from("placement_answers")
    .upsert({ attempt_id: attemptId, question_id: questionId, audio_path: path, updated_at: new Date().toISOString() }, { onConflict: "attempt_id,question_id" });
  if (error) throw new PlacementError("Rekaman gagal disimpan.");
}

export type SubmitResult = { levels: Partial<Record<SectionName | "overall", Level>>; scores: AttemptRow["auto_scores"] };

// Mengirim tes: pilihan ganda dinilai di server, writing/speaking menunggu tutor.
export async function submitAttempt(attemptId: string): Promise<SubmitResult> {
  await openAttempt(attemptId);
  const admin = createAdminClient();
  const [{ data: questions }, { data: answers }] = await Promise.all([
    admin.from("placement_questions").select("id, section, answer_index").eq("active", true).in("section", [...AUTO_SECTIONS]),
    admin.from("placement_answers").select("question_id, choice").eq("attempt_id", attemptId),
  ]);
  const chosen = new Map((answers ?? []).map((a) => [a.question_id, a.choice]));

  const scores: AttemptRow["auto_scores"] = {};
  const levels: SubmitResult["levels"] = {};
  const marks: { attempt_id: string; question_id: string; is_correct: boolean }[] = [];
  for (const section of AUTO_SECTIONS) {
    const list = (questions ?? []).filter((q) => q.section === section);
    if (!list.length) continue;
    let correct = 0;
    for (const q of list) {
      const ok = chosen.get(q.id) === q.answer_index;
      if (ok) correct++;
      if (chosen.has(q.id)) marks.push({ attempt_id: attemptId, question_id: q.id, is_correct: ok });
    }
    scores[section] = { correct, total: list.length };
    levels[section] = levelFromPercent((correct / list.length) * 100);
  }

  // Semua baris sudah ada (soal yang dijawab), jadi upsert ini hanya memperbarui kolom is_correct.
  if (marks.length) {
    const { error: markError } = await admin.from("placement_answers").upsert(marks, { onConflict: "attempt_id,question_id" });
    if (markError) throw new PlacementError("Tes gagal dinilai. Coba kirim lagi.");
  }
  const { error } = await admin
    .from("placement_attempts")
    .update({ status: "awaiting_review", submitted_at: new Date().toISOString(), auto_scores: scores, levels })
    .eq("id", attemptId)
    .eq("status", "in_progress");
  if (error) throw new PlacementError("Tes gagal dikirim. Coba lagi.");
  return { levels, scores };
}

// Menyambungkan tes gratis yang dikerjakan sebelum punya akun ke siswa milik pengguna.
export async function claimGuestAttempt(userId: string): Promise<boolean> {
  const jar = await cookies();
  const token = jar.get(GUEST_COOKIE)?.value;
  if (!token) return false;
  const admin = createAdminClient();
  const { data: attempt } = await admin.from("placement_attempts").select("id, student_id").eq("guest_token_hash", hashToken(token)).maybeSingle();
  if (!attempt || attempt.student_id) return false;

  const { data: own } = await admin.from("students").select("id").eq("user_id", userId).maybeSingle();
  let target = own?.id as string | undefined;
  if (!target) {
    const { data: links } = await admin.from("guardian_links").select("student_id").eq("guardian_id", userId).neq("status", "rejected");
    for (const l of links ?? []) {
      if (!(await latestAttemptForStudent(l.student_id))) {
        target = l.student_id;
        break;
      }
    }
  }
  if (!target || (await latestAttemptForStudent(target))) return false;

  const { error } = await admin.from("placement_attempts").update({ student_id: target }).eq("id", attempt.id).is("student_id", null);
  return !error;
}
