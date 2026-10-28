import "server-only";
import type { Role } from "@/lib/roles";
import { createAdminClient } from "@/lib/supabase/admin";

// Angka di menu sidebar: jumlah hal yang menunggu dicek oleh role itu (slug menu → jumlah).
export type Badges = Record<string, number>;

const ids = (rows: { id: string }[] | null) => (rows ?? []).map((r) => r.id);

export async function menuBadges(role: Role, userId: string): Promise<Badges> {
  try {
    if (role === "admin") return await adminBadges();
    if (role === "lead") return await leadBadges();
    if (role === "tutor") return await tutorBadges(userId);
    if (role === "student" || role === "guardian") return await learnerBadges(role, userId);
  } catch (e) {
    console.error("Angka menu gagal dihitung", e);
  }
  return {};
}

async function adminBadges(): Promise<Badges> {
  const admin = createAdminClient();
  const [proofs, links, tickets] = await Promise.all([
    admin.from("payment_proofs").select("id", { count: "exact", head: true }).eq("status", "pending"),
    admin.from("guardian_links").select("id", { count: "exact", head: true }).eq("status", "pending"),
    admin.from("tickets").select("id", { count: "exact", head: true }).eq("status", "open"),
  ]);
  return { pembayaran: proofs.count ?? 0, "siswa-wali": links.count ?? 0, bantuan: tickets.count ?? 0 };
}

async function leadBadges(): Promise<Badges> {
  const admin = createAdminClient();
  const [attempts, reports] = await Promise.all([
    admin.from("placement_attempts").select("id", { count: "exact", head: true }).in("status", ["awaiting_review", "reviewed"]).not("student_id", "is", null),
    admin.from("reports").select("id", { count: "exact", head: true }).eq("status", "submitted"),
  ]);
  return { placement: attempts.count ?? 0, laporan: reports.count ?? 0 };
}

async function tutorBadges(userId: string): Promise<Badges> {
  const admin = createAdminClient();
  const [{ data: batches }, placement] = await Promise.all([
    admin.from("batches").select("id, status, curriculum_id").eq("tutor_id", userId).in("status", ["running", "completed"]),
    admin.from("placement_attempts").select("id", { count: "exact", head: true }).eq("evaluator_id", userId).eq("status", "awaiting_review"),
  ]);
  const batchIds = (batches ?? []).map((b) => b.id);
  if (!batchIds.length) return { placement: placement.count ?? 0 };
  const now = new Date().toISOString();
  const [{ data: sessions }, { data: assignments }, { data: enrollments }, { data: assessments }, { data: reports }] = await Promise.all([
    admin.from("class_sessions").select("id, batch_id, starts_at, attendance_done_at, module:curriculum_modules(assessment)").in("batch_id", batchIds).lte("starts_at", now),
    admin.from("assignments").select("id").in("batch_id", batchIds),
    admin.from("enrollments").select("id, batch_id, student_id, status").in("batch_id", batchIds).in("status", ["active", "completed"]),
    admin.from("assessments").select("batch_id, student_id, kind").in("batch_id", batchIds).eq("status", "published"),
    admin.from("reports").select("enrollment_id, status").in("batch_id", batchIds),
  ]);
  const running = new Set((batches ?? []).filter((b) => b.status === "running").map((b) => b.id));
  const completed = new Set((batches ?? []).filter((b) => b.status === "completed").map((b) => b.id));

  const sesi = (sessions ?? []).filter((s) => running.has(s.batch_id) && !s.attendance_done_at).length;
  const assignmentIds = ids(assignments);
  const tugas = assignmentIds.length
    ? ((await admin.from("submissions").select("id", { count: "exact", head: true }).in("assignment_id", assignmentIds).eq("status", "submitted")).count ?? 0)
    : 0;

  // Assessment: siswa yang belum dinilai di titik assessment yang sesinya sudah dimulai.
  const done = new Set((assessments ?? []).map((a) => `${a.batch_id}:${a.student_id}:${a.kind}`));
  let assessment = 0;
  for (const s of sessions ?? []) {
    const kind = (s.module as unknown as { assessment: string | null } | null)?.assessment;
    if (!kind) continue;
    for (const e of (enrollments ?? []).filter((x) => x.batch_id === s.batch_id)) {
      if (!done.has(`${s.batch_id}:${e.student_id}:${kind}`)) assessment++;
    }
  }

  // Laporan: siswa di batch selesai yang laporannya belum diajukan (atau dikembalikan Lead).
  const reported = new Set((reports ?? []).filter((r) => r.status === "submitted" || r.status === "published").map((r) => r.enrollment_id));
  const laporan = (enrollments ?? []).filter((e) => completed.has(e.batch_id) && !reported.has(e.id)).length;

  return { sesi, tugas, assessment, laporan, placement: placement.count ?? 0 };
}

async function learnerBadges(role: "student" | "guardian", userId: string): Promise<Badges> {
  const admin = createAdminClient();
  // Siswa: dirinya sendiri. Wali: anak-anaknya; tugas hanya dihitung untuk anak tanpa akun (wali yang mengumpulkan).
  let studentIds: string[] = [];
  let submitFor: string[] = [];
  if (role === "student") {
    const { data } = await admin.from("students").select("id").eq("user_id", userId);
    studentIds = submitFor = ids(data);
  } else {
    const { data } = await admin.from("guardian_links").select("student:students(id, user_id)").eq("guardian_id", userId).eq("status", "verified");
    const kids = (data ?? []).map((l) => l.student as unknown as { id: string; user_id: string | null }).filter(Boolean);
    studentIds = kids.map((k) => k.id);
    submitFor = kids.filter((k) => !k.user_id).map((k) => k.id);
  }
  const [invoices, tickets] = await Promise.all([
    studentIds.length ? admin.from("invoices").select("id", { count: "exact", head: true }).in("student_id", studentIds).eq("status", "unpaid") : { count: 0 },
    admin.from("tickets").select("id", { count: "exact", head: true }).eq("requester_id", userId).eq("status", "answered"),
  ]);

  let materi = 0;
  if (submitFor.length) {
    const { data: enrollments } = await admin.from("enrollments").select("student_id, batch_id").in("student_id", submitFor).eq("status", "active");
    const batchIds = [...new Set((enrollments ?? []).map((e) => e.batch_id))];
    if (batchIds.length) {
      const [{ data: assignments }, { data: subs }] = await Promise.all([
        admin.from("assignments").select("id, batch_id").in("batch_id", batchIds),
        admin.from("submissions").select("assignment_id, student_id, version, status").in("student_id", submitFor),
      ]);
      // Tugas yang belum dikumpulkan, atau yang diminta revisi pada versi terakhirnya.
      const latest = new Map<string, string>();
      for (const s of (subs ?? []).sort((a, b) => a.version - b.version)) latest.set(`${s.assignment_id}:${s.student_id}`, s.status);
      for (const e of enrollments ?? []) {
        for (const a of (assignments ?? []).filter((x) => x.batch_id === e.batch_id)) {
          const status = latest.get(`${a.id}:${e.student_id}`);
          if (!status || status === "revision_requested") materi++;
        }
      }
    }
  }
  return { materi, pembayaran: invoices.count ?? 0, bantuan: tickets.count ?? 0 };
}
