-- İç filo ve Araç filosu ayrı menü. Kapalı olan görünmez.
-- SQL Editor'da bir kez Run.

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
          and coalesce(portal_access ->> mod, '') = 'edit'
        )
      )
  );
$$;

notify pgrst, 'reload schema';
