-- Personel işe giriş tarihi. SQL Editor'da bir kez Run.

alter table public.employees
  add column if not exists hire_date date;
