import Link from "next/link";
import { SECTION_LABEL, SECTIONS } from "@/lib/placement/levels";
import { createClient } from "@/lib/supabase/server";
import { Badge, EmptyState, PageHeader, Panel } from "../ui";
import { QuestionForm } from "./question-form";

type Row = {
  id: string;
  section: (typeof SECTIONS)[number];
  group_key: string | null;
  passage: string | null;
  audio_path: string | null;
  prompt: string;
  options: string[] | null;
  answer_index: number | null;
  cefr: string | null;
  sort_order: number;
  active: boolean;
};

export async function QuestionBank({ params }: { params: Record<string, string | undefined> }) {
  // Dibaca dengan sesi pengguna: hanya Lead dan Owner yang lolos aturan RLS.
  const supabase = await createClient();
  const { data } = await supabase.from("placement_questions").select("id, section, group_key, passage, audio_path, prompt, options, answer_index, cefr, sort_order, active").order("sort_order");
  const rows = (data ?? []) as Row[];

  if (params.id || params.baru) {
    const row = rows.find((r) => r.id === params.id);
    const section = row?.section ?? (SECTIONS.includes(params.baru as Row["section"]) ? (params.baru as Row["section"]) : "grammar");
    return (
      <div className="fade-in mx-auto max-w-3xl space-y-6">
        <PageHeader
          title={row ? "Ubah soal" : "Soal baru"}
          subtitle={SECTION_LABEL[section]}
          action={
            <Link href="/portal/lead/bank-soal" className="text-sm font-black text-orange">
              ← Kembali ke bank soal
            </Link>
          }
        />
        <Panel>
          <QuestionForm
            hasAudio={Boolean(row?.audio_path)}
            initial={{
              id: row?.id,
              section,
              group_key: row?.group_key ?? "",
              passage: row?.passage ?? "",
              prompt: row?.prompt ?? "",
              options: row?.options ?? [],
              answer_index: row?.answer_index ?? null,
              cefr: row?.cefr ?? "",
              sort_order: row?.sort_order ?? (rows.at(-1)?.sort_order ?? 0) + 1,
              active: row?.active ?? true,
            }}
          />
        </Panel>
      </div>
    );
  }

  return (
    <div className="fade-in space-y-6">
      <PageHeader title="Bank soal placement" subtitle="Draf awal disusun sistem; tinjau, ubah, atau nonaktifkan soal sesuai standar akademik Milestone." />
      {SECTIONS.map((section) => {
        const list = rows.filter((r) => r.section === section);
        const active = list.filter((r) => r.active).length;
        return (
          <Panel key={section}>
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-lg font-black text-orange">
                {SECTION_LABEL[section]} <span className="text-sm font-bold text-amber-200/80">· {active} soal aktif</span>
              </h2>
              <Link href={`/portal/lead/bank-soal?baru=${section}`} className="rounded-full border border-orange/50 px-4 py-2 text-xs font-black text-orange hover:bg-orange/10">
                + Tambah soal
              </Link>
            </div>
            {list.length === 0 ? (
              <EmptyState title="Belum ada soal" />
            ) : (
              <ul className="divide-y divide-orange/10">
                {list.map((r) => (
                  <li key={r.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                    <div className="min-w-0 flex-1">
                      <p className={`truncate text-sm font-bold ${r.active ? "text-white" : "text-slate-500 line-through"}`}>{r.prompt}</p>
                      <p className="text-[11px] text-amber-200/70">
                        {r.group_key ? `${r.group_key} · ` : ""}
                        {r.options ? `Jawaban: ${String.fromCharCode(65 + (r.answer_index ?? 0))}. ${r.options[r.answer_index ?? 0]}` : "Dinilai tutor"}
                        {r.section === "listening" ? (r.audio_path ? " · audio asli" : " · suara browser") : ""}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {r.cefr && <Badge tone="orange">{r.cefr}</Badge>}
                      {!r.active && <Badge>Nonaktif</Badge>}
                      <Link href={`/portal/lead/bank-soal?id=${r.id}`} className="text-xs font-black text-orange">
                        Ubah →
                      </Link>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        );
      })}
    </div>
  );
}
