import "server-only";
import { ClassError, dbError } from "@/lib/classes";
import { BUCKETS, fileExists, fileExtension, removeFiles, signedDownload, signedUpload } from "@/lib/storage";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { ROLE_LABEL, ROLE_PRIORITY, type Role } from "@/lib/roles";
import { createZip, toCsv } from "@/lib/zip";
import { EXPENSE_CATEGORIES, EXPENSE_LABEL, PROGRAM_CATEGORIES, STAFF_ROLES, type ExpenseCategory, type PeriodKey, type StaffRole } from "@/lib/ops";

// Menu Owner: staf dan role, program dan harga, keuangan, audit log, dashboard bisnis, dan backup.
// Aturan hak akses ada di database (fungsi set_staff_* dan RLS); fungsi di sini menyiapkan data
// dan memanggilnya dengan sesi pengguna.

const audit = (actorId: string, action: string, entity: string, entityId: string | null, detail: object = {}) =>
  createAdminClient().from("audit_log").insert({ actor_id: actorId, action, entity, entity_id: entityId, detail });

// ---------------------------------------------------------------------------
// Waktu (WIB)
// ---------------------------------------------------------------------------

const WIB = "+07:00";
export const monthKey = (d = new Date()) => new Date(d.getTime() + 7 * 3600_000).toISOString().slice(0, 7);
export const monthStart = (key: string) => new Date(`${key}-01T00:00:00${WIB}`);
export function addMonths(key: string, n: number) {
  const [y, m] = key.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + n, 1));
  return d.toISOString().slice(0, 7);
}
export const isMonthKey = (s: string | undefined): s is string => Boolean(s && /^\d{4}-(0[1-9]|1[0-2])$/.test(s));
const MONTH_FMT = new Intl.DateTimeFormat("id-ID", { month: "long", year: "numeric", timeZone: "Asia/Jakarta" });
export const monthLabel = (key: string) => MONTH_FMT.format(monthStart(key));

// ---------------------------------------------------------------------------
// Staf dan role
// ---------------------------------------------------------------------------

export type StaffRow = {
  id: string;
  full_name: string;
  email: string;
  phone: string | null;
  status: "active" | "inactive";
  must_change_password: boolean;
  created_at: string;
  roles: StaffRole[];
  liveBatches: number;
};

export async function listStaff(): Promise<StaffRow[]> {
  const admin = createAdminClient();
  const { data: roleRows } = await admin.from("user_roles").select("user_id, role").in("role", [...STAFF_ROLES]);
  const ids = [...new Set((roleRows ?? []).map((r) => r.user_id as string))];
  if (!ids.length) return [];
  const [{ data: profiles }, { data: batches }] = await Promise.all([
    admin.from("profiles").select("id, full_name, email, phone, status, must_change_password, created_at").in("id", ids),
    admin.from("batches").select("tutor_id").in("tutor_id", ids).in("status", ["draft", "open", "running"]),
  ]);
  return (profiles ?? [])
    .map((p) => ({
      ...(p as Omit<StaffRow, "roles" | "liveBatches">),
      roles: STAFF_ROLES.filter((r) => (roleRows ?? []).some((x) => x.user_id === p.id && x.role === r)),
      liveBatches: (batches ?? []).filter((b) => b.tutor_id === p.id).length,
    }))
    .sort((a, b) => (a.status === b.status ? a.full_name.localeCompare(b.full_name) : a.status === "active" ? -1 : 1));
}

// Sama dengan aturan password di Supabase Auth: minimal 8 karakter, ada huruf dan angka.
export function checkPassword(pw: string) {
  if (pw.length < 8 || !/[A-Za-z]/.test(pw) || !/\d/.test(pw)) throw new ClassError("Password minimal 8 karakter dan berisi huruf serta angka.");
}

function cleanRoles(roles: string[]): StaffRole[] {
  const out = STAFF_ROLES.filter((r) => roles.includes(r));
  if (!out.length) throw new ClassError("Pilih minimal satu role.");
  return out;
}

export type StaffInput = { fullName: string; email: string; phone: string; password: string; roles: string[] };

