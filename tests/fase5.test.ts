// Fase 5: staf dan role, program dan harga, konten website, pengeluaran, tiket bantuan,
// observasi kelas, survei tutor, dan hitungan laporan yang dikembalikan.
import { beforeAll, describe, expect, it } from "vitest";
import { createTestDb } from "./db-helpers";

let t: Awaited<ReturnType<typeof createTestDb>>;
let owner: string;
let admin: string;
let lead: string;
let tutor: string;
let n = 0;

beforeAll(async () => {
  t = await createTestDb();
  owner = await t.createStaff("owner@contoh.id", "owner");
  admin = await t.createStaff("admin@contoh.id", "admin");
  lead = await t.createStaff("lead@contoh.id", "lead");
  tutor = await t.createStaff("tutor@contoh.id", "tutor");
});

const one = async <T>(sql: string, params: unknown[] = []) => (await t.db.query<T>(sql, params)).rows[0];

async function student(email: string, meta: object = {}) {
  const user = await t.createUser(email, { full_name: email.split("@")[0], ...meta });
  const s = await one<{ id: string }>("select id from public.students where user_id = $1", [user]);
  return { user, student: s?.id };
}

async function batch(status: string, tutorId: string | null = tutor) {
  n += 1;
  const p = await one<{ id: string }>("select id from public.programs where code = 'SU'");
  const b = await one<{ id: string }>(
    "insert into public.batches (code, program_id, tutor_id, start_date, schedule_label, capacity, status) values ($1, $2, $3, current_date, 'Senin 19.00 WIB', 6, $4) returning id",
    [`F5-T${n}`, p.id, tutorId, status],
  );
  return b.id;
}

describe("staf dan role", () => {
  it("Owner mengatur role staf; selain Owner, akun sendiri, dan role non-staf ditolak", async () => {
    const staff = await t.createStaff("baru@contoh.id", "tutor");
    await t.as(owner, "select public.set_staff_roles($1, array['lead', 'tutor']::public.app_role[])", [staff]);
    expect(await t.rolesOf(staff)).toEqual(["lead", "tutor"]);
    await t.as(owner, "select public.set_staff_roles($1, array['admin']::public.app_role[])", [staff]);
    expect(await t.rolesOf(staff)).toEqual(["admin"]);

    await expect(t.as(admin, "select public.set_staff_roles($1, array['owner']::public.app_role[])", [staff])).rejects.toThrow(/Hanya Owner/);
    await expect(t.as(owner, "select public.set_staff_roles($1, array['admin']::public.app_role[])", [owner])).rejects.toThrow(/akun sendiri/);
    await expect(t.as(owner, "select public.set_staff_roles($1, array['student']::public.app_role[])", [staff])).rejects.toThrow(/Role staf hanya/);
    await expect(t.as(owner, "select public.set_staff_roles($1, array[]::public.app_role[])", [staff])).rejects.toThrow(/minimal satu role/);

    const granted = await one<{ n: number }>("select count(*)::int as n from public.audit_log where entity_id = $1 and action = 'role_granted'", [staff]);
    expect(granted.n).toBeGreaterThanOrEqual(2);
  });

  it("Akun yang ditandai staf setelah dibuat (alur Supabase Auth) tidak membawa role dan data calon siswa", async () => {
    const id = await t.createUser("staf-auth@contoh.id", { full_name: "Staf Auth" });
    expect(await t.rolesOf(id)).toEqual(["student"]);
    await t.db.query("update auth.users set raw_app_meta_data = raw_app_meta_data || '{\"provisioned\": true, \"must_change_password\": true}'::jsonb where id = $1", [id]);
    expect(await t.rolesOf(id)).toEqual([]);
    expect((await t.db.query("select id from public.students where user_id = $1", [id])).rows).toHaveLength(0);
    expect((await one<{ must_change_password: boolean }>("select must_change_password from public.profiles where id = $1", [id])).must_change_password).toBe(true);
  });

  it("Role siswa/wali milik akun tidak ikut terhapus saat role staf diubah", async () => {
    const s = await student("staf-siswa@contoh.id");
    await t.db.query("insert into public.user_roles (user_id, role) values ($1, 'tutor')", [s.user]);
    await t.as(owner, "select public.set_staff_roles($1, array['lead']::public.app_role[])", [s.user]);
    expect(await t.rolesOf(s.user)).toEqual(["student", "lead"].sort());
  });

  it("Tutor yang masih memegang batch tidak bisa dinonaktifkan atau dicabut role tutornya", async () => {
    const busy = await t.createStaff("sibuk@contoh.id", "tutor");
    const b = await batch("running", busy);
    await expect(t.as(owner, "select public.set_staff_active($1, false)", [busy])).rejects.toThrow(/masih memegang batch/);
    await expect(t.as(owner, "select public.set_staff_roles($1, array['lead']::public.app_role[])", [busy])).rejects.toThrow(/masih memegang batch/);

    await t.db.query("update public.batches set status = 'completed' where id = $1", [b]);
    await t.as(owner, "select public.set_staff_active($1, false)", [busy]);
    expect((await one<{ status: string }>("select status from public.profiles where id = $1", [busy])).status).toBe("inactive");
    const active = await t.as<{ ok: boolean }>(busy, "select public.has_role('tutor') as ok");
    expect(active.rows[0].ok).toBe(false);

    await t.as(owner, "select public.set_staff_active($1, true)", [busy]);
    expect((await one<{ status: string }>("select status from public.profiles where id = $1", [busy])).status).toBe("active");
    await expect(t.as(owner, "select public.set_staff_active($1, false)", [owner])).rejects.toThrow(/Akun sendiri/);
    await expect(t.as(admin, "select public.set_staff_active($1, false)", [busy])).rejects.toThrow(/Hanya Owner/);
  });
});

