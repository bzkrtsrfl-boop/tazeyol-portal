export const ARAC_VEHICLE_TYPES = [
  'MiniVan',
  'MidiVan',
  'PanelVan',
  'KucukKamyon',
  'OrtaKamyon',
  'BuyukKamyon',
  'Jumbo',
  'Tır'
] as const;

export type AracVehicleType = (typeof ARAC_VEHICLE_TYPES)[number];

export const ARAC_COOLING = [
  { id: 'plus4', label: '+4 °C' },
  { id: 'minus18', label: '−18 °C' }
] as const;

export type AracCoolingId = (typeof ARAC_COOLING)[number]['id'];

export const ARAC_JOBS_SEED = [
  { code: 'OM', label: 'Ömerli' },
  { code: 'PE', label: 'Pelitli' },
  { code: 'KN', label: 'Konacık' },
  { code: 'IZ', label: 'İzmir' },
  { code: 'GR', label: 'Gross' },
  { code: 'MG', label: 'Mağaza' },
  { code: 'YM', label: 'Yemek' }
];

export const ARAC_PLACES_SEED = [
  { code: 'FL', label: 'Filo' },
  { code: 'DY', label: 'Diyarbakır' },
  { code: 'SL', label: 'Silivri' },
  { code: 'TZ', label: 'Tuzla' },
  { code: 'DG', label: 'Doğu' },
  { code: 'BT', label: 'Batı' }
];

export function padAracSeq(n: number) {
  return String(n).padStart(3, '0');
}

export function aracVehicleCode(job: string, place: string, seq: number) {
  return `${String(job || '').toUpperCase()}-${String(place || '').toUpperCase()}-${padAracSeq(seq)}`;
}

export function defaultMutabakatForPrefix(job: string, place: string): { kind: 'filo' | 'kiralik'; groupId: string }[] {
  const j = String(job || '').toUpperCase();
  const p = String(place || '').toUpperCase();
  const key = `${j}-${p}`;
  const map: Record<string, { kind: 'filo' | 'kiralik'; groupId: string }[]> = {
    'OM-FL': [{ kind: 'filo', groupId: 'omerli' }],
    'PE-FL': [{ kind: 'filo', groupId: 'pelitli' }],
    'KN-FL': [{ kind: 'filo', groupId: 'konacik' }],
    'IZ-FL': [{ kind: 'filo', groupId: 'izmir' }],
    'GR-FL': [{ kind: 'filo', groupId: 'gross' }],
    'MG-DY': [{ kind: 'kiralik', groupId: 'magazalar' }],
    'MG-SL': [{ kind: 'kiralik', groupId: 'magazalar' }],
    'MG-TZ': [{ kind: 'kiralik', groupId: 'magazalar' }],
    'YM-DG': [{ kind: 'kiralik', groupId: 'dogu_marmara_yemek' }],
    'YM-BT': [{ kind: 'kiralik', groupId: 'bati_marmara_yemek' }]
  };
  return map[key] || [];
}

export function coolingLabel(id: string) {
  return ARAC_COOLING.find(c => c.id === id)?.label || id;
}

export function plateKeyArac(p: string) {
  return String(p || '').toUpperCase().replace(/\s+/g, '');
}
