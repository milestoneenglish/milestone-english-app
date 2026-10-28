// Data awal katalog dan konten landing page.
// Dipakai untuk membuat supabase/seed.sql (npm run seed:generate) dan sebagai
// pratinjau lokal saat aplikasi belum tersambung ke Supabase.

export type ProgramCategory = "Everyday English" | "Academic English" | "Young Learners" | "Professional English";

export const PROGRAM_CATEGORIES: ProgramCategory[] = [
  "Everyday English",
  "Academic English",
  "Young Learners",
  "Professional English",
];

export type Program = {
  code: string;
  slug: string;
  name: string;
  category: ProgramCategory;
  entry_level: string;
  duration_label: string;
  capacity: number;
  price_idr: number;
  outcome: string;
  evidence: string;
  featured: boolean;
  sort_order: number;
};

export const SEED_PROGRAMS: Program[] = [
  { code: "EZ", slug: "english-zero", name: "English Zero", category: "Everyday English", entry_level: "Pre-A1–A1", duration_label: "4 minggu (8 × 60 mnt)", capacity: 6, price_idr: 349000, outcome: "Memperkenalkan diri dan bercakap dasar dengan bantuan terbatas.", evidence: "Rekaman perkenalan 1–2 menit dan dialog singkat.", featured: true, sort_order: 1 },
  { code: "SU", slug: "speakup", name: "SpeakUp", category: "Everyday English", entry_level: "A1–B1", duration_label: "4 minggu (8 × 60 mnt)", capacity: 6, price_idr: 349000, outcome: "Mempertahankan percakapan 5 menit, bertanya balik, dan meminta klarifikasi.", evidence: "Rekaman percakapan awal dan akhir.", featured: true, sort_order: 2 },
  { code: "EC", slug: "english-circle", name: "English Circle", category: "Everyday English", entry_level: "A2+", duration_label: "Membership bulanan (4 × 60 mnt)", capacity: 6, price_idr: 199000, outcome: "Menyelesaikan target praktik bulanan dan memperbaiki keterampilan fokus.", evidence: "Log praktik bulanan, sampel rekaman, dan review tutor.", featured: false, sort_order: 3 },
  { code: "SR", slug: "scoreready", name: "ScoreReady", category: "Academic English", entry_level: "Assessment diagnostik", duration_label: "8 minggu (16 × 90 mnt)", capacity: 6, price_idr: 1099000, outcome: "Memperbaiki performa per bagian tes TOEFL/IELTS berbasis diagnostik awal.", evidence: "Simulasi diagnostik awal dibanding simulasi akhir dengan format sebanding.", featured: true, sort_order: 4 },
  { code: "AW", slug: "academicwrite", name: "AcademicWrite", category: "Academic English", entry_level: "B1–B2", duration_label: "6 minggu (8 × 90 mnt)", capacity: 6, price_idr: 699000, outcome: "Menulis teks akademik 500–700 kata dengan sitasi, parafrasa, dan struktur yang valid.", evidence: "Draf awal, catatan revisi, dan naskah esai final.", featured: false, sort_order: 5 },
  { code: "SS", slug: "scholarspeak", name: "ScholarSpeak", category: "Academic English", entry_level: "B1–B2", duration_label: "4 minggu (8 × 60 mnt)", capacity: 6, price_idr: 499000, outcome: "Menjelaskan motivasi, rencana studi, dan kontribusi dalam simulasi wawancara beasiswa.", evidence: "Rekaman mock interview dan kerangka jawaban terstruktur.", featured: true, sort_order: 6 },
  { code: "LL", slug: "litlab", name: "LitLab", category: "Young Learners", entry_level: "A2–B2 (usia 13–18)", duration_label: "4 minggu (4 × 90 mnt)", capacity: 6, price_idr: 299000, outcome: "Memahami teks sastra/film, mendiskusikan tema, dan menyusun ulasan 200–300 kata.", evidence: "Diskusi terekam dan ulasan tertulis terstruktur.", featured: false, sort_order: 7 },
  { code: "LIL", slug: "littlelingo", name: "LittleLingo", category: "Young Learners", entry_level: "Pemula–A1 (usia 6–12)", duration_label: "4 minggu (8 × 45 mnt)", capacity: 4, price_idr: 499000, outcome: "Memperkenalkan diri, mengenali kosakata tematik, dan mengikuti instruksi tutor.", evidence: "Portofolio aktivitas dan video demonstrasi lisan anak.", featured: true, sort_order: 8 },
  { code: "TT", slug: "teentalk", name: "TeenTalk", category: "Young Learners", entry_level: "A1–B1 (usia 13–17)", duration_label: "4 minggu (8 × 60 mnt)", capacity: 6, price_idr: 349000, outcome: "Menyampaikan presentasi 3 menit dan merespons pertanyaan sederhana dengan percaya diri.", evidence: "Rekaman presentasi mandiri dan sesi tanya jawab.", featured: false, sort_order: 9 },
  { code: "EFC", slug: "english-for-career", name: "English for Career", category: "Professional English", entry_level: "A2–B1 (usia 18+)", duration_label: "4 minggu (8 × 60 mnt)", capacity: 6, price_idr: 499000, outcome: "Menjalani simulasi wawancara kerja 10–15 menit untuk posisi sasaran.", evidence: "Rekaman mock interview profesional dan evaluasi tutor.", featured: true, sort_order: 10 },
  { code: "SE", slug: "serviceenglish", name: "ServiceEnglish", category: "Professional English", entry_level: "A2–B1", duration_label: "4 minggu (8 × 60 mnt)", capacity: 6, price_idr: 499000, outcome: "Menyelesaikan 4 skenario layanan pelanggan: hospitality, F&B, dan penanganan keluhan.", evidence: "Rekaman role-play skenario dan checklist standar layanan.", featured: false, sort_order: 11 },
  { code: "SST", slug: "speakstage", name: "SpeakStage", category: "Professional English", entry_level: "B1–B2", duration_label: "4 minggu (8 × 60 mnt)", capacity: 6, price_idr: 499000, outcome: "Menyampaikan presentasi bisnis 5 menit dan menjawab 2 pertanyaan kritis.", evidence: "Video presentasi profesional dan rekaman tanya jawab.", featured: false, sort_order: 12 },
];

