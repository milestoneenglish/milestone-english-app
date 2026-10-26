import "server-only";
import { notify, studentRecipients } from "@/lib/notify";
import { createAdminClient } from "@/lib/supabase/admin";
import { levelFromRubric, overallLevel, recommendPrograms, rubricAverage, SPEAKING_CRITERIA, WRITING_CRITERIA, type Level, type SectionName } from "./levels";
import { ANSWER_BUCKET, loadAttempt, PlacementError, type AttemptRow } from "./server";

// Aksi staf atas placement. Pemanggil wajib sudah memeriksa role pengguna (requireRole).

async function audit(actorId: string, action: string, entityId: string, detail: object = {}) {
  await createAdminClient().from("audit_log").insert({ actor_id: actorId, action, entity: "placement_attempts", entity_id: entityId, detail });
}

export type QueueItem = {
  id: string;
  status: AttemptRow["status"];
  submitted_at: string | null;
  student_name: string;
  student_id: string;
  evaluator_id: string | null;
  evaluator_name: string | null;
  levels: AttemptRow["levels"];
  retest_of: string | null;
};

export async function placementQueue(filter: { evaluatorId?: string } = {}): Promise<QueueItem[]> {
  const admin = createAdminClient();
  let query = admin
    .from("placement_attempts")
    .select("id, status, submitted_at, student_id, evaluator_id, levels, retest_of, students(full_name), evaluator:profiles!placement_attempts_evaluator_id_fkey(full_name, email)")
    .not("student_id", "is", null)
    .neq("status", "in_progress")
    .order("submitted_at", { ascending: true });
  if (filter.evaluatorId) query = query.eq("evaluator_id", filter.evaluatorId);
  const { data, error } = await query;
  if (error) throw new PlacementError(`Antrean placement gagal dimuat: ${error.message}`);
  return (data ?? []).map((r) => {
    const student = r.students as unknown as { full_name: string } | null;
    const evaluator = r.evaluator as unknown as { full_name: string; email: string } | null;
    return {
      id: r.id,
      status: r.status,
      submitted_at: r.submitted_at,
      student_id: r.student_id as string,
      student_name: student?.full_name ?? "-",
      evaluator_id: r.evaluator_id,
      evaluator_name: evaluator ? evaluator.full_name || evaluator.email : null,
      levels: r.levels,
      retest_of: r.retest_of,
    };
  });
}

export async function evaluators(): Promise<{ id: string; name: string }[]> {
  const admin = createAdminClient();
  const { data } = await admin.from("user_roles").select("user_id, role, profiles!user_roles_user_id_fkey(full_name, email, status)").in("role", ["tutor", "lead"]);
  const seen = new Map<string, string>();
  for (const r of data ?? []) {
    const p = r.profiles as unknown as { full_name: string; email: string; status: string } | null;
    if (p?.status === "active" && !seen.has(r.user_id)) seen.set(r.user_id, p.full_name || p.email);
  }
  return [...seen].map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name));
}

export async function assignEvaluator(actorId: string, attemptId: string, evaluatorId: string) {
  const attempt = await loadAttempt(attemptId);
  if (!attempt || attempt.status !== "awaiting_review") throw new PlacementError("Tes ini tidak sedang menunggu penilaian.");
  if (!(await evaluators()).some((e) => e.id === evaluatorId)) throw new PlacementError("Penilai harus tutor atau Academic Lead yang aktif.");
  const { error } = await createAdminClient().from("placement_attempts").update({ evaluator_id: evaluatorId, assigned_at: new Date().toISOString() }).eq("id", attemptId);
  if (error) throw new PlacementError("Penilai gagal ditugaskan.");
  await audit(actorId, "placement_assigned", attemptId, { evaluator_id: evaluatorId });
}

export type ReviewData = {
  attempt: AttemptRow;
  student: { full_name: string; birth_year: number | null; learning_goal: string };
  writing: { prompt: string; text: string | null }[];
  speaking: { prompt: string; audioUrl: string | null }[];
};

export async function reviewData(attemptId: string): Promise<ReviewData> {
  const admin = createAdminClient();
  const attempt = await loadAttempt(attemptId);
  if (!attempt?.student_id) throw new PlacementError("Tes tidak ditemukan.");
  const [{ data: student }, { data: questions }, { data: answers }] = await Promise.all([
    admin.from("students").select("full_name, birth_year, learning_goal").eq("id", attempt.student_id).single(),
    admin.from("placement_questions").select("id, section, prompt, sort_order").in("section", ["writing", "speaking"]).order("sort_order"),
    admin.from("placement_answers").select("question_id, text_answer, audio_path").eq("attempt_id", attemptId),
  ]);
  const byQ = new Map((answers ?? []).map((a) => [a.question_id, a]));
  const paths = (answers ?? []).map((a) => a.audio_path).filter(Boolean) as string[];
  const urls: Record<string, string> = {};
  if (paths.length) {
    const { data } = await admin.storage.from(ANSWER_BUCKET).createSignedUrls(paths, 60 * 60);
    for (const u of data ?? []) if (u.path && u.signedUrl) urls[u.path] = u.signedUrl;
  }
  // Hanya soal yang memang dijawab atau masih aktif yang ditampilkan.
  const relevant = (questions ?? []).filter((q) => byQ.has(q.id));
  return {
    attempt,
    student: student as ReviewData["student"],
    writing: relevant.filter((q) => q.section === "writing").map((q) => ({ prompt: q.prompt, text: byQ.get(q.id)?.text_answer ?? null })),
    speaking: relevant.filter((q) => q.section === "speaking").map((q) => ({ prompt: q.prompt, audioUrl: byQ.get(q.id)?.audio_path ? (urls[byQ.get(q.id)!.audio_path!] ?? null) : null })),
  };
}

