-- Fase 5: Owner dan operasional. Staf dan role, program dan harga, pengeluaran, tiket bantuan,
-- konten website, observasi kelas, survei tutor, dan hitungan laporan yang dikembalikan.

-- ---------------------------------------------------------------------------
-- Staf dan role (hanya Owner)
-- ---------------------------------------------------------------------------

create or replace function public.is_support_staff() returns boolean
language sql stable security definer set search_path = public as $$
  select public.has_role('owner') or public.has_role('admin');
$$;

-- Tutor yang masih memegang batch dibuka/berjalan tidak bisa dinonaktifkan atau dicabut role-nya.
create or replace function public.tutor_has_live_batch(p_user uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.batches b where b.tutor_id = p_user and b.status in ('draft', 'open', 'running'));
$$;

-- Mengganti seluruh role staf seseorang. Role siswa/wali tidak disentuh.
create or replace function public.set_staff_roles(p_user uuid, p_roles public.app_role[]) returns void
language plpgsql security definer set search_path = public as $$
declare
  wanted public.app_role[] := array(select distinct r from unnest(coalesce(p_roles, '{}')) r);
begin
  if not public.has_role('owner') then
    raise exception 'Hanya Owner yang mengatur staf.' using errcode = '42501';
  end if;
  if p_user = auth.uid() then
    raise exception 'Role akun sendiri tidak bisa diubah dari sini.' using errcode = '42501';
  end if;
  if not exists (select 1 from public.profiles where id = p_user) then
    raise exception 'Akun tidak ditemukan.' using errcode = '22023';
  end if;
  if array_length(wanted, 1) is null then
    raise exception 'Pilih minimal satu role.' using errcode = '22023';
  end if;
  if exists (select 1 from unnest(wanted) r where r not in ('owner', 'admin', 'lead', 'tutor')) then
    raise exception 'Role staf hanya Owner, Admin Operasional, Academic Lead, atau Tutor.' using errcode = '22023';
  end if;
  if not ('tutor' = any (wanted)) and exists (select 1 from public.user_roles where user_id = p_user and role = 'tutor')
     and public.tutor_has_live_batch(p_user) then
    raise exception 'Tutor ini masih memegang batch yang belum selesai. Pindahkan batch ke tutor lain dulu.' using errcode = '22023';
  end if;

  delete from public.user_roles
  where user_id = p_user and role in ('owner', 'admin', 'lead', 'tutor') and not (role = any (wanted));
  insert into public.user_roles (user_id, role, granted_by)
  select p_user, r, auth.uid() from unnest(wanted) r
  on conflict (user_id, role) do nothing;
end;
$$;

create or replace function public.set_staff_active(p_user uuid, p_active boolean) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.has_role('owner') then
    raise exception 'Hanya Owner yang mengatur staf.' using errcode = '42501';
  end if;
  if p_user = auth.uid() then
    raise exception 'Akun sendiri tidak bisa dinonaktifkan.' using errcode = '42501';
  end if;
  if not exists (select 1 from public.user_roles where user_id = p_user and role in ('owner', 'admin', 'lead', 'tutor')) then
    raise exception 'Akun ini bukan staf.' using errcode = '22023';
  end if;
  if not p_active and public.tutor_has_live_batch(p_user) then
    raise exception 'Tutor ini masih memegang batch yang belum selesai. Pindahkan batch ke tutor lain dulu.' using errcode = '22023';
  end if;
  update public.profiles set status = case when p_active then 'active' else 'inactive' end where id = p_user;
  perform public.write_audit(case when p_active then 'staff_activated' else 'staff_deactivated' end, 'profiles', p_user::text);
end;
$$;

-- ---------------------------------------------------------------------------
-- Program dan harga: Owner mengubah semuanya (RLS programs_owner_write);
-- Admin hanya deskripsi lewat fungsi ini.
-- ---------------------------------------------------------------------------

