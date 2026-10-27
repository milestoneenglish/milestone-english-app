// Konstanta Fase 5 yang dipakai server dan form di browser.
import type { Role } from "@/lib/roles";

export const STAFF_ROLES = ["owner", "admin", "lead", "tutor"] as const satisfies readonly Role[];
export type StaffRole = (typeof STAFF_ROLES)[number];

export const PROGRAM_CATEGORIES = ["Everyday English", "Academic English", "Young Learners", "Professional English"] as const;
export const PROGRAM_STATUS = { draft: "Draf (belum tampil)", active: "Buka (tampil di website)", archived: "Tutup" } as const;

export const EXPENSE_CATEGORIES = ["tutor_fee", "marketing", "tools", "operational", "other"] as const;
export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number];
export const EXPENSE_LABEL: Record<ExpenseCategory, string> = {
  tutor_fee: "Honor tutor",
  marketing: "Iklan/marketing",
  tools: "Tools & langganan",
  operational: "Operasional",
  other: "Lainnya",
};

export const PERIODS = { bulan: "Bulan ini", "3bulan": "3 bulan terakhir", tahun: "Tahun ini" } as const;
export type PeriodKey = keyof typeof PERIODS;
export const isPeriod = (p: string | undefined): p is PeriodKey => Boolean(p && p in PERIODS);

export const TICKET_CATEGORIES = { payment: "Pembayaran", class: "Kelas", technical: "Teknis", other: "Lainnya" } as const;
export type TicketCategory = keyof typeof TICKET_CATEGORIES;
export type TicketStatus = "open" | "answered" | "closed";
export const TICKET_STATUS: Record<TicketStatus, string> = { open: "Menunggu balasan", answered: "Sudah dibalas", closed: "Ditutup" };
export const REOPEN_DAYS = 7;

export const OBSERVATION_ASPECTS = {
  preparation: "Persiapan & materi",
  engagement: "Keterlibatan siswa",
  clarity: "Kejelasan penjelasan",
  feedback: "Koreksi & feedback",
  time: "Manajemen waktu",
} as const;
export type ObservationAspect = keyof typeof OBSERVATION_ASPECTS;
export const OBSERVATION_SCALE: Record<number, string> = { 1: "Perlu perbaikan besar", 2: "Berkembang", 3: "Baik", 4: "Sangat baik" };

export const IMAGE_SLOTS = { hero: "Latar hero (paling atas)", about: "Foto bagian About Us", why: "Foto bagian Why Choose Us" } as const;
export type ImageSlot = keyof typeof IMAGE_SLOTS;
