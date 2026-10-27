import { buildBackup } from "@/lib/owner";
import { requireRole } from "@/lib/session";

export const maxDuration = 60;

// Backup semua tabel (CSV dalam ZIP) untuk disimpan Owner di Google Drive.
export async function GET() {
  const viewer = await requireRole("owner");
  const { zip, name } = await buildBackup(viewer.id);
  return new Response(new Uint8Array(zip), {
    headers: { "Content-Type": "application/zip", "Content-Disposition": `attachment; filename="${name}"`, "Cache-Control": "no-store" },
  });
}
