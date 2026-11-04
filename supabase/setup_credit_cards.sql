-- Kredi kartı türü + giderin kasa/kart ödeme kaynağı. SQL Editor'da bir kez Run.

alter table public.credit_cards
  add column if not exists card_kind text default 'company';

alter table public.invoices
  add column if not exists paid_source text;
