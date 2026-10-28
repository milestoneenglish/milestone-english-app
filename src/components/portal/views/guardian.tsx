import { learnerProgress } from "@/lib/assessment";
import { studentEnrollments } from "@/lib/classes";
import { activePrograms, guardianChildren } from "@/lib/students";
import { goalLabel } from "@/lib/placement/levels";
import type { Viewer } from "@/lib/session";
import Link from "next/link";
import { startStudentTest } from "@/app/placement/actions";
import { journeyStage, JourneyStepper, NextStepCard, PlacementResult } from "../journey";
import { Badge, EmptyState, Notice, greeting, PageHeader, Panel } from "../ui";
import { SkillChart } from "./academic-ui";
import { AddChildButton } from "./add-child-form";
import { ClassStep, currentEnrollment } from "./classes";
import { SurveyPrompt } from "./quality";
import { PlacementPdfLink, placementPdfReady } from "./placement-pdf-link";
import { PlacementStatusBadge } from "./student";
import { WeekPanel } from "./student-learning";

const RELATION: Record<string, string> = { orang_tua: "Orang tua", wali: "Wali", lainnya: "Lainnya" };

function LinkBadge({ status }: { status: string }) {
  return status === "verified" ? <Badge tone="green">Hubungan terverifikasi</Badge> : <Badge tone="amber">Menunggu verifikasi admin</Badge>;
}

export async function GuardianHome({ viewer, error }: { viewer: Viewer; error?: string }) {
  const [children, programs] = await Promise.all([guardianChildren(viewer.id), activePrograms()]);
  const [enrollments, progress] = await Promise.all([
    studentEnrollments(children.map((c) => c.student.id)),
    Promise.all(children.map((c) => learnerProgress(c.student.id, c.student.full_name))),
  ]);
  const firstName = (viewer.fullName || viewer.email).split(/[\s@]/)[0];
  // Anak yang masih perlu tindakan (placement, pilih kelas, bayar) tampil paling atas.
  const ordered = children
    .map((c, i) => ({ ...c, progress: progress[i], current: currentEnrollment(enrollments.filter((e) => e.student_id === c.student.id)) }))
    .map((c) => ({ ...c, stage: journeyStage(c.attempt, c.current) }))
    .sort((a, b) => a.stage - b.stage);

  return (
    <div className="fade-in mx-auto max-w-5xl space-y-6">
      <PageHeader title={greeting(firstName)} subtitle="Pantau perjalanan belajar setiap anak dari sini." />
      {error && <Notice tone="red">{error}</Notice>}
      {children.length === 0 && <EmptyState icon="users" title="Belum ada anak terdaftar" text="Tambahkan anak dari menu Anak Saya." />}
      {children.length > 0 && <SurveyPrompt studentIds={children.map((c) => c.student.id)} />}
      {ordered.map(({ student, link, attempt, current, stage, progress }) => {
        const learner = { student, attempt, linkStatus: link.status };
        const classStep =
          attempt?.status === "published" || current ? <ClassStep learner={learner} enrollment={current} base="/portal/guardian" query={`?anak=${student.id}`} /> : undefined;
        // Grafik memakai kelas terbaru yang sudah punya nilai terbit.
        const scored = [...progress].reverse().find((p) => p.summary.indicators.some((i) => Object.keys(i.scores).length));
        return (
          <Panel key={student.id}>
            <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-xl font-black text-orange">{student.full_name}</h2>
                <p className="text-xs text-slate-400">
                  {student.birth_year ? `Lahir ${student.birth_year} · ` : ""}
                  {goalLabel(student.learning_goal)}
                </p>
              </div>
              <LinkBadge status={link.status} />
            </div>
            <JourneyStepper stage={stage} />
            <div className="mt-6 border-t border-orange/15 pt-5">
              <NextStepCard attempt={attempt} studentId={student.id} returnTo="/portal/guardian" who={student.full_name} classStep={classStep} />
            </div>
            {current?.status === "active" && (
              <div className="mt-6">
                <WeekPanel studentId={student.id} role="guardian" />
              </div>
            )}
            {(scored || current?.status === "active") && (
              <div className="mt-6 border-t border-orange/15 pt-5">
                <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                  <p className="text-[11px] font-black uppercase tracking-[0.2em] text-amber-200/80">
                    Perkembangan nilai{scored ? ` · ${scored.cls.enrollment.batch.program.name}` : ""}
                  </p>
                  <Link href={`/portal/guardian/progres?anak=${student.id}`} className="text-xs font-black text-orange hover:underline">
                    Lihat detail →
                  </Link>
                </div>
                {scored ? <SkillChart summary={scored.summary} /> : <p className="text-sm text-slate-400">Grafik tampil setelah tutor menerbitkan assessment awal.</p>}
              </div>
            )}
            {attempt?.status === "published" && stage === 2 && (
              <div className="mt-6 border-t border-orange/15 pt-5">
                <PlacementResult attempt={attempt} programs={programs} />
              </div>
            )}
          </Panel>
        );
      })}
    </div>
  );
}

export async function GuardianChildren({ viewer, error }: { viewer: Viewer; error?: string }) {
  const [children, programs] = await Promise.all([guardianChildren(viewer.id), activePrograms()]);
  const enrollments = await studentEnrollments(children.map((c) => c.student.id));
  return (
    <div className="fade-in mx-auto max-w-5xl space-y-6">
      <PageHeader
        title="Anak saya"
        subtitle="Hubungan wali dan anak diverifikasi tim admin sebelum pendaftaran kelas."
        action={<AddChildButton programs={programs.map((p) => ({ id: p.id, name: p.name }))} />}
      />
      {error && <Notice tone="red">{error}</Notice>}
      <Panel title={`Daftar anak (${children.length})`}>
        {children.length === 0 ? (
          <EmptyState icon="users" title="Belum ada anak terdaftar" text="Klik Tambah anak untuk mendaftarkan anak, lalu kerjakan placement test-nya." />
        ) : (
          <ul className="divide-y divide-orange/10">
            {children.map(({ student, link, attempt }) => (
              <li key={student.id} className="flex flex-wrap items-center justify-between gap-3 py-4">
                <div>
                  <p className="font-black text-white">{student.full_name}</p>
                  <p className="text-xs text-slate-400">
                    {RELATION[link.relationship]} · {student.birth_year ? `lahir ${student.birth_year}` : "tahun lahir belum diisi"}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <LinkBadge status={link.status} />
                  {attempt ? <PlacementStatusBadge status={attempt.status} /> : <Badge>Belum placement</Badge>}
                  {!attempt && (
                    <form action={startStudentTest.bind(null, student.id, "/portal/guardian/anak")}>
                      <button className="btn-orange rounded-full px-4 py-2 text-xs">Mulai placement</button>
                    </form>
                  )}
                  {attempt?.status === "in_progress" && (
                    <Link href={`/placement/tes/${attempt.id}`} className="btn-orange rounded-full px-4 py-2 text-xs">
                      Lanjutkan placement
                    </Link>
                  )}
                  {attempt && placementPdfReady(attempt, enrollments.filter((e) => e.student_id === student.id)) && <PlacementPdfLink attemptId={attempt.id} />}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}
