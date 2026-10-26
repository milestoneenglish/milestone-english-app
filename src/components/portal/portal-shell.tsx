"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { signOut } from "@/app/portal/actions";
import { Icon } from "@/components/icons";
import { Logo } from "@/components/logo";
import { ROLE_LABEL, ROLE_MENU, type Role } from "@/lib/roles";

type Props = { role: Role; roles: Role[]; name: string; email: string; children: React.ReactNode };

function Sidebar({ role, roles, onNavigate }: { role: Role; roles: Role[]; onNavigate?: () => void }) {
  const pathname = usePathname();
  const base = `/portal/${role}`;

  return (
    <div className="flex h-full flex-col">
      <div className="mb-5 px-1">
        <Logo className="h-8 w-auto" plate />
      </div>

      {roles.length > 1 ? (
        <details className="group relative mb-5">
          <summary className="flex cursor-pointer list-none items-center justify-between rounded-xl border border-slate-700/60 bg-[#111C33] px-3.5 py-2.5 text-xs font-bold text-white hover:border-orange/50">
            {ROLE_LABEL[role]}
            <Icon name="chevron" className="h-4 w-4 text-slate-400 transition group-open:rotate-180" />
          </summary>
          <div className="absolute left-0 right-0 z-20 mt-2 space-y-1 rounded-xl border border-orange/30 bg-navy-dark p-2 shadow-2xl">
            {roles.map((r) => (
              <Link
                key={r}
                href={`/portal/${r}`}
                onClick={onNavigate}
                className={`block rounded-lg px-3 py-2 text-xs font-bold ${r === role ? "bg-orange/15 text-orange" : "text-slate-300 hover:bg-slate-800/60 hover:text-white"}`}
              >
                {ROLE_LABEL[r]}
              </Link>
            ))}
          </div>
        </details>
      ) : (
        <div className="mb-5 rounded-xl border border-slate-700/60 bg-[#111C33] px-3.5 py-2.5 text-xs font-bold text-white">{ROLE_LABEL[role]}</div>
      )}

      <nav className="flex-1 space-y-1.5 overflow-y-auto pr-1" aria-label={`Menu ${ROLE_LABEL[role]}`}>
        {ROLE_MENU[role].map((item) => {
          const href = item.slug ? `${base}/${item.slug}` : base;
          const active = pathname === href;
          return (
            <Link
              key={item.label}
              href={href}
              onClick={onNavigate}
              aria-current={active ? "page" : undefined}
              className={`group flex w-full items-center gap-3.5 rounded-xl border px-4 py-2.5 text-xs transition ${
                active ? "border-orange-400/40 bg-[#F97316] font-bold text-white shadow-lg shadow-orange-500/25" : "border-transparent font-medium text-slate-400 hover:bg-slate-800/40 hover:text-white"
              }`}
            >
              <Icon name={item.icon} className="h-4 w-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="mt-auto space-y-1 border-t border-slate-800/80 pt-4">
        <form action={signOut}>
          <button className="flex w-full items-center gap-3.5 rounded-xl px-4 py-2 text-xs font-medium text-slate-400 transition hover:bg-rose-500/10 hover:text-rose-400">
            <Icon name="logout" className="h-4 w-4" /> Keluar
          </button>
        </form>
      </div>
    </div>
  );
}

export function PortalShell({ role, roles, name, email, children }: Props) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const current = ROLE_MENU[role].find((m) => pathname === (m.slug ? `/portal/${role}/${m.slug}` : `/portal/${role}`));
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join("");

  return (
    <div className="flex h-screen overflow-hidden bg-navy-dark text-slate-100">
      <aside className="hidden h-full w-64 shrink-0 border-r border-slate-800/80 bg-navy-side p-5 lg:block xl:w-72">
        <Sidebar role={role} roles={roles} />
      </aside>

      {open && (
        <div className="fixed inset-0 z-50 flex lg:hidden">
          <div className="fixed inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setOpen(false)} />
          <div className="relative z-10 h-full w-72 max-w-[80vw] border-r border-slate-800 bg-navy-side p-5">
            <button onClick={() => setOpen(false)} className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-full bg-slate-800 text-slate-300" aria-label="Tutup menu">
              <Icon name="close" className="h-4 w-4" />
            </button>
            <Sidebar role={role} roles={roles} onNavigate={() => setOpen(false)} />
          </div>
        </div>
      )}

      <div className="flex h-full flex-1 flex-col overflow-hidden">
        <header className="z-10 flex h-16 shrink-0 items-center justify-between border-b border-slate-800/60 bg-navy-side/80 px-4 backdrop-blur-md sm:px-8">
          <div className="flex items-center gap-3">
            <button onClick={() => setOpen(true)} className="rounded-xl bg-slate-800/60 p-2 text-slate-300 hover:text-white lg:hidden" aria-label="Buka menu">
              <Icon name="menu" className="h-5 w-5" />
            </button>
            <div className="flex items-center gap-2 text-xs">
              <span className="hidden font-medium text-slate-400 sm:inline">{ROLE_LABEL[role]}</span>
              <span className="hidden text-slate-600 sm:inline">/</span>
              <span className="font-bold text-slate-100">{current?.label ?? "Beranda"}</span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="hidden text-right sm:block">
              <p className="text-xs font-bold text-white">{name}</p>
              <p className="text-[11px] text-slate-400">{email}</p>
            </div>
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-orange text-xs font-black text-navy">{initials || "ME"}</span>
          </div>
        </header>
        <main className="flex-1 overflow-y-auto p-4 sm:p-8">{children}</main>
      </div>
    </div>
  );
}
