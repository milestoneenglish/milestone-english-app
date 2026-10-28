// Data contoh (scripts/demo-data.mjs) diisi ke Postgres sungguhan, alur utama dicoba dengan akun demo,
// lalu dihapus: isi database harus kembali persis seperti sebelum diisi.
import type { PGlite } from "@electric-sql/pglite";
import { beforeAll, describe, expect, it } from "vitest";
import { appMetadata, hapus, isi } from "../scripts/demo-data.mjs";
import { createTestDb } from "./db-helpers";

type Ctx = Awaited<ReturnType<typeof createTestDb>>;
type Account = { key: string; name: string; meta?: object; role?: string };

// Antarmuka minimal pustaka `postgres` (tagged template, unsafe, begin) di atas PGlite.
function postgresLike(db: PGlite) {
  const run = async (text: string, params: unknown[] = []) => (await db.query(text, params)).rows;
  const sql = (strings: TemplateStringsArray, ...values: unknown[]) => run(strings.reduce((q, s, i) => `${q}$${i}${s}`), values);
  sql.unsafe = run;
  sql.begin = async <T,>(fn: (tx: typeof sql) => Promise<T>) => {
    await db.exec("begin");
    try {
      const result = await fn(sql);
      await db.exec("commit");
      return result;
    } catch (e) {
      await db.exec("rollback");
      throw e;
    }
  };
  return sql;
}

async function tableCounts(db: PGlite) {
  const tables = await db.query<{ t: string }>("select table_schema || '.' || table_name as t from information_schema.tables where table_schema in ('public', 'auth') and table_type = 'BASE TABLE' order by 1");
  const counts: Record<string, number> = {};
  for (const { t } of tables.rows) counts[t] = (await db.query<{ n: number }>(`select count(*)::int as n from ${t}`)).rows[0].n;
  return counts;
}

