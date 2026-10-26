import Link from "next/link";
import { Icon } from "@/components/icons";
import { bankLine, batchSessions, listBatches, longDate, paymentSettings, studentEnrollments, type EnrollmentView } from "@/lib/classes";
import { formatRupiah } from "@/lib/content";
import type { AttemptRow } from "@/lib/placement/server";
import { latestReports } from "@/lib/reports";
import type { Viewer } from "@/lib/session";
import { guardianChildren, ownStudent, type StudentRow } from "@/lib/students";
import { createAdminClient } from "@/lib/supabase/admin";
import { Badge, EmptyState, formatDateTime, Notice, PageHeader, Panel, Tabs } from "../ui";
import { BatchPicker, CopyButton, OnboardingButton, ProofForm, type PickableBatch } from "./class-forms";

export type Learner = { student: StudentRow; attempt: AttemptRow | null; linkStatus?: string };

export async function loadLearners(viewer: Viewer, role: "student" | "guardian"): Promise<Learner[]> {
  if (role === "student") {
    const { student, attempt } = await ownStudent(viewer.id);
    return student ? [{ student, attempt }] : [];
  }
  return (await guardianChildren(viewer.id)).map((c) => ({ student: c.student, attempt: c.attempt, linkStatus: c.link.status }));
}

// Pendaftaran yang paling perlu diperhatikan: yang menunggu pembayaran, lalu kelas aktif, lalu yang selesai.
export function currentEnrollment<T extends { status: string }>(list: T[]): T | null {
  for (const status of ["pending_payment", "awaiting_verification", "active", "completed"]) {
    const found = list.find((e) => e.status === status);
    if (found) return found;
  }
  return null;
}

const ENROLLMENT_BADGE: Record<string, { label: string; tone: "orange" | "green" | "amber" | "slate" | "red" }> = {
  pending_payment: { label: "Menunggu pembayaran", tone: "amber" },
  awaiting_verification: { label: "Menunggu verifikasi", tone: "orange" },
  active: { label: "Aktif", tone: "green" },
  completed: { label: "Selesai", tone: "slate" },
  cancelled: { label: "Dibatalkan", tone: "red" },
  expired: { label: "Kedaluwarsa", tone: "red" },
};

export function EnrollmentBadge({ status }: { status: string }) {
  const b = ENROLLMENT_BADGE[status] ?? { label: status, tone: "slate" as const };
  return <Badge tone={b.tone}>{b.label}</Badge>;
}

const INVOICE_BADGE: Record<string, { label: string; tone: "orange" | "green" | "amber" | "slate" | "red" }> = {
  unpaid: { label: "Belum dibayar", tone: "amber" },
  awaiting_verification: { label: "Menunggu verifikasi", tone: "orange" },
  paid: { label: "Lunas", tone: "green" },
  expired: { label: "Kedaluwarsa", tone: "red" },
  cancelled: { label: "Dibatalkan", tone: "red" },
};

export function InvoiceBadge({ status }: { status: string }) {
  const b = INVOICE_BADGE[status] ?? { label: status, tone: "slate" as const };
  return <Badge tone={b.tone}>{b.label}</Badge>;
}

function Eyebrow({ children }: { children: React.ReactNode }) {
  return <p className="text-[11px] font-black uppercase tracking-[0.2em] text-amber-200/80">{children}</p>;
}