describe("program, harga, dan konten website", () => {
  it("Owner mengubah harga (tercatat di audit); Admin hanya deskripsi; tutor tidak bisa", async () => {
    const p = await one<{ id: string; price_idr: number }>("select id, price_idr from public.programs where code = 'EZ'");
    await t.as(admin, "update public.programs set price_idr = 1 where id = $1", [p.id]);
    expect((await one<{ price_idr: number }>("select price_idr from public.programs where id = $1", [p.id])).price_idr).toBe(p.price_idr);

    await t.as(owner, "update public.programs set price_idr = $2 where id = $1", [p.id, p.price_idr + 50000]);
    const log = await one<{ detail: { price: number; price_from: number } }>("select detail from public.audit_log where entity_id = $1 and action = 'program_updated' order by id desc limit 1", [p.id]);
    expect(log.detail.price - log.detail.price_from).toBe(50000);

    await t.as(admin, "select public.update_program_description($1, $2, $3)", [p.id, "Target baru yang lebih jelas untuk pemula.", "Rekaman perkenalan."]);
    expect((await one<{ outcome: string }>("select outcome from public.programs where id = $1", [p.id])).outcome).toBe("Target baru yang lebih jelas untuk pemula.");
    await expect(t.as(tutor, "select public.update_program_description($1, $2, $3)", [p.id, "Target baru yang lebih jelas.", "Bukti."])).rejects.toThrow(/Owner atau Admin/);
    await expect(t.as(admin, "select public.update_program_description($1, $2, $3)", [p.id, "pendek", "x"])).rejects.toThrow(/10–400/);
  });

  it("Admin mengubah konten website, tetapi rekening tujuan dan catatan backup hanya Owner", async () => {
    await t.as(admin, "insert into public.site_settings (key, value) values ('landing', '{}'::jsonb) on conflict (key) do update set value = excluded.value");
    expect((await one<{ n: number }>("select count(*)::int as n from public.site_settings where key = 'landing'")).n).toBe(1);
    await expect(t.as(admin, "insert into public.site_settings (key, value) values ('payment', '{}'::jsonb)")).rejects.toThrow(/row-level security/);
    await expect(t.as(admin, "insert into public.site_settings (key, value) values ('backup', '{}'::jsonb)")).rejects.toThrow(/row-level security/);
    await t.as(owner, "insert into public.site_settings (key, value) values ('payment', '{\"bank_name\":\"BCA\"}'::jsonb) on conflict (key) do update set value = excluded.value");
    await t.as(admin, "update public.site_settings set value = '{}'::jsonb where key = 'payment'");
    expect((await one<{ value: { bank_name: string } }>("select value from public.site_settings where key = 'payment'")).value.bank_name).toBe("BCA");
  });

  it("Pengeluaran hanya untuk Owner dan setiap perubahan tercatat", async () => {
    const res = await t.as<{ id: string }>(owner, "insert into public.expenses (spent_on, category, description, amount_idr) values (current_date, 'marketing', 'Iklan Instagram', 150000) returning id");
    const id = res.rows[0].id;
    await expect(t.as(admin, "insert into public.expenses (spent_on, category, description, amount_idr) values (current_date, 'other', 'Coba', 1000)")).rejects.toThrow(/row-level security/);
    expect((await t.as(admin, "select id from public.expenses")).rows).toHaveLength(0);
    await t.as(owner, "delete from public.expenses where id = $1", [id]);
    const actions = (await t.db.query<{ action: string }>("select action from public.audit_log where entity_id = $1 order by id", [id])).rows.map((r) => r.action);
    expect(actions).toEqual(["expense_created", "expense_deleted"]);
  });
});

