// Fase 2: batch, pendaftaran kelas, invoice 2x24 jam, bukti bayar, dan verifikasi admin.
import { beforeAll, describe, expect, it } from "vitest";
import { createTestDb } from "./db-helpers";

let t: Awaited<ReturnType<typeof createTestDb>>;
let admin: string;
let tutor: string;
let n = 0;

beforeAll(async () => {
  t = await createTestDb();
  admin = await t.createStaff("admin@contoh.id", "admin");
  tutor = await t.createStaff("tutor@contoh.id", "tutor");
});

async function makeBatch(capacity = 2, status = "open") {
  n += 1;
  const res = await t.db.query<{ id: string }>(
    `insert into public.batches (code, program_id, tutor_id, start_date, schedule_label, capacity, status, meeting_url)
     select $1, id, $2, current_date + 7, 'Selasa & Kamis 19.00 WIB', $3, $4, 'https://meet.google.com/abc-defg-hij' from public.programs where slug = 'speakup'
     returning id`,
    [`SU-T${n}`, tutor, capacity, status],
  );
  return res.rows[0].id;
}

async function placedStudent(email: string) {
  const user = await t.createUser(email, { full_name: email.split("@")[0] });
  const s = await t.db.query<{ id: string }>("select id from public.students where user_id = $1", [user]);
  await t.db.query("insert into public.placement_attempts (student_id, status, levels, published_at) values ($1, 'published', '{\"overall\":\"A2\"}', now())", [s.rows[0].id]);
  return { user, student: s.rows[0].id };
}

const enroll = (user: string, student: string, batch: string) =>
  t.as<{ invoice: string }>(user, "select public.enroll_in_batch($1, $2) as invoice", [student, batch]).then((r) => r.rows[0].invoice);

async function invoice(id: string) {
  const res = await t.db.query<{ status: string; amount_idr: number; number: string; due_hours: number; enrollment_status: string; reject_reason: string | null }>(
    `select i.status, i.amount_idr, i.number, round(extract(epoch from i.due_at - now()) / 3600)::int as due_hours, e.status as enrollment_status, i.reject_reason
     from public.invoices i join public.enrollments e on e.id = i.enrollment_id where i.id = $1`,
    [id],
  );
  return res.rows[0];
}

const submitProof = (user: string, inv: string) =>
  t.as<{ proof: string }>(user, "select public.submit_payment_proof($1, $2, 'BCA', 'Budi', current_date, 349000) as proof", [inv, `${inv}/bukti.jpg`]).then((r) => r.rows[0].proof);

