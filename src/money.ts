/** Ekran, PDF ve Excel için aynı Türkçe para yazımı: 1.234.567,89 ₺ */

export function formatMoneyTR(n: any): string {
  const x = Number(n);
  if (!Number.isFinite(x)) return '';
  return `${x.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₺`;
}

export function formatNumTR(n: any, maxFrac = 2): string {
  const x = Number(n);
  if (!Number.isFinite(x)) return '';
  return x.toLocaleString('tr-TR', { minimumFractionDigits: 0, maximumFractionDigits: maxFrac });
}
