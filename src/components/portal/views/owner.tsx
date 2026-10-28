import Link from "next/link";
import { auditAction, auditEntity, AUDIT_ENTITY } from "@/lib/audit-labels";
import { formatRupiah } from "@/lib/content";
import { EXPENSE_LABEL, isPeriod, PERIODS, PROGRAM_STATUS, type PeriodKey } from "@/lib/ops";
import {
  addMonths,
  AUDIT_PAGE,
  auditFilters,
  auditLog,
  cashflow,
  COMPLETION_ATTENDANCE,
  dashboard,
  expensesBetween,
  incomeBetween,
  isMonthKey,
  listPrograms,
  listStaff,
  monthKey,
  monthLabel,
  monthStart,
  type CashMonth,
} from "@/lib/owner";
import { ROLE_LABEL } from "@/lib/roles";
import type { Viewer } from "@/lib/session";
import { Badge, EmptyState, formatDateTime, Notice, greeting, PageHeader, Panel, Tabs } from "../ui";
import { AuditActorSelect } from "./audit-actor-select";
import { ExpenseActions, ExpenseForm, ProgramForm, StaffCreateButton, StaffEditButton } from "./owner-forms";

// Menu Owner: dashboard bisnis, staf dan role, program dan harga, keuangan, audit log.

const pct = (n: number, d: number) => (d ? Math.round((n / d) * 100) : 0);
const todayWib = () => new Date(Date.now() + 7 * 3600_000).toISOString().slice(0, 10);

// Warna dua seri (divalidasi untuk buta warna di latar portal gelap): pemasukan oranye, pengeluaran biru.
const INCOME = "#D96A12";
const EXPENSE = "#4A86D0";

function Stat({ value, label, hint }: { value: string; label: string; hint?: string }) {
  return (
    <div className="lp-card-soft p-4">
      <p className="text-2xl font-black text-white">{value}</p>
      <p className="text-xs font-bold text-amber-200/90">{label}</p>
      {hint && <p className="mt-1 text-[11px] text-slate-400">{hint}</p>}
    </div>
  );
}

function shortMonth(key: string) {
  return new Intl.DateTimeFormat("id-ID", { month: "short", timeZone: "Asia/Jakarta" }).format(monthStart(key));
}