export async function createStaff(actorId: string, input: StaffInput) {
  const email = input.email.trim().toLowerCase();
  const fullName = input.fullName.trim();
  const phone = input.phone.replace(/[^\d+]/g, "");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new ClassError("Email tidak valid.");
  if (fullName.length < 2 || fullName.length > 120) throw new ClassError("Isi nama lengkap staf.");
  if (phone && !/^\+?\d{8,15}$/.test(phone)) throw new ClassError("Nomor WhatsApp 8–15 digit, contoh 081234567890.");
  checkPassword(input.password);
  const roles = cleanRoles(input.roles);

  const admin = createAdminClient();
  const { data: existing } = await admin.from("profiles").select("id").eq("email", email).maybeSingle();
  if (existing) throw new ClassError("Email ini sudah dipakai akun lain. Gunakan email lain untuk akun staf.");

  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: input.password,
    email_confirm: true,
    user_metadata: { full_name: fullName, phone },
    app_metadata: { provisioned: true, must_change_password: true },
  });
  if (error || !data.user) throw new ClassError(error?.message.includes("already") ? "Email ini sudah terdaftar." : "Akun staf gagal dibuat.");

  const supabase = await createClient();
  const { error: roleError } = await supabase.rpc("set_staff_roles", { p_user: data.user.id, p_roles: roles });
  if (roleError) {
    await admin.auth.admin.deleteUser(data.user.id);
    dbError(roleError, "Role staf gagal disimpan.");
  }
  await admin.from("profiles").update({ must_change_password: true, ...(phone ? { phone } : {}) }).eq("id", data.user.id);
  await audit(actorId, "staff_created", "profiles", data.user.id, { email, roles });
  return data.user.id;
}

async function staffTarget(actorId: string, userId: string) {
  if (userId === actorId) throw new ClassError("Akun sendiri diatur dari halaman profil, bukan dari sini.");
  const { data } = await createAdminClient().from("user_roles").select("role").eq("user_id", userId).in("role", [...STAFF_ROLES]);
  if (!data?.length) throw new ClassError("Akun ini bukan staf.");
}

export async function updateStaff(actorId: string, userId: string, input: { fullName: string; phone: string; roles: string[] }) {
  await staffTarget(actorId, userId);
  const fullName = input.fullName.trim();
  const phone = input.phone.replace(/[^\d+]/g, "");
  if (fullName.length < 2 || fullName.length > 120) throw new ClassError("Isi nama lengkap staf.");
  if (phone && !/^\+?\d{8,15}$/.test(phone)) throw new ClassError("Nomor WhatsApp 8–15 digit, contoh 081234567890.");
  const supabase = await createClient();
  const { error } = await supabase.rpc("set_staff_roles", { p_user: userId, p_roles: cleanRoles(input.roles) });
  if (error) dbError(error, "Role staf gagal disimpan.");
  await createAdminClient().from("profiles").update({ full_name: fullName, phone: phone || null }).eq("id", userId);
}

// Owner membuat password baru; staf wajib menggantinya saat masuk berikutnya.
export async function resetStaffPassword(actorId: string, userId: string, password: string) {
  await staffTarget(actorId, userId);
  checkPassword(password);
  const admin = createAdminClient();
  const { error } = await admin.auth.admin.updateUserById(userId, { password });
  if (error) throw new ClassError("Password gagal diganti.");
  await admin.from("profiles").update({ must_change_password: true }).eq("id", userId);
  await audit(actorId, "staff_password_reset", "profiles", userId);
}

// Nonaktif: status profil diubah (semua akses RLS berhenti) dan sesi login diputus lewat ban di Supabase Auth.
export async function setStaffActive(actorId: string, userId: string, active: boolean) {
  await staffTarget(actorId, userId);
  const supabase = await createClient();
  const { error } = await supabase.rpc("set_staff_active", { p_user: userId, p_active: active });
  if (error) dbError(error, "Status staf gagal diubah.");
  await createAdminClient().auth.admin.updateUserById(userId, { ban_duration: active ? "none" : "876000h" });
}

// ---------------------------------------------------------------------------
// Program dan harga
// ---------------------------------------------------------------------------

export type ProgramRow = {
  id: string;
  code: string;
  slug: string;
  name: string;
  category: string;
  entry_level: string;
  duration_label: string;
  capacity: number;
  price_idr: number;
  outcome: string;
  evidence: string;
  featured: boolean;
  status: "draft" | "active" | "archived";
  sort_order: number;
};

export async function listPrograms(): Promise<ProgramRow[]> {
  const { data } = await createAdminClient().from("programs").select("id, code, slug, name, category, entry_level, duration_label, capacity, price_idr, outcome, evidence, featured, status, sort_order").order("sort_order");
  return (data ?? []) as ProgramRow[];
}

