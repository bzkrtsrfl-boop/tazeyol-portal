export function seferTotal(bedel: number, vat: boolean) {
  const b = Number(bedel) || 0;
  return vat ? Math.round(b * 1.2 * 100) / 100 : b;
}

export function seferVat(bedel: number, vat: boolean) {
  const b = Number(bedel) || 0;
  return vat ? Math.round(b * 0.2 * 100) / 100 : 0;
}

export function personelKasaFrom(entries: any[], handovers: any[], cleanNumber: (v: any) => number) {
  const nakit = (entries || []).filter((e: any) => !isHalCariOnly(e)).reduce((s: number, e: any) => s + cleanNumber(e.collected), 0);
  const teslim = (handovers || []).reduce((s: number, h: any) => s + cleanNumber(h.amount), 0);
  return Math.round((nakit - teslim) * 100) / 100;
}

export function isHalKasaOnly(e: any) {
  return /\[(AKTARIM-KASA|KASA-TAHSIL)\]/.test(String(e.notes || '')) || e.firm_name === 'Saha kasa açılışı';
}

export function isHalCariOnly(e: any) {
  return /\[(AKTARIM-CARI|DRIVE-GIRIS|MERKEZ-TAHSIL)\]/.test(String(e.notes || ''));
}

export function isHalMerkezTahsil(e: any) {
  return /\[MERKEZ-TAHSIL\]/.test(String(e.notes || '')) || !!e.kasa_invoice_id;
}

/** Excel aktarımında 163.000 teslim 2026-01-11 yazılmış; fiili kasa girişi 12.11.2026. */
export const HAL_TESLIM_163K_DATE = '2026-11-12';

export function halHandoverBookDate(h: any) {
  const amt = Math.round((Number(h?.amount) || 0) * 100) / 100;
  const raw = String(h?.hand_date || h?.created_at || '').slice(0, 10);
  const aktarimBozuk = raw === '2026-01-11' || raw === '2026-11-01' || (raw && raw < '2026-10-07');
  if (amt === 163000 && aktarimBozuk) return HAL_TESLIM_163K_DATE;
  return raw;
}

export function cleanHalNote(notes: any) {
  return String(notes || '').replace(/\s*\[(DRIVE-GIRIS|KASA-TAHSIL|AKTARIM-KASA|AKTARIM-CARI|MERKEZ-TAHSIL)\]/g, '').trim();
}

export type HalMoveSortField = 'date' | 'kind' | 'firm' | 'plate' | 'note' | 'sefer' | 'collected';

export function halMoveKindLabel(e: any) {
  if (e.kind === 'tahsilat') return isHalMerkezTahsil(e) ? 'Tahsilat · kasa' : 'Tahsilat';
  return 'Sefer';
}

export function cmpHalMove(a: any, b: any, field: HalMoveSortField, cleanNumber: (v: any) => number) {
  const seferOf = (e: any) => (e.kind === 'sefer' ? seferTotal(cleanNumber(e.bedel), !!e.has_vat) : 0);
  if (field === 'kind') return halMoveKindLabel(a).localeCompare(halMoveKindLabel(b), 'tr');
  if (field === 'firm') return String(a.firm_name || '').localeCompare(String(b.firm_name || ''), 'tr');
  if (field === 'plate') return String(a.plate || '').localeCompare(String(b.plate || ''), 'tr');
  if (field === 'note') return cleanHalNote(a.notes).localeCompare(cleanHalNote(b.notes), 'tr', { sensitivity: 'base' });
  if (field === 'sefer') return seferOf(a) - seferOf(b);
  if (field === 'collected') return cleanNumber(a.collected) - cleanNumber(b.collected);
  return String(a.entry_date || '').localeCompare(String(b.entry_date || ''));
}

function pad2(n: number) {
  return n < 10 ? '0' + n : String(n);
}

function isoDay(d: Date) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function monthStart(y: number, m0: number) {
  return `${y}-${pad2(m0 + 1)}-01`;
}

function monthEnd(y: number, m0: number) {
  const d = new Date(y, m0 + 1, 0);
  return isoDay(d);
}

export type HalReportPreset = 'bu_ay' | 'gecen_ay' | 'son_3_ay' | 'bu_yil';

export const HAL_REPORT_PRESETS: { id: HalReportPreset; label: string }[] = [
  { id: 'bu_ay', label: 'Bu ay' },
  { id: 'gecen_ay', label: 'Geçen ay' },
  { id: 'son_3_ay', label: '3 ay' },
  { id: 'bu_yil', label: 'Bu yıl' }
];

