"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Icon } from "@/components/icons";
import { PROGRAM_CATEGORIES, type Program, type ProgramCategory } from "@/data/catalog";

const CATEGORY_PHOTO: Record<ProgramCategory, string> = {
  "Everyday English": "https://images.unsplash.com/photo-1522202176988-66273c2fd55f?auto=format&fit=crop&w=900&q=80",
  "Academic English": "https://images.unsplash.com/photo-1434030216411-0b793f4b4173?auto=format&fit=crop&w=900&q=80",
  "Young Learners": "https://images.unsplash.com/photo-1509062522246-3755977927d7?auto=format&fit=crop&w=900&q=80",
  "Professional English": "https://images.unsplash.com/photo-1556761175-b413da4baf72?auto=format&fit=crop&w=900&q=80",
};

const CATEGORY_ICON: Record<ProgramCategory, "mic" | "book" | "star" | "chart"> = {
  "Everyday English": "mic",
  "Academic English": "book",
  "Young Learners": "star",
  "Professional English": "chart",
};

const rupiah = (value: number) =>
  new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(value);

export function ProgramCatalog({ programs }: { programs: Program[] }) {
  const [filter, setFilter] = useState<ProgramCategory | "all">("all");
  const [selected, setSelected] = useState<Program | null>(null);
  const visible = filter === "all" ? programs : programs.filter((p) => p.category === filter);

  useEffect(() => {
    if (!selected) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setSelected(null);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selected]);

  return (
    <>
      <div className="mt-8 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5" role="tablist" aria-label="Kategori program">
        {(["all", ...PROGRAM_CATEGORIES] as const).map((cat) => {
          const active = filter === cat;
          return (
            <button
              key={cat}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setFilter(cat)}
              className={`w-full rounded-full border px-4 py-3 text-xs font-extrabold transition ${
                active
                  ? "btn-orange border-orange font-black"
                  : "border-orange/30 bg-navy-card/70 text-amber-200/80 hover:border-orange hover:text-white"
              }`}
            >
              {cat === "all" ? "Semua Program" : cat}
            </button>
          );
        })}
      </div>

      <p className="mt-4 text-xs text-amber-200/70" aria-live="polite">
        Menampilkan {visible.length} dari {programs.length} program
      </p>

      <div className="mt-6 grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
        {visible.map((p) => (
          <article key={p.code} className="lp-card lp-course-card flex flex-col overflow-hidden">
            <div className="relative">
              <div className="lp-photo h-52 rounded-t-[12px]" style={{ backgroundImage: `url('${CATEGORY_PHOTO[p.category]}')` }}>
                <div className="relative z-10 flex h-full flex-col justify-end p-5">
                  <div className="flex h-14 w-14 items-center justify-center rounded-[18px] bg-orange text-navy shadow-xl shadow-orange/20">
                    <Icon name={CATEGORY_ICON[p.category]} />
                  </div>
                  <div className="mt-6 flex items-end justify-between gap-3">
                    <span className="text-[10px] font-black uppercase tracking-[0.22em] text-orange">{p.category}</span>
                    <span className="text-[10px] font-black text-orange/80">{p.code}</span>
                  </div>
                </div>
              </div>
              {p.featured ? (
                <span className="absolute right-4 top-4 z-10 rounded-full bg-orange px-3 py-1 text-[10px] font-black text-white shadow-lg">Featured</span>
              ) : (
                <span className="absolute right-4 top-4 z-10 rounded-full border border-orange/40 bg-navy/85 px-3 py-1 text-[10px] font-black text-orange">{p.code}</span>
              )}
            </div>
            <div className="flex flex-1 flex-col p-5">
              <div className="mb-3 flex items-center justify-between gap-3 text-xs">
                <span className="font-extrabold text-orange">{p.category}</span>
                <span className="text-amber-200/80">{p.duration_label}</span>
              </div>
              <h3 className="text-xl font-black leading-tight text-orange">{p.name}</h3>
              <p className="lp-muted mt-3 flex-1 text-sm leading-relaxed">{p.outcome}</p>
              <div className="mt-5 grid grid-cols-2 gap-3 border-t border-orange/20 pt-4 text-xs">
                <div>
                  <p className="text-amber-200/70">Level</p>
                  <p className="mt-1 font-bold text-white">{p.entry_level}</p>
                </div>
                <div>
                  <p className="text-amber-200/70">Kapasitas</p>
                  <p className="mt-1 font-bold text-white">{p.capacity} peserta</p>
                </div>
              </div>
              <div className="mt-5 flex items-center justify-between">
                <span className="text-lg font-black text-orange">{rupiah(p.price_idr)}</span>
                <span className="text-[10px] font-black uppercase tracking-[0.18em] text-orange">{p.code}</span>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-3">
                <button type="button" onClick={() => setSelected(p)} className="btn-orange w-full rounded-full px-4 py-3 text-xs">
                  Detail
                </button>
                <Link href={`/daftar?program=${p.slug}`} className="btn-orange w-full rounded-full px-4 py-3 text-center text-xs">
                  Ambil Slot
                </Link>
              </div>
            </div>
          </article>
        ))}
      </div>

      {selected && (
        <div className="modal-backdrop fixed inset-0 z-[80] flex items-center justify-center p-4" onClick={() => setSelected(null)}>
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="program-detail-title"
            className="lp-card fade-in max-h-[90vh] w-full max-w-4xl overflow-y-auto rounded-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="lp-photo h-64 rounded-t-2xl" style={{ backgroundImage: `url('${CATEGORY_PHOTO[selected.category]}')` }}>
              <button
                type="button"
                onClick={() => setSelected(null)}
                className="btn-orange absolute right-4 top-4 z-20 flex h-11 w-11 items-center justify-center rounded-full"
                aria-label="Tutup detail program"
              >
                <Icon name="close" className="h-5 w-5" />
              </button>
              <div className="relative z-10 flex h-full flex-col justify-end p-6">
                <p className="text-xs font-black uppercase tracking-[0.22em] text-orange">
                  {selected.category} | {selected.code}
                </p>
                <h2 id="program-detail-title" className="mt-3 text-3xl font-black text-orange sm:text-4xl">
                  {selected.name}
                </h2>
              </div>
            </div>
            <div className="p-6 sm:p-8">
              <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
                {[
                  ["Level", selected.entry_level],
                  ["Durasi", selected.duration_label],
                  ["Kapasitas", `${selected.capacity} peserta`],
                  ["Harga", rupiah(selected.price_idr)],
                ].map(([label, value]) => (
                  <div key={label} className="lp-card-soft p-4">
                    <p className="text-xs text-amber-200/70">{label}</p>
                    <p className={`mt-1 font-black ${label === "Harga" ? "text-orange" : "text-white"}`}>{value}</p>
                  </div>
                ))}
              </div>
              <div className="mt-7 grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="lp-card-soft p-5">
                  <h3 className="font-black text-white">Target akhir</h3>
                  <p className="lp-muted mt-2 text-sm leading-relaxed">{selected.outcome}</p>
                </div>
                <div className="lp-card-soft p-5">
                  <h3 className="font-black text-white">Bukti progres</h3>
                  <p className="lp-muted mt-2 text-sm leading-relaxed">{selected.evidence}</p>
                </div>
              </div>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-end">
                <button type="button" onClick={() => setSelected(null)} className="rounded-full border border-orange/50 px-6 py-3 text-sm font-black text-orange hover:bg-orange/10">
                  Tutup
                </button>
                <Link href={`/daftar?program=${selected.slug}`} className="btn-orange rounded-full px-6 py-3 text-center text-sm">
                  Ambil Slot
                </Link>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
