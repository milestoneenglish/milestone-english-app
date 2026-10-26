import "server-only";
import { notify, roleRecipients, studentRecipients } from "@/lib/notify";
import { generateSessions, scheduleLabel } from "@/lib/schedule";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

// Batch, pendaftaran kelas, dan pembayaran. Perubahan status memakai fungsi database
// (enroll_in_batch, submit_payment_proof, decide_payment) dengan sesi pengguna, sehingga
// hak akses dan kapasitas diperiksa di database. Bacaan memakai klien admin setelah
// pemanggil memeriksa aksesnya.

export class ClassError extends Error {}

export const PROOF_BUCKET = "payment-proofs";
const PROOF_TYPES: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "application/pdf": "pdf" };
const PROOF_MAX_BYTES = 5 * 1024 * 1024;

const DATE_FMT = new Intl.DateTimeFormat("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Jakarta" });
const DATETIME_FMT = new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Jakarta" });
export const longDate = (date: string) => DATE_FMT.format(new Date(`${date}T00:00:00+07:00`));
const shortDateTime = (iso: string) => `${DATETIME_FMT.format(new Date(iso))} WIB`;

// Pesan dari fungsi database sudah berbahasa Indonesia dan aman ditampilkan.
export function dbError(error: { code?: string; message: string } | null, fallback: string): never {
  if (error && ["42501", "22023", "23505"].includes(error.code ?? "")) throw new ClassError(error.message);
  if (error) console.error(error);
  throw new ClassError(fallback);
}

// ---------------------------------------------------------------------------
// Pengaturan pembayaran (diisi Owner)
// ---------------------------------------------------------------------------

export type PaymentSettings = { bank_name: string; account_number: string; account_name: string; note: string };
const EMPTY_PAYMENT: PaymentSettings = { bank_name: "", account_number: "", account_name: "", note: "" };

export async function paymentSettings(): Promise<PaymentSettings> {
  const { data } = await createAdminClient().from("site_settings").select("value").eq("key", "payment").maybeSingle();
  return { ...EMPTY_PAYMENT, ...((data?.value as Partial<PaymentSettings>) ?? {}) };
}

export function bankLine(p: PaymentSettings) {
  return p.bank_name && p.account_number ? `${p.bank_name} ${p.account_number} a.n. ${p.account_name}` : "";
}

export async function savePaymentSettings(actorId: string, input: PaymentSettings) {
  const value = {
    bank_name: input.bank_name.trim().slice(0, 60),
    account_number: input.account_number.replace(/[^\d-]/g, "").slice(0, 30),
    account_name: input.account_name.trim().slice(0, 120),
    note: input.note.trim().slice(0, 600),
  };
  if (!value.bank_name || !value.account_number || !value.account_name) throw new ClassError("Nama bank, nomor rekening, dan nama pemilik wajib diisi.");
  const supabase = await createClient();
  const { error } = await supabase.from("site_settings").upsert({ key: "payment", value, updated_by: actorId }, { onConflict: "key" });
  if (error) dbError(error, "Pengaturan gagal disimpan.");
  await createAdminClient().from("audit_log").insert({ actor_id: actorId, action: "payment_settings_updated", entity: "site_settings", entity_id: "payment" });
}

// ---------------------------------------------------------------------------
// Batch
// ---------------------------------------------------------------------------

export type ProgramInfo = { id: string; code: string; slug: string; name: string; category: string; price_idr: number; duration_label: string; outcome: string; entry_level: string; capacity: number };

export type BatchRow = {
  id: string;
  code: string;
  program_id: string;
  tutor_id: string | null;
  curriculum_id: string | null;
  start_date: string;
  schedule_label: string;
  meeting_url: string | null;
  capacity: number;
  status: "draft" | "open" | "running" | "completed" | "cancelled";
  notes: string;
  program: ProgramInfo;
  tutor: { full_name: string; email: string } | null;
  seats_taken: number;
  first_session: string | null;
  session_count: number;
};

const BATCH_SELECT =
  "id, code, program_id, tutor_id, curriculum_id, start_date, schedule_label, meeting_url, capacity, status, notes, program:programs(id, code, slug, name, category, price_idr, duration_label, outcome, entry_level, capacity), tutor:profiles!batches_tutor_id_fkey(full_name, email), class_sessions(starts_at)";

type RawBatch = Omit<BatchRow, "seats_taken" | "first_session" | "session_count"> & { class_sessions: { starts_at: string }[] };