// Langkah berikutnya setelah placement terbit: pilih kelas, bayar, onboarding, lalu kelas berjalan.
export async function ClassStep({ learner, enrollment, base, query = "" }: { learner: Learner; enrollment: EnrollmentView | null; base: string; query?: string }) {
  const who = learner.linkStatus ? learner.student.full_name : "";
  if (!enrollment) {
    if (learner.linkStatus && learner.linkStatus !== "verified") {
      return (
        <div>
          <Eyebrow>Menunggu admin</Eyebrow>
          <p className="mt-1 text-lg font-black text-white">Hubungan wali dengan {who} sedang diverifikasi</p>
          <p className="text-sm text-slate-400">Setelah diverifikasi admin, kamu bisa memilih jadwal kelas untuk {who}. Tim kami dapat menghubungimu lewat WhatsApp untuk konfirmasi.</p>
        </div>
      );
    }
    return (
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <Eyebrow>Langkah berikutnya</Eyebrow>
          <p className="mt-1 text-lg font-black text-white">Pilih jadwal kelas{who ? ` untuk ${who}` : ""}</p>
          <p className="text-sm text-slate-400">Program yang direkomendasikan placement ditampilkan paling atas.</p>
        </div>
        <Link href={`${base}/program${query}`} className="btn-orange flex items-center gap-2 rounded-full px-6 py-3 text-sm">
          Pilih kelas <Icon name="arrow" className="h-4 w-4" />
        </Link>
      </div>
    );
  }

  const { batch, invoice } = enrollment;
  if (enrollment.status === "pending_payment" && invoice) {
    return (
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <Eyebrow>Langkah berikutnya</Eyebrow>
          <p className="mt-1 text-lg font-black text-white">
            Bayar {formatRupiah(invoice.amount_idr)} untuk {batch.program.name}
          </p>
          <p className="text-sm text-slate-400">Kursi dipegang sampai {formatDateTime(invoice.due_at)}.</p>
          {invoice.reject_reason && <p className="mt-2 text-sm font-bold text-rose-300">Bukti sebelumnya ditolak: {invoice.reject_reason}</p>}
        </div>
        <Link href={`${base}/pembayaran?invoice=${invoice.id}`} className="btn-orange flex items-center gap-2 rounded-full px-6 py-3 text-sm">
          {invoice.reject_reason ? "Unggah ulang bukti" : "Bayar sekarang"} <Icon name="arrow" className="h-4 w-4" />
        </Link>
      </div>
    );
  }
  if (enrollment.status === "awaiting_verification") {
    return (
      <div>
        <Eyebrow>Sedang diproses</Eyebrow>
        <p className="mt-1 text-lg font-black text-white">Bukti transfer sedang diverifikasi admin</p>
        <p className="text-sm text-slate-400">
          Kelas {batch.program.name} (batch {batch.code}) aktif setelah pembayaran diverifikasi. Kamu akan menerima pemberitahuan.
        </p>
      </div>
    );
  }
  if (enrollment.status === "active" && !enrollment.onboarded_at) return <Onboarding enrollment={enrollment} who={who} />;
  if (enrollment.status === "active") {
    const sessions = await batchSessions(batch.id);
    const next = sessions.find((s) => Date.parse(s.starts_at) + s.duration_minutes * 60000 > Date.now());
    return (
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <Eyebrow>Kelas aktif · {batch.program.name}</Eyebrow>
          <p className="mt-1 text-lg font-black text-white">{next ? `Sesi ${next.seq}: ${formatDateTime(next.starts_at)}` : "Semua sesi sudah berlangsung"}</p>
          <p className="text-sm text-slate-400">
            {batch.schedule_label} · tutor {batch.tutor?.full_name ?? "segera diumumkan"}
          </p>
        </div>
        {batch.meeting_url && (
          <a href={batch.meeting_url} target="_blank" rel="noopener noreferrer" className="btn-orange flex items-center gap-2 rounded-full px-6 py-3 text-sm">
            Masuk kelas <Icon name="arrow" className="h-4 w-4" />
          </a>
        )}
      </div>
    );
  }
  const { data: report } = await createAdminClient().from("reports").select("id, status").eq("enrollment_id", enrollment.id).maybeSingle();
  if (report?.status === "published") {
    const latest = (await latestReports([learner.student.id])).get(learner.student.id);
    const reportHref = base.endsWith("guardian") ? `${base}/progres${query}` : `${base}/laporan`;
    return (
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <Eyebrow>Program selesai · laporan terbit</Eyebrow>
          <p className="mt-1 text-lg font-black text-white">
            {batch.program.name} selesai{latest?.overall ? ` · level akhir ${latest.overall}` : ""}
          </p>
          <p className="text-sm text-slate-400">Baca laporan dan unduh PDF-nya, lalu lanjutkan ke program yang direkomendasikan tanpa placement ulang.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href={reportHref} className="rounded-full border border-orange/40 px-5 py-3 text-sm font-black text-orange hover:bg-orange/10">
            Lihat laporan
          </Link>
          <Link href={`${base}/program${query}`} className="btn-orange flex items-center gap-2 rounded-full px-6 py-3 text-sm">
            Ambil program <Icon name="arrow" className="h-4 w-4" />
          </Link>
        </div>
      </div>
    );
  }
  return (
    <div>
      <Eyebrow>Program selesai</Eyebrow>
      <p className="mt-1 text-lg font-black text-white">{batch.program.name} selesai, laporan sedang disiapkan tutor</p>
      <p className="text-sm text-slate-400">Laporan akhir disusun tutor dan tampil di portal setelah ditinjau Academic Lead. Kamu akan menerima pemberitahuan saat laporan terbit.</p>
    </div>
  );
}

