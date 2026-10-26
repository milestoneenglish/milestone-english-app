// Fase 4: rubrik dan titik assessment di kurikulum, assessment siswa, laporan akhir, dan review Academic Lead.
import { beforeAll, describe, expect, it } from "vitest";
import { createTestDb } from "./db-helpers";

let t: Awaited<ReturnType<typeof createTestDb>>;
let lead: string;
let tutor: string;
let otherTutor: string;
let n = 0;

beforeAll(async () => {
  t = await createTestDb();
  lead = await t.createStaff("lead@contoh.id", "lead");
  tutor = await t.createStaff("tutor@contoh.id", "tutor");
  otherTutor = await t.createStaff("tutor2@contoh.id", "tutor");
});

const one = async <T>(sql: string, params: unknown[] = []) => (await t.db.query<T>(sql, params)).rows[0];

const curriculumOf = (code: string) =>
  one<{ id: string; status: string }>(
    "select c.id, c.status from public.curricula c join public.programs p on p.id = c.program_id where p.code = $1 order by c.version desc limit 1",
    [code],
  );

const indicatorsOf = (curriculum: string) => t.db.query<{ id: string; skill: string; descriptors: string[] }>("select id, skill, descriptors from public.rubric_indicators where curriculum_id = $1 order by seq", [curriculum]).then((r) => r.rows);

// Batch berkurikulum terbit dengan semua sesi; startHours menggeser sesi pertama terhadap sekarang (sesi berjarak 48 jam).
async function batchFor(code: string, startHours: number) {
  n += 1;
  const c = await one<{ id: string; program_id: string }>("select c.id, c.program_id from public.curricula c join public.programs p on p.id = c.program_id where p.code = $1 and c.status = 'published'", [code]);
  const b = await one<{ id: string }>(
    `insert into public.batches (code, program_id, curriculum_id, tutor_id, start_date, schedule_label, capacity, status)
     values ($1, $2, $3, $4, current_date, 'Senin 19.00 WIB', 6, 'open') returning id`,
    [`F4-T${n}`, c.program_id, c.id, tutor],
  );
  await t.db.query(
    `insert into public.class_sessions (batch_id, seq, starts_at, duration_minutes, module_id)
     select $1, m.seq, now() + make_interval(hours => $2 + (m.seq - 1) * 48), 60, m.id from public.curriculum_modules m where m.curriculum_id = $3`,
    [b.id, startHours, c.id],
  );
  return { batch: b.id, curriculum: c.id };
}

async function enrolled(batch: string, email: string) {
  const user = await t.createUser(email, { full_name: email.split("@")[0] });
  const s = await one<{ id: string }>("select id from public.students where user_id = $1", [user]);
  const e = await one<{ id: string }>("insert into public.enrollments (student_id, batch_id, status, activated_at) values ($1, $2, 'active', now()) returning id", [s.id, batch]);
  return { user, student: s.id, enrollment: e.id };
}

const allScores = async (curriculum: string, value: number) => Object.fromEntries((await indicatorsOf(curriculum)).map((i) => [i.id, String(value)]));

const assess = (user: string, batch: string, student: string, kind: string, scores: object, publish: boolean, note = "Catatan tutor") =>
  t.as(user, "select public.save_assessment($1, $2, $3, $4::jsonb, $5, $6)", [batch, student, kind, JSON.stringify(scores), note, publish]);

const saveReport = (user: string, enrollment: string, submit: boolean, programs: string[], levels: object = { speaking: "A2", listening: "A1" }) =>
  t.as(user, "select public.save_report($1, $2, $3, $4::jsonb, $5::uuid[], $6)", [
    enrollment,
    "Sudah bisa memperkenalkan diri dengan lancar.",
    "Perlu latihan pola kalimat tanya.",
    JSON.stringify(levels),
    `{${programs.join(",")}}`,
    submit,
  ]);

