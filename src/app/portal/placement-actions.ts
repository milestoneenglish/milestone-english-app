"use server";

import { revalidatePath } from "next/cache";
import { PlacementError } from "@/lib/placement/server";
import { allowRetest, assignEvaluator, publishResult, submitReview } from "@/lib/placement/staff";
import { requireRole } from "@/lib/session";

export type StaffResult = { ok: true } | { ok: false; error: string };

async function run(fn: () => Promise<void>): Promise<StaffResult> {
  try {
    await fn();
    revalidatePath("/portal", "layout");
    return { ok: true };
  } catch (e) {
    if (e instanceof PlacementError) return { ok: false, error: e.message };
    console.error(e);
    return { ok: false, error: "Terjadi kesalahan. Coba lagi." };
  }
}

export async function assignAction(attemptId: string, evaluatorId: string) {
  const viewer = await requireRole("lead", "owner");
  return run(() => assignEvaluator(viewer.id, attemptId, evaluatorId));
}

export async function reviewAction(attemptId: string, writing: Record<string, number> | null, speaking: Record<string, number> | null, comment: string) {
  const viewer = await requireRole("tutor", "lead", "owner");
  const isLead = viewer.roles.includes("lead") || viewer.roles.includes("owner");
  return run(() => submitReview({ id: viewer.id, isLead }, attemptId, { writing, speaking, comment }));
}

export async function publishAction(attemptId: string, programIds: string[], note: string) {
  const viewer = await requireRole("lead", "owner");
  return run(() => publishResult(viewer.id, attemptId, programIds, note));
}

export async function retestAction(attemptId: string, reason: string) {
  const viewer = await requireRole("lead", "owner");
  return run(() => allowRetest(viewer.id, attemptId, reason));
}
