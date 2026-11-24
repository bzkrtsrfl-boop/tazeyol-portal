-- Araç Filosu künye. İç filo (vehicles) ayrı kalır.
-- SQL Editor'da bir kez Run.

insert into public.trip_filo_depots (id, label, is_shared, sort_order) values
  ('gross', 'Gross Filo', false, 4),
  ('izmir', 'İzmir Depo', false, 5)
on conflict (id) do nothing;
update public.trip_filo_depots set label = 'Pelitli Depo' where id = 'pelitli' and label ilike '%peltili%';

create table if not exists public.fleet_code_jobs (
  code text primary key,
  label text not null,
  sort_order integer not null default 0
);
create table if not exists public.fleet_code_places (
  code text primary key,
  label text not null,
  sort_order integer not null default 0
);

insert into public.fleet_code_jobs (code, label, sort_order) values
  ('OM', 'Ömerli', 1),
  ('PE', 'Pelitli', 2),
  ('KN', 'Konacık', 3),
  ('IZ', 'İzmir', 4),
  ('GR', 'Gross', 5),
  ('MG', 'Mağaza', 6),
  ('YM', 'Yemek', 7)
on conflict (code) do nothing;

insert into public.fleet_code_places (code, label, sort_order) values
  ('FL', 'Filo', 1),
  ('DY', 'Diyarbakır', 2),
  ('SL', 'Silivri', 3),
  ('TZ', 'Tuzla', 4),
  ('DG', 'Doğu', 5),
  ('BT', 'Batı', 6)
on conflict (code) do nothing;

