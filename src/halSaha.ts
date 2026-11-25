export function seferTotal(bedel: number, vat: boolean) {
  const b = Number(bedel) || 0;
  return vat ? Math.round(b * 1.2 * 100) / 100 : b;
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

export function cleanHalNote(notes: any) {
  return String(notes || '').replace(/\s*\[(DRIVE-GIRIS|KASA-TAHSIL|AKTARIM-KASA|AKTARIM-CARI|MERKEZ-TAHSIL)\]/g, '').trim();
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
  const today = todayIso();
  const map = halFirmByName(firms);
  const shown = (name: string) => isHalFirmShownInRange(map.get(name), from, to, today);
  const book = (e: any) => !isHalKasaOnly(e) && shown(e.firm_name);
  const rangeEntries = (entries || []).filter((e: any) => inHalRange(e.entry_date, from, to) && book(e));
  const activeFirms = (firms || []).filter((f: any) => isHalFirmActive(f));
  const names = activeFirms.map((f: any) => f.name);
  const extra = rangeEntries.map((e: any) => e.firm_name).filter(Boolean);
  const all = [...new Set([...names, ...extra])].filter(name => shown(name));
  return all.map(name => {
    const firm = map.get(name);
    const shop = firm?.shop || '';
    const prev = (entries || []).filter((e: any) => e.firm_name === name && String(e.entry_date || '').slice(0, 10) < from && book(e));
    const now = rangeEntries.filter((e: any) => e.firm_name === name);
    const prevSefer = prev.reduce((s: number, e: any) => s + (e.kind === 'sefer' ? seferTotal(cleanNumber(e.bedel), !!e.has_vat) : 0), 0);
    const prevTah = prev.reduce((s: number, e: any) => s + cleanNumber(e.collected), 0);
    const sefer = now.reduce((s: number, e: any) => s + (e.kind === 'sefer' ? seferTotal(cleanNumber(e.bedel), !!e.has_vat) : 0), 0);
    const tahsilat = now.reduce((s: number, e: any) => s + cleanNumber(e.collected), 0);
    const devir = prevSefer - prevTah;
    const kalan = devir + sefer - tahsilat;
    return { name, shop, devir, sefer, tahsilat, kalan };
  }).sort((a, b) => a.name.localeCompare(b.name, 'tr'));
}
