import Link from "next/link";
import { Icon } from "@/components/icons";
import {
  adminQueue,
  batchRoster,
  batchSessions,
  getBatch,
  listBatches,
  longDate,
  paymentQueue,
  paymentSettings,
  recentNotifications,
  tutors,
  type BatchRow,
} from "@/lib/classes";
import { formatRupiah } from "@/lib/content";
import { publishedCurricula } from "@/lib/curriculum";
import { emailConfigured, whatsappConfigured } from "@/lib/notify";
import type { IconName } from "@/lib/roles";
import type { Viewer } from "@/lib/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { ticketCounts } from "@/lib/support";
import { whatsappQueue, type WaItem } from "@/lib/whatsapp";
import { Badge, EmptyState, formatDateTime, Notice, greeting, PageHeader, Panel, Tabs } from "../ui";
import { AdminEnrollForm, BatchCreateForm, BatchEditForm, PaymentDecision, PaymentSettingsForm } from "./admin-class-forms";
import { EnrollmentBadge, InvoiceBadge } from "./classes";
import { NotificationTemplates } from "./cms";
import { WhatsappSendButton } from "./whatsapp-forms";

const BATCH_STATUS: Record<BatchRow["status"], { label: string; tone: "orange" | "green" | "amber" | "slate" | "red" }> = {
  draft: { label: "Draf", tone: "slate" },
  open: { label: "Buka pendaftaran", tone: "green" },
  running: { label: "Berjalan", tone: "orange" },
  completed: { label: "Selesai", tone: "slate" },
  cancelled: { label: "Dibatalkan", tone: "red" },
};

function BatchBadge({ status }: { status: BatchRow["status"] }) {
  return <Badge tone={BATCH_STATUS[status].tone}>{BATCH_STATUS[status].label}</Badge>;
}

