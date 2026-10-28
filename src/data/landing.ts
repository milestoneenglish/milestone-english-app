// Teks landing page yang bisa diubah Owner dari menu CMS Website.
// Nilai di sini adalah isi awal; yang tersimpan di site_settings (key "landing") menimpanya per bagian.

export type TextItem = { title: string; text: string };
export type StatItem = { value: string; label: string };

export type LandingCopy = {
  benefits: TextItem[];
  about: {
    kicker: string;
    title_start: string;
    title_accent: string;
    desc: string;
    photo_kicker: string;
    photo_title: string;
    photo_text: string;
    steps: string[];
  };
  stats: StatItem[];
  programs: { kicker: string; title_start: string; desc: string };
  why: {
    kicker: string;
    title_start: string;
    title_accent: string;
    desc: string;
    items: TextItem[];
    card_kicker: string;
    card_title: string;
    chips: string[];
  };
  partners: { title: string };
  tutors: { kicker: string; title_start: string; title_accent: string; desc: string };
  testimonials: { kicker: string; title_start: string; title_accent: string };
  gallery: { kicker: string; title_start: string; title_accent: string; desc: string };
  faq: { kicker: string; title_start: string; title_accent: string; desc: string };
  footer: { about: string; start_title: string; start_text: string };
};

export const DEFAULT_LANDING: LandingCopy = {
  benefits: [
    { title: "Outcome-Based", text: "Target belajar jelas sejak placement, diukur dengan rubrik dan bukti progres." },
    { title: "Small Batch", text: "Kelas 4–6 peserta agar waktu berbicara, koreksi, dan perhatian tutor tetap personal." },
    { title: "Progress Report", text: "Baseline, tugas akhir, dan review tutor tersimpan sebagai laporan perkembangan." },
    { title: "Real Practice", text: "Simulasi percakapan, presentasi, interview, layanan, atau tugas akademik." },
  ],
  about: {
    kicker: "About Us",
    title_start: "Our English System",
    title_accent: "Helps You Improve",
    desc: "Milestone tidak menjual kelas yang abstrak. Setiap program punya target outcome, bukti tugas akhir, dan jalur belajar yang bisa dipantau dari awal sampai akhir.",
    photo_kicker: "Milestone Method",
    photo_title: "Belajar dengan jalur yang jelas.",
    photo_text: "Satu alur dari placement, latihan, feedback, sampai bukti progres.",
    steps: ["Daftar & placement", "Pilih kelas & bayar", "Onboarding", "Belajar tiap minggu", "Assessment akhir", "Laporan & lanjut"],
  },
  stats: [
    { value: "12", label: "Program pilihan" },
    { value: "4–6", label: "Peserta per batch" },
    { value: "5", label: "Keterampilan diukur" },
    { value: "1×24 jam", label: "Hasil placement lengkap" },
  ],
  programs: {
    kicker: "Our Courses",
    title_start: "Pilihan Lengkap",
    desc: "Setiap program memiliki durasi, level masuk, kapasitas 4–6 peserta, dan target outcome yang terukur.",
  },
  why: {
    kicker: "Why Choose Us",
    title_start: "We Are Built For",
    title_accent: "Your Goal",
    desc: "Struktur belajar dibuat terarah, terukur, dan nyaman dipakai dari kelas pertama sampai evaluasi akhir.",
    items: [
      { title: "Expert Tutors", text: "Feedback spesifik untuk speaking, writing, dan interview." },
      { title: "Course Material", text: "Silabus jelas dan tugas akhir sesuai kebutuhan program." },
      { title: "Real Simulation", text: "Role-play, interview, presentasi, dan latihan diskusi." },
      { title: "Clear Report", text: "Data progres bisa dibaca tanpa menebak-nebak." },
    ],
    card_kicker: "Milestone Flow",
    card_title: "Clear path, clear progress.",
    chips: ["Placement", "Practice", "Feedback", "Report"],
  },
  partners: { title: "Telah dipercaya oleh" },
  tutors: {
    kicker: "Our Tutors",
    title_start: "Belajar Bersama",
    title_accent: "Tutor Kami",
    desc: "Tutor berpengalaman yang memberi feedback spesifik di setiap sesi dan memantau progres dengan rubrik yang sama.",
  },
  testimonials: { kicker: "Testimonials", title_start: "Cerita Dari", title_accent: "Peserta Kami" },
  gallery: { kicker: "Gallery", title_start: "Suasana", title_accent: "Belajar", desc: "Potret kelas, latihan, dan kegiatan peserta Milestone English." },
  faq: { kicker: "FAQ", title_start: "Pertanyaan", title_accent: "Populer", desc: "Jawaban ringkas sebelum kamu mendaftar atau mencoba placement test." },
  footer: {
    about: "Milestone English membantu peserta memilih program yang tepat, belajar dalam batch kecil 4–6 peserta, dan melihat progres dengan rubrik yang jelas.",
    start_title: "Mulai dari sini",
    start_text: "Belum tahu level kemampuanmu? Coba placement test gratis.",
  },
};

