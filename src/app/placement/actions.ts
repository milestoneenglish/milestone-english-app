"use server";

import { redirect } from "next/navigation";
import {
  currentActor,
  PlacementError,
  recordPlay,
  saveChoices,
  saveSpeaking,
  saveText,
  speakingUploadTarget,
  startGuestAttempt,
  startStudentAttempt,
  submitAttempt,
} from "@/lib/placement/server";

export type ActionResult<T = object> = ({ ok: true } & T) | { ok: false; error: string };

async function guard<T extends object>(fn: () => Promise<T>): Promise<ActionResult<T>> {
  try {
    return { ok: true, ...(await fn()) };
  } catch (e) {
    if (e instanceof PlacementError) return { ok: false, error: e.message };
    console.error(e);
    return { ok: false, error: "Terjadi kesalahan. Coba lagi." };
  }
}

export async function startGuestTest() {
  const actor = await currentActor();
  // Pengguna yang sudah masuk mengerjakan placement dari portal, supaya hasilnya langsung tersimpan di akunnya.
  if (actor.kind === "user") redirect("/portal");
  const id = await startGuestAttempt();
  redirect(`/placement/tes/${id}`);
}

export async function startStudentTest(studentId: string, returnTo: string) {
  const actor = await currentActor();
  if (actor.kind !== "user") redirect("/masuk");
  let id: string;
  try {
    id = await startStudentAttempt(actor.userId, studentId);
  } catch (e) {
    const back = returnTo.startsWith("/portal/") ? returnTo : "/portal";
    if (e instanceof PlacementError) redirect(`${back}?galat=${encodeURIComponent(e.message)}`);
    throw e;
  }
  redirect(`/placement/tes/${id}`);
}

export async function answerChoices(attemptId: string, items: { questionId: string; choice: number }[]) {
  return guard(async () => {
    await saveChoices(attemptId, items);
    return {};
  });
}

export async function answerText(attemptId: string, questionId: string, text: string) {
  return guard(async () => {
    await saveText(attemptId, questionId, text);
    return {};
  });
}

export async function playListening(attemptId: string, groupKey: string) {
  return guard(async () => ({ remaining: await recordPlay(attemptId, groupKey) }));
}

export async function prepareSpeakingUpload(attemptId: string, questionId: string, mime: string) {
  return guard(() => speakingUploadTarget(attemptId, questionId, mime));
}

export async function confirmSpeaking(attemptId: string, questionId: string, path: string) {
  return guard(async () => {
    await saveSpeaking(attemptId, questionId, path);
    return {};
  });
}

export async function submitTest(attemptId: string) {
  return guard(async () => {
    await submitAttempt(attemptId);
    const actor = await currentActor();
    return { next: actor.kind === "user" ? "/portal" : `/placement/hasil/${attemptId}` };
  });
}
