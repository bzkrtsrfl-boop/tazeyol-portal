-- Menü yetkisine göre SELECT. Filo/kiralık saha fatura ve kasa satırı çekemesin.
-- Supabase SQL Editor'da bir kez Run.

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
          and coalesce(portal_access ->> mod, '') in ('view', 'edit')
        )
      )
  );
$$;

revoke all on function public.can_view_module(text) from public, anon;
grant execute on function public.can_view_module(text) to authenticated;

do $$
declare
  rec record;
begin
  for rec in
    select * from (values
      ('invoices', array['sales_customers','collections','customers','general_expenses','employees','payments','credit_cards','subcontractors','sub_accounts','income_report','profitability']),
      ('customers', array['sales_customers','collections','customers']),
      ('employees', array['employees','profitability']),
      ('employee_transactions', array['employees']),
      ('advance_payments', array['subcontractors','sub_accounts','payments','employees']),
      ('advance_installments', array['subcontractors','sub_accounts','payments']),
      ('credit_cards', array['credit_cards']),
      ('payment_batches', array['payments']),
      ('subcontractors', array['subcontractors','sub_accounts','sub_ibans','payments']),
      ('subcontractor_ledger', array['sub_accounts']),
      ('vehicles', array['fleet','profitability','plate_rentals','hal_saha','arac_filosu']),
      ('fleet_vehicles', array['arac_filosu']),
      ('fleet_vehicle_assignments', array['arac_filosu']),
      ('fleet_code_jobs', array['arac_filosu','fleet']),
      ('fleet_code_places', array['arac_filosu','fleet']),
      ('vehicle_monthly_inputs', array['profitability']),
      ('plate_rentals', array['plate_rentals']),
      ('rental_settlements', array['rental_settlements']),
      ('rental_settlement_tariffs', array['rental_settlements']),
      ('trip_settlements', array['trip_settlements']),
      ('trip_fleet_plates', array['trip_settlements']),
      ('trip_filo_depots', array['trip_settlements']),
      ('app_settings', array[]::text[])
    ) as t(tbl, mods)
  loop
    if not exists (
      select 1 from information_schema.tables
      where table_schema = 'public' and table_name = rec.tbl
    ) then
      continue;
    end if;
    execute format('drop policy if exists staff_select on public.%I', rec.tbl);
    execute format('drop policy if exists module_select on public.%I', rec.tbl);
    if rec.tbl = 'app_settings' then
      execute format(
        'create policy module_select on public.%I for select to authenticated using (public.is_admin() or public.is_reporter())',
        rec.tbl
      );
    else
      execute format(
        'create policy module_select on public.%I for select to authenticated using (%s)',
        rec.tbl,
        (
          select string_agg(format('public.can_view_module(%L)', m), ' or ')
          from unnest(rec.mods) as m
        )
      );
    end if;
  end loop;
end
$$;
