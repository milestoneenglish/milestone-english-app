import "server-only";
import { buildMessage, whatsappText } from "@/lib/notify";
import { createAdminClient } from "@/lib/supabase/admin";

// Tombol "Kirim via WhatsApp": admin mengirim kabar penting dari WhatsApp-nya sendiri (wa.me dengan pesan terisi).
// Setiap kiriman dicatat di log notifikasi, sehingga yang sudah dikabari tidak muncul lagi di antrean.

export type WaKind = "payment" | "absence" | "report";
export type WaContact = { recipientId: string; name: string; phone: string | null; done: boolean };
export type WaItem = { key: string; kind: WaKind; entityId: string; title: string; detail: string; text: string; contacts: WaContact[] };

const DAY = 86400000;
const DATE = new Intl.DateTimeFormat("id-ID", { weekday: "long", day: "numeric", month: "long", timeZone: "Asia/Jakarta" });
const DUE = new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Jakarta" });
const template = (kind: WaKind) => `wa_${kind}`;

// Akun yang dikabari untuk seorang siswa: akun siswanya sendiri dan wali terverifikasi.
async function contactsFor(studentIds: string[]) {
  const admin = createAdminClient();
  if (!studentIds.length) return new Map<string, { id: string; name: string; phone: string | null }[]>();
  const [{ data: students }, { data: links }] = await Promise.all([
    admin.from("students").select("id, user_id").in("id", studentIds),
    admin.from("guardian_links").select("student_id, guardian_id").in("student_id", studentIds).eq("status", "verified"),
  ]);
  const people = [...new Set([...(students ?? []).map((s) => s.user_id), ...(links ?? []).map((l) => l.guardian_id)].filter(Boolean) as string[])];
  const { data: profiles } = people.length ? await admin.from("profiles").select("id, full_name, email, phone, status").in("id", people) : { data: [] };
  const byId = new Map((profiles ?? []).filter((p) => p.status === "active").map((p) => [p.id, { id: p.id, name: p.full_name || p.email, phone: p.phone }]));
  const map = new Map<string, { id: string; name: string; phone: string | null }[]>();
  for (const id of studentIds) {
    const own = (students ?? []).find((s) => s.id === id)?.user_id;
    const guardians = (links ?? []).filter((l) => l.student_id === id).map((l) => l.guardian_id);
    map.set(id, [own, ...guardians].map((x) => (x ? byId.get(x) : undefined)).filter(Boolean) as { id: string; name: string; phone: string | null }[]);
  }
  return map;
}

export async function whatsappQueue(): Promise<WaItem[]> {
  const admin = createAdminClient();
  const since = (days: number) => new Date(Date.now() - days * DAY).toISOString();
  const [{ data: invoices }, { data: absences }, { data: reports }, { data: sent }] = await Promise.all([
    admin.from("invoices").select("id, number, description, amount_idr, due_at, student_id, students(full_name)").eq("status", "unpaid").order("due_at").limit(30),
    admin
      .from("attendance")
      .select("session_id, student_id, recorded_at, students(full_name), session:class_sessions(seq, starts_at, batch:batches(code, program:programs(name)))")
      .eq("status", "absent")
      .gte("recorded_at", since(7))
      .order("recorded_at", { ascending: false })
      .limit(30),
    admin.from("reports").select("id, student_id, published_at, students(full_name), batch:batches(code, program:programs(name))").eq("status", "published").gte("published_at", since(14)).limit(30),
    admin.from("notifications").select("template, entity_id, recipient_id").eq("channel", "whatsapp").in("template", ["wa_payment", "wa_absence", "wa_report"]).gte("created_at", since(30)),
  ]);
  const done = new Set((sent ?? []).map((n) => `${n.template}:${n.entity_id}:${n.recipient_id}`));
  const name = (s: unknown) => (s as { full_name: string } | null)?.full_name ?? "Siswa";
  const contacts = await contactsFor([...new Set([...(invoices ?? []), ...(absences ?? []), ...(reports ?? [])].map((r) => r.student_id as string))]);
  const people = (kind: WaKind, entityId: string, studentId: string): WaContact[] =>
    (contacts.get(studentId) ?? []).map((p) => ({ recipientId: p.id, name: p.name, phone: p.phone, done: done.has(`${template(kind)}:${entityId}:${p.id}`) }));

  const items: WaItem[] = [];
  for (const inv of invoices ?? []) {
    const text = whatsappText(await buildMessage("payment_reminder", { number: inv.number, description: inv.description, amount: inv.amount_idr, due: `${DUE.format(new Date(inv.due_at))} WIB` }));
    items.push({ key: `p:${inv.id}`, kind: "payment", entityId: inv.id, title: `Pengingat bayar · ${name(inv.students)}`, detail: `${inv.number} · batas ${DUE.format(new Date(inv.due_at))} WIB`, text, contacts: people("payment", inv.id, inv.student_id) });
  }
  for (const a of absences ?? []) {
    const session = a.session as unknown as { seq: number; starts_at: string; batch: { code: string; program: { name: string } } } | null;
    if (!session) continue;
    const entityId = `${a.session_id}:${a.student_id}`;
    const text = whatsappText(await buildMessage("attendance_absent", { name: name(a.students), session: `sesi ${session.seq} (${DATE.format(new Date(session.starts_at))})`, program: session.batch.program.name }));
    items.push({ key: `a:${entityId}`, kind: "absence", entityId, title: `Tidak hadir · ${name(a.students)}`, detail: `${session.batch.code} sesi ${session.seq} · ${DATE.format(new Date(session.starts_at))}`, text, contacts: people("absence", entityId, a.student_id) });
  }
  for (const r of reports ?? []) {
    const batch = r.batch as unknown as { code: string; program: { name: string } } | null;
    const text = whatsappText(await buildMessage("report_published", { name: name(r.students), program: batch?.program.name ?? "" }));
    items.push({ key: `r:${r.id}`, kind: "report", entityId: r.id, title: `Laporan terbit · ${name(r.students)}`, detail: batch ? `${batch.program.name} · ${batch.code}` : "", text, contacts: people("report", r.id, r.student_id) });
  }
  // Yang semua penerimanya sudah dikabari tidak ditampilkan lagi.
  return items.filter((i) => i.contacts.length === 0 || i.contacts.some((c) => !c.done));
}

export async function logManualWhatsapp(actorId: string, input: { kind: WaKind; entityId: string; recipientId: string; phone: string; text: string }) {
  await createAdminClient()
    .from("notifications")
    .insert({
      recipient_id: input.recipientId,
      channel: "whatsapp",
      destination: input.phone,
      template: template(input.kind),
      subject: "WhatsApp dari admin",
      body: input.text.slice(0, 4000),
      status: "sent",
      error: null,
      entity: input.kind,
      entity_id: input.entityId,
      sent_at: new Date().toISOString(),
    });
  await createAdminClient().from("audit_log").insert({ actor_id: actorId, action: "whatsapp_sent", entity: "notifications", entity_id: input.entityId, detail: { kind: input.kind, to: input.recipientId } });
}
