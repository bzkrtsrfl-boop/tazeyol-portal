-- Fiili kasa: 1.550.000 TL (4 Kasım 2026). SQL Editor'da bir kez Run.
-- Eski/test hareketler kasayı oynatmaz. Bu tarihten sonraki tahsilat ve ödemeler eklenir.

insert into public.app_settings (key, value, updated_at)
values
  ('cash_opening', '1550000', now()),
  ('cash_opening_as_of', '2026-11-04', now())
on conflict (key) do update
set value = excluded.value,
    updated_at = now();
