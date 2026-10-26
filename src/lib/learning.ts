import "server-only";
import { ClassError, dbError, getBatch, studentEnrollments, type EnrollmentView } from "@/lib/classes";
import { modulesById, type ModuleRow, type SubmissionType } from "@/lib/curriculum";
import { guardianRecipients, notify, studentRecipients } from "@/lib/notify";
import { BUCKETS, fileExists, fileExtension, signedDownload, signedUpload } from "@/lib/storage";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

// Kelas berjalan: sesi, absensi, tugas, pengumpulan, dan feedback. Perubahan status lewat
// fungsi database dengan sesi pengguna; bacaan memakai klien admin setelah akses diperiksa.

const DATETIME_FMT = new Intl.DateTimeFormat("id-ID", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Jakarta" });
export const whenLabel = (iso: string) => `${DATETIME_FMT.format(new Date(iso))} WIB`;

export async function syncBatches() {
  await createAdminClient().rpc("sync_batch_status");
}

export type AttendanceStatus = "present" | "late" | "excused" | "absent";
export const ATTENDANCE_LABEL: Record<AttendanceStatus, string> = { present: "Hadir", late: "Terlambat", excused: "Izin", absent: "Tidak hadir" };

export type ClassSession = {
  id: string;
  batch_id: string;
  seq: number;
  starts_at: string;
  duration_minutes: number;
  topic: string;
  module_id: string | null;
  tutor_note: string;
  attendance_done_at: string | null;
};

const SESSION_COLUMNS = "id, batch_id, seq, starts_at, duration_minutes, topic, module_id, tutor_note, attendance_done_at";

export const sessionEnd = (s: { starts_at: string; duration_minutes: number }) => Date.parse(s.starts_at) + s.duration_minutes * 60000;

export async function sessionsOf(batchIds: string[]): Promise<ClassSession[]> {
  if (!batchIds.length) return [];
  const { data } = await createAdminClient().from("class_sessions").select(SESSION_COLUMNS).in("batch_id", batchIds).order("starts_at");
  return (data ?? []) as ClassSession[];
}

export type AssignmentRow = {
  id: string;
  batch_id: string;
  session_id: string | null;
  module_task_id: string | null;
  title: string;
  instructions: string;
  submission_type: SubmissionType;
  due_at: string;
  created_at: string;
};

const ASSIGNMENT_COLUMNS = "id, batch_id, session_id, module_task_id, title, instructions, submission_type, due_at, created_at";

export type FeedbackRow = { submission_id: string; body: string; decision: "accepted" | "revision"; status: "draft" | "published"; published_at: string | null; updated_at: string };
export type SubmissionRow = {
  id: string;
  assignment_id: string;
  student_id: string;
  version: number;
  text_answer: string | null;
  file_path: string | null;
  mime: string | null;
  is_late: boolean;
  status: "submitted" | "revision_requested" | "accepted";
  submitted_at: string;
  feedback: FeedbackRow | null;
};

const SUBMISSION_COLUMNS = "id, assignment_id, student_id, version, text_answer, file_path, mime, is_late, status, submitted_at";

// Semua versi pengumpulan untuk tugas-tugas tertentu. Feedback draf hanya disertakan untuk tutor.
async function submissionsFor(assignmentIds: string[], opts: { studentIds?: string[]; includeDrafts: boolean }): Promise<SubmissionRow[]> {
  if (!assignmentIds.length) return [];
  const admin = createAdminClient();
  let q = admin.from("submissions").select(SUBMISSION_COLUMNS).in("assignment_id", assignmentIds).order("version");
  if (opts.studentIds) q = q.in("student_id", opts.studentIds);
  const { data } = await q;
  const rows = (data ?? []) as Omit<SubmissionRow, "feedback">[];
  if (!rows.length) return [];
  const { data: fb } = await admin.from("feedback").select("submission_id, body, decision, status, published_at, updated_at").in("submission_id", rows.map((r) => r.id));
  return rows.map((r) => {
    const f = (fb ?? []).find((x) => x.submission_id === r.id) as FeedbackRow | undefined;
    return { ...r, feedback: f && (opts.includeDrafts || f.status === "published") ? f : null };
  });
}

export type TaskState = "todo" | "waiting" | "revision" | "done";

export function taskState(versions: SubmissionRow[]): TaskState {
  const last = versions[versions.length - 1];
  if (!last) return "todo";
  if (last.status === "accepted") return "done";
  if (last.status === "revision_requested") return "revision";
  return "waiting";
}

// ---------------------------------------------------------------------------
// Tutor
// ---------------------------------------------------------------------------

export async function tutorBatchIds(tutorId: string) {
  const { data } = await createAdminClient().from("batches").select("id").eq("tutor_id", tutorId).in("status", ["open", "running", "completed"]);
  return (data ?? []).map((b) => b.id as string);
}

export type TutorSession = ClassSession & { batch: { id: string; code: string; status: string; meeting_url: string | null; program: { name: string } }; module_title: string | null };

export async function tutorSessions(tutorId: string): Promise<TutorSession[]> {
  await syncBatches();
  const admin = createAdminClient();
  const { data: batches } = await admin.from("batches").select("id, code, status, meeting_url, program:programs(name)").eq("tutor_id", tutorId).in("status", ["open", "running", "completed"]);
  const sessions = await sessionsOf((batches ?? []).map((b) => b.id));
  const moduleIds = [...new Set(sessions.map((s) => s.module_id).filter(Boolean) as string[])];
  const { data: modules } = moduleIds.length ? await admin.from("curriculum_modules").select("id, title").in("id", moduleIds) : { data: [] };
  return sessions.map((s) => ({
    ...s,
    batch: (batches ?? []).find((b) => b.id === s.batch_id) as unknown as TutorSession["batch"],
    module_title: (modules ?? []).find((m) => m.id === s.module_id)?.title ?? null,
  }));
}

export type RosterStudent = { student_id: string; full_name: string; enrollment_status: string; has_account: boolean };

export async function activeRoster(batchId: string): Promise<RosterStudent[]> {
  const { data } = await createAdminClient()
    .from("enrollments")
    .select("status, student:students(id, full_name, user_id)")
    .eq("batch_id", batchId)
    .in("status", ["active", "completed"])
    .order("created_at");
  return (data ?? []).map((e) => {
    const s = e.student as unknown as { id: string; full_name: string; user_id: string | null };
    return { student_id: s.id, full_name: s.full_name, enrollment_status: e.status, has_account: Boolean(s.user_id) };
  });
}

export async function sessionDetail(sessionId: string, tutorId: string) {
  const { data: session } = await createAdminClient().from("class_sessions").select(SESSION_COLUMNS).eq("id", sessionId).maybeSingle();
  if (!session) return null;
  const batch = await getBatch(session.batch_id);
  if (!batch || batch.tutor_id !== tutorId) return null;
  const admin = createAdminClient();
  const [modules, roster, { data: attendance }, { data: assignments }, sessions] = await Promise.all([
    session.module_id ? modulesById([session.module_id]) : Promise.resolve([] as ModuleRow[]),
    activeRoster(batch.id),
    admin.from("attendance").select("student_id, status, note").eq("session_id", sessionId),
    admin.from("assignments").select(ASSIGNMENT_COLUMNS).eq("session_id", sessionId).order("created_at"),
    sessionsOf([batch.id]),
  ]);
  const next = sessions.find((s) => s.seq === session.seq + 1) ?? null;
  return {
    session: session as ClassSession,
    batch,
    module: modules[0] ?? null,
    roster,
    attendance: (attendance ?? []) as { student_id: string; status: AttendanceStatus; note: string }[],
    assignments: (assignments ?? []) as AssignmentRow[],
    nextSession: next,
  };
}

export type AttendanceEntry = { studentId: string; status: AttendanceStatus; note: string };

export async function recordAttendance(sessionId: string, entries: AttendanceEntry[], note: string) {
  const admin = createAdminClient();
  const { data: before } = await admin.from("attendance").select("student_id, status").eq("session_id", sessionId);
  const supabase = await createClient();
  const { error } = await supabase.rpc("record_attendance", {
    p_session: sessionId,
    p_entries: entries.map((e) => ({ student_id: e.studentId, status: e.status, note: e.note.trim().slice(0, 300) })),
    p_note: note,
  });
  if (error) dbError(error, "Absensi gagal disimpan.");

  // Wali hanya diberi kabar sekali, saat anak pertama kali tercatat tidak hadir di sesi ini.
  const newlyAbsent = entries.filter((e) => e.status === "absent" && before?.find((b) => b.student_id === e.studentId)?.status !== "absent");
  if (!newlyAbsent.length) return;
  const { data: s } = await admin.from("class_sessions").select("seq, starts_at, batch:batches(program:programs(name))").eq("id", sessionId).single();
  const program = (s?.batch as unknown as { program: { name: string } } | null)?.program.name ?? "";
  const { data: students } = await admin.from("students").select("id, full_name").in("id", newlyAbsent.map((e) => e.studentId));
  for (const st of students ?? []) {
    await notify("attendance_absent", await guardianRecipients(st.id), { name: st.full_name, session: s ? `Sesi ${s.seq} · ${whenLabel(s.starts_at)}` : "sesi terakhir", program }, { type: "class_sessions", id: sessionId });
  }
}

export type AssignmentInput = { sessionId: string; taskId: string | null; title: string; instructions: string; type: SubmissionType; dueAt: string };

export async function publishAssignment(input: AssignmentInput) {
  const due = new Date(input.dueAt);
  if (Number.isNaN(due.getTime())) throw new ClassError("Isi tenggat tugas.");
  const supabase = await createClient();
  const { data: id, error } = await supabase.rpc("publish_assignment", {
    p_session: input.sessionId,
    p_task: input.taskId,
    p_title: input.title,
    p_instructions: input.instructions,
    p_type: input.type,
    p_due: due.toISOString(),
  });
  if (error || !id) dbError(error, "Tugas gagal diterbitkan.");
  const admin = createAdminClient();
  const { data: a } = await admin.from("assignments").select("batch_id, title, due_at, batch:batches(program:programs(name))").eq("id", id).single();
  if (a) {
    const roster = await activeRoster(a.batch_id);
    const recipients = (await Promise.all(roster.filter((r) => r.enrollment_status === "active").map((r) => studentRecipients(r.student_id)))).flat();
    await notify("assignment_published", recipients, { title: a.title, program: (a.batch as unknown as { program: { name: string } }).program.name, due: whenLabel(a.due_at) }, { type: "assignments", id: id as string });
  }
  return id as string;
}

export type TutorAssignment = AssignmentRow & { batch_code: string; program: string; students: number; waiting: number; done: number; notSubmitted: number };

export async function tutorAssignments(tutorId: string): Promise<TutorAssignment[]> {
  const admin = createAdminClient();
  const { data: batches } = await admin.from("batches").select("id, code, program:programs(name)").eq("tutor_id", tutorId);
  const ids = (batches ?? []).map((b) => b.id);
  if (!ids.length) return [];
  const [{ data: assignments }, { data: enrollments }] = await Promise.all([
    admin.from("assignments").select(ASSIGNMENT_COLUMNS).in("batch_id", ids).order("due_at", { ascending: false }),
    admin.from("enrollments").select("batch_id, student_id").in("batch_id", ids).in("status", ["active", "completed"]),
  ]);
  const list = (assignments ?? []) as AssignmentRow[];
  const subs = await submissionsFor(list.map((a) => a.id), { includeDrafts: true });
  return list.map((a) => {
    const b = (batches ?? []).find((x) => x.id === a.batch_id)!;
    const students = (enrollments ?? []).filter((e) => e.batch_id === a.batch_id).map((e) => e.student_id);
    const states = students.map((sid) => taskState(subs.filter((s) => s.assignment_id === a.id && s.student_id === sid)));
    return {
      ...a,
      batch_code: b.code,
      program: (b.program as unknown as { name: string }).name,
      students: students.length,
      waiting: states.filter((s) => s === "waiting").length,
      done: states.filter((s) => s === "done").length,
      notSubmitted: states.filter((s) => s === "todo").length,
    };
  });
}

export async function assignmentDetail(assignmentId: string, tutorId: string) {
  const { data: a } = await createAdminClient().from("assignments").select(ASSIGNMENT_COLUMNS).eq("id", assignmentId).maybeSingle();
  if (!a) return null;
  const batch = await getBatch(a.batch_id);
  if (!batch || batch.tutor_id !== tutorId) return null;
  const [roster, subs] = await Promise.all([activeRoster(batch.id), submissionsFor([assignmentId], { includeDrafts: true })]);
  return {
    assignment: a as AssignmentRow,
    batch,
    students: roster.map((r) => {
      const versions = subs.filter((s) => s.student_id === r.student_id);
      return { ...r, versions, state: taskState(versions) };
    }),
  };
}

export async function saveFeedback(submissionId: string, body: string, decision: "accepted" | "revision", publish: boolean) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("save_feedback", { p_submission: submissionId, p_body: body, p_decision: decision, p_publish: publish });
  if (error) dbError(error, "Feedback gagal disimpan.");
  if (!publish) return;
  const { data: s } = await createAdminClient().from("submissions").select("student_id, assignment:assignments(title)").eq("id", submissionId).single();
  if (s) await notify("feedback_published", await studentRecipients(s.student_id), { title: (s.assignment as unknown as { title: string }).title, decision }, { type: "submissions", id: submissionId });
}

