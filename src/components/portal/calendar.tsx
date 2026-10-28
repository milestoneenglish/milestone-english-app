import Link from "next/link";

// Kalender bulanan (WIB) untuk jadwal sesi. Di layar lebar tampil sebagai kotak 7 hari,
// di HP berubah menjadi daftar hari yang ada sesinya agar tetap terbaca.

export type CalendarTone = "orange" | "green" | "amber" | "red" | "slate";
export type CalendarEvent = { id: string; at: string; title: string; detail?: string; tone: CalendarTone; status?: string; href?: string };

const WIB_MS = 7 * 3600_000;
const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;
const DAY_NAMES = ["Sen", "Sel", "Rab", "Kam", "Jum", "Sab", "Min"];
const MONTH_FMT = new Intl.DateTimeFormat("id-ID", { month: "long", year: "numeric", timeZone: "UTC" });
const DAY_FMT = new Intl.DateTimeFormat("id-ID", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" });
const TIME_FMT = new Intl.DateTimeFormat("id-ID", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Jakarta" });

const CHIP: Record<CalendarTone, string> = {
  orange: "border-orange/60 bg-orange/15 text-orange",
  green: "border-emerald-400/50 bg-emerald-500/10 text-emerald-300",
  amber: "border-amber-400/50 bg-amber-500/10 text-amber-200",
  red: "border-rose-400/50 bg-rose-500/10 text-rose-300",
  slate: "border-slate-500/50 bg-slate-500/10 text-slate-300",
};
const DOT: Record<CalendarTone, string> = { orange: "bg-orange", green: "bg-emerald-400", amber: "bg-amber-300", red: "bg-rose-400", slate: "bg-slate-400" };

/** Tanggal WIB "YYYY-MM-DD" dari waktu ISO. */
export const wibDate = (iso: string) => new Date(Date.parse(iso) + WIB_MS).toISOString().slice(0, 10);

export function shiftMonth(key: string, n: number) {
  const [y, m] = key.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + n, 1));
  return d.toISOString().slice(0, 7);
}

/** Bulan yang ditampilkan: dari URL bila valid; kalau tidak, bulan sesi berikutnya (atau sesi terakhir, atau bulan ini). */
export function calendarMonth(param: string | undefined, events: { at: string }[], now = Date.now()) {
  if (param && MONTH_RE.test(param)) return param;
  const sorted = [...events].sort((a, b) => a.at.localeCompare(b.at));
  const next = sorted.find((e) => Date.parse(e.at) >= now) ?? sorted.at(-1);
  return (next ? wibDate(next.at) : wibDate(new Date(now).toISOString())).slice(0, 7);
}

/** Kotak-kotak bulan, mulai Senin. Hari di luar bulan bernilai null. */
export function monthGrid(key: string): (string | null)[] {
  const [y, m] = key.split("-").map(Number);
  const first = new Date(Date.UTC(y, m - 1, 1));
  const days = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const lead = (first.getUTCDay() + 6) % 7;
  const cells: (string | null)[] = Array.from({ length: lead }, () => null);
  for (let d = 1; d <= days; d++) cells.push(`${key}-${String(d).padStart(2, "0")}`);
  while (cells.length % 7) cells.push(null);
  return cells;
}

function Chip({ e }: { e: CalendarEvent }) {
  const body = (
    <>
      <span className="font-black">{TIME_FMT.format(new Date(e.at))}</span> {e.title}
    </>
  );
  const cls = `block truncate rounded-md border px-1.5 py-0.5 text-[11px] leading-tight ${CHIP[e.tone]}`;
  const tip = [e.title, e.detail, e.status].filter(Boolean).join(" · ");
  return e.href ? (
    <Link href={e.href} className={`${cls} hover:brightness-125`} title={tip}>
      {body}
    </Link>
  ) : (
    <span className={cls} title={tip}>
      {body}
    </span>
  );
}

