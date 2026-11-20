export const DIS_ALIM_RATE = 0.1;
export const YANSITMA_RATE = 0.05;

export const DIS_ALIM_KINDS = [
  { id: 'dis_alim', label: 'Dış alım', rate: DIS_ALIM_RATE, cari: 'Migros Dış Alım', feeNote: 'KDV’siz %10 nakliyeye gider; Dış Alım carisine yazılmaz' },
  { id: 'yansitma', label: 'Yansıtma', rate: YANSITMA_RATE, cari: 'Migros (normal)', feeNote: 'KDV’siz %5 nakliyeye gider; birebir fatura normal Migros’a' }
] as const;

export type DisAlimKind = (typeof DIS_ALIM_KINDS)[number]['id'];

export const DIS_ALIM_STATUSES = [
  { id: 'draft', label: 'Taslak' },
  { id: 'offered', label: 'Sunuldu' },
  { id: 'approved', label: 'Onaylandı' },
  { id: 'billed', label: 'Nakliye kesildi' }
] as const;

export type DisAlimStatus = (typeof DIS_ALIM_STATUSES)[number]['id'];

export const DIS_ALIM_UNITS = [
  'Ömerli Depo',
  'Konacık Depo',
  'Pelitli Depo',
  'İzmir Depo',
  'Ankara Depo',
  'Gross Filo'
];

export function disAlimKindMeta(kind: string) {
  return DIS_ALIM_KINDS.find(k => k.id === kind) || DIS_ALIM_KINDS[0];
}

export function disAlimStatusLabel(id: string) {
  return DIS_ALIM_STATUSES.find(s => s.id === id)?.label || id;
}

export function disAlimFee(kind: string, net: number) {
  const rate = kind === 'yansitma' ? YANSITMA_RATE : DIS_ALIM_RATE;
  return Math.round((Number(net) || 0) * rate * 100) / 100;
}

export function disAlimLineDate(row: any) {
  return String(row?.invoice_date || row?.request_date || '').slice(0, 10);
}

export function disAlimLineYm(row: any) {
  return disAlimLineDate(row).slice(0, 7);
}

export function previousYearMonth(ym: string) {
  const [y, m] = String(ym || '').split('-').map(Number);
  if (!y || !m) return '';
  const d = new Date(y, m - 2, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

const TR_MONTHS = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];

export function yearMonthTrLabel(ym: string) {
  const [y, m] = String(ym || '').split('-').map(Number);
  if (!y || !m) return ym || '';
  return `${TR_MONTHS[m - 1]} ${y}`;
}