export type ProgramInput = Omit<ProgramRow, "id" | "slug"> & { slug?: string };

const slugify = (s: string) =>
  s
    .normalize("NFKD")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60);

// Owner mengubah semua isi program (RLS programs_owner_write). Harga baru hanya berlaku untuk invoice baru,
// karena invoice menyimpan nominalnya sendiri saat dibuat.
export async function saveProgram(id: string | null, input: ProgramInput) {
  const row = {
    name: input.name.trim(),
    category: input.category,
    entry_level: input.entry_level.trim(),
    duration_label: input.duration_label.trim(),
    capacity: input.capacity,
    price_idr: input.price_idr,
    outcome: input.outcome.trim(),
    evidence: input.evidence.trim(),
    featured: input.featured,
    status: input.status,
    sort_order: input.sort_order,
  };
  if (row.name.length < 2 || row.name.length > 80) throw new ClassError("Nama program 2–80 karakter.");
  if (!(PROGRAM_CATEGORIES as readonly string[]).includes(row.category)) throw new ClassError("Pilih kategori.");
  if (!row.entry_level || !row.duration_label) throw new ClassError("Isi level masuk dan durasi.");
  if (!Number.isInteger(row.capacity) || row.capacity < 1 || row.capacity > 30) throw new ClassError("Kapasitas 1–30 siswa.");
  if (!Number.isInteger(row.price_idr) || row.price_idr < 0 || row.price_idr > 100_000_000) throw new ClassError("Harga tidak valid.");
  if (row.outcome.length < 10 || row.evidence.length < 5) throw new ClassError("Isi target dan bukti program.");
  if (!["draft", "active", "archived"].includes(row.status)) throw new ClassError("Status tidak valid.");
  if (!Number.isInteger(row.sort_order)) row.sort_order = 0;

  const supabase = await createClient();
  if (id) {
    const { error } = await supabase.from("programs").update(row).eq("id", id);
    if (error) dbError(error, "Program gagal disimpan.");
    return id;
  }
  const code = input.code.trim().toUpperCase();
  if (!/^[A-Z]{2,4}$/.test(code)) throw new ClassError("Kode program 2–4 huruf kapital, misalnya SU.");
  const slug = slugify(input.slug || row.name);
  if (!slug) throw new ClassError("Nama program tidak valid.");
  const { data, error } = await supabase.from("programs").insert({ ...row, code, slug }).select("id").single();
  if (error?.code === "23505") throw new ClassError("Kode atau nama program sudah dipakai.");
  if (error || !data) dbError(error, "Program gagal dibuat.");
  return data.id as string;
}

export async function updateProgramDescription(programId: string, outcome: string, evidence: string, outcomeEn = "", evidenceEn = "") {
  const supabase = await createClient();
  const { error } = await supabase.rpc("update_program_description", { p_program: programId, p_outcome: outcome, p_evidence: evidence, p_outcome_en: outcomeEn, p_evidence_en: evidenceEn });
  if (error) dbError(error, "Deskripsi program gagal disimpan.");
}

// ---------------------------------------------------------------------------
// Keuangan
// ---------------------------------------------------------------------------

export type IncomeRow = { id: string; number: string; description: string; amount_idr: number; paid_at: string; student: string };
export type ExpenseRow = { id: string; spent_on: string; category: ExpenseCategory; description: string; amount_idr: number; receipt_path: string | null };

export async function incomeBetween(from: Date, to: Date): Promise<IncomeRow[]> {
  const { data } = await createAdminClient()
    .from("invoices")
    .select("id, number, description, amount_idr, paid_at, student:students(full_name)")
    .eq("status", "paid")
    .gte("paid_at", from.toISOString())
    .lt("paid_at", to.toISOString())
    .order("paid_at", { ascending: false });
  return (data ?? []).map((r) => ({ ...(r as unknown as IncomeRow), student: (r.student as unknown as { full_name: string } | null)?.full_name ?? "-" }));
}

const dateOnly = (d: Date) => new Date(d.getTime() + 7 * 3600_000).toISOString().slice(0, 10);

export async function expensesBetween(from: Date, to: Date): Promise<ExpenseRow[]> {
  const { data } = await createAdminClient()
    .from("expenses")
    .select("id, spent_on, category, description, amount_idr, receipt_path")
    .gte("spent_on", dateOnly(from))
    .lt("spent_on", dateOnly(to))
    .order("spent_on", { ascending: false });
  return (data ?? []) as ExpenseRow[];
}

