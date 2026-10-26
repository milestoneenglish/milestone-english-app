"use server";

import { revalidatePath } from "next/cache";
import {
  ClassError,
  completeOnboarding,
  createBatch,
  decidePayment,
  enroll,
  proofFileUrl,
  proofUploadTarget,
  savePaymentSettings,
  submitProof,
  updateBatch,
  type BatchInput,
  type BatchPatch,
  type PaymentSettings,
  type ProofInput,
} from "@/lib/classes";
import { requireRole } from "@/lib/session";

export type ClassResult<T = object> = ({ ok: true } & T) | { ok: false; error: string };

async function run<T extends object>(fn: () => Promise<T>): Promise<ClassResult<T>> {
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

// Siswa, wali, atau admin mendaftarkan siswa ke batch. Akses diperiksa oleh enroll_in_batch.
export async function enrollAction(studentId: string, batchId: string) {
  await requireRole("student", "guardian", "admin", "owner");
  return run(async () => ({ invoiceId: await enroll(studentId, batchId) }));
}

export async function prepareProofUpload(invoiceId: string, mime: string, size: number) {
  await requireRole("student", "guardian");
  return run(() => proofUploadTarget(invoiceId, mime, size));
}

export async function submitProofAction(invoiceId: string, input: ProofInput) {
  await requireRole("student", "guardian");
  return run(async () => {
    await submitProof(invoiceId, input);
    return {};
  });
}

export async function onboardingDoneAction(enrollmentId: string) {
  await requireRole("student", "guardian");
  return run(async () => {
    await completeOnboarding(enrollmentId);
    return {};
  });
}

// Batch yang dibuka tampil di landing page, jadi halaman itu ikut diperbarui.
export async function createBatchAction(input: BatchInput) {
  const viewer = await requireRole("admin", "owner");
  const res = await run(async () => ({ batchId: await createBatch(viewer.id, input) }));
  revalidatePath("/");
  return res;
}

export async function updateBatchAction(batchId: string, patch: BatchPatch) {
  const viewer = await requireRole("admin", "owner");
  const res = await run(async () => {
    await updateBatch(viewer.id, batchId, patch);
    return {};
  });
  revalidatePath("/");
  return res;
}

export async function decidePaymentAction(proofId: string, approve: boolean, reason: string) {
  await requireRole("admin", "owner");
  return run(async () => {
    await decidePayment(proofId, approve, reason);
    return {};
  });
}

export async function proofUrlAction(proofId: string) {
  await requireRole("admin", "owner");
  try {
    return { ok: true as const, url: await proofFileUrl(proofId) };
  } catch (e) {
    return { ok: false as const, error: e instanceof ClassError ? e.message : "File bukti tidak tersedia." };
  }
}

export async function savePaymentSettingsAction(input: PaymentSettings) {
  const viewer = await requireRole("owner");
  return run(async () => {
    await savePaymentSettings(viewer.id, input);
    return {};
  });
}
