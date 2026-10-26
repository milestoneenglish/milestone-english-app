import type { Metadata } from "next";
import Link from "next/link";
import { AuthShell } from "@/components/auth-shell";

export const metadata: Metadata = { title: "Placement Test" };

const PARTS = [
  ["Grammar", "Pilihan ganda, dinilai otomatis"],
  ["Reading", "Teks dan soal, dinilai otomatis"],
  ["Listening", "Audio pendek, diputar maksimal 2 kali"],
  ["Writing", "Menulis singkat, dinilai tutor"],
  ["Speaking", "Rekam suara, dinilai tutor"],
];

// Placement test gratis dibangun di Fase 1.
export default function PlacementPage() {
  return (
    <AuthShell
      kicker="Placement test gratis"
      title="Ketahui level bahasa Inggrismu"
      intro="Sekitar 25–30 menit. Level ringkas langsung tampil; hasil lengkap dan rekomendasi kelas terbuka setelah membuat akun."
    >
      <p className="text-[11px] font-black uppercase tracking-[0.2em] text-amber-200/80">Sedang dibangun · Fase 1</p>
      <h2 className="mt-2 text-xl font-black text-orange">Lima bagian tes</h2>
      <ul className="mt-5 space-y-2">
        {PARTS.map(([name, desc]) => (
          <li key={name} className="lp-card-soft flex items-center justify-between gap-4 px-4 py-3 text-sm">
            <span className="font-black text-white">{name}</span>
            <span className="text-right text-xs text-amber-200/80">{desc}</span>
          </li>
        ))}
      </ul>
      <Link href="/" className="btn-orange mt-8 inline-block rounded-xl px-6 py-3 text-sm">
        Kembali ke beranda
      </Link>
    </AuthShell>
  );
}
