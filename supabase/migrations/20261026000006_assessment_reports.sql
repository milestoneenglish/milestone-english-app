-- Fase 4: rubrik per kurikulum, titik assessment per sesi, assessment siswa, dan laporan akhir.
-- Daftar indikator dan titik assessment ikut terkunci saat kurikulum terbit, supaya nilai awal
-- dan akhir selalu dibandingkan dengan indikator yang sama. Teks indikator tetap bisa diperbaiki.

-- ---------------------------------------------------------------------------
-- Rubrik dan titik assessment
-- ---------------------------------------------------------------------------

create table public.rubric_indicators (
  id uuid primary key default gen_random_uuid(),
  curriculum_id uuid not null references public.curricula (id) on delete cascade,
  seq integer not null check (seq between 1 and 20),
  skill text not null check (skill in ('grammar', 'reading', 'listening', 'writing', 'speaking')),
  label text not null check (char_length(label) between 2 and 120),
  descriptors jsonb not null default '["", "", "", ""]'::jsonb
    check (jsonb_typeof(descriptors) = 'array' and jsonb_array_length(descriptors) = 4),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (curriculum_id, seq)
);

create trigger rubric_indicators_touch before update on public.rubric_indicators
  for each row execute function public.touch_updated_at();

alter table public.curriculum_modules add column assessment text check (assessment in ('baseline', 'mid', 'final'));
create unique index curriculum_modules_assessment on public.curriculum_modules (curriculum_id, assessment) where assessment is not null;

-- Titik bawaan: baseline di sesi pertama, tengah di sesi pertengahan (program lebih dari 4 sesi), akhir di sesi terakhir.
update public.curriculum_modules m
set assessment = case
  when m.seq = 1 then 'baseline'
  when m.seq = x.n then 'final'
  when x.n > 4 and m.seq = ceil(x.n / 2.0) then 'mid'
end
from (select curriculum_id, count(*)::int as n from public.curriculum_modules group by curriculum_id) x
where x.curriculum_id = m.curriculum_id and x.n >= 2;

create or replace function public.set_module_assessment(p_module uuid, p_kind text) returns void
language plpgsql security definer set search_path = public as $$
declare
  m public.curriculum_modules;
  c public.curricula;
begin
  select * into m from public.curriculum_modules where id = p_module;
  if m.id is null then
    raise exception 'Modul tidak ditemukan.' using errcode = '22023';
  end if;
  c := public.draft_curriculum(m.curriculum_id);
  if p_kind is not null and p_kind not in ('baseline', 'mid', 'final') then
    raise exception 'Jenis assessment tidak valid.' using errcode = '22023';
  end if;
  -- Satu titik per jenis: tanda dipindahkan dari sesi lain bila ada.
  if p_kind is not null then
    update public.curriculum_modules set assessment = null where curriculum_id = c.id and assessment = p_kind and id <> m.id;
  end if;
  update public.curriculum_modules set assessment = p_kind where id = m.id;
end;
$$;

create or replace function public.add_rubric_indicator(p_curriculum uuid, p_skill text, p_label text) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  c public.curricula := public.draft_curriculum(p_curriculum);
  next_seq integer;
  new_id uuid;
begin
  if p_skill not in ('grammar', 'reading', 'listening', 'writing', 'speaking') then
    raise exception 'Pilih keterampilan indikator.' using errcode = '22023';
  end if;
  if char_length(trim(coalesce(p_label, ''))) < 2 then
    raise exception 'Tulis nama indikator.' using errcode = '22023';
  end if;
  select coalesce(max(seq), 0) + 1 into next_seq from public.rubric_indicators where curriculum_id = c.id;
  if next_seq > 8 then
    raise exception 'Rubrik maksimal 8 indikator.' using errcode = '22023';
  end if;
  insert into public.rubric_indicators (curriculum_id, seq, skill, label)
  values (c.id, next_seq, p_skill, left(trim(p_label), 120))
  returning rubric_indicators.id into new_id;
  return new_id;
end;
$$;

