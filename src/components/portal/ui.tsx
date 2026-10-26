import Link from "next/link";
import { Icon } from "@/components/icons";
import type { IconName } from "@/lib/roles";

export function PageHeader({ title, subtitle, action }: { title: string; subtitle?: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-2xl font-black text-orange sm:text-3xl">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-slate-400">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

export function Panel({ title, children, className = "" }: { title?: string; children: React.ReactNode; className?: string }) {
  return (
    <section className={`workspace-panel p-5 sm:p-6 ${className}`}>
      {title && <h2 className="mb-4 text-sm font-black uppercase tracking-[0.18em] text-amber-200/80">{title}</h2>}
      {children}
    </section>
  );
}

const TONE = {
  orange: "border-orange/50 bg-orange/15 text-orange",
  green: "border-emerald-400/40 bg-emerald-500/10 text-emerald-300",
  amber: "border-amber-400/40 bg-amber-500/10 text-amber-200",
  slate: "border-slate-500/40 bg-slate-500/10 text-slate-300",
  red: "border-rose-400/40 bg-rose-500/10 text-rose-300",
} as const;

export function Badge({ tone = "slate", children }: { tone?: keyof typeof TONE; children: React.ReactNode }) {
  return <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-black ${TONE[tone]}`}>{children}</span>;
}

export function EmptyState({ icon = "check", title, text }: { icon?: IconName; title: string; text?: string }) {
  return (
    <div className="flex flex-col items-center rounded-2xl border border-dashed border-orange/30 px-6 py-10 text-center">
      <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-orange/15 text-orange">
        <Icon name={icon} />
      </span>
      <p className="mt-4 font-black text-white">{title}</p>
      {text && <p className="mt-1 max-w-md text-sm text-slate-400">{text}</p>}
    </div>
  );
}

export function Tabs({ tabs, active }: { tabs: { href: string; label: string; count?: number; key: string }[]; active: string }) {
  return (
    <nav className="flex flex-wrap gap-2">
      {tabs.map((t) => (
        <Link
          key={t.key}
          href={t.href}
          className={`rounded-full border px-4 py-2 text-xs font-black transition ${t.key === active ? "border-orange bg-orange text-white" : "border-orange/30 text-amber-100 hover:border-orange"}`}
        >
          {t.label}
          {t.count !== undefined && <span className="ml-1.5 opacity-80">({t.count})</span>}
        </Link>
      ))}
    </nav>
  );
}

export function Notice({ tone = "amber", children }: { tone?: "amber" | "red" | "green"; children: React.ReactNode }) {
  const cls = tone === "red" ? TONE.red : tone === "green" ? TONE.green : TONE.amber;
  return <p className={`rounded-xl border px-4 py-3 text-sm font-bold ${cls}`}>{children}</p>;
}

const DATE_FMT = new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Jakarta" });

export function formatDateTime(iso: string | null | undefined) {
  return iso ? `${DATE_FMT.format(new Date(iso))} WIB` : "-";
}
