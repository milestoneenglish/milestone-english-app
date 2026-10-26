import Link from "next/link";
import { Icon } from "@/components/icons";
import { longDate } from "@/lib/classes";
import { SUBMISSION_LABEL } from "@/lib/curriculum";
import { learnerClasses, sessionEnd, weekSummary, whenLabel, type LearnerClass } from "@/lib/learning";
import type { Viewer } from "@/lib/session";
import { Badge, EmptyState, Notice, PageHeader, Panel } from "../ui";
import { ChildTabs, loadLearners, type Learner } from "./classes";
import { byWeek } from "./lead-curriculum";
import { AttendanceBadge, ModuleContent, SubmissionHistory, TaskStateBadge } from "./learning-ui";
import { SubmissionForm } from "./submission-form";

type Role = "student" | "guardian";

// Tautan "Masuk kelas" aktif mulai 30 menit sebelum sesi sampai sesi berakhir.
const joinable = (s: { starts_at: string; duration_minutes: number }) => Date.parse(s.starts_at) - 30 * 60000 <= Date.now() && Date.now() <= sessionEnd(s);

// Siswa mengumpulkan dari akunnya sendiri; anak tanpa akun mengumpulkan lewat wali terverifikasi.
function canSubmit(role: Role, viewer: Viewer, learner: Learner) {
  return role === "student" ? learner.student.user_id === viewer.id : !learner.student.user_id && learner.linkStatus === "verified";
}

async function pickLearner(viewer: Viewer, role: Role, params: Record<string, string | undefined>) {
  const learners = await loadLearners(viewer, role);
  const learner = learners.find((l) => l.student.id === params.anak) ?? learners[0] ?? null;
  return { learners, learner, classes: learner ? await learnerClasses(learner.student.id) : [] };
}

function ClassHeader({ cls }: { cls: LearnerClass }) {
  const { batch } = cls.enrollment;
  const done = cls.enrollment.status === "completed";
  return (
    <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
      <div>
        <p className="text-xs font-bold text-amber-200/80">Batch {batch.code}</p>
        <p className="text-lg font-black text-orange">{batch.program.name}</p>
        <p className="text-xs text-amber-100">
          {batch.schedule_label} · mulai {longDate(batch.start_date)} · tutor {batch.tutor?.full_name ?? "segera diumumkan"}
        </p>
      </div>
      {done ? <Badge>Selesai, baca saja</Badge> : <Badge tone="green">Aktif</Badge>}
    </div>
  );
}