describe("memilih batch", () => {
  it("invoice terbit otomatis seharga program dengan batas bayar 2x24 jam", async () => {
    const batch = await makeBatch();
    const { user, student } = await placedStudent("pilih@contoh.id");
    const inv = await invoice(await enroll(user, student, batch));
    expect(inv).toMatchObject({ status: "unpaid", amount_idr: 349000, due_hours: 48, enrollment_status: "pending_payment" });
    expect(inv.number).toMatch(/^INV-\d{4}-\d{4}$/);
  });

  it("placement wajib terbit lebih dulu", async () => {
    const batch = await makeBatch();
    const user = await t.createUser("belum@contoh.id");
    const s = await t.db.query<{ id: string }>("select id from public.students where user_id = $1", [user]);
    await expect(enroll(user, s.rows[0].id, batch)).rejects.toThrow(/placement test belum terbit/);
  });

  it("batch penuh menolak pendaftar berikutnya, dan tidak bisa daftar dua kali", async () => {
    const batch = await makeBatch(1);
    const a = await placedStudent("penuh-a@contoh.id");
    const b = await placedStudent("penuh-b@contoh.id");
    await enroll(a.user, a.student, batch);
    await expect(enroll(a.user, a.student, batch)).rejects.toThrow(/sudah terdaftar/);
    await expect(enroll(b.user, b.student, batch)).rejects.toThrow(/penuh/);
  });

  it("invoice yang lewat batas dilepas sehingga kursinya kembali tersedia", async () => {
    const batch = await makeBatch(1);
    const a = await placedStudent("telat-a@contoh.id");
    const b = await placedStudent("telat-b@contoh.id");
    const inv = await enroll(a.user, a.student, batch);
    await t.db.query("update public.invoices set due_at = now() - interval '1 minute' where id = $1", [inv]);
    await enroll(b.user, b.student, batch);
    expect(await invoice(inv)).toMatchObject({ status: "expired", enrollment_status: "expired" });
    await expect(submitProof(a.user, inv)).rejects.toThrow(/Batas pembayaran sudah lewat/);
  });

  it("batch draf tidak bisa dipilih", async () => {
    const batch = await makeBatch(2, "draft");
    const a = await placedStudent("draf@contoh.id");
    await expect(enroll(a.user, a.student, batch)).rejects.toThrow(/tidak sedang membuka/);
  });

  it("wali baru bisa mendaftarkan anak setelah hubungan diverifikasi admin", async () => {
    const batch = await makeBatch();
    const g = await t.createUser("wali@contoh.id", { account_type: "guardian", child_name: "Raka" });
    const child = (await t.db.query<{ student_id: string }>("select student_id from public.guardian_links where guardian_id = $1", [g])).rows[0].student_id;
    await t.db.query("insert into public.placement_attempts (student_id, status, published_at) values ($1, 'published', now())", [child]);
    await expect(enroll(g, child, batch)).rejects.toThrow(/belum diverifikasi/);
    await t.db.query("update public.guardian_links set status = 'verified' where guardian_id = $1", [g]);
    expect(await invoice(await enroll(g, child, batch))).toMatchObject({ status: "unpaid" });
  });

  it("orang lain tidak bisa mendaftarkan siswa yang bukan miliknya", async () => {
    const batch = await makeBatch();
    const a = await placedStudent("asli@contoh.id");
    const other = await t.createUser("lain@contoh.id");
    await expect(enroll(other, a.student, batch)).rejects.toThrow(/tidak ditemukan/);
  });
});

describe("pembayaran", () => {
  it("bukti diverifikasi admin: invoice lunas, kelas aktif, siswa berstatus Siswa", async () => {
    const batch = await makeBatch();
    const a = await placedStudent("lunas@contoh.id");
    const inv = await enroll(a.user, a.student, batch);
    const proof = await submitProof(a.user, inv);
    expect(await invoice(inv)).toMatchObject({ status: "awaiting_verification", enrollment_status: "awaiting_verification" });

    await expect(t.as(a.user, "select public.decide_payment($1, true)", [proof])).rejects.toThrow(/Hanya admin/);
    await t.as(admin, "select public.decide_payment($1, true)", [proof]);
    expect(await invoice(inv)).toMatchObject({ status: "paid", enrollment_status: "active" });
    const s = await t.db.query<{ status: string }>("select status from public.students where id = $1", [a.student]);
    expect(s.rows[0].status).toBe("active");
    await expect(t.as(admin, "select public.decide_payment($1, false, 'dua kali')", [proof])).rejects.toThrow(/sudah diputuskan/);
  });

  it("bukti ditolak dengan alasan: siswa melihat alasannya dan bisa mengunggah ulang", async () => {
    const batch = await makeBatch();
    const a = await placedStudent("tolak@contoh.id");
    const inv = await enroll(a.user, a.student, batch);
    const proof = await submitProof(a.user, inv);
    await expect(t.as(admin, "select public.decide_payment($1, false, '')", [proof])).rejects.toThrow(/alasan/);
    await t.as(admin, "select public.decide_payment($1, false, 'Nominal transfer tidak sesuai')", [proof]);
    expect(await invoice(inv)).toMatchObject({ status: "unpaid", enrollment_status: "pending_payment", reject_reason: "Nominal transfer tidak sesuai" });
    await submitProof(a.user, inv);
    expect(await invoice(inv)).toMatchObject({ status: "awaiting_verification", reject_reason: null });
  });

  it("file bukti harus berada di folder invoice tersebut", async () => {
    const batch = await makeBatch();
    const a = await placedStudent("path@contoh.id");
    const inv = await enroll(a.user, a.student, batch);
    await expect(
      t.as(a.user, "select public.submit_payment_proof($1, 'lain/bukti.jpg', 'BCA', 'Budi', current_date, 1000)", [inv]),
    ).rejects.toThrow(/File bukti tidak valid/);
  });

  it("onboarding hanya untuk kelas yang sudah aktif", async () => {
    const batch = await makeBatch();
    const a = await placedStudent("onboard@contoh.id");
    const inv = await enroll(a.user, a.student, batch);
    const enrollment = (await t.db.query<{ enrollment_id: string }>("select enrollment_id from public.invoices where id = $1", [inv])).rows[0].enrollment_id;
    await expect(t.as(a.user, "select public.complete_onboarding($1)", [enrollment])).rejects.toThrow(/belum aktif/);
    await t.as(admin, "select public.decide_payment($1, true)", [await submitProof(a.user, inv)]);
    await t.as(a.user, "select public.complete_onboarding($1)", [enrollment]);
    const e = await t.db.query<{ done: boolean }>("select onboarded_at is not null as done from public.enrollments where id = $1", [enrollment]);
    expect(e.rows[0].done).toBe(true);
  });
});

