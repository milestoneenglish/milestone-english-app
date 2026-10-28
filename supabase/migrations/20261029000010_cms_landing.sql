-- Kelompok 3: CMS khusus Owner, kartu baru landing page (mitra, tutor, galeri), foto testimoni,
-- dan kolom English untuk konten yang tampil di website. Kolom English kosong = memakai versi Indonesia.

alter table public.faqs
  add column question_en text not null default '' check (char_length(question_en) <= 200),
  add column answer_en text not null default '' check (char_length(answer_en) <= 2000);

alter table public.testimonials
  add column program_label_en text not null default '' check (char_length(program_label_en) <= 80),
  add column quote_en text not null default '' check (char_length(quote_en) <= 600),
  add column photo_url text check (photo_url is null or photo_url ~ '^https://');

alter table public.programs
  add column outcome_en text not null default '' check (char_length(outcome_en) <= 400),
  add column evidence_en text not null default '' check (char_length(evidence_en) <= 400);

-- Kartu landing page: logo "Telah dipercaya oleh", "Tutor kami", dan galeri foto.
-- partner: title = nama instansi, image_url = logo.
-- tutor:   title = nama, subtitle = keahlian, body = riwayat singkat, image_url = foto.
-- gallery: title = keterangan (boleh kosong), image_url = foto.
create table public.site_items (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('partner', 'tutor', 'gallery')),
  title text not null default '' check (char_length(title) <= 120),
  title_en text not null default '' check (char_length(title_en) <= 120),
  subtitle text not null default '' check (char_length(subtitle) <= 120),
  subtitle_en text not null default '' check (char_length(subtitle_en) <= 120),
  body text not null default '' check (char_length(body) <= 800),
  body_en text not null default '' check (char_length(body_en) <= 800),
  image_url text check (image_url is null or image_url ~ '^https://'),
  sort_order integer not null default 0,
  published boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (kind = 'gallery' or char_length(trim(title)) >= 2),
  check (kind = 'tutor' or image_url is not null)
);

create index site_items_kind on public.site_items (kind, sort_order);

create trigger site_items_touch before update on public.site_items
  for each row execute function public.touch_updated_at();

alter table public.site_items enable row level security;

create policy site_items_select on public.site_items for select to anon, authenticated
  using (published or public.has_role('owner'));
create policy site_items_write on public.site_items for all to authenticated
  using (public.has_role('owner')) with check (public.has_role('owner'));

-- CMS website kini khusus Owner (sebelumnya Owner dan Admin).
drop policy site_settings_write on public.site_settings;
create policy site_settings_write on public.site_settings for all to authenticated
  using (public.has_role('owner')) with check (public.has_role('owner'));

drop policy faqs_select on public.faqs;
create policy faqs_select on public.faqs for select to anon, authenticated using (published or public.has_role('owner'));
drop policy faqs_write on public.faqs;
create policy faqs_write on public.faqs for all to authenticated
  using (public.has_role('owner')) with check (public.has_role('owner'));

drop policy testimonials_select on public.testimonials;
create policy testimonials_select on public.testimonials for select to anon, authenticated using (published or public.has_role('owner'));
drop policy testimonials_write on public.testimonials;
create policy testimonials_write on public.testimonials for all to authenticated
  using (public.has_role('owner')) with check (public.has_role('owner'));

-- Deskripsi program (Indonesia dan English) hanya diubah Owner.
drop function public.update_program_description(uuid, text, text);
create function public.update_program_description(p_program uuid, p_outcome text, p_evidence text, p_outcome_en text default '', p_evidence_en text default '')
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.has_role('owner') then
    raise exception 'Hanya Owner yang mengubah deskripsi program.' using errcode = '42501';
  end if;
  if char_length(trim(coalesce(p_outcome, ''))) not between 10 and 400 or char_length(trim(coalesce(p_evidence, ''))) not between 5 and 400 then
    raise exception 'Target dan bukti program masing-masing 10–400 dan 5–400 karakter.' using errcode = '22023';
  end if;
  update public.programs
     set outcome = trim(p_outcome), evidence = trim(p_evidence),
         outcome_en = left(trim(coalesce(p_outcome_en, '')), 400), evidence_en = left(trim(coalesce(p_evidence_en, '')), 400)
   where id = p_program;
  if not found then
    raise exception 'Program tidak ditemukan.' using errcode = '22023';
  end if;
  perform public.write_audit('program_description_updated', 'programs', p_program::text);
end;
$$;

revoke all on function public.update_program_description(uuid, text, text, text, text) from public, anon;
grant execute on function public.update_program_description(uuid, text, text, text, text) to authenticated;
