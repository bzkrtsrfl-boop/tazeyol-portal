/** Ekran, PDF ve Excel için aynı Türkçe para yazımı: 1.234.567,89 ₺ */

const MONEY_FMT = { minimumFractionDigits: 2, maximumFractionDigits: 2 } as const;

export function roundMoney(n: any): number {
  const x = Number(n);
  if (!Number.isFinite(x)) return 0;
  return Math.round((x + Number.EPSILON) * 100) / 100;
}

export function formatMoneyAmountTR(n: any): string {
  return roundMoney(n).toLocaleString('tr-TR', MONEY_FMT);
}

export function formatMoneyTR(n: any): string {
  return `${formatMoneyAmountTR(n)} ₺`;
}

export function formatNumTR(n: any, maxFrac = 2): string {
  const x = Number(n);
  if (!Number.isFinite(x)) return '';
  const frac = Math.min(2, Math.max(0, maxFrac));
  return x.toLocaleString('tr-TR', { minimumFractionDigits: 0, maximumFractionDigits: frac });
}

export function moneyInputValue(n: any): string {
  if (n === '' || n == null || n === undefined) return '';
  const x = Number(n);
  if (!Number.isFinite(x)) return '';
  return roundMoney(x).toFixed(2);
}
