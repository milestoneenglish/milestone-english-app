// Teks landing page yang bisa diubah Owner/Admin dari menu CMS Website.
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
  testimonials: { kicker: string; title_start: string; title_accent: string };
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
  testimonials: { kicker: "Testimonials", title_start: "Cerita Dari", title_accent: "Peserta Kami" },
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
    testimonials: obj(DEFAULT_LANDING.testimonials, s.testimonials),
    faq: obj(DEFAULT_LANDING.faq, s.faq),
    footer: obj(DEFAULT_LANDING.footer, s.footer),
  };
}
