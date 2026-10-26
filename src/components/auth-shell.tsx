import Link from "next/link";
import { Logo } from "@/components/logo";

// Bingkai dua kolom untuk halaman masuk dan daftar, mengikuti desain portal login lama.
export function AuthShell({ kicker, title, intro, aside, children }: { kicker: string; title: string; intro: string; aside?: React.ReactNode; children: React.ReactNode }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-navy-dark px-4 py-10">
      <div className="grid w-full max-w-5xl grid-cols-1 gap-6 lg:grid-cols-12">
        <section className="workspace-panel flex flex-col justify-between p-7 sm:p-8 lg:col-span-5">
          <div>
            <Logo className="h-9 w-auto" plate />
            <p className="mt-8 text-[11px] font-black uppercase tracking-[0.24em] text-amber-200/80">{kicker}</p>
            <h1 className="mt-3 text-3xl font-black leading-tight text-orange">{title}</h1>
            <p className="lp-muted mt-3 text-sm leading-relaxed">{intro}</p>
          </div>
          {aside && <div className="mt-8">{aside}</div>}
        </section>
        <section className="workspace-panel p-7 sm:p-8 lg:col-span-7">
          <div className="mb-6 flex justify-end">
            <Link href="/" className="text-xs font-bold text-orange hover:text-orange-light">
              ← Kembali ke beranda
            </Link>
          </div>
          {children}
        </section>
      </div>
    </main>
  );
}
