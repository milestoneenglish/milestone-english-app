"use server";

import { menuBadges, type Badges } from "@/lib/badges";
import { inboxSummary, markInboxRead, type InboxSummary } from "@/lib/inbox";
import { isRole } from "@/lib/roles";
import { requireViewer } from "@/lib/session";

// Lonceng notifikasi dan angka menu dimuat ulang dari browser (saat pindah halaman dan berkala).
export async function inboxAction(): Promise<InboxSummary> {
  await requireViewer();
  return inboxSummary();
}

export async function readInboxAction(ids: string[] | null): Promise<InboxSummary> {
  await requireViewer();
  await markInboxRead(ids);
  return inboxSummary();
}

export async function badgesAction(role: string): Promise<Badges> {
  const viewer = await requireViewer();
  if (!isRole(role) || !viewer.roles.includes(role)) return {};
  return menuBadges(role, viewer.id);
}
