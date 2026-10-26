"use server";

import { revalidatePath } from "next/cache";
import type { AssessmentKind, Skill, SkillLevels } from "@/lib/academic";
import { saveAssessment, type AssessmentInput } from "@/lib/assessment";
import { ClassError } from "@/lib/classes";
import {
  addIndicator,
  addMaterial,
  addModule,
  createCurriculum,
  deleteCurriculumDraft,
  deleteIndicator,
  deleteMaterial,
  deleteModule,
  deleteTask,
  materialFileUrl,
  materialUploadTarget,
  moveModule,
  newCurriculumVersion,
  publishCurriculum,
  saveTask,
  setModuleAssessment,
  updateCurriculumMeta,
  updateIndicator,
  updateModule,
  type MaterialInput,
  type ModuleInput,
  type TaskInput,
} from "@/lib/curriculum";
import {
  publishAssignment,
  recordAttendance,
  saveFeedback,
  submissionFileUrl,
  submissionUploadTarget,
  submitAssignment,
  type AssignmentInput,
  type AttendanceEntry,
  type SubmissionInput,
} from "@/lib/learning";
import { reportFileUrl, reviewReport, saveReport, type ReportInput } from "@/lib/reports";
import { requireRole, requireViewer } from "@/lib/session";

export type LearnResult<T = object> = ({ ok: true } & T) | { ok: false; error: string };

async function run<T extends object>(fn: () => Promise<T>): Promise<LearnResult<T>> {
  try {
    const value = await fn();
    revalidatePath("/portal", "layout");
    return { ok: true, ...value };
  } catch (e) {
    if (e instanceof ClassError) return { ok: false, error: e.message };
    console.error(e);
    return { ok: false, error: "Terjadi kesalahan. Coba lagi." };
  }
}

const done = () => ({});

// ---------------------------------------------------------------------------
// Academic Lead: kurikulum
// ---------------------------------------------------------------------------

const lead = () => requireRole("lead", "owner");

export async function createCurriculumAction(programId: string) {
  await lead();
  return run(async () => ({ id: await createCurriculum(programId) }));
}

export async function updateCurriculumAction(id: string, input: { title: string; notes: string }) {
  const viewer = await lead();
  return run(() => updateCurriculumMeta(viewer.id, id, input).then(done));
}

export async function publishCurriculumAction(id: string) {
  await lead();
  return run(() => publishCurriculum(id).then(done));
}

export async function newVersionAction(id: string) {
  await lead();
  return run(async () => ({ id: await newCurriculumVersion(id) }));
}

export async function deleteDraftAction(id: string) {
  await lead();
  return run(async () => ({ programId: (await deleteCurriculumDraft(id)) ?? "" }));
}

export async function addModuleAction(curriculumId: string, title: string) {
  await lead();
  return run(async () => ({ id: await addModule(curriculumId, title) }));
}

export async function updateModuleAction(moduleId: string, input: ModuleInput) {
  const viewer = await lead();
  return run(() => updateModule(viewer.id, moduleId, input).then(done));
}

export async function moveModuleAction(moduleId: string, delta: number) {
  await lead();
  return run(() => moveModule(moduleId, delta).then(done));
}

export async function deleteModuleAction(moduleId: string) {
  await lead();
  return run(() => deleteModule(moduleId).then(done));
}

export async function prepareMaterialUpload(moduleId: string, mime: string, size: number) {
  await lead();
  return run(() => materialUploadTarget(moduleId, mime, size));
}

export async function addMaterialAction(moduleId: string, input: MaterialInput) {
  const viewer = await lead();
  return run(() => addMaterial(viewer.id, moduleId, input).then(done));
}

export async function deleteMaterialAction(materialId: string) {
  await lead();
  return run(() => deleteMaterial(materialId).then(done));
}

export async function saveTaskAction(moduleId: string, taskId: string | null, input: TaskInput) {
  await lead();
  return run(() => saveTask(moduleId, taskId, input).then(done));
}

export async function deleteTaskAction(taskId: string) {
  await lead();
  return run(() => deleteTask(taskId).then(done));
}

export async function setModuleAssessmentAction(moduleId: string, kind: AssessmentKind | null) {
  await lead();
  return run(() => setModuleAssessment(moduleId, kind).then(done));
}

export async function addIndicatorAction(curriculumId: string, skill: Skill, label: string) {
  await lead();
  return run(async () => ({ id: await addIndicator(curriculumId, skill, label) }));
}

export async function updateIndicatorAction(id: string, input: { label: string; descriptors: string[] }) {
  const viewer = await lead();
  return run(() => updateIndicator(viewer.id, id, input).then(done));
}

export async function deleteIndicatorAction(id: string) {
  await lead();
  return run(() => deleteIndicator(id).then(done));
}

// ---------------------------------------------------------------------------
// Tutor: absensi, tugas, feedback
// ---------------------------------------------------------------------------

export async function recordAttendanceAction(sessionId: string, entries: AttendanceEntry[], note: string) {
  await requireRole("tutor", "admin", "owner");
  return run(() => recordAttendance(sessionId, entries, note).then(done));
}

export async function publishAssignmentAction(input: AssignmentInput) {
  await requireRole("tutor");
  return run(async () => ({ id: await publishAssignment(input) }));
}

export async function saveFeedbackAction(submissionId: string, body: string, decision: "accepted" | "revision", publish: boolean) {
  await requireRole("tutor");
  return run(() => saveFeedback(submissionId, body, decision, publish).then(done));
}

// ---------------------------------------------------------------------------
// Assessment dan laporan
// ---------------------------------------------------------------------------

export async function saveAssessmentAction(input: AssessmentInput) {
  await requireRole("tutor");
  return run(() => saveAssessment(input).then(done));
}

export async function saveReportAction(enrollmentId: string, input: ReportInput) {
  await requireRole("tutor");
  return run(() => saveReport(enrollmentId, input).then(done));
}

export async function reviewReportAction(reportId: string, publish: boolean, comment: string, levels: SkillLevels | null) {
  await requireRole("lead", "owner");
  return run(() => reviewReport(reportId, publish, comment, levels).then(done));
}

// ---------------------------------------------------------------------------
// Siswa dan wali: kumpul tugas; semua pengguna: buka file sesuai hak akses
// ---------------------------------------------------------------------------

export async function prepareSubmissionUpload(assignmentId: string, studentId: string, mime: string, size: number) {
  await requireRole("student", "guardian");
  return run(() => submissionUploadTarget(assignmentId, studentId, mime, size));
}

export async function submitAssignmentAction(assignmentId: string, studentId: string, input: SubmissionInput) {
  await requireRole("student", "guardian");
  return run(() => submitAssignment(assignmentId, studentId, input).then(done));
}

export async function fileUrlAction(kind: "material" | "submission" | "report", id: string) {
  const viewer = await requireViewer();
  const url = kind === "material" ? await materialFileUrl(viewer, id) : kind === "report" ? await reportFileUrl(id) : await submissionFileUrl(id);
  return url ? { ok: true as const, url } : { ok: false as const, error: "File tidak tersedia atau kamu tidak punya akses." };
}
