// Membuat supabase/seed.sql dari src/data/catalog.ts.
// Jalankan: npm run seed:generate
import { writeFileSync } from "node:fs";
import { SEED_FAQS, SEED_PROGRAMS, SEED_SETTINGS } from "../src/data/catalog";
import { SEED_CURRICULA } from "../src/data/curriculum";
import { SEED_RUBRICS } from "../src/data/rubrics";
import { PLACEMENT_BANK } from "../src/data/placement-bank";

const q = (value: string) => `'${value.replace(/'/g, "''")}'`;

const programs = SEED_PROGRAMS.map(
  (p) =>
    `  (${q(p.code)}, ${q(p.slug)}, ${q(p.name)}, ${q(p.category)}, ${q(p.entry_level)}, ${q(p.duration_label)}, ${p.capacity}, ${p.price_idr}, ${q(p.outcome)}, ${q(p.evidence)}, ${p.featured}, ${p.sort_order})`,
).join(",\n");

const faqs = SEED_FAQS.map((f) => `  (${q(f.question)}, ${q(f.answer)}, ${f.sort_order})`).join(",\n");

const settings = Object.entries(SEED_SETTINGS)
  .map(([key, value]) => `  (${q(key)}, ${q(JSON.stringify(value))}::jsonb)`)
  .join(",\n");

const nullable = (value: string | number | undefined) => (value === undefined ? "null" : typeof value === "number" ? String(value) : q(value));

const questions = PLACEMENT_BANK.map(
  (x) =>
    `  (${q(x.section)}, ${nullable(x.group_key)}, ${nullable(x.passage)}, ${q(x.prompt)}, ${x.options ? `${q(JSON.stringify(x.options))}::jsonb` : "null"}, ${nullable(x.answer_index)}, ${nullable(x.cefr)}, ${x.sort_order})`,
).join(",\n");

// Titik assessment bawaan: awal di sesi pertama, tengah di pertengahan (lebih dari 4 sesi), akhir di sesi terakhir.
const assessmentAt = (seq: number, count: number) =>
  seq === 1 ? q("baseline") : seq === count ? q("final") : count > 4 && seq === Math.ceil(count / 2) ? q("mid") : "null";

// Satu modul per sesi; minggu dihitung dari jumlah sesi dan durasi program.
const curricula = SEED_CURRICULA.map((c) => {
  const program = SEED_PROGRAMS.find((p) => p.code === c.program)!;
  const count = c.modules.length;
  const modules = c.modules
    .map((x, i) => `  (${i + 1}, ${Math.ceil(((i + 1) * c.weeks) / count)}, ${q(x.title)}, ${q(x.objectives)}, ${q(x.content)}, ${assessmentAt(i + 1, count)})`)
    .join(",\n");
  const tasks = c.modules.map((x, i) => `  (${i + 1}, ${q(x.task.title)}, ${q(x.task.instructions)}, ${q(x.task.type)})`).join(",\n");
  return `with c as (
  insert into public.curricula (program_id, version, title)
  select p.id, 1, ${q(`Kurikulum ${program.name}`)} from public.programs p
  where p.code = ${q(c.program)} and not exists (select 1 from public.curricula x where x.program_id = p.id)
  returning id
), mods as (
  insert into public.curriculum_modules (curriculum_id, seq, week, title, objectives, content, assessment)
  select c.id, v.seq, v.week, v.title, v.objectives, v.content, v.assessment from c, (values
${modules}
  ) as v(seq, week, title, objectives, content, assessment)
  returning id, seq
)
insert into public.module_tasks (module_id, title, instructions, submission_type)
select mods.id, v.title, v.instructions, v.type from mods join (values
${tasks}
) as v(seq, title, instructions, type) on v.seq = mods.seq;`;
}).join("\n\n");

// Rubrik draf untuk setiap kurikulum program yang belum punya indikator.
const rubrics = Object.entries(SEED_RUBRICS)
  .map(([code, list]) => {
    const rows = list.map((x, i) => `  (${i + 1}, ${q(x.skill)}, ${q(x.label)}, ${q(JSON.stringify(x.levels))})`).join(",\n");
    return `insert into public.rubric_indicators (curriculum_id, seq, skill, label, descriptors)
select c.id, v.seq, v.skill, v.label, v.descriptors::jsonb
from public.curricula c join public.programs p on p.id = c.program_id, (values
${rows}
) as v(seq, skill, label, descriptors)
where p.code = ${q(code)} and not exists (select 1 from public.rubric_indicators r where r.curriculum_id = c.id);`;
  })
  .join("\n\n");

const sql = `-- Dibuat otomatis oleh scripts/generate-seed.ts. Jangan diedit manual.

insert into public.programs (code, slug, name, category, entry_level, duration_label, capacity, price_idr, outcome, evidence, featured, sort_order) values
${programs}
on conflict (code) do nothing;

insert into public.faqs (question, answer, sort_order)
select * from (values
${faqs}
) as v(question, answer, sort_order)
where not exists (select 1 from public.faqs);

insert into public.site_settings (key, value) values
${settings}
on conflict (key) do nothing;

-- Draf bank soal placement; hanya diisi saat tabel masih kosong.
insert into public.placement_questions (section, group_key, passage, prompt, options, answer_index, cefr, sort_order)
select * from (values
${questions}
) as v(section, group_key, passage, prompt, options, answer_index, cefr, sort_order)
where not exists (select 1 from public.placement_questions);

-- Draf kurikulum versi 1 untuk ditinjau Academic Lead; hanya untuk program yang belum punya kurikulum.
${curricula}

-- Draf rubrik per program; hanya untuk kurikulum yang belum punya indikator.
${rubrics}
`;

writeFileSync(new URL("../supabase/seed.sql", import.meta.url), sql);
console.log("supabase/seed.sql diperbarui.");
