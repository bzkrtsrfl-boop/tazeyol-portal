-- Dış Alım Mutabakatı. Supabase SQL Editor'da bir kez Run.

create table if not exists public.dis_alim_lines (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('dis_alim', 'yansitma')),
  request_date date,
  unit_name text not null default '',
  waybill_no text,
  supplier_invoice_no text,
  order_no text,
  waybill_date date,
  invoice_date date,
  alkan_pay_date date,
  net_amount numeric not null default 0,
  vat_amount numeric not null default 0,
  gross_amount numeric not null default 0,
  subject text,
  alkan_invoice_no text,
  migros_invoice_no text,
  status text not null default 'draft' check (status in ('draft', 'offered', 'approved', 'billed')),
  notes text,
  created_by uuid references auth.users (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists dis_alim_lines_kind_idx on public.dis_alim_lines (kind, invoice_date desc);
create index if not exists dis_alim_lines_status_idx on public.dis_alim_lines (status);

alter table public.dis_alim_lines enable row level security;

drop policy if exists dis_alim_lines_select on public.dis_alim_lines;
drop policy if exists dis_alim_lines_write on public.dis_alim_lines;

create policy dis_alim_lines_select on public.dis_alim_lines
  for select to authenticated
  using (public.can_view_module('dis_alim'));

create policy dis_alim_lines_write on public.dis_alim_lines
  for all to authenticated
  using (public.can_edit_module('dis_alim'))
  with check (public.can_edit_module('dis_alim'));

revoke all on table public.dis_alim_lines from anon, public;
grant select, insert, update, delete on table public.dis_alim_lines to authenticated;
