export type VehicleChargeKind = 'muayene' | 'sigorta' | 'kasko';

const CHARGE_TAG: Record<VehicleChargeKind, string> = {
  muayene: 'MUAYENE',
  sigorta: 'SIGORTA',
  kasko: 'KASKO'
};

export function vehicleChargeTag(kind: VehicleChargeKind) {
  return `[${CHARGE_TAG[kind]}]`;
}

export function inferVehicleChargeKind(inv: any): VehicleChargeKind | '' {
  const hay = `${inv?.invoice_no || ''} ${inv?.description || ''}`;
  const t = hay.toLocaleLowerCase('tr-TR');
  if (/\[MUAYENE\]/i.test(hay) || t.includes('muayene')) return 'muayene';
  if (/\[KASKO\]/i.test(hay) || t.includes('kasko')) return 'kasko';
  if (/\[SIGORTA\]/i.test(hay) || t.includes('sigorta')) return 'sigorta';
  return '';
}

export function stripVehicleChargeTags(title: string) {
  return String(title || '')
    .replace(/\[(MUAYENE|SIGORTA|KASKO)\]/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
