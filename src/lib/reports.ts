import "server-only";
import { overallReportLevel, REPORT_LEVELS, SKILLS, type ReportDocument, type ReportLevel, type ReportStatus, type ReportSummary, type Skill, type SkillLevels } from "@/lib/academic";
import { learnerProgress, queueCounts, reportDue, tutorAssessmentQueue, type ClassProgress } from "@/lib/assessment";
import { ClassError, dbError, getBatch, type BatchRow } from "@/lib/classes";
import { rubricOf } from "@/lib/curriculum";
import { sessionsOf, syncBatches } from "@/lib/learning";
import { notify, roleRecipients, studentRecipients } from "@/lib/notify";
import { renderReportPdf } from "@/lib/report-pdf";
import { signedDownload, uploadFile } from "@/lib/storage";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

// Laporan akhir per siswa: tutor menyusun setelah assessment akhir terbit, Academic Lead meninjau
// lalu menerbitkan (PDF dibuat dan disimpan saat itu) atau mengembalikannya dengan catatan.

const DAY = 24 * 3600 * 1000;
export const REVIEW_WINDOW_DAYS = 2;

export type ReportRow = {
  id: string;
  enrollment_id: string;
  student_id: string;
  batch_id: string;
  status: ReportStatus;
  strengths: string;
  improvements: string;
  levels: SkillLevels;
  recommended_program_ids: string[];
  lead_comment: string;
  summary: ReportSummary | null;
  pdf_path: string | null;
  tutor_id: string | null;
  submitted_at: string | null;
  reviewed_by: string | null;
  published_at: string | null;
  updated_at: string;
};

const REPORT_COLUMNS =
  "id, enrollment_id, student_id, batch_id, status, strengths, improvements, levels, recommended_program_ids, lead_comment, summary, pdf_path, tutor_id, submitted_at, reviewed_by, published_at, updated_at";

// ---------------------------------------------------------------------------
// Tutor: daftar laporan yang harus disusun
// ---------------------------------------------------------------------------

export type ReportTask = {
  enrollment_id: string;
  student_id: string;
  full_name: string;
  batch: { id: string; code: string; program: string };
  state: ReportStatus | "none" | "waiting";
  due: number;
  overdue: boolean;
  lead_comment: string;
};

// Siswa di batch tutor yang sesi assessment akhirnya sudah dimulai.
export async function tutorReportTasks(tutorId: string): Promise<ReportTask[]> {
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
  const moduleIds = [...new Set(sessions.map((s) => s.module_id).filter(Boolean) as string[])];
  const [{ data: finals }, { data: enrollments }, { data: assessments }, { data: reports }] = await Promise.all([
    moduleIds.length ? admin.from("curriculum_modules").select("id").in("id", moduleIds).eq("assessment", "final") : Promise.resolve({ data: [] as { id: string }[] }),
    admin.from("enrollments").select("id, batch_id, student:students(id, full_name)").in("batch_id", ids).in("status", ["active", "completed"]).order("created_at"),
    admin.from("assessments").select("batch_id, student_id").in("batch_id", ids).eq("kind", "final").eq("status", "published"),
    admin.from("reports").select("enrollment_id, status, lead_comment").in("batch_id", ids),
  ]);
  const now = Date.now();
  const tasks: ReportTask[] = [];
  for (const b of batches ?? []) {
    const own = sessions.filter((s) => s.batch_id === b.id);
    const finalSession = own.find((s) => (finals ?? []).some((m) => m.id === s.module_id));
    if (!finalSession || Date.parse(finalSession.starts_at) > now) continue;
    const due = reportDue(own);
    for (const e of (enrollments ?? []).filter((x) => x.batch_id === b.id)) {
      const st = e.student as unknown as { id: string; full_name: string };
      const report = (reports ?? []).find((r) => r.enrollment_id === e.id);
      const finalDone = (assessments ?? []).some((a) => a.batch_id === b.id && a.student_id === st.id);
      const state = (report?.status as ReportStatus | undefined) ?? (finalDone ? "none" : "waiting");
      tasks.push({
        enrollment_id: e.id,
        student_id: st.id,
        full_name: st.full_name,
        batch: { id: b.id, code: b.code, program: (b.program as unknown as { name: string }).name },
        state,
        due,
        overdue: (state === "none" || state === "draft" || state === "returned" || state === "waiting") && now > due,
        lead_comment: report?.lead_comment ?? "",
      });
    }
  }
  return tasks;
}