export type Faq = { question: string; answer: string; sort_order: number };

export const SEED_FAQS: Faq[] = [
  {
    question: "Apa yang membedakan Milestone English dengan kursus bahasa Inggris biasa?",
    answer:
      "Setiap program punya target outcome yang jelas. Kemampuan awal diukur lewat placement test dan rekaman baseline, lalu di akhir program kamu menerima laporan yang membandingkan hasil awal dan akhir dengan rubrik yang sama.",
    sort_order: 1,
  },
  {
    question: "Apakah ada placement test sebelum masuk kelas?",
    answer:
      "Ya, placement test wajib untuk setiap siswa baru dan bisa dicoba gratis dari halaman ini. Tes berlangsung sekitar 25–30 menit dan mengukur grammar, reading, listening, writing, dan speaking. Hasil writing dan speaking dinilai tutor paling lambat 1×24 jam.",
    sort_order: 2,
  },
  {
    question: "Bagaimana cara pembayarannya?",
    answer:
      "Setelah memilih jadwal kelas, tagihan muncul otomatis di portal. Lakukan transfer, unggah bukti pembayaran, dan kelas aktif setelah tim admin memverifikasinya. Kamu mendapat pemberitahuan lewat email dan WhatsApp.",
    sort_order: 3,
  },
  {
    question: "Berapa jumlah peserta dalam satu kelas?",
    answer:
      "Kapasitas kelas dibatasi 4 sampai 6 peserta per batch, supaya setiap peserta mendapat waktu berbicara dan feedback yang cukup dari tutor.",
    sort_order: 4,
  },
];

