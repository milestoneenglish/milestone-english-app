import "server-only";
import { ROLE_MENU, type MenuItem, type Role } from "@/lib/roles";
import { createAdminClient } from "@/lib/supabase/admin";

// Menu belajar baru tampil setelah pembayaran pertama diverifikasi (mode Siswa).
// Sebelum itu (mode Calon Siswa) menu tersebut disembunyikan, bukan dikunci.
const LEARNING: Partial<Record<Role, string[]>> = {
  student: ["jadwal", "materi", "progres", "laporan"],
  guardian: ["jadwal", "materi", "progres"],
};

async function hasActiveStudent(role: Role, userId: string) {
  const admin = createAdminClient();
  if (role === "student") {
    const { data } = await admin.from("students").select("status").eq("user_id", userId).maybeSingle();
    return data?.status === "active";
  }
  const { data } = await admin.from("guardian_links").select("students(status)").eq("guardian_id", userId).neq("status", "rejected");
  return (data ?? []).some((l) => (l.students as unknown as { status: string } | null)?.status === "active");
}

export async function menuFor(role: Role, userId: string): Promise<MenuItem[]> {
  const items = ROLE_MENU[role];
  const learning = LEARNING[role];
  if (!learning || (await hasActiveStudent(role, userId))) return items;
  return items
    .filter((m) => !learning.includes(m.slug))
    .map((m) => (role === "student" && m.slug === "program" ? { ...m, label: "Pilih Program" } : m));
}