async function withSeats(rows: RawBatch[]): Promise<BatchRow[]> {
  if (!rows.length) return [];
  const { data } = await createAdminClient()
    .from("enrollments")
    .select("batch_id")
    .in("batch_id", rows.map((r) => r.id))
    .in("status", ["pending_payment", "awaiting_verification", "active"]);
  return rows.map(({ class_sessions, ...b }) => {
    const sorted = (class_sessions ?? []).map((s) => s.starts_at).sort();
    return { ...b, seats_taken: (data ?? []).filter((e) => e.batch_id === b.id).length, first_session: sorted[0] ?? null, session_count: sorted.length };
  });
}

// Pembaruan status yang dihitung saat data dibaca: invoice kedaluwarsa dan status batch sesuai jadwal.
export async function releaseExpired() {
  const admin = createAdminClient();
  await Promise.all([admin.rpc("release_expired_invoices"), admin.rpc("sync_batch_status")]);
}

export async function listBatches(filter: { status?: string[]; tutorId?: string; programIds?: string[] } = {}): Promise<BatchRow[]> {
  await releaseExpired();
  let q = createAdminClient().from("batches").select(BATCH_SELECT).order("start_date", { ascending: true });
  if (filter.status) q = q.in("status", filter.status);
  if (filter.tutorId) q = q.eq("tutor_id", filter.tutorId);
  if (filter.programIds) q = q.in("program_id", filter.programIds);
  const { data, error } = await q;
  if (error) dbError(error, "Daftar batch gagal dimuat.");
  return withSeats((data ?? []) as unknown as RawBatch[]);
}

export async function getBatch(id: string): Promise<BatchRow | null> {
  const { data } = await createAdminClient().from("batches").select(BATCH_SELECT).eq("id", id).maybeSingle();
  return data ? (await withSeats([data as unknown as RawBatch]))[0] : null;
}

export type SessionRow = { id: string; seq: number; starts_at: string; duration_minutes: number; topic: string };

export async function batchSessions(batchId: string): Promise<SessionRow[]> {
  const { data } = await createAdminClient().from("class_sessions").select("id, seq, starts_at, duration_minutes, topic").eq("batch_id", batchId).order("seq");
  return (data ?? []) as SessionRow[];
}

export type RosterRow = { id: string; status: string; created_at: string; onboarded_at: string | null; student: { id: string; full_name: string; birth_year: number | null }; level: string | null };

export async function batchRoster(batchId: string): Promise<RosterRow[]> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("enrollments")
    .select("id, status, created_at, onboarded_at, student:students(id, full_name, birth_year)")
    .eq("batch_id", batchId)
    .in("status", ["pending_payment", "awaiting_verification", "active", "completed"])
    .order("created_at");
  const rows = (data ?? []) as unknown as Omit<RosterRow, "level">[];
  if (!rows.length) return [];
  const { data: attempts } = await admin
    .from("placement_attempts")
    .select("student_id, levels, published_at")
    .in("student_id", rows.map((r) => r.student.id))
    .eq("status", "published")
    .order("published_at", { ascending: false });
  return rows.map((r) => ({ ...r, level: (attempts?.find((a) => a.student_id === r.student.id)?.levels as { overall?: string } | undefined)?.overall ?? null }));
}

export async function tutors(): Promise<{ id: string; name: string }[]> {
  const admin = createAdminClient();
  const { data: roles } = await admin.from("user_roles").select("user_id").eq("role", "tutor");
  const ids = (roles ?? []).map((r) => r.user_id);
  if (!ids.length) return [];
  const { data } = await admin.from("profiles").select("id, full_name, email").in("id", ids).eq("status", "active").order("full_name");
  return (data ?? []).map((p) => ({ id: p.id, name: p.full_name || p.email }));
}

export type BatchInput = {
  programId: string;
  startDate: string;
  weekdays: number[];
  time: string;
  minutes: number;
  sessions: number;
  capacity: number;
  tutorId: string;
  curriculumId: string;
  meetingUrl: string;
  status: "draft" | "open";
  notes: string;
};

function cleanUrl(url: string) {
  const u = url.trim();
  if (!u) return null;
  if (!/^https:\/\/\S+$/.test(u)) throw new ClassError("Link kelas harus diawali https://, misalnya https://meet.google.com/...");
  return u.slice(0, 300);
}

