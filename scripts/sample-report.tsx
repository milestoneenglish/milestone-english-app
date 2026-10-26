// Membuat contoh PDF laporan dengan data contoh untuk ditinjau tampilannya.
// Jalankan: npm run report:sample   (hasil di folder e2e-output/)
import { mkdirSync, writeFileSync } from "node:fs";
import type { ReportDocument } from "../src/lib/academic";
import { renderReportPdf } from "../src/lib/report-pdf";
import { SEED_RUBRICS } from "../src/data/rubrics";

const indicators = (code: string, rows: [number, number | null, number][]) =>
  SEED_RUBRICS[code].map((ind, i) => ({
    id: `${code}-${i}`,
    skill: ind.skill,
    label: ind.label,
    scores: { baseline: rows[i][0], ...(rows[i][1] === null ? {} : { mid: rows[i][1]! }), final: rows[i][2] },
  }));

const speakup: ReportDocument = {
  reportId: "a3f9c2d1-0000-0000-0000-000000000000",
  publishedAt: "2026-11-28T09:00:00+07:00",
  reviewer: "Dewi Kartika",
  summary: {
    student: "Rina Maharani",
    program: "SpeakUp",
    programCode: "SU",
    outcome: "Mempertahankan percakapan 5 menit, bertanya balik, dan meminta klarifikasi.",
    batch: "SU-2611-A",
    tutor: "Andi Pratama",
    period: { start: "2026-11-02T19:00:00+07:00", end: "2026-11-25T19:00:00+07:00" },
    kinds: ["baseline", "mid", "final"],
    indicators: indicators("SU", [
      [2, 2, 3],
      [1, 2, 3],
      [2, 3, 3],
      [2, 2, 3],
      [2, 2, 2],
    ]),
    notes: {},
    attendance: { sessions: 8, present: 7, late: 1, excused: 0, absent: 0 },
    tasks: { total: 8, done: 7, submitted: 8, late: 1 },
  },
  strengths:
    "Rina sekarang bisa menjaga percakapan sekitar 5 menit tanpa berhenti lama. Ia rutin bertanya balik (What about you? How long have you...?) sehingga percakapan terasa dua arah, dan berani meminta klarifikasi saat tidak menangkap maksud lawan bicara.",
  improvements:
    "Ketepatan tata bahasa masih perlu dilatih, terutama bentuk lampau (went, had, was) saat bercerita tentang pengalaman. Disarankan berlatih menceritakan kegiatan akhir pekan 2–3 menit setiap hari sambil merekam diri sendiri, lalu memeriksa kata kerja yang dipakai.",
  levels: { speaking: "B1", listening: "A2", grammar: "A2" },
  recommendations: [
    { name: "English Circle", reason: "Latihan percakapan rutin bulanan untuk menjaga kelancaran." },
    { name: "SpeakStage", reason: "Bila ingin naik ke presentasi dan public speaking." },
  ],
};

const academicwrite: ReportDocument = {
  reportId: "7b21e8f0-0000-0000-0000-000000000000",
  publishedAt: "2026-12-10T09:00:00+07:00",
  reviewer: "Dewi Kartika",
  summary: {
    student: "Bagas Wicaksono",
    program: "AcademicWrite",
    programCode: "AW",
    outcome: "Menulis teks akademik 500–700 kata dengan sitasi, parafrasa, dan struktur yang valid.",
    batch: "AW-2611-A",
    tutor: "Sari Lestari",
    period: { start: "2026-10-27T19:30:00+07:00", end: "2026-12-05T19:30:00+07:00" },
    kinds: ["baseline", "mid", "final"],
    indicators: indicators("AW", [
      [2, 3, 4],
      [2, 2, 3],
      [1, 2, 3],
      [2, 3, 3],
      [3, 3, 3],
    ]),
    notes: {},
    attendance: { sessions: 8, present: 6, late: 1, excused: 1, absent: 0 },
    tasks: { total: 8, done: 8, submitted: 8, late: 0 },
  },
  strengths:
    "Struktur esai Bagas berkembang paling pesat: tesis kini jelas di pendahuluan dan setiap paragraf dibuka dengan kalimat topik. Esai final 640 kata memenuhi target program dengan alur antarparagraf yang runtut.",
  improvements:
    "Parafrasa masih kadang terlalu dekat dengan teks sumber, dan beberapa klaim perlu bukti yang lebih spesifik. Latih teknik parafrasa tiga langkah (pahami, tutup sumber, tulis ulang) dan tambahkan data atau contoh konkret untuk setiap klaim utama.",
  levels: { writing: "B2", grammar: "B1" },
  recommendations: [{ name: "ScoreReady", reason: "Persiapan TOEFL/IELTS dengan bekal writing yang sudah kuat." }],
};

async function main() {
  mkdirSync("e2e-output", { recursive: true });
  for (const [name, doc] of [
    ["contoh-laporan-speakup.pdf", speakup],
    ["contoh-laporan-academicwrite.pdf", academicwrite],
  ] as const) {
    writeFileSync(`e2e-output/${name}`, await renderReportPdf(doc));
    console.log(`e2e-output/${name}`);
  }
}

void main();