// Pengaturan landing page. Kontak sengaja kosong sampai diisi Owner;
// tombol WhatsApp dan email disembunyikan selama kosong.
export const SEED_SETTINGS: Record<string, unknown> = {
  contact: { whatsapp: "", email: "", address: "" },
  hero: {
    badge: "Outcome-based English learning | 12 pilihan program",
    title_start: "Start Your",
    title_accent: "English Milestone",
    title_end: "With Clear Outcomes",
    subtitle:
      "12 program bahasa Inggris untuk speaking, academic goals, kids, scholarship, dan career. Semua dibangun dengan kelas kecil, rubrik, dan bukti progres nyata.",
  },
};

// Terjemahan bawaan untuk website English. Dipakai selama teks Indonesia program/FAQ masih sama dengan isi awal
// dan kolom English di CMS masih kosong.
export const SEED_PROGRAMS_EN: Record<string, { outcome: string; evidence: string }> = {
  "english-zero": { outcome: "Introduce yourself and hold basic conversations with limited support.", evidence: "A 1–2 minute self-introduction recording and a short dialogue." },
  speakup: { outcome: "Sustain a 5-minute conversation, ask follow-up questions, and ask for clarification.", evidence: "Recordings of the first and final conversations." },
  "english-circle": { outcome: "Complete monthly practice targets and improve your focus skills.", evidence: "Monthly practice log, sample recordings, and tutor review." },
  scoreready: { outcome: "Improve performance in each TOEFL/IELTS section based on an initial diagnostic.", evidence: "Initial diagnostic simulation compared with a final simulation in a comparable format." },
  academicwrite: { outcome: "Write 500–700-word academic texts with valid citation, paraphrasing, and structure.", evidence: "First draft, revision notes, and the final essay." },
  scholarspeak: { outcome: "Explain your motivation, study plan, and contribution in a mock scholarship interview.", evidence: "Mock interview recording and a structured answer outline." },
  litlab: { outcome: "Understand literary texts and films, discuss themes, and write a 200–300-word review.", evidence: "Recorded discussion and a structured written review." },
  littlelingo: { outcome: "Introduce themselves, recognize themed vocabulary, and follow the tutor's instructions.", evidence: "Activity portfolio and a video of the child speaking." },
  teentalk: { outcome: "Give a 3-minute presentation and answer simple questions with confidence.", evidence: "Recording of an independent presentation and Q&A session." },
  "english-for-career": { outcome: "Complete a 10–15-minute mock job interview for a target position.", evidence: "Professional mock interview recording and tutor evaluation." },
  serviceenglish: { outcome: "Handle 4 customer service scenarios: hospitality, F&B, and complaint handling.", evidence: "Role-play recordings and a service standard checklist." },
  speakstage: { outcome: "Deliver a 5-minute business presentation and answer 2 critical questions.", evidence: "Professional presentation video and Q&A recording." },
};

export const SEED_FAQS_EN: { question: string; answer: string }[] = [
  {
    question: "What makes Milestone English different from a regular English course?",
    answer:
      "Every program has a clear target outcome. Your starting ability is measured through a placement test and a baseline recording, and at the end of the program you receive a report that compares your first and final results using the same rubric.",
  },
  {
    question: "Is there a placement test before joining a class?",
    answer:
      "Yes. The placement test is required for every new learner and you can try it for free from this page. It takes about 25–30 minutes and measures grammar, reading, listening, writing, and speaking. Writing and speaking are scored by a tutor within 24 hours.",
  },
  {
    question: "How do I pay?",
    answer:
      "After you choose a class schedule, an invoice appears automatically in the portal. Make a bank transfer, upload the proof of payment, and the class becomes active once our admin team verifies it. You will be notified by email and WhatsApp.",
  },
  {
    question: "How many learners are in one class?",
    answer: "Each batch is limited to 4–6 learners, so everyone gets enough speaking time and feedback from the tutor.",
  },
];
