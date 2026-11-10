-- Kullanıcı rolleri:
--   admin    = yönetici (her şey, işlem yapar)
--   reporter = rapor (her şeyi görür, işlem yapmaz)
--   saha     = kiralık grup sahası (yalnız kendi grubu, giriş yapar)
-- Supabase SQL Editor'da bir kez Run (tekrar çalışabilir).

alter table public.profiles add column if not exists rental_work_group text;

do $$
declare r record;
begin
  for r in (
    select c.conname
    from pg_constraint c
    where c.conrelid = 'public.profiles'::regclass and c.contype = 'c'
  ) loop
    execute format('alter table public.profiles drop constraint if exists %I', r.conname);
  end loop;
end $$;
alter table public.profiles
  add constraint profiles_role_check check (role in ('admin', 'reporter', 'saha'));

create or replace function public.is_staff()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role in ('admin', 'reporter', 'saha')
  );
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

create or replace function public.is_reporter()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'reporter'
  );
$$;

create or replace function public.is_saha()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'saha'
  );
$$;

revoke all on function public.is_staff() from public, anon;
revoke all on function public.is_admin() from public, anon;
revoke all on function public.is_reporter() from public, anon;
revoke all on function public.is_saha() from public, anon;
grant execute on function public.is_staff() to authenticated;
grant execute on function public.is_admin() to authenticated;
grant execute on function public.is_reporter() to authenticated;
grant execute on function public.is_saha() to authenticated;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, role, full_name, rental_work_group)
  values (
    new.id,
    'saha',
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    null
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

insert into public.profiles (id, role, full_name)
select u.id, 'saha', split_part(u.email, '@', 1)
from auth.users u
left join public.profiles p on p.id = u.id
where p.id is null
on conflict (id) do nothing;

-- Bilinen hesaplar
update public.profiles p
set role = 'reporter', rental_work_group = null
from auth.users u
where u.id = p.id and lower(u.email) = 'rapor@tazeyol.com.tr';

update public.profiles p
set role = 'saha'
from auth.users u
where u.id = p.id
  and lower(u.email) in ('magaza@tazeyol.com.tr', 'batiyemek@tazeyol.com.tr', 'doguyemek@tazeyol.com.tr');

update public.profiles
set role = 'saha'
where role = 'reporter'
  and rental_work_group in ('magazalar', 'bati_marmara_yemek', 'dogu_marmara_yemek')
  and id not in (select id from auth.users where lower(email) = 'rapor@tazeyol.com.tr');

drop policy if exists profiles_select_own on public.profiles;
drop policy if exists profiles_select on public.profiles;
drop policy if exists profiles_update_admin on public.profiles;
create policy profiles_select on public.profiles
  for select to authenticated
  using (public.is_admin() or auth.uid() = id);
create policy profiles_update_admin on public.profiles
  for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());

grant select, update on table public.profiles to authenticated;

create or replace function public.list_portal_users()
returns table (
  id uuid,
  email text,
  full_name text,
  role text,
  rental_work_group text,
  created_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select p.id, u.email::text, p.full_name, p.role, p.rental_work_group, p.created_at
  from public.profiles p
  join auth.users u on u.id = p.id
  where public.is_admin()
  order by p.created_at;
$$;

revoke all on function public.list_portal_users() from public, anon;
grant execute on function public.list_portal_users() to authenticated;

drop policy if exists staff_select on public.rental_settlements;
drop policy if exists staff_update on public.rental_settlements;
create policy staff_select on public.rental_settlements
  for select to authenticated
  using (
    public.is_admin()
    or public.is_reporter()
    or (
      public.is_saha()
      and work_group is not null
      and work_group = (
        select pr.rental_work_group from public.profiles pr where pr.id = auth.uid()
      )
    )
  );
create policy staff_update on public.rental_settlements
  for update to authenticated
  using (
    public.is_saha()
    and coalesce(status, 'draft') <> 'approved'
    and work_group is not null
    and work_group = (
      select pr.rental_work_group from public.profiles pr where pr.id = auth.uid()
    )
  )
  with check (
    public.is_saha()
    and coalesce(status, 'draft') <> 'approved'
    and work_group is not null
    and work_group = (
      select pr.rental_work_group from public.profiles pr where pr.id = auth.uid()
    )
  );

-- Esnek yetki: birden fazla kiralık grup + menü bazlı görür/işler
alter table public.profiles add column if not exists rental_work_groups text[] not null default '{}';
alter table public.profiles add column if not exists portal_access jsonb not null default '{}'::jsonb;

update public.profiles
set rental_work_groups = array[rental_work_group]
where rental_work_group is not null
  and rental_work_group <> ''
  and (rental_work_groups is null or rental_work_groups = '{}');

update public.profiles
set portal_access = '{"rental_settlements":"edit"}'::jsonb
where role = 'saha'
  and (portal_access is null or portal_access = '{}'::jsonb);

create or replace function public.my_rental_groups()
returns text[]
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    nullif(p.rental_work_groups, '{}'),
    case when p.rental_work_group is not null then array[p.rental_work_group] else '{}'::text[] end
  )
  from public.profiles p
  where p.id = auth.uid();
$$;

revoke all on function public.my_rental_groups() from public, anon;
grant execute on function public.my_rental_groups() to authenticated;

create or replace function public.list_portal_users()
returns table (
  id uuid,
  email text,
  full_name text,
  role text,
  rental_work_group text,
  rental_work_groups text[],
  portal_access jsonb,
  created_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select p.id, u.email::text, p.full_name, p.role, p.rental_work_group, p.rental_work_groups, p.portal_access, p.created_at
  from public.profiles p
  join auth.users u on u.id = p.id
  where public.is_admin()
  order by p.created_at;
$$;

drop policy if exists staff_select on public.rental_settlements;
drop policy if exists staff_update on public.rental_settlements;
create policy staff_select on public.rental_settlements
  for select to authenticated
  using (
    public.is_admin()
    or public.is_reporter()
    or (
      public.is_saha()
      and work_group is not null
      and work_group = any(public.my_rental_groups())
    )
  );
create policy staff_update on public.rental_settlements
  for update to authenticated
  using (
    public.is_saha()
    and coalesce(status, 'draft') <> 'approved'
    and work_group is not null
    and work_group = any(public.my_rental_groups())
  )
  with check (
    public.is_saha()
    and coalesce(status, 'draft') <> 'approved'
    and work_group is not null
    and work_group = any(public.my_rental_groups())
  );