create or replace function public.update_program_description(p_program uuid, p_outcome text, p_evidence text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_support_staff() then
    raise exception 'Hanya Owner atau Admin yang mengubah deskripsi program.' using errcode = '42501';
  end if;
  if char_length(trim(coalesce(p_outcome, ''))) not between 10 and 400 or char_length(trim(coalesce(p_evidence, ''))) not between 5 and 400 then
    raise exception 'Target dan bukti program masing-masing 10–400 dan 5–400 karakter.' using errcode = '22023';
  end if;
  update public.programs set outcome = trim(p_outcome), evidence = trim(p_evidence) where id = p_program;
  if not found then
    raise exception 'Program tidak ditemukan.' using errcode = '22023';
  end if;
  perform public.write_audit('program_description_updated', 'programs', p_program::text);
end;
$$;

create or replace function public.audit_programs() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    perform public.write_audit('program_created', 'programs', new.id::text, jsonb_build_object('code', new.code, 'price', new.price_idr));
  elsif old.price_idr is distinct from new.price_idr or old.status is distinct from new.status then
    perform public.write_audit('program_updated', 'programs', new.id::text,
      jsonb_build_object('code', new.code, 'price_from', old.price_idr, 'price', new.price_idr, 'status_from', old.status, 'status', new.status));
  end if;
  return new;
end;
$$;

create trigger programs_audit after insert or update on public.programs
  for each row execute function public.audit_programs();

-- Rekening tujuan transfer dan catatan backup hanya diubah Owner; konten lain Owner dan Admin.
drop policy site_settings_write on public.site_settings;
create policy site_settings_write on public.site_settings for all to authenticated
  using (public.has_role('owner') or (public.has_role('admin') and key not in ('payment', 'backup')))
  with check (public.has_role('owner') or (public.has_role('admin') and key not in ('payment', 'backup')));

-- ---------------------------------------------------------------------------
-- Keuangan: pemasukan diambil dari invoice lunas; pengeluaran dicatat manual oleh Owner.
-- ---------------------------------------------------------------------------

create table public.expenses (
  id uuid primary key default gen_random_uuid(),
  spent_on date not null,
  category text not null check (category in ('tutor_fee', 'marketing', 'tools', 'operational', 'other')),
  description text not null check (char_length(description) between 3 and 300),
  amount_idr integer not null check (amount_idr > 0),
  receipt_path text,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index expenses_spent_on on public.expenses (spent_on);

create trigger expenses_touch before update on public.expenses
  for each row execute function public.touch_updated_at();

create or replace function public.audit_expenses() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'DELETE' then
    perform public.write_audit('expense_deleted', 'expenses', old.id::text, jsonb_build_object('amount', old.amount_idr, 'description', old.description));
    return old;
  end if;
  perform public.write_audit(case when tg_op = 'INSERT' then 'expense_created' else 'expense_updated' end, 'expenses', new.id::text,
    jsonb_build_object('amount', new.amount_idr, 'description', new.description));
  return new;
end;
$$;

create trigger expenses_audit after insert or update or delete on public.expenses
  for each row execute function public.audit_expenses();

alter table public.expenses enable row level security;
create policy expenses_owner on public.expenses for all to authenticated
  using (public.has_role('owner')) with check (public.has_role('owner'));

-- ---------------------------------------------------------------------------
-- Bantuan: tiket dari siswa/wali, dibalas Admin (atau Owner).
-- ---------------------------------------------------------------------------

create sequence public.ticket_number_seq;

create table public.tickets (
  id uuid primary key default gen_random_uuid(),
  number text not null unique default 'TKT-' || lpad(nextval('public.ticket_number_seq')::text, 5, '0'),
  requester_id uuid not null references public.profiles (id) on delete cascade,
  category text not null check (category in ('payment', 'class', 'technical', 'other')),
  subject text not null check (char_length(subject) between 5 and 120),
  status text not null default 'open' check (status in ('open', 'answered', 'closed')),
  closed_at timestamptz,
  closed_by uuid references public.profiles (id) on delete set null,
  last_message_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index tickets_requester on public.tickets (requester_id);
create index tickets_status on public.tickets (status);

create trigger tickets_touch before update on public.tickets
  for each row execute function public.touch_updated_at();

create table public.ticket_messages (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references public.tickets (id) on delete cascade,
  author_id uuid references public.profiles (id) on delete set null,
  from_staff boolean not null default false,
  body text not null check (char_length(body) between 2 and 4000),
  created_at timestamptz not null default now()
);

create index ticket_messages_ticket on public.ticket_messages (ticket_id, created_at);

create or replace function public.create_ticket(p_category text, p_subject text, p_body text) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  new_id uuid;
begin
  if not (public.has_role('student') or public.has_role('guardian')) then
    raise exception 'Tiket bantuan dibuat dari akun siswa atau wali.' using errcode = '42501';
  end if;
  if (select count(*) from public.tickets where requester_id = auth.uid() and status <> 'closed') >= 5 then
    raise exception 'Masih ada 5 tiket yang belum selesai. Lanjutkan percakapan di tiket yang ada.' using errcode = '22023';
  end if;
  if char_length(trim(coalesce(p_subject, ''))) not between 5 and 120 then
    raise exception 'Judul tiket 5–120 karakter.' using errcode = '22023';
  end if;
  if char_length(trim(coalesce(p_body, ''))) not between 10 and 4000 then
    raise exception 'Jelaskan kendalamu minimal 10 karakter.' using errcode = '22023';
  end if;
  insert into public.tickets (requester_id, category, subject) values (auth.uid(), p_category, trim(p_subject)) returning id into new_id;
  insert into public.ticket_messages (ticket_id, author_id, from_staff, body) values (new_id, auth.uid(), false, trim(p_body));
  return new_id;
end;
$$;

-- Balasan staf menandai tiket "dijawab"; balasan peminta membukanya lagi untuk staf.
create or replace function public.reply_ticket(p_ticket uuid, p_body text) returns void
language plpgsql security definer set search_path = public as $$
declare
  t public.tickets;
  staff boolean := public.is_support_staff();
begin
  select * into t from public.tickets where id = p_ticket for update;
  if t.id is null or not (staff or t.requester_id = auth.uid()) then
    raise exception 'Tiket tidak ditemukan.' using errcode = '42501';
  end if;
  if t.status = 'closed' then
    raise exception 'Tiket sudah ditutup.' using errcode = '22023';
  end if;
  if char_length(trim(coalesce(p_body, ''))) not between 2 and 4000 then
    raise exception 'Tulis balasan terlebih dahulu.' using errcode = '22023';
  end if;
  -- Staf yang juga peminta tiket ini (jarang) dianggap peminta.
  staff := staff and t.requester_id <> auth.uid();
  insert into public.ticket_messages (ticket_id, author_id, from_staff, body) values (t.id, auth.uid(), staff, trim(p_body));
  update public.tickets set status = case when staff then 'answered' else 'open' end, last_message_at = now() where id = t.id;
end;
$$;

create or replace function public.close_ticket(p_ticket uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_support_staff() then
    raise exception 'Hanya Admin yang menutup tiket.' using errcode = '42501';
  end if;
  update public.tickets set status = 'closed', closed_at = now(), closed_by = auth.uid() where id = p_ticket and status <> 'closed';
  if not found then
    raise exception 'Tiket tidak ditemukan atau sudah ditutup.' using errcode = '22023';
  end if;
  perform public.write_audit('ticket_closed', 'tickets', p_ticket::text);
end;
$$;

-- Peminta bisa membuka lagi tiket yang ditutup dalam 7 hari terakhir, disertai pesan.
create or replace function public.reopen_ticket(p_ticket uuid, p_body text) returns void
language plpgsql security definer set search_path = public as $$
declare
  t public.tickets;
begin
  select * into t from public.tickets where id = p_ticket for update;
  if t.id is null or t.requester_id <> auth.uid() then
    raise exception 'Tiket tidak ditemukan.' using errcode = '42501';
  end if;
  if t.status <> 'closed' then
    raise exception 'Tiket ini masih terbuka.' using errcode = '22023';
  end if;
  if t.closed_at < now() - interval '7 days' then
    raise exception 'Tiket ditutup lebih dari 7 hari lalu. Buat tiket baru.' using errcode = '22023';
  end if;
  if char_length(trim(coalesce(p_body, ''))) not between 2 and 4000 then
    raise exception 'Tulis alasan membuka tiket lagi.' using errcode = '22023';
  end if;
  insert into public.ticket_messages (ticket_id, author_id, from_staff, body) values (t.id, auth.uid(), false, trim(p_body));
  update public.tickets set status = 'open', closed_at = null, closed_by = null, last_message_at = now() where id = t.id;
end;
$$;

alter table public.tickets enable row level security;
alter table public.ticket_messages enable row level security;
create policy tickets_select on public.tickets for select to authenticated
  using (requester_id = auth.uid() or public.is_support_staff());
create policy ticket_messages_select on public.ticket_messages for select to authenticated
  using (exists (select 1 from public.tickets t where t.id = ticket_id and (t.requester_id = auth.uid() or public.is_support_staff())));
revoke insert, update, delete on public.tickets, public.ticket_messages from authenticated, anon;

-- ---------------------------------------------------------------------------
-- Kualitas tutor: hitungan laporan dikembalikan, observasi kelas, survei siswa.
-- ---------------------------------------------------------------------------

alter table public.reports add column return_count integer not null default 0;

create or replace function public.count_report_return() returns trigger
language plpgsql as $$
begin
  if old.status = 'submitted' and new.status = 'returned' then
    new.return_count := old.return_count + 1;
  end if;
  return new;
end;
$$;

create trigger reports_count_return before update on public.reports
  for each row execute function public.count_report_return();

create table public.tutor_observations (
  id uuid primary key default gen_random_uuid(),
  tutor_id uuid not null references public.profiles (id) on delete cascade,
  batch_id uuid not null references public.batches (id) on delete cascade,
  observed_on date not null,
  scores jsonb not null,
  strengths text not null check (char_length(strengths) between 5 and 2000),
  improvements text not null check (char_length(improvements) between 5 and 2000),
  observed_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

create index tutor_observations_tutor on public.tutor_observations (tutor_id, observed_on desc);

-- Lima aspek observasi, masing-masing skor 1–4 (skala sama dengan rubrik siswa).
create or replace function public.observation_aspects() returns text[]
language sql immutable as $$
  select array['preparation', 'engagement', 'clarity', 'feedback', 'time'];
$$;

create or replace function public.save_observation(p_batch uuid, p_observed_on date, p_scores jsonb, p_strengths text, p_improvements text) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  b public.batches;
  aspect text;
  new_id uuid;
begin
  if not (public.has_role('lead') or public.has_role('owner')) then
    raise exception 'Hanya Academic Lead yang mengisi observasi kelas.' using errcode = '42501';
  end if;
  select * into b from public.batches where id = p_batch;
  if b.id is null or b.tutor_id is null then
    raise exception 'Pilih batch yang punya tutor.' using errcode = '22023';
  end if;
  if p_observed_on is null or p_observed_on > (now() at time zone 'Asia/Jakarta')::date then
    raise exception 'Tanggal observasi tidak boleh di masa depan.' using errcode = '22023';
  end if;
  if jsonb_typeof(p_scores) <> 'object' then
    raise exception 'Isi skor semua aspek.' using errcode = '22023';
  end if;
  foreach aspect in array public.observation_aspects() loop
    if jsonb_typeof(p_scores -> aspect) <> 'number' or (p_scores ->> aspect)::numeric not in (1, 2, 3, 4) then
      raise exception 'Isi skor 1–4 untuk semua aspek.' using errcode = '22023';
    end if;
  end loop;
  if exists (select 1 from jsonb_object_keys(p_scores) k where not (k = any (public.observation_aspects()))) then
    raise exception 'Aspek observasi tidak dikenal.' using errcode = '22023';
  end if;
  if char_length(trim(coalesce(p_strengths, ''))) < 5 or char_length(trim(coalesce(p_improvements, ''))) < 5 then
    raise exception 'Tulis kekuatan dan saran perbaikan tutor.' using errcode = '22023';
  end if;
  insert into public.tutor_observations (tutor_id, batch_id, observed_on, scores, strengths, improvements, observed_by)
  values (b.tutor_id, b.id, p_observed_on, p_scores, trim(p_strengths), trim(p_improvements), auth.uid())
  returning id into new_id;
  perform public.write_audit('observation_recorded', 'tutor_observations', new_id::text, jsonb_build_object('batch', b.code));
  return new_id;
end;
$$;

create table public.tutor_surveys (
  id uuid primary key default gen_random_uuid(),
  enrollment_id uuid not null unique references public.enrollments (id) on delete cascade,
  tutor_id uuid not null references public.profiles (id) on delete cascade,
  batch_id uuid not null references public.batches (id) on delete cascade,
  rating smallint not null check (rating between 1 and 5),
  comment text not null default '' check (char_length(comment) <= 1000),
  created_at timestamptz not null default now()
);

create index tutor_surveys_tutor on public.tutor_surveys (tutor_id);

-- Siswa (atau walinya) menilai tutor sekali, setelah program selesai.
create or replace function public.submit_tutor_survey(p_enrollment uuid, p_rating integer, p_comment text) returns void
language plpgsql security definer set search_path = public as $$
declare
  e record;
begin
  select en.id, en.student_id, en.status, b.id as batch_id, b.tutor_id, b.status as batch_status
  into e
  from public.enrollments en join public.batches b on b.id = en.batch_id
  where en.id = p_enrollment;
  if e.id is null or not public.can_access_student(e.student_id) then
    raise exception 'Kelas tidak ditemukan.' using errcode = '42501';
  end if;
  if e.status <> 'completed' and e.batch_status <> 'completed' then
    raise exception 'Penilaian tutor dibuka setelah program selesai.' using errcode = '22023';
  end if;
  if e.tutor_id is null then
    raise exception 'Kelas ini belum punya tutor.' using errcode = '22023';
  end if;
  if p_rating is null or p_rating not between 1 and 5 then
    raise exception 'Pilih nilai 1–5.' using errcode = '22023';
  end if;
  if exists (select 1 from public.tutor_surveys where enrollment_id = e.id) then
    raise exception 'Penilaian untuk kelas ini sudah dikirim.' using errcode = '23505';
  end if;
  insert into public.tutor_surveys (enrollment_id, tutor_id, batch_id, rating, comment)
  values (e.id, e.tutor_id, e.batch_id, p_rating, left(trim(coalesce(p_comment, '')), 1000));
end;
$$;

alter table public.tutor_observations enable row level security;
alter table public.tutor_surveys enable row level security;
create policy tutor_observations_select on public.tutor_observations for select to authenticated
  using (public.has_role('lead') or public.has_role('owner'));
create policy tutor_surveys_select on public.tutor_surveys for select to authenticated
  using (public.has_role('lead') or public.has_role('owner'));
revoke insert, update, delete on public.tutor_observations, public.tutor_surveys from authenticated, anon;

-- ---------------------------------------------------------------------------
-- Hak eksekusi fungsi
-- ---------------------------------------------------------------------------

revoke all on function public.set_staff_roles(uuid, public.app_role[]) from public, anon;
revoke all on function public.set_staff_active(uuid, boolean) from public, anon;
revoke all on function public.update_program_description(uuid, text, text) from public, anon;
revoke all on function public.create_ticket(text, text, text) from public, anon;
revoke all on function public.reply_ticket(uuid, text) from public, anon;
revoke all on function public.close_ticket(uuid) from public, anon;
revoke all on function public.reopen_ticket(uuid, text) from public, anon;
revoke all on function public.save_observation(uuid, date, jsonb, text, text) from public, anon;
revoke all on function public.submit_tutor_survey(uuid, integer, text) from public, anon;
grant execute on function public.set_staff_roles(uuid, public.app_role[]) to authenticated;
grant execute on function public.set_staff_active(uuid, boolean) to authenticated;
grant execute on function public.update_program_description(uuid, text, text) to authenticated;
grant execute on function public.create_ticket(text, text, text) to authenticated;
grant execute on function public.reply_ticket(uuid, text) to authenticated;
grant execute on function public.close_ticket(uuid) to authenticated;
grant execute on function public.reopen_ticket(uuid, text) to authenticated;
grant execute on function public.save_observation(uuid, date, jsonb, text, text) to authenticated;
grant execute on function public.submit_tutor_survey(uuid, integer, text) to authenticated;
