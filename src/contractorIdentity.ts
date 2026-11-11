export function normalizeContractorKey(str: string) {
  return (str || '')
    .replace(/İ/g, 'i')
    .replace(/I/g, 'i')
    .toLocaleLowerCase('tr-TR')
    .replace(/ı/g, 'i')
    .replace(/ğ/g, 'g')
    .replace(/ü/g, 'u')
    .replace(/ş/g, 's')
    .replace(/ö/g, 'o')
    .replace(/ç/g, 'c')
    .replace(/[^a-z0-9]/g, '');
}

export function extractContractorName(invoiceNo: string) {
  const full = String(invoiceNo || '').trim();
  const parts = full.split(/\s[-–—]\s/).map(s => s.trim()).filter(Boolean);
  if (parts.length >= 2) return parts[parts.length - 1].replace(/\([^)]*\)/g, '').trim();
  return full;
}

export function extractAdvanceContractorName(invoiceNo: string) {
  return extractContractorName(String(invoiceNo || '').replace(/^AVANS\s*-?\s*/i, ''))
    .replace(/\([^)]*\)/g, '')
    .trim();
}

export function contractorKeysLooselyMatch(a: string, b: string) {
  const ka = normalizeContractorKey(a);
  const kb = normalizeContractorKey(b);
  if (!ka || !kb) return false;
  if (ka === kb) return true;
  const shorter = ka.length <= kb.length ? ka : kb;
  const longer = ka.length <= kb.length ? kb : ka;
  if (shorter.length < 6) return false;
  if (longer.startsWith(shorter)) return true;
  if (shorter.length >= 8 && longer.includes(shorter)) return true;
  return false;
}

const CONTRACTOR_STOP_WORDS = new Set(['limited', 'sirketi', 'anonim', 'nakliyat', 'lojistik', 'ltd', 'sti', 'as', 'sanayi', 'ticaret', 'gida', 'insaat', 'otomotiv', 'tasimacilik', 'tazeyol', 'hakedis', 'odeme', 'odemesi', 'vade', 'avans', 'banka', 'talimati']);

export function contractorNameTokens(str: string) {
  const folded = String(str || '')
    .replace(/İ/g, 'i')
    .replace(/I/g, 'i')
    .toLocaleLowerCase('tr-TR')
    .replace(/ı/g, 'i')
    .replace(/ğ/g, 'g')
    .replace(/ü/g, 'u')
    .replace(/ş/g, 's')
    .replace(/ö/g, 'o')
    .replace(/ç/g, 'c');
  return folded.split(/[^a-z0-9]+/).filter(w => w.length >= 3 && !CONTRACTOR_STOP_WORDS.has(w));
}

export function tokenEqualsOrPrefix(a: string, b: string) {
  if (a === b) return true;
  if (a.length >= 4 && b.length >= 4 && (a.startsWith(b) || b.startsWith(a))) return true;
  return false;
}

export function givenNamesMatch(a: string, b: string) {
  if (a === b) return true;
  if (a.length >= 6 && b.length >= 6 && (a.startsWith(b) || b.startsWith(a))) return true;
  return false;
}

export function contractorRecordsMatch(a: string, b: string) {
  const ka = normalizeContractorKey(a);
  const kb = normalizeContractorKey(b);
  if (!ka || !kb) return false;
  if (ka === kb) return true;
  const ta = contractorNameTokens(a);
  const tb = contractorNameTokens(b);
  if (!ta.length || !tb.length) return false;
  if (ta.join('') === tb.join('')) return true;
  if (ta.length >= 2 && tb.length >= 2) {
    if (!tokenEqualsOrPrefix(ta[ta.length - 1], tb[tb.length - 1])) return false;
    const fa = ta.slice(0, -1);
    const fb = tb.slice(0, -1);
    const shortF = fa.length <= fb.length ? fa : fb;
    const longF = fa.length <= fb.length ? fb : fa;
    return shortF.every(t => longF.some(u => givenNamesMatch(t, u)));
  }
  const only = ta.length === 1 ? ta[0] : tb[0];
  const other = ta.length === 1 ? kb : ka;
  if (only.length < 8) return false;
  return other === only || other.startsWith(only) || only.startsWith(other);
}
