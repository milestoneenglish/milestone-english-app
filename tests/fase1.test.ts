// Fase 1: pendaftaran siswa/wali dan keamanan data placement.
import { beforeAll, describe, expect, it } from "vitest";
import { createTestDb } from "./db-helpers";

let t: Awaited<ReturnType<typeof createTestDb>>;

beforeAll(async () => {
  t = await createTestDb();
});

async function studentOf(userId: string) {
  const res = await t.db.query<{ id: string; full_name: string; interested_program_id: string | null }>(
    "select id, full_name, interested_program_id from public.students where user_id = $1",
    [userId],
  );
  return res.rows[0];
}

describe("pendaftaran", () => {
  it("siswa dewasa langsung punya profil siswa dengan program pilihannya", async () => {
    const id = await t.createUser("dewasa@contoh.id", { full_name: "Budi", learning_goal: "Percakapan", program_slug: "speakup", birth_year: "1998" });
    const s = await studentOf(id);
    expect(s.full_name).toBe("Budi");
    const program = await t.db.query<{ slug: string }>("select slug from public.programs where id = $1", [s.interested_program_id]);
    expect(program.rows[0].slug).toBe("speakup");
    expect(await t.rolesOf(id)).toEqual(["student"]);
  });

  it("wali mendaftarkan anak: anak tercatat dan hubungannya menunggu verifikasi", async () => {
    const id = await t.createUser("ibu@contoh.id", { account_type: "guardian", full_name: "Ibu Sari", child_name: "Raka", child_birth_year: "2016", relationship: "orang_tua" });
    expect(await t.rolesOf(id)).toEqual(["guardian"]);
    const links = await t.db.query<{ status: string; full_name: string; user_id: string | null }>(
      "select g.status, s.full_name, s.user_id from public.guardian_links g join public.students s on s.id = g.student_id where g.guardian_id = $1",
      [id],
    );
    expect(links.rows).toEqual([{ status: "pending", full_name: "Raka", user_id: null }]);
    expect(await studentOf(id)).toBeUndefined();
  });

  it("wali bisa menambah anak lewat add_child, bukan role lain", async () => {
    const guardian = await t.createUser("ayah@contoh.id", { account_type: "guardian", child_name: "Anak Satu" });
    await t.as(guardian, "select public.add_child('Anak Dua', 2014, 'Sekolah', null, 'orang_tua')");
    const kids = await t.as<{ full_name: string }>(guardian, "select full_name from public.students order by full_name");
    expect(kids.rows.map((r) => r.full_name)).toEqual(["Anak Dua", "Anak Satu"]);

    const student = await t.createUser("murid@contoh.id");
    await expect(t.as(student, "select public.add_child('X', 2015, '', null, 'orang_tua')")).rejects.toThrow(/Hanya wali/);
  });
});

describe("akses data siswa", () => {
  it("siswa hanya melihat profil siswanya sendiri", async () => {
    const a = await t.createUser("a@contoh.id", { full_name: "A" });
    await t.createUser("b@contoh.id", { full_name: "B" });
    const rows = await t.as<{ full_name: string }>(a, "select full_name from public.students");
    expect(rows.rows.map((r) => r.full_name)).toEqual(["A"]);
  });

  it("wali tidak melihat anak wali lain, dan anak yang ditolak admin tidak lagi terlihat", async () => {
    const g1 = await t.createUser("g1@contoh.id", { account_type: "guardian", child_name: "Anak G1" });
    const g2 = await t.createUser("g2@contoh.id", { account_type: "guardian", child_name: "Anak G2" });
    const seen = await t.as<{ full_name: string }>(g1, "select full_name from public.students");
    expect(seen.rows.map((r) => r.full_name)).toEqual(["Anak G1"]);

    const admin = await t.createStaff("admin1@contoh.id", "admin");
    await t.as(admin, "update public.guardian_links set status = 'rejected', decided_by = $1, decided_at = now() where guardian_id = $2", [admin, g2]);
    const after = await t.as<{ n: number }>(g2, "select count(*)::int as n from public.students");
    expect(after.rows[0].n).toBe(0);
  });

  it("wali tidak bisa memverifikasi hubungannya sendiri", async () => {
    const g = await t.createUser("g3@contoh.id", { account_type: "guardian", child_name: "Anak G3" });
    await t.as(g, "update public.guardian_links set status = 'verified' where guardian_id = $1", [g]);
    const link = await t.db.query<{ status: string }>("select status from public.guardian_links where guardian_id = $1", [g]);
    expect(link.rows[0].status).toBe("pending");
  });

  it("siswa tidak bisa mengubah status dirinya menjadi aktif", async () => {
    const s = await t.createUser("c@contoh.id");
    await expect(t.as(s, "update public.students set status = 'active' where user_id = $1", [s])).rejects.toThrow(/permission denied/);
  });
});

