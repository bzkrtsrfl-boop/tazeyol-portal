-- Fiili kasa açılışı: 1.020.622,64 TL (7 Ekim 2026 sabahı).
-- Eylül avansı ve o gün öncesi hareketler bu bakiyenin içindedir; tekrar eklenmez.
-- Bu tarihten itibaren (sabah bakiyesi + günün giriş/çıkışı) kasa işler.

insert into public.app_settings (key, value, updated_at)
values
  ('cash_opening', '1020622.64', now()),
  ('cash_opening_as_of', '2026-10-07', now())
on conflict (key) do update
set value = excluded.value,
    updated_at = now();
