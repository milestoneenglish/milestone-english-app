import Link from "next/link";
import { isPeriod, OBSERVATION_ASPECTS, OBSERVATION_SCALE, PERIODS, type ObservationAspect, type PeriodKey } from "@/lib/ops";
import { observableBatches, pendingSurveys, tutorDetail, tutorQuality, type Ratio } from "@/lib/quality";
import { Badge, EmptyState, Notice, PageHeader, Panel, Tabs } from "../ui";
import { ObservationForm, SurveyForm } from "./quality-forms";

// Kualitas tutor (Academic Lead dan Owner): ketepatan waktu otomatis, observasi kelas, rekap survei siswa.

const pct = (r: Ratio) => (r.total ? Math.round((r.onTime / r.total) * 100) : null);
const num = (n: number | null, digits = 1) => (n === null ? "-" : n.toFixed(digits).replace(".", ","));

function RatioCell({ r }: { r: Ratio }) {
  const p = pct(r);
  if (p === null) return <span className="text-slate-500">-</span>;
  return (
    <span className={`font-black ${p >= 90 ? "text-emerald-300" : p >= 70 ? "text-amber-200" : "text-rose-300"}`} title={`${r.onTime} dari ${r.total} tepat waktu`}>
      {p}%<span className="ml-1 text-[11px] font-normal text-slate-400">({r.total})</span>
    </span>
  );
}

const todayWib = () => new Date(Date.now() + 7 * 3600_000).toISOString().slice(0, 10);

