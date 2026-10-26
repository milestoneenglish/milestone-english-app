import type { Metadata } from "next";
import Link from "next/link";
import { AuthShell } from "@/components/auth-shell";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { startGuestTest } from "./actions";

export const metadata: Metadata = { title: "Placement Test Gratis" };

const PARTS = [
  ["Grammar", "12 soal pilihan ganda"],
  ["Reading", "2 teks, 8 soal"],
  ["Listening", "2 audio, 6 soal, diputar maks. 2 kali"],
  ["Writing", "1 tulisan singkat, dinilai tutor"],
  ["Speaking", "2 rekaman suara, dinilai tutor"],
];

export default function PlacementPage() {
  return (
    <AuthShell
      kicker="Placement test gratis"
      title="Ketahui level bahasa Inggrismu"
      intro="Sekitar 25–30 menit. Perkiraan level langsung tampil setelah tes dikirim; hasil lengkap dan rekomendasi kelas terbuka setelah kamu membuat akun."
      aside={
        <div className="border-t border-orange/20 pt-6 text-xs text-amber-200/80">
          Sudah punya akun? <Link href="/masuk" className="font-bold text-orange">Masuk</Link> dan kerjakan placement dari portal supaya hasilnya langsung tersimpan.
        </div>
      }
    >
      <h2 className="text-xl font-black text-orange">Lima bagian tes</h2>
      <ul className="mt-5 space-y-2">
        {PARTS.map(([name, desc]) => (
          <li key={name} className="lp-card-soft flex items-center justify-between gap-4 px-4 py-3 text-sm">
            <span className="font-black text-white">{name}</span>
            <span className="text-right text-xs text-amber-200/80">{desc}</span>
          </li>
        ))}
      </ul>
      <p className="lp-muted mt-5 text-xs leading-relaxed">Siapkan tempat yang tenang, headphone atau speaker, dan izinkan mikrofon untuk bagian speaking. Jawaban tersimpan otomatis, jadi kamu bisa melanjutkan dari browser yang sama.</p>
      {isSupabaseConfigured ? (
        <form action={startGuestTest} className="mt-8">
          <button className="btn-orange w-full rounded-xl py-3.5 text-sm sm:w-auto sm:px-10">Mulai tes gratis</button>
        </form>
      ) : (
        <p className="mt-8 rounded-xl border border-orange/40 bg-orange/10 p-4 text-sm text-amber-100">Tes aktif setelah aplikasi tersambung ke Supabase.</p>
      )}
    </AuthShell>
  );
}
