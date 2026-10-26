import type { Metadata } from "next";
import Link from "next/link";
import { AuthShell } from "@/components/auth-shell";
import { SEED_PROGRAMS } from "@/data/catalog";

export const metadata: Metadata = { title: "Daftar" };

// Form pendaftaran siswa/wali dibangun di Fase 1.
export default async function RegisterPage({ searchParams }: { searchParams: Promise<{ program?: string }> }) {
  const { program } = await searchParams;
  const chosen = SEED_PROGRAMS.find((p) => p.slug === program);

  return (
    <AuthShell
      kicker="Pendaftaran"
      title="Daftar Milestone English"
      intro="Satu form singkat untuk siswa dewasa atau wali yang mendaftarkan anak, diikuti verifikasi email dan placement test."
    >
      <p className="text-[11px] font-black uppercase tracking-[0.2em] text-amber-200/80">Sedang dibangun · Fase 1</p>
      <h2 className="mt-2 text-xl font-black text-orange">Form pendaftaran segera tersedia</h2>
      {chosen && (
        <p className="mt-3 rounded-xl border border-orange/40 bg-orange/10 px-4 py-3 text-sm text-amber-100">
          Program yang kamu pilih: <span className="font-black text-orange">{chosen.name}</span>
        </p>
      )}
      <ol className="lp-muted mt-5 list-decimal space-y-2 pl-5 text-sm">
        <li>Isi nama, email, nomor WhatsApp, dan tujuan belajar.</li>
        <li>Verifikasi email dengan kode 6 digit.</li>
        <li>Kerjakan placement test untuk mengetahui level awalmu.</li>
      </ol>
      <Link href="/#programs" className="btn-orange mt-8 inline-block rounded-xl px-6 py-3 text-sm">
        Lihat program
      </Link>
    </AuthShell>
  );
}
