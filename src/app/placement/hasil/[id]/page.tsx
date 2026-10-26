import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthShell } from "@/components/auth-shell";
import { AUTO_SECTIONS, overallLevel, SECTION_LABEL, type Level } from "@/lib/placement/levels";
import { attemptForActor, PlacementError } from "@/lib/placement/server";

export const metadata: Metadata = { title: "Hasil placement" };
export const dynamic = "force-dynamic";

// Hasil ringkas untuk tamu: perkiraan level dari bagian yang dinilai otomatis.
export default async function GuestResultPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  let attempt;
  try {
    attempt = await attemptForActor(id);
  } catch (e) {
    if (e instanceof PlacementError) redirect("/placement");
    throw e;
  }
  if (attempt.status === "in_progress") redirect(`/placement/tes/${id}`);

  const auto = AUTO_SECTIONS.map((s) => ({ section: s, level: attempt.levels[s], score: attempt.auto_scores[s] })).filter((x) => x.level);
  const estimate = overallLevel(auto.map((x) => x.level as Level));

  return (
    <AuthShell
      kicker="Hasil placement test"
      title={estimate ? `Perkiraan level: ${estimate}` : "Tes terkirim"}
      intro="Ini perkiraan awal dari grammar, reading, dan listening. Writing dan speaking dinilai tutor paling lambat 1×24 jam."
    >
      <ul className="space-y-2">
        {auto.map((x) => (
          <li key={x.section} className="lp-card-soft flex items-center justify-between px-4 py-3 text-sm">
            <span className="font-black text-white">{SECTION_LABEL[x.section]}</span>
            <span className="font-bold text-amber-100">
              {x.score?.correct}/{x.score?.total} benar · <span className="text-orange">{x.level}</span>
            </span>
          </li>
        ))}
      </ul>
      <div className="mt-6 rounded-xl border border-orange/40 bg-orange/10 p-5">
        <h2 className="font-black text-orange">Lihat hasil lengkap dan rekomendasi kelas</h2>
        <p className="lp-muted mt-2 text-sm leading-relaxed">Buat akun dari browser ini. Hasil tesmu otomatis tersambung, jadi tidak perlu tes ulang.</p>
        <Link href="/daftar" className="btn-orange mt-4 inline-block rounded-xl px-6 py-3 text-sm">
          Buat akun
        </Link>
        <p className="mt-3 text-xs text-amber-200/80">
          Sudah punya akun? <Link href="/masuk" className="font-bold text-orange">Masuk</Link>
        </p>
      </div>
    </AuthShell>
  );
}
