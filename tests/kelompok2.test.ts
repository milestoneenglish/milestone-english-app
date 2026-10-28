// Kelompok 2 perbaikan: kalender jadwal (WIB), pilihan role staf, rata-rata grafik wali, dan syarat PDF placement.
import { describe, expect, it } from "vitest";
import { calendarMonth, monthGrid, shiftMonth, wibDate } from "../src/components/portal/calendar";
import { placementPdfReady } from "../src/components/portal/views/placement-pdf-link";
import { skillAverages, type ReportSummary } from "../src/lib/academic";
import { primaryRole, rolesFrom } from "../src/lib/ops";

describe("kalender jadwal", () => {
  it("memakai tanggal WIB, bukan UTC", () => {
    expect(wibDate("2026-10-31T18:30:00Z")).toBe("2026-11-01");
    expect(wibDate("2026-10-31T16:59:00Z")).toBe("2026-10-31");
  });

  it("menggeser bulan melewati pergantian tahun", () => {
    expect(shiftMonth("2026-12", 1)).toBe("2027-01");
    expect(shiftMonth("2026-01", -1)).toBe("2025-12");
  });

  it("menyusun kotak bulan mulai Senin, kelipatan 7", () => {
    const grid = monthGrid("2026-10"); // 1 Oktober 2026 hari Kamis
    expect(grid.slice(0, 4)).toEqual([null, null, null, "2026-10-01"]);
    expect(grid.length % 7).toBe(0);
    expect(grid.filter(Boolean)).toHaveLength(31);
  });

  it("membuka bulan sesi berikutnya, lalu sesi terakhir, bila URL tidak menyebut bulan", () => {
    const now = Date.parse("2026-10-27T05:00:00Z");
    const events = [{ at: "2026-09-10T12:00:00Z" }, { at: "2026-11-03T12:00:00Z" }];
    expect(calendarMonth(undefined, events, now)).toBe("2026-11");
    expect(calendarMonth(undefined, [{ at: "2026-09-10T12:00:00Z" }], now)).toBe("2026-09");
    expect(calendarMonth(undefined, [], now)).toBe("2026-10");
    expect(calendarMonth("2026-08", events, now)).toBe("2026-08");
    expect(calendarMonth("2026-13", events, now)).toBe("2026-11");
  });
});

describe("role staf", () => {
  it("role utama mengikuti urutan Owner, Admin, Lead, Tutor", () => {
    expect(primaryRole(["tutor", "lead"])).toBe("lead");
    expect(primaryRole([])).toBe("");
  });

  it("centang mengajar menambah role tutor, kecuali role utamanya tutor", () => {
    expect(rolesFrom("lead", true)).toEqual(["lead", "tutor"]);
    expect(rolesFrom("lead", false)).toEqual(["lead"]);
    expect(rolesFrom("tutor", true)).toEqual(["tutor"]);
    expect(rolesFrom("", true)).toEqual([]);
  });
});

describe("grafik perkembangan wali", () => {
  it("merata-rata skor per keterampilan di tiap titik assessment", () => {
    const summary = {
      kinds: ["baseline", "mid", "final"],
      indicators: [
        { id: "1", skill: "speaking", label: "a", scores: { baseline: 1, mid: 3 } },
        { id: "2", skill: "speaking", label: "b", scores: { baseline: 2, mid: 4 } },
        { id: "3", skill: "writing", label: "c", scores: { baseline: 3 } },
      ],
    } as unknown as ReportSummary;
    const { kinds, rows } = skillAverages(summary);
    expect(kinds).toEqual(["baseline", "mid"]);
    expect(rows.map((r) => r.skill)).toEqual(["speaking", "writing"]);
    expect(rows[0].values).toEqual({ baseline: 1.5, mid: 3.5 });
    expect(rows[1].values).toEqual({ baseline: 3, mid: null });
  });
});

describe("PDF placement", () => {
  it("tersedia setelah hasil terbit dan ada kelas aktif atau selesai", () => {
    expect(placementPdfReady({ status: "published" }, [{ status: "active" }])).toBe(true);
    expect(placementPdfReady({ status: "published" }, [{ status: "completed" }])).toBe(true);
    expect(placementPdfReady({ status: "published" }, [{ status: "pending_payment" }])).toBe(false);
    expect(placementPdfReady({ status: "reviewed" }, [{ status: "active" }])).toBe(false);
  });
});
