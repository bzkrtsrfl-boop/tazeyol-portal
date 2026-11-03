-- Müşteri kartları + kasa/SGK ayarları
-- Supabase SQL Editor'da bir kez çalıştırın.

create table if not exists public.customers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  tax_id text,
  tax_office text,
  address text,
  phone text,
  email text,
  notes text,
  created_at timestamptz not null default now(),
  unique (name)
);

create table if not exists public.app_settings (
  key text primary key,
  value text not null,
  updated_at timestamptz not null default now()
);

insert into public.app_settings (key, value)
values
  ('cash_opening', '845200'),
  ('sgk_driver_amount', '11148')
on conflict (key) do nothing;

alter table public.customers enable row level security;
alter table public.app_settings enable row level security;

drop policy if exists staff_select on public.customers;
drop policy if exists admin_insert on public.customers;
drop policy if exists admin_update on public.customers;
drop policy if exists admin_delete on public.customers;
create policy staff_select on public.customers for select to authenticated using (public.is_staff());
create policy admin_insert on public.customers for insert to authenticated with check (public.is_admin());
create policy admin_update on public.customers for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy admin_delete on public.customers for delete to authenticated using (public.is_admin());

drop policy if exists staff_select on public.app_settings;
drop policy if exists admin_insert on public.app_settings;
drop policy if exists admin_update on public.app_settings;
drop policy if exists admin_delete on public.app_settings;
create policy staff_select on public.app_settings for select to authenticated using (public.is_staff());
create policy admin_insert on public.app_settings for insert to authenticated with check (public.is_admin());
create policy admin_update on public.app_settings for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy admin_delete on public.app_settings for delete to authenticated using (public.is_admin());

revoke all on table public.customers from anon, public;
revoke all on table public.app_settings from anon, public;
grant select, insert, update, delete on table public.customers to authenticated;
grant select, insert, update, delete on table public.app_settings to authenticated;