export function QueueCard({ href, icon, count, title, text }: { href: string; icon: IconName; count: number; title: string; text: string }) {
  return (
    <Link href={href} className={`workspace-panel flex items-start gap-4 p-5 transition hover:border-orange/60 ${count ? "" : "opacity-70"}`}>
      <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${count ? "bg-orange text-navy" : "bg-orange/15 text-orange"}`}>
        <Icon name={icon} />
      </span>
      <span>
        <span className="block text-2xl font-black text-white">{count}</span>
        <span className="block text-sm font-black text-orange">{title}</span>
        <span className="block text-xs text-slate-400">{text}</span>
      </span>
    </Link>
  );
}

export async function AdminHome({ viewer }: { viewer: Viewer }) {
  const [q, notes, tickets, wa] = await Promise.all([adminQueue(), recentNotifications(8), ticketCounts(), whatsappQueue()]);
  const firstName = (viewer.fullName || viewer.email).split(/[\s@]/)[0];
  return (
    <div className="fade-in space-y-6">
      <PageHeader title={greeting(firstName)} subtitle="Perlu tindakan hari ini." />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <QueueCard href="/portal/admin/pembayaran" icon="wallet" count={q.proofs} title="Bukti bayar menunggu verifikasi" text="Verifikasi agar kelas siswa langsung aktif." />
        <QueueCard href="/portal/admin/siswa-wali" icon="shield" count={q.guardians} title="Hubungan wali perlu diverifikasi" text="Wali baru bisa memilih kelas setelah diverifikasi." />
        <QueueCard href="/portal/admin/batch" icon="calendar" count={q.batchesWithoutTutor} title="Batch belum punya tutor" text="Tugaskan tutor sebelum kelas mulai." />
        <QueueCard href="/portal/admin/pendaftaran" icon="users" count={q.newStudents} title="Pendaftar baru 7 hari terakhir" text="Pantau placement dan pemilihan kelas." />
        <QueueCard href="/portal/admin/pembayaran?tab=belum" icon="wallet" count={q.unpaid} title="Invoice belum dibayar" text="Kursi dilepas otomatis setelah 2x24 jam." />
        <QueueCard href="/portal/admin/bantuan" icon="help" count={tickets.open} title="Tiket bantuan perlu dibalas" text="Pertanyaan siswa dan wali." />
      </div>
      <Panel title={`Kabari lewat WhatsApp (${wa.length})`}>
        <WhatsappQueue items={wa} />
      </Panel>
      <Panel title="Notifikasi terakhir">
        <NotificationList rows={notes} />
      </Panel>
    </div>
  );
}

// Kabar penting yang dikirim admin dari WhatsApp-nya sendiri: tagihan belum dibayar, siswa tidak hadir
// (7 hari terakhir), dan laporan yang baru terbit (14 hari terakhir).
function WhatsappQueue({ items }: { items: WaItem[] }) {
  if (!items.length) return <EmptyState icon="check" title="Semua sudah dikabari" text="Tagihan belum dibayar, ketidakhadiran, dan laporan baru terbit akan muncul di sini." />;
  return (
    <ul className="divide-y divide-orange/10">
      {items.map((item) => (
        <li key={item.key} className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm">
          <div className="min-w-0">
            <p className="font-bold text-white">{item.title}</p>
            <p className="text-xs text-amber-200/70">{item.detail}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {item.contacts.length === 0 && <span className="text-xs text-slate-400">Belum ada akun siswa/wali yang bisa dikabari</span>}
            {item.contacts.map((c) =>
              c.done ? (
                <Badge key={c.recipientId} tone="green">
                  ✓ {c.name}
                </Badge>
              ) : c.phone ? (
                <WhatsappSendButton key={c.recipientId} kind={item.kind} entityId={item.entityId} recipientId={c.recipientId} phone={c.phone} text={item.text} label={c.name} />
              ) : (
                <span key={c.recipientId} className="text-xs text-slate-400">
                  {c.name}: nomor WA belum diisi
                </span>
              ),
            )}
          </div>
        </li>
      ))}
    </ul>
  );
}

function NotificationList({ rows }: { rows: Awaited<ReturnType<typeof recentNotifications>> }) {
  if (!rows.length) return <EmptyState icon="check" title="Belum ada notifikasi" />;
  const tone = { sent: "green", failed: "red", skipped: "slate", queued: "amber" } as const;
  const label = { sent: "Terkirim", failed: "Gagal", skipped: "Belum dikirim", queued: "Antre" } as const;
  return (
    <ul className="divide-y divide-orange/10">
      {rows.map((n) => (
        <li key={n.id} className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm">
          <div className="min-w-0">
            <p className="truncate font-bold text-white">{n.subject}</p>
            <p className="text-xs text-amber-200/70">
              {n.channel === "email" ? "Email" : "WhatsApp"} ke {n.destination} · {formatDateTime(n.created_at)}
              {n.error && n.status !== "skipped" ? ` · ${n.error}` : ""}
            </p>
          </div>
          <Badge tone={tone[n.status as keyof typeof tone] ?? "slate"}>{label[n.status as keyof typeof label] ?? n.status}</Badge>
        </li>
      ))}
    </ul>
  );
}

function BatchTable({ rows }: { rows: BatchRow[] }) {
  if (!rows.length) return <EmptyState icon="calendar" title="Belum ada batch di bagian ini" />;
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[760px] text-sm">
        <thead>
          <tr className="border-b border-orange/30 text-left text-xs text-amber-200/80">
            <th className="py-2 pr-3 font-black">Batch</th>
            <th className="py-2 pr-3 font-black">Jadwal</th>
            <th className="py-2 pr-3 font-black">Tutor</th>
            <th className="py-2 pr-3 font-black">Kursi</th>
            <th className="py-2 font-black">Status</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((b) => (
            <tr key={b.id} className="border-b border-orange/10 align-top">
              <td className="py-3 pr-3">
                <Link href={`/portal/admin/batch?id=${b.id}`} className="font-black text-orange hover:underline">
                  {b.code}
                </Link>
                <p className="text-xs text-amber-100">{b.program.name}</p>
              </td>
              <td className="py-3 pr-3 text-xs text-amber-100">
                Mulai {longDate(b.start_date)}
                <span className="block text-amber-200/70">
                  {b.schedule_label} · {b.session_count} sesi
                </span>
              </td>
              <td className="py-3 pr-3 text-xs">{b.tutor ? <span className="text-amber-100">{b.tutor.full_name}</span> : <Badge tone="amber">Belum ada</Badge>}</td>
              <td className="py-3 pr-3 font-bold text-white">
                {b.seats_taken}/{b.capacity}
              </td>
              <td className="py-3">
                <BatchBadge status={b.status} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export async function AdminBatches({ params }: { params: Record<string, string | undefined> }) {
  if (params.id) return AdminBatchDetail({ id: params.id });
  if (params.baru) {
    const [{ data: programs }, tutorList, curricula] = await Promise.all([
      createAdminClient().from("programs").select("id, name, capacity, duration_label").eq("status", "active").order("sort_order"),
      tutors(),
      publishedCurricula(),
    ]);
    return (
      <div className="fade-in space-y-6">
        <PageHeader title="Buat batch baru" subtitle="Jadwal sesi dibuat otomatis dari hari dan jam yang dipilih (WIB)." action={<Link href="/portal/admin/batch" className="text-sm font-bold text-orange">← Kembali</Link>} />
        <Panel>
          <BatchCreateForm programs={programs ?? []} tutors={tutorList} curricula={curricula} />
        </Panel>
      </div>
    );
  }
  const all = await listBatches();
  const groups = {
    aktif: all.filter((b) => b.status === "open" || b.status === "running"),
    draf: all.filter((b) => b.status === "draft"),
    selesai: all.filter((b) => b.status === "completed" || b.status === "cancelled"),
  };
  const tab = (params.tab as keyof typeof groups) in groups ? (params.tab as keyof typeof groups) : "aktif";
  return (
    <div className="fade-in space-y-6">
      <PageHeader
        title="Batch & jadwal"
        subtitle="Batch yang membuka pendaftaran tampil di landing page dan bisa dipilih siswa."
        action={
          <Link href="/portal/admin/batch?baru=1" className="btn-orange rounded-full px-5 py-2.5 text-sm">
            + Buat batch
          </Link>
        }
      />
      <Tabs
        active={tab}
        tabs={[
          { key: "aktif", label: "Dibuka & berjalan", count: groups.aktif.length, href: "/portal/admin/batch" },
          { key: "draf", label: "Draf", count: groups.draf.length, href: "/portal/admin/batch?tab=draf" },
          { key: "selesai", label: "Selesai & batal", count: groups.selesai.length, href: "/portal/admin/batch?tab=selesai" },
        ]}
      />
      <Panel>
        <BatchTable rows={groups[tab]} />
      </Panel>
    </div>
  );
}

async function AdminBatchDetail({ id }: { id: string }) {
  const batch = await getBatch(id);
  if (!batch) return <EmptyState title="Batch tidak ditemukan" />;
  const admin = createAdminClient();
  const [sessions, roster, tutorList, { data: curriculum }, { data: done }] = await Promise.all([
    batchSessions(id),
    batchRoster(id),
    tutors(),
    batch.curriculum_id ? admin.from("curricula").select("version, status").eq("id", batch.curriculum_id).maybeSingle() : Promise.resolve({ data: null }),
    admin.from("class_sessions").select("id").eq("batch_id", id).not("attendance_done_at", "is", null),
  ]);
  const recorded = new Set((done ?? []).map((s) => s.id));
  const { data: published } = await admin.from("placement_attempts").select("student_id, students(full_name)").eq("status", "published").not("student_id", "is", null);
  const enrolled = new Set(roster.map((r) => r.student.id));
  const candidates = [...new Map((published ?? []).filter((a) => !enrolled.has(a.student_id!)).map((a) => [a.student_id!, (a.students as unknown as { full_name: string }).full_name])).entries()]
    .map(([sid, name]) => ({ id: sid, name }))
    .sort((a, b) => a.name.localeCompare(b.name));

  return (
    <div className="fade-in space-y-6">
      <PageHeader
        title={`Batch ${batch.code}`}
        subtitle={`${batch.program.name} · mulai ${longDate(batch.start_date)} · ${batch.schedule_label}`}
        action={<Link href="/portal/admin/batch" className="text-sm font-bold text-orange">← Semua batch</Link>}
      />
      <div className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
        <Panel title="Pengaturan batch">
          <div className="mb-4 flex flex-wrap items-center gap-3 text-sm">
            <BatchBadge status={batch.status} />
            <span className="font-bold text-white">
              {batch.seats_taken}/{batch.capacity} kursi terisi
            </span>
          </div>
          <BatchEditForm batch={{ id: batch.id, tutorId: batch.tutor_id ?? "", meetingUrl: batch.meeting_url ?? "", capacity: batch.capacity, status: batch.status, notes: batch.notes }} tutors={tutorList} />
        </Panel>
        <Panel title={`Jadwal sesi (${sessions.length})`}>
          <p className="mb-3 text-xs text-amber-200/80">
            {curriculum ? `Kurikulum versi ${curriculum.version}${curriculum.status === "archived" ? " (versi lama)" : ""}` : "Tanpa kurikulum"}
          </p>
          <ol className="max-h-96 space-y-1 overflow-y-auto pr-2 text-sm">
            {sessions.map((s) => (
              <li key={s.id} className="flex justify-between gap-3 border-b border-orange/10 py-2">
                <span className="min-w-0">
                  <span className="font-bold text-white">Sesi {s.seq}</span>
                  {s.topic && <span className="block truncate text-xs text-amber-200/70">{s.topic}</span>}
                </span>
                <span className="shrink-0 text-right text-amber-100">
                  {formatDateTime(s.starts_at)} · {s.duration_minutes} mnt
                  {recorded.has(s.id) && <span className="block text-[11px] font-bold text-emerald-300">Absensi terisi</span>}
                </span>
              </li>
            ))}
          </ol>
        </Panel>
      </div>
      <Panel title={`Siswa (${roster.length})`}>
        {roster.length === 0 ? (
          <EmptyState icon="users" title="Belum ada siswa" text="Siswa muncul di sini setelah memilih batch ini." />
        ) : (
          <ul className="divide-y divide-orange/10">
            {roster.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <div>
                  <p className="font-bold text-white">{r.student.full_name}</p>
                  <p className="text-xs text-amber-200/70">
                    Level {r.level ?? "-"} · daftar {formatDateTime(r.created_at)}
                    {r.onboarded_at ? " · sudah onboarding" : ""}
                  </p>
                </div>
                <EnrollmentBadge status={r.status} />
              </li>
            ))}
          </ul>
        )}
        {(batch.status === "open" || batch.status === "running") && (
          <div className="mt-5 border-t border-orange/15 pt-5">
            <p className="mb-2 text-xs font-black uppercase tracking-[0.18em] text-amber-200/80">Tempatkan siswa</p>
            {batch.status === "open" ? <AdminEnrollForm batchId={batch.id} candidates={candidates} /> : <p className="text-sm text-slate-400">Buka pendaftaran batch untuk menempatkan siswa.</p>}
          </div>
        )}
      </Panel>
    </div>
  );
}

export async function AdminPayments({ params }: { params: Record<string, string | undefined> }) {
  const all = await paymentQueue();
  const groups = {
    menunggu: all.filter((i) => i.status === "awaiting_verification"),
    belum: all.filter((i) => i.status === "unpaid"),
    lunas: all.filter((i) => i.status === "paid"),
    lainnya: all.filter((i) => i.status === "expired" || i.status === "cancelled"),
  };
  const tab = (params.tab as keyof typeof groups) in groups ? (params.tab as keyof typeof groups) : "menunggu";
  const list = groups[tab];
  const paidTotal = groups.lunas.reduce((s, i) => s + i.amount_idr, 0);

  return (
    <div className="fade-in space-y-6">
      <PageHeader title="Pembayaran" subtitle={`Total lunas: ${formatRupiah(paidTotal)} dari ${groups.lunas.length} invoice.`} />
      <Tabs
        active={tab}
        tabs={[
          { key: "menunggu", label: "Menunggu verifikasi", count: groups.menunggu.length, href: "/portal/admin/pembayaran" },
          { key: "belum", label: "Belum dibayar", count: groups.belum.length, href: "/portal/admin/pembayaran?tab=belum" },
          { key: "lunas", label: "Lunas", count: groups.lunas.length, href: "/portal/admin/pembayaran?tab=lunas" },
          { key: "lainnya", label: "Kedaluwarsa", count: groups.lainnya.length, href: "/portal/admin/pembayaran?tab=lainnya" },
        ]}
      />
      {list.length === 0 ? (
        <Panel>
          <EmptyState icon="wallet" title="Tidak ada invoice di bagian ini" />
        </Panel>
      ) : (
        list.map((inv) => {
          const proof = inv.proofs[0];
          const pending = inv.proofs.find((p) => p.status === "pending");
          return (
            <Panel key={inv.id}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-bold text-amber-200/80">
                    {inv.number} · terbit {formatDateTime(inv.created_at)}
                  </p>
                  <p className="text-lg font-black text-white">{inv.student.full_name}</p>
                  <p className="text-xs text-amber-100">
                    {inv.enrollment.batch.program.name} · batch {inv.enrollment.batch.code}
                  </p>
                  {inv.contact && (
                    <p className="text-xs text-amber-200/70">
                      {inv.contact.name ? `${inv.contact.name} · ` : ""}
                      {inv.contact.email}
                      {inv.contact.phone && (
                        <>
                          {" · "}
                          <a href={`https://wa.me/${inv.contact.phone.replace(/\D/g, "")}`} target="_blank" rel="noopener noreferrer" className="font-bold text-orange">
                            {inv.contact.phone}
                          </a>
                        </>
                      )}
                    </p>
                  )}
                </div>
                <div className="text-right">
                  <p className="text-xl font-black text-orange">{formatRupiah(inv.amount_idr)}</p>
                  <InvoiceBadge status={inv.status} />
                  {inv.status === "unpaid" && <p className="mt-1 text-xs text-amber-200/70">Batas {formatDateTime(inv.due_at)}</p>}
                </div>
              </div>
              {proof && (
                <div className="mt-4 grid gap-3 rounded-xl border border-orange/20 p-4 text-sm sm:grid-cols-4">
                  <div>
                    <p className="text-[11px] font-bold text-amber-200/70">Pengirim</p>
                    <p className="text-amber-100">
                      {proof.sender_bank} · {proof.sender_name}
                    </p>
                  </div>
                  <div>
                    <p className="text-[11px] font-bold text-amber-200/70">Nominal di bukti</p>
                    <p className={proof.amount_idr === inv.amount_idr ? "font-bold text-white" : "font-bold text-rose-300"}>
                      {formatRupiah(proof.amount_idr)}
                      {proof.amount_idr !== inv.amount_idr ? " (berbeda)" : ""}
                    </p>
                  </div>
                  <div>
                    <p className="text-[11px] font-bold text-amber-200/70">Tanggal transfer</p>
                    <p className="text-amber-100">{longDate(proof.transfer_date)}</p>
                  </div>
                  <div>
                    <p className="text-[11px] font-bold text-amber-200/70">Dikirim</p>
                    <p className="text-amber-100">{formatDateTime(proof.created_at)}</p>
                  </div>
                </div>
              )}
              {inv.proofs.some((p) => p.status === "rejected") && (
                <p className="mt-3 text-xs text-amber-200/70">
                  Ditolak sebelumnya: {inv.proofs.filter((p) => p.status === "rejected").map((p) => p.reject_reason).join("; ")}
                </p>
              )}
              {pending && (
                <div className="mt-4">
                  <PaymentDecision proofId={pending.id} />
                </div>
              )}
            </Panel>
          );
        })
      )}
    </div>
  );
}