async function Onboarding({ enrollment, who }: { enrollment: EnrollmentView; who: string }) {
  const { batch } = enrollment;
  const sessions = await batchSessions(batch.id);
  return (
    <div className="space-y-5">
      <div>
        <Eyebrow>Selamat datang</Eyebrow>
        <p className="mt-1 text-2xl font-black text-orange">
          {who ? `${who} resmi bergabung di ` : "Kamu resmi bergabung di "}
          {batch.program.name}!
        </p>
        <p className="text-sm text-slate-400">Pembayaran sudah diverifikasi. Berikut yang perlu diketahui sebelum sesi pertama.</p>
      </div>
      <dl className="grid gap-3 sm:grid-cols-2">
        <div className="lp-card-soft p-4">
          <dt className="text-[11px] font-bold text-amber-200/70">Tutor</dt>
          <dd className="font-black text-white">{batch.tutor?.full_name ?? "Diumumkan sebelum kelas mulai"}</dd>
        </div>
        <div className="lp-card-soft p-4">
          <dt className="text-[11px] font-bold text-amber-200/70">Jadwal</dt>
          <dd className="font-black text-white">{batch.schedule_label}</dd>
          <dd className="text-xs text-amber-100">
            Mulai {longDate(batch.start_date)} · {sessions.length} sesi
          </dd>
        </div>
        <div className="lp-card-soft p-4">
          <dt className="text-[11px] font-bold text-amber-200/70">Link kelas</dt>
          <dd className="break-all text-sm font-bold text-orange">
            {batch.meeting_url ? (
              <a href={batch.meeting_url} target="_blank" rel="noopener noreferrer">
                {batch.meeting_url}
              </a>
            ) : (
              <span className="text-amber-100">Dibagikan sebelum sesi pertama</span>
            )}
          </dd>
        </div>
        <div className="lp-card-soft p-4">
          <dt className="text-[11px] font-bold text-amber-200/70">Target di akhir program</dt>
          <dd className="text-sm text-amber-100">{batch.program.outcome}</dd>
        </div>
      </dl>
      {sessions.length > 0 && (
        <div>
          <p className="mb-2 text-xs font-black uppercase tracking-[0.18em] text-amber-200/80">Sesi pertama</p>
          <ul className="space-y-1 text-sm text-amber-100">
            {sessions.slice(0, 3).map((s) => (
              <li key={s.id}>
                Sesi {s.seq} · {formatDateTime(s.starts_at)} · {s.duration_minutes} menit
              </li>
            ))}
          </ul>
        </div>
      )}
      <p className="text-sm text-amber-100">Di sesi pertama, tutor merekam kemampuan awal (baseline) sebagai pembanding di laporan akhir. Siapkan headset dan koneksi yang stabil.</p>
      <OnboardingButton enrollmentId={enrollment.id} />
    </div>
  );
}

