import Link from "next/link";
import { Icon } from "@/components/icons";
import { LevelGuide } from "@/components/level-guide";
import { ASSESSMENT_KINDS, ASSESSMENT_LABEL, overallReportLevel, type AssessmentKind, type ReportSummary, type SkillLevels } from "@/lib/academic";
import { assessmentSheet, learnerProgress, tutorAssessmentQueue, type ClassProgress } from "@/lib/assessment";
import { longDate } from "@/lib/classes";
import { whenLabel } from "@/lib/learning";
import { leadReports, learnerReports, reportWorkspace, tutorReportTasks, type ReportRow, type ReportWorkspace } from "@/lib/reports";
import type { Viewer } from "@/lib/session";
import { Badge, EmptyState, formatDateTime, Notice, PageHeader, Panel, Tabs } from "../ui";
import { SurveyPrompt } from "./quality";
import { AssessmentForm, ReportForm, ReviewForm } from "./academic-forms";
import { AssessmentNotes, EvidenceCompare, LevelChips, ProgressStats, ReportStatusBadge, ScoreBars, ScoreTable } from "./academic-ui";
import { ChildTabs, loadLearners } from "./classes";
import { FileButton } from "./curriculum-forms";

const dueLabel = (ms: number) => formatDateTime(new Date(ms).toISOString());

// ---------------------------------------------------------------------------
// Tutor: assessment
// ---------------------------------------------------------------------------

