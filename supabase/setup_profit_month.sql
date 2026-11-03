-- Öz mal kârlılık: plaka + ay bazında manuel ciro / yakıt / HGS
-- Supabase SQL Editor'da bir kez çalıştırın.

create table if not exists public.vehicle_monthly_inputs (
  id uuid primary key default gen_random_uuid(),
  plate_number text not null,
  year_month text not null,
  invoice_rev numeric not null default 0,
  fuel numeric not null default 0,
  hgs numeric not null default 0,
  included boolean not null default true,
  updated_at timestamptz not null default now(),
  unique (plate_number, year_month)
);

alter table public.vehicle_monthly_inputs
  add column if not exists included boolean not null default true;

alter table public.vehicle_monthly_inputs enable row level security;

drop policy if exists staff_select on public.vehicle_monthly_inputs;
drop policy if exists admin_insert on public.vehicle_monthly_inputs;
drop policy if exists admin_update on public.vehicle_monthly_inputs;
drop policy if exists admin_delete on public.vehicle_monthly_inputs;
create policy staff_select on public.vehicle_monthly_inputs for select to authenticated using (public.is_staff());
create policy admin_insert on public.vehicle_monthly_inputs for insert to authenticated with check (public.is_admin());
create policy admin_update on public.vehicle_monthly_inputs for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy admin_delete on public.vehicle_monthly_inputs for delete to authenticated using (public.is_admin());

revoke all on table public.vehicle_monthly_inputs from anon, public;
grant select, insert, update, delete on table public.vehicle_monthly_inputs to authenticated;
