-- Fase 0: fondasi. Profil, role, katalog program, konten landing page, audit log.
-- Semua tabel memakai Row Level Security; tanpa policy berarti tertutup.

create extension if not exists pgcrypto;

create type public.app_role as enum ('owner', 'admin', 'lead', 'tutor', 'student', 'guardian');

create or replace function public.touch_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Profil dan role
-- ---------------------------------------------------------------------------

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null default '' check (char_length(full_name) <= 120),
  email text not null unique,
  phone text check (phone is null or phone ~ '^\+?[0-9]{8,15}$'),
  status text not null default 'active' check (status in ('active', 'inactive')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger profiles_touch before update on public.profiles
  for each row execute function public.touch_updated_at();

create table public.user_roles (
  user_id uuid not null references public.profiles (id) on delete cascade,
  role public.app_role not null,
  granted_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  primary key (user_id, role)
);

-- Role aktif hanya berlaku jika akun berstatus active.
create or replace function public.has_role(check_role public.app_role) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1
    from public.user_roles r
    join public.profiles p on p.id = r.user_id
    where r.user_id = auth.uid() and r.role = check_role and p.status = 'active'
  );
$$;

create or replace function public.is_staff() returns boolean
language sql stable security definer set search_path = public as $$
  select public.has_role('owner') or public.has_role('admin') or public.has_role('lead') or public.has_role('tutor');
$$;

-- Akun baru dari pendaftaran publik hanya bisa menjadi siswa atau wali.
-- Akun staf dibuat lewat server (app_metadata.provisioned = true) dan role-nya diberikan Owner.
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  account_type text := coalesce(new.raw_user_meta_data ->> 'account_type', 'student');
begin
  insert into public.profiles (id, full_name, email, phone)
  values (
    new.id,
    left(coalesce(new.raw_user_meta_data ->> 'full_name', ''), 120),
    lower(new.email),
    nullif(new.raw_user_meta_data ->> 'phone', '')
  );

  if coalesce((new.raw_app_meta_data ->> 'provisioned')::boolean, false) = false then
    insert into public.user_roles (user_id, role)
    values (new.id, case when account_type = 'guardian' then 'guardian'::public.app_role else 'student'::public.app_role end);
  end if;

  return new;
end;
$$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Katalog program
-- ---------------------------------------------------------------------------

create table public.programs (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code ~ '^[A-Z]{2,4}$'),
  slug text not null unique check (slug ~ '^[a-z0-9-]+$'),
  name text not null,
  category text not null check (category in ('Everyday English', 'Academic English', 'Young Learners', 'Professional English')),
  entry_level text not null,
  duration_label text not null,
  capacity integer not null check (capacity between 1 and 30),
  price_idr integer not null check (price_idr >= 0),
  outcome text not null,
  evidence text not null,
  featured boolean not null default false,
  status text not null default 'active' check (status in ('draft', 'active', 'archived')),
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger programs_touch before update on public.programs
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------------
-- Konten landing page (CMS)
-- ---------------------------------------------------------------------------

create table public.site_settings (
  key text primary key check (key ~ '^[a-z0-9_]+$'),
  value jsonb not null,
  updated_by uuid references public.profiles (id),
  updated_at timestamptz not null default now()
);

create trigger site_settings_touch before update on public.site_settings
  for each row execute function public.touch_updated_at();

