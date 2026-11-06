-- Belgeye kayıtlı plaka kiraları. Kasa / cariye bağlı değildir.
-- Supabase SQL Editor'da bir kez Run.

create table if not exists public.plate_rentals (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  plate text not null,
  owner_name text not null,
  phone text,
  start_date date,
  renewal_date date,
  rent_amount numeric not null default 0,
  government_fee numeric not null default 0,
  collection_kind text not null default 'kira' check (collection_kind in ('kira', 'devlet')),
  payment_note text,
  next_amount numeric,
  notes text,
  vehicle_type text check (vehicle_type is null or vehicle_type in ('Çekici', 'Dorse', 'Kamyon', 'Kamyonet'))
);

alter table public.plate_rentals add column if not exists vehicle_type text;

alter table public.plate_rentals enable row level security;

drop policy if exists staff_select on public.plate_rentals;
drop policy if exists admin_insert on public.plate_rentals;
drop policy if exists admin_update on public.plate_rentals;
drop policy if exists admin_delete on public.plate_rentals;

create policy staff_select on public.plate_rentals
  for select to authenticated using (public.is_staff());
create policy admin_insert on public.plate_rentals
  for insert to authenticated with check (public.is_admin());
create policy admin_update on public.plate_rentals
  for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy admin_delete on public.plate_rentals
  for delete to authenticated using (public.is_admin());

revoke all on table public.plate_rentals from anon, public;
grant select, insert, update, delete on table public.plate_rentals to authenticated;