export type CashMonth = { key: string; income: number; expense: number };

// Arus kas per bulan untuk `months` bulan terakhir sampai bulan `untilKey`.
export async function cashflow(untilKey: string, months = 12): Promise<CashMonth[]> {
  const firstKey = addMonths(untilKey, -(months - 1));
  const from = monthStart(firstKey);
  const to = monthStart(addMonths(untilKey, 1));
  const [income, expense] = await Promise.all([incomeBetween(from, to), expensesBetween(from, to)]);
  return Array.from({ length: months }, (_, i) => {
    const key = addMonths(firstKey, i);
    return {
      key,
      income: income.filter((r) => monthKey(new Date(r.paid_at)) === key).reduce((n, r) => n + r.amount_idr, 0),
      expense: expense.filter((r) => r.spent_on.slice(0, 7) === key).reduce((n, r) => n + r.amount_idr, 0),
    };
  });
}

export type ExpenseInput = { spentOn: string; category: string; description: string; amount: number; receiptPath?: string | null };

export async function receiptUploadTarget(mime: string, size: number) {
  const ext = fileExtension("receipts", mime);
  if (!ext) throw new ClassError("Unggah foto (JPG, PNG, WEBP) atau PDF.");
  if (size > BUCKETS.receipts.maxBytes) throw new ClassError("Ukuran file maksimal 5 MB.");
  const path = `${monthKey()}/${crypto.randomUUID()}.${ext}`;
  const token = await signedUpload("receipts", path);
  if (!token) throw new ClassError("File gagal disiapkan untuk diunggah.");
  return { path, token };
}

export async function saveExpense(actorId: string, id: string | null, input: ExpenseInput) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.spentOn)) throw new ClassError("Isi tanggal pengeluaran.");
  if (input.spentOn > dateOnly(new Date())) throw new ClassError("Tanggal pengeluaran tidak boleh di masa depan.");
  if (!(EXPENSE_CATEGORIES as readonly string[]).includes(input.category)) throw new ClassError("Pilih kategori.");
  const description = input.description.trim();
  if (description.length < 3 || description.length > 300) throw new ClassError("Isi keterangan pengeluaran (3–300 karakter).");
  if (!Number.isInteger(input.amount) || input.amount <= 0 || input.amount > 1_000_000_000) throw new ClassError("Isi nominal pengeluaran.");
  if (input.receiptPath && !(await fileExists("receipts", input.receiptPath))) throw new ClassError("Foto nota belum terunggah.");
  const row = { spent_on: input.spentOn, category: input.category, description, amount_idr: input.amount, ...(input.receiptPath !== undefined ? { receipt_path: input.receiptPath } : {}) };
  const supabase = await createClient();
  if (id) {
    const { error } = await supabase.from("expenses").update(row).eq("id", id);
    if (error) dbError(error, "Pengeluaran gagal disimpan.");
  } else {
    const { error } = await supabase.from("expenses").insert({ ...row, created_by: actorId });
    if (error) dbError(error, "Pengeluaran gagal disimpan.");
  }
}

export async function deleteExpense(id: string) {
  const supabase = await createClient();
  const { data, error } = await supabase.from("expenses").delete().eq("id", id).select("receipt_path").maybeSingle();
  if (error) dbError(error, "Pengeluaran gagal dihapus.");
  if (data?.receipt_path) await removeFiles("receipts", [data.receipt_path]);
}

export async function receiptUrl(id: string) {
  const supabase = await createClient();
  const { data } = await supabase.from("expenses").select("receipt_path").eq("id", id).maybeSingle();
  if (!data?.receipt_path) throw new ClassError("Nota tidak tersedia.");
  const url = await signedDownload("receipts", data.receipt_path);
  if (!url) throw new ClassError("Nota tidak tersedia.");
  return url;
}

export async function financeCsv(from: Date, to: Date) {
  const [income, expense] = await Promise.all([incomeBetween(from, to), expensesBetween(from, to)]);
  const rows = [
    ...income.map((r) => ({ tanggal: dateOnly(new Date(r.paid_at)), jenis: "Pemasukan", kategori: "Pembayaran kelas", keterangan: `${r.number} · ${r.student} · ${r.description}`, nominal: r.amount_idr })),
    ...expense.map((r) => ({ tanggal: r.spent_on, jenis: "Pengeluaran", kategori: EXPENSE_LABEL[r.category], keterangan: r.description, nominal: -r.amount_idr })),
  ].sort((a, b) => a.tanggal.localeCompare(b.tanggal));
  return toCsv(rows, ["tanggal", "jenis", "kategori", "keterangan", "nominal"]);
}