// Gambar latar tiga bagian landing page. Kosong berarti memakai gambar bawaan.
export type LandingImages = { hero: string; about: string; why: string };
export const DEFAULT_IMAGES: LandingImages = { hero: "", about: "", why: "" };

// Menggabungkan isi tersimpan dengan nilai awal, sehingga bagian yang belum pernah diubah tetap terisi
// dan jumlah butir daftar (keunggulan, angka, langkah) selalu sama dengan tata letak.
export function mergeLanding(saved: unknown): LandingCopy {
  const s = (saved && typeof saved === "object" ? saved : {}) as Partial<Record<keyof LandingCopy, unknown>>;
  const obj = <T extends object>(d: T, v: unknown): T => {
    const out = { ...d } as Record<string, unknown>;
    const src = (v && typeof v === "object" ? v : {}) as Record<string, unknown>;
    for (const [k, def] of Object.entries(d)) {
      const val = src[k];
      if (Array.isArray(def)) out[k] = list(def, val);
      else if (typeof def === "string") out[k] = typeof val === "string" ? val : def;
    }
    return out as T;
  };
  const list = (d: unknown[], v: unknown) =>
    d.map((def, i) => {
      const val = Array.isArray(v) ? v[i] : undefined;
      if (typeof def === "string") return typeof val === "string" ? val : def;
      return obj(def as object, val);
    });
  return {
    benefits: list(DEFAULT_LANDING.benefits, s.benefits) as TextItem[],
    about: obj(DEFAULT_LANDING.about, s.about),
    stats: list(DEFAULT_LANDING.stats, s.stats) as StatItem[],
    programs: obj(DEFAULT_LANDING.programs, s.programs),
    why: obj(DEFAULT_LANDING.why, s.why),
    partners: obj(DEFAULT_LANDING.partners, s.partners),
    tutors: obj(DEFAULT_LANDING.tutors, s.tutors),
    testimonials: obj(DEFAULT_LANDING.testimonials, s.testimonials),
    gallery: obj(DEFAULT_LANDING.gallery, s.gallery),
    faq: obj(DEFAULT_LANDING.faq, s.faq),
    footer: obj(DEFAULT_LANDING.footer, s.footer),
  };
}

// ---------------------------------------------------------------------------
// Versi English
// ---------------------------------------------------------------------------

// Terjemahan bawaan. Dipakai selama teks Indonesia di bagian yang sama belum diubah;
// begitu Owner mengubah teks Indonesia tanpa mengisi English, website English memakai teks Indonesia.
export const DEFAULT_LANDING_EN: LandingCopy = {
  benefits: [
    { title: "Outcome-Based", text: "Clear learning targets from placement, measured with rubrics and evidence of progress." },
    { title: "Small Batch", text: "Classes of 4–6 learners so speaking time, correction, and tutor attention stay personal." },
    { title: "Progress Report", text: "Baseline, final task, and tutor review are kept as a progress report." },
    { title: "Real Practice", text: "Simulated conversations, presentations, interviews, customer service, or academic tasks." },
  ],
  about: {
    kicker: "About Us",
    title_start: "Our English System",
    title_accent: "Helps You Improve",
    desc: "Milestone does not sell vague classes. Every program has a target outcome, a final task as evidence, and a learning path you can follow from start to finish.",
    photo_kicker: "Milestone Method",
    photo_title: "Learn with a clear path.",
    photo_text: "One flow from placement, practice, and feedback to evidence of progress.",
    steps: ["Sign up & placement", "Choose a class & pay", "Onboarding", "Weekly learning", "Final assessment", "Report & next step"],
  },
  stats: [
    { value: "12", label: "Programs to choose from" },
    { value: "4–6", label: "Learners per batch" },
    { value: "5", label: "Skills measured" },
    { value: "1×24 hrs", label: "Full placement result" },
  ],
  programs: {
    kicker: "Our Courses",
    title_start: "A Complete Choice of",
    desc: "Every program has a set duration, entry level, a capacity of 4–6 learners, and a measurable target outcome.",
  },
  why: {
    kicker: "Why Choose Us",
    title_start: "We Are Built For",
    title_accent: "Your Goal",
    desc: "A focused, measurable learning structure that feels comfortable from the first class to the final evaluation.",
    items: [
      { title: "Expert Tutors", text: "Specific feedback on speaking, writing, and interviews." },
      { title: "Course Material", text: "A clear syllabus and final tasks that fit each program." },
      { title: "Real Simulation", text: "Role-plays, interviews, presentations, and discussion practice." },
      { title: "Clear Report", text: "Progress data you can read without guessing." },
    ],
    card_kicker: "Milestone Flow",
    card_title: "Clear path, clear progress.",
    chips: ["Placement", "Practice", "Feedback", "Report"],
  },
  partners: { title: "Trusted by" },
  tutors: {
    kicker: "Our Tutors",
    title_start: "Learn With",
    title_accent: "Our Tutors",
    desc: "Experienced tutors who give specific feedback every session and track progress with the same rubric.",
  },
  testimonials: { kicker: "Testimonials", title_start: "Stories From", title_accent: "Our Learners" },
  gallery: { kicker: "Gallery", title_start: "Life in", title_accent: "Class", desc: "Snapshots of classes, practice sessions, and activities at Milestone English." },
  faq: { kicker: "FAQ", title_start: "Frequently Asked", title_accent: "Questions", desc: "Quick answers before you sign up or try the placement test." },
  footer: {
    about: "Milestone English helps learners choose the right program, study in small batches of 4–6, and see their progress through clear rubrics.",
    start_title: "Start here",
    start_text: "Not sure about your level yet? Try the free placement test.",
  },
};

