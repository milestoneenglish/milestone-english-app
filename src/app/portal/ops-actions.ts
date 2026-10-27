"use server";

import { revalidatePath } from "next/cache";
import type { LandingCopy } from "@/data/landing";
import { ClassError } from "@/lib/classes";
import type { Contact, Hero } from "@/lib/content";
import type { EditableTemplate, TemplateKey } from "@/lib/notify";
import {
  createStaff,
  deleteExpense,
  receiptUploadTarget,
  receiptUrl,
  resetStaffPassword,
  saveExpense,
  saveProgram,
  setStaffActive,
  updateProgramDescription,
  updateStaff,
  type ExpenseInput,
  type ProgramInput,
  type StaffInput,
} from "@/lib/owner";
import { saveObservation, submitSurvey } from "@/lib/quality";
import { requireRole } from "@/lib/session";
import type { ImageSlot } from "@/lib/ops";
import { deleteRow, imageUploadTarget, saveContact, saveFaq, saveHero, saveLanding, saveTemplate, saveTestimonial, setImage } from "@/lib/site";
import { closeTicket, createTicket, reopenTicket, replyTicket } from "@/lib/support";

// Aksi Fase 5: staf, program, keuangan, CMS website, bantuan, kualitas tutor.

export type OpsResult<T = object> = ({ ok: true } & T) | { ok: false; error: string };

async function run<T extends object>(fn: () => Promise<T>, paths: string[] = []): Promise<OpsResult<T>> {
  try {
    const value = await fn();
    revalidatePath("/portal", "layout");
    for (const p of paths) revalidatePath(p);
    return { ok: true, ...value };
  } catch (e) {
    if (e instanceof ClassError) return { ok: false, error: e.message };
    console.error(e);
    return { ok: false, error: "Terjadi kesalahan. Coba lagi." };
  }
}

const done = async (p: Promise<unknown>) => {
  await p;
  return {};
};

// ---------------------------------------------------------------- Staf (Owner)

export async function createStaffAction(input: StaffInput) {
  const viewer = await requireRole("owner");
  return run(async () => ({ id: await createStaff(viewer.id, input) }));
}

export async function updateStaffAction(userId: string, input: { fullName: string; phone: string; roles: string[] }) {
  const viewer = await requireRole("owner");
  return run(() => done(updateStaff(viewer.id, userId, input)));
}

export async function resetStaffPasswordAction(userId: string, password: string) {
  const viewer = await requireRole("owner");
  return run(() => done(resetStaffPassword(viewer.id, userId, password)));
}

export async function setStaffActiveAction(userId: string, active: boolean) {
  const viewer = await requireRole("owner");
  return run(() => done(setStaffActive(viewer.id, userId, active)));
}

// ---------------------------------------------------------------- Program (Owner: semua; Admin: deskripsi)

export async function saveProgramAction(id: string | null, input: ProgramInput) {
  await requireRole("owner");
  return run(async () => ({ id: await saveProgram(id, input) }), ["/"]);
}

export async function updateProgramDescriptionAction(id: string, outcome: string, evidence: string) {
  await requireRole("owner", "admin");
  return run(() => done(updateProgramDescription(id, outcome, evidence)), ["/"]);
}

// ---------------------------------------------------------------- Keuangan (Owner)

export async function prepareReceiptUpload(mime: string, size: number) {
  await requireRole("owner");
  return run(() => receiptUploadTarget(mime, size));
}

export async function saveExpenseAction(id: string | null, input: ExpenseInput) {
  const viewer = await requireRole("owner");
  return run(() => done(saveExpense(viewer.id, id, input)));
}

export async function deleteExpenseAction(id: string) {
  await requireRole("owner");
  return run(() => done(deleteExpense(id)));
}

export async function receiptUrlAction(id: string) {
  await requireRole("owner");
  return run(async () => ({ url: await receiptUrl(id) }));
}

// ---------------------------------------------------------------- CMS website (Owner dan Admin)

export async function saveHeroAction(hero: Hero) {
  const viewer = await requireRole("owner", "admin");
  return run(() => done(saveHero(viewer.id, hero)), ["/"]);
}

export async function saveContactAction(contact: Contact) {
  const viewer = await requireRole("owner", "admin");
  return run(() => done(saveContact(viewer.id, contact)), ["/"]);
}

export async function saveLandingAction(copy: LandingCopy) {
  const viewer = await requireRole("owner", "admin");
  return run(() => done(saveLanding(viewer.id, copy)), ["/"]);
}

export async function prepareImageUpload(slot: ImageSlot, mime: string, size: number) {
  await requireRole("owner", "admin");
  return run(() => imageUploadTarget(slot, mime, size));
}

export async function setImageAction(slot: ImageSlot, path: string) {
  const viewer = await requireRole("owner", "admin");
  return run(() => done(setImage(viewer.id, slot, path)), ["/"]);
}

export async function saveFaqAction(id: string | null, input: Parameters<typeof saveFaq>[1]) {
  await requireRole("owner", "admin");
  return run(() => done(saveFaq(id, input)), ["/"]);
}

export async function saveTestimonialAction(id: string | null, input: Parameters<typeof saveTestimonial>[1]) {
  await requireRole("owner", "admin");
  return run(() => done(saveTestimonial(id, input)), ["/"]);
}

export async function deleteContentAction(table: "faqs" | "testimonials", id: string) {
  await requireRole("owner", "admin");
  return run(() => done(deleteRow(table, id)), ["/"]);
}

export async function saveTemplateAction(key: TemplateKey, value: EditableTemplate | null) {
  const viewer = await requireRole("owner", "admin");
  return run(() => done(saveTemplate(viewer.id, key, value)));
}

// ---------------------------------------------------------------- Bantuan

export async function createTicketAction(category: string, subject: string, body: string) {
  await requireRole("student", "guardian");
  return run(async () => ({ id: await createTicket(category, subject, body) }));
}

export async function replyTicketAction(ticketId: string, body: string) {
  const viewer = await requireRole("student", "guardian", "admin", "owner");
  const asStaff = viewer.roles.some((r) => r === "admin" || r === "owner");
  return run(() => done(replyTicket(viewer.id, ticketId, body, asStaff)));
}

export async function closeTicketAction(ticketId: string) {
  await requireRole("admin", "owner");
  return run(() => done(closeTicket(ticketId)));
}

export async function reopenTicketAction(ticketId: string, body: string) {
  await requireRole("student", "guardian");
  return run(() => done(reopenTicket(ticketId, body)));
}

// ---------------------------------------------------------------- Kualitas tutor

export async function saveObservationAction(batchId: string, input: Parameters<typeof saveObservation>[1]) {
  await requireRole("lead", "owner");
  return run(() => done(saveObservation(batchId, input)));
}

export async function submitSurveyAction(enrollmentId: string, rating: number, comment: string) {
  await requireRole("student", "guardian");
  return run(() => done(submitSurvey(enrollmentId, rating, comment)));
}
