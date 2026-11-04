-- Taksitli avans: ayda bir mahsup. SQL Editor'da bir kez Run.

alter table public.advance_payments
  add column if not exists last_applied_month text;
