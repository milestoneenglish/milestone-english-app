-- Akun staf dibuat server dengan app_metadata.provisioned = true. Supabase Auth mengisi app_metadata itu
-- lewat UPDATE sesaat setelah INSERT, sehingga trigger pendaftaran sempat memperlakukannya sebagai
-- pendaftar biasa (memberi role Siswa dan data calon siswa). Trigger ini merapikannya begitu tanda staf
-- terpasang: role siswa/wali dan data calon siswa kosong dihapus, dan tanda wajib ganti password dipasang.

create or replace function public.handle_user_provisioned() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if coalesce((new.raw_app_meta_data ->> 'provisioned')::boolean, false)
     and not coalesce((old.raw_app_meta_data ->> 'provisioned')::boolean, false) then
    delete from public.user_roles where user_id = new.id and role in ('student', 'guardian');
    delete from public.students s
    where s.user_id = new.id
      and s.status = 'prospect'
      and not exists (select 1 from public.enrollments e where e.student_id = s.id)
      and not exists (select 1 from public.placement_attempts p where p.student_id = s.id);
    update public.profiles
    set must_change_password = coalesce((new.raw_app_meta_data ->> 'must_change_password')::boolean, false)
    where id = new.id;
  end if;
  return new;
end;
$$;

create trigger on_auth_user_provisioned after update of raw_app_meta_data on auth.users
  for each row execute function public.handle_user_provisioned();

-- Pemberi role boleh dihapus akunnya; catatan role tetap ada tanpa nama pemberi (riwayat lengkap ada di audit log).
alter table public.user_roles drop constraint user_roles_granted_by_fkey;
alter table public.user_roles add constraint user_roles_granted_by_fkey
  foreign key (granted_by) references public.profiles (id) on delete set null;
