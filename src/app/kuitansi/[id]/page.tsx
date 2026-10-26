import Image from "next/image";
import { notFound } from "next/navigation";
import { formatDateTime } from "@/components/portal/ui";
import { formatRupiah } from "@/lib/content";
import { requireViewer } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import { PrintButton } from "./print-button";

export const dynamic = "force-dynamic";
export const metadata = { title: "Kuitansi · Milestone English" };

// Kuitansi invoice lunas. Dibaca dengan sesi pengguna, jadi hanya pemilik data, Admin, dan Owner yang bisa membukanya.
export default async function ReceiptPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requireViewer();
  const supabase = await createClient();
  const { data: inv } = await supabase
    .from("invoices")
    .select("number, amount_idr, description, status, paid_at, created_at, student:students(full_name)")
    .eq("id", id)
    .maybeSingle();
  if (!inv || inv.status !== "paid") notFound();
  const student = inv.student as unknown as { full_name: string } | null;

  return (
    <main className="min-h-screen bg-slate-100 px-4 py-10 text-slate-900 print:bg-white print:p-0">
      <div className="mx-auto max-w-2xl rounded-2xl bg-white p-8 shadow-xl print:shadow-none sm:p-10">
        <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-200 pb-6">
          <Image src="/logo.png" alt="Milestone English" width={440} height={109} className="h-10 w-auto" />
          <div className="text-right">
            <p className="text-2xl font-black tracking-tight text-[#F97316]">KUITANSI</p>
            <p className="text-sm font-bold">{inv.number}</p>
          </div>
        </div>
        <dl className="mt-6 grid gap-4 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-xs font-bold uppercase tracking-wider text-slate-500">Diterima dari</dt>
            <dd className="font-bold">{student?.full_name ?? "-"}</dd>
          </div>
          <div>
            <dt className="text-xs font-bold uppercase tracking-wider text-slate-500">Tanggal lunas</dt>
            <dd className="font-bold">{formatDateTime(inv.paid_at)}</dd>
          </div>
          <div className="sm:col-span-2">
            <dt className="text-xs font-bold uppercase tracking-wider text-slate-500">Untuk pembayaran</dt>
            <dd className="font-bold">{inv.description}</dd>
          </div>
        </dl>
        <div className="mt-8 flex items-center justify-between rounded-xl bg-slate-900 px-6 py-5 text-white">
          <span className="text-sm font-bold uppercase tracking-wider">Jumlah</span>
          <span className="text-3xl font-black">{formatRupiah(inv.amount_idr)}</span>
        </div>
        <p className="mt-6 text-xs text-slate-500">
          Status: LUNAS, diverifikasi tim Milestone English. Kuitansi ini dibuat otomatis oleh sistem dan sah tanpa tanda tangan. Invoice terbit {formatDateTime(inv.created_at)}.
        </p>
        <div className="mt-8 print:hidden">
          <PrintButton />
        </div>
      </div>
    </main>
  );
}
