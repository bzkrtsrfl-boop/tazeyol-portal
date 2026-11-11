export function amountsClose(a: number, b: number, tol = 0.05) {
  return Math.abs(Number(a) - Number(b)) <= tol;
}

export function paymentLooksFull(desc: string, type?: string) {
  return /tamam|1 ve 2/i.test(`${desc || ''} ${type || ''}`);
}

export type ContractorPay = { date: string; desc: string; amount: number; type: string };

export function isBankTalimatDesc(desc: string, type?: string) {
  return /banka\s*talimat/i.test(desc || '') || String(type || '') === 'bank';
}

export function isAnonymousBankPay(desc: string) {
  return /banka\s*talimat/i.test(desc || '') && !/GIB|TRN|\(1 nci|\(2 nci|\(Tamam/i.test(desc || '');
}

export function isReconstructedHakedisPay(desc: string) {
  const d = desc || '';
  return /hakedi[sş].*ödem/i.test(d) && /vade/i.test(d) && !isBankTalimatDesc(d) && !/GIB|TRN/i.test(d);
}

/** Aynı gün + aynı tutar = tek satır. Banka talimatı, sentetik 1. Vade satırından önde gelir. */
export function mergeSameDayContractorPays(pays: ContractorPay[]): ContractorPay[] {
  const rank = (p: ContractorPay) => {
    if (/GIB|TRN/i.test(p.desc) && /ÖDEME/i.test(p.desc)) return 0;
    if (isAnonymousBankPay(p.desc) || p.type === 'bank') return 1;
    if (paymentLooksFull(p.desc, p.type)) return 2;
    return 3;
  };
  const groups = new Map<string, ContractorPay[]>();
  [...pays].sort((a, b) => rank(a) - rank(b)).forEach(p => {
    if (p.amount <= 0.009) return;
    const key = `${p.date}|${Math.round(p.amount * 100)}`;
    const list = groups.get(key) || [];
    list.push(p);
    groups.set(key, list);
  });
  return Array.from(groups.values()).map(list => {
    const reals = list.filter(p => !isReconstructedHakedisPay(p.desc));
    const use = reals.length ? reals : list;
    const best = use[0];
    if (use.length === 2 && use.every(p => !isReconstructedHakedisPay(p.desc))) {
      return { ...best, amount: Math.round(best.amount * 2 * 100) / 100 };
    }
    return best;
  }).sort((a, b) => (a.date || '').localeCompare(b.date || '') || a.amount - b.amount);
}

export function termPayLabel(term: 'term1' | 'term2' | string) {
  return term === 'term2' || term === '2' ? '2 nci ödeme' : '1 nci ödeme';
}

export function invoiceGib(no: string) {
  const first = String(no || '').split(/\s[-–—]\s/)[0].trim();
  if (/^(GIB|TRN)/i.test(first) || /^\d{10,}/.test(first)) return first;
  return '';
}

export function payMentionsInvoice(desc: string, inv: any) {
  const no = String(inv?.invoice_no || '');
  const gib = invoiceGib(no);
  const d = String(desc || '');
  if (gib && gib.length >= 6 && d.includes(gib)) return true;
  if (no && d.includes(no)) return true;
  return false;
}

export function payTermFromDesc(desc: string, type?: string): 'term1' | 'term2' | 'both' | null {
  const t = `${desc || ''} ${type || ''}`;
  if (/tamam|1 ve 2/i.test(t)) return 'both';
  if (/2 nci|2\s*\.?\s*vade|2\.\s*vade/i.test(t)) return 'term2';
  if (/1 nci|1\s*\.?\s*vade|1\.\s*vade/i.test(t)) return 'term1';
  return null;
}

export function inSeptPayWave(date: string) {
  const d = String(date || '').slice(0, 10);
  return d >= '2026-10-20' && d <= '2026-11-10';
}

function r2(n: number) {
  return Math.round(Number(n || 0) * 100) / 100;
}

function closeAmt(a: number, b: number) {
  return amountsClose(a, b, 0.51);
}

function isBankishPay(p: ContractorPay) {
  return isBankTalimatDesc(p.desc, p.type) || /GIB|TRN/i.test(p.desc || '');
}

function isTaksitDusum(desc: string) {
  return /taksit\s*basi|taksit\s*d[uü]s[uü]m/i.test(desc || '');
}

function day(p: ContractorPay) {
  return String(p.date || '').slice(0, 10);
}

/**
 * 26.10 = 1 nci, 05.11 = 2 nci.
 * Önce tarihler hizalanır, aynı gün birleşir; avans karttaki satırdan gelir.
 */
export function normalizeSeptWavePays(
  pays: ContractorPay[],
  septTotal: number,
  pesinAdvance: number,
  installmentCut: number
): ContractorPay[] {
  if (septTotal <= 0.01) return pays;
  const half = r2(septTotal / 2);
  const advCut = r2(Math.min(half, Math.max(0, pesinAdvance) + Math.max(0, installmentCut)));
  let term1 = r2(half - advCut);
  let term2 = half;
  const rest = pays.filter(p => !inSeptPayWave(p.date));
  let wave = pays.filter(p => inSeptPayWave(p.date)).map(p => {
    const d = day(p);
    if (d >= '2026-10-20' && d <= '2026-10-31' && d !== '2026-10-26') return { ...p, date: '2026-10-26' };
    return p;
  });
  if (!wave.length) return pays;
  wave = mergeSameDayContractorPays(wave);

  const isTamami = (p: ContractorPay) =>
    paymentLooksFull(p.desc, p.type) ||
    closeAmt(p.amount, septTotal) ||
    closeAmt(p.amount, r2(septTotal - Math.max(0, pesinAdvance)));

  if (wave.some(isTamami)) {
    const best = wave.filter(isTamami).sort((a, b) => Number(isBankishPay(b)) - Number(isBankishPay(a)))[0];
    return [...rest, best].sort((a, b) => (a.date || '').localeCompare(b.date || '') || a.amount - b.amount);
  }

  let octP = wave.filter(p => day(p) <= '2026-10-31');
  let novP = wave.filter(p => day(p) >= '2026-11-01');

  if (octP.some(p => closeAmt(p.amount, half)) && pesinAdvance > 0.01) {
    term1 = half;
    term2 = r2(half - Math.min(half, pesinAdvance));
  }

  const overpay = octP.find(p => p.amount > half + 0.51);
  if (overpay) {
    const remainder = r2(Math.max(0, septTotal - overpay.amount));
    const dupNov = novP.find(p => closeAmt(p.amount, overpay.amount) || isTaksitDusum(p.desc));
    if (dupNov && remainder > 0.01) {
      wave = wave.filter(p => p !== dupNov).concat([{
        ...dupNov, amount: remainder, date: '2026-11-05', desc: 'ÖDEME - Banka talimatı (2 nci)', type: 'bank'
      }]);
      octP = wave.filter(p => day(p) <= '2026-10-31');
      novP = wave.filter(p => day(p) >= '2026-11-01');
    }
  }

  if (octP.length === 0 && novP.length) {
    const novTerm1 = novP.find(p => closeAmt(p.amount, term1) && !closeAmt(p.amount, half));
    const novHalf = novP.find(p => closeAmt(p.amount, half));
    const src = novTerm1 || novHalf;
    if (src) {
      wave = [
        { ...src, date: '2026-10-26', amount: novTerm1 ? term1 : half, desc: 'ÖDEME - Banka talimatı (1 nci)' },
        ...novP.filter(p => p !== src),
        { ...src, date: '2026-11-05', amount: novTerm1 ? half : term2, type: 'bank', desc: 'ÖDEME - Banka talimatı (2 nci)' }
      ];
    }
  }

  octP = wave.filter(p => day(p) <= '2026-10-31');
  novP = wave.filter(p => day(p) >= '2026-11-01');

  if (octP.some(p => closeAmt(p.amount, half)) && pesinAdvance > 0.01) {
    wave = wave.map(p => {
      if (day(p) >= '2026-11-01' && (closeAmt(p.amount, half) || !closeAmt(p.amount, term2))) {
        if (closeAmt(p.amount, term2)) return p;
        return { ...p, amount: term2, desc: 'ÖDEME - Banka talimatı (2 nci)' };
      }
      return p;
    });
  }

  if (
    octP.some(p => closeAmt(p.amount, term1) && !closeAmt(p.amount, half)) &&
    novP.some(p => closeAmt(p.amount, term1) && !closeAmt(p.amount, half))
  ) {
    wave = wave.map(p => {
      if (day(p) >= '2026-11-01' && closeAmt(p.amount, term1)) {
        return { ...p, amount: half, type: 'bank', desc: 'ÖDEME - Banka talimatı (2 nci)' };
      }
      return p;
    });
  }

  octP = wave.filter(p => day(p) <= '2026-10-31');
  novP = wave.filter(p => day(p) >= '2026-11-01');
  if (octP.length && novP.length) {
    const allowed = (n: number) =>
      closeAmt(n, half) || closeAmt(n, term1) || closeAmt(n, term2) || closeAmt(n, septTotal);
    wave = wave.map(p => {
      if (day(p) < '2026-11-01' || allowed(p.amount)) return p;
      return { ...p, amount: term2, type: 'bank', desc: 'ÖDEME - Banka talimatı (2 nci)' };
    });
  }

  return [...rest, ...wave].sort((a, b) => (a.date || '').localeCompare(b.date || '') || a.amount - b.amount);
}