describe("hak akses data kelas dan pembayaran", () => {
  it("siswa tidak bisa mengubah invoice atau membuat pendaftaran langsung", async () => {
    const batch = await makeBatch();
    const a = await placedStudent("nakal@contoh.id");
    const inv = await enroll(a.user, a.student, batch);
    await expect(t.as(a.user, "update public.invoices set status = 'paid' where id = $1", [inv])).rejects.toThrow(/permission denied/);
    await expect(t.as(a.user, "insert into public.enrollments (student_id, batch_id, status) values ($1, $2, 'active')", [a.student, batch])).rejects.toThrow(
      /permission denied/,
    );
  });

  it("siswa hanya melihat invoice miliknya; tutor melihat siswa di batch-nya tanpa invoice", async () => {
    const batch = await makeBatch();
    const a = await placedStudent("lihat-a@contoh.id");
    const b = await placedStudent("lihat-b@contoh.id");
    const invA = await enroll(a.user, a.student, batch);
    await enroll(b.user, b.student, batch);
    const seen = await t.as<{ id: string }>(a.user, "select id from public.invoices");
    expect(seen.rows.map((r) => r.id)).toEqual([invA]);

    const roster = await t.as<{ n: number }>(tutor, "select count(*)::int as n from public.enrollments where batch_id = $1", [batch]);
    expect(roster.rows[0].n).toBe(2);
    const tutorInvoices = await t.as<{ n: number }>(tutor, "select count(*)::int as n from public.invoices");
    expect(tutorInvoices.rows[0].n).toBe(0);
  });

  it("batch draf dan link kelas tidak terlihat oleh siswa yang belum terdaftar; landing hanya melihat batch dibuka", async () => {
    const open = await makeBatch(3, "open");
    await makeBatch(3, "draft");
    const a = await placedStudent("intip@contoh.id");
    const direct = await t.as<{ n: number }>(a.user, "select count(*)::int as n from public.batches");
    expect(direct.rows[0].n).toBe(0);
    const pub = await t.as<{ id: string; seats_left: number }>(null, "select id, seats_left from public.open_batches()");
    expect(pub.rows.some((r) => r.id === open && r.seats_left === 3)).toBe(true);
    expect(Object.keys(pub.rows[0])).not.toContain("meeting_url");
  });

  it("notifikasi hanya bisa dibaca admin dan owner", async () => {
    const a = await placedStudent("notif@contoh.id");
    await t.db.query("insert into public.notifications (recipient_id, channel, destination, template, body, status) values ($1, 'email', 'x@contoh.id', 'tes', 'Halo', 'skipped')", [a.user]);
    expect((await t.as<{ n: number }>(a.user, "select count(*)::int as n from public.notifications")).rows[0].n).toBe(0);
    expect((await t.as<{ n: number }>(admin, "select count(*)::int as n from public.notifications")).rows[0].n).toBeGreaterThan(0);
  });
});
