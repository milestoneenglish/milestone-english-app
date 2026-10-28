import { renderPlacementPdf } from "@/lib/placement-pdf";
import { loadAttempt, userCanAccessStudent } from "@/lib/placement/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

// PDF hasil placement untuk siswa dan wali. Tersedia setelah hasil terbit dan kelas pertamanya aktif.
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const {
    data: { user },
  } = await (await createClient()).auth.getUser();
  if (!user) return new Response("Masuk dulu untuk mengunduh hasil placement.", { status: 401 });
  const attempt = await loadAttempt(id);
  if (!attempt?.student_id || attempt.status !== "published" || !(await userCanAccessStudent(user.id, attempt.student_id))) {
    return new Response("Hasil placement tidak ditemukan.", { status: 404 });
  }
  const admin = createAdminClient();
  const [{ data: student }, { data: classes }, { data: programs }] = await Promise.all([
    admin.from("students").select("full_name").eq("id", attempt.student_id).single(),
    admin.from("enrollments").select("id").eq("student_id", attempt.student_id).in("status", ["active", "completed"]).limit(1),
    attempt.recommended_program_ids.length ? admin.from("programs").select("id, name, category, duration_label").in("id", attempt.recommended_program_ids) : Promise.resolve({ data: [] }),
  ]);
  if (!classes?.length) return new Response("PDF hasil placement tersedia setelah kelas pertama aktif.", { status: 403 });

  const pdf = await renderPlacementPdf({
    student: student?.full_name ?? "",
    attempt,
    programs: attempt.recommended_program_ids.map((pid) => (programs ?? []).find((p) => p.id === pid)).filter(Boolean) as { name: string; category: string; duration_label: string }[],
  });
  const safe = (student?.full_name ?? "siswa").normalize("NFKD").replace(/[^\w\s-]/g, "").trim().replace(/\s+/g, "-");
  return new Response(new Uint8Array(pdf), {
    headers: { "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="Hasil-Placement-${safe}.pdf"`, "Cache-Control": "no-store" },
  });
}