async function nextBatchCode(programCode: string, startDate: string) {
  const prefix = `${programCode}-${startDate.slice(2, 4)}${startDate.slice(5, 7)}`;
  const { data } = await createAdminClient().from("batches").select("code").like("code", `${prefix}%`);
  const used = new Set((data ?? []).map((b) => b.code));
  for (const letter of "ABCDEFGHIJKLMNOPQRSTUVWXYZ") if (!used.has(prefix + letter)) return prefix + letter;
  throw new ClassError("Terlalu banyak batch untuk program ini di bulan yang sama.");
}

export async function createBatch(actorId: string, input: BatchInput): Promise<string> {
  const admin = createAdminClient();
  const { data: program } = await admin.from("programs").select("id, code, name").eq("id", input.programId).maybeSingle();
  if (!program) throw new ClassError("Pilih program.");
  if (!Number.isInteger(input.minutes) || input.minutes < 15 || input.minutes > 240) throw new ClassError("Durasi sesi 15–240 menit.");
  if (!Number.isInteger(input.capacity) || input.capacity < 1 || input.capacity > 30) throw new ClassError("Kapasitas 1–30 siswa.");
  const sessions = generateSessions({ startDate: input.startDate, weekdays: input.weekdays, time: input.time, count: input.sessions });
  if (!sessions.length) throw new ClassError("Lengkapi tanggal mulai, hari, jam, dan jumlah sesi.");
  if (input.tutorId && !(await tutors()).some((t) => t.id === input.tutorId)) throw new ClassError("Tutor tidak valid.");
  // Dengan kurikulum, sesi ke-n memakai modul ke-n, sehingga jumlah sesi harus sama dengan jumlah modul.
  let modules: { id: string; seq: number; title: string }[] = [];
  if (input.curriculumId) {
    const { data: c } = await admin.from("curricula").select("id, program_id, status").eq("id", input.curriculumId).maybeSingle();
    if (!c || c.program_id !== program.id || c.status === "draft") throw new ClassError("Pilih kurikulum terbit untuk program ini.");
    const { data: mods } = await admin.from("curriculum_modules").select("id, seq, title").eq("curriculum_id", c.id).order("seq");
    modules = mods ?? [];
    if (modules.length !== sessions.length) throw new ClassError(`Kurikulum ini berisi ${modules.length} sesi. Samakan jumlah sesi batch.`);
  }

  const supabase = await createClient();
  const code = await nextBatchCode(program.code, sessions[0].date);
  const label = scheduleLabel(input.weekdays, input.time, input.minutes);
  const { data: batch, error } = await supabase
    .from("batches")
    .insert({
      code,
      program_id: program.id,
      tutor_id: input.tutorId || null,
      curriculum_id: input.curriculumId || null,
      start_date: sessions[0].date,
      schedule_label: label,
      meeting_url: cleanUrl(input.meetingUrl),
      capacity: input.capacity,
      status: input.status,
      notes: input.notes.trim().slice(0, 1000),
      created_by: actorId,
    })
    .select("id")
    .single();
  if (error || !batch) dbError(error, "Batch gagal dibuat.");
  const { error: sessionError } = await supabase
    .from("class_sessions")
    .insert(
      sessions.map((s) => {
        const m = modules.find((x) => x.seq === s.seq);
        return { batch_id: batch.id, seq: s.seq, starts_at: s.starts_at, duration_minutes: input.minutes, module_id: m?.id ?? null, topic: m?.title.slice(0, 200) ?? "" };
      }),
    );
  if (sessionError) {
    await supabase.from("batches").delete().eq("id", batch.id);
    dbError(sessionError, "Jadwal sesi gagal dibuat.");
  }
  await admin.from("audit_log").insert({ actor_id: actorId, action: "batch_created", entity: "batches", entity_id: batch.id, detail: { code } });
  if (input.tutorId) {
    await notify("tutor_assigned", [input.tutorId], { batch: code, program: program.name, start: longDate(sessions[0].date), schedule: label }, { type: "batches", id: batch.id });
  }
  return batch.id;
}

export type BatchPatch = { tutorId: string; meetingUrl: string; capacity: number; status: BatchRow["status"]; notes: string };

