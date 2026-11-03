-- Personel kartı: SGK işveren maliyeti ve işe giriş. SQL Editor'da bir kez Run.

alter table public.employees
  add column if not exists employer_sgk numeric;

alter table public.employees
  add column if not exists hire_date date;
