-- Yanlış yüklenen EA12026000000001 / 255.000 ₺ (20.09.2026). Giriş-çıkış yok, silinir.
delete from public.invoices
where upper(replace(coalesce(invoice_no, ''), ' ', '')) like '%EA12026000000001%'
  and abs(coalesce(total_amount, 0) - 255000) < 0.5;