export async function updateBatch(actorId: string, batchId: string, patch: BatchPatch) {
  const current = await getBatch(batchId);
  if (!current) throw new ClassError("Batch tidak ditemukan.");
  if (!["draft", "open", "running", "completed", "cancelled"].includes(patch.status)) throw new ClassError("Status tidak valid.");
  if (!Number.isInteger(patch.capacity) || patch.capacity < 1 || patch.capacity > 30) throw new ClassError("Kapasitas 1–30 siswa.");
  if (patch.capacity < current.seats_taken) throw new ClassError(`Kapasitas tidak boleh di bawah jumlah siswa terdaftar (${current.seats_taken}).`);
  if (patch.tutorId && !(await tutors()).some((t) => t.id === patch.tutorId)) throw new ClassError("Tutor tidak valid.");
  const supabase = await createClient();
  const { error } = await supabase
    .from("batches")
    .update({ tutor_id: patch.tutorId || null, meeting_url: cleanUrl(patch.meetingUrl), capacity: patch.capacity, status: patch.status, notes: patch.notes.trim().slice(0, 1000) })
    .eq("id", batchId);
  if (error) dbError(error, "Batch gagal disimpan.");
  await createAdminClient().from("audit_log").insert({ actor_id: actorId, action: "batch_updated", entity: "batches", entity_id: batchId, detail: { status: patch.status } });
  if (patch.tutorId && patch.tutorId !== current.tutor_id) {
    await notify(
      "tutor_assigned",
      [patch.tutorId],
      { batch: current.code, program: current.program.name, start: longDate(current.start_date), schedule: current.schedule_label },
      { type: "batches", id: batchId },
    );
  }
}

// ---------------------------------------------------------------------------
// Pendaftaran kelas siswa
// ---------------------------------------------------------------------------

export type InvoiceRow = {
  id: string;
  number: string;
  enrollment_id: string;
  student_id: string;
  amount_idr: number;
  description: string;
  status: "unpaid" | "awaiting_verification" | "paid" | "expired" | "cancelled";
  due_at: string;
  reject_reason: string | null;
  paid_at: string | null;
  created_at: string;
};

export type EnrollmentView = {
  id: string;
  status: "pending_payment" | "awaiting_verification" | "active" | "completed" | "cancelled" | "expired";
  created_at: string;
  activated_at: string | null;
  onboarded_at: string | null;
  batch: BatchRow;
  invoice: InvoiceRow | null;
};

const INVOICE_COLUMNS = "id, number, enrollment_id, student_id, amount_idr, description, status, due_at, reject_reason, paid_at, created_at";

export async function studentEnrollments(studentIds: string[]): Promise<(EnrollmentView & { student_id: string })[]> {
  if (!studentIds.length) return [];
  await releaseExpired();
  const admin = createAdminClient();
  const { data } = await admin
    .from("enrollments")
    .select(`id, student_id, batch_id, status, created_at, activated_at, onboarded_at, invoice:invoices(${INVOICE_COLUMNS})`)
    .in("student_id", studentIds)
    .order("created_at", { ascending: false });
  const rows = (data ?? []) as unknown as { id: string; student_id: string; batch_id: string; status: EnrollmentView["status"]; created_at: string; activated_at: string | null; onboarded_at: string | null; invoice: InvoiceRow | InvoiceRow[] | null }[];
  if (!rows.length) return [];
  const { data: batches } = await admin.from("batches").select(BATCH_SELECT).in("id", [...new Set(rows.map((r) => r.batch_id))]);
  const full = await withSeats((batches ?? []) as unknown as RawBatch[]);
  return rows.map(({ batch_id, invoice, ...r }) => ({
    ...r,
    batch: full.find((b) => b.id === batch_id)!,
    invoice: Array.isArray(invoice) ? (invoice[0] ?? null) : invoice,
  }));
}

export async function enroll(studentId: string, batchId: string): Promise<string> {
  const supabase = await createClient();
  const { data: invoiceId, error } = await supabase.rpc("enroll_in_batch", { p_student: studentId, p_batch: batchId });
  if (error || !invoiceId) dbError(error, "Pendaftaran kelas gagal. Coba lagi.");
  const { data: inv } = await createAdminClient().from("invoices").select(INVOICE_COLUMNS).eq("id", invoiceId).single();
  if (inv) {
    await notify(
      "invoice_created",
      await studentRecipients(studentId),
      { number: inv.number, description: inv.description, amount: inv.amount_idr, due: shortDateTime(inv.due_at), bank: bankLine(await paymentSettings()) },
      { type: "invoices", id: inv.id },
    );
  }
  return invoiceId as string;
}

// Invoice hanya dimuat bila pengguna saat ini berhak melihatnya (RLS sesi pengguna).
async function ownInvoice(invoiceId: string) {
  const supabase = await createClient();
  const { data } = await supabase.from("invoices").select(INVOICE_COLUMNS).eq("id", invoiceId).maybeSingle();
  if (!data) throw new ClassError("Invoice tidak ditemukan.");
  return data as InvoiceRow;
}

