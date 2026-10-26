-- Fase 3: kurikulum berversi, materi, absensi, tugas, pengumpulan, dan feedback.
-- Isi kurikulum (teks, materi, template tugas) boleh diubah kapan saja oleh Academic Lead.
-- Struktur (jumlah, urutan, minggu modul) hanya berubah di draf; versi terbit dipakai batch apa adanya.

-- ---------------------------------------------------------------------------
-- Kurikulum
-- ---------------------------------------------------------------------------

create table public.curricula (
  id uuid primary key default gen_random_uuid(),
  program_id uuid not null references public.programs (id),
  version integer not null check (version between 1 and 999),
  status text not null default 'draft' check (status in ('draft', 'published', 'archived')),
  title text not null check (char_length(title) between 3 and 160),
  notes text not null default '' check (char_length(notes) <= 2000),
  created_by uuid references public.profiles (id) on delete set null,
  published_by uuid references public.profiles (id) on delete set null,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (program_id, version)
);

-- Satu draf dan satu versi terbit aktif per program.
create unique index curricula_one_draft on public.curricula (program_id) where status = 'draft';
create unique index curricula_one_published on public.curricula (program_id) where status = 'published';

create trigger curricula_touch before update on public.curricula
  for each row execute function public.touch_updated_at();

create table public.curriculum_modules (
  id uuid primary key default gen_random_uuid(),
  curriculum_id uuid not null references public.curricula (id) on delete cascade,
  seq integer not null check (seq between 1 and 200),
  week integer not null default 1 check (week between 1 and 52),
  title text not null check (char_length(title) between 2 and 200),
  objectives text not null default '' check (char_length(objectives) <= 2000),
  content text not null default '' check (char_length(content) <= 20000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint curriculum_modules_seq unique (curriculum_id, seq) deferrable initially immediate
);

create trigger curriculum_modules_touch before update on public.curriculum_modules
  for each row execute function public.touch_updated_at();

create or replace function public.guard_module_structure() returns trigger
language plpgsql as $$
begin
  if (new.week is distinct from old.week or new.seq is distinct from old.seq or new.curriculum_id is distinct from old.curriculum_id)
     and (select status from public.curricula where id = old.curriculum_id) <> 'draft' then
    raise exception 'Struktur kurikulum yang sudah terbit tidak dapat diubah. Buat versi baru.' using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger curriculum_modules_structure before update on public.curriculum_modules
  for each row execute function public.guard_module_structure();

create table public.module_materials (
  id uuid primary key default gen_random_uuid(),
  module_id uuid not null references public.curriculum_modules (id) on delete cascade,
  kind text not null check (kind in ('file', 'link', 'audio')),
  title text not null check (char_length(title) between 2 and 160),
  url text check (url is null or url ~ '^https://'),
  file_path text,
  mime text,
  size_bytes integer check (size_bytes is null or size_bytes > 0),
  sort_order integer not null default 0,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  check ((kind = 'link' and url is not null and file_path is null) or (kind in ('file', 'audio') and file_path is not null and url is null))
);

create index module_materials_module on public.module_materials (module_id);

create table public.module_tasks (
  id uuid primary key default gen_random_uuid(),
  module_id uuid not null references public.curriculum_modules (id) on delete cascade,
  title text not null check (char_length(title) between 2 and 160),
  instructions text not null check (char_length(instructions) between 5 and 4000),
  submission_type text not null default 'any' check (submission_type in ('text', 'audio', 'file', 'any')),
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index module_tasks_module on public.module_tasks (module_id);

create trigger module_tasks_touch before update on public.module_tasks
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------------
-- Batch memakai satu versi kurikulum; setiap sesi menunjuk modulnya.
-- ---------------------------------------------------------------------------

alter table public.batches add column curriculum_id uuid references public.curricula (id);
alter table public.class_sessions add column module_id uuid references public.curriculum_modules (id) on delete set null;
alter table public.class_sessions add column tutor_note text not null default '' check (char_length(tutor_note) <= 2000);
alter table public.class_sessions add column attendance_done_at timestamptz;

create or replace function public.check_batch_curriculum() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  c public.curricula;
begin
  if new.curriculum_id is null then
    return new;
  end if;
  if tg_op = 'UPDATE' then
    if new.curriculum_id is not distinct from old.curriculum_id then
      return new;
    end if;
  end if;
  select * into c from public.curricula where id = new.curriculum_id;
  if c.id is null or c.status = 'draft' or c.program_id <> new.program_id then
    raise exception 'Pilih kurikulum terbit untuk program batch ini.' using errcode = '22023';
  end if;
  return new;
end;
$$;

create trigger batches_curriculum before insert or update of curriculum_id on public.batches
  for each row execute function public.check_batch_curriculum();

-- ---------------------------------------------------------------------------
-- Absensi, tugas, pengumpulan, feedback
-- ---------------------------------------------------------------------------

create table public.attendance (
  session_id uuid not null references public.class_sessions (id) on delete cascade,
  student_id uuid not null references public.students (id) on delete cascade,
  status text not null check (status in ('present', 'late', 'excused', 'absent')),
  note text not null default '' check (char_length(note) <= 300),
  recorded_by uuid references public.profiles (id) on delete set null,
  recorded_at timestamptz not null default now(),
  primary key (session_id, student_id)
);

create index attendance_student on public.attendance (student_id);

create table public.assignments (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null references public.batches (id) on delete cascade,
  session_id uuid references public.class_sessions (id) on delete set null,
  module_task_id uuid references public.module_tasks (id) on delete set null,
  title text not null check (char_length(title) between 2 and 160),
  instructions text not null check (char_length(instructions) between 5 and 4000),
  submission_type text not null check (submission_type in ('text', 'audio', 'file', 'any')),
  due_at timestamptz not null,
  reminder_sent_at timestamptz,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

create index assignments_batch on public.assignments (batch_id);
-- Template tugas yang sama tidak diterbitkan dua kali untuk sesi yang sama.
create unique index assignments_task_once on public.assignments (session_id, module_task_id) where module_task_id is not null;

create table public.submissions (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid not null references public.assignments (id) on delete cascade,
  student_id uuid not null references public.students (id) on delete cascade,
  version integer not null check (version between 1 and 3),
  text_answer text check (char_length(text_answer) <= 10000),
  file_path text,
  mime text,
  is_late boolean not null default false,
  status text not null default 'submitted' check (status in ('submitted', 'revision_requested', 'accepted')),
  submitted_by uuid references public.profiles (id) on delete set null,
  submitted_at timestamptz not null default now(),
  unique (assignment_id, student_id, version),
  check (char_length(trim(coalesce(text_answer, ''))) > 0 or file_path is not null)
);

create index submissions_student on public.submissions (student_id);

create table public.feedback (
  submission_id uuid primary key references public.submissions (id) on delete cascade,
  body text not null check (char_length(body) between 1 and 5000),
  decision text not null check (decision in ('accepted', 'revision')),
  status text not null default 'draft' check (status in ('draft', 'published')),
  tutor_id uuid references public.profiles (id) on delete set null,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger feedback_touch before update on public.feedback
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------------
-- Fungsi kurikulum (Academic Lead dan Owner)
-- ---------------------------------------------------------------------------

create or replace function public.can_edit_curriculum() returns boolean
language sql stable security definer set search_path = public as $$
  select public.has_role('lead') or public.has_role('owner');
$$;

create or replace function public.draft_curriculum(p_id uuid) returns public.curricula
language plpgsql security definer set search_path = public as $$
declare
  c public.curricula;
begin
  if not public.can_edit_curriculum() then
    raise exception 'Hanya Academic Lead yang dapat mengubah kurikulum.' using errcode = '42501';
  end if;
  select * into c from public.curricula where id = p_id for update;
  if c.id is null then
    raise exception 'Kurikulum tidak ditemukan.' using errcode = '22023';
  end if;
  if c.status <> 'draft' then
    raise exception 'Struktur kurikulum yang sudah terbit tidak dapat diubah. Buat versi baru.' using errcode = '22023';
  end if;
  return c;
end;
$$;

create or replace function public.create_curriculum(p_program uuid, p_title text) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  new_id uuid;
begin
  if not public.can_edit_curriculum() then
    raise exception 'Hanya Academic Lead yang dapat mengubah kurikulum.' using errcode = '42501';
  end if;
  if exists (select 1 from public.curricula c where c.program_id = p_program) then
    raise exception 'Program ini sudah punya kurikulum. Buat versi baru dari kurikulum yang ada.' using errcode = '23505';
  end if;
  insert into public.curricula (program_id, version, title, created_by)
  values (p_program, 1, left(trim(p_title), 160), auth.uid())
  returning curricula.id into new_id;
  perform public.write_audit('curriculum_created', 'curricula', new_id::text);
  return new_id;
end;
$$;

create or replace function public.add_curriculum_module(p_curriculum uuid, p_title text) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  c public.curricula := public.draft_curriculum(p_curriculum);
  next_seq integer;
  last_week integer;
  new_id uuid;
begin
  select coalesce(max(seq), 0) + 1, coalesce(max(week), 1) into next_seq, last_week from public.curriculum_modules where curriculum_id = c.id;
  insert into public.curriculum_modules (curriculum_id, seq, week, title)
  values (c.id, next_seq, last_week, left(trim(p_title), 200))
  returning curriculum_modules.id into new_id;
  return new_id;
end;
$$;

create or replace function public.delete_curriculum_module(p_module uuid) returns void
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
  delete from public.curriculum_modules where id = m.id;
  update public.curriculum_modules set seq = seq - 1 where curriculum_id = c.id and seq > m.seq;
end;
$$;

create or replace function public.move_curriculum_module(p_module uuid, p_delta integer) returns void
language plpgsql security definer set search_path = public as $$
declare
  m public.curriculum_modules;
  other public.curriculum_modules;
  c public.curricula;
begin
  select * into m from public.curriculum_modules where id = p_module;
  if m.id is null then
    raise exception 'Modul tidak ditemukan.' using errcode = '22023';
  end if;
  c := public.draft_curriculum(m.curriculum_id);
  select * into other from public.curriculum_modules where curriculum_id = c.id and seq = m.seq + sign(p_delta)::integer;
  if other.id is null then
    return;
  end if;
  update public.curriculum_modules
  set seq = case when id = m.id then other.seq else m.seq end,
      week = case when id = m.id then other.week else m.week end
  where id in (m.id, other.id);
end;
$$;

-- Menerbitkan draf; versi terbit sebelumnya diarsipkan tetapi tetap dipakai batch yang sudah memakainya.
create or replace function public.publish_curriculum(p_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  c public.curricula := public.draft_curriculum(p_id);
begin
  if not exists (select 1 from public.curriculum_modules where curriculum_id = c.id) then
    raise exception 'Tambahkan minimal satu modul sebelum menerbitkan.' using errcode = '22023';
  end if;
  update public.curricula set status = 'archived' where program_id = c.program_id and status = 'published';
  update public.curricula set status = 'published', published_at = now(), published_by = auth.uid() where id = c.id;
  perform public.write_audit('curriculum_published', 'curricula', c.id::text, jsonb_build_object('version', c.version));
end;
$$;

-- Versi baru adalah salinan lengkap (modul, materi, template tugas) yang bisa diubah strukturnya.
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
    insert into public.curriculum_modules (curriculum_id, seq, week, title, objectives, content)
    values (new_id, m.seq, m.week, m.title, m.objectives, m.content)
    returning id into new_module;
    insert into public.module_materials (module_id, kind, title, url, file_path, mime, size_bytes, sort_order, created_by)
    select new_module, kind, title, url, file_path, mime, size_bytes, sort_order, created_by from public.module_materials where module_id = m.id;
    insert into public.module_tasks (module_id, title, instructions, submission_type, sort_order)
    select new_module, title, instructions, submission_type, sort_order from public.module_tasks where module_id = m.id;
  end loop;
  perform public.write_audit('curriculum_version_created', 'curricula', new_id::text, jsonb_build_object('from', src.id));
  return new_id;
end;
$$;

create or replace function public.delete_curriculum_draft(p_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  c public.curricula := public.draft_curriculum(p_id);
begin
  delete from public.curricula where id = c.id;
  perform public.write_audit('curriculum_draft_deleted', 'curricula', c.id::text);
end;
$$;

-- ---------------------------------------------------------------------------
-- Fungsi kelas berjalan
-- ---------------------------------------------------------------------------

-- Status batch mengikuti jadwal: berjalan sejak sesi pertama dimulai, selesai setelah sesi terakhir berakhir.
-- Siswa aktif di batch yang selesai berpindah ke status selesai (materi baca saja, tidak bisa mengumpulkan).
create or replace function public.sync_batch_status() returns integer
language plpgsql security definer set search_path = public as $$
declare
  n integer := 0;
  m integer;
begin
  update public.batches b set status = 'running'
  where b.status = 'open' and exists (select 1 from public.class_sessions s where s.batch_id = b.id and s.starts_at <= now());
  get diagnostics m = row_count;
  n := n + m;
  update public.batches b set status = 'completed'
  where b.status = 'running'
    and exists (select 1 from public.class_sessions s where s.batch_id = b.id)
    and not exists (select 1 from public.class_sessions s where s.batch_id = b.id and s.starts_at + make_interval(mins => s.duration_minutes) > now());
  get diagnostics m = row_count;
  n := n + m;
  update public.enrollments e set status = 'completed'
  from public.batches b where b.id = e.batch_id and b.status = 'completed' and e.status = 'active';
  get diagnostics m = row_count;
  return n + m;
end;
$$;

create or replace function public.is_batch_tutor(p_batch uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.batches b where b.id = p_batch and b.tutor_id = auth.uid()) and public.has_role('tutor');
$$;

create or replace function public.record_attendance(p_session uuid, p_entries jsonb, p_note text default '') returns integer
language plpgsql security definer set search_path = public as $$
declare
  s public.class_sessions;
  entry jsonb;
  n integer := 0;
begin
  select * into s from public.class_sessions where id = p_session;
  if s.id is null or not (public.is_batch_tutor(s.batch_id) or public.has_role('admin') or public.has_role('owner')) then
    raise exception 'Hanya tutor batch ini yang dapat mengisi absensi.' using errcode = '42501';
  end if;
  if s.starts_at > now() then
    raise exception 'Absensi baru bisa diisi setelah sesi dimulai.' using errcode = '22023';
  end if;
  for entry in select * from jsonb_array_elements(coalesce(p_entries, '[]'::jsonb)) loop
    if coalesce(entry ->> 'status', '') not in ('present', 'late', 'excused', 'absent') then
      raise exception 'Status kehadiran tidak valid.' using errcode = '22023';
    end if;
    if not exists (
      select 1 from public.enrollments e
      where e.batch_id = s.batch_id and e.student_id = (entry ->> 'student_id')::uuid and e.status in ('active', 'completed')
    ) then
      raise exception 'Siswa tidak terdaftar di batch ini.' using errcode = '22023';
    end if;
    insert into public.attendance (session_id, student_id, status, note, recorded_by)
    values (p_session, (entry ->> 'student_id')::uuid, entry ->> 'status', left(coalesce(entry ->> 'note', ''), 300), auth.uid())
    on conflict (session_id, student_id) do update
      set status = excluded.status, note = excluded.note, recorded_by = excluded.recorded_by, recorded_at = now();
    n := n + 1;
  end loop;
  update public.class_sessions set attendance_done_at = coalesce(attendance_done_at, now()), tutor_note = left(trim(coalesce(p_note, '')), 2000) where id = p_session;
  perform public.write_audit('attendance_recorded', 'class_sessions', p_session::text, jsonb_build_object('students', n));
  return n;
end;
$$;

create or replace function public.publish_assignment(
  p_session uuid, p_task uuid, p_title text, p_instructions text, p_type text, p_due timestamptz
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  s public.class_sessions;
  b public.batches;
  new_id uuid;
begin
  select * into s from public.class_sessions where id = p_session;
  select * into b from public.batches where id = s.batch_id;
  if s.id is null or not public.is_batch_tutor(b.id) then
    raise exception 'Hanya tutor batch ini yang dapat menerbitkan tugas.' using errcode = '42501';
  end if;
  if b.status not in ('open', 'running') then
    raise exception 'Batch ini tidak sedang berjalan.' using errcode = '22023';
  end if;
  if p_due is null or p_due <= now() then
    raise exception 'Tenggat harus di masa depan.' using errcode = '22023';
  end if;
  if char_length(trim(coalesce(p_title, ''))) < 2 or char_length(trim(coalesce(p_instructions, ''))) < 5 then
    raise exception 'Lengkapi judul dan instruksi tugas.' using errcode = '22023';
  end if;
  if p_type not in ('text', 'audio', 'file', 'any') then
    raise exception 'Jenis pengumpulan tidak valid.' using errcode = '22023';
  end if;
  if p_task is not null and not exists (select 1 from public.module_tasks t where t.id = p_task and t.module_id = s.module_id) then
    raise exception 'Template tugas bukan milik modul sesi ini.' using errcode = '22023';
  end if;
  if p_task is not null and exists (select 1 from public.assignments a where a.session_id = p_session and a.module_task_id = p_task) then
    raise exception 'Tugas ini sudah diterbitkan untuk sesi tersebut.' using errcode = '23505';
  end if;
  insert into public.assignments (batch_id, session_id, module_task_id, title, instructions, submission_type, due_at, created_by)
  values (b.id, p_session, p_task, left(trim(p_title), 160), left(trim(p_instructions), 4000), p_type, p_due, auth.uid())
  returning assignments.id into new_id;
  perform public.write_audit('assignment_published', 'assignments', new_id::text, jsonb_build_object('batch', b.code));
  return new_id;
end;
$$;

-- Siswa mengumpulkan tugas. Anak tanpa akun sendiri mengumpulkan lewat akun wali yang terverifikasi.
create or replace function public.submit_assignment(p_assignment uuid, p_student uuid, p_text text, p_path text, p_mime text) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  a public.assignments;
  st public.students;
  last public.submissions;
  v integer;
  answer text := nullif(trim(coalesce(p_text, '')), '');
  new_id uuid;
begin
  select * into a from public.assignments where id = p_assignment;
  select * into st from public.students where id = p_student;
  if a.id is null or st.id is null or not public.can_access_student(p_student) then
    raise exception 'Tugas tidak ditemukan.' using errcode = '42501';
  end if;
  if st.user_id is distinct from auth.uid() and not (
    st.user_id is null and exists (select 1 from public.guardian_links g where g.student_id = p_student and g.guardian_id = auth.uid() and g.status = 'verified')
  ) then
    raise exception 'Tugas dikumpulkan dari akun siswa.' using errcode = '42501';
  end if;
  if not exists (select 1 from public.enrollments e where e.batch_id = a.batch_id and e.student_id = p_student and e.status = 'active') then
    raise exception 'Tugas hanya bisa dikumpulkan selama kelas aktif.' using errcode = '22023';
  end if;
  select * into last from public.submissions where assignment_id = p_assignment and student_id = p_student order by version desc limit 1;
  if last.id is not null and last.status = 'accepted' then
    raise exception 'Tugas ini sudah selesai dinilai.' using errcode = '22023';
  end if;
  if last.id is not null and last.status = 'submitted' then
    raise exception 'Tugas sudah dikumpulkan dan menunggu feedback tutor.' using errcode = '22023';
  end if;
  if p_path is not null and left(p_path, 74) <> p_assignment::text || '/' || p_student::text || '/' then
    raise exception 'File tugas tidak valid.' using errcode = '22023';
  end if;
  if (a.submission_type = 'text' and answer is null)
     or (a.submission_type = 'audio' and (p_path is null or coalesce(p_mime, '') not like 'audio/%'))
     or (a.submission_type = 'file' and p_path is null)
     or (answer is null and p_path is null) then
    raise exception 'Lengkapi jawaban sesuai jenis tugas.' using errcode = '22023';
  end if;
  v := coalesce(last.version, 0) + 1;
  insert into public.submissions (assignment_id, student_id, version, text_answer, file_path, mime, is_late, submitted_by)
  values (p_assignment, p_student, v, answer, p_path, p_mime, v = 1 and now() > a.due_at, auth.uid())
  returning submissions.id into new_id;
  return new_id;
end;
$$;

-- Tutor menyimpan feedback sebagai draf atau menerbitkannya. Revisi maksimal 2 kali (3 versi).
create or replace function public.save_feedback(p_submission uuid, p_body text, p_decision text, p_publish boolean) returns void
language plpgsql security definer set search_path = public as $$
declare
  sub public.submissions;
  a public.assignments;
begin
  select * into sub from public.submissions where id = p_submission;
  select * into a from public.assignments where id = sub.assignment_id;
  if sub.id is null or not public.is_batch_tutor(a.batch_id) then
    raise exception 'Hanya tutor batch ini yang dapat memberi feedback.' using errcode = '42501';
  end if;
  if sub.status <> 'submitted' then
    raise exception 'Feedback untuk versi ini sudah diterbitkan.' using errcode = '22023';
  end if;
  if p_decision not in ('accepted', 'revision') then
    raise exception 'Pilih: terima atau minta revisi.' using errcode = '22023';
  end if;
  if p_decision = 'revision' and sub.version >= 3 then
    raise exception 'Batas revisi 2 kali sudah tercapai. Terima tugas ini dengan feedback akhir.' using errcode = '22023';
  end if;
  if char_length(trim(coalesce(p_body, ''))) < 5 then
    raise exception 'Tulis feedback minimal satu kalimat.' using errcode = '22023';
  end if;
  insert into public.feedback (submission_id, body, decision, status, tutor_id, published_at)
  values (p_submission, left(trim(p_body), 5000), p_decision, case when p_publish then 'published' else 'draft' end, auth.uid(), case when p_publish then now() end)
  on conflict (submission_id) do update
    set body = excluded.body, decision = excluded.decision, status = excluded.status, tutor_id = excluded.tutor_id, published_at = excluded.published_at;
  if p_publish then
    update public.submissions set status = case when p_decision = 'accepted' then 'accepted' else 'revision_requested' end where id = p_submission;
    perform public.write_audit('feedback_published', 'submissions', p_submission::text, jsonb_build_object('decision', p_decision));
  end if;
end;
$$;

revoke all on function public.guard_module_structure() from public, anon;
revoke all on function public.check_batch_curriculum() from public, anon;
revoke all on function public.can_edit_curriculum() from public, anon;
revoke all on function public.draft_curriculum(uuid) from public, anon, authenticated;
revoke all on function public.create_curriculum(uuid, text) from public, anon;
revoke all on function public.add_curriculum_module(uuid, text) from public, anon;
revoke all on function public.delete_curriculum_module(uuid) from public, anon;
revoke all on function public.move_curriculum_module(uuid, integer) from public, anon;
revoke all on function public.publish_curriculum(uuid) from public, anon;
revoke all on function public.new_curriculum_version(uuid) from public, anon;
revoke all on function public.delete_curriculum_draft(uuid) from public, anon;
revoke all on function public.sync_batch_status() from public, anon;
revoke all on function public.is_batch_tutor(uuid) from public, anon;
revoke all on function public.record_attendance(uuid, jsonb, text) from public, anon;
revoke all on function public.publish_assignment(uuid, uuid, text, text, text, timestamptz) from public, anon;
revoke all on function public.submit_assignment(uuid, uuid, text, text, text) from public, anon;
revoke all on function public.save_feedback(uuid, text, text, boolean) from public, anon;
grant execute on function public.can_edit_curriculum() to authenticated;
grant execute on function public.create_curriculum(uuid, text) to authenticated;
grant execute on function public.add_curriculum_module(uuid, text) to authenticated;
grant execute on function public.delete_curriculum_module(uuid) to authenticated;
grant execute on function public.move_curriculum_module(uuid, integer) to authenticated;
grant execute on function public.publish_curriculum(uuid) to authenticated;
grant execute on function public.new_curriculum_version(uuid) to authenticated;
grant execute on function public.delete_curriculum_draft(uuid) to authenticated;
grant execute on function public.sync_batch_status() to authenticated;
grant execute on function public.is_batch_tutor(uuid) to authenticated;
grant execute on function public.record_attendance(uuid, jsonb, text) to authenticated;
grant execute on function public.publish_assignment(uuid, uuid, text, text, text, timestamptz) to authenticated;
grant execute on function public.submit_assignment(uuid, uuid, text, text, text) to authenticated;
grant execute on function public.save_feedback(uuid, text, text, boolean) to authenticated;

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------

alter table public.curricula enable row level security;
alter table public.curriculum_modules enable row level security;
alter table public.module_materials enable row level security;
alter table public.module_tasks enable row level security;
alter table public.attendance enable row level security;
alter table public.assignments enable row level security;
alter table public.submissions enable row level security;
alter table public.feedback enable row level security;

-- Kurikulum dibaca staf; siswa membaca materi lewat server sesuai batch-nya.
create policy curricula_select on public.curricula for select to authenticated using (public.is_staff());
create policy curricula_update on public.curricula for update to authenticated
  using (public.can_edit_curriculum()) with check (public.can_edit_curriculum());
create policy curriculum_modules_select on public.curriculum_modules for select to authenticated using (public.is_staff());
create policy curriculum_modules_update on public.curriculum_modules for update to authenticated
  using (public.can_edit_curriculum()) with check (public.can_edit_curriculum());
create policy module_materials_select on public.module_materials for select to authenticated using (public.is_staff());
create policy module_materials_write on public.module_materials for all to authenticated
  using (public.can_edit_curriculum()) with check (public.can_edit_curriculum());
create policy module_tasks_select on public.module_tasks for select to authenticated using (public.is_staff());
create policy module_tasks_write on public.module_tasks for all to authenticated
  using (public.can_edit_curriculum()) with check (public.can_edit_curriculum());

revoke insert, update, delete on public.curricula, public.curriculum_modules from authenticated, anon;
grant update (title, notes) on public.curricula to authenticated;
grant update (title, objectives, content, week) on public.curriculum_modules to authenticated;

-- Kehadiran, tugas, dan pengumpulan: pemilik data, tutor batch, serta Academic Lead/Owner (dan Admin untuk kehadiran).
create policy attendance_select on public.attendance for select to authenticated
  using (public.can_access_student(student_id) or public.has_role('owner') or public.has_role('admin') or public.has_role('lead')
    or exists (select 1 from public.class_sessions s where s.id = attendance.session_id and public.is_batch_tutor(s.batch_id)));
create policy assignments_select on public.assignments for select to authenticated
  using (public.in_batch(batch_id) or public.is_batch_tutor(batch_id) or public.has_role('owner') or public.has_role('admin') or public.has_role('lead'));
create policy submissions_select on public.submissions for select to authenticated
  using (public.can_access_student(student_id) or public.has_role('owner') or public.has_role('lead')
    or exists (select 1 from public.assignments a where a.id = submissions.assignment_id and public.is_batch_tutor(a.batch_id)));
-- Feedback draf hanya terlihat oleh tutor dan staf akademik.
create policy feedback_select on public.feedback for select to authenticated
  using (public.has_role('owner') or public.has_role('lead')
    or exists (select 1 from public.submissions s join public.assignments a on a.id = s.assignment_id
               where s.id = feedback.submission_id and (public.is_batch_tutor(a.batch_id) or (feedback.status = 'published' and public.can_access_student(s.student_id)))));

revoke insert, update, delete on public.attendance, public.assignments, public.submissions, public.feedback from authenticated, anon;
