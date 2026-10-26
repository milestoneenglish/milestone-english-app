import "server-only";
import { ASSESSMENT_KINDS, type AssessmentKind, type Indicator, type ReportSummary } from "@/lib/academic";
import { ClassError, dbError, getBatch, type BatchRow } from "@/lib/classes";
import { rubricOf } from "@/lib/curriculum";
import { activeRoster, learnerClasses, sessionEnd, sessionsOf, syncBatches, type AttendanceStatus, type ClassSession, type LearnerClass, type SubmissionRow } from "@/lib/learning";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

// Assessment awal, tengah, dan akhir per siswa. Titik assessment ditentukan kurikulum (sesi bertanda);
// tutor menilai paling lambat 48 jam setelah sesi itu. Siswa yang tidak hadir dinilai susulan di sesi
// berikutnya yang ia hadiri, sebelum titik assessment selanjutnya.

const HOUR = 3600 * 1000;
export const ASSESSMENT_WINDOW_HOURS = 48;
export const REPORT_WINDOW_DAYS = 3;

export type AssessmentRow = {
  id: string;
  batch_id: string;
  student_id: string;
  kind: AssessmentKind;
  scores: Record<string, number>;
  note: string;
  status: "draft" | "published";
  published_at: string | null;
  updated_at: string;
};

const ASSESSMENT_COLUMNS = "id, batch_id, student_id, kind, scores, note, status, published_at, updated_at";

export type AssessmentPoint = { kind: AssessmentKind; session: ClassSession };

// Titik assessment sebuah batch: sesi yang modulnya bertanda baseline/tengah/akhir.
export function pointsOf(sessions: ClassSession[], modules: { id: string; assessment: AssessmentKind | null }[]): AssessmentPoint[] {
  return ASSESSMENT_KINDS.flatMap((kind) => {
    const mod = modules.find((m) => m.assessment === kind);
    const session = mod && sessions.find((s) => s.module_id === mod.id);
    return session ? [{ kind, session }] : [];
  });
}

async function moduleKinds(moduleIds: string[]) {
  if (!moduleIds.length) return [];
  const { data } = await createAdminClient().from("curriculum_modules").select("id, assessment").in("id", moduleIds).not("assessment", "is", null);
  return (data ?? []) as { id: string; assessment: AssessmentKind }[];
}

// Batas tutor menilai: 48 jam setelah sesi assessment. Susulan: sampai titik berikutnya dimulai,
// atau batas laporan untuk assessment akhir.
export function assessmentDue(point: AssessmentPoint, points: AssessmentPoint[], sessions: ClassSession[], makeup: boolean) {
  if (!makeup) return sessionEnd(point.session) + ASSESSMENT_WINDOW_HOURS * HOUR;
  const next = points.find((p) => p.session.seq > point.session.seq);
  if (next) return Date.parse(next.session.starts_at);
  return reportDue(sessions);
}

export function reportDue(sessions: { starts_at: string; duration_minutes: number }[]) {
  const last = sessions.reduce((max, s) => Math.max(max, sessionEnd(s)), 0);
  return last + REPORT_WINDOW_DAYS * 24 * HOUR;
}

const MISSED: AttendanceStatus[] = ["absent", "excused"];

// ---------------------------------------------------------------------------
// Tutor
// ---------------------------------------------------------------------------

export type QueueStudent = {
  student_id: string;
  full_name: string;
  state: "todo" | "draft" | "published";
  makeup: boolean;
  due: number;
  overdue: boolean;
};

export type AssessmentQueueItem = {
  batch: { id: string; code: string; program: string; status: string };
  kind: AssessmentKind;
  session: ClassSession;
  students: QueueStudent[];
};