// File pengumpulan dibuka oleh pemilik data, tutor batch, Academic Lead, atau Owner (dicek RLS sesi pengguna).
export async function submissionFileUrl(submissionId: string) {
  const supabase = await createClient();
  const { data } = await supabase.from("submissions").select("file_path").eq("id", submissionId).maybeSingle();
  return data?.file_path ? signedDownload("submissions", data.file_path) : null;
}

export async function tutorQueue(tutorId: string) {
  const sessions = await tutorSessions(tutorId);
  const now = Date.now();
  const started = sessions.filter((s) => Date.parse(s.starts_at) <= now && !s.attendance_done_at);
  const assignments = await tutorAssignments(tutorId);
  return {
    attendancePending: started,
    attendanceOverdue: started.filter((s) => sessionEnd(s) + 24 * 3600 * 1000 < now).length,
    toReview: assignments.reduce((n, a) => n + a.waiting, 0),
    upcoming: sessions.filter((s) => sessionEnd(s) > now).slice(0, 5),
    assignments,
  };
}

// ---------------------------------------------------------------------------
// Siswa dan wali
// ---------------------------------------------------------------------------

export type StudentAssignment = AssignmentRow & { versions: SubmissionRow[]; state: TaskState };
export type LearnerClass = {
  enrollment: EnrollmentView & { student_id: string };
  sessions: (ClassSession & { attendance: AttendanceStatus | null })[];
  modules: ModuleRow[];
  assignments: StudentAssignment[];
};