export async function SchedulePage({ viewer, role, params }: { viewer: Viewer; role: Role; params: Record<string, string | undefined> }) {
  const { learners, learner, classes } = await pickLearner(viewer, role, params);
  const base = `/portal/${role}`;
  return (
    <div className="fade-in mx-auto max-w-5xl space-y-6">
      <PageHeader title={role === "guardian" ? "Jadwal & kehadiran" : "Jadwal"} subtitle="Semua sesi kelas dalam WIB, beserta status kehadiran yang diisi tutor." />
      <ChildTabs learners={learners} active={learner?.student.id ?? ""} base={base} section="jadwal" />
      {classes.length === 0 && <EmptyState icon="calendar" title="Belum ada kelas aktif" text="Jadwal tampil setelah pembayaran kelas diverifikasi." />}
      {classes.map((cls) => {
        const started = cls.sessions.filter((s) => Date.parse(s.starts_at) <= Date.now());
        const present = started.filter((s) => s.attendance === "present" || s.attendance === "late").length;
        const active = cls.enrollment.status === "active";
        return (
          <Panel key={cls.enrollment.id}>
            <ClassHeader cls={cls} />
            {started.length > 0 && (
              <p className="mb-3 text-sm text-amber-100">
                Kehadiran: <span className="font-black text-white">{present}</span> dari {started.length} sesi yang sudah berlangsung
              </p>
            )}
            <ul className="divide-y divide-orange/10">
              {cls.sessions.map((s) => {
                const past = Date.parse(s.starts_at) <= Date.now();
                const mod = cls.modules.find((m) => m.id === s.module_id);
                return (
                  <li key={s.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                    <div>
                      <p className="font-bold text-white">
                        Sesi {s.seq}
                        {mod ? <span className="font-normal text-amber-100"> · {mod.title}</span> : null}
                      </p>
                      <p className="text-xs text-amber-200/70">
                        {whenLabel(s.starts_at)} · {s.duration_minutes} menit
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {active && joinable(s) && cls.enrollment.batch.meeting_url ? (
                        <a href={cls.enrollment.batch.meeting_url} target="_blank" rel="noopener noreferrer" className="btn-orange rounded-full px-4 py-2 text-xs">
                          Masuk kelas
                        </a>
                      ) : past ? (
                        <AttendanceBadge status={s.attendance} />
                      ) : (
                        <Badge>Akan datang</Badge>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          </Panel>
        );
      })}
    </div>
  );
}

export async function MaterialsPage({ viewer, role, params }: { viewer: Viewer; role: Role; params: Record<string, string | undefined> }) {
  const { learners, learner, classes } = await pickLearner(viewer, role, params);
  const base = `/portal/${role}`;
  const submitter = learner ? canSubmit(role, viewer, learner) : false;
  return (
    <div className="fade-in mx-auto max-w-5xl space-y-6">
      <PageHeader title="Materi & tugas" subtitle="Materi tiap sesi dan tugas dari tutor. Tugas boleh direvisi sampai 2 kali bila tutor memintanya." />
      <ChildTabs learners={learners} active={learner?.student.id ?? ""} base={base} section="materi" />
      {role === "guardian" && learner && !submitter && (
        <Notice>{learner.student.user_id ? `${learner.student.full_name} mengumpulkan tugas dari akunnya sendiri. Kamu bisa memantau tugas dan feedback di sini.` : "Tugas bisa dikumpulkan dari akun ini setelah hubungan wali diverifikasi admin."}</Notice>
      )}
      {classes.length === 0 && <EmptyState icon="task" title="Belum ada kelas aktif" text="Materi dan tugas tampil setelah pembayaran kelas diverifikasi." />}
      {classes.map((cls) => {
        const active = cls.enrollment.status === "active";
        const sessionOf = (id: string | null) => cls.sessions.find((s) => s.id === id);
        return (
          <div key={cls.enrollment.id} className="space-y-4">
            <Panel>
              <ClassHeader cls={cls} />
              <h2 className="mb-3 text-sm font-black uppercase tracking-[0.18em] text-amber-200/80">Tugas ({cls.assignments.length})</h2>
              {cls.assignments.length === 0 ? (
                <p className="text-sm text-slate-400">Belum ada tugas dari tutor.</p>
              ) : (
                <ul className="space-y-4">
                  {[...cls.assignments].reverse().map((a) => {
                    const s = sessionOf(a.session_id);
                    const overdue = a.state === "todo" && Date.parse(a.due_at) < Date.now();
                    return (
                      <li key={a.id} id={`tugas-${a.id}`} className={`rounded-2xl border p-4 ${params.tugas === a.id ? "border-orange" : "border-orange/20"}`}>
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <p className="font-black text-white">{a.title}</p>
                            <p className={`text-xs ${overdue ? "font-bold text-rose-300" : "text-amber-200/80"}`}>
                              {s ? `Sesi ${s.seq} · ` : ""}Tenggat {whenLabel(a.due_at)}
                              {overdue ? " · lewat tenggat, masih bisa dikumpulkan" : ""} · {SUBMISSION_LABEL[a.submission_type]}
                            </p>
                          </div>
                          <TaskStateBadge state={a.state} />
                        </div>
                        <p className="mt-3 whitespace-pre-line text-sm text-amber-50">{a.instructions}</p>
                        <div className="mt-4 space-y-3">
                          {active && submitter && (a.state === "todo" || a.state === "revision") && (
                            <SubmissionForm assignmentId={a.id} studentId={learner!.student.id} type={a.submission_type} revision={a.state === "revision"} />
                          )}
                          <SubmissionHistory versions={a.versions} />
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </Panel>
            {cls.modules.length > 0 && (
              <Panel title="Materi per sesi">
                <div className="space-y-5">
                  {byWeek(cls.modules.map((m) => ({ ...m, session: cls.sessions.find((s) => s.module_id === m.id) }))).map(([week, list]) => (
                    <section key={week} className="space-y-2">
                      <p className="text-xs font-black uppercase tracking-[0.18em] text-amber-200/80">Minggu {week}</p>
                      {list.map((m) => (
                        <details key={m.id} className="rounded-xl border border-orange/20 open:border-orange/50">
                          <summary className="flex cursor-pointer list-none flex-wrap items-center justify-between gap-2 px-4 py-3">
                            <span className="font-bold text-white">
                              Sesi {m.session?.seq ?? m.seq} · {m.title}
                            </span>
                            <span className="text-xs text-amber-200/70">{m.session ? whenLabel(m.session.starts_at) : ""}</span>
                          </summary>
                          <div className="border-t border-orange/15 px-4 py-4">
                            <ModuleContent module={m} />
                          </div>
                        </details>
                      ))}
                    </section>
                  ))}
                </div>
              </Panel>
            )}
          </div>
        );
      })}
    </div>
  );
}

// Ringkasan "Minggu ini" di beranda siswa/wali untuk kelas yang sedang berjalan.
export async function WeekPanel({ studentId, role, who }: { studentId: string; role: Role; who?: string }) {
  const classes = await learnerClasses(studentId);
  if (!classes.some((c) => c.enrollment.status === "active" && c.enrollment.onboarded_at)) return null;
  const { nextSession, todo, feedback } = weekSummary(classes);
  const base = `/portal/${role}`;
  const q = role === "guardian" ? `?anak=${studentId}` : "";
  return (
    <Panel>
    <div className="space-y-4">
      <p className="text-[11px] font-black uppercase tracking-[0.2em] text-amber-200/80">Minggu ini{who ? ` · ${who}` : ""}</p>
      <div className="grid gap-4 md:grid-cols-3">
        <div className="lp-card-soft p-4">
          <p className="text-[11px] font-bold text-amber-200/70">Sesi berikutnya</p>
          {nextSession ? (
            <>
              <p className="mt-1 font-black text-white">
                Sesi {nextSession.seq} · {whenLabel(nextSession.starts_at)}
              </p>
              <p className="text-xs text-amber-100">{nextSession.cls.modules.find((m) => m.id === nextSession.module_id)?.title ?? nextSession.cls.enrollment.batch.program.name}</p>
              {joinable(nextSession) && nextSession.cls.enrollment.batch.meeting_url && (
                <a href={nextSession.cls.enrollment.batch.meeting_url} target="_blank" rel="noopener noreferrer" className="btn-orange mt-3 inline-flex items-center gap-2 rounded-full px-4 py-2 text-xs">
                  Masuk kelas <Icon name="arrow" className="h-3 w-3" />
                </a>
              )}
            </>
          ) : (
            <p className="mt-1 text-sm text-amber-100">Semua sesi sudah berlangsung.</p>
          )}
        </div>
        <div className="lp-card-soft p-4">
          <p className="text-[11px] font-bold text-amber-200/70">Tugas perlu dikerjakan</p>
          {todo.length === 0 ? (
            <p className="mt-1 text-sm text-amber-100">Tidak ada tugas tertunda.</p>
          ) : (
            <ul className="mt-1 space-y-1 text-sm">
              {todo.slice(0, 3).map((a) => (
                <li key={a.id}>
                  <Link href={`${base}/materi${q}${q ? "&" : "?"}tugas=${a.id}#tugas-${a.id}`} className="font-bold text-orange hover:underline">
                    {a.title}
                  </Link>
                  <span className={`block text-xs ${Date.parse(a.due_at) < Date.now() ? "text-rose-300" : "text-amber-200/70"}`}>
                    {a.state === "revision" ? "Perlu revisi · " : ""}tenggat {whenLabel(a.due_at)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="lp-card-soft p-4">
          <p className="text-[11px] font-bold text-amber-200/70">Feedback baru</p>
          {feedback.length === 0 ? (
            <p className="mt-1 text-sm text-amber-100">Belum ada feedback baru minggu ini.</p>
          ) : (
            <ul className="mt-1 space-y-1 text-sm">
              {feedback.slice(0, 3).map((f) => (
                <li key={f.version.id}>
                  <Link href={`${base}/materi${q}${q ? "&" : "?"}tugas=${f.assignment.id}#tugas-${f.assignment.id}`} className="font-bold text-orange hover:underline">
                    {f.assignment.title}
                  </Link>
                  <span className="block text-xs text-amber-200/70">{f.version.feedback?.decision === "revision" ? "Tutor meminta revisi" : "Diterima tutor"}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
    </Panel>
  );
}