async function ensureProofBucket() {
  const admin = createAdminClient();
  const { data } = await admin.storage.getBucket(PROOF_BUCKET);
  if (!data) await admin.storage.createBucket(PROOF_BUCKET, { public: false, fileSizeLimit: "5MB", allowedMimeTypes: Object.keys(PROOF_TYPES) });
}

export async function proofUploadTarget(invoiceId: string, mime: string, size: number) {
  const inv = await ownInvoice(invoiceId);
  if (inv.status !== "unpaid") throw new ClassError("Invoice ini tidak menunggu pembayaran.");
  const ext = PROOF_TYPES[mime];
  if (!ext) throw new ClassError("Unggah foto (JPG, PNG, WEBP) atau PDF.");
  if (size > PROOF_MAX_BYTES) throw new ClassError("Ukuran file maksimal 5 MB.");
  await ensureProofBucket();
  const path = `${invoiceId}/${Date.now()}.${ext}`;
  const { data, error } = await createAdminClient().storage.from(PROOF_BUCKET).createSignedUploadUrl(path);
  if (error || !data) throw new ClassError("File gagal disiapkan untuk diunggah.");
  return { path, token: data.token };
}

export type ProofInput = { path: string; bank: string; sender: string; transferDate: string; amount: number };

export async function submitProof(invoiceId: string, input: ProofInput) {
  const inv = await ownInvoice(invoiceId);
  const folder = await createAdminClient().storage.from(PROOF_BUCKET).list(invoiceId);
  if (!input.path.startsWith(`${invoiceId}/`) || !folder.data?.some((f) => `${invoiceId}/${f.name}` === input.path)) throw new ClassError("File bukti belum terunggah.");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.transferDate)) throw new ClassError("Isi tanggal transfer.");
  if (!Number.isInteger(input.amount) || input.amount <= 0) throw new ClassError("Isi nominal yang ditransfer.");
  if (input.sender.trim().length < 2) throw new ClassError("Isi nama pemilik rekening pengirim.");
  if (input.bank.trim().length < 2) throw new ClassError("Pilih bank pengirim.");
  const supabase = await createClient();
  const { error } = await supabase.rpc("submit_payment_proof", {
    p_invoice: invoiceId,
    p_path: input.path,
    p_bank: input.bank,
    p_sender: input.sender,
    p_transfer_date: input.transferDate,
    p_amount: input.amount,
  });
  if (error) dbError(error, "Bukti gagal dikirim. Coba lagi.");
  const { data: s } = await createAdminClient().from("students").select("full_name").eq("id", inv.student_id).maybeSingle();
  await notify("proof_submitted", await roleRecipients("admin"), { number: inv.number, name: s?.full_name ?? "", amount: input.amount }, { type: "invoices", id: invoiceId });
}

export async function completeOnboarding(enrollmentId: string) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("complete_onboarding", { p_enrollment: enrollmentId });
  if (error) dbError(error, "Gagal menyimpan. Coba lagi.");
}

// ---------------------------------------------------------------------------
// Verifikasi pembayaran (Admin)
// ---------------------------------------------------------------------------

export type ProofRow = {
  id: string;
  invoice_id: string;
  file_path: string;
  sender_bank: string;
  sender_name: string;
  transfer_date: string;
  amount_idr: number;
  status: "pending" | "approved" | "rejected";
  reject_reason: string | null;
  created_at: string;
  decided_at: string | null;
};

export type PaymentQueueRow = InvoiceRow & {
  student: { id: string; full_name: string };
  enrollment: { status: string; batch: { code: string; program: { name: string } } };
  proofs: ProofRow[];
  contact: { name: string; email: string; phone: string | null } | null;
};