export function halReportRange(preset: HalReportPreset, now = new Date()) {
  const y = now.getFullYear();
  const m0 = now.getMonth();
  if (preset === 'gecen_ay') {
    const d = new Date(y, m0 - 1, 1);
    const from = monthStart(d.getFullYear(), d.getMonth());
    const to = monthEnd(d.getFullYear(), d.getMonth());
    return { from, to, label: 'Geçen ay', file: `gecen_ay_${from.slice(0, 7)}` };
  }
  if (preset === 'son_3_ay') {
    const d = new Date(y, m0 - 2, 1);
    const from = monthStart(d.getFullYear(), d.getMonth());
    const to = monthEnd(y, m0);
    return { from, to, label: 'Son 3 ay', file: `3ay_${from.slice(0, 7)}_${to.slice(0, 7)}` };
  }
  if (preset === 'bu_yil') {
    const from = `${y}-01-01`;
    const to = `${y}-12-31`;
    return { from, to, label: `Bu yıl (${y})`, file: `yil_${y}` };
  }
  const from = monthStart(y, m0);
  const to = monthEnd(y, m0);
  return { from, to, label: 'Bu ay', file: `bu_ay_${from.slice(0, 7)}` };
}

export function inHalRange(dateStr: any, from: string, to: string) {
  const d = String(dateStr || '').slice(0, 10);
  return d >= from && d <= to;
}

function todayIso(now = new Date()) {
  return isoDay(now);
}

export function isHalFirmActive(f: any) {
  return f && f.is_active !== false;
}

export function halFirmByName(firms: any[]) {
  const m = new Map<string, any>();
  (firms || []).forEach((f: any) => {
    if (f?.name) m.set(f.name, f);
  });
  return m;
}

/** Pasif firmanın tablolardan düştüğü ilk gün. Tarihi yoksa bugün. */
export function halFirmHideFrom(f: any, today = todayIso()) {
  if (isHalFirmActive(f)) return null;
  const cut = String(f?.inactive_at || '').slice(0, 10);
  if (/^\d{4}-\d{2}-\d{2}$/.test(cut)) return cut;
  return today;
}

export function isHalFirmShownInRange(f: any, from: string, to: string, today = todayIso()) {
  if (!f || isHalFirmActive(f)) return true;
  const hideFrom = halFirmHideFrom(f, today);
  if (!hideFrom) return false;
  return String(to || '').slice(0, 10) < hideFrom;
}

export function isHalEntryShown(e: any, firms: any[] | Map<string, any>, from: string, to: string, today = todayIso()) {
  const map = firms instanceof Map ? firms : halFirmByName(firms as any[]);
  return isHalFirmShownInRange(map.get(e?.firm_name), from, to, today);
}

export function buildHalCari(firms: any[], entries: any[], from: string, to: string, cleanNumber: (v: any) => number) {
  const map = halFirmByName(firms);
  const book = (e: any) => !isHalKasaOnly(e);
  const rangeEntries = (entries || []).filter((e: any) => inHalRange(e.entry_date, from, to) && book(e));
  const activeFirms = (firms || []).filter((f: any) => isHalFirmActive(f));
  const names = activeFirms.map((f: any) => f.name);
  const extra = (entries || []).filter(book).map((e: any) => e.firm_name).filter(Boolean);
  const all = [...new Set([...names, ...extra])];
  return all.map(name => {
    const firm = map.get(name);
    const shop = firm?.shop || '';
    const prev = (entries || []).filter((e: any) => e.firm_name === name && String(e.entry_date || '').slice(0, 10) < from && book(e));
    const now = rangeEntries.filter((e: any) => e.firm_name === name);
    const prevSefer = prev.reduce((s: number, e: any) => s + (e.kind === 'sefer' ? seferTotal(cleanNumber(e.bedel), !!e.has_vat) : 0), 0);
    const prevTah = prev.reduce((s: number, e: any) => s + cleanNumber(e.collected), 0);
    const sefer = now.reduce((s: number, e: any) => s + (e.kind === 'sefer' ? seferTotal(cleanNumber(e.bedel), !!e.has_vat) : 0), 0);
    const kdv = now.reduce((s: number, e: any) => s + (e.kind === 'sefer' ? seferVat(cleanNumber(e.bedel), !!e.has_vat) : 0), 0);
    const tahsilat = now.reduce((s: number, e: any) => s + cleanNumber(e.collected), 0);
    const devir = prevSefer - prevTah;
    const kalan = devir + sefer - tahsilat;
    const inactive = !!(firm && !isHalFirmActive(firm));
    return { name, shop, devir, sefer, kdv, tahsilat, kalan, inactive };
  }).filter(r => {
    const firm = map.get(r.name);
    if (!firm || isHalFirmActive(firm)) return true;
    return Math.abs(r.sefer) >= 0.005
      || Math.abs(r.tahsilat) >= 0.005
      || Math.abs(r.devir) >= 0.005
      || Math.abs(r.kalan) >= 0.005;
  }).sort((a, b) => a.name.localeCompare(b.name, 'tr'));
}
