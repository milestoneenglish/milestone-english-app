import Link from "next/link";
import { ASSESSMENT_LABEL } from "@/lib/academic";
import { longDate } from "@/lib/classes";
import { SUBMISSION_LABEL } from "@/lib/curriculum";
import { assignmentDetail, sessionDetail, sessionEnd, tutorAssignments, tutorQueue, tutorSessions, whenLabel, type TutorSession } from "@/lib/learning";
import { placementQueue } from "@/lib/placement/staff";
import { tutorAcademicQueue } from "@/lib/reports";
import type { Viewer } from "@/lib/session";
import { calendarMonth, MonthCalendar, type CalendarEvent } from "../calendar";
import { Badge, EmptyState, formatDateTime, Notice, greeting, PageHeader, Panel, Tabs } from "../ui";
import { QueueCard } from "./admin-classes";
import { ModuleContent, SubmissionHistory, TaskStateBadge } from "./learning-ui";
import { AttendanceForm, FeedbackForm, PublishTaskForm } from "./tutor-forms";

function SessionRow({ s }: { s: TutorSession }) {
  const now = Date.now();
  const started = Date.parse(s.starts_at) <= now;
  const overdue = started && !s.attendance_done_at && sessionEnd(s) + 24 * 3600 * 1000 < now;
  return (
    <li className="flex flex-wrap items-center justify-between gap-3 py-3">
      <div>
        <p className="font-bold text-white">
          {s.batch.code} · Sesi {s.seq}
          {s.module_title ? <span className="font-normal text-amber-100"> · {s.module_title}</span> : null}
        </p>
        <p className="text-xs text-amber-200/70">
          {s.batch.program.name} · {whenLabel(s.starts_at)} · {s.duration_minutes} mnt
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {started ? (
          s.attendance_done_at ? (
            <Badge tone="green">Absensi terisi</Badge>
          ) : (
            <Badge tone={overdue ? "red" : "amber"}>{overdue ? "Absensi terlambat diisi" : "Absensi belum diisi"}</Badge>
          )
        ) : (
          <Badge>Akan datang</Badge>
        )}
        <Link href={`/portal/tutor/sesi?id=${s.id}`} className="font-black text-orange hover:text-orange-light">
          Buka →
        </Link>
      </div>
    </li>
  );
}

export async function TutorHome({ viewer }: { viewer: Viewer }) {
  const [q, placement, academic] = await Promise.all([tutorQueue(viewer.id), placementQueue({ evaluatorId: viewer.id }), tutorAcademicQueue(viewer.id)]);
  const firstName = (viewer.fullName || viewer.email).split(/[\s@]/)[0];
  const next = q.upcoming[0];
  return (
    <div className="fade-in space-y-6">
      <PageHeader title={greeting(firstName)} subtitle="Perlu tindakan hari ini." />
      {q.attendanceOverdue > 0 && <Notice tone="red">{q.attendanceOverdue} sesi sudah lewat 24 jam tanpa absensi. Isi sekarang agar wali dan laporan tidak tertunda.</Notice>}
      {academic.assessmentCounts.overdue > 0 && <Notice tone="red">{academic.assessmentCounts.overdue} assessment siswa sudah lewat 48 jam setelah sesinya.</Notice>}
      {academic.reportsReturned > 0 && <Notice tone="red">{academic.reportsReturned} laporan dikembalikan Academic Lead untuk direvisi.</Notice>}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <QueueCard href="/portal/tutor/sesi" icon="calendar" count={q.attendancePending.length} title="Absensi belum diisi" text="Isi paling lambat 24 jam setelah sesi." />
        <QueueCard href="/portal/tutor/tugas" icon="task" count={q.toReview} title="Tugas menunggu feedback" text="Beri feedback atau minta revisi (maksimal 2 kali)." />
        <QueueCard
          href="/portal/tutor/assessment"
          icon="check"
          count={academic.assessmentCounts.pending}
          title="Assessment perlu dinilai"
          text={`Awal, tengah, dan akhir; ≤48 jam setelah sesi${academic.assessmentCounts.makeup ? ` · ${academic.assessmentCounts.makeup} susulan` : ""}.`}
        />
        <QueueCard href="/portal/tutor/laporan" icon="report" count={academic.reportsToWrite} title="Laporan perlu disusun" text="Ajukan ke Academic Lead ≤3 hari setelah sesi terakhir." />
        <QueueCard
          href="/portal/tutor/placement"
          icon="test"
          count={placement.filter((a) => a.status === "awaiting_review").length}
          title="Placement perlu dinilai"
          text="Writing dan speaking dinilai ≤1×24 jam."
        />
      </div>
      {next && (
        <Panel title="Sesi berikutnya">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-lg font-black text-white">
                {next.batch.code} · Sesi {next.seq}
                {next.module_title ? ` · ${next.module_title}` : ""}
              </p>
              <p className="text-sm text-amber-100">
                {next.batch.program.name} · {whenLabel(next.starts_at)}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link href={`/portal/tutor/sesi?id=${next.id}`} className="rounded-full border border-orange/40 px-4 py-2 text-xs font-black text-orange hover:bg-orange/10">
                Lihat materi sesi
              </Link>
              {next.batch.meeting_url && (
                <a href={next.batch.meeting_url} target="_blank" rel="noopener noreferrer" className="btn-orange rounded-full px-4 py-2 text-xs">
                  Buka link kelas
                </a>
              )}
            </div>
          </div>
        </Panel>
      )}
      {q.attendancePending.length > 0 && (
        <Panel title="Absensi yang perlu diisi">
          <ul className="divide-y divide-orange/10">
            {q.attendancePending.map((s) => (
              <SessionRow key={s.id} s={s} />
            ))}
          </ul>
        </Panel>
      )}
    </div>
  );
}

