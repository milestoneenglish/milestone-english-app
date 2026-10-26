-- Fase 2: batch kelas, jadwal sesi, pendaftaran kelas, invoice, bukti bayar, dan log notifikasi.
-- Perubahan status penting (daftar batch, kirim bukti, verifikasi) hanya lewat fungsi di bawah,
-- supaya kapasitas, batas bayar 2x24 jam, dan hak akses diperiksa di satu tempat.

-- ---------------------------------------------------------------------------
-- Batch dan sesi
-- ---------------------------------------------------------------------------

create table public.batches (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code ~ '^[A-Z0-9-]{3,24}$'),
  program_id uuid not null references public.programs (id),
  tutor_id uuid references public.profiles (id) on delete set null,
  start_date date not null,
  schedule_label text not null check (char_length(schedule_label) between 3 and 200),
  meeting_url text check (meeting_url is null or meeting_url ~ '^https://'),
  capacity integer not null check (capacity between 1 and 30),
  status text not null default 'draft' check (status in ('draft', 'open', 'running', 'completed', 'cancelled')),
  notes text not null default '' check (char_length(notes) <= 1000),
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index batches_program on public.batches (program_id);
create index batches_tutor on public.batches (tutor_id);

create trigger batches_touch before update on public.batches
  for each row execute function public.touch_updated_at();

create table public.class_sessions (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null references public.batches (id) on delete cascade,
  seq integer not null check (seq between 1 and 200),
  starts_at timestamptz not null,
  duration_minutes integer not null check (duration_minutes between 15 and 240),
  topic text not null default '' check (char_length(topic) <= 200),
  created_at timestamptz not null default now(),
  unique (batch_id, seq)
);

-- ---------------------------------------------------------------------------
-- Pendaftaran kelas, invoice, bukti bayar
-- ---------------------------------------------------------------------------