create table public.faqs (
  id uuid primary key default gen_random_uuid(),
  question text not null,
  answer text not null,
  sort_order integer not null default 0,
  published boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger faqs_touch before update on public.faqs
  for each row execute function public.touch_updated_at();

-- Testimoni hanya diisi dari peserta sungguhan; bagian ini tidak tampil saat kosong.
create table public.testimonials (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  program_label text not null,
  quote text not null,
  sort_order integer not null default 0,
  published boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger testimonials_touch before update on public.testimonials
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------------
-- Audit log
-- ---------------------------------------------------------------------------

create table public.audit_log (
  id bigint generated always as identity primary key,
  actor_id uuid references public.profiles (id),
  action text not null,
  entity text not null,
  entity_id text,
  detail jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create or replace function public.write_audit(p_action text, p_entity text, p_entity_id text, p_detail jsonb default '{}'::jsonb)
returns void language sql security definer set search_path = public as $$
  insert into public.audit_log (actor_id, action, entity, entity_id, detail)
  values (auth.uid(), p_action, p_entity, p_entity_id, coalesce(p_detail, '{}'::jsonb));
$$;

-- Perubahan role selalu tercatat.
create or replace function public.audit_user_roles() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    perform public.write_audit('role_granted', 'user_roles', new.user_id::text, jsonb_build_object('role', new.role));
    return new;
  else
    perform public.write_audit('role_revoked', 'user_roles', old.user_id::text, jsonb_build_object('role', old.role));
    return old;
  end if;
end;
$$;

create trigger user_roles_audit after insert or delete on public.user_roles
  for each row execute function public.audit_user_roles();

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------

alter table public.profiles enable row level security;
alter table public.user_roles enable row level security;
alter table public.programs enable row level security;
alter table public.site_settings enable row level security;
alter table public.faqs enable row level security;
alter table public.testimonials enable row level security;
alter table public.audit_log enable row level security;

-- Profil: pemilik akun membaca dan mengubah nama/telepon sendiri; Owner dan Admin membaca semua.
-- Status akun dan email hanya diubah lewat server (service role).
create policy profiles_select on public.profiles for select to authenticated
  using (id = auth.uid() or public.has_role('owner') or public.has_role('admin'));
create policy profiles_update_self on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

revoke update on public.profiles from authenticated;
grant update (full_name, phone) on public.profiles to authenticated;

-- Role: setiap orang membaca role sendiri; hanya Owner yang memberi/mencabut, dan tidak untuk dirinya sendiri.
create policy user_roles_select on public.user_roles for select to authenticated
  using (user_id = auth.uid() or public.has_role('owner') or public.has_role('admin'));
create policy user_roles_insert on public.user_roles for insert to authenticated
  with check (public.has_role('owner') and user_id <> auth.uid());
create policy user_roles_delete on public.user_roles for delete to authenticated
  using (public.has_role('owner') and user_id <> auth.uid());

-- Program: publik melihat program aktif; staf akademik dan operasional melihat semua; Owner mengubah.
create policy programs_public_select on public.programs for select to anon, authenticated
  using (status = 'active' or public.is_staff());
create policy programs_owner_write on public.programs for all to authenticated
  using (public.has_role('owner')) with check (public.has_role('owner'));

-- Konten landing: publik membaca; Owner dan Admin mengubah.
create policy site_settings_select on public.site_settings for select to anon, authenticated using (true);
create policy site_settings_write on public.site_settings for all to authenticated
  using (public.has_role('owner') or public.has_role('admin'))
  with check (public.has_role('owner') or public.has_role('admin'));

create policy faqs_select on public.faqs for select to anon, authenticated
  using (published or public.has_role('owner') or public.has_role('admin'));
create policy faqs_write on public.faqs for all to authenticated
  using (public.has_role('owner') or public.has_role('admin'))
  with check (public.has_role('owner') or public.has_role('admin'));

create policy testimonials_select on public.testimonials for select to anon, authenticated
  using (published or public.has_role('owner') or public.has_role('admin'));
create policy testimonials_write on public.testimonials for all to authenticated
  using (public.has_role('owner') or public.has_role('admin'))
  with check (public.has_role('owner') or public.has_role('admin'));

-- Audit: hanya Owner yang membaca; penulisan hanya lewat fungsi write_audit.
create policy audit_log_select on public.audit_log for select to authenticated using (public.has_role('owner'));

revoke all on function public.write_audit(text, text, text, jsonb) from public, anon, authenticated;
