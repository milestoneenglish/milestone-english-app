import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export type InboxItem = { id: string; title: string; body: string; link: string | null; read: boolean; created_at: string };
export type InboxSummary = { unread: number; items: InboxItem[] };

const LIMIT = 15;

// Notifikasi terbaru milik pengguna yang sedang masuk (dibaca lewat RLS: hanya miliknya sendiri).
export async function inboxSummary(): Promise<InboxSummary> {
  const supabase = await createClient();
  const [{ data }, { count }] = await Promise.all([
    supabase.from("inbox").select("id, title, body, link, read_at, created_at").order("created_at", { ascending: false }).limit(LIMIT),
    supabase.from("inbox").select("id", { count: "exact", head: true }).is("read_at", null),
  ]);
  return {
    unread: count ?? 0,
    items: (data ?? []).map((r) => ({ id: r.id, title: r.title, body: r.body, link: r.link, read: Boolean(r.read_at), created_at: r.created_at })),
  };
}

export async function markInboxRead(ids: string[] | null) {
  const supabase = await createClient();
  await supabase.rpc("mark_inbox_read", { p_ids: ids });
}

// Notifikasi lama (lebih dari 90 hari) dibersihkan oleh jadwal harian.
export async function pruneInbox() {
  const cutoff = new Date(Date.now() - 90 * 86400000).toISOString();
  await createAdminClient().from("inbox").delete().lt("created_at", cutoff);
}