describe("rubrik dan titik assessment", () => {
  it("draf rubrik 12 program terisi 4–6 indikator dengan 4 penjelasan skor; titik awal, tengah, akhir terpasang", async () => {
    const rows = await t.db.query<{ code: string; n: number; sessions: number; points: string }>(
      `select p.code,
              (select count(*)::int from public.rubric_indicators r where r.curriculum_id = c.id) as n,
              (select count(*)::int from public.curriculum_modules m where m.curriculum_id = c.id) as sessions,
              (select string_agg(m.assessment || ':' || m.seq, ',' order by m.seq) from public.curriculum_modules m where m.curriculum_id = c.id and m.assessment is not null) as points
       from public.programs p join public.curricula c on c.program_id = p.id order by p.sort_order`,
    );
    expect(rows.rows).toHaveLength(12);
    for (const r of rows.rows) expect(r.n).toBeGreaterThanOrEqual(4);
    for (const r of rows.rows) expect(r.n).toBeLessThanOrEqual(6);
    const byCode = Object.fromEntries(rows.rows.map((r) => [r.code, r.points]));
    expect(byCode.EZ).toBe("baseline:1,mid:4,final:8");
    expect(byCode.SR).toBe("baseline:1,mid:8,final:16");
    expect(byCode.EC).toBe("baseline:1,final:4");
    expect(byCode.LL).toBe("baseline:1,final:4");
    const ez = await curriculumOf("EZ");
    for (const ind of await indicatorsOf(ez.id)) expect(ind.descriptors.filter((d) => d.length > 5)).toHaveLength(4);
  });

  it("Lead mengubah rubrik dan titik di draf; terbit butuh rubrik serta titik awal dan akhir; setelah terbit daftar terkunci", async () => {
    const ez = await curriculumOf("EZ");
    await expect(t.as(tutor, "select public.add_rubric_indicator($1, 'speaking', 'Indikator tutor')", [ez.id])).rejects.toThrow(/Hanya Academic Lead/);
    const added = (await t.as<{ id: string }>(lead, "select public.add_rubric_indicator($1, 'speaking', 'Intonasi') as id", [ez.id])).rows[0].id;
    expect(await indicatorsOf(ez.id)).toHaveLength(7);
    await t.as(lead, "select public.delete_rubric_indicator($1)", [added]);
    expect(await indicatorsOf(ez.id)).toHaveLength(6);

    // Memindah titik akhir ke sesi 7 lalu kembali ke sesi 8; satu titik per jenis.
    const m7 = await one<{ id: string }>("select id from public.curriculum_modules where curriculum_id = $1 and seq = 7", [ez.id]);
    const m8 = await one<{ id: string }>("select id from public.curriculum_modules where curriculum_id = $1 and seq = 8", [ez.id]);
    await t.as(lead, "select public.set_module_assessment($1, 'final')", [m7.id]);
    expect((await one<{ n: number }>("select count(*)::int as n from public.curriculum_modules where curriculum_id = $1 and assessment = 'final'", [ez.id])).n).toBe(1);
    await t.as(lead, "select public.set_module_assessment($1, null)", [m7.id]);
    await expect(t.as(lead, "select public.publish_curriculum($1)", [ez.id])).rejects.toThrow(/assessment awal \(baseline\) dan akhir/);
    await t.as(lead, "select public.set_module_assessment($1, 'final')", [m8.id]);
    await expect(t.as(lead, "update public.curriculum_modules set assessment = 'mid' where id = $1", [m7.id])).rejects.toThrow(/permission denied/);

    await t.as(lead, "select public.publish_curriculum($1)", [ez.id]);
    await expect(t.as(lead, "select public.add_rubric_indicator($1, 'speaking', 'Tambahan')", [ez.id])).rejects.toThrow(/Buat versi baru/);
    await expect(t.as(lead, "select public.set_module_assessment($1, 'mid')", [m7.id])).rejects.toThrow(/Buat versi baru/);
    const first = (await indicatorsOf(ez.id))[0];
    // Teks indikator tetap bisa diperbaiki Lead, tidak oleh tutor.
    await t.as(lead, `update public.rubric_indicators set label = 'Perkenalan diri', descriptors = '["a1","a2","a3","a4"]'::jsonb where id = $1`, [first.id]);
    expect((await one<{ label: string }>("select label from public.rubric_indicators where id = $1", [first.id])).label).toBe("Perkenalan diri");
    expect((await t.as(tutor, "update public.rubric_indicators set label = 'x' where id = $1 returning id", [first.id])).rows).toHaveLength(0);
    await expect(t.as(lead, "update public.rubric_indicators set skill = 'writing' where id = $1", [first.id])).rejects.toThrow(/permission denied/);

    const su = await curriculumOf("SU");
    await t.db.query("delete from public.rubric_indicators where curriculum_id = $1 and seq > 1", [su.id]);
    await expect(t.as(lead, "select public.publish_curriculum($1)", [su.id])).rejects.toThrow(/minimal 2 indikator/);
  });

  it("versi baru menyalin rubrik dan titik assessment", async () => {
    const ez = await curriculumOf("EZ");
    const v2 = (await t.as<{ id: string }>(lead, "select public.new_curriculum_version($1) as id", [ez.id])).rows[0].id;
    expect(await indicatorsOf(v2)).toHaveLength(6);
    const points = await t.db.query<{ assessment: string; seq: number }>("select assessment, seq from public.curriculum_modules where curriculum_id = $1 and assessment is not null order by seq", [v2]);
    expect(points.rows).toEqual([
      { assessment: "baseline", seq: 1 },
      { assessment: "mid", seq: 4 },
      { assessment: "final", seq: 8 },
    ]);
    await t.as(lead, "select public.delete_curriculum_draft($1)", [v2]);
  });
});

