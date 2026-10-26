// Membuat supabase/seed.sql dari src/data/catalog.ts.
// Jalankan: npm run seed:generate
import { writeFileSync } from "node:fs";
import { SEED_FAQS, SEED_PROGRAMS, SEED_SETTINGS } from "../src/data/catalog";

const q = (value: string) => `'${value.replace(/'/g, "''")}'`;

const programs = SEED_PROGRAMS.map(
  (p) =>
    `  (${q(p.code)}, ${q(p.slug)}, ${q(p.name)}, ${q(p.category)}, ${q(p.entry_level)}, ${q(p.duration_label)}, ${p.capacity}, ${p.price_idr}, ${q(p.outcome)}, ${q(p.evidence)}, ${p.featured}, ${p.sort_order})`,
).join(",\n");

const faqs = SEED_FAQS.map((f) => `  (${q(f.question)}, ${q(f.answer)}, ${f.sort_order})`).join(",\n");

const settings = Object.entries(SEED_SETTINGS)
  .map(([key, value]) => `  (${q(key)}, ${q(JSON.stringify(value))}::jsonb)`)
  .join(",\n");

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
`;

writeFileSync(new URL("../supabase/seed.sql", import.meta.url), sql);
console.log("supabase/seed.sql diperbarui.");
