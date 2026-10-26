import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import type { ProgramLite } from "@/components/portal/journey";
import { claimGuestAttempt, latestAttemptForStudent, type AttemptRow } from "./placement/server";

export type StudentRow = {
  id: string;
  user_id: string | null;
  full_name: string;
  birth_year: number | null;
  learning_goal: string;
  interested_program_id: string | null;
  status: string;
  created_at: string;
};

const STUDENT_COLUMNS = "id, user_id, full_name, birth_year, learning_goal, interested_program_id, status, created_at";

export async function activePrograms(): Promise<ProgramLite[]> {
  const { data } = await createAdminClient().from("programs").select("id, slug, name, category, duration_label, price_idr").eq("status", "active").order("sort_order");
  return (data ?? []) as ProgramLite[];
}

// Siswa milik pengguna (siswa dewasa) beserta placement terakhirnya. Tes gratis yang
// dikerjakan sebelum mendaftar disambungkan lebih dulu.
export async function ownStudent(userId: string): Promise<{ student: StudentRow | null; attempt: AttemptRow | null }> {
  await claimGuestAttempt(userId);
  const { data } = await createAdminClient().from("students").select(STUDENT_COLUMNS).eq("user_id", userId).maybeSingle();
  const student = (data as StudentRow | null) ?? null;
  return { student, attempt: student ? await latestAttemptForStudent(student.id) : null };
}

export type ChildEntry = { student: StudentRow; link: { id: string; status: string; relationship: string }; attempt: AttemptRow | null };

export async function guardianChildren(userId: string): Promise<ChildEntry[]> {
  await claimGuestAttempt(userId);
  const { data } = await createAdminClient()
    .from("guardian_links")
    .select(`id, status, relationship, students(${STUDENT_COLUMNS})`)
    .eq("guardian_id", userId)
    .neq("status", "rejected")
    .order("created_at");
  const entries = (data ?? []).map((l) => ({ student: l.students as unknown as StudentRow, link: { id: l.id, status: l.status, relationship: l.relationship } }));
  return Promise.all(entries.map(async (e) => ({ ...e, attempt: await latestAttemptForStudent(e.student.id) })));
}

export async function attemptHistory(studentId: string): Promise<AttemptRow[]> {
  const { data } = await createAdminClient()
    .from("placement_attempts")
    .select("id, student_id, guest_token_hash, status, started_at, submitted_at, auto_scores, levels, evaluator_id, writing_rubric, speaking_rubric, review_comment, recommended_program_ids, lead_note, published_at, retest_of")
    .eq("student_id", studentId)
    .order("created_at", { ascending: false });
  return (data ?? []) as AttemptRow[];
}
