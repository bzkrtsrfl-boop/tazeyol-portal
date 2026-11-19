-- Filo (sefer mutabakatı): Ömerli / Konacık / Peltili / Ortak.
-- Liste plakaları seed_filo_plates.sql. Fatura ve kasaya yazılmaz.
-- SQL Editor'da bir kez Run, sonra seed_filo_plates.sql.

alter table public.profiles add column if not exists filo_depots text[] not null default '{}';

create or replace function public.my_filo_depots()
returns text[]
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(p.filo_depots, '{}'::text[])
  from public.profiles p
  where p.id = auth.uid();
$$;
revoke all on function public.my_filo_depots() from public, anon;
grant execute on function public.my_filo_depots() to authenticated;

create table if not exists public.trip_filo_depots (
  id text primary key,
  label text not null,
  is_shared boolean not null default false,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);
insert into public.trip_filo_depots (id, label, is_shared, sort_order) values
  ('omerli', 'Ömerli Depo', false, 1),
  ('konacik', 'Konacık Depo', false, 2),
  ('pelitli', 'Pelitli Depo', false, 3),
  ('gross', 'Gross Filo', false, 4),
  ('izmir', 'İzmir Depo', false, 5),
  ('ortak', 'Ortak', true, 100)
on conflict (id) do nothing;

alter table public.trip_filo_depots enable row level security;
drop policy if exists trip_filo_depots_select on public.trip_filo_depots;
drop policy if exists trip_filo_depots_write on public.trip_filo_depots;
create policy trip_filo_depots_select on public.trip_filo_depots
  for select to authenticated
  using (public.can_view_module('trip_settlements'));
create policy trip_filo_depots_write on public.trip_filo_depots
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());
revoke all on table public.trip_filo_depots from anon, public;
grant select, insert, update, delete on table public.trip_filo_depots to authenticated;

create table if not exists public.trip_fleet_plates (
  id uuid primary key default gen_random_uuid(),
  plate text not null,
  driver text,
  contractor_name text not null default '',
  depot text check (depot is null or depot in ('omerli', 'konacik', 'pelitli', 'ortak')),
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);
create unique index if not exists trip_fleet_plates_plate_uidx on public.trip_fleet_plates (lower(trim(plate)));

create table if not exists public.trip_settlements (
  id uuid primary key default gen_random_uuid(),
  year_month text not null,
  plate text not null,
  driver text,
  contractor_name text not null default '',
  depot text check (depot is null or depot in ('omerli', 'konacik', 'pelitli', 'ortak')),
  fuel_amount numeric not null default 0,
  total_amount numeric not null default 0,
  notes text,
  created_by uuid references auth.users (id),
  created_at timestamptz not null default now()
);
do $$
declare r record;
begin
  for r in
    select cls.relname, con.conname
    from pg_constraint con
    join pg_class cls on cls.oid = con.conrelid
    join pg_namespace nsp on nsp.oid = cls.relnamespace
    where nsp.nspname = 'public'
      and cls.relname in ('trip_fleet_plates', 'trip_settlements')
      and con.contype = 'c'
      and pg_get_constraintdef(con.oid) ilike '%depot%'
  loop
    execute format('alter table public.%I drop constraint if exists %I', r.relname, r.conname);
  end loop;
end $$;
alter table public.trip_settlements add column if not exists depot text;
alter table public.trip_settlements drop column if exists advance_amount;
alter table public.trip_settlements drop column if exists pay1_amount;
alter table public.trip_settlements drop column if exists pay2_amount;
create unique index if not exists trip_settlements_month_plate_uidx on public.trip_settlements (year_month, lower(trim(plate)));
create index if not exists trip_settlements_month_idx on public.trip_settlements (year_month desc);