// ---------------------------------------------------------------------------
// Audit log
// ---------------------------------------------------------------------------

export type AuditRow = { id: number; actor: string; action: string; entity: string; entity_id: string | null; detail: Record<string, unknown>; created_at: string };
export type AuditFilter = { actor?: string; entity?: string; from?: string; to?: string; page?: number };
export const AUDIT_PAGE = 50;

export async function auditLog(filter: AuditFilter): Promise<{ rows: AuditRow[]; total: number }> {
  const admin = createAdminClient();
  let q = admin.from("audit_log").select("id, actor_id, action, entity, entity_id, detail, created_at", { count: "exact" });
  if (filter.actor) q = q.eq("actor_id", filter.actor);
  if (filter.entity) q = q.eq("entity", filter.entity);
  if (filter.from && /^\d{4}-\d{2}-\d{2}$/.test(filter.from)) q = q.gte("created_at", `${filter.from}T00:00:00${WIB}`);
  if (filter.to && /^\d{4}-\d{2}-\d{2}$/.test(filter.to)) q = q.lte("created_at", `${filter.to}T23:59:59${WIB}`);
  const page = Math.max(1, filter.page ?? 1);
  const { data, count } = await q.order("created_at", { ascending: false }).range((page - 1) * AUDIT_PAGE, page * AUDIT_PAGE - 1);
  const ids = [...new Set((data ?? []).map((r) => r.actor_id).filter(Boolean) as string[])];
  const { data: people } = ids.length ? await admin.from("profiles").select("id, full_name, email").in("id", ids) : { data: [] };
  return {
    total: count ?? 0,
    rows: (data ?? []).map((r) => {
      const p = people?.find((x) => x.id === r.actor_id);
      return { ...r, detail: (r.detail ?? {}) as Record<string, unknown>, actor: r.actor_id ? p?.full_name || p?.email || "Akun terhapus" : "Sistem" } as AuditRow;
    }),
  };
}

export type AuditActorGroup = { role: Role | "none"; label: string; people: { id: string; name: string; email: string }[] };

// Semua akun untuk filter "Oleh", dikelompokkan menurut role utamanya (urutan Owner sampai Siswa).
export async function auditFilters(): Promise<{ groups: AuditActorGroup[] }> {
  const admin = createAdminClient();
  const [{ data: people }, { data: roles }] = await Promise.all([
    admin.from("profiles").select("id, full_name, email").order("full_name").limit(5000),
    admin.from("user_roles").select("user_id, role").limit(10000),
  ]);
  const roleOf = (id: string) => ROLE_PRIORITY.find((r) => (roles ?? []).some((x) => x.user_id === id && x.role === r)) ?? "none";
  const groups = new Map<Role | "none", AuditActorGroup["people"]>();
  for (const p of people ?? []) {
    const key = roleOf(p.id as string);
    groups.set(key, [...(groups.get(key) ?? []), { id: p.id as string, name: (p.full_name || p.email) as string, email: (p.email ?? "") as string }]);
  }
  return {
    groups: [...ROLE_PRIORITY, "none" as const]
      .filter((r) => groups.has(r))
      .map((r) => ({ role: r, label: r === "none" ? "Tanpa role" : ROLE_LABEL[r], people: groups.get(r)!.sort((x, y) => x.name.localeCompare(y.name)) })),
  };
}

// ---------------------------------------------------------------------------
// Dashboard bisnis
// ---------------------------------------------------------------------------

export function periodRange(p: PeriodKey): { from: Date; to: Date } {
  const now = monthKey();
  const to = monthStart(addMonths(now, 1));
  if (p === "3bulan") return { from: monthStart(addMonths(now, -2)), to };
  if (p === "tahun") return { from: monthStart(`${now.slice(0, 4)}-01`), to };
  return { from: monthStart(now), to };
}

// Siswa menyelesaikan program bila kehadirannya minimal 75% dari sesi batch.
export const COMPLETION_ATTENDANCE = 0.75;

