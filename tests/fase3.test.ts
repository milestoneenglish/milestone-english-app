// Fase 3: kurikulum berversi, absensi, tugas, pengumpulan, feedback, dan status batch otomatis.
import { beforeAll, describe, expect, it } from "vitest";
import { createTestDb } from "./db-helpers";

let t: Awaited<ReturnType<typeof createTestDb>>;
let admin: string;
let lead: string;
let tutor: string;
let otherTutor: string;
let n = 0;

beforeAll(async () => {
  t = await createTestDb();
  admin = await t.createStaff("admin@contoh.id", "admin");
  lead = await t.createStaff("lead@contoh.id", "lead");
  tutor = await t.createStaff("tutor@contoh.id", "tutor");
  otherTutor = await t.createStaff("tutor2@contoh.id", "tutor");
});

const one = async <T>(sql: string, params: unknown[] = []) => (await t.db.query<T>(sql, params)).rows[0];

async function curriculumOf(code: string) {
  return one<{ id: string; status: string; version: number; modules: number; tasks: number }>(
    `select c.id, c.status, c.version,
            (select count(*)::int from public.curriculum_modules m where m.curriculum_id = c.id) as modules,
            (select count(*)::int from public.module_tasks k join public.curriculum_modules m on m.id = k.module_id where m.curriculum_id = c.id) as tasks
     from public.curricula c join public.programs p on p.id = c.program_id where p.code = $1 order by c.version desc limit 1`,
    [code],
  );
}

// Batch dengan sesi berbasis kurikulum terbit; offsetHours menggeser sesi pertama terhadap sekarang.
async function runningBatch(code: string, offsetHours = -1, sessions = 3) {
  n += 1;
  const c = await one<{ id: string; program_id: string }>("select c.id, c.program_id from public.curricula c join public.programs p on p.id = c.program_id where p.code = $1 and c.status = 'published'", [code]);
  const b = await one<{ id: string }>(
    `insert into public.batches (code, program_id, curriculum_id, tutor_id, start_date, schedule_label, capacity, status)
     values ($1, $2, $3, $4, current_date, 'Senin 19.00 WIB', 6, 'open') returning id`,
    [`F3-T${n}`, c.program_id, c.id, tutor],
  );
  for (let i = 1; i <= sessions; i++) {
    await t.db.query(
      `insert into public.class_sessions (batch_id, seq, starts_at, duration_minutes, module_id)
       select $1, $2, now() + make_interval(hours => $3 + ($2 - 1) * 48), 60, m.id from public.curriculum_modules m where m.curriculum_id = $4 and m.seq = $2`,
      [b.id, i, offsetHours, c.id],
    );
  }
  return b.id;
}

async function activeStudent(batch: string, email: string) {
  const user = await t.createUser(email, { full_name: email.split("@")[0] });
  const s = await one<{ id: string }>("select id from public.students where user_id = $1", [user]);
  await t.db.query("insert into public.enrollments (student_id, batch_id, status, activated_at) values ($1, $2, 'active', now())", [s.id, batch]);
  return { user, student: s.id };
}

const session = (batch: string, seq = 1) => one<{ id: string; module_id: string }>("select id, module_id from public.class_sessions where batch_id = $1 and seq = $2", [batch, seq]);

async function publishTask(batch: string, due = "now() + interval '3 days'") {
  const s = await session(batch);
  const task = await one<{ id: string; submission_type: string }>("select id, submission_type from public.module_tasks where module_id = $1 limit 1", [s.module_id]);
  const due_at = (await one<{ d: string }>(`select (${due})::text as d`)).d;
  const r = await t.as<{ id: string }>(tutor, "select public.publish_assignment($1, $2, 'Tugas uji', 'Kerjakan tugas ini dengan lengkap.', 'any', $3::timestamptz) as id", [s.id, task.id, due_at]);
  return r.rows[0].id;
}

const submit = (user: string, assignment: string, student: string, text = "My answer") =>
  t.as<{ id: string }>(user, "select public.submit_assignment($1, $2, $3, null, null) as id", [assignment, student, text]).then((r) => r.rows[0].id);

