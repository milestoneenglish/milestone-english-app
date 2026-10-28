// Kelompok 1 perbaikan: notifikasi portal (lonceng), sapaan sesuai jam WIB, dan penjelasan level.
import { beforeAll, describe, expect, it } from "vitest";
import { greeting } from "../src/components/portal/ui";
import { LEVEL_INFO, LEVELS, levelTitle } from "../src/lib/placement/levels";
import { createTestDb } from "./db-helpers";

type Ctx = Awaited<ReturnType<typeof createTestDb>>;

describe("notifikasi portal", () => {
  let t: Ctx;
  let a: string;
  let b: string;

  beforeAll(async () => {
    t = await createTestDb();
    a = await t.createUser("siswa-a@milestone.test", { full_name: "Siswa A" });
    b = await t.createUser("siswa-b@milestone.test", { full_name: "Siswa B" });
    await t.db.query("insert into inbox (recipient_id, template, title, link) values ($1, 'x', 'Untuk A', '/portal'), ($1, 'x', 'Untuk A lagi', null), ($2, 'x', 'Untuk B', null)", [a, b]);
  });

  it("setiap akun hanya melihat notifikasinya sendiri", async () => {
    const rows = await t.as<{ title: string }>(a, "select title from inbox order by title");
    expect(rows.rows.map((r) => r.title)).toEqual(["Untuk A", "Untuk A lagi"]);
  });

  it("tidak bisa menulis notifikasi langsung dari klien", async () => {
    await expect(t.as(a, "insert into inbox (recipient_id, template, title) values ($1, 'x', 'palsu')", [b])).rejects.toThrow();
    await expect(t.as(a, "update inbox set read_at = now()")).rejects.toThrow();
  });

  it("menandai dibaca hanya milik sendiri", async () => {
    const res = await t.as<{ n: number }>(a, "select public.mark_inbox_read(null) as n");
    expect(res.rows[0].n).toBe(2);
    const unreadB = await t.db.query<{ n: number }>("select count(*)::int as n from inbox where recipient_id = $1 and read_at is null", [b]);
    expect(unreadB.rows[0].n).toBe(1);
  });

  it("link notifikasi harus jalur di dalam aplikasi", async () => {
    await expect(t.db.query("insert into inbox (recipient_id, template, title, link) values ($1, 'x', 'luar', 'https://contoh.com')", [a])).rejects.toThrow();
  });
});

describe("sapaan Beranda", () => {
  // Jam UTC + 7 = WIB.
  const at = (wibHour: number) => new Date(Date.UTC(2026, 9, 27, (wibHour + 24 - 7) % 24, 0));
  it.each([
    [5, "pagi"],
    [10, "pagi"],
    [11, "siang"],
    [14, "siang"],
    [15, "sore"],
    [17, "sore"],
    [18, "malam"],
    [2, "malam"],
  ])("pukul %i WIB: selamat %s", (hour, part) => {
    expect(greeting("Raka", at(hour))).toBe(`Selamat ${part}, Raka!`);
  });
});

describe("penjelasan level", () => {
  it("setiap level placement punya nama dan penjelasan", () => {
    for (const l of LEVELS) expect(LEVEL_INFO[l]?.text.length).toBeGreaterThan(10);
    expect(levelTitle("A2")).toContain("Dasar lanjut");
    expect(levelTitle(null)).toBeUndefined();
  });
});
