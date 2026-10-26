"use client";

export function PrintButton() {
  return (
    <button onClick={() => window.print()} className="rounded-full bg-[#F97316] px-6 py-3 text-sm font-black text-white hover:bg-orange-600">
      Cetak / simpan PDF
    </button>
  );
}