// Kelas aktif dan selesai seorang siswa beserta jadwal, kehadiran, materi, dan tugas.
export async function learnerClasses(studentId: string): Promise<LearnerClass[]> {
  const enrollments = (await studentEnrollments([studentId])).filter((e) => e.status === "active" || e.status === "completed");
  if (!enrollments.length) return [];
  const admin = createAdminClient();
  const batchIds = enrollments.map((e) => e.batch.id);
  const sessions = await sessionsOf(batchIds);
  const [{ data: attendance }, { data: assignments }, modules] = await Promise.all([
    admin.from("attendance").select("session_id, status").eq("student_id", studentId).in("session_id", sessions.length ? sessions.map((s) => s.id) : ["00000000-0000-0000-0000-000000000000"]),
    admin.from("assignments").select(ASSIGNMENT_COLUMNS).in("batch_id", batchIds).order("due_at"),
    modulesById([...new Set(sessions.map((s) => s.module_id).filter(Boolean) as string[])]),
  ]);
  const list = (assignments ?? []) as AssignmentRow[];
  const subs = await submissionsFor(list.map((a) => a.id), { studentIds: [studentId], includeDrafts: false });
  return enrollments.map((enrollment) => {
    const own = sessions.filter((s) => s.batch_id === enrollment.batch.id);
    return {
      enrollment,
      sessions: own.map((s) => ({ ...s, attendance: ((attendance ?? []).find((a) => a.session_id === s.id)?.status as AttendanceStatus) ?? null })),
      modules: modules.filter((m) => own.some((s) => s.module_id === m.id)),
      assignments: list
        .filter((a) => a.batch_id === enrollment.batch.id)
        .map((a) => {
          const versions = subs.filter((s) => s.assignment_id === a.id);
          return { ...a, versions, state: taskState(versions) };
        }),
    };
  });
}

