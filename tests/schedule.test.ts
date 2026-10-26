import { describe, expect, it } from "vitest";
import { generateSessions, parseDurationLabel, scheduleLabel } from "@/lib/schedule";

describe("jadwal batch", () => {
  it("membaca jumlah dan durasi sesi dari label program", () => {
    expect(parseDurationLabel("4 minggu (8 × 60 mnt)")).toEqual({ sessions: 8, minutes: 60 });
    expect(parseDurationLabel("Membership bulanan (4 × 60 mnt)")).toEqual({ sessions: 4, minutes: 60 });
    expect(parseDurationLabel("Fleksibel")).toBeNull();
  });

  it("membuat sesi di hari yang dipilih dalam WIB, mulai dari tanggal mulai", () => {
    // 3 November 2026 adalah Selasa.
    const s = generateSessions({ startDate: "2026-11-03", weekdays: [2, 4], time: "19:00", count: 4 });
    expect(s.map((x) => x.date)).toEqual(["2026-11-03", "2026-11-05", "2026-11-10", "2026-11-12"]);
    expect(s[0].starts_at).toBe("2026-11-03T12:00:00.000Z");
    expect(s.map((x) => x.seq)).toEqual([1, 2, 3, 4]);
  });

  it("melewati tanggal mulai bila harinya tidak cocok, dan menolak input tidak valid", () => {
    expect(generateSessions({ startDate: "2026-11-03", weekdays: [6], time: "09:30", count: 1 })[0].date).toBe("2026-11-07");
    expect(generateSessions({ startDate: "2026-11-03", weekdays: [], time: "19:00", count: 4 })).toEqual([]);
    expect(generateSessions({ startDate: "2026-11-03", weekdays: [1], time: "25:00", count: 4 })).toEqual([]);
  });

  it("label jadwal mudah dibaca", () => {
    expect(scheduleLabel([2, 4], "19:00", 60)).toBe("Selasa & Kamis · 19.00–20.00 WIB");
    expect(scheduleLabel([1, 3, 5], "16:30", 90)).toBe("Senin, Rabu & Jumat · 16.30–18.00 WIB");
  });
});
