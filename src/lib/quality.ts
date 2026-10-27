import "server-only";
import { assessmentDue, moduleKinds, pointsOf, reportDue } from "@/lib/assessment";
import { ClassError, dbError } from "@/lib/classes";
import { sessionEnd, sessionsOf, type AttendanceStatus } from "@/lib/learning";
import { OBSERVATION_ASPECTS, type ObservationAspect, type PeriodKey } from "@/lib/ops";
import { periodRange } from "@/lib/owner";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

// Kualitas tutor untuk Academic Lead (dan Owner): ketepatan waktu dihitung otomatis dari data kelas,
// ditambah observasi kelas oleh Lead dan survei siswa di akhir program (hanya rekap, tanpa nama siswa).

const HOUR = 3600_000;
export const ATTENDANCE_WINDOW_HOURS = 24;


export type Ratio = { onTime: number; total: number };
export type TutorQuality = {
  tutor: { id: string; full_name: string; email: string };
  batches: number;
  attendance: Ratio;
  assessment: Ratio;
  report: Ratio;
  returned: number;
  feedbackHours: number | null;
  feedbackCount: number;
  survey: { average: number | null; count: number };
  observation: { average: number | null; count: number; last: string | null };
};

const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);

export async function tutorQuality(period: PeriodKey): Promise<TutorQuality[]> {
  const admin = createAdminClient();
  const { from, to } = periodRange(period);
  const now = Date.now();
  const end = Math.min(to.getTime(), now);
  const inRange = (t: number) => t >= from.getTime() && t < end;

  const { data: roleRows } = await admin.from("user_roles").select("user_id").eq("role", "tutor");
  const tutorIds = (roleRows ?? []).map((r) => r.user_id as string);
  if (!tutorIds.length) return [];
  const [{ data: profiles }, { data: batches }] = await Promise.all([
    admin.from("profiles").select("id, full_name, email, status").in("id", tutorIds),
    admin.from("batches").select("id, tutor_id").in("tutor_id", tutorIds).not("status", "eq", "cancelled"),
  ]);
  const batchIds = (batches ?? []).map((b) => b.id as string);
  const none = ["00000000-0000-0000-0000-000000000000"];
  const ids = batchIds.length ? batchIds : none;

  const sessions = await sessionsOf(batchIds);
  const [kinds, { data: enrollments }, { data: attendance }, { data: assessments }, { data: reports }, { data: feedback }, { data: surveys }, { data: observations }] = await Promise.all([
    moduleKinds([...new Set(sessions.map((s) => s.module_id).filter(Boolean) as string[])]),
    admin.from("enrollments").select("id, batch_id, student_id").in("batch_id", ids).in("status", ["active", "completed"]),
    admin.from("attendance").select("session_id, student_id, status").in("session_id", sessions.length ? sessions.map((s) => s.id) : none),
    admin.from("assessments").select("batch_id, student_id, kind, status, published_at").in("batch_id", ids),
    admin.from("reports").select("enrollment_id, batch_id, submitted_at, return_count, tutor_id").in("batch_id", ids),
    admin
      .from("feedback")
      .select("tutor_id, published_at, submission:submissions(submitted_at)")
      .in("tutor_id", tutorIds)
      .eq("status", "published")
      .gte("published_at", from.toISOString())
      .lt("published_at", to.toISOString()),
    admin.from("tutor_surveys").select("tutor_id, rating").in("tutor_id", tutorIds).gte("created_at", from.toISOString()).lt("created_at", to.toISOString()),
    admin.from("tutor_observations").select("tutor_id, scores, observed_on").in("tutor_id", tutorIds).order("observed_on", { ascending: false }),
  ]);

  return (profiles ?? [])
    .filter((p) => p.status === "active" || (batches ?? []).some((b) => b.tutor_id === p.id))
    .map((p) => {
      const own = (batches ?? []).filter((b) => b.tutor_id === p.id).map((b) => b.id as string);
      const attendanceR: Ratio = { onTime: 0, total: 0 };
      const assessmentR: Ratio = { onTime: 0, total: 0 };
      const reportR: Ratio = { onTime: 0, total: 0 };
      let returned = 0;

      for (const batchId of own) {
        const bs = sessions.filter((s) => s.batch_id === batchId);
        // Absensi: diisi paling lambat 24 jam setelah sesi berakhir.
        for (const s of bs) {
          const due = sessionEnd(s) + ATTENDANCE_WINDOW_HOURS * HOUR;
          if (!inRange(sessionEnd(s)) || due > now) continue;
          attendanceR.total += 1;
          if (s.attendance_done_at && Date.parse(s.attendance_done_at) <= due) attendanceR.onTime += 1;
        }
        // Assessment: dinilai paling lambat 48 jam setelah sesi assessment (siswa susulan tidak dihitung).
        const points = pointsOf(bs, kinds);
        const roster = (enrollments ?? []).filter((e) => e.batch_id === batchId);
        for (const point of points) {
          for (const e of roster) {
            const att = (attendance ?? []).find((a) => a.session_id === point.session.id && a.student_id === e.student_id)?.status as AttendanceStatus | undefined;
            if (att === "absent" || att === "excused") continue;
            const due = assessmentDue(point, points, bs, false);
            if (!inRange(sessionEnd(point.session)) || due > now) continue;
            assessmentR.total += 1;
            const a = (assessments ?? []).find((x) => x.batch_id === batchId && x.student_id === e.student_id && x.kind === point.kind);
            if (a?.status === "published" && a.published_at && Date.parse(a.published_at) <= due) assessmentR.onTime += 1;
          }
        }
        // Laporan: diajukan paling lambat 3 hari setelah sesi terakhir.
        if (bs.length && points.some((pt) => pt.kind === "final")) {
          const due = reportDue(bs);
          const lastEnd = Math.max(...bs.map(sessionEnd));
          if (inRange(lastEnd) && due <= now) {
            for (const e of roster) {
              reportR.total += 1;
              const r = (reports ?? []).find((x) => x.enrollment_id === e.id);
              if (r?.submitted_at && Date.parse(r.submitted_at) <= due) reportR.onTime += 1;
            }
          }
        }
        returned += (reports ?? []).filter((r) => r.batch_id === batchId && inRange(lastSubmitted(r.submitted_at))).reduce((n, r) => n + (r.return_count ?? 0), 0);
      }

      const fb = (feedback ?? []).filter((f) => f.tutor_id === p.id);
      const hours = fb
        .map((f) => {
          const sub = f.submission as unknown as { submitted_at: string } | null;
          return sub && f.published_at ? (Date.parse(f.published_at) - Date.parse(sub.submitted_at)) / HOUR : null;
        })
        .filter((h): h is number => h !== null && h >= 0);
      const sv = (surveys ?? []).filter((s) => s.tutor_id === p.id).map((s) => s.rating as number);
      const obs = (observations ?? []).filter((o) => o.tutor_id === p.id);
      const obsInRange = obs.filter((o) => inRange(Date.parse(`${o.observed_on}T12:00:00+07:00`)));

      return {
        tutor: { id: p.id as string, full_name: p.full_name as string, email: p.email as string },
        batches: own.length,
        attendance: attendanceR,
        assessment: assessmentR,
        report: reportR,
        returned,
        feedbackHours: avg(hours),
        feedbackCount: hours.length,
        survey: { average: avg(sv), count: sv.length },
        observation: { average: avg(obsInRange.map(observationScore)), count: obsInRange.length, last: obs[0]?.observed_on ?? null },
      };
    })
    .sort((a, b) => a.tutor.full_name.localeCompare(b.tutor.full_name));
}

