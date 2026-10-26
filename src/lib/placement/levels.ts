// Aturan penilaian placement: level CEFR per keterampilan, level keseluruhan,
// dan rekomendasi program. Fungsi murni supaya mudah diuji dan ditinjau.

export const LEVELS = ["Pre-A1", "A1", "A2", "B1", "B2"] as const;
export type Level = (typeof LEVELS)[number];

export const AUTO_SECTIONS = ["grammar", "reading", "listening"] as const;
export const OPEN_SECTIONS = ["writing", "speaking"] as const;
export const SECTIONS = [...AUTO_SECTIONS, ...OPEN_SECTIONS] as const;
export type SectionName = (typeof SECTIONS)[number];

export const SECTION_LABEL: Record<SectionName, string> = {
  grammar: "Grammar",
  reading: "Reading",
  listening: "Listening",
  writing: "Writing",
  speaking: "Speaking",
};

// Pilihan ganda: persentase benar menjadi level.
export function levelFromPercent(percent: number): Level {
  if (percent < 20) return "Pre-A1";
  if (percent < 40) return "A1";
  if (percent < 60) return "A2";
  if (percent < 80) return "B1";
  return "B2";
}

// Rubrik tutor: rata-rata skor 1–4 menjadi level.
export function levelFromRubric(average: number): Level {
  if (average < 1.5) return "Pre-A1";
  if (average < 2.0) return "A1";
  if (average < 2.75) return "A2";
  if (average < 3.5) return "B1";
  return "B2";
}

// Level keseluruhan: rata-rata urutan level, dibulatkan ke bawah (tidak melebih-lebihkan).
export function overallLevel(levels: Level[]): Level | null {
  if (levels.length === 0) return null;
  const avg = levels.reduce((sum, l) => sum + LEVELS.indexOf(l), 0) / levels.length;
  return LEVELS[Math.floor(avg)];
}

export const WRITING_CRITERIA = [
  { key: "task", label: "Isi sesuai tugas" },
  { key: "organization", label: "Susunan dan alur" },
  { key: "vocabulary", label: "Kosakata" },
  { key: "grammar", label: "Tata bahasa" },
] as const;

export const SPEAKING_CRITERIA = [
  { key: "fluency", label: "Kelancaran" },
  { key: "pronunciation", label: "Pengucapan" },
  { key: "vocabulary", label: "Kosakata dan tata bahasa" },
  { key: "content", label: "Isi jawaban" },
] as const;

export const RUBRIC_SCALE = [
  { value: 1, label: "1 · Belum tampak" },
  { value: 2, label: "2 · Berkembang" },
  { value: 3, label: "3 · Cukup baik" },
  { value: 4, label: "4 · Baik" },
] as const;

export type Rubric = Record<string, number>;

export function rubricAverage(rubric: Rubric | null | undefined): number | null {
  const values = Object.values(rubric ?? {}).filter((v) => Number.isInteger(v) && v >= 1 && v <= 4);
  if (values.length === 0) return null;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

export const LEARNING_GOALS = [
  { value: "percakapan", label: "Lancar bercakap sehari-hari" },
  { value: "akademik", label: "Tes TOEFL/IELTS atau tugas akademik" },
  { value: "beasiswa", label: "Persiapan wawancara beasiswa" },
  { value: "karier", label: "Karier dan wawancara kerja" },
  { value: "layanan", label: "Bahasa Inggris untuk layanan pelanggan" },
  { value: "presentasi", label: "Presentasi dan public speaking" },
  { value: "sekolah", label: "Mendukung pelajaran sekolah (anak/remaja)" },
] as const;

export type GoalValue = (typeof LEARNING_GOALS)[number]["value"];

export function goalLabel(value: string): string {
  return LEARNING_GOALS.find((g) => g.value === value)?.label ?? value;
}

const at = (level: Level, min: Level) => LEVELS.indexOf(level) >= LEVELS.indexOf(min);

// Rekomendasi program (slug) berdasarkan level, usia, dan tujuan. Lead bisa mengubahnya sebelum terbit.
export function recommendPrograms(level: Level, age: number | null, goal: string): string[] {
  if (age !== null && age <= 12) return ["littlelingo"];
  if (age !== null && age <= 17) {
    if (goal === "sekolah" && at(level, "A2")) return ["litlab", "teentalk"];
    return at(level, "A2") ? ["teentalk", "litlab"] : ["teentalk"];
  }

  const basic = at(level, "A1") ? "speakup" : "english-zero";
  switch (goal) {
    case "akademik":
      return at(level, "B1") ? ["scoreready", "academicwrite"] : at(level, "A2") ? ["scoreready", "speakup"] : [basic];
    case "beasiswa":
      return at(level, "B1") ? ["scholarspeak", "academicwrite"] : [basic, "english-circle"].filter((s) => s !== "english-circle" || at(level, "A2"));
    case "karier":
      return at(level, "A2") ? ["english-for-career", "speakstage"].filter((s) => s !== "speakstage" || at(level, "B1")) : [basic];
    case "layanan":
      return at(level, "A2") ? ["serviceenglish"] : [basic];
    case "presentasi":
      return at(level, "B1") ? ["speakstage"] : [basic];
    default:
      if (!at(level, "A1")) return ["english-zero"];
      return at(level, "A2") ? ["speakup", "english-circle"] : ["speakup"];
  }
}