export async function tutorAcademicQueue(tutorId: string) {
  const [assessments, reports] = await Promise.all([tutorAssessmentQueue(tutorId), tutorReportTasks(tutorId)]);
  const open = reports.filter((r) => r.state === "none" || r.state === "draft" || r.state === "returned");
  return {
    assessments,
    assessmentCounts: queueCounts(assessments),
    reports,
    reportsToWrite: open.length,
    reportsReturned: reports.filter((r) => r.state === "returned").length,
    reportsOverdue: reports.filter((r) => r.overdue && r.state !== "waiting").length,
  };
}

// ---------------------------------------------------------------------------
// Ruang kerja laporan (tutor menyusun, Lead meninjau)
// ---------------------------------------------------------------------------

export type ProgramOption = { id: string; name: string; category: string; entry_level: string };

export type ReportWorkspace = {
  enrollment: { id: string; status: string; student_id: string };
  student: { id: string; full_name: string };
  batch: BatchRow;
  progress: ClassProgress;
  report: ReportRow | null;
  skills: Skill[];
  suggestedLevels: SkillLevels;
  programs: ProgramOption[];
  tutorName: string;
};

// Level sebelumnya per keterampilan: laporan terbit terakhir, atau hasil placement terakhir.
async function previousLevels(studentId: string, exceptReport?: string): Promise<SkillLevels> {
  const admin = createAdminClient();
  const { data: reports } = await admin.from("reports").select("id, levels").eq("student_id", studentId).eq("status", "published").order("published_at", { ascending: false }).limit(2);
  const last = (reports ?? []).find((r) => r.id !== exceptReport);
  if (last) return last.levels as SkillLevels;
  const { data: attempts } = await admin.from("placement_attempts").select("levels").eq("student_id", studentId).eq("status", "published").order("published_at", { ascending: false }).limit(1);
  const levels = (attempts?.[0]?.levels ?? {}) as Record<string, string>;
  return Object.fromEntries(SKILLS.filter((k) => REPORT_LEVELS.includes(levels[k] as ReportLevel)).map((k) => [k, levels[k]])) as SkillLevels;
}

async function activeProgramOptions(): Promise<ProgramOption[]> {
  const { data } = await createAdminClient().from("programs").select("id, name, category, entry_level").eq("status", "active").order("sort_order");
  return (data ?? []) as ProgramOption[];
}

export async function reportWorkspace(enrollmentId: string, viewer: { id: string; roles: string[] }): Promise<ReportWorkspace | null> {
  const admin = createAdminClient();
  const { data: e } = await admin.from("enrollments").select("id, status, student_id, batch_id, student:students(id, full_name)").eq("id", enrollmentId).maybeSingle();
  if (!e) return null;
  const batch = await getBatch(e.batch_id);
  if (!batch?.curriculum_id) return null;
  const isLead = viewer.roles.includes("lead") || viewer.roles.includes("owner");
  if (!isLead && !(viewer.roles.includes("tutor") && batch.tutor_id === viewer.id)) return null;
  const student = e.student as unknown as { id: string; full_name: string };
  const [progress, { data: report }, indicators, programs] = await Promise.all([
    learnerProgress(student.id, student.full_name),
    admin.from("reports").select(REPORT_COLUMNS).eq("enrollment_id", e.id).maybeSingle(),
    rubricOf([batch.curriculum_id]),
    activeProgramOptions(),
  ]);
  const own = progress.find((p) => p.cls.enrollment.id === e.id);
  if (!own) return null;
  const skills = SKILLS.filter((k) => indicators.some((i) => i.skill === k));
  const previous = await previousLevels(student.id, (report as ReportRow | null)?.id);
  return {
    enrollment: { id: e.id, status: e.status, student_id: student.id },
    student,
    batch,
    progress: own,
    report: (report as ReportRow | null) ?? null,
    skills,
    suggestedLevels: Object.fromEntries(skills.filter((k) => previous[k]).map((k) => [k, previous[k]])),
    programs: programs.filter((p) => p.id !== batch.program_id),
    tutorName: batch.tutor?.full_name ?? "-",
  };
}

