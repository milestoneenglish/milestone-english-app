import { studentEnrollments } from "@/lib/classes";
import { activePrograms, guardianChildren } from "@/lib/students";
import { goalLabel } from "@/lib/placement/levels";
import type { Viewer } from "@/lib/session";
import { journeyStage, JourneyStepper, NextStepCard, PlacementResult } from "../journey";
import { Badge, EmptyState, Notice, PageHeader, Panel } from "../ui";
import { AddChildForm } from "./add-child-form";
import { ClassStep, currentEnrollment } from "./classes";
import { PlacementStatusBadge } from "./student";

const RELATION: Record<string, string> = { orang_tua: "Orang tua", wali: "Wali", lainnya: "Lainnya" };

function LinkBadge({ status }: { status: string }) {
  return status === "verified" ? <Badge tone="green">Hubungan terverifikasi</Badge> : <Badge tone="amber">Menunggu verifikasi admin</Badge>;
}

export async function GuardianHome({ viewer, error }: { viewer: Viewer; error?: string }) {
  const [children, programs] = await Promise.all([guardianChildren(viewer.id), activePrograms()]);
  const enrollments = await studentEnrollments(children.map((c) => c.student.id));
  const firstName = (viewer.fullName || viewer.email).split(/[\s@]/)[0];

  return (
    <div className="fade-in mx-auto max-w-5xl space-y-6">
      <PageHeader title={`Halo, ${firstName}!`} subtitle="Pantau perjalanan belajar setiap anak dari sini." />
      {error && <Notice tone="red">{error}</Notice>}
      {children.length === 0 && <EmptyState icon="users" title="Belum ada anak terdaftar" text="Tambahkan anak dari menu Anak Saya." />}
      {children.map(({ student, link, attempt }) => {
        const current = currentEnrollment(enrollments.filter((e) => e.student_id === student.id));
        const stage = journeyStage(attempt, current);
        const learner = { student, attempt, linkStatus: link.status };
        const classStep =
          attempt?.status === "published" || current ? <ClassStep learner={learner} enrollment={current} base="/portal/guardian" query={`?anak=${student.id}`} /> : undefined;
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
  return (
    <div className="fade-in mx-auto max-w-5xl space-y-6">
      <PageHeader title="Anak saya" subtitle="Hubungan wali dan anak diverifikasi tim admin sebelum pendaftaran kelas." />
      {error && <Notice tone="red">{error}</Notice>}
      <Panel title="Daftar anak">
        {children.length === 0 ? (
          <EmptyState icon="users" title="Belum ada anak terdaftar" />
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
                </div>
              </li>
            ))}
          </ul>
        )}
      </Panel>
      <Panel title="Tambah anak">
        <AddChildForm programs={programs.map((p) => ({ id: p.id, name: p.name }))} />
      </Panel>
    </div>
  );
}
