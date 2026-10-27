import { addMonths, financeCsv, isMonthKey, monthKey, monthStart } from "@/lib/owner";
import { requireRole } from "@/lib/session";

// Ekspor CSV pemasukan dan pengeluaran (Owner). ?dari=YYYY-MM&sampai=YYYY-MM, default bulan ini.
export async function GET(request: Request) {
  await requireRole("owner");
  const params = new URL(request.url).searchParams;
  const from = isMonthKey(params.get("dari") ?? undefined) ? params.get("dari")! : monthKey();
  const until = isMonthKey(params.get("sampai") ?? undefined) ? params.get("sampai")! : from;
  if (until < from) return new Response("Rentang bulan tidak valid.", { status: 400 });
  const csv = await financeCsv(monthStart(from), monthStart(addMonths(until, 1)));
  const name = from === until ? `keuangan-${from}.csv` : `keuangan-${from}-sd-${until}.csv`;
  return new Response(csv, {
    headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="${name}"`, "Cache-Control": "no-store" },
  });
}
