// Tombol unduh PDF hasil placement: muncul setelah hasil terbit dan kelas pertama aktif.

export function placementPdfReady(attempt: { status: string }, enrollments: { status: string }[]) {
  return attempt.status === "published" && enrollments.some((e) => e.status === "active" || e.status === "completed");
}

export function PlacementPdfLink({ attemptId }: { attemptId: string }) {
  return (
    <a href={`/api/placement/${attemptId}/pdf`} className="rounded-full border border-orange/40 px-4 py-2 text-xs font-black text-orange hover:bg-orange/10">
      Unduh PDF placement
    </a>
  );
}
