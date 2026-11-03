-- Tazeyol Portal: kimlik doğrulama + satır güvenliği (RLS)
-- Supabase Dashboard > SQL Editor içinde çalıştırın.
--
-- 1) Authentication > Users > Add user ile iki hesap açın (e-posta onayını kapatabilirsiniz).
--    Örnek: admin@tazeyol.com.tr  (Yönetici)
--           rapor@tazeyol.com.tr  (Sadece okuma)
--    Eski sitede görünen şifreleri KULLANMAYIN; yeni güçlü şifre seçin.
-- 2) Authentication > Providers > Email: "Confirm email" kapatılabilir (iç kullanım).
--    Public kayıt (sign ups) kapalı tutun.
-- 3) Aşağıdaki e-posta adreslerini sizin oluşturduğunuz adreslerle değiştirip bu dosyayı çalıştırın.

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  role text not null check (role in ('admin', 'reporter')),
  full_name text,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

drop policy if exists profiles_select_own on public.profiles;
create policy profiles_select_own
  on public.profiles
  for select
  to authenticated
  using (auth.uid() = id);

create or replace function public.is_staff()
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
      and role in ('admin', 'reporter')
  );
$$;

create or replace function public.is_admin()
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
      and role = 'admin'
  );
$$;

revoke all on function public.is_staff() from public, anon;
revoke all on function public.is_admin() from public, anon;
grant execute on function public.is_staff() to authenticated;
grant execute on function public.is_admin() to authenticated;

-- Oluşturduğunuz kullanıcıları rollerine bağlayın:
insert into public.profiles (id, role, full_name)
select id, 'admin', 'Yönetici'
from auth.users
where email = 'admin@tazeyol.com.tr'
on conflict (id) do update set role = excluded.role;

insert into public.profiles (id, role, full_name)
select id, 'reporter', 'Raporör'
from auth.users
where email = 'rapor@tazeyol.com.tr'
on conflict (id) do update set role = excluded.role;

do $$
declare
  t text;
  tables text[] := array[
    'payment_batches',
    'advance_installments',
    'vehicles',
    'invoices',
    'employees',
    'advance_payments',
    'advances',
    'credit_cards',
    'subcontractors',
    'subcontractor_ledger',
    'employee_transactions',
    'general_expenses'
  ];
begin
  foreach t in array tables
  loop
    if exists (
      select 1
      from information_schema.tables
      where table_schema = 'public'
        and table_name = t
    ) then
      execute format('alter table public.%I enable row level security', t);
      execute format('drop policy if exists staff_select on public.%I', t);
      execute format('drop policy if exists admin_insert on public.%I', t);
      execute format('drop policy if exists admin_update on public.%I', t);
      execute format('drop policy if exists admin_delete on public.%I', t);
      execute format(
        'create policy staff_select on public.%I for select to authenticated using (public.is_staff())',
        t
      );
      execute format(
        'create policy admin_insert on public.%I for insert to authenticated with check (public.is_admin())',
        t
      );
      execute format(
        'create policy admin_update on public.%I for update to authenticated using (public.is_admin()) with check (public.is_admin())',
        t
      );
      execute format(
        'create policy admin_delete on public.%I for delete to authenticated using (public.is_admin())',
        t
      );
      execute format('revoke all on table public.%I from anon, public', t);
      execute format(
        'grant select, insert, update, delete on table public.%I to authenticated',
        t
      );
    end if;
  end loop;
end
$$;

revoke all on table public.profiles from anon, public;
grant select on table public.profiles to authenticated;

grant usage, select on all sequences in schema public to authenticated;