export const DEFAULT_HERO_EN = {
  badge: "Outcome-based English learning | 12 programs",
  title_start: "Start Your",
  title_accent: "English Milestone",
  title_end: "With Clear Outcomes",
  subtitle: "12 English programs for speaking, academic goals, kids, scholarships, and careers. All built on small classes, rubrics, and real evidence of progress.",
};

/**
 * Isian English untuk satu struktur teks (hero atau landing). Per kolom:
 * English tersimpan → dipakai; teks Indonesia masih bawaan → terjemahan bawaan; selain itu "" (memakai Indonesia).
 */
export function englishOverlay<T>(id: T, idDefault: T, enDefault: T, enSaved: unknown): T {
  if (typeof id === "string") {
    if (typeof enSaved === "string" && enSaved.trim()) return enSaved as T;
    return (id === idDefault && typeof enDefault === "string" ? enDefault : "") as T;
  }
  if (Array.isArray(id)) {
    return id.map((v, i) => englishOverlay(v, (idDefault as unknown[])?.[i], (enDefault as unknown[])?.[i], Array.isArray(enSaved) ? enSaved[i] : undefined)) as T;
  }
  if (id && typeof id === "object") {
    const src = (enSaved && typeof enSaved === "object" ? enSaved : {}) as Record<string, unknown>;
    return Object.fromEntries(
      Object.entries(id).map(([k, v]) => [k, englishOverlay(v, (idDefault as Record<string, unknown>)?.[k], (enDefault as Record<string, unknown>)?.[k], src[k])]),
    ) as T;
  }
  return id;
}

/** Teks yang tampil: kolom English yang kosong diganti versi Indonesia. */
export function withFallback<T>(en: T, id: T): T {
  if (typeof en === "string") return (en.trim() ? en : id) as T;
  if (Array.isArray(en)) return en.map((v, i) => withFallback(v, (id as unknown[])[i])) as T;
  if (en && typeof en === "object") return Object.fromEntries(Object.entries(en).map(([k, v]) => [k, withFallback(v, (id as Record<string, unknown>)[k])])) as T;
  return en;
}

// ---------------------------------------------------------------------------
// Bagian landing page yang bisa disembunyikan Owner (hero dan footer selalu tampil)
// ---------------------------------------------------------------------------

export const SECTIONS = {
  benefits: "4 keunggulan (di bawah hero)",
  partners: "Telah dipercaya oleh",
  methodology: "Metode (About Us)",
  stats: "Angka kunci",
  programs: "Program",
  tutors: "Tutor kami",
  why: "Kenapa Milestone",
  testimonials: "Testimoni",
  gallery: "Galeri",
  faq: "FAQ",
} as const;
export type SectionKey = keyof typeof SECTIONS;
export type SectionToggles = Record<SectionKey, boolean>;

export function mergeSections(saved: unknown): SectionToggles {
  const src = (saved && typeof saved === "object" ? saved : {}) as Record<string, unknown>;
  return Object.fromEntries((Object.keys(SECTIONS) as SectionKey[]).map((k) => [k, src[k] !== false])) as SectionToggles;
}