const lastSubmitted = (iso: string | null) => (iso ? Date.parse(iso) : 0);

export function observationScore(o: { scores: unknown }) {
  const s = (o.scores ?? {}) as Record<string, number>;
  return avg(Object.keys(OBSERVATION_ASPECTS).map((k) => s[k]).filter((v) => typeof v === "number")) ?? 0;
}

// ---------------------------------------------------------------------------
// Detail satu tutor
// ---------------------------------------------------------------------------

export type ObservationRow = { id: string; observed_on: string; scores: Record<ObservationAspect, number>; strengths: string; improvements: string; batch: string; observer: string };
export type TutorDetail = {
  tutor: { id: string; full_name: string; email: string };
  batches: { id: string; code: string; status: string; program: string }[];
  observations: ObservationRow[];
  survey: { average: number | null; count: number; distribution: number[]; comments: string[] };
};

export async function tutorDetail(tutorId: string): Promise<TutorDetail | null> {
  const admin = createAdminClient();
  const [{ data: tutor }, { data: isTutor }] = await Promise.all([
    admin.from("profiles").select("id, full_name, email").eq("id", tutorId).maybeSingle(),
    admin.from("user_roles").select("role").eq("user_id", tutorId).eq("role", "tutor").maybeSingle(),
  ]);
  if (!tutor || !isTutor) return null;
  const [{ data: batches }, { data: observations }, { data: surveys }] = await Promise.all([
    admin.from("batches").select("id, code, status, program:programs(name)").eq("tutor_id", tutorId).neq("status", "cancelled").order("start_date", { ascending: false }),
    admin
      .from("tutor_observations")
      .select("id, observed_on, scores, strengths, improvements, batch:batches(code), observer:profiles!tutor_observations_observed_by_fkey(full_name)")
      .eq("tutor_id", tutorId)
      .order("observed_on", { ascending: false }),
    admin.from("tutor_surveys").select("rating, comment").eq("tutor_id", tutorId),
  ]);
  const ratings = (surveys ?? []).map((s) => s.rating as number);
  // Komentar tanpa nama, batch, atau tanggal, diurutkan alfabetis agar tidak bisa dicocokkan dengan siswa.
  const comments = (surveys ?? [])
    .map((s) => s.comment as string)
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b));
  return {
    tutor: tutor as TutorDetail["tutor"],
    batches: (batches ?? []).map((b) => ({ id: b.id, code: b.code, status: b.status, program: (b.program as unknown as { name: string }).name })),
    observations: (observations ?? []).map((o) => ({
      id: o.id,
      observed_on: o.observed_on,
      scores: o.scores as Record<ObservationAspect, number>,
      strengths: o.strengths,
      improvements: o.improvements,
      batch: (o.batch as unknown as { code: string } | null)?.code ?? "",
      observer: (o.observer as unknown as { full_name: string } | null)?.full_name ?? "",
    })),
    survey: { average: avg(ratings), count: ratings.length, distribution: [1, 2, 3, 4, 5].map((n) => ratings.filter((r) => r === n).length), comments },
  };
}

