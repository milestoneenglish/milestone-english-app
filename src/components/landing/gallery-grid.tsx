"use client";

import { useEffect, useState } from "react";
import { Icon } from "@/components/icons";
import type { SiteCard } from "@/lib/content";
import { dict, type Lang } from "@/lib/i18n";

// Galeri foto landing page. Foto dibuka besar saat diklik; tutup dengan ✕, Escape, atau klik di luar foto.
// Panah kiri/kanan berpindah foto.
export function GalleryGrid({ photos, lang }: { photos: SiteCard[]; lang: Lang }) {
  const { galleryClose: closeLabel, galleryOpen: openLabel } = dict(lang).landing;
  const [index, setIndex] = useState<number | null>(null);
  const open = index !== null ? photos[index] : null;

  useEffect(() => {
    if (index === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIndex(null);
      if (e.key === "ArrowRight") setIndex((i) => (i === null ? i : (i + 1) % photos.length));
      if (e.key === "ArrowLeft") setIndex((i) => (i === null ? i : (i - 1 + photos.length) % photos.length));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [index, photos.length]);

  return (
    <>
      <ul className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 lg:grid-cols-4">
        {photos.map((p, i) => (
          <li key={p.id} className={i === 0 && photos.length > 4 ? "col-span-2 row-span-2" : ""}>
            <button type="button" onClick={() => setIndex(i)} aria-label={openLabel(p.title)} className="group relative block h-full w-full overflow-hidden rounded-2xl border border-orange/20">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={p.image_url ?? ""} alt={p.title} loading="lazy" className="aspect-[4/3] h-full w-full object-cover transition duration-300 group-hover:scale-105" />
              {p.title && (
                <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-navy-dark/90 to-transparent px-3 pb-2 pt-6 text-left text-xs font-bold text-white opacity-0 transition group-hover:opacity-100 group-focus-visible:opacity-100">
                  {p.title}
                </span>
              )}
            </button>
          </li>
        ))}
      </ul>

      {open && (
        <div className="modal-backdrop fixed inset-0 z-[80] flex items-center justify-center p-4" onClick={() => setIndex(null)} role="dialog" aria-modal="true" aria-label={open.title || openLabel("")}>
          <figure className="fade-in relative max-h-[90vh] max-w-5xl" onClick={(e) => e.stopPropagation()}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={open.image_url ?? ""} alt={open.title} className="max-h-[80vh] w-auto rounded-2xl object-contain" />
            {open.title && <figcaption className="mt-3 text-center text-sm font-bold text-amber-100">{open.title}</figcaption>}
            <button type="button" onClick={() => setIndex(null)} className="btn-orange absolute right-3 top-3 flex h-10 w-10 items-center justify-center rounded-full" aria-label={closeLabel}>
              <Icon name="close" className="h-5 w-5" />
            </button>
          </figure>
        </div>
      )}
    </>
  );
}
