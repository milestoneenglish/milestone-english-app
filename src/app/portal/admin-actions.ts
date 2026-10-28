"use server";

import { revalidatePath } from "next/cache";
import { resetLearnerPassword, type ResetResult } from "@/lib/accounts";
import { ClassError } from "@/lib/classes";
import { requireRole } from "@/lib/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { logManualWhatsapp, type WaKind } from "@/lib/whatsapp";

export type AdminResult = { ok: true } | { ok: false; error: string };

// Admin memutuskan hubungan wali-anak. Ditulis dengan sesi admin, jadi aturan RLS ikut berlaku.
export async function decideGuardianLink(linkId: string, decision: "verified" | "rejected"): Promise<AdminResult> {
  const viewer = await requireRole("admin", "owner");
  if (decision !== "verified" && decision !== "rejected") return { ok: false, error: "Keputusan tidak valid." };
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("guardian_links")
    .update({ status: decision, decided_by: viewer.id, decided_at: new Date().toISOString() })
    .eq("id", linkId)
    .eq("status", "pending")
    .select("id")
    .maybeSingle();
  if (error || !data) return { ok: false, error: "Keputusan gagal disimpan, atau sudah diputuskan sebelumnya." };
  await createAdminClient().from("audit_log").insert({ actor_id: viewer.id, action: `guardian_link_${decision}`, entity: "guardian_links", entity_id: linkId });
  revalidatePath("/portal/admin", "layout");
  return { ok: true };
}

// Password sementara untuk siswa/wali yang lupa password (ditampilkan sekali ke admin).
export async function resetLearnerPasswordAction(userId: string): Promise<({ ok: true } & ResetResult) | { ok: false; error: string }> {
  const viewer = await requireRole("admin", "owner");
  try {
    return { ok: true, ...(await resetLearnerPassword(viewer.id, userId)) };
  } catch (e) {
    if (e instanceof ClassError) return { ok: false, error: e.message };
    console.error(e);
    return { ok: false, error: "Password gagal diganti. Coba lagi." };
  }
}

// Mencatat kabar yang dikirim admin lewat WhatsApp-nya sendiri.
export async function logWhatsappAction(input: { kind: WaKind; entityId: string; recipientId: string; phone: string; text: string }): Promise<AdminResult> {
  const viewer = await requireRole("admin", "owner");
  if (!["payment", "absence", "report"].includes(input.kind)) return { ok: false, error: "Jenis kabar tidak valid." };
  await logManualWhatsapp(viewer.id, input);
  revalidatePath("/portal/admin");
  return { ok: true };
}