// Ringkasan "Minggu ini" untuk beranda: sesi berikutnya, tugas yang perlu dikerjakan, feedback baru.
export function weekSummary(classes: LearnerClass[]) {
  const now = Date.now();
  const active = classes.filter((c) => c.enrollment.status === "active");
  const nextSession = active
    .flatMap((c) => c.sessions.map((s) => ({ ...s, cls: c })))
    .filter((s) => sessionEnd(s) > now)
    .sort((a, b) => a.starts_at.localeCompare(b.starts_at))[0];
  const todo = active.flatMap((c) => c.assignments.filter((a) => a.state === "todo" || a.state === "revision").map((a) => ({ ...a, program: c.enrollment.batch.program.name })));
  const weekAgo = now - 7 * 24 * 3600 * 1000;
  const feedback = classes.flatMap((c) =>
    c.assignments.flatMap((a) => a.versions.filter((v) => v.feedback?.published_at && Date.parse(v.feedback.published_at) > weekAgo).map((v) => ({ assignment: a, version: v }))),
  );
  return { nextSession, todo: todo.sort((a, b) => a.due_at.localeCompare(b.due_at)), feedback };
}

// Siswa (atau wali untuk anak tanpa akun) yang sedang masuk boleh mengakses siswa ini (RLS sesi pengguna).
async function ownAssignment(assignmentId: string, studentId: string) {
  const supabase = await createClient();
  const [{ data: student }, { data: assignment }] = await Promise.all([
    supabase.from("students").select("id").eq("id", studentId).maybeSingle(),
    supabase.from("assignments").select("id, submission_type").eq("id", assignmentId).maybeSingle(),
  ]);
  if (!student || !assignment) throw new ClassError("Tugas tidak ditemukan.");
  return assignment as { id: string; submission_type: SubmissionType };
}