function childQuery(role: "student" | "guardian", studentId: string) {
  return role === "guardian" ? `?anak=${studentId}` : "";
}

export function ChildTabs({ learners, active, base, section }: { learners: Learner[]; active: string; base: string; section: string }) {
  if (learners.length < 2) return null;
  return <Tabs active={active} tabs={learners.map((l) => ({ key: l.student.id, label: l.student.full_name, href: `${base}/${section}?anak=${l.student.id}` }))} />;
}

// Halaman Pilih Program / Program Saya (siswa) dan Program Anak (wali).
export async function ProgramPage({ viewer, role, params }: { viewer: Viewer; role: "student" | "guardian"; params: Record<string, string | undefined> }) {
  const learners = await loadLearners(viewer, role);
  const base = `/portal/${role}`;
  if (!learners.length) {
    return <EmptyState icon="users" title={role === "guardian" ? "Belum ada anak terdaftar" : "Profil siswa belum tersedia"} text={role === "guardian" ? "Tambahkan anak dari menu Anak Saya." : undefined} />;
  }
  const learner = learners.find((l) => l.student.id === params.anak) ?? learners[0];
  const [enrollments, batches, reports] = await Promise.all([studentEnrollments([learner.student.id]), listBatches({ status: ["open"] }), latestReports([learner.student.id])]);
  const published = learner.attempt?.status === "published" ? learner.attempt : null;
  const hasCompleted = enrollments.some((e) => e.status === "completed");
  // Level dan rekomendasi diambil dari laporan terakhir; tanpa laporan, dari hasil placement.
  const report = reports.get(learner.student.id);
  const recommended = new Set(report?.recommended_program_ids.length ? report.recommended_program_ids : (published?.recommended_program_ids ?? []));
  const level = report?.overall ?? published?.levels.overall ?? null;
  const taken = new Set(enrollments.filter((e) => ["pending_payment", "awaiting_verification", "active", "completed"].includes(e.status)).map((e) => e.batch.id));
  const pickable: PickableBatch[] = batches
    .filter((b) => !taken.has(b.id))
    .map((b) => ({
      id: b.id,
      code: b.code,
      programName: b.program.name,
      category: b.program.category,
      entryLevel: b.program.entry_level,
      price: b.program.price_idr,
      startLabel: longDate(b.start_date),
      schedule: b.schedule_label,
      sessions: b.session_count,
      tutor: b.tutor?.full_name ?? null,
      seatsLeft: b.capacity - b.seats_taken,
      recommended: recommended.has(b.program_id),
    }))
    .sort((a, b) => Number(b.recommended) - Number(a.recommended));
  const visible = enrollments.filter((e) => e.status !== "expired" && e.status !== "cancelled");
  const canPick = (published || hasCompleted) && (!learner.linkStatus || learner.linkStatus === "verified");
  const who = learner.linkStatus ? learner.student.full_name : "";

  return (
    <div className="fade-in mx-auto max-w-5xl space-y-6">
      <PageHeader
        title={role === "guardian" ? "Program anak" : visible.some((e) => e.status === "active" || e.status === "completed") ? "Program saya" : "Pilih program"}
        subtitle="Pilih batch sesuai jadwal. Kursi dipegang 2x24 jam setelah invoice terbit."
      />
      <ChildTabs learners={learners} active={learner.student.id} base={base} section="program" />
      {visible.length > 0 && (
        <Panel title={who ? `Program ${who}` : "Program saya"}>
          <ul className="divide-y divide-orange/10">
            {visible.map((e) => (
              <li key={e.id} className="flex flex-wrap items-center justify-between gap-3 py-4">
                <div>
                  <p className="font-black text-white">
                    {e.batch.program.name} <span className="text-xs font-bold text-slate-400">· batch {e.batch.code}</span>
                  </p>
                  <p className="text-xs text-amber-200/80">
                    Mulai {longDate(e.batch.start_date)} · {e.batch.schedule_label} · tutor {e.batch.tutor?.full_name ?? "segera diumumkan"}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <EnrollmentBadge status={e.status} />
                  {e.status === "pending_payment" && e.invoice && (
                    <Link href={`${base}/pembayaran?invoice=${e.invoice.id}`} className="btn-orange rounded-full px-4 py-2 text-xs">
                      Bayar
                    </Link>
                  )}
                  {e.status === "active" && e.batch.meeting_url && (
                    <a href={e.batch.meeting_url} target="_blank" rel="noopener noreferrer" className="btn-orange rounded-full px-4 py-2 text-xs">
                      Masuk kelas
                    </a>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </Panel>
      )}
      <Panel title="Batch yang membuka pendaftaran">
        {!published && !hasCompleted ? (
          <EmptyState icon="test" title="Selesaikan placement test dulu" text="Pemilihan kelas terbuka setelah hasil placement terbit, supaya kelas sesuai level." />
        ) : !canPick ? (
          <Notice>Hubungan wali dengan {who} masih menunggu verifikasi admin. Batch bisa dipilih setelah diverifikasi.</Notice>
        ) : pickable.length === 0 ? (
          <EmptyState icon="calendar" title="Belum ada batch yang dibuka" text="Batch baru diumumkan di sini. Kamu juga bisa menghubungi kami lewat WhatsApp untuk jadwal berikutnya." />
        ) : (
          <div className="grid gap-4 lg:grid-cols-2">
            {pickable.map((b) => (
              <BatchPicker key={b.id} studentId={learner.student.id} batch={b} level={level} payHref={`${base}/pembayaran`} />
            ))}
          </div>
        )}
      </Panel>
    </div>
  );
}

// Halaman Pembayaran siswa/wali: tagihan, instruksi transfer, unggah bukti, status, kuitansi.
export async function PaymentPage({ viewer, role, params }: { viewer: Viewer; role: "student" | "guardian"; params: Record<string, string | undefined> }) {
  const learners = await loadLearners(viewer, role);
  const [enrollments, settings] = await Promise.all([studentEnrollments(learners.map((l) => l.student.id)), paymentSettings()]);
  const invoices = enrollments.filter((e) => e.invoice).map((e) => ({ ...e.invoice!, enrollment: e, learner: learners.find((l) => l.student.id === e.student_id)! }));
  const ids = invoices.map((i) => i.id);
  const { data: proofs } = ids.length
    ? await createAdminClient().from("payment_proofs").select("invoice_id, sender_bank, sender_name, amount_idr, transfer_date, status, created_at").in("invoice_id", ids).order("created_at", { ascending: false })
    : { data: [] };
  const unpaid = invoices.filter((i) => i.status === "unpaid");
  const waiting = invoices.filter((i) => i.status === "awaiting_verification");
  const history = invoices.filter((i) => i.status !== "unpaid" && i.status !== "awaiting_verification");
  const bank = bankLine(settings);

  return (
    <div className="fade-in mx-auto max-w-5xl space-y-6">
      <PageHeader title="Pembayaran" subtitle="Transfer manual, lalu unggah bukti. Admin memverifikasi dan kelas langsung aktif." />
      {invoices.length === 0 && <EmptyState icon="wallet" title="Belum ada tagihan" text="Tagihan terbit otomatis saat kamu memilih batch di menu program." />}
      {unpaid.map((inv) => (
        <Panel key={inv.id} className={params.invoice === inv.id ? "ring-2 ring-orange" : ""}>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs font-bold text-amber-200/80">{inv.number}</p>
              <p className="text-lg font-black text-white">{inv.description}</p>
            </div>
            <InvoiceBadge status={inv.status} />
          </div>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div className="rounded-2xl bg-orange px-5 py-4 text-navy">
              <p className="text-[11px] font-black uppercase tracking-[0.18em]">Total transfer</p>
              <p className="text-3xl font-black">{formatRupiah(inv.amount_idr)}</p>
              <p className="mt-1 text-xs font-bold">Bayar sebelum {formatDateTime(inv.due_at)}</p>
            </div>
            <div className="lp-card-soft p-4 text-sm">
              <p className="text-[11px] font-bold text-amber-200/70">Transfer ke</p>
              {bank ? (
                <>
                  <p className="font-black text-white">{settings.bank_name}</p>
                  <p className="flex items-center gap-2 font-mono text-lg font-black text-orange">
                    {settings.account_number} <CopyButton text={settings.account_number.replace(/\D/g, "")} />
                  </p>
                  <p className="text-amber-100">a.n. {settings.account_name}</p>
                  {settings.note && <p className="mt-2 text-xs text-amber-200/80">{settings.note}</p>}
                </>
              ) : (
                <p className="text-amber-100">Rekening tujuan sedang disiapkan. Hubungi kami lewat WhatsApp untuk instruksi transfer.</p>
              )}
            </div>
          </div>
          {inv.reject_reason && <Notice tone="red">Bukti sebelumnya ditolak: {inv.reject_reason}. Unggah ulang bukti yang benar.</Notice>}
          <div className="mt-5 border-t border-orange/15 pt-5">
            <ProofForm invoiceId={inv.id} amount={inv.amount_idr} />
          </div>
        </Panel>
      ))}
      {waiting.length > 0 && (
        <Panel title="Menunggu verifikasi">
          <ul className="divide-y divide-orange/10">
            {waiting.map((inv) => {
              const p = proofs?.find((x) => x.invoice_id === inv.id);
              return (
                <li key={inv.id} className={`flex flex-wrap items-center justify-between gap-3 py-4 ${params.invoice === inv.id ? "rounded-xl bg-orange/10 px-3" : ""}`}>
                  <div>
                    <p className="font-bold text-white">
                      {inv.number} · {formatRupiah(inv.amount_idr)}
                    </p>
                    <p className="text-xs text-amber-200/80">
                      {inv.description}
                      {p ? ` · dikirim ${formatDateTime(p.created_at)} dari ${p.sender_bank} a.n. ${p.sender_name}` : ""}
                    </p>
                  </div>
                  <InvoiceBadge status={inv.status} />
                </li>
              );
            })}
          </ul>
        </Panel>
      )}
      {history.length > 0 && (
        <Panel title="Riwayat">
          <ul className="divide-y divide-orange/10">
            {history.map((inv) => (
              <li key={inv.id} className="flex flex-wrap items-center justify-between gap-3 py-4">
                <div>
                  <p className="font-bold text-white">
                    {inv.number} · {formatRupiah(inv.amount_idr)}
                  </p>
                  <p className="text-xs text-amber-200/80">
                    {inv.description}
                    {inv.paid_at ? ` · lunas ${formatDateTime(inv.paid_at)}` : ""}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <InvoiceBadge status={inv.status} />
                  {inv.status === "paid" && (
                    <Link href={`/kuitansi/${inv.id}`} target="_blank" className="rounded-full border border-orange/40 px-4 py-2 text-xs font-black text-orange hover:bg-orange/10">
                      Kuitansi
                    </Link>
                  )}
                  {inv.status === "expired" && (
                    <Link href={`/portal/${role}/program${childQuery(role, inv.learner.student.id)}`} className="rounded-full border border-orange/40 px-4 py-2 text-xs font-black text-orange hover:bg-orange/10">
                      Pilih batch lagi
                    </Link>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </Panel>
      )}
    </div>
  );
}
