import Link from "next/link";
import { curriculumOverview, getCurriculum, type CurriculumRow, type ModuleRow } from "@/lib/curriculum";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Viewer } from "@/lib/session";
import { Badge, EmptyState, formatDateTime, Notice, PageHeader, Panel } from "../ui";
import { AddModuleForm, CreateCurriculumButton, CurriculumActions, CurriculumMetaForm, ModuleEditor } from "./curriculum-forms";
import { QueueCard } from "./admin-classes";

const STATUS: Record<CurriculumRow["status"], { label: string; tone: "slate" | "green" | "amber" }> = {
  draft: { label: "Draf", tone: "amber" },
  published: { label: "Terbit", tone: "green" },
  archived: { label: "Versi lama", tone: "slate" },
};

export function CurriculumBadge({ status }: { status: CurriculumRow["status"] }) {
  return <Badge tone={STATUS[status].tone}>{STATUS[status].label}</Badge>;
}

// Modul dikelompokkan per minggu untuk tampilan tutor, siswa, dan Academic Lead.
export function byWeek<T extends { week: number }>(modules: T[]) {
  const weeks = new Map<number, T[]>();
  for (const m of modules) weeks.set(m.week, [...(weeks.get(m.week) ?? []), m]);
  return [...weeks.entries()].sort((a, b) => a[0] - b[0]);
}

export async function LeadHome({ viewer }: { viewer: Viewer }) {
  const admin = createAdminClient();
  const [overview, { count: placement }, { count: unassigned }] = await Promise.all([
    curriculumOverview(),
    admin.from("placement_attempts").select("id", { count: "exact", head: true }).eq("status", "reviewed"),
    admin.from("placement_attempts").select("id", { count: "exact", head: true }).eq("status", "awaiting_review").is("evaluator_id", null),
  ]);
  const drafts = overview.flatMap((o) => o.versions.filter((v) => v.status === "draft"));
  const withoutPublished = overview.filter((o) => !o.versions.some((v) => v.status === "published")).length;
  const firstName = (viewer.fullName || viewer.email).split(/[\s@]/)[0];
  return (
    <div className="fade-in space-y-6">
      <PageHeader title={`Halo, ${firstName}!`} subtitle="Perlu tindakan hari ini." />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <QueueCard href="/portal/lead/placement?tab=siap" icon="check" count={placement ?? 0} title="Placement siap terbit" text="Tinjau penilaian tutor lalu terbitkan ke siswa." />
        <QueueCard href="/portal/lead/placement" icon="users" count={unassigned ?? 0} title="Placement belum punya penilai" text="Tugaskan penilai agar hasil keluar ≤1×24 jam." />
        <QueueCard href="/portal/lead/kurikulum" icon="book" count={drafts.length} title="Kurikulum masih draf" text={`${withoutPublished} program belum punya kurikulum terbit, sehingga batch-nya belum bisa memakai modul.`} />
      </div>
    </div>
  );
}

