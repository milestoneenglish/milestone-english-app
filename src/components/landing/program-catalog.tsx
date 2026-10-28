"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Icon } from "@/components/icons";
import { PROGRAM_CATEGORIES, type Program, type ProgramCategory } from "@/data/catalog";
import type { OpenBatch } from "@/lib/content";
import { DATE_LOCALE, dict, localePath, type Lang } from "@/lib/i18n";

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

const batchDateFor = (lang: Lang) => {
  const fmt = new Intl.DateTimeFormat(DATE_LOCALE[lang], { day: "numeric", month: "short", timeZone: "Asia/Jakarta" });
  return (d: string) => fmt.format(new Date(`${d}T00:00:00+07:00`));
};

export function ProgramCatalog({ programs, batches = [], lang = "id" }: { programs: Program[]; batches?: OpenBatch[]; lang?: Lang }) {
  const t = dict(lang).catalog;
  const batchDate = batchDateFor(lang);
  const signup = (slug: string) => `${localePath(lang, "/daftar")}?program=${slug}`;
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
      <div className="mt-8 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5" role="tablist" aria-label={t.categories}>
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
              {cat === "all" ? t.all : cat}
            </button>
          );
        })}
      </div>

      <p className="mt-4 text-xs text-amber-200/70" aria-live="polite">
        {t.showing(visible.length, programs.length)}
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
                  <p className="text-amber-200/70">{t.level}</p>
                  <p className="mt-1 font-bold text-white">{p.entry_level}</p>
                </div>
                <div>
                  <p className="text-amber-200/70">{t.capacity}</p>
                  <p className="mt-1 font-bold text-white">{t.learners(p.capacity)}</p>
                </div>
              </div>
              {(() => {
                const next = batches.find((b) => b.program_slug === p.slug && b.seats_left > 0);
                return (
                  <p className="mt-4 rounded-xl border border-orange/25 bg-navy/50 px-3 py-2 text-[11px] font-bold text-amber-100">
                    {next ? t.nextBatch(batchDate(next.start_date), next.seats_left) : t.batchSoon}
                  </p>
                );
              })()}
              <div className="mt-5 flex items-center justify-between">
                <span className="text-lg font-black text-orange">{rupiah(p.price_idr)}</span>
                <span className="text-[10px] font-black uppercase tracking-[0.18em] text-orange">{p.code}</span>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-3">
                <button type="button" onClick={() => setSelected(p)} className="btn-orange w-full rounded-full px-4 py-3 text-xs">
                  {t.detail}
                </button>
                <Link href={signup(p.slug)} className="btn-orange w-full rounded-full px-4 py-3 text-center text-xs">
                  {t.takeSlot}
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
                aria-label={t.closeDetail}
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
                  [t.level, selected.entry_level],
                  [t.duration, selected.duration_label],
                  [t.capacity, t.learners(selected.capacity)],
                  [t.price, rupiah(selected.price_idr)],
                ].map(([label, value]) => (
                  <div key={label} className="lp-card-soft p-4">
                    <p className="text-xs text-amber-200/70">{label}</p>
                    <p className={`mt-1 font-black ${label === t.price ? "text-orange" : "text-white"}`}>{value}</p>
                  </div>
                ))}
              </div>
              <div className="mt-7 grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="lp-card-soft p-5">
                  <h3 className="font-black text-white">{t.target}</h3>
                  <p className="lp-muted mt-2 text-sm leading-relaxed">{selected.outcome}</p>
                </div>
                <div className="lp-card-soft p-5">
                  <h3 className="font-black text-white">{t.evidence}</h3>
                  <p className="lp-muted mt-2 text-sm leading-relaxed">{selected.evidence}</p>
                </div>
              </div>
              <div className="lp-card-soft mt-4 p-5">
                <h3 className="font-black text-white">{t.openBatches}</h3>
                {batches.some((b) => b.program_slug === selected.slug) ? (
                  <ul className="mt-2 space-y-2 text-sm">
                    {batches
                      .filter((b) => b.program_slug === selected.slug)
                      .map((b) => (
                        <li key={b.code} className="flex flex-wrap justify-between gap-2 text-amber-100">
                          <span>
                            {t.starts(batchDate(b.start_date))} · {b.schedule_label}
                          </span>
                          <span className={b.seats_left > 0 ? "font-bold text-orange" : "font-bold text-rose-300"}>{b.seats_left > 0 ? t.seatsLeft(b.seats_left) : t.full}</span>
                        </li>
                      ))}
                  </ul>
                ) : (
                  <p className="lp-muted mt-2 text-sm leading-relaxed">{t.batchSoonLong}</p>
                )}
              </div>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-end">
                <button type="button" onClick={() => setSelected(null)} className="rounded-full border border-orange/50 px-6 py-3 text-sm font-black text-orange hover:bg-orange/10">
                  {t.close}
                </button>
                <Link href={signup(selected.slug)} className="btn-orange rounded-full px-6 py-3 text-center text-sm">
                  {t.takeSlot}
                </Link>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
