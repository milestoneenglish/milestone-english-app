import { activePrograms, attemptHistory, ownStudent } from "@/lib/students";
import type { Viewer } from "@/lib/session";
import { formatDateTime, Notice, PageHeader, Panel, Badge, EmptyState } from "../ui";
import { journeyStage, JourneyStepper, NextStepCard, PlacementResult } from "../journey";
import { goalLabel } from "@/lib/placement/levels";

const STATUS_LABEL: Record<string, { label: string; tone: "orange" | "green" | "amber" | "slate" }> = {
  in_progress: { label: "Belum dikirim", tone: "amber" },
  awaiting_review: { label: "Menunggu penilaian", tone: "orange" },
  reviewed: { label: "Menunggu terbit", tone: "orange" },
  published: { label: "Terbit", tone: "green" },
};

export function PlacementStatusBadge({ status }: { status: string }) {
  const s = STATUS_LABEL[status] ?? { label: status, tone: "slate" as const };
  return <Badge tone={s.tone}>{s.label}</Badge>;
}

export async function StudentHome({ viewer, error }: { viewer: Viewer; error?: string }) {
  const [{ student, attempt }, programs] = await Promise.all([ownStudent(viewer.id), activePrograms()]);
  const firstName = (viewer.fullName || viewer.email).split(/[\s@]/)[0];

  if (!student) {
    return (
      <div className="space-y-6">
        <PageHeader title={`Halo, ${firstName}!`} />
        <EmptyState title="Profil siswa belum tersedia" text="Hubungi tim Milestone English agar profil siswamu dibuatkan." />
      </div>
    );
  }

  const published = attempt?.status === "published" ? attempt : null;
  const interested = programs.find((p) => p.id === student.interested_program_id);

  return (
    <div className="fade-in mx-auto max-w-5xl space-y-6">
      <PageHeader title={`Halo, ${firstName}!`} subtitle={`Tujuan belajar: ${goalLabel(student.learning_goal) || "-"}${interested ? ` · Minat: ${interested.name}` : ""}`} />
      {error && <Notice tone="red">{error}</Notice>}
      <Panel>
        <JourneyStepper stage={journeyStage(attempt)} />
      </Panel>
      <Panel>
        <NextStepCard attempt={attempt} studentId={student.id} returnTo="/portal/student" />
      </Panel>
      {published && (
        <Panel title="Hasil placement test">
          <PlacementResult attempt={published} programs={programs} />
        </Panel>
      )}
    </div>
  );
}

export async function StudentPlacement({ viewer, error }: { viewer: Viewer; error?: string }) {
  const [{ student, attempt }, programs] = await Promise.all([ownStudent(viewer.id), activePrograms()]);
  if (!student) return <EmptyState title="Profil siswa belum tersedia" />;
  const history = await attemptHistory(student.id);
  const lastPublished = history.find((a) => a.status === "published");

  return (
    <div className="fade-in mx-auto max-w-5xl space-y-6">
      <PageHeader title="Placement test" subtitle="Tes wajib untuk mengetahui level awal dan kelas yang paling cocok." />
      {error && <Notice tone="red">{error}</Notice>}
      <Panel>
        <NextStepCard attempt={attempt} studentId={student.id} returnTo="/portal/student/placement" />
      </Panel>
      {lastPublished && (
        <Panel title="Hasil terbit terakhir">
          <PlacementResult attempt={lastPublished} programs={programs} />
        </Panel>
      )}
      {history.length > 0 && (
        <Panel title="Riwayat tes">
          <ul className="divide-y divide-orange/10">
            {history.map((a) => (
              <li key={a.id} className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm">
                <span className="text-amber-100">
                  {a.retest_of ? "Tes ulang" : "Tes awal"} · dikirim {formatDateTime(a.submitted_at)}
                </span>
                <span className="flex items-center gap-3">
                  {a.status === "published" && <span className="font-black text-orange">{a.levels.overall}</span>}
                  <PlacementStatusBadge status={a.status} />
                </span>
              </li>
            ))}
          </ul>
        </Panel>
      )}
    </div>
  );
}