describe("kurikulum", () => {
  it("draf kurikulum 12 program terisi dari seed, satu modul dan satu tugas per sesi", async () => {
    const all = await t.db.query<{ code: string; modules: number }>(
      `select p.code, count(m.id)::int as modules from public.programs p
       join public.curricula c on c.program_id = p.id left join public.curriculum_modules m on m.curriculum_id = c.id group by p.code`,
    );
    expect(all.rows).toHaveLength(12);
    const ez = await curriculumOf("EZ");
    expect(ez).toMatchObject({ status: "draft", version: 1, modules: 8, tasks: 8 });
    expect((await curriculumOf("SR")).modules).toBe(16);
    const weeks = await t.db.query<{ week: number }>("select week from public.curriculum_modules where curriculum_id = $1 order by seq", [ez.id]);
    expect(weeks.rows.map((r) => r.week)).toEqual([1, 1, 2, 2, 3, 3, 4, 4]);
  });

  it("hanya Academic Lead/Owner yang mengubah; struktur draf bisa diubah, struktur versi terbit terkunci", async () => {
    const ez = await curriculumOf("EZ");
    await expect(t.as(tutor, "select public.add_curriculum_module($1, 'Modul baru')", [ez.id])).rejects.toThrow(/Hanya Academic Lead/);
    const added = (await t.as<{ id: string }>(lead, "select public.add_curriculum_module($1, 'Bonus: review') as id", [ez.id])).rows[0].id;
    await t.as(lead, "select public.move_curriculum_module($1, -1)", [added]);
    const moved = await one<{ seq: number }>("select seq from public.curriculum_modules where id = $1", [added]);
    expect(moved.seq).toBe(8);
    await t.as(lead, "select public.delete_curriculum_module($1)", [added]);
    const seqs = await t.db.query<{ seq: number }>("select seq from public.curriculum_modules where curriculum_id = $1 order by seq", [ez.id]);
    expect(seqs.rows.map((r) => r.seq)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);

    await t.as(lead, "select public.publish_curriculum($1)", [ez.id]);
    expect((await curriculumOf("EZ")).status).toBe("published");
    await expect(t.as(lead, "select public.add_curriculum_module($1, 'Tambahan')", [ez.id])).rejects.toThrow(/Buat versi baru/);
    const first = await one<{ id: string }>("select id from public.curriculum_modules where curriculum_id = $1 and seq = 1", [ez.id]);
    await expect(t.as(lead, "update public.curriculum_modules set week = 2 where id = $1", [first.id])).rejects.toThrow(/Buat versi baru/);
    // Isi tetap boleh diubah setelah terbit.
    await t.as(lead, "update public.curriculum_modules set content = 'Isi diperbarui' where id = $1", [first.id]);
    expect((await one<{ content: string }>("select content from public.curriculum_modules where id = $1", [first.id])).content).toBe("Isi diperbarui");
    await expect(t.as(tutor, "update public.curriculum_modules set content = 'x' where id = $1 returning id", [first.id]).then((r) => r.rows.length)).resolves.toBe(0);
  });

  it("versi baru menyalin modul, materi, dan tugas; versi lama diarsipkan saat versi baru terbit", async () => {
    const v1 = await curriculumOf("EZ");
    const mod = await one<{ id: string }>("select id from public.curriculum_modules where curriculum_id = $1 and seq = 1", [v1.id]);
    await t.as(lead, "insert into public.module_materials (module_id, kind, title, url) values ($1, 'link', 'Video sapaan', 'https://youtu.be/abc')", [mod.id]);
    const v2id = (await t.as<{ id: string }>(lead, "select public.new_curriculum_version($1) as id", [v1.id])).rows[0].id;
    await expect(t.as(lead, "select public.new_curriculum_version($1)", [v1.id])).rejects.toThrow(/sudah punya draf/);
    const v2 = await curriculumOf("EZ");
    expect(v2).toMatchObject({ id: v2id, version: 2, status: "draft", modules: 8, tasks: 8 });
    const copied = await one<{ n: number }>(
      "select count(*)::int as n from public.module_materials k join public.curriculum_modules m on m.id = k.module_id where m.curriculum_id = $1",
      [v2id],
    );
    expect(copied.n).toBe(1);
    await t.as(lead, "select public.add_curriculum_module($1, 'Sesi tambahan')", [v2id]);
    await t.as(lead, "select public.publish_curriculum($1)", [v2id]);
    const states = await t.db.query<{ version: number; status: string }>(
      "select c.version, c.status from public.curricula c join public.programs p on p.id = c.program_id where p.code = 'EZ' order by c.version",
    );
    expect(states.rows).toEqual([
      { version: 1, status: "archived" },
      { version: 2, status: "published" },
    ]);
  });

  it("batch hanya bisa memakai kurikulum terbit milik programnya", async () => {
    const draft = await curriculumOf("SU");
    await expect(
      t.db.query(
        `insert into public.batches (code, program_id, curriculum_id, start_date, schedule_label, capacity)
         select 'SU-DRAF', id, $1, current_date, 'Senin 19.00', 6 from public.programs where code = 'SU'`,
        [draft.id],
      ),
    ).rejects.toThrow(/kurikulum terbit/);
    const ez = await one<{ id: string }>("select c.id from public.curricula c join public.programs p on p.id = c.program_id where p.code = 'EZ' and c.status = 'published'");
    await expect(
      t.db.query(
        `insert into public.batches (code, program_id, curriculum_id, start_date, schedule_label, capacity)
         select 'SU-SALAH', id, $1, current_date, 'Senin 19.00', 6 from public.programs where code = 'SU'`,
        [ez.id],
      ),
    ).rejects.toThrow(/kurikulum terbit/);
  });
});