create table if not exists public.fleet_vehicles (
  id uuid primary key default gen_random_uuid(),
  vehicle_code text,
  job_code text,
  place_code text,
  seq integer,
  plate text not null,
  contractor_name text not null default '',
  driver_name text,
  driver_phone text,
  assistant_name text,
  assistant_phone text,
  emergency_phone text,
  tracker_id text,
  tracker_gsm text,
  camera_id text,
  camera_gsm text,
  vehicle_type text not null default 'OrtaKamyon',
  cooling text not null default 'plus4' check (cooling in ('plus4', 'minus18')),
  is_active boolean not null default true,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists fleet_vehicles_plate_uidx
  on public.fleet_vehicles (lower(replace(trim(plate), ' ', '')));
create unique index if not exists fleet_vehicles_code_uidx
  on public.fleet_vehicles (vehicle_code) where vehicle_code is not null and vehicle_code <> '';

create table if not exists public.fleet_vehicle_assignments (
  id uuid primary key default gen_random_uuid(),
  vehicle_id uuid not null references public.fleet_vehicles (id) on delete cascade,
  kind text not null check (kind in ('filo', 'kiralik')),
  group_id text not null,
  unique (vehicle_id, kind, group_id)
);

drop index if exists trip_fleet_plates_plate_uidx;
create unique index if not exists trip_fleet_plates_plate_depot_uidx
  on public.trip_fleet_plates (lower(trim(plate)), coalesce(depot, ''));

alter table public.fleet_code_jobs enable row level security;
alter table public.fleet_code_places enable row level security;
alter table public.fleet_vehicles enable row level security;
alter table public.fleet_vehicle_assignments enable row level security;

drop policy if exists fleet_code_jobs_select on public.fleet_code_jobs;
drop policy if exists fleet_code_jobs_write on public.fleet_code_jobs;
drop policy if exists fleet_code_places_select on public.fleet_code_places;
drop policy if exists fleet_code_places_write on public.fleet_code_places;
drop policy if exists fleet_vehicles_select on public.fleet_vehicles;
drop policy if exists fleet_vehicles_write on public.fleet_vehicles;
drop policy if exists fleet_vehicle_assignments_select on public.fleet_vehicle_assignments;
drop policy if exists fleet_vehicle_assignments_write on public.fleet_vehicle_assignments;

create policy fleet_code_jobs_select on public.fleet_code_jobs for select to authenticated using (public.can_view_module('arac_filosu') or public.can_view_module('fleet'));
create policy fleet_code_jobs_write on public.fleet_code_jobs for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy fleet_code_places_select on public.fleet_code_places for select to authenticated using (public.can_view_module('arac_filosu') or public.can_view_module('fleet'));
create policy fleet_code_places_write on public.fleet_code_places for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy fleet_vehicles_select on public.fleet_vehicles for select to authenticated using (public.can_view_module('arac_filosu'));
create policy fleet_vehicles_write on public.fleet_vehicles for all to authenticated using (public.can_edit_module('arac_filosu')) with check (public.can_edit_module('arac_filosu'));
create policy fleet_vehicle_assignments_select on public.fleet_vehicle_assignments for select to authenticated using (public.can_view_module('arac_filosu'));
create policy fleet_vehicle_assignments_write on public.fleet_vehicle_assignments for all to authenticated using (public.can_edit_module('arac_filosu')) with check (public.can_edit_module('arac_filosu'));

revoke all on table public.fleet_code_jobs, public.fleet_code_places, public.fleet_vehicles, public.fleet_vehicle_assignments from anon, public;
grant select, insert, update, delete on table public.fleet_code_jobs, public.fleet_code_places, public.fleet_vehicles, public.fleet_vehicle_assignments to authenticated;

-- Mevcut plakaları bir kez al (kod sonra verilir). Aynı plaka Filo+kiralık+öz malda tek satır.
insert into public.fleet_vehicles (plate, contractor_name, driver_name, vehicle_type, cooling)
select s.plate, s.contractor_name, s.driver_name, 'OrtaKamyon', 'plus4'
from (
  select distinct on (x.plate)
    x.plate,
    x.contractor_name,
    x.driver_name
  from (
    select 1 as pri,
           replace(upper(trim(p.plate)), ' ', '') as plate,
           coalesce(nullif(trim(p.contractor_name), ''), '') as contractor_name,
           p.driver as driver_name
    from public.trip_fleet_plates p
    union all
    select 2,
           replace(upper(trim(v.plate_number)), ' ', ''),
           coalesce(nullif(trim(v.ownership_type), ''), 'Öz Mal'),
           v.driver_name
    from public.vehicles v
    where v.is_active is not false
    union all
    select 3,
           replace(upper(trim(r.plate)), ' ', ''),
           coalesce(nullif(trim(r.contractor_name), ''), ''),
           null
    from public.rental_settlements r
    where coalesce(trim(r.plate), '') <> ''
  ) x
  where coalesce(x.plate, '') <> ''
  order by x.plate, x.pri
) s
where not exists (
  select 1 from public.fleet_vehicles f
  where lower(replace(trim(f.plate), ' ', '')) = lower(s.plate)
);

insert into public.fleet_vehicle_assignments (vehicle_id, kind, group_id)
select f.id, 'filo', p.depot
from public.trip_fleet_plates p
join public.fleet_vehicles f
  on lower(replace(trim(f.plate), ' ', '')) = lower(replace(trim(p.plate), ' ', ''))
where coalesce(p.depot, '') <> ''
on conflict (vehicle_id, kind, group_id) do nothing;

-- Eski “Araç filosu” (fleet) yetkisi künye menüsünü de açsın.
create or replace function public.can_view_module(mod text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and (
        role in ('admin', 'reporter')
        or (
          role = 'saha'
          and (
            coalesce(portal_access ->> mod, '') in ('view', 'edit')
          )
        )
      )
  );
$$;

create or replace function public.can_edit_module(mod text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and (
        role = 'admin'
        or (
          role = 'saha'
          and (
            coalesce(portal_access ->> mod, '') = 'edit'
          )
        )
      )
  );
$$;

drop policy if exists trip_fleet_plates_select on public.trip_fleet_plates;
drop policy if exists trip_fleet_plates_write on public.trip_fleet_plates;

create policy trip_fleet_plates_select on public.trip_fleet_plates
  for select to authenticated
  using (
    public.is_admin()
    or public.is_reporter()
    or public.can_view_module('arac_filosu')
    or (
      public.can_view_module('trip_settlements')
      and public.can_see_filo_depot(depot)
    )
  );

create policy trip_fleet_plates_write on public.trip_fleet_plates
  for all to authenticated
  using (public.is_admin() or public.can_edit_module('arac_filosu'))
  with check (public.is_admin() or public.can_edit_module('arac_filosu'));

alter table public.fleet_vehicles add column if not exists brand text;
alter table public.fleet_vehicles add column if not exists model_name text;
alter table public.fleet_vehicles add column if not exists model_year integer;
alter table public.fleet_vehicles add column if not exists wrapping text;
alter table public.fleet_vehicles add column if not exists wrapping_label text;