export async function TutorAssessments({ viewer, params }: { viewer: Viewer; params: Record<string, string | undefined> }) {
  if (params.batch && ASSESSMENT_KINDS.includes(params.kind as AssessmentKind)) return AssessmentSheetPage({ viewer, batchId: params.batch, kind: params.kind as AssessmentKind, studentId: params.siswa });
  const items = await tutorAssessmentQueue(viewer.id);
  const pending = items.filter((i) => i.students.some((s) => s.state !== "published"));
  const tab = params.tab === "semua" || !pending.length ? "semua" : "perlu";
  const list = tab === "perlu" ? pending : items;
  return (
    <div className="fade-in space-y-6">
      <PageHeader title="Assessment" subtitle="Nilai setiap siswa dengan rubrik 1–4 di sesi assessment awal, tengah, dan akhir. Batas 48 jam setelah sesi." />
      <Tabs
        active={tab}
        tabs={[
          { key: "perlu", label: "Perlu dinilai", count: pending.length, href: "/portal/tutor/assessment?tab=perlu" },
          { key: "semua", label: "Semua", count: items.length, href: "/portal/tutor/assessment?tab=semua" },
        ]}
      />
      <Panel>
        {list.length === 0 ? (
          <EmptyState icon="check" title={items.length ? "Semua assessment sudah terbit" : "Belum ada sesi assessment"} text={items.length ? undefined : "Assessment muncul di sini setelah sesi bertanda assessment dimulai."} />
        ) : (
          <ul className="divide-y divide-orange/10">
            {list.map((item) => {
              const open = item.students.filter((s) => s.state !== "published");
              const overdue = open.filter((s) => s.overdue).length;
              const makeup = open.filter((s) => s.makeup).length;
              return (
                <li key={`${item.batch.id}-${item.kind}`} className="flex flex-wrap items-center justify-between gap-3 py-4">
                  <div>
                    <p className="font-black text-white">
                      {item.batch.code} · Assessment {ASSESSMENT_LABEL[item.kind].toLowerCase()}
                    </p>
                    <p className="text-xs text-amber-200/70">
                      {item.batch.program} · Sesi {item.session.seq} · {whenLabel(item.session.starts_at)}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {open.length === 0 ? <Badge tone="green">Semua terbit</Badge> : <Badge tone="amber">{open.length} belum terbit</Badge>}
                    {overdue > 0 && <Badge tone="red">{overdue} lewat batas</Badge>}
                    {makeup > 0 && <Badge>{makeup} susulan</Badge>}
                    <Link href={`/portal/tutor/assessment?batch=${item.batch.id}&kind=${item.kind}`} className="font-black text-orange hover:text-orange-light">
                      Nilai →
                    </Link>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Panel>
    </div>
  );
}

function AssessmentStateBadge({ st }: { st: { state: string; overdue: boolean } }) {
  return st.state === "published" ? <Badge tone="green">Terbit</Badge> : st.state === "draft" ? <Badge tone="amber">Draf</Badge> : <Badge tone={st.overdue ? "red" : "amber"}>Belum dinilai</Badge>;
}

// Daftar siswa dulu; form rubrik terbuka setelah nama siswa diklik (?siswa=).
async function AssessmentSheetPage({ viewer, batchId, kind, studentId }: { viewer: Viewer; batchId: string; kind: AssessmentKind; studentId?: string }) {
  const sheet = await assessmentSheet(batchId, kind, viewer.id);
  if (!sheet) return <Notice tone="red">Assessment tidak ditemukan atau bukan bagian dari kelasmu.</Notice>;
  const started = Date.parse(sheet.session.starts_at) <= Date.now();
  const sheetHref = `/portal/tutor/assessment?batch=${sheet.batch.id}&kind=${kind}`;
  const index = sheet.students.findIndex((s) => s.student_id === studentId);
  const st = index >= 0 ? sheet.students[index] : null;
  // Siswa berikutnya yang belum terbit, berputar dari siswa yang sedang dibuka.
  const nextOpen = st ? [...sheet.students.slice(index + 1), ...sheet.students.slice(0, index)].find((s) => s.state !== "published") : null;
  const published = sheet.students.filter((s) => s.state === "published").length;
  const title = `${sheet.batch.code} · Assessment ${ASSESSMENT_LABEL[kind].toLowerCase()}`;
  return (
    <div className="fade-in space-y-6">
      <PageHeader
        title={st ? st.full_name : title}
        subtitle={`${st ? `${title} · ` : ""}${sheet.batch.program.name} · Sesi ${sheet.session.seq} · ${whenLabel(sheet.session.starts_at)}`}
        action={
          <Link href={st ? sheetHref : "/portal/tutor/assessment"} className="text-sm font-bold text-orange">
            {st ? "← Daftar siswa" : "← Semua assessment"}
          </Link>
        }
      />
      {!started ? (
        <Notice>Assessment bisa diisi setelah sesi {sheet.session.seq} dimulai.</Notice>
      ) : sheet.indicators.length === 0 ? (
        <Notice tone="red">Kurikulum batch ini belum punya rubrik. Hubungi Academic Lead.</Notice>
      ) : st ? (
        <Panel>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <p className={`text-xs ${st.overdue ? "font-bold text-rose-300" : "text-amber-200/70"}`}>
              {st.makeup ? "Tidak hadir di sesi assessment · nilai susulan" : "Batas penilaian"} paling lambat {dueLabel(st.due)}
            </p>
            <div className="flex flex-wrap gap-2">
              {st.makeup && <Badge>Susulan</Badge>}
              <AssessmentStateBadge st={st} />
            </div>
          </div>
          <AssessmentForm
            key={st.student_id}
            batchId={sheet.batch.id}
            studentId={st.student_id}
            studentName={st.full_name}
            kind={kind}
            indicators={sheet.indicators}
            initial={st.assessment ? { scores: st.assessment.scores, note: st.assessment.note } : null}
            published={st.state === "published"}
            locked={st.locked}
          />
          {nextOpen && (
            <div className="mt-5 flex justify-end border-t border-orange/15 pt-4">
              <Link href={`${sheetHref}&siswa=${nextOpen.student_id}`} className="text-sm font-black text-orange hover:underline">
                Siswa berikutnya: {nextOpen.full_name} →
              </Link>
            </div>
          )}
        </Panel>
      ) : (
        <>
          <Notice>Pilih nama siswa untuk mengisi nilainya. Nilai draf belum terlihat siswa; setelah terbit, nilai tampil di Progres siswa dan wali dan masih bisa diperbaiki sampai laporan akhir diajukan.</Notice>
          <Panel title={`Siswa (${published}/${sheet.students.length} terbit)`}>
            {sheet.students.length === 0 ? (
              <EmptyState icon="users" title="Belum ada siswa aktif" />
            ) : (
              <ul className="space-y-2">
                {sheet.students.map((s) => (
                  <li key={s.student_id}>
                    <Link href={`${sheetHref}&siswa=${s.student_id}`} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-orange/20 px-4 py-3 hover:border-orange/60">
                      <span>
                        <span className="block font-bold text-white">{s.full_name}</span>
                        <span className={`block text-xs ${s.overdue ? "font-bold text-rose-300" : "text-amber-200/70"}`}>
                          {s.state === "published" ? "Sudah terbit" : `Batas ${dueLabel(s.due)}`}
                          {s.makeup ? " · susulan (tidak hadir)" : ""}
                        </span>
                      </span>
                      <span className="flex items-center gap-2">
                        <AssessmentStateBadge st={s} />
                        <span className="text-xs font-black text-orange">{s.state === "published" ? "Lihat →" : "Nilai →"}</span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Laporan: tampilan isi (tutor, Lead, siswa, wali)
// ---------------------------------------------------------------------------

function ReportBody({ summary, levels, strengths, improvements, recommendations }: { summary: ReportSummary; levels?: SkillLevels; strengths?: string; improvements?: string; recommendations?: { id: string; name: string }[] }) {
  return (
    <div className="space-y-5">
      <ProgressStats summary={summary} levels={levels} />
      <div>
        <p className="mb-2 text-xs font-black uppercase tracking-[0.18em] text-amber-200/80">Nilai per indikator</p>
        <ScoreTable summary={summary} />
      </div>
      <div>
        <p className="mb-2 text-xs font-black uppercase tracking-[0.18em] text-amber-200/80">Grafik perkembangan</p>
        <ScoreBars summary={summary} />
      </div>
      {levels && Object.keys(levels).length > 0 && (
        <div>
          <p className="mb-2 text-xs font-black uppercase tracking-[0.18em] text-amber-200/80">Level akhir per keterampilan</p>
          <LevelChips levels={levels} />
          <div className="mt-3">
            <LevelGuide current={overallReportLevel(levels)} withC1 />
          </div>
        </div>
      )}
      {strengths && (
        <div className="grid gap-3 md:grid-cols-2">
          <div className="rounded-xl border border-orange/20 p-4">
            <p className="text-[11px] font-black uppercase tracking-wider text-amber-200/80">Kekuatan</p>
            <p className="mt-1 whitespace-pre-line text-sm text-amber-50">{strengths}</p>
          </div>
          <div className="rounded-xl border border-orange/20 p-4">
            <p className="text-[11px] font-black uppercase tracking-wider text-amber-200/80">Yang perlu ditingkatkan</p>
            <p className="mt-1 whitespace-pre-line text-sm text-amber-50">{improvements}</p>
          </div>
        </div>
      )}
      {recommendations && recommendations.length > 0 && (
        <div>
          <p className="mb-2 text-xs font-black uppercase tracking-[0.18em] text-amber-200/80">Rekomendasi program berikutnya</p>
          <div className="flex flex-wrap gap-2">
            {recommendations.map((p) => (
              <Badge key={p.id} tone="orange">
                {p.name}
              </Badge>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function WorkspaceHeader({ ws }: { ws: ReportWorkspace }) {
  const { batch } = ws;
  return (
    <p className="text-sm text-amber-100">
      {batch.program.name} · batch {batch.code} · tutor {ws.tutorName} · mulai {longDate(batch.start_date)}
    </p>
  );
}

// ---------------------------------------------------------------------------
// Tutor: laporan
// ---------------------------------------------------------------------------

export async function TutorReports({ viewer, params }: { viewer: Viewer; params: Record<string, string | undefined> }) {
  if (params.id) return TutorReportDetail({ viewer, enrollmentId: params.id });
  const tasks = await tutorReportTasks(viewer.id);
  const todo = tasks.filter((t) => t.state === "none" || t.state === "draft" || t.state === "returned" || t.state === "waiting");
  const tab = params.tab === "semua" || !todo.length ? "semua" : "perlu";
  const list = tab === "perlu" ? todo : tasks;
  return (
    <div className="fade-in space-y-6">
      <PageHeader title="Laporan" subtitle="Susun laporan setelah assessment akhir terbit, lalu ajukan ke Academic Lead paling lambat 3 hari setelah sesi terakhir." />
      <Tabs
        active={tab}
        tabs={[
          { key: "perlu", label: "Perlu disusun", count: todo.length, href: "/portal/tutor/laporan?tab=perlu" },
          { key: "semua", label: "Semua", count: tasks.length, href: "/portal/tutor/laporan?tab=semua" },
        ]}
      />
      <Panel>
        {list.length === 0 ? (
          <EmptyState icon="report" title={tasks.length ? "Semua laporan sudah diajukan" : "Belum ada laporan"} text={tasks.length ? undefined : "Laporan muncul setelah sesi assessment akhir batch dimulai."} />
        ) : (
          <ul className="divide-y divide-orange/10">
            {list.map((t) => (
              <li key={t.enrollment_id} className="flex flex-wrap items-center justify-between gap-3 py-4">
                <div>
                  <p className="font-black text-white">{t.full_name}</p>
                  <p className={`text-xs ${t.overdue ? "font-bold text-rose-300" : "text-amber-200/70"}`}>
                    {t.batch.code} · {t.batch.program} · ajukan paling lambat {dueLabel(t.due)}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {t.overdue && <Badge tone="red">Lewat batas</Badge>}
                  <ReportStatusBadge state={t.state} />
                  <Link href={`/portal/tutor/laporan?id=${t.enrollment_id}`} className="font-black text-orange hover:text-orange-light">
                    Buka →
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}

async function TutorReportDetail({ viewer, enrollmentId }: { viewer: Viewer; enrollmentId: string }) {
  const ws = await reportWorkspace(enrollmentId, viewer);
  if (!ws || ws.batch.tutor_id !== viewer.id) return <Notice tone="red">Laporan tidak ditemukan atau bukan bagian dari kelasmu.</Notice>;
  const r = ws.report;
  const finalPublished = ws.progress.summary.indicators.some((i) => typeof i.scores.final === "number");
  const editable = !r || r.status === "draft" || r.status === "returned";
  const recommendations = (r?.recommended_program_ids ?? []).map((id) => ws.programs.find((p) => p.id === id)).filter(Boolean) as { id: string; name: string }[];
  return (
    <div className="fade-in space-y-6">
      <PageHeader
        title={`Laporan ${ws.student.full_name}`}
        subtitle="Nilai dan ringkasan diambil otomatis dari assessment, absensi, dan tugas."
        action={
          <Link href="/portal/tutor/laporan" className="text-sm font-bold text-orange">
            ← Semua laporan
          </Link>
        }
      />
      <WorkspaceHeader ws={ws} />
      {r?.status === "returned" && r.lead_comment && <Notice tone="red">Dikembalikan Academic Lead: {r.lead_comment}</Notice>}
      <Panel title="Ringkasan otomatis">
        <ReportBody summary={ws.progress.summary} />
        <div className="mt-5">
          <AssessmentNotes summary={ws.progress.summary} />
        </div>
      </Panel>
      <Panel title="Bukti awal dan terbaru">
        <EvidenceCompare evidence={ws.progress.evidence} />
      </Panel>
      <Panel title={editable ? "Susun laporan" : "Isi laporan"}>
        <div className="mb-4 flex items-center gap-2">
          <ReportStatusBadge state={r?.status ?? (finalPublished ? "none" : "waiting")} />
          {r?.submitted_at && <span className="text-xs text-amber-200/70">Diajukan {formatDateTime(r.submitted_at)}</span>}
        </div>
        {!finalPublished ? (
          <Notice>Terbitkan assessment akhir siswa ini lebih dulu, lalu susun laporan di sini.</Notice>
        ) : editable ? (
          <ReportForm
            key={r?.updated_at ?? "baru"}
            enrollmentId={ws.enrollment.id}
            skills={ws.skills}
            programs={ws.programs}
            returned={r?.status === "returned"}
            initial={{
              strengths: r?.strengths ?? "",
              improvements: r?.improvements ?? "",
              levels: r && Object.keys(r.levels).length ? r.levels : ws.suggestedLevels,
              programIds: r?.recommended_program_ids ?? [],
            }}
          />
        ) : (
          <>
            <ReportBody summary={ws.progress.summary} levels={r!.levels} strengths={r!.strengths} improvements={r!.improvements} recommendations={recommendations} />
            {r!.status === "published" && (
              <div className="mt-4">
                <FileButton kind="report" id={r!.id} label="Unduh PDF" />
              </div>
            )}
          </>
        )}
      </Panel>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Academic Lead: review laporan
// ---------------------------------------------------------------------------

export async function LeadReports({ viewer, params }: { viewer: Viewer; params: Record<string, string | undefined> }) {
  if (params.id) return LeadReportDetail({ viewer, reportId: params.id });
  const rows = await leadReports();
  const groups = {
    review: rows.filter((r) => r.status === "submitted"),
    kembali: rows.filter((r) => r.status === "returned"),
    terbit: rows.filter((r) => r.status === "published").reverse(),
  };
  const tab = (params.tab as keyof typeof groups) in groups ? (params.tab as keyof typeof groups) : groups.review.length ? "review" : "terbit";
  return (
    <div className="fade-in space-y-6">
      <PageHeader title="Review laporan" subtitle="Konfirmasi level akhir, lalu terbitkan laporan beserta PDF-nya, atau kembalikan ke tutor dengan catatan. Target ≤2 hari." />
      <Tabs
        active={tab}
        tabs={[
          { key: "review", label: "Menunggu review", count: groups.review.length, href: "/portal/lead/laporan?tab=review" },
          { key: "kembali", label: "Dikembalikan", count: groups.kembali.length, href: "/portal/lead/laporan?tab=kembali" },
          { key: "terbit", label: "Terbit", count: groups.terbit.length, href: "/portal/lead/laporan?tab=terbit" },
        ]}
      />
      <Panel>
        {groups[tab].length === 0 ? (
          <EmptyState icon="report" title="Tidak ada laporan di bagian ini" />
        ) : (
          <ul className="divide-y divide-orange/10">
            {groups[tab].map((r) => (
              <li key={r.id} className="flex flex-wrap items-center justify-between gap-3 py-4">
                <div>
                  <p className="font-black text-white">{r.student_name}</p>
                  <p className={`text-xs ${r.overdue ? "font-bold text-rose-300" : "text-amber-200/70"}`}>
                    {r.program} · batch {r.batch_code} · tutor {r.tutor}
                    {r.status === "published" ? ` · terbit ${formatDateTime(r.published_at)}` : r.submitted_at ? ` · diajukan ${formatDateTime(r.submitted_at)}` : ""}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {r.overdue && <Badge tone="red">Lewat 2 hari</Badge>}
                  <ReportStatusBadge state={r.status} />
                  <Link href={`/portal/lead/laporan?id=${r.id}`} className="font-black text-orange hover:text-orange-light">
                    Buka →
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}

async function LeadReportDetail({ viewer, reportId }: { viewer: Viewer; reportId: string }) {
  const rows = await leadReports();
  const row = rows.find((r) => r.id === reportId);
  const ws = row ? await reportWorkspace(row.enrollment_id, viewer) : null;
  if (!row || !ws || !ws.report) return <Notice tone="red">Laporan tidak ditemukan.</Notice>;
  const r = ws.report as ReportRow;
  const summary = r.status === "published" && r.summary ? r.summary : ws.progress.summary;
  const recommendations = r.recommended_program_ids.map((id) => ws.programs.find((p) => p.id === id)).filter(Boolean) as { id: string; name: string }[];
  return (
    <div className="fade-in space-y-6">
      <PageHeader
        title={`Laporan ${ws.student.full_name}`}
        subtitle={`Disusun ${ws.tutorName}${r.submitted_at ? ` · diajukan ${formatDateTime(r.submitted_at)}` : ""}`}
        action={
          <Link href="/portal/lead/laporan" className="text-sm font-bold text-orange">
            ← Semua laporan
          </Link>
        }
      />
      <WorkspaceHeader ws={ws} />
      <Panel>
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <ReportStatusBadge state={r.status} />
          {r.status === "published" && <FileButton kind="report" id={r.id} label="Unduh PDF" />}
        </div>
        {r.status === "returned" && r.lead_comment && <Notice tone="red">Catatan saat dikembalikan: {r.lead_comment}</Notice>}
        <ReportBody summary={summary} levels={r.levels} strengths={r.strengths} improvements={r.improvements} recommendations={recommendations} />
        <div className="mt-5">
          <AssessmentNotes summary={summary} />
        </div>
      </Panel>
      <Panel title="Bukti awal dan terbaru">
        <EvidenceCompare evidence={ws.progress.evidence} />
      </Panel>
      {r.status === "submitted" && (
        <Panel title="Keputusan review">
          <ReviewForm reportId={r.id} skills={ws.skills} levels={r.levels} />
        </Panel>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Siswa dan wali: progres dan laporan
// ---------------------------------------------------------------------------

type LearnerRole = "student" | "guardian";

function ClassProgressPanel({ p }: { p: ClassProgress }) {
  const { batch } = p.cls.enrollment;
  const done = p.cls.enrollment.status === "completed";
  const nextPoint = p.points.find((x) => !p.summary.indicators.some((i) => typeof i.scores[x.kind] === "number"));
  return (
    <Panel>
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-bold text-amber-200/80">Batch {batch.code}</p>
          <p className="text-lg font-black text-orange">{batch.program.name}</p>
          <p className="text-xs text-amber-100">Target: {batch.program.outcome}</p>
        </div>
        {done ? <Badge>Selesai</Badge> : <Badge tone="green">Berjalan</Badge>}
      </div>
      <div className="space-y-5">
        <ProgressStats summary={p.summary} />
        {p.summary.indicators.some((i) => Object.keys(i.scores).length) ? (
          <>
            <ScoreTable summary={p.summary} />
            <ScoreBars summary={p.summary} />
            <AssessmentNotes summary={p.summary} />
          </>
        ) : (
          <Notice>Nilai tampil setelah tutor menerbitkan assessment awal{nextPoint ? ` (sesi ${nextPoint.session.seq})` : ""}.</Notice>
        )}
        {nextPoint && p.summary.indicators.some((i) => Object.keys(i.scores).length) && (
          <p className="text-xs text-amber-200/80">
            Assessment berikutnya: {ASSESSMENT_LABEL[nextPoint.kind].toLowerCase()} di sesi {nextPoint.session.seq} ({whenLabel(nextPoint.session.starts_at)}).
          </p>
        )}
        <div>
          <p className="mb-2 text-xs font-black uppercase tracking-[0.18em] text-amber-200/80">Bukti awal dan terbaru</p>
          <EvidenceCompare evidence={p.evidence} />
        </div>
      </div>
    </Panel>
  );
}

function ReportCard({ r, role, studentId }: { r: Awaited<ReturnType<typeof learnerReports>>[number]; role: LearnerRole; studentId: string }) {
  const summary = r.summary!;
  const base = `/portal/${role}/program${role === "guardian" ? `?anak=${studentId}` : ""}`;
  return (
    <Panel>
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-bold text-amber-200/80">
            Batch {r.batch_code} · terbit {formatDateTime(r.published_at)}
          </p>
          <p className="text-lg font-black text-orange">{r.program}</p>
          <p className="text-xs text-amber-100">Level akhir keseluruhan: {overallReportLevel(r.levels) ?? "-"}</p>
        </div>
        <FileButton kind="report" id={r.id} label="Unduh PDF" />
      </div>
      <ReportBody summary={summary} levels={r.levels} strengths={r.strengths} improvements={r.improvements} />
      {r.recommendations.length > 0 && (
        <div className="mt-5 rounded-2xl border border-orange/40 bg-orange/10 p-4">
          <p className="text-[11px] font-black uppercase tracking-[0.18em] text-amber-200/80">Rekomendasi program berikutnya</p>
          <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
            <p className="font-black text-white">{r.recommendations.map((p) => p.name).join(" · ")}</p>
            <Link href={base} className="btn-orange inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm">
              Ambil program <Icon name="arrow" className="h-4 w-4" />
            </Link>
          </div>
          <p className="mt-1 text-xs text-amber-200/80">Langsung pilih jadwal tanpa placement ulang.</p>
        </div>
      )}
    </Panel>
  );
}

async function pick(viewer: Viewer, role: LearnerRole, params: Record<string, string | undefined>) {
  const learners = await loadLearners(viewer, role);
  const learner = learners.find((l) => l.student.id === params.anak) ?? learners[0] ?? null;
  return { learners, learner };
}

export async function ProgressPage({ viewer, role, params }: { viewer: Viewer; role: LearnerRole; params: Record<string, string | undefined> }) {
  const { learners, learner } = await pick(viewer, role, params);
  const [progress, reports] = learner ? await Promise.all([learnerProgress(learner.student.id, learner.student.full_name), role === "guardian" ? learnerReports(learner.student.id) : Promise.resolve([])]) : [[], []];
  return (
    <div className="fade-in mx-auto max-w-5xl space-y-6">
      <PageHeader
        title={role === "guardian" ? "Progres & laporan" : "Progres"}
        subtitle="Nilai per indikator rubrik dari assessment awal, tengah, dan akhir, beserta bukti awal dibanding terbaru."
      />
      <ChildTabs learners={learners} active={learner?.student.id ?? ""} base={`/portal/${role}`} section="progres" />
      {role === "guardian" && learner && <SurveyPrompt studentIds={[learner.student.id]} />}
      {progress.length === 0 && <EmptyState icon="chart" title="Belum ada progres" text="Progres tampil setelah kelas berjalan dan tutor menerbitkan assessment." />}
      {[...progress].reverse().map((p) => (
        <ClassProgressPanel key={p.cls.enrollment.id} p={p} />
      ))}
      {role === "guardian" && learner && reports.length > 0 && (
        <>
          <h2 className="pt-2 text-sm font-black uppercase tracking-[0.18em] text-amber-200/80">Laporan terbit</h2>
          {reports.map((r) => (
            <ReportCard key={r.id} r={r} role={role} studentId={learner.student.id} />
          ))}
        </>
      )}
    </div>
  );
}

export async function ReportsPage({ viewer, role, params }: { viewer: Viewer; role: LearnerRole; params: Record<string, string | undefined> }) {
  const { learners, learner } = await pick(viewer, role, params);
  const reports = learner ? await learnerReports(learner.student.id) : [];
  return (
    <div className="fade-in mx-auto max-w-5xl space-y-6">
      <PageHeader title="Laporan" subtitle="Semua laporan dari program pertama sampai terbaru, lengkap dengan PDF dan rekomendasi program berikutnya." />
      <ChildTabs learners={learners} active={learner?.student.id ?? ""} base={`/portal/${role}`} section="laporan" />
      {learner && <SurveyPrompt studentIds={[learner.student.id]} />}
      {reports.length === 0 ? (
        <EmptyState icon="report" title="Belum ada laporan" text="Laporan terbit setelah program selesai, disusun tutor dan ditinjau Academic Lead." />
      ) : (
        <>
          {reports.length > 1 && (
            <ol className="flex flex-wrap items-center gap-2 text-xs font-bold text-amber-100" aria-label="Perjalanan program">
              {reports.map((r, i) => (
                <li key={r.id} className="flex items-center gap-2">
                  {i > 0 && <span className="text-orange">→</span>}
                  <span className="rounded-full border border-orange/40 px-3 py-1">
                    {r.program} · {overallReportLevel(r.levels) ?? "-"}
                  </span>
                </li>
              ))}
            </ol>
          )}
          {[...reports].reverse().map((r) => (
            <ReportCard key={r.id} r={r} role={role} studentId={learner!.student.id} />
          ))}
        </>
      )}
    </div>
  );
}
