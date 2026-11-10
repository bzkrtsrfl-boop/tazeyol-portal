import { supabase } from './supabase';

export type UserRole = 'admin' | 'reporter' | 'saha';

export type PortalProfile = {
  role: UserRole;
  rental_work_group: string | null;
  full_name: string | null;
};

export async function fetchProfile(userId: string): Promise<PortalProfile | null> {
  let { data, error } = await supabase
    .from('profiles')
    .select('role, rental_work_group, full_name')
    .eq('id', userId)
    .maybeSingle();

  if (error && /rental_work_group/i.test(error.message || '')) {
    const fallback = await supabase.from('profiles').select('role, full_name').eq('id', userId).maybeSingle();
    data = fallback.data as any;
    error = fallback.error;
  }

  if (error) {
    console.error('Rol okunamadı:', error.message);
    return null;
  }

  if (data?.role === 'admin' || data?.role === 'reporter' || data?.role === 'saha') {
    return {
      role: data.role,
      rental_work_group: (data as any).rental_work_group || null,
      full_name: data.full_name || null
    };
  }

  return null;
}

export async function fetchUserRole(userId: string): Promise<UserRole | null> {
  const profile = await fetchProfile(userId);
  return profile?.role || null;
}
