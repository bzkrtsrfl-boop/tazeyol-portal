export const CASH_BOOK_START = '2026-10-07';
export const CASH_BOOK_OPENING = 1020622.64;
export const CASH_APPLY_AFTER_OPENING = true;

/** Banka ekstre: Ekim parası Eylül faturasına, 3.11 avansı Ekim faturasına. */
export const MIGROS_BANK_LOCK_UNTIL = '2026-11-03';
export const MIGROS_BANK_TRANSFERS: { date: string; amount: number; label: string }[] = [
  { date: '2026-10-06', amount: 9764000, label: 'Eylül 2026 avans' },
  { date: '2026-10-20', amount: 13205597.05, label: 'Eylül fatura ödemesi' },
  { date: '2026-10-23', amount: 1323456.87, label: 'Eylül kapanış' },
  { date: '2026-11-03', amount: 10100000, label: 'Ekim 2026 avans' }
];

export function isMainMigrosName(name: string) {
  const n = String(name || '').toLocaleUpperCase('tr-TR');
  if (/DI[ŞS] ALIM/.test(n)) return false;
  return n.includes('MIGROS') || n.includes('MİGROS');
}

export function isAppBankReceiptTitle(no: string) {
  const s = String(no || '');
  if (/^\s*THS\s*-.+\s-\s\d{12,}\s*$/i.test(s)) return true;
  if (/^\s*THS\s*-\s*(CARI-|AVANS-)/i.test(s)) return true;
  return false;
}

/** Fatura no gömülü THS (EF/EA/GIB) = kapama, nakit kasası değil. */
export function isInvoiceLinkedReceiptTitle(no: string) {
  const s = String(no || '').toUpperCase().replace(/\s+/g, '');
  return /(?:THS-)*(?:EA|EF|GIB)\d{8,}/.test(s);
}

export function isEArchiveNoiseTitle(no: string) {
  if (isAppBankReceiptTitle(no)) return false;
  return /(?:THS\s*-\s*)?EA\d{10,}/i.test(String(no || ''));
}

export function isBankaNakitDisiGiris(inv: any) {
  const id = String(inv?.id || '');
  const no = String(inv?.invoice_no || '');
  if (id.startsWith('migros_bank_')) return true;
  if (/^BANKA\s*-/i.test(no)) return true;
  if (isMainMigrosName(no)) return true;
  return false;
}

export function isBankaNakitDisiCikis(inv: any) {
  const no = String(inv?.invoice_no || '');
  const cat = String(inv?.category || '');
  if (/\(\s*Banka\s*\)/i.test(no) || /^BANKA\s*-/i.test(no)) return true;
  if (/^ÖDEME\s*-/i.test(no)) return true;
  if (cat === 'subcontractor_paid_outflow' || cat === 'salary_payroll' || cat === 'taxes_sgk') return true;
  return false;
}
