"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

// Tim kembali ke halaman masuk tim; siswa dan wali ke landing page.
export async function signOut(form?: FormData) {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect(form?.get("to") === "/tim" ? "/tim" : "/");
}
