-- Esnek yetki sütunları. SQL Editor'da bir kez Run.

alter table public.profiles add column if not exists rental_work_groups text[] not null default '{}';
alter table public.profiles add column if not exists portal_access jsonb not null default '{}'::jsonb;

update public.profiles
set rental_work_groups = array[rental_work_group]
where rental_work_group is not null
  and rental_work_group <> ''
  and (rental_work_groups is null or rental_work_groups = '{}');

update public.profiles
set portal_access = '{"rental_settlements":"edit"}'::jsonb
where role = 'saha'
  and (portal_access is null or portal_access = '{}'::jsonb);