create table public.enrollments (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students (id) on delete cascade,
  batch_id uuid not null references public.batches (id),
  status text not null default 'pending_payment'
    check (status in ('pending_payment', 'awaiting_verification', 'active', 'completed', 'cancelled', 'expired')),
  activated_at timestamptz,
  onboarded_at timestamptz,
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Satu siswa hanya punya satu pendaftaran yang masih berlaku di setiap batch.
create unique index enrollments_one_per_batch on public.enrollments (student_id, batch_id)
  where status in ('pending_payment', 'awaiting_verification', 'active', 'completed');
create index enrollments_batch on public.enrollments (batch_id);

create trigger enrollments_touch before update on public.enrollments
  for each row execute function public.touch_updated_at();

create sequence public.invoice_number_seq;

create table public.invoices (
  id uuid primary key default gen_random_uuid(),
  number text not null unique,
  enrollment_id uuid not null unique references public.enrollments (id) on delete cascade,
  student_id uuid not null references public.students (id) on delete cascade,
  amount_idr integer not null check (amount_idr >= 0),
  description text not null,
  status text not null default 'unpaid'
    check (status in ('unpaid', 'awaiting_verification', 'paid', 'expired', 'cancelled')),
  due_at timestamptz not null,
  reject_reason text,
  paid_at timestamptz,
  verified_by uuid references public.profiles (id),
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index invoices_student on public.invoices (student_id);
create index invoices_status on public.invoices (status);

create trigger invoices_touch before update on public.invoices
  for each row execute function public.touch_updated_at();

create table public.payment_proofs (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references public.invoices (id) on delete cascade,
  file_path text not null,
  sender_bank text not null check (char_length(sender_bank) between 2 and 60),
  sender_name text not null check (char_length(sender_name) between 2 and 120),
  transfer_date date not null,
  amount_idr integer not null check (amount_idr > 0),
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  reject_reason text,
  uploaded_by uuid references public.profiles (id),
  decided_by uuid references public.profiles (id),
  decided_at timestamptz,
  created_at timestamptz not null default now()
);

create index payment_proofs_invoice on public.payment_proofs (invoice_id);

-- ---------------------------------------------------------------------------
-- Log notifikasi email dan WhatsApp. Setiap pesan tercatat, termasuk yang belum
-- terkirim karena layanan pengirim belum dikonfigurasi (status skipped).
-- ---------------------------------------------------------------------------

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_id uuid references public.profiles (id) on delete cascade,
  channel text not null check (channel in ('email', 'whatsapp')),
  destination text not null,
  template text not null,
  subject text not null default '',
  body text not null,
  status text not null default 'queued' check (status in ('queued', 'sent', 'failed', 'skipped')),
  error text,
  entity text,
  entity_id text,
  sent_at timestamptz,
  created_at timestamptz not null default now()
);

create index notifications_created on public.notifications (created_at desc);

-- ---------------------------------------------------------------------------
-- Fungsi alur
-- ---------------------------------------------------------------------------

-- Invoice yang lewat batas bayar dilepas, sehingga kursinya kembali tersedia.
create or replace function public.release_expired_invoices() returns integer
language plpgsql security definer set search_path = public as $$
declare
  n integer;
begin
  with expired as (
    update public.invoices set status = 'expired'
    where status = 'unpaid' and due_at < now()
    returning enrollment_id
  )
  update public.enrollments e set status = 'expired'
  from expired x where e.id = x.enrollment_id and e.status = 'pending_payment';
  get diagnostics n = row_count;
  return n;
end;
$$;

create or replace function public.batch_seats_taken(p_batch uuid) returns integer
language sql stable security definer set search_path = public as $$
  select count(*)::integer from public.enrollments
  where batch_id = p_batch and status in ('pending_payment', 'awaiting_verification', 'active');
$$;

-- Siswa/wali memilih batch: kursi dipegang dan invoice terbit dengan batas bayar 2x24 jam.
create or replace function public.enroll_in_batch(p_student uuid, p_batch uuid) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  s public.students;
  b public.batches;
  p public.programs;
  enrollment uuid;
  invoice uuid;
  staff boolean;
begin
  perform public.release_expired_invoices();

  select * into s from public.students where id = p_student;
  staff := public.has_role('admin') or public.has_role('owner');
  if s.id is null or not (staff or public.can_access_student(p_student)) then
    raise exception 'Siswa tidak ditemukan.' using errcode = '42501';
  end if;
  if not staff and s.user_id is distinct from auth.uid() and not exists (
    select 1 from public.guardian_links g where g.student_id = p_student and g.guardian_id = auth.uid() and g.status = 'verified'
  ) then
    raise exception 'Hubungan wali dan anak belum diverifikasi admin.' using errcode = '42501';
  end if;
  if not exists (select 1 from public.placement_attempts a where a.student_id = p_student and a.status = 'published')
     and not exists (select 1 from public.enrollments e where e.student_id = p_student and e.status = 'completed') then
    raise exception 'Hasil placement test belum terbit.' using errcode = '22023';
  end if;

  select * into b from public.batches where id = p_batch for update;
  if b.id is null or b.status <> 'open' then
    raise exception 'Batch ini tidak sedang membuka pendaftaran.' using errcode = '22023';
  end if;
  if exists (
    select 1 from public.enrollments e
    where e.student_id = p_student and e.batch_id = p_batch and e.status in ('pending_payment', 'awaiting_verification', 'active', 'completed')
  ) then
    raise exception 'Siswa ini sudah terdaftar di batch tersebut.' using errcode = '23505';
  end if;
  if public.batch_seats_taken(p_batch) >= b.capacity then
    raise exception 'Batch sudah penuh. Pilih batch lain.' using errcode = '22023';
  end if;

  select * into p from public.programs where id = b.program_id;

  insert into public.enrollments (student_id, batch_id, created_by)
  values (p_student, p_batch, auth.uid())
  returning id into enrollment;

  insert into public.invoices (number, enrollment_id, student_id, amount_idr, description, due_at, created_by)
  values (
    'INV-' || to_char(now() at time zone 'Asia/Jakarta', 'YYMM') || '-' || lpad(nextval('public.invoice_number_seq')::text, 4, '0'),
    enrollment,
    p_student,
    p.price_idr,
    p.name || ' · batch ' || b.code || ' · ' || s.full_name,
    now() + interval '48 hours',
    auth.uid()
  )
  returning id into invoice;

  perform public.write_audit('enrollment_created', 'enrollments', enrollment::text, jsonb_build_object('batch', b.code, 'invoice', invoice));
  return invoice;
end;
$$;

-- Siswa/wali mengirim bukti transfer untuk invoice yang belum dibayar.
create or replace function public.submit_payment_proof(
  p_invoice uuid, p_path text, p_bank text, p_sender text, p_transfer_date date, p_amount integer
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  inv public.invoices;
  proof uuid;
begin
  perform public.release_expired_invoices();
  select * into inv from public.invoices where id = p_invoice for update;
  if inv.id is null or not public.can_access_student(inv.student_id) then
    raise exception 'Invoice tidak ditemukan.' using errcode = '42501';
  end if;
  if inv.status = 'expired' then
    raise exception 'Batas pembayaran sudah lewat. Pilih batch lagi untuk membuat invoice baru.' using errcode = '22023';
  end if;
  if inv.status <> 'unpaid' then
    raise exception 'Invoice ini tidak menunggu pembayaran.' using errcode = '22023';
  end if;
  if p_path is null or left(p_path, 37) <> p_invoice::text || '/' then
    raise exception 'File bukti tidak valid.' using errcode = '22023';
  end if;

  insert into public.payment_proofs (invoice_id, file_path, sender_bank, sender_name, transfer_date, amount_idr, uploaded_by)
  values (p_invoice, p_path, trim(p_bank), trim(p_sender), p_transfer_date, p_amount, auth.uid())
  returning id into proof;

  update public.invoices set status = 'awaiting_verification', reject_reason = null where id = p_invoice;
  update public.enrollments set status = 'awaiting_verification' where id = inv.enrollment_id;
  perform public.write_audit('payment_proof_submitted', 'invoices', p_invoice::text, jsonb_build_object('proof', proof));
  return proof;
end;
$$;

-- Admin memverifikasi atau menolak bukti transfer.
create or replace function public.decide_payment(p_proof uuid, p_approve boolean, p_reason text default null) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  pr public.payment_proofs;
  inv public.invoices;
begin
  if not (public.has_role('admin') or public.has_role('owner')) then
    raise exception 'Hanya admin yang dapat memverifikasi pembayaran.' using errcode = '42501';
  end if;
  select * into pr from public.payment_proofs where id = p_proof for update;
  if pr.id is null or pr.status <> 'pending' then
    raise exception 'Bukti ini sudah diputuskan sebelumnya.' using errcode = '22023';
  end if;
  select * into inv from public.invoices where id = pr.invoice_id for update;

  if p_approve then
    update public.payment_proofs set status = 'approved', decided_by = auth.uid(), decided_at = now() where id = p_proof;
    update public.invoices set status = 'paid', paid_at = now(), verified_by = auth.uid(), reject_reason = null where id = inv.id;
    update public.enrollments set status = 'active', activated_at = now() where id = inv.enrollment_id;
    update public.students set status = 'active' where id = inv.student_id;
    perform public.write_audit('payment_verified', 'invoices', inv.id::text, jsonb_build_object('proof', p_proof, 'amount', inv.amount_idr));
  else
    if char_length(trim(coalesce(p_reason, ''))) < 5 then
      raise exception 'Tuliskan alasan penolakan.' using errcode = '22023';
    end if;
    update public.payment_proofs set status = 'rejected', reject_reason = trim(p_reason), decided_by = auth.uid(), decided_at = now() where id = p_proof;
    -- Siswa diberi waktu minimal 24 jam lagi untuk mengunggah ulang.
    update public.invoices set status = 'unpaid', reject_reason = trim(p_reason), due_at = greatest(due_at, now() + interval '24 hours') where id = inv.id;
    update public.enrollments set status = 'pending_payment' where id = inv.enrollment_id;
    perform public.write_audit('payment_rejected', 'invoices', inv.id::text, jsonb_build_object('proof', p_proof, 'reason', trim(p_reason)));
  end if;
  return inv.id;
end;
$$;

-- Halaman sambutan kelas ditandai sudah dibaca.
create or replace function public.complete_onboarding(p_enrollment uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  e public.enrollments;
begin
  select * into e from public.enrollments where id = p_enrollment;
  if e.id is null or not public.can_access_student(e.student_id) then
    raise exception 'Pendaftaran tidak ditemukan.' using errcode = '42501';
  end if;
  if e.status <> 'active' then
    raise exception 'Kelas belum aktif.' using errcode = '22023';
  end if;
  update public.enrollments set onboarded_at = coalesce(onboarded_at, now()) where id = p_enrollment;
end;
$$;

-- Batch yang membuka pendaftaran, untuk landing page (tanpa link kelas).
create or replace function public.open_batches()
returns table (id uuid, program_id uuid, program_slug text, code text, start_date date, schedule_label text, seats_left integer)
language sql stable security definer set search_path = public as $$
  select b.id, b.program_id, p.slug, b.code, b.start_date, b.schedule_label, greatest(b.capacity - public.batch_seats_taken(b.id), 0)
  from public.batches b
  join public.programs p on p.id = b.program_id
  where b.status = 'open' and p.status = 'active'
  order by b.start_date;
$$;

revoke all on function public.release_expired_invoices() from public, anon;
revoke all on function public.batch_seats_taken(uuid) from public, anon;
revoke all on function public.enroll_in_batch(uuid, uuid) from public, anon;
revoke all on function public.submit_payment_proof(uuid, text, text, text, date, integer) from public, anon;
revoke all on function public.decide_payment(uuid, boolean, text) from public, anon;
revoke all on function public.complete_onboarding(uuid) from public, anon;
grant execute on function public.release_expired_invoices() to authenticated;
grant execute on function public.batch_seats_taken(uuid) to authenticated;
grant execute on function public.enroll_in_batch(uuid, uuid) to authenticated;
grant execute on function public.submit_payment_proof(uuid, text, text, text, date, integer) to authenticated;
grant execute on function public.decide_payment(uuid, boolean, text) to authenticated;
grant execute on function public.complete_onboarding(uuid) to authenticated;
grant execute on function public.open_batches() to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------

alter table public.batches enable row level security;
alter table public.class_sessions enable row level security;
alter table public.enrollments enable row level security;
alter table public.invoices enable row level security;
alter table public.payment_proofs enable row level security;
alter table public.notifications enable row level security;

create or replace function public.in_batch(p_batch uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.enrollments e
    where e.batch_id = p_batch and e.status in ('awaiting_verification', 'active', 'completed') and public.can_access_student(e.student_id)
  );
$$;

-- Batch dan sesi: staf operasional/akademik, tutor batch itu, dan siswa/wali yang terdaftar.
create policy batches_select on public.batches for select to authenticated
  using (public.has_role('owner') or public.has_role('admin') or public.has_role('lead') or tutor_id = auth.uid() or public.in_batch(id));
create policy batches_write on public.batches for all to authenticated
  using (public.has_role('owner') or public.has_role('admin')) with check (public.has_role('owner') or public.has_role('admin'));

create policy class_sessions_select on public.class_sessions for select to authenticated
  using (exists (select 1 from public.batches b where b.id = class_sessions.batch_id));
create policy class_sessions_write on public.class_sessions for all to authenticated
  using (public.has_role('owner') or public.has_role('admin')) with check (public.has_role('owner') or public.has_role('admin'));

-- Pendaftaran kelas: tutor melihat siswa di batch-nya, tanpa data pembayaran.
create policy enrollments_select on public.enrollments for select to authenticated
  using (public.can_access_student(student_id) or public.has_role('owner') or public.has_role('admin') or public.has_role('lead')
    or exists (select 1 from public.batches b where b.id = enrollments.batch_id and b.tutor_id = auth.uid()));

-- Invoice dan bukti bayar: hanya pemilik data, Admin, dan Owner.
create policy invoices_select on public.invoices for select to authenticated
  using (public.can_access_student(student_id) or public.has_role('owner') or public.has_role('admin'));
create policy payment_proofs_select on public.payment_proofs for select to authenticated
  using (public.has_role('owner') or public.has_role('admin')
    or exists (select 1 from public.invoices i where i.id = payment_proofs.invoice_id and public.can_access_student(i.student_id)));

create policy notifications_select on public.notifications for select to authenticated
  using (public.has_role('owner') or public.has_role('admin'));

-- Perubahan langsung dari klien tidak diizinkan; semua lewat fungsi di atas.
revoke insert, update, delete on public.enrollments, public.invoices, public.payment_proofs, public.notifications from authenticated, anon;