export async function submissionUploadTarget(assignmentId: string, studentId: string, mime: string, size: number) {
  await ownAssignment(assignmentId, studentId);
  const ext = fileExtension("submissions", mime);
  if (!ext) throw new ClassError("Unggah PDF, Word, PowerPoint, gambar, atau rekaman audio. Untuk video, tempel link-nya di kolom jawaban.");
  if (size > BUCKETS.submissions.maxBytes) throw new ClassError("Ukuran file maksimal 10 MB. Untuk video, tempel link Google Drive atau YouTube di kolom jawaban.");
  const path = `${assignmentId}/${studentId}/${Date.now()}.${ext}`;
  const token = await signedUpload("submissions", path);
  if (!token) throw new ClassError("File gagal disiapkan untuk diunggah.");
  return { path, token };
}

export type SubmissionInput = { text: string; path: string | null; mime: string | null };

export async function submitAssignment(assignmentId: string, studentId: string, input: SubmissionInput) {
  await ownAssignment(assignmentId, studentId);
  if (input.path && !(await fileExists("submissions", input.path))) throw new ClassError("File belum terunggah. Coba unggah ulang.");
  const supabase = await createClient();
  const { error } = await supabase.rpc("submit_assignment", {
    p_assignment: assignmentId,
    p_student: studentId,
    p_text: input.text.slice(0, 10000),
    p_path: input.path,
    p_mime: input.mime ? input.mime.split(";")[0] : null,
  });
  if (error) dbError(error, "Tugas gagal dikumpulkan. Coba lagi.");
}

// ---------------------------------------------------------------------------
// Pengingat H-1 (dipanggil cron harian)
// ---------------------------------------------------------------------------

export async function sendDueReminders() {
  const admin = createAdminClient();
  await syncBatches();
  const soon = new Date(Date.now() + 36 * 3600 * 1000).toISOString();
  const { data } = await admin
    .from("assignments")
    .select("id, batch_id, title, due_at, batch:batches(status, program:programs(name))")
    .is("reminder_sent_at", null)
    .gt("due_at", new Date().toISOString())
    .lte("due_at", soon);
  let sent = 0;
  for (const a of data ?? []) {
    const batch = a.batch as unknown as { status: string; program: { name: string } };
    if (batch.status !== "running" && batch.status !== "open") continue;
    const [{ data: enrolled }, { data: submitted }] = await Promise.all([
      admin.from("enrollments").select("student_id").eq("batch_id", a.batch_id).eq("status", "active"),
      admin.from("submissions").select("student_id").eq("assignment_id", a.id),
    ]);
    const done = new Set((submitted ?? []).map((s) => s.student_id));
    for (const e of (enrolled ?? []).filter((x) => !done.has(x.student_id))) {
      await notify("assignment_reminder", await studentRecipients(e.student_id), { title: a.title, program: batch.program.name, due: whenLabel(a.due_at) }, { type: "assignments", id: a.id });
      sent += 1;
    }
    await admin.from("assignments").update({ reminder_sent_at: new Date().toISOString() }).eq("id", a.id);
  }
  return sent;
}
