// Kelompok 3: CMS khusus Owner, kartu landing page (mitra, tutor, galeri), dan website dua bahasa.
import { beforeAll, describe, expect, it } from "vitest";
import { SEED_PROGRAMS } from "../src/data/catalog";
import { DEFAULT_LANDING, DEFAULT_LANDING_EN, englishOverlay, mergeLanding, mergeSections, withFallback } from "../src/data/landing";
import { localizeCopy, localizeProgram, pickEn } from "../src/lib/content";
import { localePath, programLabelEn, switchPath } from "../src/lib/i18n";
import { passwordProblem } from "../src/lib/password";
import { createTestDb } from "./db-helpers";

type Ctx = Awaited<ReturnType<typeof createTestDb>>;

describe("kartu landing page", () => {
  let t: Ctx;
  let owner: string;
  let admin: string;
  const img = "https://contoh.supabase.co/storage/v1/object/public/site-images/items/partner-1.webp";

  beforeAll(async () => {
    t = await createTestDb();
    owner = await t.createStaff("owner3@milestone.test", "owner");
    admin = await t.createStaff("admin3@milestone.test", "admin");
  });

  it("Owner menambah kartu; pengunjung hanya melihat yang On; Admin tidak bisa mengubah", async () => {
    await t.as(owner, "insert into public.site_items (kind, title, image_url) values ('partner', 'SMA Contoh', $1)", [img]);
    await t.as(owner, "insert into public.site_items (kind, title, subtitle, body, published) values ('tutor', 'Tutor Draf', 'IELTS', 'Riwayat singkat tutor.', false)");
    expect((await t.as(null, "select title from public.site_items order by title")).rows).toEqual([{ title: "SMA Contoh" }]);
    expect((await t.as(owner, "select title from public.site_items")).rows).toHaveLength(2);
    await expect(t.as(admin, "insert into public.site_items (kind, title, image_url) values ('partner', 'Coba', $1)", [img])).rejects.toThrow(/row-level security/);
  });

  it("logo dan foto galeri wajib berupa gambar; nama mitra dan tutor wajib diisi", async () => {
    await expect(t.as(owner, "insert into public.site_items (kind, title) values ('gallery', '')")).rejects.toThrow(/check/);
    await expect(t.as(owner, "insert into public.site_items (kind, title, image_url) values ('partner', '', $1)", [img])).rejects.toThrow(/check/);
    await expect(t.as(owner, "insert into public.site_items (kind, title, image_url) values ('gallery', '', 'http://tidak-aman/x.jpg')")).rejects.toThrow(/check/);
    await t.as(owner, "insert into public.site_items (kind, image_url) values ('gallery', $1)", [img]);
  });

  it("testimoni boleh berfoto dan berisi versi English", async () => {
    await t.as(owner, "insert into public.testimonials (name, program_label, quote, quote_en, photo_url, published) values ('Rani', 'Peserta SpeakUp', 'Kelasnya seru sekali.', 'Such a fun class.', $1, true)", [img]);
    expect((await t.as(null, "select quote_en, photo_url from public.testimonials")).rows).toEqual([{ quote_en: "Such a fun class.", photo_url: img }]);
  });
});

describe("website dua bahasa", () => {
  it("alamat halaman per bahasa dan tombol ID | EN", () => {
    expect(localePath("en", "/")).toBe("/en");
    expect(localePath("en", "/daftar")).toBe("/en/daftar");
    expect(localePath("id", "/daftar")).toBe("/daftar");
    expect(switchPath("/en/masuk", "id")).toBe("/masuk");
    expect(switchPath("/en", "id")).toBe("/");
    expect(switchPath("/daftar", "en")).toBe("/en/daftar");
  });

  it("teks English: isian tersimpan, lalu terjemahan bawaan selama teks Indonesia belum diubah, lalu teks Indonesia", () => {
    const changed = mergeLanding({ faq: { title_start: "Tanya Jawab" } });
    const en = englishOverlay(changed, DEFAULT_LANDING, DEFAULT_LANDING_EN, { faq: { kicker: "Questions" } });
    expect(en.faq.kicker).toBe("Questions");
    expect(en.faq.title_start).toBe("");
    expect(en.faq.title_accent).toBe(DEFAULT_LANDING_EN.faq.title_accent);
    const shown = withFallback(en, changed);
    expect(shown.faq.title_start).toBe("Tanya Jawab");

    const { hero, copy } = localizeCopy("en", { landing: changed });
    expect(hero.title_accent).toBe("English Milestone");
    expect(copy.faq.title_start).toBe("Tanya Jawab");
    expect(copy.tutors.title_accent).toBe("Our Tutors");
  });

  it("program: terjemahan bawaan hanya untuk teks yang belum diubah; label durasi dan jadwal diterjemahkan otomatis", () => {
    const seed = SEED_PROGRAMS.find((p) => p.slug === "speakup")!;
    expect(localizeProgram(seed, "en").outcome).toMatch(/^Sustain a 5-minute conversation/);
    expect(localizeProgram({ ...seed, outcome: "Target versi baru." }, "en").outcome).toBe("Target versi baru.");
    expect(localizeProgram({ ...seed, outcome: "Target versi baru.", outcome_en: "New target." }, "en").outcome).toBe("New target.");
    expect(localizeProgram(seed, "en").duration_label).toBe("4 weeks (8 × 60 min)");
    expect(programLabelEn("Pemula–A1 (usia 6–12)")).toBe("Beginner–A1 (age 6–12)");
    expect(programLabelEn("Senin & Rabu · 19.00–20.00 WIB")).toBe("Mon & Wed · 19.00–20.00 WIB");
    expect(pickEn("", "Teks")).toBe("Teks");
  });

  it("semua bagian tampil kecuali yang dimatikan Owner", () => {
    const s = mergeSections({ gallery: false, unknown: false });
    expect(s.gallery).toBe(false);
    expect(s.tutors).toBe(true);
    expect(Object.keys(s)).not.toContain("unknown");
  });

  it("pesan aturan password mengikuti bahasa halaman", () => {
    expect(passwordProblem("abc", "en")).toBe("Your password must be at least 8 characters.");
    expect(passwordProblem("abcdefgh")).toBe("Password harus berisi huruf dan angka.");
  });
});