describe("absensi", () => {
  it("tutor batch mengisi absensi setelah sesi dimulai; tutor lain dan sebelum sesi ditolak", async () => {
    const batch = await runningBatch("EZ");
    const a = await activeStudent(batch, "hadir@contoh.id");
    const b = await activeStudent(batch, "absen@contoh.id");
    const s1 = await session(batch, 1);
    const s2 = await session(batch, 2);
    const entries = JSON.stringify([
      { student_id: a.student, status: "present" },
      { student_id: b.student, status: "absent", note: "Tanpa kabar" },
    ]);
    await expect(t.as(otherTutor, "select public.record_attendance($1, $2::jsonb, '')", [s1.id, entries])).rejects.toThrow(/Hanya tutor batch/);
    await expect(t.as(tutor, "select public.record_attendance($1, $2::jsonb, '')", [s2.id, entries])).rejects.toThrow(/setelah sesi dimulai/);
    await t.as(tutor, "select public.record_attendance($1, $2::jsonb, 'Materi sapaan selesai')", [s1.id, entries]);
    const row = await one<{ attendance_done_at: string | null; tutor_note: string }>("select attendance_done_at, tutor_note from public.class_sessions where id = $1", [s1.id]);
    expect(row.attendance_done_at).not.toBeNull();
    expect(row.tutor_note).toBe("Materi sapaan selesai");
    // Siswa hanya melihat kehadirannya sendiri.
    const seen = await t.as<{ status: string }>(a.user, "select status from public.attendance");
    expect(seen.rows).toEqual([{ status: "present" }]);
    // Mengisi ulang memperbarui, bukan menggandakan.
    await t.as(tutor, "select public.record_attendance($1, $2::jsonb, '')", [s1.id, JSON.stringify([{ student_id: b.student, status: "excused" }])]);
    expect((await one<{ status: string }>("select status from public.attendance where session_id = $1 and student_id = $2", [s1.id, b.student])).status).toBe("excused");
    const outsider = await t.createUser("luar@contoh.id");
    const outsiderStudent = (await one<{ id: string }>("select id from public.students where user_id = $1", [outsider])).id;
    await expect(t.as(tutor, "select public.record_attendance($1, $2::jsonb, '')", [s1.id, JSON.stringify([{ student_id: outsiderStudent, status: "present" }])])).rejects.toThrow(
      /tidak terdaftar/,
    );
  });
});

