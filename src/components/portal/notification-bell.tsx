"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { readInboxAction } from "@/app/portal/inbox-actions";
import { Icon } from "@/components/icons";
import type { InboxItem, InboxSummary } from "@/lib/inbox";

const TIME = new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Jakarta" });

function ago(iso: string) {
  const minutes = Math.round((Date.now() - Date.parse(iso)) / 60000);
  if (minutes < 1) return "baru saja";
  if (minutes < 60) return `${minutes} menit lalu`;
  if (minutes < 24 * 60) return `${Math.round(minutes / 60)} jam lalu`;
  return TIME.format(new Date(iso));
}

// Lonceng di header portal: jumlah notifikasi belum dibaca dan daftar terbaru.
export function NotificationBell({ summary, onChange, role }: { summary: InboxSummary; onChange: (s: InboxSummary) => void; role: string }) {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => box.current && !box.current.contains(e.target as Node) && setOpen(false);
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", esc);
    };
  }, [open]);

  const read = async (ids: string[] | null) => onChange(await readInboxAction(ids));
  // Link "/portal" di pesan diarahkan ke portal role yang sedang dibuka.
  const href = (item: InboxItem) => (!item.link || item.link === "/portal" ? `/portal/${role}` : item.link);

  return (
    <div ref={box} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="relative flex h-9 w-9 items-center justify-center rounded-full bg-slate-800/60 text-slate-300 hover:text-white"
        aria-label={summary.unread ? `Notifikasi, ${summary.unread} belum dibaca` : "Notifikasi"}
        aria-expanded={open}
      >
        <Icon name="bell" className="h-5 w-5" />
        {summary.unread > 0 && (
          <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-orange px-1 text-[10px] font-black text-navy">
            {summary.unread > 99 ? "99+" : summary.unread}
          </span>
        )}
      </button>
      {open && (
        <div className="fixed inset-x-3 top-16 z-50 overflow-hidden rounded-2xl border border-orange/30 bg-navy-dark shadow-2xl sm:absolute sm:inset-x-auto sm:right-0 sm:top-11 sm:w-96">
          <div className="flex items-center justify-between border-b border-slate-800 px-4 py-3">
            <p className="text-sm font-black text-white">Notifikasi</p>
            {summary.unread > 0 && (
              <button onClick={() => void read(null)} className="text-xs font-bold text-orange hover:text-orange-light">
                Tandai semua dibaca
              </button>
            )}
          </div>
          {summary.items.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-slate-400">Belum ada notifikasi.</p>
          ) : (
            <ul className="max-h-[60vh] divide-y divide-slate-800 overflow-y-auto">
              {summary.items.map((item) => (
                <li key={item.id}>
                  <Link
                    href={href(item)}
                    onClick={() => {
                      setOpen(false);
                      if (!item.read) void read([item.id]);
                    }}
                    className={`flex gap-3 px-4 py-3 hover:bg-slate-800/50 ${item.read ? "opacity-70" : ""}`}
                  >
                    <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${item.read ? "bg-transparent" : "bg-orange"}`} />
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-bold text-white">{item.title}</span>
                      {item.body && <span className="mt-0.5 line-clamp-2 block text-xs text-slate-400">{item.body}</span>}
                      <span className="mt-1 block text-[11px] text-amber-200/70">{ago(item.created_at)}</span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