export type ReportInput = { strengths: string; improvements: string; levels: SkillLevels; programIds: string[]; submit: boolean };

export async function saveReport(enrollmentId: string, input: ReportInput) {
  const levels = Object.fromEntries(Object.entries(input.levels).filter(([k, v]) => SKILLS.includes(k as Skill) && REPORT_LEVELS.includes(v as ReportLevel)));
  const supabase = await createClient();
  const { data: id, error } = await supabase.rpc("save_report", {
    p_enrollment: enrollmentId,
    p_strengths: input.strengths,
    p_improvements: input.improvements,
    p_levels: levels,
    p_programs: [...new Set(input.programIds)],
    p_submit: input.submit,
  });
  if (error || !id) dbError(error, "Laporan gagal disimpan.");
  if (input.submit) {
    const { data: r } = await createAdminClient().from("reports").select("student:students(full_name), batch:batches(code, program:programs(name))").eq("id", id).single();
    if (r) {
      const b = r.batch as unknown as { code: string; program: { name: string } };
      await notify("report_submitted", await roleRecipients("lead"), { name: (r.student as unknown as { full_name: string }).full_name, program: b.program.name, batch: b.code }, { type: "reports", id: id as string });
    }
  }
}

// ---------------------------------------------------------------------------
// Academic Lead: review dan terbit
// ---------------------------------------------------------------------------

export type LeadReportRow = ReportRow & { student_name: string; program: string; batch_code: string; tutor: string; overdue: boolean };

export async function leadReports(): Promise<LeadReportRow[]> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("reports")
    .select(`${REPORT_COLUMNS}, student:students(full_name), batch:batches(code, program:programs(name), tutor:profiles!batches_tutor_id_fkey(full_name))`)
    .in("status", ["submitted", "returned", "published"])
    .order("submitted_at", { ascending: true });
  const now = Date.now();
  return (data ?? []).map((r) => {
    const b = r.batch as unknown as { code: string; program: { name: string }; tutor: { full_name: string } | null };
    return {
      ...(r as unknown as ReportRow),
      student_name: (r.student as unknown as { full_name: string }).full_name,
      program: b.program.name,
      batch_code: b.code,
      tutor: b.tutor?.full_name ?? "-",
      overdue: r.status === "submitted" && Boolean(r.submitted_at) && Date.parse(r.submitted_at!) + REVIEW_WINDOW_DAYS * DAY < now,
    };
  });
}

