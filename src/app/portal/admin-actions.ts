"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

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
