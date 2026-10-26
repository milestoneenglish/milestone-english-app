import Link from "next/link";
import { AUTO_SECTIONS, goalLabel, SECTION_LABEL } from "@/lib/placement/levels";
import { PlacementError } from "@/lib/placement/server";
import { evaluators, placementQueue, reviewData, type QueueItem } from "@/lib/placement/staff";
import type { Viewer } from "@/lib/session";
import { activePrograms } from "@/lib/students";
import { PlacementResult, RubricSummary } from "../journey";
import { EmptyState, formatDateTime, Notice, PageHeader, Panel, Tabs } from "../ui";
import { AssignForm, PublishForm, RetestForm, ReviewForm } from "./placement-forms";
import { PlacementStatusBadge } from "./student";

function dueLabel(submittedAt: string | null) {
  if (!submittedAt) return "";
  const due = Date.parse(submittedAt) + 24 * 3600 * 1000;
  const hours = Math.round((due - Date.now()) / 3600000);
  return hours >= 0 ? `sisa ${hours} jam` : `lewat ${-hours} jam`;
}

function QueueTable({ items, base, assign }: { items: QueueItem[]; base: string; assign?: { id: string; name: string }[] }) {
  if (items.length === 0) return <EmptyState title="Tidak ada antrean" text="Semua placement di bagian ini sudah ditangani." />;
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[640px] text-sm">
        <thead>
          <tr className="border-b border-orange/30 text-left text-xs text-amber-200/80">
            <th className="py-2 pr-3 font-black">Siswa</th>
            <th className="py-2 pr-3 font-black">Dikirim</th>
            <th className="py-2 pr-3 font-black">Status</th>
            <th className="py-2 pr-3 font-black">Penilai</th>
            <th className="py-2 font-black" />
          </tr>
        </thead>
        <tbody>
          {items.map((a) => {
            const late = a.status === "awaiting_review" && a.submitted_at && Date.parse(a.submitted_at) + 24 * 3600 * 1000 < Date.now();
            return (
              <tr key={a.id} className="border-b border-orange/10 align-middle">
                <td className="py-3 pr-3">
                  <p className="font-bold text-white">{a.student_name}</p>
                  {a.retest_of && <p className="text-[11px] text-amber-200/80">Tes ulang</p>}
                </td>
                <td className="py-3 pr-3 text-amber-100">
                  {formatDateTime(a.submitted_at)}
                  {a.status === "awaiting_review" && <span className={`block text-[11px] font-bold ${late ? "text-rose-300" : "text-amber-200/80"}`}>{dueLabel(a.submitted_at)}</span>}
                </td>
                <td className="py-3 pr-3">
                  <PlacementStatusBadge status={a.status} />
                </td>
                <td className="py-3 pr-3">{assign && a.status === "awaiting_review" ? <AssignForm attemptId={a.id} evaluators={assign} current={a.evaluator_id} /> : <span className="text-amber-100">{a.evaluator_name ?? "-"}</span>}</td>
                <td className="py-3 text-right">
                  <Link href={`${base}?id=${a.id}`} className="font-black text-orange hover:text-orange-light">
                    Buka →
                  </Link>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

async function AttemptDetail({ id, viewer, mode }: { id: string; viewer: Viewer; mode: "tutor" | "lead" }) {
  let data;
  try {
    data = await reviewData(id);
  } catch (e) {
    if (e instanceof PlacementError) return <Notice tone="red">{e.message}</Notice>;
    throw e;
  }
  const { attempt, student, writing, speaking } = data;
  const isLead = mode === "lead";
  if (!isLead && attempt.evaluator_id !== viewer.id) return <Notice tone="red">Tes ini tidak ditugaskan kepadamu.</Notice>;
  const back = isLead ? "/portal/lead/placement" : "/portal/tutor/placement";
  const programs = await activePrograms();
  const age = student.birth_year ? new Date().getFullYear() - student.birth_year : null;

  return (
    <div className="space-y-6">
      <PageHeader
        title={student.full_name}
        subtitle={`${age !== null ? `Usia ±${age} tahun · ` : ""}Tujuan: ${goalLabel(student.learning_goal)} · dikirim ${formatDateTime(attempt.submitted_at)}`}
        action={
          <Link href={back} className="text-sm font-black text-orange">
            ← Kembali ke antrean
          </Link>
        }
      />
      <Panel title="Pilihan ganda (dinilai otomatis)">
        <ul className="grid gap-2 sm:grid-cols-3">
          {AUTO_SECTIONS.map((s) => (
            <li key={s} className="lp-card-soft px-4 py-3 text-sm">
              <p className="text-xs font-bold text-amber-200/80">{SECTION_LABEL[s]}</p>
              <p className="font-black text-white">
                {attempt.auto_scores[s]?.correct ?? 0}/{attempt.auto_scores[s]?.total ?? 0} benar · <span className="text-orange">{attempt.levels[s] ?? "-"}</span>
              </p>
            </li>
          ))}
        </ul>
      </Panel>
      <Panel title="Jawaban writing">
        {writing.length === 0 || writing.every((w) => !w.text?.trim()) ? (
          <p className="text-sm text-slate-400">Tidak ada jawaban writing.</p>
        ) : (
          writing.map((w, i) => (
            <div key={i} className="space-y-2">
              <p className="text-xs font-bold text-amber-200/80">{w.prompt}</p>
              <div className="whitespace-pre-line rounded-xl border border-orange/25 bg-navy p-4 text-sm leading-relaxed text-amber-50">{w.text}</div>
              <p className="text-xs text-slate-400">{w.text?.trim().split(/\s+/).length ?? 0} kata</p>
            </div>
          ))
        )}
      </Panel>
      <Panel title="Rekaman speaking">
        {speaking.every((s) => !s.audioUrl) ? (
          <p className="text-sm text-slate-400">Tidak ada rekaman speaking. Hasil speaking akan kosong.</p>
        ) : (
          <div className="space-y-4">
            {speaking.map((s, i) => (
              <div key={i}>
                <p className="mb-2 text-xs font-bold text-amber-200/80">{s.prompt}</p>
                {s.audioUrl ? <audio controls src={s.audioUrl} className="w-full" /> : <p className="text-sm text-slate-400">Tidak direkam.</p>}
              </div>
            ))}
          </div>
        )}
      </Panel>

      {attempt.status === "awaiting_review" && (
        <Panel title="Penilaian">
          <ReviewForm attemptId={attempt.id} hasWriting={writing.some((w) => w.text?.trim())} hasSpeaking={speaking.some((s) => s.audioUrl)} backHref={back} />
        </Panel>
      )}
      {attempt.status === "reviewed" && (
        <Panel title="Hasil penilaian">
          <div className="space-y-5">
            <RubricSummary attempt={attempt} />
            <p className="text-sm text-amber-100">
              Level keseluruhan: <span className="font-black text-orange">{attempt.levels.overall ?? "-"}</span>
              {attempt.review_comment && <span className="mt-2 block text-amber-100">Catatan tutor: {attempt.review_comment}</span>}
            </p>
            {isLead ? (
              <PublishForm attemptId={attempt.id} programs={programs.map((p) => ({ id: p.id, name: p.name, category: p.category }))} recommended={attempt.recommended_program_ids} />
            ) : (
              <Notice tone="green">Penilaian tersimpan. Academic Lead akan menerbitkan hasilnya.</Notice>
            )}
          </div>
        </Panel>
      )}
      {attempt.status === "published" && (
        <>
          <Panel title="Hasil yang terbit">
            <PlacementResult attempt={attempt} programs={programs} />
          </Panel>
          {isLead && (
            <Panel title="Tes ulang">
              <p className="mb-3 text-sm text-slate-400">Hasil lama tetap tersimpan. Siswa akan mendapat tes baru di portalnya.</p>
              <RetestForm attemptId={attempt.id} />
            </Panel>
          )}
        </>
      )}
    </div>
  );
}

export async function TutorPlacement({ viewer, params }: { viewer: Viewer; params: Record<string, string | undefined> }) {
  if (params.id) return <AttemptDetail id={params.id} viewer={viewer} mode="tutor" />;
  const items = await placementQueue({ evaluatorId: viewer.id });
  const waiting = items.filter((a) => a.status === "awaiting_review");
  const done = items.filter((a) => a.status !== "awaiting_review");
  return (
    <div className="fade-in space-y-6">
      <PageHeader title="Penilaian placement" subtitle="Nilai writing dan speaking paling lambat 1×24 jam sejak tes dikirim." />
      <Panel title={`Perlu dinilai (${waiting.length})`}>
        <QueueTable items={waiting} base="/portal/tutor/placement" />
      </Panel>
      <Panel title="Sudah dinilai">
        <QueueTable items={done} base="/portal/tutor/placement" />
      </Panel>
    </div>
  );
}

export async function LeadPlacement({ viewer, params }: { viewer: Viewer; params: Record<string, string | undefined> }) {
  if (params.id) return <AttemptDetail id={params.id} viewer={viewer} mode="lead" />;
  const [items, people] = await Promise.all([placementQueue(), evaluators()]);
  const groups = {
    menunggu: items.filter((a) => a.status === "awaiting_review"),
    siap: items.filter((a) => a.status === "reviewed"),
    terbit: items.filter((a) => a.status === "published"),
  };
  const tab = (params.tab as keyof typeof groups) in groups ? (params.tab as keyof typeof groups) : "menunggu";
  const unassigned = groups.menunggu.filter((a) => !a.evaluator_id).length;
  return (
    <div className="fade-in space-y-6">
      <PageHeader title="Placement" subtitle="Tugaskan penilai, tinjau hasil, lalu terbitkan ke siswa." />
      {unassigned > 0 && <Notice>{unassigned} tes belum punya penilai. Tugaskan agar hasil terbit tepat waktu.</Notice>}
      <Tabs
        active={tab}
        tabs={[
          { key: "menunggu", label: "Menunggu penilaian", count: groups.menunggu.length, href: "/portal/lead/placement?tab=menunggu" },
          { key: "siap", label: "Siap terbit", count: groups.siap.length, href: "/portal/lead/placement?tab=siap" },
          { key: "terbit", label: "Sudah terbit", count: groups.terbit.length, href: "/portal/lead/placement?tab=terbit" },
        ]}
      />
      <Panel>
        <QueueTable items={groups[tab]} base="/portal/lead/placement" assign={tab === "menunggu" ? people : undefined} />
      </Panel>
    </div>
  );
}
