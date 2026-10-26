// Istilah dan tipe bersama untuk rubrik, assessment, progres, dan laporan. Tanpa akses server
// supaya bisa dipakai komponen klien, halaman portal, dan pembuat PDF.

export const ASSESSMENT_KINDS = ["baseline", "mid", "final"] as const;
export type AssessmentKind = (typeof ASSESSMENT_KINDS)[number];

export const ASSESSMENT_LABEL: Record<AssessmentKind, string> = { baseline: "Awal (baseline)", mid: "Tengah", final: "Akhir" };
export const ASSESSMENT_SHORT: Record<AssessmentKind, string> = { baseline: "Awal", mid: "Tengah", final: "Akhir" };

export const SKILLS = ["speaking", "listening", "reading", "writing", "grammar"] as const;
export type Skill = (typeof SKILLS)[number];
export const SKILL_LABEL: Record<Skill, string> = { speaking: "Speaking", listening: "Listening", reading: "Reading", writing: "Writing", grammar: "Grammar" };

// Level laporan memakai skala placement ditambah C1 untuk program lanjutan.
export const REPORT_LEVELS = ["Pre-A1", "A1", "A2", "B1", "B2", "C1"] as const;
export type ReportLevel = (typeof REPORT_LEVELS)[number];
export type SkillLevels = Partial<Record<Skill, ReportLevel>>;

// Level keseluruhan: rata-rata urutan level, dibulatkan ke bawah (sama dengan aturan placement).
export function overallReportLevel(levels: SkillLevels | null | undefined): ReportLevel | null {
  const values = Object.values(levels ?? {}).filter((l): l is ReportLevel => REPORT_LEVELS.includes(l as ReportLevel));
  if (!values.length) return null;
  const avg = values.reduce((sum, l) => sum + REPORT_LEVELS.indexOf(l), 0) / values.length;
  return REPORT_LEVELS[Math.floor(avg)];
}

export const SCORE_LABEL: Record<number, string> = { 1: "Belum tampak", 2: "Berkembang", 3: "Cukup baik", 4: "Baik" };

export type Indicator = { id: string; curriculum_id: string; seq: number; skill: Skill; label: string; descriptors: string[] };

export type ReportStatus = "draft" | "submitted" | "returned" | "published";
export const REPORT_STATUS_LABEL: Record<ReportStatus | "none" | "waiting", string> = {
  waiting: "Menunggu assessment akhir",
  none: "Belum disusun",
  draft: "Draf",
  submitted: "Menunggu review Lead",
  returned: "Dikembalikan untuk revisi",
  published: "Terbit",
};

// Ringkasan yang dibekukan saat laporan terbit; dipakai halaman laporan dan PDF.
export type ReportSummary = {
  student: string;
  program: string;
  programCode: string;
  outcome: string;
  batch: string;
  tutor: string;
  period: { start: string | null; end: string | null };
  kinds: AssessmentKind[];
  indicators: { id: string; skill: Skill; label: string; scores: Partial<Record<AssessmentKind, number>> }[];
  notes: Partial<Record<AssessmentKind, string>>;
  attendance: { sessions: number; present: number; late: number; excused: number; absent: number };
  tasks: { total: number; done: number; submitted: number; late: number };
};

export type ReportDocument = {
  summary: ReportSummary;
  strengths: string;
  improvements: string;
  levels: SkillLevels;
  recommendations: { name: string; reason?: string }[];
  reviewer: string;
  publishedAt: string;
  reportId: string;
};

// Rata-rata skor satu titik assessment, atau null bila belum dinilai.
export function averageScore(indicators: ReportSummary["indicators"], kind: AssessmentKind): number | null {
  const values = indicators.map((i) => i.scores[kind]).filter((v): v is number => typeof v === "number");
  return values.length ? values.reduce((a, b) => a + b, 0) / values.length : null;
}

export function attendanceRate(a: ReportSummary["attendance"]) {
  return a.sessions ? Math.round(((a.present + a.late) / a.sessions) * 100) : null;
}