export function MonthCalendar({
  events,
  month,
  hrefFor,
  legend,
  now = Date.now(),
}: {
  events: CalendarEvent[];
  month: string;
  hrefFor: (month: string) => string;
  legend: { tone: CalendarTone; label: string }[];
  now?: number;
}) {
  const today = wibDate(new Date(now).toISOString());
  const byDay = new Map<string, CalendarEvent[]>();
  for (const e of [...events].sort((a, b) => a.at.localeCompare(b.at))) {
    const d = wibDate(e.at);
    byDay.set(d, [...(byDay.get(d) ?? []), e]);
  }
  const cells = monthGrid(month);
  const inMonth = [...byDay.entries()].filter(([d]) => d.startsWith(month));
  const title = MONTH_FMT.format(new Date(`${month}-01T00:00:00Z`));
  const nav = "flex h-9 w-9 items-center justify-center rounded-full border border-orange/40 text-orange hover:bg-orange/10";

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Link href={hrefFor(shiftMonth(month, -1))} className={nav} aria-label="Bulan sebelumnya">
            ‹
          </Link>
          <h2 className="min-w-40 text-center text-lg font-black capitalize text-white">{title}</h2>
          <Link href={hrefFor(shiftMonth(month, 1))} className={nav} aria-label="Bulan berikutnya">
            ›
          </Link>
        </div>
        {month !== today.slice(0, 7) && (
          <Link href={hrefFor(today.slice(0, 7))} className="text-xs font-black text-orange hover:underline">
            Ke bulan ini
          </Link>
        )}
      </div>

      <div className="hidden sm:block">
        <div className="grid grid-cols-7 gap-1 pb-1 text-center text-[11px] font-black uppercase tracking-wider text-amber-200/70">
          {DAY_NAMES.map((d) => (
            <span key={d}>{d}</span>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {cells.map((day, i) => {
            const list = day ? (byDay.get(day) ?? []) : [];
            return (
              <div
                key={day ?? `x${i}`}
                className={`min-h-24 rounded-xl border p-1.5 ${day ? (day === today ? "border-orange bg-orange/5" : "border-orange/15") : "border-transparent"}`}
              >
                {day && (
                  <>
                    <p className={`mb-1 text-right text-xs font-black ${day === today ? "text-orange" : "text-amber-100/70"}`}>{Number(day.slice(8))}</p>
                    <div className="space-y-1">
                      {list.slice(0, 3).map((e) => (
                        <Chip key={e.id} e={e} />
                      ))}
                      {list.length > 3 && <p className="text-[10px] font-bold text-amber-200/70">+{list.length - 3} lagi</p>}
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <ul className="space-y-3 sm:hidden">
        {inMonth.length === 0 && <li className="rounded-xl border border-dashed border-orange/30 p-4 text-center text-sm text-slate-400">Tidak ada sesi di bulan ini.</li>}
        {inMonth.map(([day, list]) => (
          <li key={day} className={`rounded-xl border p-3 ${day === today ? "border-orange" : "border-orange/20"}`}>
            <p className="mb-2 text-xs font-black capitalize text-amber-200/80">{DAY_FMT.format(new Date(`${day}T00:00:00Z`))}</p>
            <ul className="space-y-2">
              {list.map((e) => {
                const row = (
                  <>
                    <span className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${DOT[e.tone]}`} />
                    <span className="min-w-0">
                      <span className="block text-sm font-bold text-white">
                        {TIME_FMT.format(new Date(e.at))} · {e.title}
                      </span>
                      {(e.detail || e.status) && <span className="block text-xs text-amber-200/70">{[e.detail, e.status].filter(Boolean).join(" · ")}</span>}
                    </span>
                  </>
                );
                return (
                  <li key={e.id}>
                    {e.href ? (
                      <Link href={e.href} className="flex gap-2">
                        {row}
                      </Link>
                    ) : (
                      <div className="flex gap-2">{row}</div>
                    )}
                  </li>
                );
              })}
            </ul>
          </li>
        ))}
      </ul>

      <ul className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-amber-200/80" aria-label="Keterangan warna">
        {legend.map((l) => (
          <li key={l.tone} className="inline-flex items-center gap-1.5">
            <span className={`h-2.5 w-2.5 rounded-full ${DOT[l.tone]}`} /> {l.label}
          </li>
        ))}
      </ul>
    </div>
  );
}
