import "server-only";
import { ClassError, dbError } from "@/lib/classes";
import { notify, roleRecipients } from "@/lib/notify";
import { REOPEN_DAYS, TICKET_CATEGORIES, type TicketCategory, type TicketStatus } from "@/lib/ops";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

// Bantuan: siswa/wali membuat tiket, Admin membalas, tiket ditutup, dan bisa dibuka lagi dalam 7 hari.
// Aturan status ada di fungsi database (create_ticket, reply_ticket, close_ticket, reopen_ticket).


export type TicketRow = {
  id: string;
  number: string;
  category: TicketCategory;
  subject: string;
  status: TicketStatus;
  closed_at: string | null;
  last_message_at: string;
  created_at: string;
  requester: { id: string; full_name: string; email: string };
};

export type TicketMessage = { id: string; body: string; from_staff: boolean; created_at: string; author: string };

const COLUMNS = "id, number, category, subject, status, closed_at, last_message_at, created_at, requester:profiles!tickets_requester_id_fkey(id, full_name, email)";

export async function myTickets(userId: string): Promise<TicketRow[]> {
  const { data } = await createAdminClient().from("tickets").select(COLUMNS).eq("requester_id", userId).order("last_message_at", { ascending: false });
  return (data ?? []) as unknown as TicketRow[];
}

export async function supportQueue(status: TicketStatus | "all"): Promise<TicketRow[]> {
  let q = createAdminClient().from("tickets").select(COLUMNS);
  if (status !== "all") q = q.eq("status", status);
  const { data } = await q.order("last_message_at", { ascending: status === "open" }).limit(200);
  return (data ?? []) as unknown as TicketRow[];
}

export async function ticketCounts() {
  const { data } = await createAdminClient().from("tickets").select("status");
  const rows = data ?? [];
  return { open: rows.filter((r) => r.status === "open").length, answered: rows.filter((r) => r.status === "answered").length, closed: rows.filter((r) => r.status === "closed").length };
}

// Satu tiket beserta percakapannya; dibaca lewat RLS sehingga hanya peminta atau Admin/Owner yang bisa membuka.
export async function ticketThread(ticketId: string): Promise<{ ticket: TicketRow; messages: TicketMessage[] } | null> {
  const supabase = await createClient();
  const { data: t } = await supabase.from("tickets").select("id").eq("id", ticketId).maybeSingle();
  if (!t) return null;
  const admin = createAdminClient();
  const [{ data: ticket }, { data: messages }] = await Promise.all([
    admin.from("tickets").select(COLUMNS).eq("id", ticketId).single(),
    admin.from("ticket_messages").select("id, body, from_staff, created_at, author:profiles(full_name)").eq("ticket_id", ticketId).order("created_at"),
  ]);
  return {
    ticket: ticket as unknown as TicketRow,
    messages: (messages ?? []).map((m) => ({
      id: m.id,
      body: m.body,
      from_staff: m.from_staff,
      created_at: m.created_at,
      author: m.from_staff ? "Tim Milestone English" : ((m.author as unknown as { full_name: string } | null)?.full_name ?? ""),
    })),
  };
}

export function canReopen(t: Pick<TicketRow, "status" | "closed_at">) {
  return t.status === "closed" && Boolean(t.closed_at) && Date.now() - Date.parse(t.closed_at!) <= REOPEN_DAYS * 86400_000;
}

async function info(ticketId: string) {
  const { data } = await createAdminClient().from("tickets").select("number, subject, category, requester_id, requester:profiles!tickets_requester_id_fkey(full_name)").eq("id", ticketId).single();
  return data as unknown as { number: string; subject: string; category: TicketCategory; requester_id: string; requester: { full_name: string } };
}

// Tiket ditangani Admin; Owner hanya menerima bila belum ada Admin.
async function staffRecipients() {
  const admins = await roleRecipients("admin");
  return admins.length ? admins : roleRecipients("owner");
}

export async function createTicket(category: string, subject: string, body: string) {
  if (!(category in TICKET_CATEGORIES)) throw new ClassError("Pilih kategori kendala.");
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("create_ticket", { p_category: category, p_subject: subject, p_body: body });
  if (error || !data) dbError(error, "Tiket gagal dibuat.");
  const t = await info(data as string);
  await notify("ticket_created", await staffRecipients(), { number: t.number, subject: t.subject, name: t.requester.full_name, category: TICKET_CATEGORIES[t.category] }, { type: "tickets", id: data as string });
  return data as string;
}

export async function replyTicket(viewerId: string, ticketId: string, body: string, asStaff: boolean) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("reply_ticket", { p_ticket: ticketId, p_body: body });
  if (error) dbError(error, "Balasan gagal dikirim.");
  const t = await info(ticketId);
  if (asStaff && t.requester_id !== viewerId) await notify("ticket_replied", [t.requester_id], { number: t.number, subject: t.subject }, { type: "tickets", id: ticketId });
  else await notify("ticket_followup", await staffRecipients(), { number: t.number, subject: t.subject, name: t.requester.full_name }, { type: "tickets", id: ticketId });
}

export async function closeTicket(ticketId: string) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("close_ticket", { p_ticket: ticketId });
  if (error) dbError(error, "Tiket gagal ditutup.");
  const t = await info(ticketId);
  await notify("ticket_closed", [t.requester_id], { number: t.number, subject: t.subject }, { type: "tickets", id: ticketId });
}

export async function reopenTicket(ticketId: string, body: string) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("reopen_ticket", { p_ticket: ticketId, p_body: body });
  if (error) dbError(error, "Tiket gagal dibuka lagi.");
  const t = await info(ticketId);
  await notify("ticket_followup", await staffRecipients(), { number: t.number, subject: t.subject, name: t.requester.full_name }, { type: "tickets", id: ticketId });
}