describe("placement", () => {
  it("bank soal lengkap tersedia: 26 pilihan ganda, 1 writing, 2 speaking", async () => {
    const res = await t.db.query<{ section: string; n: number }>("select section, count(*)::int as n from public.placement_questions group by section order by section");
    expect(Object.fromEntries(res.rows.map((r) => [r.section, r.n]))).toEqual({ grammar: 12, listening: 6, reading: 8, speaking: 2, writing: 1 });
  });

  it("siswa, wali, tutor, dan pengunjung tidak bisa membaca kunci jawaban", async () => {
    const s = await t.createUser("d@contoh.id");
    const tutor = await t.createStaff("tutor1@contoh.id", "tutor");
    for (const who of [null, s, tutor]) {
      const res = await t.as<{ n: number }>(who, "select count(*)::int as n from public.placement_questions");
      expect(res.rows[0].n).toBe(0);
    }
    const lead = await t.createStaff("lead1@contoh.id", "lead");
    const leadSees = await t.as<{ n: number }>(lead, "select count(*)::int as n from public.placement_questions");
    expect(leadSees.rows[0].n).toBe(29);
  });

  it("hasil placement tidak bisa dibaca langsung oleh siswa; tutor hanya melihat yang ditugaskan", async () => {
    const s = await t.createUser("e@contoh.id", { full_name: "Eka" });
    const student = await studentOf(s);
    const tutorA = await t.createStaff("tutorA@contoh.id", "tutor");
    const tutorB = await t.createStaff("tutorB@contoh.id", "tutor");
    await t.db.query("insert into public.placement_attempts (student_id, status, evaluator_id) values ($1, 'awaiting_review', $2)", [student.id, tutorA]);

    expect((await t.as<{ n: number }>(s, "select count(*)::int as n from public.placement_attempts")).rows[0].n).toBe(0);
    expect((await t.as<{ n: number }>(tutorA, "select count(*)::int as n from public.placement_attempts")).rows[0].n).toBe(1);
    expect((await t.as<{ n: number }>(tutorB, "select count(*)::int as n from public.placement_attempts")).rows[0].n).toBe(0);
    // Tutor yang ditugaskan juga bisa melihat nama siswanya.
    const names = await t.as<{ full_name: string }>(tutorA, "select full_name from public.students");
    expect(names.rows.map((r) => r.full_name)).toEqual(["Eka"]);
  });

  it("hasil yang sudah terbit tidak bisa diubah", async () => {
    const s = await t.createUser("f@contoh.id");
    const student = await studentOf(s);
    const res = await t.db.query<{ id: string }>(
      "insert into public.placement_attempts (student_id, status, published_at) values ($1, 'published', now()) returning id",
      [student.id],
    );
    await expect(t.db.query("update public.placement_attempts set levels = '{}'::jsonb where id = $1", [res.rows[0].id])).rejects.toThrow(/sudah terbit/);
  });

  it("attempt wajib terhubung ke siswa atau token tamu", async () => {
    await expect(t.db.query("insert into public.placement_attempts (status) values ('in_progress')")).rejects.toThrow(/check/);
  });
});