export async function TutorQualityPage({ role, params }: { role: "lead" | "owner"; params: Record<string, string | undefined> }) {
  const base = `/portal/${role}/kualitas-tutor`;
  if (params.id) return <TutorQualityDetail id={params.id} base={base} />;
  const period: PeriodKey = isPeriod(params.periode) ? params.periode : "3bulan";
  const rows = await tutorQuality(period);
  return (
    <div className="fade-in space-y-6">
      <PageHeader title="Kualitas Tutor" subtitle="Ketepatan waktu dihitung otomatis dari data kelas; observasi dan survei siswa melengkapinya." />
      <Tabs tabs={Object.entries(PERIODS).map(([k, label]) => ({ key: k, label, href: `${base}?periode=${k}` }))} active={period} />
      <Panel>
        {rows.length === 0 ? (
          <EmptyState icon="users" title="Belum ada tutor" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] text-sm">
              <thead>
                <tr className="border-b border-orange/30 text-left text-xs text-amber-200/80">
                  <th className="py-2 pr-3 font-black">Tutor</th>
                  <th className="py-2 pr-3 font-black" title="Absensi diisi ≤ 24 jam setelah sesi">
                    Absensi
                  </th>
                  <th className="py-2 pr-3 font-black" title="Assessment terbit ≤ 48 jam setelah sesi assessment">
                    Assessment
                  </th>
                  <th className="py-2 pr-3 font-black" title="Laporan diajukan ≤ 3 hari setelah sesi terakhir">
                    Laporan
                  </th>
                  <th className="py-2 pr-3 font-black">Dikembalikan</th>
                  <th className="py-2 pr-3 font-black">Feedback tugas</th>
                  <th className="py-2 pr-3 font-black">Survei siswa</th>
                  <th className="py-2 font-black">Observasi</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.tutor.id} className="border-b border-orange/10">
                    <td className="py-3 pr-3">
                      <Link href={`${base}?id=${r.tutor.id}`} className="font-bold text-white hover:text-orange">
                        {r.tutor.full_name || r.tutor.email}
                      </Link>
                      <span className="block text-[11px] text-slate-400">{r.batches} batch</span>
                    </td>
                    <td className="py-3 pr-3">
                      <RatioCell r={r.attendance} />
                    </td>
                    <td className="py-3 pr-3">
                      <RatioCell r={r.assessment} />
                    </td>
                    <td className="py-3 pr-3">
                      <RatioCell r={r.report} />
                    </td>
                    <td className="py-3 pr-3 text-amber-50">{r.returned ? `${r.returned}×` : "-"}</td>
                    <td className="py-3 pr-3 text-amber-50">{r.feedbackCount ? `rata-rata ${num(r.feedbackHours, 0)} jam` : "-"}</td>
                    <td className="py-3 pr-3 text-amber-50">{r.survey.count ? `${num(r.survey.average)} / 5 (${r.survey.count})` : "-"}</td>
                    <td className="py-3 text-amber-50">{r.observation.count ? `${num(r.observation.average)} / 4 (${r.observation.count})` : r.observation.last ? "Di luar periode" : "Belum ada"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="mt-4 text-[11px] text-slate-400">
          Persentase = tepat waktu dari jumlah kejadian (angka dalam kurung). Absensi ≤ 24 jam setelah sesi; assessment ≤ 48 jam setelah sesi assessment (siswa susulan tidak dihitung); laporan ≤ 3
          hari setelah sesi terakhir. Feedback tugas = rata-rata jam dari pengumpulan sampai feedback terbit.
        </p>
      </Panel>
    </div>
  );
}

async function TutorQualityDetail({ id, base }: { id: string; base: string }) {
  const [d, batches] = await Promise.all([tutorDetail(id), observableBatches()]);
  if (!d) return <Notice tone="red">Tutor tidak ditemukan.</Notice>;
  const own = batches.filter((b) => b.tutorId === id).map((b) => ({ id: b.id, label: `${b.code} · ${b.program}${b.status === "completed" ? " (selesai)" : ""}` }));
  const maxDist = Math.max(1, ...d.survey.distribution);
  return (
    <div className="fade-in space-y-6">
      <PageHeader
        title={d.tutor.full_name || d.tutor.email}
        subtitle={`${d.batches.length} batch · ${d.tutor.email}`}
        action={
          <Link href={base} className="text-sm font-black text-orange">
            ← Semua tutor
          </Link>
        }
      />
      <div className="grid gap-6 lg:grid-cols-2">
        <Panel title="Survei siswa (rekap)">
          {d.survey.count === 0 ? (
            <EmptyState icon="star" title="Belum ada penilaian siswa" text="Siswa menilai tutor setelah program selesai." />
          ) : (
            <>
              <p className="text-3xl font-black text-white">
                {num(d.survey.average)} <span className="text-base text-amber-200/80">/ 5 dari {d.survey.count} siswa</span>
              </p>
              <ul className="mt-4 space-y-1.5">
                {[5, 4, 3, 2, 1].map((n) => (
                  <li key={n} className="grid grid-cols-[24px_1fr_28px] items-center gap-2 text-xs text-amber-100">
                    <span className="font-black">{n}</span>
                    <span className="h-2 rounded-full bg-navy-dark">
                      <span className="block h-2 rounded-full bg-orange" style={{ width: `${(d.survey.distribution[n - 1] / maxDist) * 100}%` }} />
                    </span>
                    <span className="text-right">{d.survey.distribution[n - 1]}</span>
                  </li>
                ))}
              </ul>
              {d.survey.comments.length > 0 && (
                <ul className="mt-5 space-y-2">
                  {d.survey.comments.map((c, i) => (
                    <li key={i} className="rounded-xl border border-orange/15 p-3 text-sm italic text-amber-50">
                      &ldquo;{c}&rdquo;
                    </li>
                  ))}
                </ul>
              )}
              <p className="mt-3 text-[11px] text-slate-400">Tanpa nama siswa, batch, atau tanggal.</p>
            </>
          )}
        </Panel>
        <Panel title="Isi observasi kelas">
          <ObservationForm batches={own} today={todayWib()} />
        </Panel>
      </div>
      <Panel title={`Riwayat observasi (${d.observations.length})`}>
        {d.observations.length === 0 ? (
          <EmptyState icon="check" title="Belum ada observasi" />
        ) : (
          <ul className="space-y-4">
            {d.observations.map((o) => (
              <li key={o.id} className="rounded-2xl border border-orange/20 p-4">
                <p className="text-xs font-black text-amber-200/90">
                  {o.observed_on} · batch {o.batch} · oleh {o.observer || "-"}
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {(Object.keys(OBSERVATION_ASPECTS) as ObservationAspect[]).map((k) => (
                    <Badge key={k} tone={o.scores[k] >= 3 ? "green" : o.scores[k] === 2 ? "amber" : "red"}>
                      {OBSERVATION_ASPECTS[k]}: {o.scores[k]} · {OBSERVATION_SCALE[o.scores[k]]}
                    </Badge>
                  ))}
                </div>
                <div className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
                  <p>
                    <span className="block text-[11px] font-black uppercase tracking-wider text-amber-200/80">Kekuatan</span>
                    <span className="whitespace-pre-line text-amber-50">{o.strengths}</span>
                  </p>
                  <p>
                    <span className="block text-[11px] font-black uppercase tracking-wider text-amber-200/80">Saran perbaikan</span>
                    <span className="whitespace-pre-line text-amber-50">{o.improvements}</span>
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}

// Ajakan menilai tutor untuk kelas yang sudah selesai (siswa dan wali).
export async function SurveyPrompt({ studentIds }: { studentIds: string[] }) {
  const pending = await pendingSurveys(studentIds);
  if (!pending.length) return null;
  return (
    <Panel title="Nilai tutor kelasmu">
      <ul className="space-y-5">
        {pending.map((s) => (
          <li key={s.enrollmentId}>
            <p className="mb-3 text-sm text-amber-100">
              Bagaimana pengalaman belajar <span className="font-bold text-white">{s.student}</span> bersama <span className="font-bold text-white">{s.tutor}</span> di {s.program} ({s.batch})?
            </p>
            <SurveyForm enrollmentId={s.enrollmentId} tutor={s.tutor} />
          </li>
        ))}
      </ul>
    </Panel>
  );
}
