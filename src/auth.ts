import { supabase } from './supabase';

export type UserRole = 'admin' | 'reporter' | 'saha';
export type AccessLevel = 'view' | 'edit';

export const PORTAL_MODULES = [
  { id: 'rental_settlements', label: 'Kiralık araç mutabakatı' },
  { id: 'plate_rentals', label: 'Belge plaka kiraları' },
  { id: 'fleet', label: 'İç filo' },
  { id: 'arac_filosu', label: 'Araç filosu' },
  { id: 'profitability', label: 'Öz mal karlılık' },
  { id: 'sales_customers', label: 'Satış faturaları' },
  { id: 'customers', label: 'Müşteri kartları' },
  { id: 'collections', label: 'Müşteri tahsilatları' },
  { id: 'subcontractors', label: 'Hakediş faturaları' },
  { id: 'sub_accounts', label: 'Alt yüklenici cari' },
  { id: 'sub_ibans', label: 'Alt yüklenici tanımları' },
  { id: 'payments', label: 'Banka ödeme talimatı' },
  { id: 'employees', label: 'Personel ve bordro' },
  { id: 'credit_cards', label: 'Kredi kartları' },
  { id: 'general_expenses', label: 'Genel giderler' },
  { id: 'income_report', label: 'Gelir gider raporu' },
  { id: 'hal_saha', label: 'Hal saha' },
  { id: 'trip_settlements', label: 'Filo' }
] as const;

export type PortalModuleId = (typeof PORTAL_MODULES)[number]['id'];

export const FINANCE_DATA_MODULES: PortalModuleId[] = [
  'sales_customers', 'collections', 'customers', 'general_expenses',
  'employees', 'payments', 'credit_cards', 'subcontractors', 'sub_accounts',
  'income_report', 'profitability'
];

export function roleCanView(
  role: UserRole | null,
  access: Record<string, AccessLevel>,
  mod: string
) {
  if (role === 'admin' || role === 'reporter') return true;
  if (role !== 'saha') return false;
  const a = access[mod] || (mod === 'arac_filosu' ? access.fleet : undefined);
  return a === 'view' || a === 'edit';
}

/** Kullanıcılar ekranı: yönetici İşler, rapor Görür, personel kayıtlı yetki. */
export function displayAccess(
  role: UserRole | null,
  stored: Record<string, AccessLevel>
): Record<string, AccessLevel | ''> {
  const out: Record<string, AccessLevel | ''> = {};
  PORTAL_MODULES.forEach(m => {
    if (role === 'admin') out[m.id] = 'edit';
    else if (role === 'reporter') out[m.id] = 'view';
    else out[m.id] = stored[m.id] || '';
  });
  return out;
}

export function needsFinanceData(role: UserRole | null, access: Record<string, AccessLevel>) {
  return FINANCE_DATA_MODULES.some(m => roleCanView(role, access, m));
}

export const ACCESS_PRESETS: { id: string; label: string; access: Record<string, AccessLevel> }[] = [
  { id: 'saha_kiralik', label: 'Kiralık saha', access: { rental_settlements: 'edit' } },
  { id: 'filo_sadece', label: 'Sadece iç filo', access: { fleet: 'edit', arac_filosu: 'edit' } },
  { id: 'arac_filosu_sadece', label: 'Araç filosu künye', access: { arac_filosu: 'edit' } },
  { id: 'hal_saha_sadece', label: 'Hal saha giriş (gece sefer yazar)', access: { hal_saha: 'edit' } },
  { id: 'filo_saha', label: 'Filo depo (sefer yazar)', access: { trip_settlements: 'edit' } },
  { id: 'arac', label: 'Araç sorumlusu (künye + iç filo + plaka + karlılık)', access: { arac_filosu: 'edit', fleet: 'edit', plate_rentals: 'edit', profitability: 'edit' } },
  { id: 'on_muhasebe', label: 'Ön muhasebe', access: {
    sales_customers: 'edit', customers: 'edit', collections: 'edit',
    subcontractors: 'edit', sub_accounts: 'edit', sub_ibans: 'edit', trip_settlements: 'edit',
    payments: 'edit', credit_cards: 'edit', general_expenses: 'edit', employees: 'edit',
    income_report: 'view'
  } }
];

export type PortalProfile = {
  role: UserRole;
  rental_work_group: string | null;
  rental_work_groups: string[];
  filo_depots: string[];
  portal_access: Record<string, AccessLevel>;
  full_name: string | null;
};

export function normalizeGroups(raw: any, fallback?: string | null): string[] {
  const fromArr = Array.isArray(raw) ? raw.map((x) => String(x || '').trim()).filter(Boolean) : [];
  if (fromArr.length) return [...new Set(fromArr)];
  if (fallback) return [fallback];
  return [];
}

export function normalizeAccess(raw: any): Record<string, AccessLevel> {
  const out: Record<string, AccessLevel> = {};
  let src = raw;
  if (typeof src === 'string') {
    try { src = JSON.parse(src); } catch { return out; }
  }
  if (!src || typeof src !== 'object' || Array.isArray(src)) return out;
  Object.entries(src).forEach(([k, v]) => {
    if (v === 'view' || v === 'edit') out[k] = v;
  });
  return out;
}

export async function fetchProfile(userId: string): Promise<PortalProfile | null> {
  let { data, error } = await supabase
    .from('profiles')
    .select('role, rental_work_group, rental_work_groups, filo_depots, portal_access, full_name')
    .eq('id', userId)
    .maybeSingle();

  if (error && /rental_work_groups|portal_access|filo_depots/i.test(error.message || '')) {
    const fallback = await supabase.from('profiles').select('role, rental_work_group, full_name').eq('id', userId).maybeSingle();
    data = fallback.data as any;
    error = fallback.error;
  }

  if (error) {
    console.error('Rol okunamadı:', error.message);
    return null;
  }

  if (data?.role === 'admin' || data?.role === 'reporter' || data?.role === 'saha') {
    const groups = normalizeGroups((data as any).rental_work_groups, (data as any).rental_work_group);
    const access = normalizeAccess((data as any).portal_access);
    return {
      role: data.role,
      rental_work_group: groups[0] || null,
      rental_work_groups: groups,
      filo_depots: normalizeGroups((data as any).filo_depots),
      portal_access: access,
      full_name: data.full_name || null
    };
  }

  return null;
}

export async function fetchUserRole(userId: string): Promise<UserRole | null> {
  const profile = await fetchProfile(userId);
  return profile?.role || null;
}