export async function LeadCurriculum({ params }: { params: Record<string, string | undefined> }) {
  if (params.id) return CurriculumDetail({ id: params.id });
  const overview = await curriculumOverview();
  const drafts = overview.filter((o) => o.versions.some((v) => v.status === "draft")).length;
  return (
    <div className="fade-in space-y-6">
      <PageHeader title="Kurikulum" subtitle="Satu sesi satu modul. Isi bisa diperbaiki kapan saja; perubahan jumlah atau urutan sesi dibuat sebagai versi baru." />
      {drafts > 0 && <Notice>{drafts} program punya kurikulum draf. Tinjau lalu terbitkan agar Admin bisa memakainya saat membuka batch.</Notice>}
      <Panel>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead>
              <tr className="border-b border-orange/30 text-left text-xs text-amber-200/80">
                <th className="py-2 pr-3 font-black">Program</th>
                <th className="py-2 pr-3 font-black">Versi</th>
                <th className="py-2 font-black" />
              </tr>
            </thead>
            <tbody>
              {overview.map(({ program, versions }) => (
                <tr key={program.id} className="border-b border-orange/10 align-middle">
                  <td className="py-3 pr-3">
                    <p className="font-black text-white">{program.name}</p>
                    <p className="text-xs text-amber-200/70">
                      {program.category} · {program.duration_label}
                    </p>
                  </td>
                  <td className="py-3 pr-3">
                    {versions.length === 0 ? (
                      <span className="text-xs text-slate-400">Belum ada kurikulum</span>
                    ) : (
                      <ul className="space-y-1">
                        {versions.map((v) => (
                          <li key={v.id} className="flex flex-wrap items-center gap-2 text-xs">
                            <Link href={`/portal/lead/kurikulum?id=${v.id}`} className="font-black text-orange hover:underline">
                              Versi {v.version}
                            </Link>
                            <CurriculumBadge status={v.status} />
                            <span className="text-amber-200/70">
                              {v.modules} sesi{v.batches ? ` · dipakai ${v.batches} batch` : ""}
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </td>
                  <td className="py-3 text-right">
                    {versions.length === 0 ? (
                      <CreateCurriculumButton programId={program.id} />
                    ) : (
                      <Link href={`/portal/lead/kurikulum?id=${versions[0].id}`} className="font-black text-orange hover:text-orange-light">
                        Buka →
                      </Link>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
}

async function CurriculumDetail({ id }: { id: string }) {
  const data = await getCurriculum(id);
  if (!data) return <EmptyState title="Kurikulum tidak ditemukan" />;
  const { curriculum: c, modules, batches, hasDraft } = data;
  const { data: siblings } = await createAdminClient().from("curricula").select("id, version, status").eq("program_id", c.program_id).order("version", { ascending: false });
  const draft = c.status === "draft";
  return (
    <div className="fade-in space-y-6">
      <PageHeader
        title={`${c.program.name} · versi ${c.version}`}
        subtitle={`${c.program.duration_label} · ${modules.length} sesi${c.published_at ? ` · terbit ${formatDateTime(c.published_at)}` : ""}`}
        action={
          <Link href="/portal/lead/kurikulum" className="text-sm font-bold text-orange">
            ← Semua kurikulum
          </Link>
        }
      />
      {(siblings?.length ?? 0) > 1 && (
        <nav className="flex flex-wrap gap-2">
          {siblings!.map((s) => (
            <Link
              key={s.id}
              href={`/portal/lead/kurikulum?id=${s.id}`}
              className={`rounded-full border px-4 py-2 text-xs font-black ${s.id === c.id ? "border-orange bg-orange text-white" : "border-orange/30 text-amber-100 hover:border-orange"}`}
            >
              Versi {s.version} · {STATUS[s.status as CurriculumRow["status"]].label}
            </Link>
          ))}
        </nav>
      )}
      <Panel>
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <CurriculumBadge status={c.status} />
          <p className="text-sm text-amber-100">
            {draft
              ? "Draf: isi dan struktur bebas diubah. Terbitkan agar Admin bisa memakainya untuk batch baru."
              : c.status === "published"
                ? `Isi sesi, materi, dan tugas bisa diubah dan langsung terlihat di ${batches} batch yang memakai versi ini. Jumlah dan urutan sesi terkunci; buat versi baru untuk mengubahnya.`
                : `Versi lama, masih dipakai ${batches} batch. Isinya tetap bisa diperbaiki.`}
          </p>
        </div>
        <CurriculumActions key={c.id} id={c.id} status={c.status} hasDraft={hasDraft} />
        <div className="mt-5 border-t border-orange/15 pt-5">
          <CurriculumMetaForm key={c.id} id={c.id} title={c.title} notes={c.notes} />
        </div>
      </Panel>
      {modules.length === 0 && <EmptyState icon="book" title="Belum ada sesi" text="Tambahkan sesi pertama di bawah." />}
      {byWeek(modules).map(([week, list]) => (
        <section key={week} className="space-y-3">
          <h2 className="text-sm font-black uppercase tracking-[0.18em] text-amber-200/80">Minggu {week}</h2>
          {list.map((m: ModuleRow) => (
            <ModuleEditor key={`${m.id}-${m.seq}-${m.week}`} module={m} draft={draft} isFirst={m.seq === 1} isLast={m.seq === modules.length} />
          ))}
        </section>
      ))}
      {draft && (
        <Panel title="Tambah sesi">
          <AddModuleForm curriculumId={c.id} />
        </Panel>
      )}
    </div>
  );
}
