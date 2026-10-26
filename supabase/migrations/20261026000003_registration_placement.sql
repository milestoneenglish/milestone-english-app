-- Fase 1: pendaftaran siswa/wali dan placement test.
-- Data placement dibaca siswa/wali lewat server (hasil baru terlihat setelah terbit);
-- RLS di sini mengatur akses langsung staf.

-- ---------------------------------------------------------------------------
-- Siswa dan wali
-- ---------------------------------------------------------------------------

create table public.students (
  id uuid primary key default gen_random_uuid(),
  user_id uuid unique references public.profiles (id) on delete set null,
  full_name text not null check (char_length(full_name) between 1 and 120),
  birth_year integer check (birth_year between 1930 and 2100),
  learning_goal text not null default '' check (char_length(learning_goal) <= 300),
  interested_program_id uuid references public.programs (id) on delete set null,
  status text not null default 'prospect' check (status in ('prospect', 'active', 'inactive')),
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger students_touch before update on public.students
  for each row execute function public.touch_updated_at();

create table public.guardian_links (
  id uuid primary key default gen_random_uuid(),
  guardian_id uuid not null references public.profiles (id) on delete cascade,
  student_id uuid not null references public.students (id) on delete cascade,
  relationship text not null default 'orang_tua' check (relationship in ('orang_tua', 'wali', 'lainnya')),
  status text not null default 'pending' check (status in ('pending', 'verified', 'rejected')),
  decided_by uuid references public.profiles (id),
  decided_at timestamptz,
  created_at timestamptz not null default now(),
  unique (guardian_id, student_id)
);

-- Siswa yang boleh dilihat pengguna saat ini: dirinya sendiri, atau anak yang ia daftarkan
-- (selama hubungan belum ditolak admin).
create or replace function public.can_access_student(p_student uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.students s where s.id = p_student and s.user_id = auth.uid())
      or exists (select 1 from public.guardian_links g where g.student_id = p_student and g.guardian_id = auth.uid() and g.status <> 'rejected');
$$;

-- ---------------------------------------------------------------------------
-- Pendaftaran: akun publik langsung mendapat profil siswa, atau profil anak untuk wali.
-- ---------------------------------------------------------------------------

create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  meta jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  account_type text := coalesce(meta ->> 'account_type', 'student');
  provisioned boolean := coalesce((new.raw_app_meta_data ->> 'provisioned')::boolean, false);
  program uuid;
  child uuid;
  relation text := coalesce(meta ->> 'relationship', 'orang_tua');
begin
  insert into public.profiles (id, full_name, email, phone, must_change_password)
  values (
    new.id,
    left(coalesce(meta ->> 'full_name', ''), 120),
    lower(new.email),
    nullif(meta ->> 'phone', ''),
    provisioned and coalesce((new.raw_app_meta_data ->> 'must_change_password')::boolean, false)
  );

  if provisioned then
    return new;
  end if;

  select id into program from public.programs where slug = meta ->> 'program_slug' and status = 'active';

  if account_type = 'guardian' then
    insert into public.user_roles (user_id, role) values (new.id, 'guardian');
    if coalesce(meta ->> 'child_name', '') <> '' then
      insert into public.students (full_name, birth_year, learning_goal, interested_program_id, created_by)
      values (
        left(meta ->> 'child_name', 120),
        nullif(meta ->> 'child_birth_year', '')::integer,
        left(coalesce(meta ->> 'learning_goal', ''), 300),
        program,
        new.id
      )
      returning id into child;
      insert into public.guardian_links (guardian_id, student_id, relationship)
      values (new.id, child, case when relation in ('orang_tua', 'wali', 'lainnya') then relation else 'lainnya' end);
    end if;
  else
    insert into public.user_roles (user_id, role) values (new.id, 'student');
    insert into public.students (user_id, full_name, birth_year, learning_goal, interested_program_id, created_by)
    values (
      new.id,
      coalesce(nullif(left(meta ->> 'full_name', 120), ''), split_part(new.email, '@', 1)),
      nullif(meta ->> 'birth_year', '')::integer,
      left(coalesce(meta ->> 'learning_goal', ''), 300),
      program,
      new.id
    );
  end if;

  return new;
end;
$$;

-- Wali menambahkan anak berikutnya dari portal.
create or replace function public.add_child(p_name text, p_birth_year integer, p_goal text, p_program uuid, p_relationship text)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  child uuid;
begin
  if not public.has_role('guardian') then
    raise exception 'Hanya wali yang dapat menambahkan anak.' using errcode = '42501';
  end if;
  if char_length(trim(coalesce(p_name, ''))) = 0 then
    raise exception 'Nama anak wajib diisi.' using errcode = '22023';
  end if;
  insert into public.students (full_name, birth_year, learning_goal, interested_program_id, created_by)
  values (left(trim(p_name), 120), p_birth_year, left(coalesce(p_goal, ''), 300), p_program, auth.uid())
  returning id into child;
  insert into public.guardian_links (guardian_id, student_id, relationship)
  values (auth.uid(), child, case when p_relationship in ('orang_tua', 'wali', 'lainnya') then p_relationship else 'lainnya' end);
  return child;
end;
$$;

revoke all on function public.add_child(text, integer, text, uuid, text) from public, anon;
grant execute on function public.add_child(text, integer, text, uuid, text) to authenticated;

-- ---------------------------------------------------------------------------
-- Placement test
-- ---------------------------------------------------------------------------

create table public.placement_questions (
  id uuid primary key default gen_random_uuid(),
  section text not null check (section in ('grammar', 'reading', 'listening', 'writing', 'speaking')),
  group_key text,
  passage text,
  audio_path text,
  prompt text not null,
  options jsonb check (options is null or jsonb_typeof(options) = 'array'),
  answer_index integer,
  cefr text check (cefr in ('A1', 'A2', 'B1', 'B2')),
  sort_order integer not null default 0,
  active boolean not null default true,
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    (section in ('writing', 'speaking') and options is null and answer_index is null)
    or (section in ('grammar', 'reading', 'listening') and jsonb_array_length(options) between 2 and 6 and answer_index >= 0 and answer_index < jsonb_array_length(options))
  )
);