describe("tugas dan feedback", () => {
  it("tutor menerbitkan tugas dari modul sesi; template yang sama tidak bisa diterbitkan dua kali", async () => {
    const batch = await runningBatch("EZ");
    const id = await publishTask(batch);
    expect(id).toBeTruthy();
    await expect(publishTask(batch)).rejects.toThrow(/sudah diterbitkan/);
    const s = await session(batch);
    await expect(
      t.as(otherTutor, "select public.publish_assignment($1, null, 'Tugas', 'Instruksi tugas.', 'text', now() + interval '1 day')", [s.id]),
    ).rejects.toThrow(/Hanya tutor batch/);
    await expect(t.as(tutor, "select public.publish_assignment($1, null, 'Tugas', 'Instruksi tugas.', 'text', now() - interval '1 day')", [s.id])).rejects.toThrow(/masa depan/);
  });

  it("siswa mengumpulkan, tutor minta revisi maksimal 2 kali, lalu menerima", async () => {
    const batch = await runningBatch("EZ");
    const st = await activeStudent(batch, "revisi@contoh.id");
    const asg = await publishTask(batch);
    const v1 = await submit(st.user, asg, st.student);
    await expect(submit(st.user, asg, st.student)).rejects.toThrow(/menunggu feedback/);

    // Draf feedback tidak terlihat siswa.
    await t.as(tutor, "select public.save_feedback($1, 'Bagus, perbaiki bagian akhir.', 'revision', false)", [v1]);
    expect((await t.as(st.user, "select * from public.feedback")).rows).toHaveLength(0);
    await expect(t.as(otherTutor, "select public.save_feedback($1, 'Feedback lain.', 'accepted', true)", [v1])).rejects.toThrow(/Hanya tutor batch/);
    await t.as(tutor, "select public.save_feedback($1, 'Bagus, perbaiki bagian akhir.', 'revision', true)", [v1]);
    expect((await t.as(st.user, "select body from public.feedback")).rows).toHaveLength(1);
    await expect(t.as(tutor, "select public.save_feedback($1, 'Ubah lagi.', 'accepted', true)", [v1])).rejects.toThrow(/sudah diterbitkan/);

    const v2 = await submit(st.user, asg, st.student, "Revisi pertama");
    await t.as(tutor, "select public.save_feedback($1, 'Masih ada yang kurang.', 'revision', true)", [v2]);
    const v3 = await submit(st.user, asg, st.student, "Revisi kedua");
    await expect(t.as(tutor, "select public.save_feedback($1, 'Revisi lagi.', 'revision', true)", [v3])).rejects.toThrow(/Batas revisi 2 kali/);
    await t.as(tutor, "select public.save_feedback($1, 'Sudah baik, diterima.', 'accepted', true)", [v3]);
    await expect(submit(st.user, asg, st.student, "Lagi")).rejects.toThrow(/sudah selesai dinilai/);
    const versions = await t.db.query<{ version: number; status: string }>("select version, status from public.submissions where assignment_id = $1 order by version", [asg]);
    expect(versions.rows).toEqual([
      { version: 1, status: "revision_requested" },
      { version: 2, status: "revision_requested" },
      { version: 3, status: "accepted" },
    ]);
  });

  it("pengumpulan setelah tenggat tetap diterima dengan tanda terlambat", async () => {
    const batch = await runningBatch("EZ");
    const st = await activeStudent(batch, "telat@contoh.id");
    const asg = await publishTask(batch);
    await t.db.query("update public.assignments set due_at = now() - interval '1 hour' where id = $1", [asg]);
    const id = await submit(st.user, asg, st.student);
    expect((await one<{ is_late: boolean }>("select is_late from public.submissions where id = $1", [id])).is_late).toBe(true);
  });

  it("anak tanpa akun mengumpulkan lewat wali terverifikasi; siswa lain dan file di luar folder ditolak", async () => {
    const batch = await runningBatch("EZ");
    const g = await t.createUser("wali3@contoh.id", { account_type: "guardian", child_name: "Nara" });
    const child = (await one<{ student_id: string }>("select student_id from public.guardian_links where guardian_id = $1", [g])).student_id;
    await t.db.query("insert into public.enrollments (student_id, batch_id, status) values ($1, $2, 'active')", [child, batch]);
    const asg = await publishTask(batch);
    await expect(submit(g, asg, child)).rejects.toThrow(/akun siswa/);
    await t.db.query("update public.guardian_links set status = 'verified' where guardian_id = $1", [g]);
    expect(await submit(g, asg, child)).toBeTruthy();

    const st = await activeStudent(batch, "folder@contoh.id");
    await expect(t.as(st.user, "select public.submit_assignment($1, $2, null, 'lain/file.pdf', 'application/pdf')", [asg, st.student])).rejects.toThrow(/File tugas tidak valid/);
    const stranger = await t.createUser("asing@contoh.id");
    await expect(submit(stranger, asg, st.student)).rejects.toThrow(/tidak ditemukan/);
  });

  it("siswa tidak bisa menulis langsung ke tabel tugas, absensi, atau feedback", async () => {
    const batch = await runningBatch("EZ");
    const st = await activeStudent(batch, "langsung@contoh.id");
    const asg = await publishTask(batch);
    await expect(t.as(st.user, "insert into public.submissions (assignment_id, student_id, version, text_answer) values ($1, $2, 1, 'x')", [asg, st.student])).rejects.toThrow(
      /permission denied/,
    );
    await expect(t.as(tutor, "update public.assignments set due_at = now() + interval '9 days' where id = $1", [asg])).rejects.toThrow(/permission denied/);
    const s = await session(batch);
    await expect(t.as(st.user, "insert into public.attendance (session_id, student_id, status) values ($1, $2, 'present')", [s.id, st.student])).rejects.toThrow(/permission denied/);
  });
});

describe("status batch otomatis", () => {
  it("batch berjalan sejak sesi pertama, selesai setelah sesi terakhir; siswa menjadi selesai dan tidak bisa mengumpulkan", async () => {
    const future = await runningBatch("EZ", 24);
    const batch = await runningBatch("EZ", -1, 2);
    const st = await activeStudent(batch, "selesai@contoh.id");
    const asg = await publishTask(batch);
    await t.as(admin, "select public.sync_batch_status()");
    const status = async (id: string) => (await one<{ status: string }>("select status from public.batches where id = $1", [id])).status;
    expect(await status(future)).toBe("open");
    expect(await status(batch)).toBe("running");

    await t.db.query("update public.class_sessions set starts_at = now() - interval '5 days' + (seq || ' hours')::interval where batch_id = $1", [batch]);
    await t.as(admin, "select public.sync_batch_status()");
    expect(await status(batch)).toBe("completed");
    expect((await one<{ status: string }>("select status from public.enrollments where student_id = $1", [st.student])).status).toBe("completed");
    await expect(submit(st.user, asg, st.student)).rejects.toThrow(/selama kelas aktif/);
  });
});