function cleanRubric(input: Record<string, number> | null, keys: readonly { key: string }[]) {
  if (!input) return null;
  const out: Record<string, number> = {};
  for (const { key } of keys) {
    const v = Number(input[key]);
    if (!Number.isInteger(v) || v < 1 || v > 4) throw new PlacementError("Setiap indikator rubrik harus diberi nilai 1–4.");
    out[key] = v;
  }
  return out;
}

async function programIdsForSlugs(slugs: string[]) {
  if (!slugs.length) return [];
  const { data } = await createAdminClient().from("programs").select("id, slug").in("slug", slugs);
  return slugs.map((s) => data?.find((p) => p.slug === s)?.id).filter(Boolean) as string[];
}

// Tutor (atau Lead) menyimpan nilai writing/speaking; level keseluruhan dan rekomendasi dihitung ulang.
export async function submitReview(
  actor: { id: string; isLead: boolean },
  attemptId: string,
  input: { writing: Record<string, number> | null; speaking: Record<string, number> | null; comment: string },
) {
  const data = await reviewData(attemptId);
  const { attempt, student } = data;
  if (attempt.status !== "awaiting_review") throw new PlacementError("Tes ini tidak sedang menunggu penilaian.");
  if (!actor.isLead && attempt.evaluator_id !== actor.id) throw new PlacementError("Tes ini tidak ditugaskan kepadamu.");

  const hasWriting = data.writing.some((w) => w.text?.trim());
  const hasSpeaking = data.speaking.some((s) => s.audioUrl);
  const writing = hasWriting ? cleanRubric(input.writing, WRITING_CRITERIA) : null;
  const speaking = hasSpeaking ? cleanRubric(input.speaking, SPEAKING_CRITERIA) : null;
  if (hasWriting && !writing) throw new PlacementError("Nilai writing wajib diisi.");
  if (hasSpeaking && !speaking) throw new PlacementError("Nilai speaking wajib diisi.");

  const levels: Partial<Record<SectionName | "overall", Level>> = { ...attempt.levels };
  delete levels.overall;
  if (writing) levels.writing = levelFromRubric(rubricAverage(writing)!);
  if (speaking) levels.speaking = levelFromRubric(rubricAverage(speaking)!);
  const overall = overallLevel(Object.values(levels) as Level[]);
  if (overall) levels.overall = overall;

  const age = student.birth_year ? new Date().getFullYear() - student.birth_year : null;
  const recommended = overall ? await programIdsForSlugs(recommendPrograms(overall, age, student.learning_goal)) : [];

  const { error } = await createAdminClient()
    .from("placement_attempts")
    .update({
      status: "reviewed",
      writing_rubric: writing,
      speaking_rubric: speaking,
      review_comment: input.comment.trim().slice(0, 2000) || null,
      reviewed_at: new Date().toISOString(),
      levels,
      recommended_program_ids: recommended,
      evaluator_id: attempt.evaluator_id ?? actor.id,
    })
    .eq("id", attemptId)
    .eq("status", "awaiting_review");
  if (error) throw new PlacementError("Penilaian gagal disimpan.");
  await audit(actor.id, "placement_reviewed", attemptId, { levels });
}

export async function publishResult(actorId: string, attemptId: string, programIds: string[], note: string) {
  const attempt = await loadAttempt(attemptId);
  if (!attempt || attempt.status !== "reviewed") throw new PlacementError("Hanya hasil yang sudah dinilai yang bisa diterbitkan.");
  if (programIds.length === 0) throw new PlacementError("Pilih minimal satu program rekomendasi.");
  const { data: valid } = await createAdminClient().from("programs").select("id").in("id", programIds).eq("status", "active");
  if ((valid ?? []).length !== programIds.length) throw new PlacementError("Program rekomendasi tidak valid.");
  const { error } = await createAdminClient()
    .from("placement_attempts")
    .update({
      status: "published",
      recommended_program_ids: programIds,
      lead_note: note.trim().slice(0, 2000) || null,
      published_by: actorId,
      published_at: new Date().toISOString(),
    })
    .eq("id", attemptId)
    .eq("status", "reviewed");
  if (error) throw new PlacementError("Hasil gagal diterbitkan.");
  await audit(actorId, "placement_published", attemptId, { program_ids: programIds });
  if (attempt.student_id) {
    const { data: s } = await createAdminClient().from("students").select("full_name").eq("id", attempt.student_id).maybeSingle();
    await notify("placement_published", await studentRecipients(attempt.student_id), { name: s?.full_name ?? "", level: attempt.levels.overall ?? "-" }, { type: "placement_attempts", id: attemptId });
  }
}

// Tes ulang: hasil lama tetap tersimpan, siswa mendapat tes baru.
export async function allowRetest(actorId: string, attemptId: string, reason: string) {
  const attempt = await loadAttempt(attemptId);
  if (!attempt?.student_id || attempt.status !== "published") throw new PlacementError("Tes ulang hanya untuk hasil yang sudah terbit.");
  if (reason.trim().length < 5) throw new PlacementError("Tuliskan alasan tes ulang.");
  const admin = createAdminClient();
  const { data: open } = await admin.from("placement_attempts").select("id").eq("student_id", attempt.student_id).neq("status", "published").limit(1);
  if (open?.length) throw new PlacementError("Siswa ini masih punya tes yang belum selesai.");
  const { data, error } = await admin
    .from("placement_attempts")
    .insert({ student_id: attempt.student_id, retest_of: attempt.id, retest_reason: reason.trim().slice(0, 500) })
    .select("id")
    .single();
  if (error) throw new PlacementError("Tes ulang gagal dibuat.");
  await audit(actorId, "placement_retest", data.id, { retest_of: attempt.id, reason });
}
