-- Filo personeli: saha rolü + portal_access.fleet = edit
-- Araç tablosuna yazabilsin. Supabase SQL Editor'da bir kez Run.

create or replace function public.can_edit_module(mod text)
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
        role = 'admin'
        or (
          role = 'saha'
          and (
            coalesce(portal_access ->> mod, '') = 'edit'
            or (
              mod = 'arac_filosu'
              and coalesce(portal_access ->> 'fleet', '') = 'edit'
            )
          )
        )
      )
  );
$$;

revoke all on function public.can_edit_module(text) from public, anon;
grant execute on function public.can_edit_module(text) to authenticated;

drop policy if exists admin_insert on public.vehicles;
drop policy if exists admin_update on public.vehicles;
drop policy if exists fleet_insert on public.vehicles;
drop policy if exists fleet_update on public.vehicles;

create policy fleet_insert on public.vehicles
  for insert to authenticated
  with check (public.can_edit_module('fleet'));

create policy fleet_update on public.vehicles
  for update to authenticated
  using (public.can_edit_module('fleet'))
  with check (public.can_edit_module('fleet'));