describe("assessment siswa", () => {
  it("hanya tutor batch, setelah sesi dimulai, dengan nilai 1–4; draf boleh sebagian, terbit wajib lengkap", async () => {
    const { batch, curriculum } = await batchFor("EZ", -2);
    const s = await enrolled(batch, "nilai1@contoh.id");
    const full = await allScores(curriculum, 2);
    await expect(assess(otherTutor, batch, s.student, "baseline", full, true)).rejects.toThrow(/Hanya tutor batch/);
    await expect(assess(tutor, batch, s.student, "mid", full, true)).rejects.toThrow(/setelah sesi 4 dimulai/);
    await expect(assess(tutor, batch, s.student, "baseline", { [Object.keys(full)[0]]: "5" }, false)).rejects.toThrow(/1 sampai 4/);
    const partial = { [Object.keys(full)[0]]: "3" };
    await assess(tutor, batch, s.student, "baseline", partial, false);
    await expect(assess(tutor, batch, s.student, "baseline", partial, true)).rejects.toThrow(/semua indikator/);

    // Draf tidak terlihat siswa; setelah terbit terlihat.
    expect((await t.as(s.user, "select id from public.assessments where student_id = $1", [s.student])).rows).toHaveLength(0);
    await assess(tutor, batch, s.student, "baseline", full, true);
    const seen = await t.as<{ status: string; scores: Record<string, number> }>(s.user, "select status, scores from public.assessments where student_id = $1", [s.student]);
    expect(seen.rows[0].status).toBe("published");
    expect(Object.values(seen.rows[0].scores)).toEqual(Array(6).fill(2));
    await expect(t.as(tutor, "insert into public.assessments (batch_id, student_id, kind) values ($1, $2, 'mid')", [batch, s.student])).rejects.toThrow(/permission denied/);
  });
});

