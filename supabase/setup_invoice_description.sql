-- Satış faturalarına açıklama kolonu. SQL Editor'da bir kez Run.
alter table public.invoices
  add column if not exists description text;
