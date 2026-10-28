import { LEVEL_INFO } from "@/lib/placement/levels";

const ORDER = ["Pre-A1", "A1", "A2", "B1", "B2", "C1"];

// Penjelasan level CEFR yang bisa dibuka-tutup, dengan level yang sedang dibahas disorot.
export function LevelGuide({ current, withC1 = false }: { current?: string | null; withC1?: boolean }) {
  const levels = ORDER.filter((l) => withC1 || l !== "C1");
  return (
    <details className="group rounded-xl border border-orange/25 bg-navy/40 px-4 py-3 text-sm">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 font-bold text-amber-100">
        <span>
          Apa arti level ini?
          {current && LEVEL_INFO[current] && (
            <span className="ml-2 font-normal text-amber-200/80">
              {current} = {LEVEL_INFO[current].name}
            </span>
          )}
        </span>
        <span className="text-orange transition group-open:rotate-180">▾</span>
      </summary>
      <p className="mt-3 text-xs text-slate-400">Milestone memakai standar internasional CEFR, dari Pre-A1 (pemula) sampai {withC1 ? "C1" : "B2"}.</p>
      <ul className="mt-3 space-y-2">
        {levels.map((l) => (
          <li key={l} className={`flex gap-3 rounded-lg px-3 py-2 ${l === current ? "border border-orange/60 bg-orange/15" : ""}`}>
            <span className="w-14 shrink-0 font-black text-orange">{l}</span>
            <span className="text-amber-50">
              <span className="font-bold">{LEVEL_INFO[l].name}.</span> {LEVEL_INFO[l].text}
            </span>
          </li>
        ))}
      </ul>
    </details>
  );
}
