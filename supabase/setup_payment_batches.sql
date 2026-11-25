-- Banka talimatı partileri: Excel = taslak (sent), banka onayı = ödendi (paid).
-- Supabase SQL Editor'da çalıştırın. Tablo varsa silmez; eksik sütunları ekler.
-- CREATE TABLE IF NOT EXISTS eski tabloyu olduğu gibi bırakır; bu yüzden ALTER şart.

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

alter table public.payment_batches add column if not exists pay_date date;
alter table public.payment_batches add column if not exists status text;
alter table public.payment_batches add column if not exists title text;
alter table public.payment_batches add column if not exists total_amount numeric not null default 0;
alter table public.payment_batches add column if not exists contractor_count integer not null default 0;
alter table public.payment_batches add column if not exists payload jsonb not null default '[]'::jsonb;
alter table public.payment_batches add column if not exists batch_reference text;

do $$
declare r record;
begin
  for r in
    select c.conname
    from pg_constraint c
    join pg_class t on t.oid = c.conrelid
    join pg_namespace n on n.oid = t.relnamespace
    where n.nspname = 'public'
      and t.relname = 'payment_batches'
      and c.contype = 'c'
      and pg_get_constraintdef(c.oid) ilike '%status%'
  loop
    execute format('alter table public.payment_batches drop constraint if exists %I', r.conname);
  end loop;
end $$;
alter table public.payment_batches drop constraint if exists payment_batches_status_check;
alter table public.payment_batches
  add constraint payment_batches_status_check check (status in ('sent', 'paid', 'cancelled'));

-- Canlıdaki eski tabloda NOT NULL ama varsayılanı olmayan sütunlar (batch_reference vb.)
-- portal insert’ini düşürmesin.
do $$
declare r record;
begin
  for r in
    select column_name
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'payment_batches'
      and is_nullable = 'NO'
      and column_default is null
      and column_name not in ('id', 'status', 'total_amount', 'contractor_count', 'payload')
  loop
    execute format('alter table public.payment_batches alter column %I drop not null', r.column_name);
  end loop;
end $$;

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

notify pgrst, 'reload schema';