export async function TutorClasses({ viewer }: { viewer: Viewer }) {
  const batches = await listBatches({ tutorId: viewer.id, status: ["draft", "open", "running", "completed"] });
  const rosters = await Promise.all(batches.map((b) => batchRoster(b.id)));
  return (
    <div className="fade-in mx-auto max-w-5xl space-y-6">
      <PageHeader title="Kelas saya" subtitle="Batch yang ditugaskan kepadamu beserta siswanya." />
      {batches.length === 0 && <EmptyState icon="layers" title="Belum ada batch yang ditugaskan" text="Admin akan menugaskanmu ke batch; kamu mendapat pemberitahuan saat itu terjadi." />}
      {batches.map((b, i) => {
        const students = rosters[i].filter((r) => r.status === "active" || r.status === "completed");
        return (
          <Panel key={b.id}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-xs font-bold text-amber-200/80">Batch {b.code}</p>
                <p className="text-lg font-black text-orange">{b.program.name}</p>
                <p className="text-xs text-amber-100">
                  Mulai {longDate(b.start_date)} · {b.schedule_label} · {b.session_count} sesi
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <BatchBadge status={b.status} />
                {b.meeting_url && (
                  <a href={b.meeting_url} target="_blank" rel="noopener noreferrer" className="btn-orange rounded-full px-4 py-2 text-xs">
                    Buka link kelas
                  </a>
                )}
              </div>
            </div>
            <div className="mt-4 border-t border-orange/15 pt-4">
              {students.length === 0 ? (
                <p className="text-sm text-slate-400">Belum ada siswa yang pembayarannya terverifikasi.</p>
              ) : (
                <ul className="grid gap-2 sm:grid-cols-2">
                  {students.map((r) => (
                    <li key={r.id} className="lp-card-soft flex items-center justify-between px-4 py-3 text-sm">
                      <span className="font-bold text-white">{r.student.full_name}</span>
                      <span className="font-black text-orange">{r.level ?? "-"}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </Panel>
        );
      })}
    </div>
  );
}

export async function OwnerSettings() {
  const [settings, notes, backup] = await Promise.all([paymentSettings(), recentNotifications(30), createAdminClient().from("site_settings").select("value").eq("key", "backup").maybeSingle()]);
  const lastBackup = (backup.data?.value as { last_at?: string } | undefined)?.last_at;
  const email = emailConfigured();
  const wa = whatsappConfigured();
  return (
    <div className="fade-in mx-auto max-w-5xl space-y-6">
      <PageHeader title="Pengaturan" subtitle="Rekening tujuan transfer, backup data, template notifikasi, dan status pengiriman notifikasi." />
      {!settings.account_number && <Notice>Rekening tujuan belum diisi. Siswa melihat pesan &quot;rekening sedang disiapkan&quot; di halaman pembayaran.</Notice>}
      <Panel title="Rekening tujuan transfer">
        <PaymentSettingsForm initial={settings} />
      </Panel>
      <section id="backup">
        <Panel title="Backup data">
          <p className="text-sm text-amber-100">
            Satu file ZIP berisi semua data (siswa, kelas, pembayaran, nilai, laporan, keuangan, dan lainnya) dalam format CSV yang bisa dibuka di Google Sheets atau Excel. Simpan
            salinannya di Google Drive. Sistem mengingatkan lewat email bila backup terakhir lebih dari 30 hari.
          </p>
          <p className="mt-2 text-xs text-slate-400">
            File unggahan (rekaman, bukti bayar, materi, PDF laporan) tidak ikut di ZIP; tetap tersimpan di Supabase Storage. File ini berisi data pribadi: simpan di folder Drive yang hanya bisa
            dibuka Owner.
          </p>
          <div className="mt-4 flex flex-wrap items-center gap-4">
            <a href="/api/owner/backup" className="btn-orange rounded-full px-6 py-2.5 text-sm">
              Unduh backup (.zip)
            </a>
            <span className="text-xs text-amber-200/80">{lastBackup ? `Backup terakhir: ${formatDateTime(lastBackup)}` : "Belum pernah backup."}</span>
          </div>
        </Panel>
      </section>
      <section id="template">
        <Panel title="Template notifikasi">
          <NotificationTemplates />
        </Panel>
      </section>
      <Panel title="Notifikasi">
        <div className="mb-5 grid gap-3 sm:grid-cols-2">
          <div className="lp-card-soft p-4 text-sm">
            <p className="font-black text-white">Email (Resend)</p>
            <p className={email ? "text-emerald-300" : "text-amber-200"}>{email ? "Aktif, email terkirim otomatis" : "Belum dikonfigurasi. Isi RESEND_API_KEY dan EMAIL_FROM."}</p>
          </div>
          <div className="lp-card-soft p-4 text-sm">
            <p className="font-black text-white">WhatsApp (Fonnte)</p>
            <p className={wa ? "text-emerald-300" : "text-amber-200"}>{wa ? "Aktif, WhatsApp terkirim otomatis" : "Belum dikonfigurasi. Isi FONNTE_TOKEN."}</p>
          </div>
        </div>
        <p className="mb-3 text-xs text-slate-400">Pesan yang belum terkirim tetap tercatat di bawah, sehingga isi dan penerimanya bisa diperiksa.</p>
        <NotificationList rows={notes} />
      </Panel>
    </div>
  );
}
