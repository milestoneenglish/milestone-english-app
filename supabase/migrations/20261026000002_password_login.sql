-- Login email + password. Akun yang dibuat server (Owner pertama, staf) memakai
-- password sementara dan wajib menggantinya saat pertama masuk.

alter table public.profiles add column must_change_password boolean not null default false;

create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  account_type text := coalesce(new.raw_user_meta_data ->> 'account_type', 'student');
  provisioned boolean := coalesce((new.raw_app_meta_data ->> 'provisioned')::boolean, false);
begin
  insert into public.profiles (id, full_name, email, phone, must_change_password)
  values (
    new.id,
    left(coalesce(new.raw_user_meta_data ->> 'full_name', ''), 120),
    lower(new.email),
    nullif(new.raw_user_meta_data ->> 'phone', ''),
    provisioned and coalesce((new.raw_app_meta_data ->> 'must_change_password')::boolean, false)
  );

  if not provisioned then
    insert into public.user_roles (user_id, role)
    values (new.id, case when account_type = 'guardian' then 'guardian'::public.app_role else 'student'::public.app_role end);
  end if;

  return new;
end;
$$;