export type Dashboard = {
  activeStudents: number;
  revenue: number;
  expense: number;
  runningBatches: number;
  openBatches: number;
  funnel: { registered: number; placed: number; enrolled: number; paid: number };
  completion: { finished: number; completed: number };
  byProgram: { name: string; revenue: number; students: number }[];
  months: CashMonth[];
  openTickets: number;
  lastBackup: string | null;
};

export async function dashboard(period: PeriodKey): Promise<Dashboard> {
  const admin = createAdminClient();
  const { from, to } = periodRange(period);
  const [fromIso, toIso] = [from.toISOString(), to.toISOString()];
  const [active, income, expense, batches, newStudents, finishedBatches, months, tickets, backup] = await Promise.all([
    admin.from("enrollments").select("student_id").eq("status", "active"),
    admin.from("invoices").select("amount_idr, enrollment:enrollments(student_id, batch:batches(program:programs(name)))").eq("status", "paid").gte("paid_at", fromIso).lt("paid_at", toIso),
    expensesBetween(from, to),
    admin.from("batches").select("status").in("status", ["open", "running"]),
    admin.from("students").select("id").gte("created_at", fromIso).lt("created_at", toIso),
    admin.from("batches").select("id").eq("status", "completed"),
    cashflow(monthKey(), 6),
    admin.from("tickets").select("id", { count: "exact", head: true }).eq("status", "open"),
    admin.from("site_settings").select("value").eq("key", "backup").maybeSingle(),
  ]);

  // Corong: siswa yang terdaftar di periode ini, lalu berapa yang sudah placement, daftar kelas, dan bayar.
  const cohort = (newStudents.data ?? []).map((s) => s.id as string);
  const none = ["00000000-0000-0000-0000-000000000000"];
  const [placed, enrolled, paid] = cohort.length
    ? await Promise.all([
        admin.from("placement_attempts").select("student_id").in("student_id", cohort).neq("status", "in_progress"),
        admin.from("enrollments").select("student_id").in("student_id", cohort),
        admin.from("invoices").select("student_id").in("student_id", cohort).eq("status", "paid"),
      ])
    : [{ data: [] }, { data: [] }, { data: [] }];
  const distinct = (rows: { student_id: unknown }[] | null) => new Set((rows ?? []).map((r) => r.student_id)).size;

  // Penyelesaian: peserta batch yang sesi terakhirnya jatuh di periode ini, dengan kehadiran >= 75%.
  let completion = { finished: 0, completed: 0 };
  const completedIds = (finishedBatches.data ?? []).map((b) => b.id as string);
  const { data: allSessions } = completedIds.length ? await admin.from("class_sessions").select("id, batch_id, starts_at").in("batch_id", completedIds) : { data: [] };
  const finishedIds = completedIds.filter((id) => {
    const last = Math.max(...(allSessions ?? []).filter((s) => s.batch_id === id).map((s) => Date.parse(s.starts_at)));
    return last >= from.getTime() && last < to.getTime();
  });
  if (finishedIds.length) {
    const sessions = (allSessions ?? []).filter((s) => finishedIds.includes(s.batch_id));
    const { data: enr } = await admin.from("enrollments").select("student_id, batch_id").in("batch_id", finishedIds).eq("status", "completed");
    const { data: att } = await admin
      .from("attendance")
      .select("session_id, student_id, status")
      .in("session_id", (sessions ?? []).map((s) => s.id).concat(none))
      .in("status", ["present", "late"]);
    const done = (enr ?? []).filter((e) => {
      const ids = new Set((sessions ?? []).filter((s) => s.batch_id === e.batch_id).map((s) => s.id));
      const present = (att ?? []).filter((a) => a.student_id === e.student_id && ids.has(a.session_id)).length;
      return ids.size > 0 && present / ids.size >= COMPLETION_ATTENDANCE;
    }).length;
    completion = { finished: enr?.length ?? 0, completed: done };
  }

  const programMap = new Map<string, { revenue: number; students: Set<unknown> }>();
  for (const r of income.data ?? []) {
    const e = r.enrollment as unknown as { student_id: string; batch: { program: { name: string } } } | null;
    const name = e?.batch?.program?.name ?? "Lainnya";
    const cur = programMap.get(name) ?? { revenue: 0, students: new Set() };
    cur.revenue += r.amount_idr;
    cur.students.add(e?.student_id);
    programMap.set(name, cur);
  }

  return {
    activeStudents: distinct(active.data),
    revenue: (income.data ?? []).reduce((n, r) => n + r.amount_idr, 0),
    expense: expense.reduce((n, r) => n + r.amount_idr, 0),
    runningBatches: (batches.data ?? []).filter((b) => b.status === "running").length,
    openBatches: (batches.data ?? []).filter((b) => b.status === "open").length,
    funnel: { registered: cohort.length, placed: distinct(placed.data), enrolled: distinct(enrolled.data), paid: distinct(paid.data) },
    completion,
    byProgram: [...programMap].map(([name, v]) => ({ name, revenue: v.revenue, students: v.students.size })).sort((a, b) => b.revenue - a.revenue),
    months,
    openTickets: tickets.count ?? 0,
    lastBackup: ((backup.data?.value as { last_at?: string } | undefined)?.last_at ?? null) || null,
  };
}