create or replace function public.delete_rubric_indicator(p_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  r public.rubric_indicators;
  c public.curricula;
begin
  select * into r from public.rubric_indicators where id = p_id;
  if r.id is null then
    raise exception 'Indikator tidak ditemukan.' using errcode = '22023';
  end if;
  c := public.draft_curriculum(r.curriculum_id);
  delete from public.rubric_indicators where id = r.id;
  update public.rubric_indicators set seq = seq - 1 where curriculum_id = c.id and seq > r.seq;
end;
$$;

-- Terbit hanya bila rubrik dan titik assessment awal serta akhir sudah lengkap.
create or replace function public.publish_curriculum(p_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  c public.curricula := public.draft_curriculum(p_id);
begin
  if not exists (select 1 from public.curriculum_modules where curriculum_id = c.id) then
    raise exception 'Tambahkan minimal satu modul sebelum menerbitkan.' using errcode = '22023';
  end if;
  if (select count(*) from public.rubric_indicators where curriculum_id = c.id) < 2 then
    raise exception 'Lengkapi rubrik minimal 2 indikator sebelum menerbitkan.' using errcode = '22023';
  end if;
  if not exists (select 1 from public.curriculum_modules where curriculum_id = c.id and assessment = 'baseline')
     or not exists (select 1 from public.curriculum_modules where curriculum_id = c.id and assessment = 'final') then
    raise exception 'Tandai sesi assessment awal (baseline) dan akhir sebelum menerbitkan.' using errcode = '22023';
  end if;
  update public.curricula set status = 'archived' where program_id = c.program_id and status = 'published';
  update public.curricula set status = 'published', published_at = now(), published_by = auth.uid() where id = c.id;
  perform public.write_audit('curriculum_published', 'curricula', c.id::text, jsonb_build_object('version', c.version));
end;
$$;

-- Versi baru menyalin modul (dengan titik assessment), materi, template tugas, dan rubrik.
create or replace function public.new_curriculum_version(p_id uuid) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  src public.curricula;
  new_id uuid;
  m public.curriculum_modules;
  new_module uuid;
begin
  if not public.can_edit_curriculum() then
    raise exception 'Hanya Academic Lead yang dapat mengubah kurikulum.' using errcode = '42501';
  end if;
  select * into src from public.curricula where id = p_id;
  if src.id is null or src.status = 'draft' then
    raise exception 'Versi baru dibuat dari kurikulum yang sudah terbit.' using errcode = '22023';
  end if;
  if exists (select 1 from public.curricula where program_id = src.program_id and status = 'draft') then
    raise exception 'Program ini sudah punya draf versi baru. Lanjutkan draf tersebut.' using errcode = '23505';
  end if;
  insert into public.curricula (program_id, version, title, notes, created_by)
  select src.program_id, max(version) + 1, src.title, src.notes, auth.uid() from public.curricula where program_id = src.program_id
  returning id into new_id;
  for m in select * from public.curriculum_modules where curriculum_id = src.id order by seq loop
    insert into public.curriculum_modules (curriculum_id, seq, week, title, objectives, content, assessment)
    values (new_id, m.seq, m.week, m.title, m.objectives, m.content, m.assessment)
    returning id into new_module;
    insert into public.module_materials (module_id, kind, title, url, file_path, mime, size_bytes, sort_order, created_by)
    select new_module, kind, title, url, file_path, mime, size_bytes, sort_order, created_by from public.module_materials where module_id = m.id;
    insert into public.module_tasks (module_id, title, instructions, submission_type, sort_order)
    select new_module, title, instructions, submission_type, sort_order from public.module_tasks where module_id = m.id;
  end loop;
  insert into public.rubric_indicators (curriculum_id, seq, skill, label, descriptors)
  select new_id, seq, skill, label, descriptors from public.rubric_indicators where curriculum_id = src.id;
  perform public.write_audit('curriculum_version_created', 'curricula', new_id::text, jsonb_build_object('from', src.id));
  return new_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Assessment siswa
-- ---------------------------------------------------------------------------

create table public.assessments (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null references public.batches (id) on delete cascade,
  student_id uuid not null references public.students (id) on delete cascade,
  kind text not null check (kind in ('baseline', 'mid', 'final')),
  scores jsonb not null default '{}'::jsonb check (jsonb_typeof(scores) = 'object'),
  note text not null default '' check (char_length(note) <= 2000),
  status text not null default 'draft' check (status in ('draft', 'published')),
  assessed_by uuid references public.profiles (id) on delete set null,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (batch_id, student_id, kind)
);

create index assessments_student on public.assessments (student_id);

create trigger assessments_touch before update on public.assessments
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------------
-- Laporan akhir: disusun tutor, ditinjau lalu diterbitkan Academic Lead
-- ---------------------------------------------------------------------------

create table public.reports (
  id uuid primary key default gen_random_uuid(),
  enrollment_id uuid not null unique references public.enrollments (id) on delete cascade,
  student_id uuid not null references public.students (id) on delete cascade,
  batch_id uuid not null references public.batches (id) on delete cascade,
  status text not null default 'draft' check (status in ('draft', 'submitted', 'returned', 'published')),
  strengths text not null default '' check (char_length(strengths) <= 3000),
  improvements text not null default '' check (char_length(improvements) <= 3000),
  levels jsonb not null default '{}'::jsonb check (jsonb_typeof(levels) = 'object'),
  recommended_program_ids uuid[] not null default '{}',
  lead_comment text not null default '' check (char_length(lead_comment) <= 2000),
  summary jsonb,
  pdf_path text,
  tutor_id uuid references public.profiles (id) on delete set null,
  submitted_at timestamptz,
  reviewed_by uuid references public.profiles (id) on delete set null,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index reports_student on public.reports (student_id);
create index reports_status on public.reports (status);

create trigger reports_touch before update on public.reports
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------------
-- Fungsi assessment dan laporan
-- ---------------------------------------------------------------------------

create or replace function public.valid_report_levels(p_levels jsonb) returns boolean
language sql immutable as $$
  select jsonb_typeof(coalesce(p_levels, '{}'::jsonb)) = 'object'
    and not exists (
      select 1 from jsonb_each_text(coalesce(p_levels, '{}'::jsonb)) e
      where e.key not in ('grammar', 'reading', 'listening', 'writing', 'speaking')
         or e.value not in ('Pre-A1', 'A1', 'A2', 'B1', 'B2', 'C1')
    );
$$;

-- Tutor menilai satu siswa di satu titik assessment. Draf boleh belum lengkap; terbit wajib semua indikator.
-- Setelah terbit nilai masih bisa diperbaiki sampai laporan akhir diajukan.
create or replace function public.save_assessment(
  p_batch uuid, p_student uuid, p_kind text, p_scores jsonb, p_note text, p_publish boolean
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  b public.batches;
  point public.class_sessions;
  existing public.assessments;
  ind public.rubric_indicators;
  clean jsonb := '{}'::jsonb;
  v text;
  missing integer := 0;
  publish boolean;
  new_id uuid;
begin
  select * into b from public.batches where id = p_batch;
  if b.id is null or not public.is_batch_tutor(b.id) then
    raise exception 'Hanya tutor batch ini yang dapat mengisi assessment.' using errcode = '42501';
  end if;
  if not exists (select 1 from public.enrollments e where e.batch_id = b.id and e.student_id = p_student and e.status in ('active', 'completed')) then
    raise exception 'Siswa tidak terdaftar di batch ini.' using errcode = '22023';
  end if;
  select s.* into point from public.class_sessions s join public.curriculum_modules m on m.id = s.module_id
  where s.batch_id = b.id and m.assessment = p_kind;
  if point.id is null then
    raise exception 'Kurikulum batch ini tidak punya titik assessment tersebut.' using errcode = '22023';
  end if;
  if point.starts_at > now() then
    raise exception 'Assessment baru bisa diisi setelah sesi % dimulai.', point.seq using errcode = '22023';
  end if;
  if exists (
    select 1 from public.reports r join public.enrollments e on e.id = r.enrollment_id
    where e.batch_id = b.id and e.student_id = p_student and r.status in ('submitted', 'published')
  ) then
    raise exception 'Laporan akhir siswa ini sudah diajukan, sehingga nilai assessment terkunci.' using errcode = '22023';
  end if;

  for ind in select * from public.rubric_indicators where curriculum_id = b.curriculum_id order by seq loop
    v := coalesce(p_scores, '{}'::jsonb) ->> ind.id::text;
    if v is null or v = '' then
      missing := missing + 1;
    elsif v not in ('1', '2', '3', '4') then
      raise exception 'Nilai indikator harus 1 sampai 4.' using errcode = '22023';
    else
      clean := clean || jsonb_build_object(ind.id::text, v::integer);
    end if;
  end loop;

  select * into existing from public.assessments where batch_id = b.id and student_id = p_student and kind = p_kind;
  publish := coalesce(p_publish, false) or coalesce(existing.status = 'published', false);
  if publish and (missing > 0 or clean = '{}'::jsonb) then
    raise exception 'Isi nilai semua indikator sebelum menerbitkan.' using errcode = '22023';
  end if;

  insert into public.assessments (batch_id, student_id, kind, scores, note, status, assessed_by, published_at)
  values (b.id, p_student, p_kind, clean, left(trim(coalesce(p_note, '')), 2000),
          case when publish then 'published' else 'draft' end, auth.uid(), case when publish then now() end)
  on conflict (batch_id, student_id, kind) do update
    set scores = excluded.scores, note = excluded.note, status = excluded.status, assessed_by = excluded.assessed_by,
        published_at = coalesce(public.assessments.published_at, excluded.published_at)
  returning id into new_id;
  if publish and existing.status is distinct from 'published' then
    perform public.write_audit('assessment_published', 'assessments', new_id::text, jsonb_build_object('kind', p_kind, 'batch', b.code));
  end if;
  return new_id;
end;
$$;

-- Tutor menyusun laporan dan mengajukannya ke Academic Lead.
create or replace function public.save_report(
  p_enrollment uuid, p_strengths text, p_improvements text, p_levels jsonb, p_programs uuid[], p_submit boolean
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  e public.enrollments;
  b public.batches;
  existing public.reports;
  programs uuid[] := coalesce(p_programs, '{}');
  new_id uuid;
begin
  select * into e from public.enrollments where id = p_enrollment;
  select * into b from public.batches where id = e.batch_id;
  if e.id is null or not public.is_batch_tutor(b.id) then
    raise exception 'Hanya tutor batch ini yang dapat menyusun laporan.' using errcode = '42501';
  end if;
  if e.status not in ('active', 'completed') then
    raise exception 'Laporan hanya untuk siswa yang mengikuti kelas.' using errcode = '22023';
  end if;
  if not exists (select 1 from public.assessments a where a.batch_id = b.id and a.student_id = e.student_id and a.kind = 'final' and a.status = 'published') then
    raise exception 'Terbitkan assessment akhir siswa ini lebih dulu.' using errcode = '22023';
  end if;
  select * into existing from public.reports where enrollment_id = e.id;
  if existing.status in ('submitted', 'published') then
    raise exception 'Laporan sudah diajukan dan menunggu atau sudah melewati review Academic Lead.' using errcode = '22023';
  end if;
  if not public.valid_report_levels(p_levels) then
    raise exception 'Level per keterampilan tidak valid.' using errcode = '22023';
  end if;
  if cardinality(programs) > 3 or exists (select 1 from unnest(programs) x where not exists (select 1 from public.programs p where p.id = x and p.status = 'active')) then
    raise exception 'Pilih maksimal 3 program lanjutan yang aktif.' using errcode = '22023';
  end if;
  if p_submit and (
    char_length(trim(coalesce(p_strengths, ''))) < 10 or char_length(trim(coalesce(p_improvements, ''))) < 10
    or coalesce(p_levels, '{}'::jsonb) = '{}'::jsonb or cardinality(programs) = 0
  ) then
    raise exception 'Lengkapi kekuatan, hal yang perlu ditingkatkan, level akhir, dan rekomendasi program sebelum mengajukan.' using errcode = '22023';
  end if;

  insert into public.reports (enrollment_id, student_id, batch_id, status, strengths, improvements, levels, recommended_program_ids, tutor_id, submitted_at)
  values (e.id, e.student_id, b.id, case when p_submit then 'submitted' else 'draft' end,
          left(trim(coalesce(p_strengths, '')), 3000), left(trim(coalesce(p_improvements, '')), 3000),
          coalesce(p_levels, '{}'::jsonb), programs, auth.uid(), case when p_submit then now() end)
  on conflict (enrollment_id) do update
    set strengths = excluded.strengths, improvements = excluded.improvements, levels = excluded.levels,
        recommended_program_ids = excluded.recommended_program_ids, tutor_id = excluded.tutor_id,
        status = case when p_submit then 'submitted' else public.reports.status end,
        submitted_at = coalesce(excluded.submitted_at, public.reports.submitted_at)
  returning id into new_id;
  if p_submit then
    perform public.write_audit('report_submitted', 'reports', new_id::text, jsonb_build_object('batch', b.code));
  end if;
  return new_id;
end;
$$;

-- Academic Lead menerbitkan laporan (dengan level yang dikonfirmasi) atau mengembalikannya dengan catatan.
create or replace function public.review_report(p_report uuid, p_publish boolean, p_comment text, p_levels jsonb, p_summary jsonb) returns void
language plpgsql security definer set search_path = public as $$
declare
  r public.reports;
begin
  if not (public.has_role('lead') or public.has_role('owner')) then
    raise exception 'Hanya Academic Lead yang dapat meninjau laporan.' using errcode = '42501';
  end if;
  select * into r from public.reports where id = p_report for update;
  if r.id is null or r.status <> 'submitted' then
    raise exception 'Laporan ini tidak sedang menunggu review.' using errcode = '22023';
  end if;
  if p_publish then
    if p_levels is not null and (not public.valid_report_levels(p_levels) or p_levels = '{}'::jsonb) then
      raise exception 'Level per keterampilan tidak valid.' using errcode = '22023';
    end if;
    update public.reports
    set status = 'published', levels = coalesce(p_levels, levels), lead_comment = left(trim(coalesce(p_comment, '')), 2000),
        summary = p_summary, reviewed_by = auth.uid(), published_at = now()
    where id = r.id;
    perform public.write_audit('report_published', 'reports', r.id::text);
  else
    if char_length(trim(coalesce(p_comment, ''))) < 5 then
      raise exception 'Tulis catatan untuk tutor saat mengembalikan laporan.' using errcode = '22023';
    end if;
    update public.reports set status = 'returned', lead_comment = left(trim(p_comment), 2000), reviewed_by = auth.uid() where id = r.id;
    perform public.write_audit('report_returned', 'reports', r.id::text);
  end if;
end;
$$;

revoke all on function public.set_module_assessment(uuid, text) from public, anon;
revoke all on function public.add_rubric_indicator(uuid, text, text) from public, anon;
revoke all on function public.delete_rubric_indicator(uuid) from public, anon;
revoke all on function public.valid_report_levels(jsonb) from public, anon;
revoke all on function public.save_assessment(uuid, uuid, text, jsonb, text, boolean) from public, anon;
revoke all on function public.save_report(uuid, text, text, jsonb, uuid[], boolean) from public, anon;
revoke all on function public.review_report(uuid, boolean, text, jsonb, jsonb) from public, anon;
grant execute on function public.set_module_assessment(uuid, text) to authenticated;
grant execute on function public.add_rubric_indicator(uuid, text, text) to authenticated;
grant execute on function public.delete_rubric_indicator(uuid) to authenticated;
grant execute on function public.valid_report_levels(jsonb) to authenticated;
grant execute on function public.save_assessment(uuid, uuid, text, jsonb, text, boolean) to authenticated;
grant execute on function public.save_report(uuid, text, text, jsonb, uuid[], boolean) to authenticated;
grant execute on function public.review_report(uuid, boolean, text, jsonb, jsonb) to authenticated;

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------

alter table public.rubric_indicators enable row level security;
alter table public.assessments enable row level security;
alter table public.reports enable row level security;

create policy rubric_indicators_select on public.rubric_indicators for select to authenticated using (public.is_staff());
create policy rubric_indicators_update on public.rubric_indicators for update to authenticated
  using (public.can_edit_curriculum()) with check (public.can_edit_curriculum());
revoke insert, update, delete on public.rubric_indicators from authenticated, anon;
grant update (label, descriptors) on public.rubric_indicators to authenticated;

-- Nilai draf hanya terlihat tutor batch dan staf akademik; siswa/wali melihat yang sudah terbit.
create policy assessments_select on public.assessments for select to authenticated
  using (public.has_role('owner') or public.has_role('lead') or public.is_batch_tutor(batch_id)
    or (status = 'published' and public.can_access_student(student_id)));
create policy reports_select on public.reports for select to authenticated
  using (public.has_role('owner') or public.has_role('lead') or public.is_batch_tutor(batch_id)
    or (status = 'published' and public.can_access_student(student_id)));

revoke insert, update, delete on public.assessments, public.reports from authenticated, anon;