export async function tutorAssessmentQueue(tutorId: string): Promise<AssessmentQueueItem[]> {
  await syncBatches();
  const admin = createAdminClient();
  const { data: batches } = await admin
    .from("batches")
    .select("id, code, status, program:programs(name)")
    .eq("tutor_id", tutorId)
    .not("curriculum_id", "is", null)
    .in("status", ["open", "running", "completed"]);
  const ids = (batches ?? []).map((b) => b.id as string);
  if (!ids.length) return [];
  const sessions = await sessionsOf(ids);
  const [kinds, { data: assessments }, { data: attendance }, rosters] = await Promise.all([
    moduleKinds([...new Set(sessions.map((s) => s.module_id).filter(Boolean) as string[])]),
    admin.from("assessments").select("batch_id, student_id, kind, status").in("batch_id", ids),
    admin.from("attendance").select("session_id, student_id, status").in("session_id", sessions.length ? sessions.map((s) => s.id) : ["00000000-0000-0000-0000-000000000000"]),
    Promise.all(ids.map((id) => activeRoster(id))),
  ]);
  const now = Date.now();
  const items: AssessmentQueueItem[] = [];
  (batches ?? []).forEach((b, i) => {
    const own = sessions.filter((s) => s.batch_id === b.id);
    const points = pointsOf(own, kinds);
    for (const point of points) {
      if (Date.parse(point.session.starts_at) > now) continue;
      const students = rosters[i].map((r) => {
        const a = (assessments ?? []).find((x) => x.batch_id === b.id && x.student_id === r.student_id && x.kind === point.kind);
        const att = (attendance ?? []).find((x) => x.session_id === point.session.id && x.student_id === r.student_id)?.status as AttendanceStatus | undefined;
        const makeup = Boolean(att && MISSED.includes(att));
        const due = assessmentDue(point, points, own, makeup);
        const state: QueueStudent["state"] = (a?.status as "draft" | "published" | undefined) ?? "todo";
        return { student_id: r.student_id, full_name: r.full_name, state, makeup, due, overdue: state !== "published" && now > due };
      });
      items.push({
        batch: { id: b.id, code: b.code, status: b.status, program: (b.program as unknown as { name: string }).name },
        kind: point.kind,
        session: point.session,
        students,
      });
    }
  });
  return items;
}

export function queueCounts(items: AssessmentQueueItem[]) {
  const pending = items.flatMap((i) => i.students.filter((s) => s.state !== "published"));
  return { pending: pending.length, overdue: pending.filter((s) => s.overdue).length, makeup: pending.filter((s) => s.makeup).length };
}

export type AssessmentSheet = {
  batch: BatchRow;
  kind: AssessmentKind;
  session: ClassSession;
  indicators: Indicator[];
  students: (QueueStudent & { assessment: AssessmentRow | null; attendance: AttendanceStatus | null; locked: boolean })[];
};

// Lembar penilaian satu titik assessment untuk semua siswa batch.
export async function assessmentSheet(batchId: string, kind: AssessmentKind, tutorId: string): Promise<AssessmentSheet | null> {
  const batch = await getBatch(batchId);
  if (!batch || batch.tutor_id !== tutorId || !batch.curriculum_id) return null;
  const admin = createAdminClient();
  const sessions = await sessionsOf([batch.id]);
  const kinds = await moduleKinds(sessions.map((s) => s.module_id).filter(Boolean) as string[]);
  const points = pointsOf(sessions, kinds);
  const point = points.find((p) => p.kind === kind);
  if (!point) return null;
  const [indicators, roster, { data: assessments }, { data: attendance }, { data: reports }] = await Promise.all([
    rubricOf([batch.curriculum_id]),
    activeRoster(batch.id),
    admin.from("assessments").select(ASSESSMENT_COLUMNS).eq("batch_id", batch.id).eq("kind", kind),
    admin.from("attendance").select("student_id, status").eq("session_id", point.session.id),
    admin.from("reports").select("student_id, status").eq("batch_id", batch.id),
  ]);
  const now = Date.now();
  return {
    batch,
    kind,
    session: point.session,
    indicators,
    students: roster.map((r) => {
      const a = ((assessments ?? []) as AssessmentRow[]).find((x) => x.student_id === r.student_id) ?? null;
      const att = ((attendance ?? []).find((x) => x.student_id === r.student_id)?.status as AttendanceStatus | undefined) ?? null;
      const makeup = Boolean(att && MISSED.includes(att));
      const due = assessmentDue(point, points, sessions, makeup);
      const state = a?.status ?? "todo";
      const report = (reports ?? []).find((x) => x.student_id === r.student_id);
      return {
        student_id: r.student_id,
        full_name: r.full_name,
        state,
        makeup,
        due,
        overdue: state !== "published" && now > due,
        assessment: a,
        attendance: att,
        locked: report?.status === "submitted" || report?.status === "published",
      };
    }),
  };
}

export type AssessmentInput = { batchId: string; studentId: string; kind: AssessmentKind; scores: Record<string, number>; note: string; publish: boolean };

export async function saveAssessment(input: AssessmentInput) {
  if (!ASSESSMENT_KINDS.includes(input.kind)) throw new ClassError("Jenis assessment tidak valid.");
  const supabase = await createClient();
  const { error } = await supabase.rpc("save_assessment", {
    p_batch: input.batchId,
    p_student: input.studentId,
    p_kind: input.kind,
    p_scores: Object.fromEntries(Object.entries(input.scores).map(([k, v]) => [k, String(v)])),
    p_note: input.note.slice(0, 2000),
    p_publish: input.publish,
  });
  if (error) dbError(error, "Assessment gagal disimpan.");
}