export async function saveObservation(batchId: string, input: { observedOn: string; scores: Record<string, number>; strengths: string; improvements: string }) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.observedOn)) throw new ClassError("Isi tanggal observasi.");
  const supabase = await createClient();
  const { error } = await supabase.rpc("save_observation", {
    p_batch: batchId,
    p_observed_on: input.observedOn,
    p_scores: input.scores,
    p_strengths: input.strengths,
    p_improvements: input.improvements,
  });
  if (error) dbError(error, "Observasi gagal disimpan.");
}

// ---------------------------------------------------------------------------
// Survei siswa
// ---------------------------------------------------------------------------

// Kelas selesai yang belum dinilai, untuk siswa/wali.
export async function pendingSurveys(studentIds: string[]) {
  if (!studentIds.length) return [];
  const admin = createAdminClient();
  const { data: enr } = await admin
    .from("enrollments")
    .select("id, student:students(full_name), batch:batches(code, status, tutor:profiles!batches_tutor_id_fkey(full_name), program:programs(name))")
    .in("student_id", studentIds)
    .eq("status", "completed");
  const ids = (enr ?? []).map((e) => e.id as string);
  const { data: done } = ids.length ? await admin.from("tutor_surveys").select("enrollment_id").in("enrollment_id", ids) : { data: [] };
  return (enr ?? [])
    .filter((e) => !(done ?? []).some((d) => d.enrollment_id === e.id))
    .map((e) => {
      const b = e.batch as unknown as { code: string; tutor: { full_name: string } | null; program: { name: string } };
      return { enrollmentId: e.id as string, student: (e.student as unknown as { full_name: string }).full_name, program: b.program.name, batch: b.code, tutor: b.tutor?.full_name ?? "" };
    })
    .filter((s) => s.tutor);
}

export async function submitSurvey(enrollmentId: string, rating: number, comment: string) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("submit_tutor_survey", { p_enrollment: enrollmentId, p_rating: rating, p_comment: comment });
  if (error) dbError(error, "Penilaian gagal dikirim.");
}

export async function observableBatches() {
  const { data } = await createAdminClient()
    .from("batches")
    .select("id, code, status, tutor_id, program:programs(name)")
    .not("tutor_id", "is", null)
    .in("status", ["running", "completed"])
    .order("start_date", { ascending: false })
    .limit(100);
  return (data ?? []).map((b) => ({ id: b.id as string, code: b.code as string, tutorId: b.tutor_id as string, program: (b.program as unknown as { name: string }).name, status: b.status as string }));
}
