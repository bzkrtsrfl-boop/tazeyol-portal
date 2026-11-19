-- Hal saha: sefer / nakit tahsilat. Diğer sefer portalına otomatik gitmez.
-- Merkez kasa ancak yönetici “Merkeze al” deyince yazılır.
-- Supabase SQL Editor’da bir kez Run.

create table if not exists public.hal_firms (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  shop text,
  sort_order int not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.hal_entries (
  id uuid primary key default gen_random_uuid(),
  entry_date date not null,
  kind text not null check (kind in ('sefer', 'tahsilat')),
  firm_id uuid references public.hal_firms (id) on delete set null,
  firm_name text not null,
  plate text,
  notes text,
  bedel numeric not null default 0,
  has_vat boolean not null default false,
  collected numeric not null default 0,
  created_by uuid references auth.users (id),
  created_at timestamptz not null default now()
);
alter table public.hal_entries add column if not exists kasa_invoice_id uuid;

create table if not exists public.hal_handovers (
  id uuid primary key default gen_random_uuid(),
  hand_date date not null,
  amount numeric not null,
  note text,
  invoice_id uuid,
  created_by uuid references auth.users (id),
  created_at timestamptz not null default now()
);

create index if not exists hal_entries_date_idx on public.hal_entries (entry_date desc);
create index if not exists hal_entries_firm_idx on public.hal_entries (firm_name);

alter table public.hal_firms enable row level security;
alter table public.hal_entries enable row level security;
alter table public.hal_handovers enable row level security;

drop policy if exists hal_firms_select on public.hal_firms;
drop policy if exists hal_firms_write on public.hal_firms;
drop policy if exists hal_entries_select on public.hal_entries;
drop policy if exists hal_entries_ins on public.hal_entries;
drop policy if exists hal_entries_upd on public.hal_entries;
drop policy if exists hal_entries_del on public.hal_entries;
drop policy if exists hal_handovers_select on public.hal_handovers;
drop policy if exists hal_handovers_ins on public.hal_handovers;
drop policy if exists hal_handovers_del on public.hal_handovers;

create policy hal_firms_select on public.hal_firms
  for select to authenticated using (public.can_view_module('hal_saha'));
create policy hal_firms_write on public.hal_firms
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy hal_entries_select on public.hal_entries
  for select to authenticated using (public.can_view_module('hal_saha'));
create policy hal_entries_ins on public.hal_entries
  for insert to authenticated with check (public.can_edit_module('hal_saha'));
create policy hal_entries_upd on public.hal_entries
  for update to authenticated
  using (
    public.is_admin()
    or (
      public.can_edit_module('hal_saha')
      and entry_date >= (current_date - 2)
    )
  )
  with check (
    public.is_admin()
    or (
      public.can_edit_module('hal_saha')
      and entry_date >= (current_date - 2)
    )
  );
create policy hal_entries_del on public.hal_entries
  for delete to authenticated using (public.is_admin());

create policy hal_handovers_select on public.hal_handovers
  for select to authenticated using (public.can_view_module('hal_saha'));
create policy hal_handovers_ins on public.hal_handovers
  for insert to authenticated with check (public.is_admin());
create policy hal_handovers_del on public.hal_handovers
  for delete to authenticated using (public.is_admin());

revoke all on table public.hal_firms from anon, public;
revoke all on table public.hal_entries from anon, public;
revoke all on table public.hal_handovers from anon, public;
grant select, insert, update, delete on table public.hal_firms to authenticated;
grant select, insert, update, delete on table public.hal_entries to authenticated;
grant select, insert, update, delete on table public.hal_handovers to authenticated;

create table if not exists public.hal_plates (
  id uuid primary key default gen_random_uuid(),
  plate text not null,
  note text,
  is_active boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);
create unique index if not exists hal_plates_plate_uidx on public.hal_plates (lower(trim(plate)));

alter table public.hal_plates enable row level security;
drop policy if exists hal_plates_select on public.hal_plates;
drop policy if exists hal_plates_write on public.hal_plates;
create policy hal_plates_select on public.hal_plates
  for select to authenticated using (public.can_view_module('hal_saha'));
create policy hal_plates_write on public.hal_plates
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

revoke all on table public.hal_plates from anon, public;
grant select, insert, update, delete on table public.hal_plates to authenticated;

-- Gece saha, girişte filodaki plakayı seçebilsin (yazamaz).
do $$
begin
  if exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname = 'can_view_module')
     and exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'vehicles') then
    execute 'drop policy if exists module_select on public.vehicles';
    execute $p$
      create policy module_select on public.vehicles
        for select to authenticated
        using (
          public.can_view_module('fleet')
          or public.can_view_module('profitability')
          or public.can_view_module('plate_rentals')
          or public.can_view_module('hal_saha')
        )
    $p$;
  end if;
end $$;
