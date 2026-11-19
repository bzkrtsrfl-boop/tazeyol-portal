export type FiloDepot = {
  id: string;
  label: string;
  is_shared?: boolean;
  sort_order?: number;
  is_active?: boolean;
};

export const FILO_ORTAK_ID = 'ortak';

export const FILO_DEPOTS: FiloDepot[] = [
  { id: 'omerli', label: 'Ömerli Depo', is_shared: false, sort_order: 1 },
  { id: 'konacik', label: 'Konacık Depo', is_shared: false, sort_order: 2 },
  { id: 'pelitli', label: 'Pelitli Depo', is_shared: false, sort_order: 3 },
  { id: 'gross', label: 'Gross Filo', is_shared: false, sort_order: 4 },
  { id: 'izmir', label: 'İzmir Depo', is_shared: false, sort_order: 5 }
];

export const FILO_ORTAK: FiloDepot = { id: FILO_ORTAK_ID, label: 'Ortak', is_shared: true, sort_order: 100 };

export type FiloDepotId = string;

export function isFiloSharedDepot(d: Pick<FiloDepot, 'id' | 'is_shared'> | string) {
  if (typeof d === 'string') return d === FILO_ORTAK_ID;
  return d.is_shared === true || d.id === FILO_ORTAK_ID;
}

export function mergeFiloDepots(rows?: any[] | null): FiloDepot[] {
  const src = (rows || [])
    .filter((r: any) => r && r.id && r.is_active !== false)
    .map((r: any) => ({
      id: String(r.id),
      label: String(r.label || r.id),
      is_shared: r.is_shared === true || String(r.id) === FILO_ORTAK_ID,
      sort_order: Number(r.sort_order) || 0
    }));
  const list = src.length ? src : [...FILO_DEPOTS, FILO_ORTAK];
  return [...list].sort(
    (a, b) =>
      Number(isFiloSharedDepot(a)) - Number(isFiloSharedDepot(b))
      || (a.sort_order || 0) - (b.sort_order || 0)
      || a.label.localeCompare(b.label, 'tr')
  );
}

export function filoWorkDepots(rows?: any[] | null) {
  return mergeFiloDepots(rows).filter(d => !isFiloSharedDepot(d));
}

export function filoDepotLabel(id: string, rows?: any[] | null) {
  return mergeFiloDepots(rows).find(d => d.id === id)?.label || id;
}

export function filoAssignDepots(rows?: any[] | null) {
  return filoWorkDepots(rows);
}

export function plateKey(p: string) {
  return String(p || '').toUpperCase().replace(/\s+/g, '');
}

export function isAlkanContractor(name: string) {
  return String(name || '').toLocaleUpperCase('tr-TR').includes('ALKAN');
}

export function alkanFiloPlateKeys(plates: any[]) {
  return new Set(
    (plates || [])
      .filter((p: any) => isAlkanContractor(p.contractor_name))
      .map((p: any) => plateKey(p.plate))
  );
}

export function filoDepotSlug(label: string) {
  const map: Record<string, string> = {
    ç: 'c', ğ: 'g', ı: 'i', İ: 'i', I: 'i', ö: 'o', ş: 's', ü: 'u',
    Ç: 'c', Ğ: 'g', Ö: 'o', Ş: 's', Ü: 'u'
  };
  const slug = String(label || '')
    .split('')
    .map(c => map[c] || c)
    .join('')
    .toLowerCase()
    .replace(/depo/g, ' ')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '')
    .slice(0, 40);
  return slug || 'depo';
}

export function filoVisibleDepots(role: string | null, assigned: string[], rows?: any[] | null) {
  const all = mergeFiloDepots(rows);
  const work = all.filter(d => !isFiloSharedDepot(d));
  const shared = all.filter(d => isFiloSharedDepot(d));
  if (role === 'admin' || role === 'reporter') return [...work, ...shared];
  const mine = work.filter(d => assigned.includes(d.id));
  if (!mine.length) return assigned.includes(FILO_ORTAK_ID) ? shared : [];
  return [...mine, ...shared];
}

/** Ayın 5'inde kapanır: Ekim satırı 5 Kasım'dan itibaren saha yazamaz. */
export function tripMonthLockedForSaha(yearMonth: string, now = new Date()) {
  const [y, m] = String(yearMonth || '').split('-').map(Number);
  if (!y || !m) return true;
  const lock = new Date(y, m, 5);
  lock.setHours(0, 0, 0, 0);
  const d = new Date(now);
  d.setHours(0, 0, 0, 0);
  return d.getTime() >= lock.getTime();
}
