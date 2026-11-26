-- 163.000 ₺ Hal teslim fiili tarihi 12.11.2026. Excel aktarımı 2026-01-11 yazmıştı; kasa defteri 7.10’dan başladığı için satır hiç girilmiyordu.
update public.hal_handovers
set hand_date = '2026-11-12'
where round(amount::numeric, 2) = 163000
  and hand_date is distinct from '2026-11-12';