describe("laporan akhir", () => {
  it("disusun setelah assessment akhir terbit, ditinjau Lead, lalu terbit untuk siswa; nilai terkunci setelah diajukan", async () => {
    const { batch, curriculum } = await batchFor("EZ", -400);
    const s = await enrolled(batch, "lapor1@contoh.id");
    const su = await one<{ id: string }>("select id from public.programs where code = 'SU'");
    await expect(saveReport(tutor, s.enrollment, false, [su.id])).rejects.toThrow(/assessment akhir/);

    await assess(tutor, batch, s.student, "baseline", await allScores(curriculum, 1), true);
    await assess(tutor, batch, s.student, "mid", await allScores(curriculum, 2), true);
    await assess(tutor, batch, s.student, "final", await allScores(curriculum, 3), true);

    await expect(saveReport(otherTutor, s.enrollment, true, [su.id])).rejects.toThrow(/Hanya tutor batch/);
    await expect(saveReport(tutor, s.enrollment, true, [])).rejects.toThrow(/rekomendasi program/);
    await expect(saveReport(tutor, s.enrollment, false, [su.id], { speaking: "Z9" })).rejects.toThrow(/Level per keterampilan/);
    await saveReport(tutor, s.enrollment, false, [su.id]);
    const report = await one<{ id: string; status: string }>("select id, status from public.reports where enrollment_id = $1", [s.enrollment]);
    expect(report.status).toBe("draft");
    expect((await t.as(s.user, "select id from public.reports where student_id = $1", [s.student])).rows).toHaveLength(0);

    await saveReport(tutor, s.enrollment, true, [su.id]);
    await expect(assess(tutor, batch, s.student, "final", await allScores(curriculum, 4), true)).rejects.toThrow(/terkunci/);
    await expect(saveReport(tutor, s.enrollment, false, [su.id])).rejects.toThrow(/sudah diajukan/);

    // Lead mengembalikan dengan catatan, tutor mengajukan ulang, Lead menerbitkan dengan level yang dikonfirmasi.
    await expect(t.as(tutor, "select public.review_report($1, true, '', null, null)", [report.id])).rejects.toThrow(/Hanya Academic Lead/);
    await expect(t.as(lead, "select public.review_report($1, false, '', null, null)", [report.id])).rejects.toThrow(/catatan untuk tutor/);
    await t.as(lead, "select public.review_report($1, false, 'Tambahkan contoh konkret.', null, null)", [report.id]);
    expect((await one<{ status: string; lead_comment: string }>("select status, lead_comment from public.reports where id = $1", [report.id])).status).toBe("returned");
    await saveReport(tutor, s.enrollment, true, [su.id]);
    await t.as(lead, `select public.review_report($1, true, '', '{"speaking":"A2","listening":"A2"}'::jsonb, '{"student":"lapor1"}'::jsonb)`, [report.id]);
    const done = await one<{ status: string; levels: Record<string, string>; published_at: string | null; summary: object }>("select status, levels, published_at, summary from public.reports where id = $1", [report.id]);
    expect(done).toMatchObject({ status: "published", levels: { speaking: "A2", listening: "A2" }, summary: { student: "lapor1" } });
    expect(done.published_at).not.toBeNull();

    const seen = await t.as<{ status: string }>(s.user, "select status from public.reports where student_id = $1", [s.student]);
    expect(seen.rows).toEqual([{ status: "published" }]);
    const stranger = await t.createUser("asing4@contoh.id", { full_name: "Asing" });
    expect((await t.as(stranger, "select id from public.reports")).rows).toHaveLength(0);
    await expect(t.as(lead, "update public.reports set status = 'draft' where id = $1", [report.id])).rejects.toThrow(/permission denied/);
    await expect(t.as(lead, "select public.review_report($1, true, '', null, null)", [report.id])).rejects.toThrow(/tidak sedang menunggu review/);
  });

  it("siswa yang menyelesaikan program bisa mengambil program berikutnya tanpa placement", async () => {
    const { batch } = await batchFor("EZ", -400);
    const s = await enrolled(batch, "lanjut1@contoh.id");
    await t.db.query("select public.sync_batch_status()");
    expect((await one<{ status: string }>("select status from public.enrollments where id = $1", [s.enrollment])).status).toBe("completed");
    const ez = await one<{ id: string; program_id: string }>("select c.id, c.program_id from public.curricula c join public.programs p on p.id = c.program_id where p.code = 'EZ' and c.status = 'published'");
    const next = await one<{ id: string }>(
      `insert into public.batches (code, program_id, curriculum_id, tutor_id, start_date, schedule_label, capacity, status)
       values ('F4-NEXT', $1, $2, $3, current_date + 30, 'Rabu 19.00 WIB', 6, 'open') returning id`,
      [ez.program_id, ez.id, tutor],
    );
    const invoice = await t.as<{ id: string }>(s.user, "select public.enroll_in_batch($1, $2) as id", [s.student, next.id]);
    expect(invoice.rows[0].id).toBeTruthy();
  });
});
