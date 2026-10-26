"use server";

import { revalidatePath } from "next/cache";
import { LEARNING_GOALS } from "@/lib/placement/levels";
import { requireRole } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";

export type FormState = { error: string; ok: boolean };

export async function addChildAction(_prev: FormState, form: FormData): Promise<FormState> {
  await requireRole("guardian");
  const name = String(form.get("name") ?? "").trim();
  const birthYear = Number(form.get("birth_year"));
  const goal = String(form.get("goal") ?? "");
  const program = String(form.get("program") ?? "") || null;
  const relationship = String(form.get("relationship") ?? "orang_tua");
  const thisYear = new Date().getFullYear();

  if (name.length < 2) return { error: "Isi nama anak.", ok: false };
  if (!Number.isInteger(birthYear) || birthYear < thisYear - 25 || birthYear > thisYear - 4) return { error: "Tahun lahir anak tidak valid.", ok: false };
  if (!LEARNING_GOALS.some((g) => g.value === goal)) return { error: "Pilih tujuan belajar.", ok: false };

  // Fungsi database memastikan hanya wali yang bisa menambah anak, atas nama dirinya sendiri.
  const supabase = await createClient();
  const { error } = await supabase.rpc("add_child", { p_name: name, p_birth_year: birthYear, p_goal: goal, p_program: program, p_relationship: relationship });
  if (error) return { error: "Anak gagal ditambahkan. Coba lagi.", ok: false };
  revalidatePath("/portal/guardian", "layout");
  return { error: "", ok: true };
}