describe("tiket bantuan", () => {
  it("Siswa membuat tiket, Admin membalas dan menutup, siswa membuka lagi dalam 7 hari", async () => {
    const s = await student("tiket@contoh.id");
    const other = await student("tiket2@contoh.id");
    const res = await t.as<{ id: string }>(s.user, "select public.create_ticket('payment', 'Bukti bayar belum diverifikasi', 'Sudah transfer kemarin sore.') as id");
    const id = res.rows[0].id;
    expect((await one<{ number: string }>("select number from public.tickets where id = $1", [id])).number).toMatch(/^TKT-\d{5}$/);

    expect((await t.as(other.user, "select id from public.tickets where id = $1", [id])).rows).toHaveLength(0);
    expect((await t.as(admin, "select id from public.tickets where id = $1", [id])).rows).toHaveLength(1);
    expect((await t.as(tutor, "select id from public.tickets where id = $1", [id])).rows).toHaveLength(0);
    await expect(t.as(other.user, "select public.reply_ticket($1, 'Ikut balas')", [id])).rejects.toThrow(/tidak ditemukan/);

    await t.as(admin, "select public.reply_ticket($1, 'Sudah kami cek, mohon tunggu.')", [id]);
    expect((await one<{ status: string }>("select status from public.tickets where id = $1", [id])).status).toBe("answered");
    await t.as(s.user, "select public.reply_ticket($1, 'Baik, terima kasih.')", [id]);
    expect((await one<{ status: string }>("select status from public.tickets where id = $1", [id])).status).toBe("open");
    const msgs = await t.as<{ from_staff: boolean }>(s.user, "select from_staff from public.ticket_messages where ticket_id = $1 order by created_at", [id]);
    expect(msgs.rows.map((m) => m.from_staff)).toEqual([false, true, false]);

    await expect(t.as(s.user, "select public.close_ticket($1)", [id])).rejects.toThrow(/Hanya Admin/);
    await t.as(admin, "select public.close_ticket($1)", [id]);
    await expect(t.as(s.user, "select public.reply_ticket($1, 'Halo lagi')", [id])).rejects.toThrow(/sudah ditutup/);
    await t.as(s.user, "select public.reopen_ticket($1, 'Ternyata belum masuk.')", [id]);
    expect((await one<{ status: string }>("select status from public.tickets where id = $1", [id])).status).toBe("open");

    await t.as(admin, "select public.close_ticket($1)", [id]);
    await t.db.query("update public.tickets set closed_at = now() - interval '8 days' where id = $1", [id]);
    await expect(t.as(s.user, "select public.reopen_ticket($1, 'Masih ada kendala')", [id])).rejects.toThrow(/lebih dari 7 hari/);
  });

  it("Wali bisa membuat tiket; staf tidak; tabel tiket tidak bisa ditulis langsung", async () => {
    const g = await t.createUser("wali-tiket@contoh.id", { account_type: "guardian", full_name: "Wali" });
    await t.as(g, "select public.create_ticket('class', 'Jadwal kelas anak', 'Apakah jadwal bisa dipindah?')");
    await expect(t.as(tutor, "select public.create_ticket('class', 'Jadwal kelas', 'Pertanyaan dari tutor')")).rejects.toThrow(/siswa atau wali/);
    await expect(t.as(g, "insert into public.tickets (requester_id, category, subject) values ($1, 'other', 'Tiket langsung')", [g])).rejects.toThrow(/permission denied/);
    await expect(t.as(g, "select public.create_ticket('other', 'abc', 'Isi tiket cukup panjang')")).rejects.toThrow(/5–120/);
  });
});

