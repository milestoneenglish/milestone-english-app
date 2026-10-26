export const ROLES = ["owner", "admin", "lead", "tutor", "student", "guardian"] as const;
export type Role = (typeof ROLES)[number];

export function isRole(value: string): value is Role {
  return (ROLES as readonly string[]).includes(value);
}

export const ROLE_LABEL: Record<Role, string> = {
  owner: "Owner",
  admin: "Admin Operasional",
  lead: "Academic Lead",
  tutor: "Tutor",
  student: "Siswa",
  guardian: "Wali",
};

// Urutan tujuan default saat satu akun memegang beberapa role.
export const ROLE_PRIORITY: Role[] = ["owner", "admin", "lead", "tutor", "guardian", "student"];

export type MenuItem = { slug: string; label: string; icon: IconName; phase: number };
export type IconName =
  | "home"
  | "test"
  | "book"
  | "calendar"
  | "task"
  | "chart"
  | "report"
  | "wallet"
  | "help"
  | "users"
  | "layers"
  | "check"
  | "settings"
  | "shield"
  | "star"
  | "edit";

// Menu tiap role sesuai spesifikasi. `phase` = fase pembangunan yang mengisi halaman tersebut.
export const ROLE_MENU: Record<Role, MenuItem[]> = {
  student: [
    { slug: "", label: "Beranda", icon: "home", phase: 1 },
    { slug: "placement", label: "Placement", icon: "test", phase: 1 },
    { slug: "program", label: "Program Saya", icon: "book", phase: 2 },
    { slug: "jadwal", label: "Jadwal", icon: "calendar", phase: 3 },
    { slug: "materi", label: "Materi & Tugas", icon: "task", phase: 3 },
    { slug: "progres", label: "Progres", icon: "chart", phase: 4 },
    { slug: "laporan", label: "Laporan", icon: "report", phase: 4 },
    { slug: "pembayaran", label: "Pembayaran", icon: "wallet", phase: 2 },
    { slug: "bantuan", label: "Bantuan", icon: "help", phase: 5 },
  ],
  guardian: [
    { slug: "", label: "Beranda", icon: "home", phase: 1 },
    { slug: "anak", label: "Anak Saya", icon: "users", phase: 1 },
    { slug: "jadwal", label: "Jadwal & Kehadiran", icon: "calendar", phase: 3 },
    { slug: "progres", label: "Progres & Laporan", icon: "report", phase: 4 },
    { slug: "pembayaran", label: "Pembayaran", icon: "wallet", phase: 2 },
    { slug: "bantuan", label: "Bantuan", icon: "help", phase: 5 },
  ],
  tutor: [
    { slug: "", label: "Beranda", icon: "home", phase: 3 },
    { slug: "kelas", label: "Kelas Saya", icon: "layers", phase: 2 },
    { slug: "sesi", label: "Sesi & Absensi", icon: "calendar", phase: 3 },
    { slug: "tugas", label: "Tugas", icon: "task", phase: 3 },
    { slug: "assessment", label: "Assessment", icon: "check", phase: 4 },
    { slug: "laporan", label: "Laporan", icon: "report", phase: 4 },
    { slug: "placement", label: "Penilaian Placement", icon: "test", phase: 1 },
  ],
  admin: [
    { slug: "", label: "Beranda", icon: "home", phase: 2 },
    { slug: "pendaftaran", label: "Pendaftaran", icon: "users", phase: 1 },
    { slug: "batch", label: "Batch & Jadwal", icon: "calendar", phase: 2 },
    { slug: "pembayaran", label: "Pembayaran", icon: "wallet", phase: 2 },
    { slug: "siswa-wali", label: "Siswa & Wali", icon: "shield", phase: 1 },
    { slug: "bantuan", label: "Bantuan", icon: "help", phase: 5 },
    { slug: "cms", label: "CMS Website", icon: "edit", phase: 5 },
  ],
  lead: [
    { slug: "", label: "Beranda", icon: "home", phase: 4 },
    { slug: "kurikulum", label: "Kurikulum", icon: "book", phase: 3 },
    { slug: "bank-soal", label: "Bank Soal Placement", icon: "test", phase: 1 },
    { slug: "placement", label: "Placement", icon: "check", phase: 1 },
    { slug: "laporan", label: "Review Laporan", icon: "report", phase: 4 },
    { slug: "kualitas-tutor", label: "Kualitas Tutor", icon: "star", phase: 5 },
  ],
  owner: [
    { slug: "", label: "Beranda", icon: "home", phase: 5 },
    { slug: "staf", label: "Staf & Role", icon: "users", phase: 5 },
    { slug: "program", label: "Program & Harga", icon: "book", phase: 5 },
    { slug: "keuangan", label: "Keuangan", icon: "wallet", phase: 5 },
    { slug: "audit", label: "Audit Log", icon: "shield", phase: 5 },
    { slug: "pengaturan", label: "Pengaturan", icon: "settings", phase: 5 },
  ],
};