export async function TutorSessions({ viewer, params }: { viewer: Viewer; params: Record<string, string | undefined> }) {
  if (params.id) return TutorSessionDetail({ viewer, id: params.id });
  const sessions = await tutorSessions(viewer.id);
  const now = Date.now();
  const pending = sessions.filter((s) => Date.parse(s.starts_at) <= now && !s.attendance_done_at);
  const events: CalendarEvent[] = sessions.map((s) => {
    const started = Date.parse(s.starts_at) <= now;
    const overdue = started && !s.attendance_done_at && sessionEnd(s) + 24 * 3600 * 1000 < now;
    return {
      id: s.id,
      at: s.starts_at,
      title: `${s.batch.code} · Sesi ${s.seq}`,
      detail: s.module_title ?? s.batch.program.name,
      tone: !started ? "orange" : s.attendance_done_at ? "green" : overdue ? "red" : "amber",
      status: !started ? "Akan datang" : s.attendance_done_at ? "Absensi terisi" : overdue ? "Absensi terlambat diisi" : "Absensi belum diisi",
      href: `/portal/tutor/sesi?id=${s.id}`,
    };
  });
  const month = calendarMonth(params.bulan, events, now);
  return (
    <div className="fade-in space-y-6">
      <PageHeader title="Sesi & absensi" subtitle="Klik sesi di kalender untuk membuka materi, link kelas, absensi, dan tugasnya." />
      {pending.length > 0 && (
        <Panel title={`Perlu absensi (${pending.length})`}>
          <ul className="divide-y divide-orange/10">
            {pending.map((s) => (
              <SessionRow key={s.id} s={s} />
            ))}
          </ul>
        </Panel>
      )}
      <Panel>
        {sessions.length === 0 ? (
          <EmptyState icon="calendar" title="Belum ada sesi" text="Sesi muncul setelah admin menugaskanmu ke batch." />
        ) : (
          <MonthCalendar
            events={events}
            month={month}
            hrefFor={(m) => `/portal/tutor/sesi?bulan=${m}`}
            now={now}
            legend={[
              { tone: "orange", label: "Akan datang" },
              { tone: "amber", label: "Absensi belum diisi" },
              { tone: "red", label: "Terlambat diisi (>24 jam)" },
              { tone: "green", label: "Absensi terisi" },
            ]}
          />
        )}
      </Panel>
    </div>
  );
}

