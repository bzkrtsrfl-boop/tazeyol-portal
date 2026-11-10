-- Kiralık araç mutabakatı. Fatura, cari ve kasaya bağlı değildir.
-- Supabase SQL Editor'da bir kez Run.

create table if not exists public.rental_settlement_tariffs (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  province text not null,
  vehicle_type text check (vehicle_type is null or vehicle_type in ('Çekici', 'Dorse', 'Kamyon', 'Kamyonet')),
  rent_amount numeric not null default 0,
  fuel_rate numeric not null default 0
);

create table if not exists public.rental_settlements (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  year_month text not null,
  province text,
  region text,
  plate text not null,
  contractor_name text not null,
  vehicle_type text check (vehicle_type is null or vehicle_type in ('Çekici', 'Dorse', 'Kamyon', 'Kamyonet')),
  rent_amount numeric not null default 0,
  fuel_rate numeric not null default 0,
  fuel_unit_price numeric not null default 0,
  total_km numeric not null default 0,
  work_days numeric not null default 0,
  stop_count numeric not null default 0,
  visit_prime numeric not null default 0,
  extra_work numeric not null default 0,
  hgs numeric not null default 0,
  fuel_charge numeric not null default 0,
  notes text,
  work_group text,
  status text not null default 'draft'
);

alter table public.rental_settlements add column if not exists work_group text;
alter table public.rental_settlements add column if not exists status text not null default 'draft';

alter table public.rental_settlement_tariffs enable row level security;
alter table public.rental_settlements enable row level security;

drop policy if exists staff_select on public.rental_settlement_tariffs;
drop policy if exists admin_insert on public.rental_settlement_tariffs;
drop policy if exists admin_update on public.rental_settlement_tariffs;
drop policy if exists admin_delete on public.rental_settlement_tariffs;
create policy staff_select on public.rental_settlement_tariffs
  for select to authenticated using (public.is_staff());
create policy admin_insert on public.rental_settlement_tariffs
  for insert to authenticated with check (public.is_admin());
create policy admin_update on public.rental_settlement_tariffs
  for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy admin_delete on public.rental_settlement_tariffs
  for delete to authenticated using (public.is_admin());

drop policy if exists staff_select on public.rental_settlements;
drop policy if exists staff_update on public.rental_settlements;
drop policy if exists admin_insert on public.rental_settlements;
drop policy if exists admin_update on public.rental_settlements;
drop policy if exists admin_delete on public.rental_settlements;
create policy staff_select on public.rental_settlements
  for select to authenticated using (public.is_staff());
create policy staff_update on public.rental_settlements
  for update to authenticated
  using (public.is_staff() and coalesce(status, 'draft') <> 'approved')
  with check (public.is_staff() and coalesce(status, 'draft') <> 'approved');
create policy admin_insert on public.rental_settlements
  for insert to authenticated with check (public.is_admin());
create policy admin_update on public.rental_settlements
  for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy admin_delete on public.rental_settlements
  for delete to authenticated using (public.is_admin());

revoke all on table public.rental_settlement_tariffs from anon, public;
revoke all on table public.rental_settlements from anon, public;
grant select, insert, update, delete on table public.rental_settlement_tariffs to authenticated;
grant select, insert, update, delete on table public.rental_settlements to authenticated;

-- Saha kullanıcısını gruba bağlamak için (admin boş bırakır = tüm gruplar)
alter table public.profiles add column if not exists rental_work_group text;
