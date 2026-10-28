"use client";

import { useEffect, useState } from "react";
import { Icon } from "@/components/icons";

// Pop-up singkat di pojok layar setelah aksi berhasil atau gagal. Dipanggil dari mana saja lewat toast().
type Toast = { id: number; tone: "success" | "error"; text: string };
type Listener = (t: Toast) => void;

const listeners = new Set<Listener>();
let nextId = 1;

function push(tone: Toast["tone"], text: string) {
  const t = { id: nextId++, tone, text };
  listeners.forEach((l) => l(t));
}

export const toast = {
  success: (text = "Tersimpan") => push("success", text),
  error: (text = "Terjadi kesalahan.") => push("error", text),
};

const DURATION = { success: 3000, error: 6000 };

export function Toaster() {
  const [items, setItems] = useState<Toast[]>([]);

  useEffect(() => {
    const onToast: Listener = (t) => {
      setItems((list) => [...list.slice(-3), t]);
      setTimeout(() => setItems((list) => list.filter((x) => x.id !== t.id)), DURATION[t.tone]);
    };
    listeners.add(onToast);
    return () => void listeners.delete(onToast);
  }, []);

  // Klik di mana saja pada input tanggal/jam membuka kalender, bukan hanya ikon kecil di ujungnya.
  useEffect(() => {
    const open = (e: MouseEvent) => {
      const el = e.target as HTMLInputElement;
      if (el instanceof HTMLInputElement && ["date", "datetime-local", "time", "month"].includes(el.type) && !el.disabled && !el.readOnly) {
        try {
          el.showPicker();
        } catch {
          // Browser lama tanpa showPicker tetap memakai ikon kalendernya.
        }
      }
    };
    document.addEventListener("click", open);
    return () => document.removeEventListener("click", open);
  }, []);

  return (
    <div aria-live="polite" className="pointer-events-none fixed inset-x-4 bottom-4 z-[100] flex flex-col items-end gap-2 sm:inset-x-auto sm:right-6 sm:bottom-6">
      {items.map((t) => (
        <div
          key={t.id}
          role={t.tone === "error" ? "alert" : "status"}
          className={`toast-in pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-2xl border px-4 py-3 text-sm font-bold shadow-2xl sm:w-auto ${
            t.tone === "success" ? "border-emerald-400/50 bg-[#0B2A24] text-emerald-200" : "border-rose-400/50 bg-[#2A1220] text-rose-200"
          }`}
        >
          <span className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${t.tone === "success" ? "bg-emerald-400 text-navy" : "bg-rose-400 text-navy"}`}>
            <Icon name={t.tone === "success" ? "check" : "close"} className="h-3 w-3" />
          </span>
          <span className="flex-1">{t.text}</span>
          <button onClick={() => setItems((list) => list.filter((x) => x.id !== t.id))} className="text-xs opacity-60 hover:opacity-100" aria-label="Tutup">
            ✕
          </button>
        </div>
      ))}
    </div>
  );
}