async function TutorSessionDetail({ viewer, id }: { viewer: Viewer; id: string }) {
  const d = await sessionDetail(id, viewer.id);
  if (!d) return <Notice tone="red">Sesi tidak ditemukan atau bukan bagian dari kelasmu.</Notice>;
  const { session: s, batch, module, roster, attendance, assignments, nextSession } = d;
  const started = Date.parse(s.starts_at) <= Date.now();
  const running = batch.status === "open" || batch.status === "running";
  const published = new Set(assignments.map((a) => a.module_task_id).filter(Boolean));
  const defaultDue = nextSession ? nextSession.starts_at : new Date(Math.max(Date.now(), sessionEnd(s)) + 7 * 24 * 3600 * 1000).toISOString();
  return (
    <div className="fade-in space-y-6">
      <PageHeader
        title={`${batch.code} · Sesi ${s.seq}`}
        subtitle={`${batch.program.name} · ${whenLabel(s.starts_at)} · ${s.duration_minutes} menit`}
        action={
          <div className="flex flex-wrap items-center gap-3">
            {batch.meeting_url && (
              <a href={batch.meeting_url} target="_blank" rel="noopener noreferrer" className="btn-orange rounded-full px-4 py-2 text-xs">
                Buka link kelas
              </a>
            )}
            <Link href="/portal/tutor/sesi" className="text-sm font-bold text-orange">
              ← Semua sesi
            </Link>
          </div>
        }
      />
      {module?.assessment && (
        <Notice>
          Sesi ini adalah titik assessment {ASSESSMENT_LABEL[module.assessment].toLowerCase()}. Nilai setiap siswa dengan rubrik paling lambat 48 jam setelah sesi.{" "}
          <Link href={`/portal/tutor/assessment?batch=${batch.id}&kind=${module.assessment}`} className="underline">
            Buka lembar assessment →
          </Link>
        </Notice>
      )}
      <Panel title={module ? `Modul: ${module.title}` : "Modul sesi"}>
        {module ? <ModuleContent module={module} /> : <p className="text-sm text-slate-400">Batch ini belum memakai kurikulum. Siapkan materi sesuai rencana program.</p>}
      </Panel>
      <Panel title={`Absensi (${roster.length} siswa)`}>
        {roster.length === 0 ? (
          <EmptyState icon="users" title="Belum ada siswa aktif" />
        ) : !started ? (
          <Notice>Absensi bisa diisi setelah sesi dimulai ({formatDateTime(s.starts_at)}).</Notice>
        ) : (
          <>
            {s.attendance_done_at && <p className="mb-3 text-xs text-emerald-300">Terisi {formatDateTime(s.attendance_done_at)}. Kamu masih bisa memperbaruinya.</p>}
            <AttendanceForm sessionId={s.id} roster={roster} initial={attendance} note={s.tutor_note} done={Boolean(s.attendance_done_at)} />
          </>
        )}
      </Panel>
      <Panel title="Tugas sesi ini">
        <div className="space-y-3">
          {assignments.map((a) => (
            <div key={a.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-emerald-400/30 bg-emerald-500/5 p-4">
              <div>
                <p className="font-bold text-white">{a.title}</p>
                <p className="text-xs text-amber-200/80">
                  Terbit · tenggat {whenLabel(a.due_at)} · {SUBMISSION_LABEL[a.submission_type]}
                </p>
              </div>
              <Link href={`/portal/tutor/tugas?id=${a.id}`} className="font-black text-orange hover:text-orange-light">
                Lihat pengumpulan →
              </Link>
            </div>
          ))}
          {running ? (
            <>
              {module?.tasks
                .filter((t) => !published.has(t.id))
                .map((t) => (
                  <PublishTaskForm key={t.id} sessionId={s.id} task={t} defaultDue={defaultDue} />
                ))}
              <PublishTaskForm sessionId={s.id} task={null} defaultDue={defaultDue} />
            </>
          ) : (
            <p className="text-sm text-slate-400">Batch sudah selesai; tugas baru tidak bisa diterbitkan.</p>
          )}
        </div>
      </Panel>
    </div>
  );
}

export async function TutorTasks({ viewer, params }: { viewer: Viewer; params: Record<string, string | undefined> }) {
  if (params.id) return TutorTaskDetail({ viewer, id: params.id });
  const list = await tutorAssignments(viewer.id);
  const groups = {
    nilai: list.filter((a) => a.waiting > 0),
    semua: list,
  };
  const tab = (params.tab as keyof typeof groups) in groups ? (params.tab as keyof typeof groups) : groups.nilai.length ? "nilai" : "semua";
  return (
    <div className="fade-in space-y-6">
      <PageHeader title="Tugas" subtitle="Terbitkan tugas dari halaman sesi. Di sini kamu memberi feedback atas pengumpulan siswa." />
      <Tabs
        active={tab}
        tabs={[
          { key: "nilai", label: "Perlu feedback", count: groups.nilai.length, href: "/portal/tutor/tugas?tab=nilai" },
          { key: "semua", label: "Semua tugas", count: groups.semua.length, href: "/portal/tutor/tugas?tab=semua" },
        ]}
      />
      <Panel>
        {groups[tab].length === 0 ? (
          <EmptyState icon="task" title={tab === "nilai" ? "Semua pengumpulan sudah diberi feedback" : "Belum ada tugas"} text={tab === "semua" ? "Terbitkan tugas dari halaman Sesi & Absensi." : undefined} />
        ) : (
          <ul className="space-y-2">
            {groups[tab].map((a) => (
              <li key={a.id}>
                <Link href={`/portal/tutor/tugas?id=${a.id}`} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-orange/20 px-4 py-3 hover:border-orange/60">
                  <span className="min-w-0">
                    <span className="block font-bold text-white">{a.title}</span>
                    <span className="block text-xs text-amber-200/70">
                      {a.batch_code} · tenggat {whenLabel(a.due_at)} · {a.students - a.notSubmitted}/{a.students} dikumpulkan
                    </span>
                  </span>
                  <span className="flex items-center gap-2">
                    {a.waiting > 0 ? <Badge tone="orange">{a.waiting} perlu feedback</Badge> : a.done === a.students && a.students > 0 ? <Badge tone="green">Semua diterima</Badge> : <Badge>Tidak ada antrean</Badge>}
                    <span className="text-xs font-black text-orange">Buka →</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}

async function TutorTaskDetail({ viewer, id }: { viewer: Viewer; id: string }) {
  const d = await assignmentDetail(id, viewer.id);
  if (!d) return <Notice tone="red">Tugas tidak ditemukan atau bukan bagian dari kelasmu.</Notice>;
  const { assignment: a, batch, students } = d;
  const order = { waiting: 0, revision: 1, todo: 2, done: 3 } as const;
  return (
    <div className="fade-in space-y-6">
      <PageHeader
        title={a.title}
        subtitle={`${batch.code} · ${batch.program.name} · tenggat ${whenLabel(a.due_at)} · ${SUBMISSION_LABEL[a.submission_type]}`}
        action={
          <Link href="/portal/tutor/tugas" className="text-sm font-bold text-orange">
            ← Semua tugas
          </Link>
        }
      />
      <Panel title="Instruksi">
        <p className="whitespace-pre-line text-sm text-amber-50">{a.instructions}</p>
        <p className="mt-2 text-xs text-amber-200/70">Diterbitkan {formatDateTime(a.created_at)} · batch mulai {longDate(batch.start_date)}</p>
      </Panel>
      <Panel title={`Pengumpulan siswa (${students.length})`}>
        {students.length === 0 ? (
          <EmptyState icon="users" title="Belum ada siswa aktif di batch ini" />
        ) : (
          <ul className="space-y-2">
            {[...students]
              .sort((x, y) => order[x.state] - order[y.state])
              .map((st, i) => {
                const last = st.versions[st.versions.length - 1];
                return (
                  <li key={st.student_id}>
                    <details open={i === 0 && st.state === "waiting"} className="group rounded-xl border border-orange/20 open:border-orange/60">
                      <summary className="flex cursor-pointer list-none flex-wrap items-center justify-between gap-3 px-4 py-3">
                        <span>
                          <span className="block font-bold text-white">{st.full_name}</span>
                          <span className="block text-xs text-amber-200/70">
                            {last ? `${last.version === 1 ? "Dikumpulkan" : `Revisi ${last.version - 1}`} ${formatDateTime(last.submitted_at)}${last.is_late ? " · terlambat" : ""}` : "Belum mengumpulkan"}
                            {!st.has_account ? " · lewat akun wali" : ""}
                          </span>
                        </span>
                        <span className="flex items-center gap-2">
                          <TaskStateBadge state={st.state} />
                          <span className="text-xs text-orange group-open:rotate-180">▾</span>
                        </span>
                      </summary>
                      <div className="space-y-4 border-t border-orange/15 px-4 py-4">
                        {st.versions.length === 0 ? (
                          <p className="text-sm text-slate-400">Belum mengumpulkan.</p>
                        ) : (
                          <>
                            {last.status === "submitted" && (
                              <FeedbackForm
                                key={last.id}
                                submissionId={last.id}
                                draft={last.feedback ? { body: last.feedback.body, decision: last.feedback.decision } : null}
                                canRevise={last.version < 3}
                              />
                            )}
                            <SubmissionHistory versions={st.versions} showDrafts />
                          </>
                        )}
                      </div>
                    </details>
                  </li>
                );
              })}
          </ul>
        )}
      </Panel>
    </div>
  );
}
