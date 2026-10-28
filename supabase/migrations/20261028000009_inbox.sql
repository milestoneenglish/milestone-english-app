-- Notifikasi di dalam aplikasi (lonceng di portal). Setiap pesan yang dikirim notify() juga masuk ke kotak
-- notifikasi penerimanya, sehingga pemberitahuan tetap sampai walaupun email dan WhatsApp belum disambungkan.

create table public.inbox (
  id uuid primary key default gen_random_uuid(),
  recipient_id uuid not null references public.profiles (id) on delete cascade,
  template text not null,
  title text not null check (char_length(title) <= 200),
  body text not null default '' check (char_length(body) <= 2000),
  link text check (link is null or link ~ '^/'),
  entity text,
  entity_id text,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index inbox_recipient on public.inbox (recipient_id, created_at desc);
create index inbox_unread on public.inbox (recipient_id) where read_at is null;

alter table public.inbox enable row level security;

-- Setiap orang hanya membaca notifikasinya sendiri; penulisan hanya lewat server.
create policy inbox_select on public.inbox for select to authenticated using (recipient_id = auth.uid());
revoke insert, update, delete on public.inbox from authenticated, anon;

-- Menandai notifikasi sendiri sudah dibaca (semua bila p_ids null).
create or replace function public.mark_inbox_read(p_ids uuid[] default null) returns integer
language plpgsql security definer set search_path = public as $$
declare
  n integer;
begin
  update public.inbox set read_at = now()
  where recipient_id = auth.uid() and read_at is null and (p_ids is null or id = any (p_ids));
  get diagnostics n = row_count;
  return n;
end;
$$;

revoke all on function public.mark_inbox_read(uuid[]) from public, anon;
grant execute on function public.mark_inbox_read(uuid[]) to authenticated;