describe("data contoh uji coba", () => {
  let t: Ctx;
  let db: PGlite;
  let before: Record<string, number>;
  const files = new Map<string, Buffer>();
  let ctx: object;
  let u: Record<string, string>;
  const one = async <T,>(q: string, p: unknown[] = []) => (await db.query<T>(q, p)).rows[0];
  const call = (who: string, q: string, p: unknown[] = []) => t.as(u[who], q, p);

  beforeAll(async () => {
    t = await createTestDb();
    db = t.db;
    before = await tableCounts(db);
    ctx = {
      sql: postgresLike(db),
      createAccount: async (account: Account, email: string) => {
        const meta = JSON.stringify({ full_name: account.name, ...account.meta });
        return t.createUser(email, JSON.parse(meta), appMetadata(account));
      },
      storage: {
        upload: async (bucket: string, path: string, body: Buffer) => void files.set(`${bucket}/${path}`, body),
        list: async (bucket: string, folder: string) =>
          [...new Set([...files.keys()].filter((k) => k.startsWith(`${bucket}/${folder}/`)).map((k) => k.slice(bucket.length + folder.length + 2).split("/")[0]))],
        remove: async (bucket: string, paths: string[]) => paths.forEach((p) => files.delete(`${bucket}/${p}`)),
      },
    };
    const result = await isi(ctx, { password: "Demo12345" });
    u = Object.fromEntries(result.accounts.map((a: { key: string; id: string }) => [a.key, a.id]));
  });

  it("membuat 7 akun demo dengan role yang benar", async () => {
    expect(Object.keys(u)).toHaveLength(7);
    for (const [key, roles] of Object.entries({ owner: ["owner"], admin: ["admin"], lead: ["lead"], tutor: ["tutor"], siswa: ["student"], wali: ["guardian"], baru: ["student"] })) {
      expect(await t.rolesOf(u[key])).toEqual(roles);
    }
    const children = await db.query<{ full_name: string }>("select s.full_name from guardian_links g join students s on s.id = g.student_id where g.guardian_id = $1 and g.status = 'verified' order by 1", [u.wali]);
    expect(children.rows.map((r) => r.full_name)).toEqual(["Dewi Wijaya", "Sinta Wijaya"]);
  });

  it("menyusun 3 batch SpeakUp dengan status sesuai jadwal", async () => {
    const batches = await db.query<{ code: string; status: string }>("select code, status from batches order by code");
    expect(batches.rows).toEqual([
      { code: "DEMO-SU-A", status: "running" },
      { code: "DEMO-SU-B", status: "completed" },
      { code: "DEMO-SU-C", status: "open" },
    ]);
    expect(await one("select public.sync_batch_status() as n")).toEqual({ n: 0 });
    const cur = await one<{ status: string }>("select c.status from curricula c join programs p on p.id = c.program_id where p.slug = 'speakup'");
    expect(cur.status).toBe("published");
    expect([...files.keys()].some((k) => k.startsWith("payment-proofs/") && k.endsWith(".pdf"))).toBe(true);
  });

  it("menyisakan pekerjaan nyata untuk setiap role", async () => {
    const sessionA = (seq: number) => one<{ id: string }>("select s.id from class_sessions s join batches b on b.id = s.batch_id where b.code = 'DEMO-SU-A' and s.seq = $1", [seq]);
    const student = (name: string) => one<{ id: string }>("select id from students where full_name = $1", [name]);
    const roster = await db.query<{ student_id: string }>("select e.student_id from enrollments e join batches b on b.id = e.batch_id where b.code = 'DEMO-SU-A'");

    // Tutor: absensi sesi 5, feedback revisi Raka, assessment tengah, laporan Dewi.
    const s5 = await sessionA(5);
    await call("tutor", "select public.record_attendance($1, $2::jsonb, '')", [s5.id, JSON.stringify(roster.rows.map((r) => ({ student_id: r.student_id, status: "present" })))]);
    const pending = await one<{ id: string }>("select s.id from submissions s join students st on st.id = s.student_id where st.full_name = 'Raka Pratama' and s.version = 2");
    await call("tutor", "select public.save_feedback($1, 'Revisi sudah lengkap, terima kasih.', 'accepted', true)", [pending.id]);
    const raka = await student("Raka Pratama");
    const batchA = await one<{ id: string }>("select id from batches where code = 'DEMO-SU-A'");
    const indicators = await db.query<{ id: string }>("select r.id from rubric_indicators r join batches b on b.curriculum_id = r.curriculum_id where b.id = $1", [batchA.id]);
    const scores = JSON.stringify(Object.fromEntries(indicators.rows.map((r) => [r.id, 3])));
    await call("tutor", "select public.save_assessment($1, $2, 'mid', $3::jsonb, '', true)", [batchA.id, raka.id, scores]);
    const dewiEnrollment = await one<{ id: string }>("select e.id from enrollments e join students s on s.id = e.student_id where s.full_name = 'Dewi Wijaya'");
    const program = await one<{ id: string }>("select id from programs where slug = 'english-circle'");
    await call("tutor", "select public.save_report($1, 'Dewi lebih percaya diri bertanya balik.', 'Perlu memperluas kosakata pendapat.', '{\"speaking\":\"A2\"}'::jsonb, $2::uuid[], true)", [dewiEnrollment.id, [program.id]]);

    // Lead: menerbitkan laporan Budi. Admin: memverifikasi pembayaran Eka.
    const budiReport = await one<{ id: string }>("select r.id from reports r join students s on s.id = r.student_id where s.full_name = 'Budi Santoso'");
    await call("lead", "select public.review_report($1, true, 'Bagus.', null, '{}'::jsonb)", [budiReport.id]);
    const proof = await one<{ id: string }>("select id from payment_proofs where status = 'pending'");
    await call("admin", "select public.decide_payment($1, true, null)", [proof.id]);

    // Siswa mengumpulkan tugas sesi 5; wali mengumpulkan tugas Sinta dan mengisi survei Dewi.
    const task = (seq: number) => one<{ id: string }>("select a.id from assignments a join class_sessions s on s.id = a.session_id join batches b on b.id = a.batch_id where b.code = 'DEMO-SU-A' and s.seq = $1", [seq]);
    await call("siswa", "select public.submit_assignment($1, $2, 'My opinion about remote work.', null, null)", [(await task(5)).id, raka.id]);
    await call("wali", "select public.submit_assignment($1, $2, 'Last holiday I visited my grandmother.', null, null)", [(await task(4)).id, (await student("Sinta Wijaya")).id]);
    await call("wali", "select public.submit_tutor_survey($1, 4, 'Seru.')", [dewiEnrollment.id]);

    // Siswa baru belum bisa memilih kelas sebelum hasil placement terbit.
    const nadia = await one<{ id: string; status: string }>("select id, status from students where user_id = $1", [u.baru]);
    expect(nadia.status).toBe("prospect");
    const batchC = await one<{ id: string }>("select id from batches where code = 'DEMO-SU-C'");
    await expect(call("baru", "select public.enroll_in_batch($1, $2)", [nadia.id, batchC.id])).rejects.toThrow("Hasil placement test belum terbit.");
  });

  it("menghapus seluruh data contoh, termasuk staf tambahan Owner demo, dan mengembalikan kurikulum ke draf", async () => {
    const extra = await t.createUser("tutor-baru@milestone.test", {}, { provisioned: true });
    await call("owner", "select public.set_staff_roles($1, array['tutor']::app_role[])", [extra]);
    // Skrip dijalankan tanpa sesi pengguna (koneksi database langsung).
    await db.query("select set_config('request.jwt.claim.sub', '', false)");
    const n = await hapus(ctx);
    expect(n).toEqual({ users: 8, batches: 3, students: 8 });
    expect(await tableCounts(db)).toEqual(before);
    const cur = await one<{ status: string; published_at: string | null }>("select c.status, c.published_at from curricula c join programs p on p.id = c.program_id where p.slug = 'speakup'");
    expect(cur).toEqual({ status: "draft", published_at: null });
    expect(files.size).toBe(0);
  });
});
