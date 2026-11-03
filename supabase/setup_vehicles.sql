-- Filo: araç tipi ve aktif/pasif. SQL Editor'da bir kez Run.

alter table public.vehicles
  add column if not exists vehicle_type text;

alter table public.vehicles
  add column if not exists is_active boolean not null default true;

update public.vehicles
set is_active = true
where is_active is null;