// Batang berpasangan per bulan; detail angka ada di tooltip dan di tabel keuangan.
function CashChart({ months }: { months: CashMonth[] }) {
  const max = Math.max(1, ...months.flatMap((m) => [m.income, m.expense]));
  return (
    <figure>
      <div className="mb-3 flex flex-wrap gap-4 text-xs text-amber-100">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm" style={{ background: INCOME }} /> Pemasukan
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm" style={{ background: EXPENSE }} /> Pengeluaran
        </span>
      </div>
      <div className="flex h-44 items-end gap-3 border-b border-orange/20 sm:gap-5" role="img" aria-label="Pemasukan dan pengeluaran per bulan">
        {months.map((m) => (
          <div key={m.key} className="group flex h-full flex-1 flex-col justify-end">
            <div className="flex h-full items-end justify-center gap-0.5">
              {[
                { v: m.income, c: INCOME, l: "Pemasukan" },
                { v: m.expense, c: EXPENSE, l: "Pengeluaran" },
              ].map((b) => (
                <div
                  key={b.l}
                  title={`${monthLabel(m.key)} · ${b.l}: ${formatRupiah(b.v)}`}
                  className="w-full max-w-6 rounded-t-[4px] transition-opacity group-hover:opacity-90"
                  style={{ height: `${Math.max(b.v ? 2 : 0, (b.v / max) * 100)}%`, background: b.c }}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
      <div className="mt-2 flex gap-3 text-center text-[11px] text-slate-400 sm:gap-5">
        {months.map((m) => (
          <span key={m.key} className="flex-1">
            {shortMonth(m.key)}
          </span>
        ))}
      </div>
    </figure>
  );
}

// ---------------------------------------------------------------------------
// Beranda: dashboard bisnis
// ---------------------------------------------------------------------------

export async function OwnerHome({ viewer, params }: { viewer: Viewer; params: Record<string, string | undefined> }) {
  const period: PeriodKey = isPeriod(params.periode) ? params.periode : "bulan";
  const d = await dashboard(period);
  const firstName = (viewer.fullName || viewer.email).split(/[\s@]/)[0];
  const f = d.funnel;
  const backupOld = !d.lastBackup || Date.now() - Date.parse(d.lastBackup) > 30 * 86400_000;
  const steps = [
    { label: "Mendaftar akun", n: f.registered },
    { label: "Menyelesaikan placement", n: f.placed },
    { label: "Memilih kelas", n: f.enrolled },
    { label: "Membayar", n: f.paid },
  ];
  return (
    <div className="fade-in space-y-6">
      <PageHeader title={greeting(firstName)} subtitle="Ringkasan bisnis Milestone English." />
      <Tabs tabs={Object.entries(PERIODS).map(([k, label]) => ({ key: k, label, href: `/portal/owner?periode=${k}` }))} active={period} />
      {backupOld && (
        <Notice>
          {d.lastBackup ? `Backup terakhir ${formatDateTime(d.lastBackup)}.` : "Belum pernah backup."}{" "}
          <Link href="/portal/owner/pengaturan#backup" className="underline">
            Unduh backup sekarang →
          </Link>
        </Notice>
      )}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat value={String(d.activeStudents)} label="Siswa aktif" hint="Sedang mengikuti kelas" />
        <Stat value={formatRupiah(d.revenue)} label={`Pendapatan · ${PERIODS[period].toLowerCase()}`} hint={`Pengeluaran ${formatRupiah(d.expense)}`} />
        <Stat value={String(d.runningBatches)} label="Batch berjalan" hint={`${d.openBatches} batch buka pendaftaran`} />
        <Stat
          value={d.completion.finished ? `${pct(d.completion.completed, d.completion.finished)}%` : "-"}
          label="Tingkat penyelesaian"
          hint={d.completion.finished ? `${d.completion.completed} dari ${d.completion.finished} siswa hadir ≥ ${COMPLETION_ATTENDANCE * 100}%` : "Belum ada batch selesai di periode ini"}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Panel title="Konversi pendaftar">
          <p className="mb-4 text-xs text-slate-400">Akun siswa yang dibuat {PERIODS[period].toLowerCase()} dan sejauh mana langkahnya.</p>
          {f.registered === 0 ? (
            <EmptyState icon="users" title="Belum ada pendaftar di periode ini" />
          ) : (
            <ol className="space-y-3">
              {steps.map((s) => (
                <li key={s.label}>
                  <div className="mb-1 flex justify-between text-sm">
                    <span className="font-bold text-amber-50">{s.label}</span>
                    <span className="font-black text-white">
                      {s.n} <span className="text-xs font-bold text-slate-400">({pct(s.n, f.registered)}%)</span>
                    </span>
                  </div>
                  <div className="h-2 rounded-full bg-navy-dark">
                    <div className="h-2 rounded-full" style={{ width: `${pct(s.n, f.registered)}%`, background: INCOME }} />
                  </div>
                </li>
              ))}
            </ol>
          )}
        </Panel>
        <Panel title="Pemasukan & pengeluaran 6 bulan">
          <CashChart months={d.months} />
          <Link href="/portal/owner/keuangan" className="mt-3 inline-block text-xs font-black text-orange underline">
            Lihat rincian keuangan →
          </Link>
        </Panel>
      </div>

      <Panel title={`Pendapatan per program · ${PERIODS[period].toLowerCase()}`}>
        {d.byProgram.length === 0 ? (
          <EmptyState icon="wallet" title="Belum ada pembayaran di periode ini" />
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-orange/30 text-left text-xs text-amber-200/80">
                <th className="py-2 font-black">Program</th>
                <th className="py-2 text-right font-black">Siswa membayar</th>
                <th className="py-2 text-right font-black">Pendapatan</th>
              </tr>
            </thead>
            <tbody>
              {d.byProgram.map((p) => (
                <tr key={p.name} className="border-b border-orange/10">
                  <td className="py-2.5 font-bold text-white">{p.name}</td>
                  <td className="py-2.5 text-right text-amber-50">{p.students}</td>
                  <td className="py-2.5 text-right font-black text-amber-50">{formatRupiah(p.revenue)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Panel>
      {d.openTickets > 0 && <p className="text-xs text-slate-400">{d.openTickets} tiket bantuan sedang menunggu balasan Admin.</p>}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Staf dan role
// ---------------------------------------------------------------------------

export async function OwnerStaff({ viewer }: { viewer: Viewer }) {
  const staff = await listStaff();
  return (
    <div className="fade-in space-y-6">
      <PageHeader title="Staf & Role" subtitle="Daftar akun tim Milestone. Klik Ubah untuk mengatur role, password, dan status akun." action={<StaffCreateButton />} />
      <Panel title={`Daftar staf (${staff.length})`}>
        <ul className="divide-y divide-orange/10">
          {staff.map((s) => (
            <li key={s.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
              <span>
                <span className="block font-black text-white">
                  {s.full_name || s.email}
                  {s.id === viewer.id && <span className="ml-2 text-xs font-bold text-amber-200/70">(kamu)</span>}
                </span>
                <span className="block text-xs text-amber-200/70">{s.email}</span>
              </span>
              <span className="flex flex-wrap items-center gap-2">
                {s.roles.map((r) => (
                  <Badge key={r} tone="orange">
                    {ROLE_LABEL[r]}
                  </Badge>
                ))}
                {s.status === "inactive" && <Badge tone="red">Nonaktif</Badge>}
                {s.must_change_password && s.status === "active" && <Badge tone="amber">Belum ganti password</Badge>}
                {s.id !== viewer.id && <StaffEditButton staff={s} />}
              </span>
            </li>
          ))}
        </ul>
      </Panel>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Program dan harga
// ---------------------------------------------------------------------------

export async function OwnerPrograms() {
  const programs = await listPrograms();
  const tone = { draft: "slate", active: "green", archived: "red" } as const;
  return (
    <div className="fade-in space-y-6">
      <PageHeader title="Program & Harga" subtitle="Harga, status buka/tutup, dan isi program di katalog website." />
      <Notice>Perubahan harga hanya berlaku untuk invoice baru. Program berstatus Tutup tidak tampil di website dan tidak bisa dibuka batch baru.</Notice>
      <ul className="space-y-3">
        {programs.map((p) => (
          <li key={p.id}>
            <details className="group workspace-panel">
              <summary className="flex cursor-pointer list-none flex-wrap items-center justify-between gap-3 px-5 py-4">
                <span>
                  <span className="text-xs font-black text-amber-200/80">{p.code}</span>
                  <span className="ml-3 font-black text-white">{p.name}</span>
                  <span className="ml-3 text-xs text-slate-400">{p.category}</span>
                </span>
                <span className="flex items-center gap-3">
                  <span className="font-black text-amber-50">{formatRupiah(p.price_idr)}</span>
                  <Badge tone={tone[p.status]}>{PROGRAM_STATUS[p.status].split(" (")[0]}</Badge>
                  <span className="text-xs text-orange group-open:hidden">Ubah ▾</span>
                </span>
              </summary>
              <div className="border-t border-orange/15 px-5 py-5">
                <ProgramForm id={p.id} initial={p} />
              </div>
            </details>
          </li>
        ))}
      </ul>
      <Panel title="Tambah program baru">
        <p className="mb-4 text-sm text-slate-400">Program baru mulai sebagai draf. Buka setelah Academic Lead menyiapkan kurikulum dan rubriknya.</p>
        <ProgramForm
          id={null}
          initial={{ code: "", name: "", category: "", entry_level: "", duration_label: "", capacity: 6, price_idr: 0, outcome: "", evidence: "", featured: false, status: "draft", sort_order: programs.length + 1 }}
        />
      </Panel>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Keuangan
// ---------------------------------------------------------------------------

export async function OwnerFinance({ params }: { params: Record<string, string | undefined> }) {
  const current = monthKey();
  const month = isMonthKey(params.bulan) && params.bulan <= current ? params.bulan : current;
  const from = monthStart(month);
  const to = monthStart(addMonths(month, 1));
  const [income, expenses, months] = await Promise.all([incomeBetween(from, to), expensesBetween(from, to), cashflow(month, 12)]);
  const totalIn = income.reduce((n, r) => n + r.amount_idr, 0);
  const totalOut = expenses.reduce((n, r) => n + r.amount_idr, 0);
  const yearFrom = addMonths(month, -11);
  return (
    <div className="fade-in space-y-6">
      <PageHeader
        title="Keuangan"
        subtitle="Pemasukan tercatat otomatis dari pembayaran yang diverifikasi; pengeluaran dicatat manual."
        action={
          <div className="flex flex-wrap gap-2">
            <a href={`/api/owner/keuangan?dari=${month}&sampai=${month}`} className="rounded-full border border-orange/40 px-4 py-2 text-xs font-black text-orange hover:bg-orange/10">
              Ekspor CSV bulan ini
            </a>
            <a href={`/api/owner/keuangan?dari=${yearFrom}&sampai=${month}`} className="rounded-full border border-orange/40 px-4 py-2 text-xs font-black text-orange hover:bg-orange/10">
              Ekspor CSV 12 bulan
            </a>
          </div>
        }
      />
      <div className="flex items-center gap-3">
        <Link href={`/portal/owner/keuangan?bulan=${addMonths(month, -1)}`} className="rounded-full border border-orange/30 px-3 py-1.5 text-xs font-black text-amber-100 hover:border-orange" aria-label="Bulan sebelumnya">
          ←
        </Link>
        <h2 className="text-lg font-black capitalize text-white">{monthLabel(month)}</h2>
        {month < current && (
          <Link href={`/portal/owner/keuangan?bulan=${addMonths(month, 1)}`} className="rounded-full border border-orange/30 px-3 py-1.5 text-xs font-black text-amber-100 hover:border-orange" aria-label="Bulan berikutnya">
            →
          </Link>
        )}
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <Stat value={formatRupiah(totalIn)} label="Pemasukan" hint={`${income.length} pembayaran`} />
        <Stat value={formatRupiah(totalOut)} label="Pengeluaran" hint={`${expenses.length} catatan`} />
        <Stat value={formatRupiah(totalIn - totalOut)} label="Selisih (arus kas)" />
      </div>

      <Panel title="Catat pengeluaran">
        <ExpenseForm id={null} today={todayWib()} />
      </Panel>

      <div className="grid gap-6 xl:grid-cols-2">
        <Panel title="Pemasukan">
          {income.length === 0 ? (
            <EmptyState icon="wallet" title="Belum ada pembayaran terverifikasi bulan ini" />
          ) : (
            <ul className="divide-y divide-orange/10 text-sm">
              {income.map((r) => (
                <li key={r.id} className="flex items-start justify-between gap-3 py-3">
                  <span>
                    <span className="block font-bold text-white">{r.student}</span>
                    <span className="block text-xs text-amber-200/70">
                      {r.number} · {r.description} · {formatDateTime(r.paid_at)}
                    </span>
                  </span>
                  <span className="shrink-0 font-black text-emerald-300">{formatRupiah(r.amount_idr)}</span>
                </li>
              ))}
            </ul>
          )}
        </Panel>
        <Panel title="Pengeluaran">
          {expenses.length === 0 ? (
            <EmptyState icon="wallet" title="Belum ada pengeluaran bulan ini" />
          ) : (
            <ul className="space-y-3 text-sm">
              {expenses.map((r) => (
                <li key={r.id}>
                  <details className="group rounded-xl border border-orange/15 open:border-orange/40">
                    <summary className="flex cursor-pointer list-none items-start justify-between gap-3 p-3">
                      <span>
                        <span className="block font-bold text-white">{r.description}</span>
                        <span className="block text-xs text-amber-200/70">
                          {EXPENSE_LABEL[r.category]} · {r.spent_on}
                          {r.receipt_path ? " · ada nota" : ""}
                        </span>
                      </span>
                      <span className="shrink-0 font-black text-rose-300">{formatRupiah(r.amount_idr)}</span>
                    </summary>
                    <div className="space-y-4 border-t border-orange/15 p-4">
                      <ExpenseForm id={r.id} today={todayWib()} initial={{ spentOn: r.spent_on, category: r.category, description: r.description, amount: r.amount_idr, hasReceipt: Boolean(r.receipt_path) }} />
                      <ExpenseActions id={r.id} hasReceipt={Boolean(r.receipt_path)} />
                    </div>
                  </details>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>

      <Panel title="Arus kas 12 bulan">
        <CashChart months={months} />
        <div className="mt-5 overflow-x-auto">
          <table className="w-full min-w-[480px] text-sm">
            <thead>
              <tr className="border-b border-orange/30 text-left text-xs text-amber-200/80">
                <th className="py-2 font-black">Bulan</th>
                <th className="py-2 text-right font-black">Pemasukan</th>
                <th className="py-2 text-right font-black">Pengeluaran</th>
                <th className="py-2 text-right font-black">Selisih</th>
              </tr>
            </thead>
            <tbody>
              {[...months].reverse().map((m) => (
                <tr key={m.key} className="border-b border-orange/10">
                  <td className="py-2 capitalize text-amber-50">
                    <Link href={`/portal/owner/keuangan?bulan=${m.key}`} className="hover:text-orange">
                      {monthLabel(m.key)}
                    </Link>
                  </td>
                  <td className="py-2 text-right text-amber-50">{formatRupiah(m.income)}</td>
                  <td className="py-2 text-right text-amber-50">{formatRupiah(m.expense)}</td>
                  <td className={`py-2 text-right font-black ${m.income - m.expense < 0 ? "text-rose-300" : "text-white"}`}>{formatRupiah(m.income - m.expense)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Audit log
// ---------------------------------------------------------------------------

export async function OwnerAudit({ params }: { params: Record<string, string | undefined> }) {
  const page = Math.max(1, Number(params.hal) || 1);
  const filter = { actor: params.oleh || undefined, entity: params.data || undefined, from: params.dari || undefined, to: params.sampai || undefined, page };
  const [{ rows, total }, { groups }] = await Promise.all([auditLog(filter), auditFilters()]);
  const pages = Math.max(1, Math.ceil(total / AUDIT_PAGE));
  const query = (p: number) => {
    const q = new URLSearchParams(Object.entries({ oleh: params.oleh, data: params.data, dari: params.dari, sampai: params.sampai, hal: String(p) }).filter(([, v]) => v) as [string, string][]);
    return `/portal/owner/audit?${q}`;
  };
  return (
    <div className="fade-in space-y-6">
      <PageHeader title="Audit Log" subtitle="Siapa mengubah apa dan kapan." />
      <Panel>
        <form className="grid gap-3 sm:grid-cols-5 sm:items-end" action="/portal/owner/audit">
          <label className="block text-xs font-bold text-amber-100">
            Oleh
            <AuditActorSelect groups={groups} value={params.oleh ?? ""} />
          </label>
          <label className="block text-xs font-bold text-amber-100">
            Jenis data
            <select name="data" defaultValue={params.data ?? ""} className="field mt-2">
              <option value="">Semua</option>
              {Object.entries(AUDIT_ENTITY).map(([k, l]) => (
                <option key={k} value={k}>
                  {l}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-xs font-bold text-amber-100">
            Dari tanggal
            <input type="date" name="dari" defaultValue={params.dari ?? ""} className="field mt-2" />
          </label>
          <label className="block text-xs font-bold text-amber-100">
            Sampai tanggal
            <input type="date" name="sampai" defaultValue={params.sampai ?? ""} className="field mt-2" />
          </label>
          <button className="btn-orange rounded-full px-5 py-2.5 text-sm">Terapkan</button>
        </form>
      </Panel>
      <Panel title={`${total} catatan`}>
        {rows.length === 0 ? (
          <EmptyState icon="shield" title="Tidak ada catatan untuk filter ini" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="border-b border-orange/30 text-left text-xs text-amber-200/80">
                  <th className="py-2 pr-3 font-black">Waktu</th>
                  <th className="py-2 pr-3 font-black">Oleh</th>
                  <th className="py-2 pr-3 font-black">Aksi</th>
                  <th className="py-2 font-black">Data</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-b border-orange/10 align-top">
                    <td className="whitespace-nowrap py-2.5 pr-3 text-xs text-amber-200/80">{formatDateTime(r.created_at)}</td>
                    <td className="py-2.5 pr-3 font-bold text-white">{r.actor}</td>
                    <td className="py-2.5 pr-3 text-amber-50">{auditAction(r.action)}</td>
                    <td className="py-2.5 text-xs text-amber-200/80">
                      {auditEntity(r.entity)}
                      {detailText(r.detail) && <span className="block text-slate-400">{detailText(r.detail)}</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {pages > 1 && (
          <div className="mt-4 flex items-center gap-3 text-xs">
            {page > 1 && (
              <Link href={query(page - 1)} className="font-black text-orange">
                ← Sebelumnya
              </Link>
            )}
            <span className="text-slate-400">
              Halaman {page} dari {pages}
            </span>
            {page < pages && (
              <Link href={query(page + 1)} className="font-black text-orange">
                Berikutnya →
              </Link>
            )}
          </div>
        )}
      </Panel>
    </div>
  );
}

const DETAIL_LABEL: Record<string, string> = {
  role: "role",
  code: "kode",
  price: "harga",
  price_from: "harga lama",
  status: "status",
  status_from: "status lama",
  amount: "nominal",
  description: "keterangan",
  email: "email",
  roles: "role",
  batch: "batch",
  version: "versi",
  reason: "alasan",
  students: "siswa",
};

function detailText(d: Record<string, unknown>) {
  return Object.entries(d)
    .filter(([k, v]) => DETAIL_LABEL[k] && v !== null && v !== undefined && v !== "")
    .map(([k, v]) => {
      const val = Array.isArray(v) ? v.map((x) => ROLE_LABEL[x as keyof typeof ROLE_LABEL] ?? x).join(", ") : k === "role" ? (ROLE_LABEL[v as keyof typeof ROLE_LABEL] ?? v) : typeof v === "number" && /price|amount/.test(k) ? formatRupiah(v) : String(v);
      return `${DETAIL_LABEL[k]}: ${val}`;
    })
    .join(" · ");
}
