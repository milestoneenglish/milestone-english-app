"use client";

import { useEffect } from "react";
import { Icon } from "@/components/icons";

// Jendela pop-up di tengah layar. Tutup dengan tombol ✕, Escape, atau klik di luar jendela.
export function Modal({ title, onClose, children, wide = false }: { title: string; onClose: () => void; children: React.ReactNode; wide?: boolean }) {
  useEffect(() => {
    const esc = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", esc);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", esc);
      document.body.style.overflow = overflow;
    };
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-[90] flex items-end justify-center p-0 sm:items-center sm:p-6" role="dialog" aria-modal="true" aria-label={title}>
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className={`fade-in relative max-h-[92vh] w-full overflow-y-auto rounded-t-3xl border border-orange/40 bg-navy-dark p-5 shadow-2xl sm:rounded-3xl sm:p-7 ${wide ? "sm:max-w-3xl" : "sm:max-w-lg"}`}>
        <div className="mb-5 flex items-start justify-between gap-4">
          <h2 className="text-lg font-black text-orange">{title}</h2>
          <button onClick={onClose} className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-800 text-slate-300 hover:text-white" aria-label="Tutup">
            <Icon name="close" className="h-4 w-4" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