// ---------------------------------------------------------------------------
// Progres siswa: nilai terbit per indikator, bukti awal dan terbaru, kehadiran, tugas
// ---------------------------------------------------------------------------

export type Evidence = { title: string; version: SubmissionRow } | null;

export type ClassProgress = {
  cls: LearnerClass;
  points: AssessmentPoint[];
  summary: ReportSummary;
  evidence: { baseline: Evidence; latest: Evidence };
};

function firstVersion(cls: LearnerClass, sessionId: string | undefined, pick: "first" | "last"): Evidence {
  if (!sessionId) return null;
  const list = cls.assignments.filter((a) => a.session_id === sessionId && a.versions.length);
  if (!list.length) return null;
  const a = list[0];
  const v = pick === "first" ? a.versions[0] : a.versions[a.versions.length - 1];
  return { title: a.title, version: v };
}

function latestVersion(cls: LearnerClass): Evidence {
  const all = cls.assignments.flatMap((a) => a.versions.map((v) => ({ title: a.title, version: v })));
  return all.sort((x, y) => y.version.submitted_at.localeCompare(x.version.submitted_at))[0] ?? null;
}

export function summarize(cls: LearnerClass, studentName: string, indicators: Indicator[], assessments: AssessmentRow[], points: AssessmentPoint[]): ReportSummary {
  const { batch } = cls.enrollment;
  const started = cls.sessions.filter((s) => Date.parse(s.starts_at) <= Date.now());
  const count = (st: AttendanceStatus) => started.filter((s) => s.attendance === st).length;
  const published = assessments.filter((a) => a.status === "published");
  return {
    student: studentName,
    program: batch.program.name,
    programCode: batch.program.code,
    outcome: batch.program.outcome,
    batch: batch.code,
    tutor: batch.tutor?.full_name ?? "-",
    period: { start: cls.sessions[0]?.starts_at ?? null, end: cls.sessions[cls.sessions.length - 1]?.starts_at ?? null },
    kinds: points.map((p) => p.kind),
    indicators: indicators.map((ind) => ({
      id: ind.id,
      skill: ind.skill,
      label: ind.label,
      scores: Object.fromEntries(published.filter((a) => typeof a.scores[ind.id] === "number").map((a) => [a.kind, a.scores[ind.id]])),
    })),
    notes: Object.fromEntries(published.filter((a) => a.note).map((a) => [a.kind, a.note])),
    attendance: { sessions: started.length, present: count("present"), late: count("late"), excused: count("excused"), absent: count("absent") },
    tasks: {
      total: cls.assignments.length,
      done: cls.assignments.filter((a) => a.state === "done").length,
      submitted: cls.assignments.filter((a) => a.versions.length > 0).length,
      late: cls.assignments.filter((a) => a.versions[0]?.is_late).length,
    },
  };
}

// Progres semua kelas (aktif dan selesai) seorang siswa. Hanya nilai yang sudah terbit.
export async function learnerProgress(studentId: string, studentName: string): Promise<ClassProgress[]> {
  const classes = (await learnerClasses(studentId)).filter((c) => c.enrollment.batch.curriculum_id);
  if (!classes.length) return [];
  const admin = createAdminClient();
  const [indicators, { data: assessments }] = await Promise.all([
    rubricOf(classes.map((c) => c.enrollment.batch.curriculum_id!)),
    admin
      .from("assessments")
      .select(ASSESSMENT_COLUMNS)
      .eq("student_id", studentId)
      .eq("status", "published")
      .in("batch_id", classes.map((c) => c.enrollment.batch.id)),
  ]);
  return classes.map((cls) => {
    const points = pointsOf(cls.sessions, cls.modules);
    const own = ((assessments ?? []) as AssessmentRow[]).filter((a) => a.batch_id === cls.enrollment.batch.id);
    const baselineSession = points.find((p) => p.kind === "baseline")?.session.id;
    const finalSession = points.find((p) => p.kind === "final")?.session.id;
    return {
      cls,
      points,
      summary: summarize(cls, studentName, indicators.filter((i) => i.curriculum_id === cls.enrollment.batch.curriculum_id), own, points),
      evidence: { baseline: firstVersion(cls, baselineSession, "first"), latest: firstVersion(cls, finalSession, "last") ?? latestVersion(cls) },
    };
  });
}