// ---------------------------------------------------------------------------
// Backup: semua tabel sebagai CSV dalam satu ZIP. File unggahan (rekaman, bukti bayar, materi)
// tidak ikut; tersimpan di Supabase Storage.
// ---------------------------------------------------------------------------

const BACKUP_TABLES = [
  "profiles",
  "user_roles",
  "students",
  "guardian_links",
  "programs",
  "placement_questions",
  "placement_attempts",
  "placement_answers",
  "batches",
  "class_sessions",
  "enrollments",
  "invoices",
  "payment_proofs",
  "curricula",
  "curriculum_modules",
  "module_materials",
  "module_tasks",
  "rubric_indicators",
  "attendance",
  "assignments",
  "submissions",
  "feedback",
  "assessments",
  "reports",
  "expenses",
  "tickets",
  "ticket_messages",
  "tutor_observations",
  "tutor_surveys",
  "site_settings",
  "faqs",
  "testimonials",
  "notifications",
  "audit_log",
];

async function allRows(table: string) {
  const admin = createAdminClient();
  const rows: Record<string, unknown>[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await admin.from(table).select("*").range(from, from + 999);
    if (error) throw new ClassError(`Tabel ${table} gagal dibaca untuk backup.`);
    rows.push(...((data ?? []) as Record<string, unknown>[]));
    if (!data || data.length < 1000) return rows;
  }
}

export async function buildBackup(actorId: string) {
  const now = new Date();
  const files: { name: string; data: string }[] = [];
  const counts: Record<string, number> = {};
  for (const table of BACKUP_TABLES) {
    const rows = await allRows(table);
    counts[table] = rows.length;
    files.push({ name: `${table}.csv`, data: toCsv(rows) });
  }
  files.unshift({
    name: "BACA-SAYA.txt",
    data: [
      "Backup data Milestone English",
      `Dibuat: ${now.toISOString()}`,
      "",
      "Setiap file CSV berisi satu tabel database. Buka dengan Google Sheets atau Excel.",
      "File unggahan (rekaman, bukti bayar, materi, PDF laporan) tidak ikut; tetap tersimpan di Supabase Storage.",
      "",
      ...Object.entries(counts).map(([t, n]) => `${t}: ${n} baris`),
    ].join("\r\n"),
  });
  const zip = createZip(files, now);
  const admin = createAdminClient();
  await admin.from("site_settings").upsert({ key: "backup", value: { last_at: now.toISOString(), by: actorId }, updated_by: actorId }, { onConflict: "key" });
  await audit(actorId, "backup_downloaded", "site_settings", "backup", { tables: BACKUP_TABLES.length });
  return { zip, name: `backup-milestone-${dateOnly(now)}.zip` };
}

// Pengingat backup bulanan untuk Owner (dari jadwal harian), paling sering sekali seminggu.
export async function backupDue() {
  const { data } = await createAdminClient().from("site_settings").select("value").eq("key", "backup").maybeSingle();
  const v = (data?.value ?? {}) as { last_at?: string; reminded_at?: string };
  const last = v.last_at ? Date.parse(v.last_at) : 0;
  const reminded = v.reminded_at ? Date.parse(v.reminded_at) : 0;
  const day = 86400_000;
  return { due: Date.now() - last > 30 * day && Date.now() - reminded > 7 * day, value: v };
}

export async function markBackupReminded(value: object) {
  await createAdminClient().from("site_settings").upsert({ key: "backup", value: { ...value, reminded_at: new Date().toISOString() } }, { onConflict: "key" });
}