export async function reviewReport(reportId: string, publish: boolean, comment: string, levels: SkillLevels | null) {
  const admin = createAdminClient();
  const { data: r } = await admin.from("reports").select("enrollment_id, tutor_id, status").eq("id", reportId).maybeSingle();
  if (!r) throw new ClassError("Laporan tidak ditemukan.");
  let summary: ReportSummary | null = null;
  if (publish) {
    const { data: e } = await admin.from("enrollments").select("student:students(id, full_name)").eq("id", r.enrollment_id).single();
    const st = e?.student as unknown as { id: string; full_name: string } | undefined;
    const progress = st ? (await learnerProgress(st.id, st.full_name)).find((p) => p.cls.enrollment.id === r.enrollment_id) : undefined;
    if (!progress) throw new ClassError("Data kelas laporan ini tidak ditemukan.");
    summary = progress.summary;
  }
  const supabase = await createClient();
  const { error } = await supabase.rpc("review_report", {
    p_report: reportId,
    p_publish: publish,
    p_comment: comment,
    p_levels: levels && Object.keys(levels).length ? levels : null,
    p_summary: summary,
  });
  if (error) dbError(error, "Review laporan gagal disimpan.");

  const { data: info } = await admin.from("reports").select("student_id, student:students(full_name), batch:batches(code, program:programs(name))").eq("id", reportId).single();
  const name = (info?.student as unknown as { full_name: string } | undefined)?.full_name ?? "";
  const b = info?.batch as unknown as { code: string; program: { name: string } } | undefined;
  if (publish) {
    await generateReportPdf(reportId);
    if (info) await notify("report_published", await studentRecipients(info.student_id), { name, program: b?.program.name ?? "" }, { type: "reports", id: reportId });
  } else {
    await notify("report_returned", [r.tutor_id], { name, program: b?.program.name ?? "", batch: b?.code ?? "", comment: comment.trim() }, { type: "reports", id: reportId });
  }
}

// ---------------------------------------------------------------------------
// PDF
// ---------------------------------------------------------------------------

export async function reportDocument(reportId: string): Promise<ReportDocument | null> {
  const admin = createAdminClient();
  const { data: r } = await admin.from("reports").select(`${REPORT_COLUMNS}, reviewer:profiles!reports_reviewed_by_fkey(full_name)`).eq("id", reportId).maybeSingle();
  if (!r || r.status !== "published" || !r.summary) return null;
  const ids = (r.recommended_program_ids ?? []) as string[];
  const { data: programs } = ids.length ? await admin.from("programs").select("id, name, outcome").in("id", ids) : { data: [] };
  return {
    reportId: r.id,
    summary: r.summary as ReportSummary,
    strengths: r.strengths,
    improvements: r.improvements,
    levels: r.levels as SkillLevels,
    recommendations: ids.map((id) => programs?.find((p) => p.id === id)).filter(Boolean).map((p) => ({ name: p!.name, reason: p!.outcome })),
    reviewer: (r.reviewer as unknown as { full_name: string } | null)?.full_name || "Academic Lead",
    publishedAt: r.published_at!,
  };
}

// PDF dibuat sekali dan disimpan; kegagalan diulang oleh jadwal harian.
export async function generateReportPdf(reportId: string) {
  try {
    const doc = await reportDocument(reportId);
    if (!doc) return false;
    const { data: r } = await createAdminClient().from("reports").select("student_id").eq("id", reportId).single();
    const path = `${r!.student_id}/${reportId}.pdf`;
    const ok = await uploadFile("reports", path, await renderReportPdf(doc), "application/pdf");
    if (ok) await createAdminClient().from("reports").update({ pdf_path: path }).eq("id", reportId);
    return ok;
  } catch (e) {
    console.error("PDF laporan gagal dibuat", e);
    return false;
  }
}

export async function ensureReportPdfs() {
  const { data } = await createAdminClient().from("reports").select("id").eq("status", "published").is("pdf_path", null).limit(20);
  let n = 0;
  for (const r of data ?? []) if (await generateReportPdf(r.id)) n += 1;
  return n;
}

const fileSafe = (s: string) => s.normalize("NFKD").replace(/[^\w\s-]/g, "").trim().replace(/\s+/g, "-");

