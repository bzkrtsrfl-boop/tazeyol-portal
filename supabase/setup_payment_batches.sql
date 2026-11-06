-- Banka talimatı partileri: Excel = taslak, banka başarısından sonra ödendi.
-- Supabase SQL Editor'da bir kez Run.

create table if not exists public.payment_batches (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  pay_date date,
  status text not null default 'sent' check (status in ('sent', 'paid', 'cancelled')),
  title text,
  total_amount numeric not null default 0,
  contractor_count integer not null default 0,
  payload jsonb not null default '[]'::jsonb
);

alter table public.payment_batches enable row level security;

drop policy if exists staff_select on public.payment_batches;
drop policy if exists admin_insert on public.payment_batches;
drop policy if exists admin_update on public.payment_batches;
drop policy if exists admin_delete on public.payment_batches;

create policy staff_select on public.payment_batches
  for select to authenticated using (public.is_staff());
create policy admin_insert on public.payment_batches
  for insert to authenticated with check (public.is_admin());
create policy admin_update on public.payment_batches
  for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy admin_delete on public.payment_batches
  for delete to authenticated using (public.is_admin());

revoke all on table public.payment_batches from anon, public;
grant select, insert, update, delete on table public.payment_batches to authenticated;
