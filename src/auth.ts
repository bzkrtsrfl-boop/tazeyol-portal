import { supabase } from './supabase';

export type UserRole = 'admin' | 'reporter' | 'saha';
export type AccessLevel = 'view' | 'edit';

export const PORTAL_MODULES = [
  { id: 'rental_settlements', label: 'Kiralık araç mutabakatı' },
  { id: 'plate_rentals', label: 'Belge plaka kiraları' },
  { id: 'fleet', label: 'Araç filosu' },
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
  { id: 'general_expenses', label: 'Genel giderler' }
] as const;

export type PortalModuleId = (typeof PORTAL_MODULES)[number]['id'];

export const ACCESS_PRESETS: { id: string; label: string; access: Record<string, AccessLevel> }[] = [
  { id: 'saha_kiralik', label: 'Kiralık saha', access: { rental_settlements: 'edit' } },
  { id: 'arac', label: 'Araç sorumlusu', access: { fleet: 'edit', plate_rentals: 'edit', profitability: 'edit' } },
  { id: 'on_muhasebe', label: 'Ön muhasebe', access: {
    sales_customers: 'edit', customers: 'edit', collections: 'edit',
    subcontractors: 'edit', sub_accounts: 'edit', sub_ibans: 'edit',
    payments: 'edit', credit_cards: 'edit', general_expenses: 'edit', employees: 'edit'
  } }
];

export type PortalProfile = {
  role: UserRole;
  rental_work_group: string | null;
  rental_work_groups: string[];
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
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return out;
  Object.entries(raw).forEach(([k, v]) => {
    if (v === 'view' || v === 'edit') out[k] = v;
  });
  return out;
}

export async function fetchProfile(userId: string): Promise<PortalProfile | null> {
  let { data, error } = await supabase
    .from('profiles')
    .select('role, rental_work_group, rental_work_groups, portal_access, full_name')
    .eq('id', userId)
    .maybeSingle();

  if (error && /rental_work_groups|portal_access/i.test(error.message || '')) {
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
    let access = normalizeAccess((data as any).portal_access);
    if (data.role === 'saha' && !Object.keys(access).length) access = { rental_settlements: 'edit' };
    return {
      role: data.role,
      rental_work_group: groups[0] || null,
      rental_work_groups: groups,
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