// Unduhan PDF: hak akses diperiksa RLS sesi pengguna (siswa/wali hanya laporan terbit miliknya).
export async function reportFileUrl(reportId: string) {
  const supabase = await createClient();
  const { data } = await supabase.from("reports").select("id, status, pdf_path, student:students(full_name), batch:batches(program:programs(name))").eq("id", reportId).maybeSingle();
  if (!data || data.status !== "published") return null;
  let path = data.pdf_path as string | null;
  if (!path && (await generateReportPdf(reportId))) {
    path = (await createAdminClient().from("reports").select("pdf_path").eq("id", reportId).single()).data?.pdf_path ?? null;
  }
  if (!path) return null;
  const name = `Laporan-${fileSafe((data.batch as unknown as { program: { name: string } }).program.name)}-${fileSafe((data.student as unknown as { full_name: string }).full_name)}.pdf`;
  return signedDownload("reports", path, name);
}

// ---------------------------------------------------------------------------
// Siswa dan wali
// ---------------------------------------------------------------------------

export type LearnerReport = ReportRow & { program: string; batch_code: string; recommendations: ProgramOption[] };

// Laporan terbit seorang siswa, dari program pertama sampai terbaru.
export async function learnerReports(studentId: string): Promise<LearnerReport[]> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("reports")
    .select(`${REPORT_COLUMNS}, batch:batches(code, program:programs(name))`)
    .eq("student_id", studentId)
    .eq("status", "published")
    .order("published_at");
  const rows = data ?? [];
  const ids = [...new Set(rows.flatMap((r) => (r.recommended_program_ids ?? []) as string[]))];
  const { data: programs } = ids.length ? await admin.from("programs").select("id, name, category, entry_level").in("id", ids) : { data: [] };
  return rows.map((r) => {
    const b = r.batch as unknown as { code: string; program: { name: string } };
    return {
      ...(r as unknown as ReportRow),
      program: b.program.name,
      batch_code: b.code,
      recommendations: ((r.recommended_program_ids ?? []) as string[]).map((id) => programs?.find((p) => p.id === id)).filter(Boolean) as ProgramOption[],
    };
  });
}

// Laporan terbit terbaru beberapa siswa (untuk level dan rekomendasi program berikutnya).
export async function latestReports(studentIds: string[]) {
  if (!studentIds.length) return new Map<string, { id: string; levels: SkillLevels; recommended_program_ids: string[]; overall: ReportLevel | null }>();
  const { data } = await createAdminClient()
    .from("reports")
    .select("id, student_id, levels, recommended_program_ids, published_at")
    .in("student_id", studentIds)
    .eq("status", "published")
    .order("published_at", { ascending: false });
  const map = new Map<string, { id: string; levels: SkillLevels; recommended_program_ids: string[]; overall: ReportLevel | null }>();
  for (const r of data ?? []) {
    if (!map.has(r.student_id)) map.set(r.student_id, { id: r.id, levels: r.levels as SkillLevels, recommended_program_ids: r.recommended_program_ids ?? [], overall: overallReportLevel(r.levels as SkillLevels) });
  }
  return map;
}

// ---------------------------------------------------------------------------
// Pengingat harian untuk staf akademik
// ---------------------------------------------------------------------------

export async function sendAcademicReminders() {
  const admin = createAdminClient();
  const { data: tutors } = await admin.from("batches").select("tutor_id").not("tutor_id", "is", null).not("curriculum_id", "is", null).in("status", ["open", "running", "completed"]);
  let sent = 0;
  for (const tutorId of [...new Set((tutors ?? []).map((t) => t.tutor_id as string))]) {
    const q = await tutorAcademicQueue(tutorId);
    if (q.assessmentCounts.overdue || q.reportsOverdue) {
      await notify("academic_overdue", [tutorId], { assessments: q.assessmentCounts.overdue, reports: q.reportsOverdue }, { type: "profiles", id: tutorId });
      sent += 1;
    }
  }
  const waiting = (await leadReports()).filter((r) => r.overdue).length;
  if (waiting) {
    await notify("report_review_overdue", await roleRecipients("lead"), { count: waiting });
    sent += 1;
  }
  return sent;
}