export async function paymentQueue(): Promise<PaymentQueueRow[]> {
  await releaseExpired();
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("invoices")
    .select(
      `${INVOICE_COLUMNS}, student:students(id, full_name, user_id), enrollment:enrollments(status, batch:batches(code, program:programs(name))), proofs:payment_proofs(id, invoice_id, file_path, sender_bank, sender_name, transfer_date, amount_idr, status, reject_reason, created_at, decided_at)`,
    )
    .order("created_at", { ascending: false })
    .limit(500);
  if (error) dbError(error, "Daftar pembayaran gagal dimuat.");
  const rows = (data ?? []) as unknown as (Omit<PaymentQueueRow, "contact"> & { student: { id: string; full_name: string; user_id: string | null } })[];
  const studentIds = rows.map((r) => r.student.id);
  const [{ data: accounts }, { data: links }] = await Promise.all([
    admin.from("profiles").select("id, full_name, email, phone").in("id", rows.map((r) => r.student.user_id).filter(Boolean) as string[]),
    admin.from("guardian_links").select("student_id, guardian:profiles!guardian_links_guardian_id_fkey(full_name, email, phone)").in("student_id", studentIds).neq("status", "rejected"),
  ]);
  return rows.map((r) => {
    const account = accounts?.find((a) => a.id === r.student.user_id);
    const guardian = links?.find((l) => l.student_id === r.student.id)?.guardian as unknown as { full_name: string; email: string; phone: string | null } | undefined;
    const c = account ?? guardian;
    return {
      ...r,
      proofs: [...r.proofs].sort((a, b) => b.created_at.localeCompare(a.created_at)),
      contact: c ? { name: c.full_name, email: c.email, phone: c.phone } : null,
    };
  });
}

export async function proofFileUrl(proofId: string) {
  const { data: proof } = await createAdminClient().from("payment_proofs").select("file_path").eq("id", proofId).maybeSingle();
  if (!proof) throw new ClassError("Bukti tidak ditemukan.");
  const { data } = await createAdminClient().storage.from(PROOF_BUCKET).createSignedUrl(proof.file_path, 600);
  if (!data) throw new ClassError("File bukti tidak tersedia.");
  return data.signedUrl;
}

export async function decidePayment(proofId: string, approve: boolean, reason: string) {
  const supabase = await createClient();
  const { data: invoiceId, error } = await supabase.rpc("decide_payment", { p_proof: proofId, p_approve: approve, p_reason: reason || null });
  if (error || !invoiceId) dbError(error, "Keputusan gagal disimpan.");
  const admin = createAdminClient();
  const { data: inv } = await admin.from("invoices").select(`${INVOICE_COLUMNS}, enrollment:enrollments(batch_id)`).eq("id", invoiceId).single();
  if (!inv) return;
  const recipients = await studentRecipients(inv.student_id);
  if (approve) {
    const batch = await getBatch((inv.enrollment as unknown as { batch_id: string }).batch_id);
    const { data: s } = await admin.from("students").select("full_name").eq("id", inv.student_id).maybeSingle();
    if (batch) {
      await notify(
        "payment_verified",
        recipients,
        { number: inv.number, program: batch.program.name, name: s?.full_name ?? "", start: longDate(batch.start_date), schedule: batch.schedule_label },
        { type: "invoices", id: inv.id },
      );
      if (batch.tutor_id) await notify("tutor_new_student", [batch.tutor_id], { name: s?.full_name ?? "", batch: batch.code, program: batch.program.name }, { type: "batches", id: batch.id });
    }
  } else {
    await notify("payment_rejected", recipients, { number: inv.number, reason: inv.reject_reason ?? reason, due: shortDateTime(inv.due_at) }, { type: "invoices", id: inv.id });
  }
}

// ---------------------------------------------------------------------------
// Ringkasan untuk beranda Admin dan log notifikasi
// ---------------------------------------------------------------------------

export async function adminQueue() {
  await releaseExpired();
  const admin = createAdminClient();
  const weekAgo = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString();
  const [proofs, links, fresh, unpaid, noTutor] = await Promise.all([
    admin.from("payment_proofs").select("id", { count: "exact", head: true }).eq("status", "pending"),
    admin.from("guardian_links").select("id", { count: "exact", head: true }).eq("status", "pending"),
    admin.from("students").select("id", { count: "exact", head: true }).gte("created_at", weekAgo),
    admin.from("invoices").select("id", { count: "exact", head: true }).eq("status", "unpaid"),
    admin.from("batches").select("id", { count: "exact", head: true }).in("status", ["draft", "open"]).is("tutor_id", null),
  ]);
  return { proofs: proofs.count ?? 0, guardians: links.count ?? 0, newStudents: fresh.count ?? 0, unpaid: unpaid.count ?? 0, batchesWithoutTutor: noTutor.count ?? 0 };
}

export type NotificationRow = { id: string; channel: string; destination: string; template: string; subject: string; status: string; error: string | null; created_at: string };

export async function recentNotifications(limit = 50): Promise<NotificationRow[]> {
  const { data } = await createAdminClient()
    .from("notifications")
    .select("id, channel, destination, template, subject, status, error, created_at")
    .order("created_at", { ascending: false })
    .limit(limit);
  return (data ?? []) as NotificationRow[];
}