create or replace function public.can_see_filo_depot(dep text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    public.is_admin()
    or public.is_reporter()
    or dep = 'ortak'
    or exists (
      select 1 from public.trip_filo_depots d
      where d.id = dep and d.is_shared is true and d.is_active is not false
    )
    or (dep is not null and dep = any(public.my_filo_depots()));
$$;
revoke all on function public.can_see_filo_depot(text) from public, anon;
grant execute on function public.can_see_filo_depot(text) to authenticated;

alter table public.trip_fleet_plates enable row level security;
alter table public.trip_settlements enable row level security;

drop policy if exists trip_fleet_plates_select on public.trip_fleet_plates;
drop policy if exists trip_fleet_plates_write on public.trip_fleet_plates;
drop policy if exists trip_settlements_select on public.trip_settlements;
drop policy if exists trip_settlements_ins on public.trip_settlements;
drop policy if exists trip_settlements_upd on public.trip_settlements;
drop policy if exists trip_settlements_del on public.trip_settlements;

create policy trip_fleet_plates_select on public.trip_fleet_plates
  for select to authenticated
  using (
    public.can_view_module('trip_settlements')
    and (
      public.is_admin()
      or public.is_reporter()
      or public.can_see_filo_depot(depot)
    )
  );
create policy trip_fleet_plates_write on public.trip_fleet_plates
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy trip_settlements_select on public.trip_settlements
  for select to authenticated
  using (
    public.can_view_module('trip_settlements')
    and (
      public.is_admin()
      or public.is_reporter()
      or public.can_see_filo_depot(depot)
    )
  );
create policy trip_settlements_ins on public.trip_settlements
  for insert to authenticated
  with check (
    public.can_edit_module('trip_settlements')
    and (public.is_admin() or public.can_see_filo_depot(depot))
  );
create policy trip_settlements_upd on public.trip_settlements
  for update to authenticated
  using (
    public.can_edit_module('trip_settlements')
    and (public.is_admin() or public.can_see_filo_depot(depot))
  )
  with check (
    public.can_edit_module('trip_settlements')
    and (public.is_admin() or public.can_see_filo_depot(depot))
  );
create policy trip_settlements_del on public.trip_settlements
  for delete to authenticated using (public.is_admin());

revoke all on table public.trip_fleet_plates from anon, public;
revoke all on table public.trip_settlements from anon, public;
grant select, insert, update, delete on table public.trip_fleet_plates to authenticated;
grant select, insert, update, delete on table public.trip_settlements to authenticated;

-- Alkan Filo yakıt/toplam → öz mal kârlılık (ciro + yakıt). Saha da Filo'dan yazar.
create or replace function public.sync_filo_profit_amounts(
  p_year_month text,
  p_plate text,
  p_fuel numeric,
  p_invoice_rev numeric
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_norm text;
  v_plate text;
begin
  if not public.can_edit_module('trip_settlements') then
    raise exception 'Filo yazma yetkisi yok';
  end if;
  v_norm := upper(replace(trim(coalesce(p_plate, '')), ' ', ''));
  if v_norm = '' or coalesce(p_year_month, '') = '' then
    return;
  end if;
  if not exists (
    select 1
    from public.trip_fleet_plates t
    where replace(upper(trim(t.plate)), ' ', '') = v_norm
      and upper(t.contractor_name) like '%ALKAN%'
  ) then
    return;
  end if;
  select trim(v.plate_number) into v_plate
  from public.vehicles v
  where replace(upper(trim(v.plate_number)), ' ', '') = v_norm
  limit 1;
  if v_plate is null then
    v_plate := v_norm;
  end if;
  insert into public.vehicle_monthly_inputs (
    plate_number, year_month, invoice_rev, fuel, hgs, included, updated_at
  )
  values (
    v_plate,
    left(p_year_month, 7),
    coalesce(p_invoice_rev, 0),
    coalesce(p_fuel, 0),
    0,
    true,
    now()
  )
  on conflict (plate_number, year_month) do update
    set invoice_rev = excluded.invoice_rev,
        fuel = excluded.fuel,
        updated_at = now();
end;
$$;
revoke all on function public.sync_filo_profit_amounts(text, text, numeric, numeric) from public, anon;
grant execute on function public.sync_filo_profit_amounts(text, text, numeric, numeric) to authenticated;