describe("kualitas tutor", () => {
  it("Academic Lead mengisi observasi dengan 5 aspek; tutor tidak bisa mengisi atau membacanya", async () => {
    const b = await batch("running");
    const scores = { preparation: 4, engagement: 3, clarity: 3, feedback: 2, time: 4 };
    await t.as(lead, "select public.save_observation($1, current_date, $2::jsonb, 'Materi siap dan rapi.', 'Beri koreksi lebih cepat.')", [b, JSON.stringify(scores)]);
    const row = await one<{ tutor_id: string }>("select tutor_id from public.tutor_observations where batch_id = $1", [b]);
    expect(row.tutor_id).toBe(tutor);

    await expect(t.as(tutor, "select public.save_observation($1, current_date, $2::jsonb, 'Bagus sekali.', 'Lebih baik lagi.')", [b, JSON.stringify(scores)])).rejects.toThrow(/Hanya Academic Lead/);
    await expect(t.as(lead, "select public.save_observation($1, current_date, $2::jsonb, 'Bagus sekali.', 'Lebih baik lagi.')", [b, JSON.stringify({ ...scores, time: 5 })])).rejects.toThrow(/skor 1–4/);
    await expect(t.as(lead, "select public.save_observation($1, current_date + 2, $2::jsonb, 'Bagus sekali.', 'Lebih baik lagi.')", [b, JSON.stringify(scores)])).rejects.toThrow(/masa depan/);
    expect((await t.as(tutor, "select id from public.tutor_observations")).rows).toHaveLength(0);
    expect((await t.as(owner, "select id from public.tutor_observations")).rows.length).toBeGreaterThan(0);
  });

  it("Siswa menilai tutor sekali setelah program selesai; rekap hanya untuk Lead dan Owner", async () => {
    const b = await batch("completed");
    const s = await student("survei@contoh.id");
    const other = await student("survei2@contoh.id");
    const e = await one<{ id: string }>("insert into public.enrollments (student_id, batch_id, status) values ($1, $2, 'completed') returning id", [s.student, b]);

    await expect(t.as(other.user, "select public.submit_tutor_survey($1, 5, '')", [e.id])).rejects.toThrow(/tidak ditemukan/);
    await expect(t.as(s.user, "select public.submit_tutor_survey($1, 6, '')", [e.id])).rejects.toThrow(/1–5/);
    await t.as(s.user, "select public.submit_tutor_survey($1, 5, 'Tutornya sabar dan jelas.')", [e.id]);
    await expect(t.as(s.user, "select public.submit_tutor_survey($1, 4, '')", [e.id])).rejects.toThrow(/sudah dikirim/);

    expect((await t.as(s.user, "select id from public.tutor_surveys")).rows).toHaveLength(0);
    expect((await t.as(tutor, "select id from public.tutor_surveys")).rows).toHaveLength(0);
    expect((await t.as(lead, "select rating from public.tutor_surveys where enrollment_id = $1", [e.id])).rows[0]).toEqual({ rating: 5 });

    const running = await batch("running");
    const e2 = await one<{ id: string }>("insert into public.enrollments (student_id, batch_id, status) values ($1, $2, 'active') returning id", [other.student, running]);
    await expect(t.as(other.user, "select public.submit_tutor_survey($1, 4, '')", [e2.id])).rejects.toThrow(/setelah program selesai/);
  });

  it("Setiap pengembalian laporan oleh Lead terhitung", async () => {
    const b = await batch("completed");
    const s = await student("kembali@contoh.id");
    const e = await one<{ id: string }>("insert into public.enrollments (student_id, batch_id, status) values ($1, $2, 'completed') returning id", [s.student, b]);
    const r = await one<{ id: string }>("insert into public.reports (enrollment_id, student_id, batch_id, tutor_id, status) values ($1, $2, $3, $4, 'submitted') returning id", [e.id, s.student, b, tutor]);
    await t.db.query("update public.reports set status = 'returned' where id = $1", [r.id]);
    await t.db.query("update public.reports set status = 'submitted' where id = $1", [r.id]);
    await t.db.query("update public.reports set status = 'returned' where id = $1", [r.id]);
    expect((await one<{ return_count: number }>("select return_count from public.reports where id = $1", [r.id])).return_count).toBe(2);
  });
});