create trigger placement_questions_touch before update on public.placement_questions
  for each row execute function public.touch_updated_at();

create table public.placement_attempts (
  id uuid primary key default gen_random_uuid(),
  student_id uuid references public.students (id) on delete cascade,
  guest_token_hash text unique,
  status text not null default 'in_progress'
    check (status in ('in_progress', 'awaiting_review', 'reviewed', 'published')),
  started_at timestamptz not null default now(),
  submitted_at timestamptz,
  auto_scores jsonb not null default '{}'::jsonb,
  levels jsonb not null default '{}'::jsonb,
  evaluator_id uuid references public.profiles (id) on delete set null,
  assigned_at timestamptz,
  writing_rubric jsonb,
  speaking_rubric jsonb,
  review_comment text check (char_length(review_comment) <= 2000),
  reviewed_at timestamptz,
  recommended_program_ids uuid[] not null default '{}',
  lead_note text check (char_length(lead_note) <= 2000),
  published_by uuid references public.profiles (id),
  published_at timestamptz,
  retest_of uuid references public.placement_attempts (id),
  retest_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (student_id is not null or guest_token_hash is not null)
);

create index placement_attempts_student on public.placement_attempts (student_id);
create index placement_attempts_status on public.placement_attempts (status);

create trigger placement_attempts_touch before update on public.placement_attempts
  for each row execute function public.touch_updated_at();

create table public.placement_answers (
  attempt_id uuid not null references public.placement_attempts (id) on delete cascade,
  question_id uuid not null references public.placement_questions (id),
  choice integer,
  text_answer text check (char_length(text_answer) <= 5000),
  audio_path text,
  plays integer not null default 0 check (plays between 0 and 2),
  is_correct boolean,
  updated_at timestamptz not null default now(),
  primary key (attempt_id, question_id)
);

-- Hasil yang sudah terbit tidak boleh diubah diam-diam.
create or replace function public.lock_published_attempt() returns trigger
language plpgsql as $$
begin
  if old.status = 'published' then
    raise exception 'Hasil placement yang sudah terbit tidak dapat diubah.' using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger placement_attempts_lock before update on public.placement_attempts
  for each row execute function public.lock_published_attempt();

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------

alter table public.students enable row level security;
alter table public.guardian_links enable row level security;
alter table public.placement_questions enable row level security;
alter table public.placement_attempts enable row level security;
alter table public.placement_answers enable row level security;

-- Siswa: diri sendiri, anak (untuk wali), dan staf operasional/akademik.
create policy students_select on public.students for select to authenticated
  using (public.can_access_student(id) or public.has_role('owner') or public.has_role('admin') or public.has_role('lead')
    or exists (select 1 from public.placement_attempts a where a.student_id = students.id and a.evaluator_id = auth.uid()));
create policy students_update_self on public.students for update to authenticated
  using (public.can_access_student(id)) with check (public.can_access_student(id));
create policy students_update_staff on public.students for update to authenticated
  using (public.has_role('owner') or public.has_role('admin')) with check (public.has_role('owner') or public.has_role('admin'));

revoke update on public.students from authenticated;
grant update (full_name, birth_year, learning_goal, interested_program_id) on public.students to authenticated;

create policy guardian_links_select on public.guardian_links for select to authenticated
  using (guardian_id = auth.uid() or public.has_role('owner') or public.has_role('admin'));
create policy guardian_links_decide on public.guardian_links for update to authenticated
  using (public.has_role('owner') or public.has_role('admin')) with check (public.has_role('owner') or public.has_role('admin'));

revoke update on public.guardian_links from authenticated;
grant update (status, decided_by, decided_at) on public.guardian_links to authenticated;

-- Bank soal (termasuk kunci jawaban) hanya untuk Academic Lead dan Owner.
create policy placement_questions_select on public.placement_questions for select to authenticated
  using (public.has_role('lead') or public.has_role('owner'));
create policy placement_questions_write on public.placement_questions for all to authenticated
  using (public.has_role('lead') or public.has_role('owner')) with check (public.has_role('lead') or public.has_role('owner'));

-- Attempt dibaca langsung oleh staf; siswa/wali membacanya lewat server.
create policy placement_attempts_staff on public.placement_attempts for select to authenticated
  using (public.has_role('owner') or public.has_role('lead') or public.has_role('admin') or evaluator_id = auth.uid());

create policy placement_answers_staff on public.placement_answers for select to authenticated
  using (exists (
    select 1 from public.placement_attempts a
    where a.id = placement_answers.attempt_id
      and (public.has_role('owner') or public.has_role('lead') or a.evaluator_id = auth.uid())
  ));
