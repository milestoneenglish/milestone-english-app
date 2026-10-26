import { describe, expect, it } from "vitest";
import { levelFromPercent, levelFromRubric, overallLevel, recommendPrograms, rubricAverage } from "@/lib/placement/levels";

describe("level placement", () => {
  it("persentase pilihan ganda menjadi level CEFR", () => {
    expect([0, 19, 20, 39, 40, 59, 60, 79, 80, 100].map(levelFromPercent)).toEqual(["Pre-A1", "Pre-A1", "A1", "A1", "A2", "A2", "B1", "B1", "B2", "B2"]);
  });

  it("rata-rata rubrik menjadi level CEFR", () => {
    expect([1, 1.75, 2, 2.5, 3, 3.5, 4].map(levelFromRubric)).toEqual(["Pre-A1", "A1", "A2", "A2", "B1", "B2", "B2"]);
  });

  it("level keseluruhan dibulatkan ke bawah", () => {
    expect(overallLevel(["B1", "A2", "A2", "B1", "B2"])).toBe("A2");
    expect(overallLevel(["B1", "B1", "B2"])).toBe("B1");
    expect(overallLevel([])).toBeNull();
  });

  it("rata-rata rubrik mengabaikan nilai di luar 1–4", () => {
    expect(rubricAverage({ a: 4, b: 2, c: 9 })).toBe(3);
    expect(rubricAverage({})).toBeNull();
  });
});

describe("rekomendasi program", () => {
  it("anak 6–12 tahun selalu LittleLingo", () => {
    expect(recommendPrograms("B1", 9, "percakapan")).toEqual(["littlelingo"]);
  });

  it("remaja mendapat TeenTalk, ditambah LitLab mulai A2", () => {
    expect(recommendPrograms("A1", 15, "percakapan")).toEqual(["teentalk"]);
    expect(recommendPrograms("B1", 15, "sekolah")).toEqual(["litlab", "teentalk"]);
  });

  it("pemula dewasa diarahkan ke English Zero", () => {
    expect(recommendPrograms("Pre-A1", 25, "percakapan")).toEqual(["english-zero"]);
    expect(recommendPrograms("Pre-A1", 25, "karier")).toEqual(["english-zero"]);
  });

  it("tujuan akademik dan karier menyesuaikan level", () => {
    expect(recommendPrograms("B2", 22, "akademik")).toEqual(["scoreready", "academicwrite"]);
    expect(recommendPrograms("A2", 30, "karier")).toEqual(["english-for-career"]);
    expect(recommendPrograms("B1", 30, "karier")).toEqual(["english-for-career", "speakstage"]);
    expect(recommendPrograms("B1", 30, "presentasi")).toEqual(["speakstage"]);
  });

  it("semua rekomendasi adalah slug program yang ada di katalog", async () => {
    const { SEED_PROGRAMS } = await import("@/data/catalog");
    const slugs = new Set(SEED_PROGRAMS.map((p) => p.slug));
    const levels = ["Pre-A1", "A1", "A2", "B1", "B2"] as const;
    const goals = ["percakapan", "akademik", "beasiswa", "karier", "layanan", "presentasi", "sekolah"];
    for (const age of [8, 15, 30, null]) for (const l of levels) for (const g of goals) for (const s of recommendPrograms(l, age, g)) expect(slugs.has(s)).toBe(true);
  });
});
