import Link from "next/link";
import { REOPEN_DAYS, TICKET_CATEGORIES, TICKET_STATUS, type TicketStatus } from "@/lib/ops";
import type { Viewer } from "@/lib/session";
import { canReopen, myTickets, supportQueue, ticketCounts, ticketThread, type TicketRow } from "@/lib/support";
import { Badge, EmptyState, formatDateTime, Notice, PageHeader, Panel, Tabs } from "../ui";
import { NewTicketForm, ReopenForm, ReplyForm } from "./support-forms";

// Bantuan: siswa/wali membuat tiket dan membaca balasan; Admin membalas dan menutup tiket.

const TONE: Record<TicketStatus, "amber" | "green" | "slate"> = { open: "amber", answered: "green", closed: "slate" };

function StatusBadge({ status, staff }: { status: TicketStatus; staff: boolean }) {
  // Dari sisi Admin, "open" berarti perlu dibalas.
  return <Badge tone={staff && status === "open" ? "red" : TONE[status]}>{staff && status === "open" ? "Perlu dibalas" : TICKET_STATUS[status]}</Badge>;
}

function TicketList({ tickets, base, staff }: { tickets: TicketRow[]; base: string; staff: boolean }) {
  return (
    <ul className="divide-y divide-orange/10">
      {tickets.map((t) => (
        <li key={t.id}>
          <Link href={`${base}?id=${t.id}`} className="flex flex-wrap items-center justify-between gap-3 py-3 hover:text-orange">
            <span>
              <span className="block font-bold text-white">{t.subject}</span>
              <span className="block text-xs text-amber-200/70">
                {t.number} · {TICKET_CATEGORIES[t.category]}
                {staff ? ` · ${t.requester.full_name || t.requester.email}` : ""} · {formatDateTime(t.last_message_at)}
              </span>
            </span>
            <StatusBadge status={t.status} staff={staff} />
          </Link>
        </li>
      ))}
    </ul>
  );
}

async function Thread({ id, base, staff }: { id: string; base: string; staff: boolean }) {
  const thread = await ticketThread(id);
  if (!thread) return <Notice tone="red">Tiket tidak ditemukan.</Notice>;
  const { ticket, messages } = thread;
  return (
    <div className="fade-in space-y-6">
      <PageHeader
        title={ticket.subject}
        subtitle={`${ticket.number} · ${TICKET_CATEGORIES[ticket.category]}${staff ? ` · dari ${ticket.requester.full_name || ticket.requester.email} (${ticket.requester.email})` : ""}`}
        action={
          <Link href={base} className="text-sm font-black text-orange">
            ← Semua tiket
          </Link>
        }
      />
      <div className="flex items-center gap-3">
        <StatusBadge status={ticket.status} staff={staff} />
        {ticket.closed_at && <span className="text-xs text-slate-400">Ditutup {formatDateTime(ticket.closed_at)}</span>}
      </div>
      <Panel>
        <ol className="space-y-4">
          {messages.map((m) => (
            <li key={m.id} className={`rounded-2xl border p-4 ${m.from_staff ? "border-orange/40 bg-orange/10 sm:ml-10" : "border-orange/15 sm:mr-10"}`}>
              <p className="text-xs font-black text-amber-200/90">
                {m.author} · <span className="font-normal">{formatDateTime(m.created_at)}</span>
              </p>
              <p className="mt-2 whitespace-pre-line text-sm text-amber-50">{m.body}</p>
            </li>
          ))}
        </ol>
      </Panel>
      {ticket.status !== "closed" ? (
        <Panel>
          <ReplyForm ticketId={ticket.id} staff={staff} canClose={staff} />
        </Panel>
      ) : !staff && canReopen(ticket) ? (
        <Panel>
          <ReopenForm ticketId={ticket.id} />
        </Panel>
      ) : (
        <p className="text-sm text-slate-400">{staff ? "Tiket sudah ditutup." : `Tiket ditutup lebih dari ${REOPEN_DAYS} hari lalu. Buat tiket baru bila masih ada kendala.`}</p>
      )}
    </div>
  );
}

export async function HelpPage({ viewer, role, params }: { viewer: Viewer; role: "student" | "guardian"; params: Record<string, string | undefined> }) {
  const base = `/portal/${role}/bantuan`;
  if (params.id) return <Thread id={params.id} base={base} staff={false} />;
  const tickets = await myTickets(viewer.id);
  return (
    <div className="fade-in space-y-6">
      <PageHeader title="Bantuan" subtitle="Tanyakan kendala pembayaran, kelas, atau teknis. Tim kami membalas lewat portal dan email." />
      <Panel title="Buat tiket baru">
        <NewTicketForm base={base} />
      </Panel>
      <Panel title="Tiket saya">
        {tickets.length === 0 ? <EmptyState icon="help" title="Belum ada tiket" text="Tiket yang kamu kirim beserta balasannya tampil di sini." /> : <TicketList tickets={tickets} base={base} staff={false} />}
      </Panel>
    </div>
  );
}

export async function AdminSupport({ params }: { params: Record<string, string | undefined> }) {
  const base = "/portal/admin/bantuan";
  if (params.id) return <Thread id={params.id} base={base} staff />;
  const status = (["open", "answered", "closed", "all"] as const).find((s) => s === params.tab) ?? "open";
  const [tickets, counts] = await Promise.all([supportQueue(status), ticketCounts()]);
  return (
    <div className="fade-in space-y-6">
      <PageHeader title="Bantuan" subtitle="Tiket dari siswa dan wali. Balas, lalu tutup bila kendalanya selesai." />
      <Tabs
        tabs={[
          { key: "open", label: "Perlu dibalas", count: counts.open, href: `${base}?tab=open` },
          { key: "answered", label: "Sudah dibalas", count: counts.answered, href: `${base}?tab=answered` },
          { key: "closed", label: "Ditutup", count: counts.closed, href: `${base}?tab=closed` },
          { key: "all", label: "Semua", href: `${base}?tab=all` },
        ]}
        active={status}
      />
      <Panel>{tickets.length === 0 ? <EmptyState icon="check" title={status === "open" ? "Semua tiket sudah dibalas" : "Tidak ada tiket"} /> : <TicketList tickets={tickets} base={base} staff />}</Panel>
    </div>
  );
}
