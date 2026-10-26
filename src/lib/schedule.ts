// Jadwal batch dalam WIB (UTC+7, tanpa pergantian jam musim panas).

export const WEEKDAYS = [
  { value: 1, label: "Senin" },
  { value: 2, label: "Selasa" },
  { value: 3, label: "Rabu" },
  { value: 4, label: "Kamis" },
  { value: 5, label: "Jumat" },
  { value: 6, label: "Sabtu" },
  { value: 7, label: "Minggu" },
] as const;

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

// Jumlah sesi dan durasi per sesi dari label program, misalnya "4 minggu (8 × 60 mnt)".
export function parseDurationLabel(label: string): { sessions: number; minutes: number } | null {
  const m = label.match(/(\d+)\s*[×x]\s*(\d+)\s*mnt/i);
  return m ? { sessions: Number(m[1]), minutes: Number(m[2]) } : null;
}

// Hari dalam minggu (1 = Senin ... 7 = Minggu) dari tanggal "YYYY-MM-DD".
function isoWeekday(date: string) {
  const d = new Date(`${date}T00:00:00Z`).getUTCDay();
  return d === 0 ? 7 : d;
}

function addDays(date: string, days: number) {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export type GeneratedSession = { seq: number; date: string; starts_at: string };

// Sesi berurutan mulai dari tanggal mulai (ikut dihitung bila harinya cocok).
export function generateSessions(input: { startDate: string; weekdays: number[]; time: string; count: number }): GeneratedSession[] {
  const days = [...new Set(input.weekdays)].filter((d) => d >= 1 && d <= 7);
  if (!DATE_RE.test(input.startDate) || !TIME_RE.test(input.time) || !days.length || input.count < 1 || input.count > 200) return [];
  const out: GeneratedSession[] = [];
  for (let i = 0; out.length < input.count && i < 400 * 7; i++) {
    const date = addDays(input.startDate, i);
    if (days.includes(isoWeekday(date))) {
      out.push({ seq: out.length + 1, date, starts_at: new Date(`${date}T${input.time}:00+07:00`).toISOString() });
    }
  }
  return out;
}

export function scheduleLabel(weekdays: number[], time: string, minutes: number) {
  const names = WEEKDAYS.filter((d) => weekdays.includes(d.value)).map((d) => d.label);
  const list = names.length > 1 ? `${names.slice(0, -1).join(", ")} & ${names[names.length - 1]}` : (names[0] ?? "");
  const [h, m] = time.split(":").map(Number);
  const end = h * 60 + m + minutes;
  const fmt = (t: number) => `${String(Math.floor(t / 60) % 24).padStart(2, "0")}.${String(t % 60).padStart(2, "0")}`;
  return `${list} · ${fmt(h * 60 + m)}–${fmt(end)} WIB`;
}
