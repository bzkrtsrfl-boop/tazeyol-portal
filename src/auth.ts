import { supabase } from './supabase';

export type UserRole = 'admin' | 'reporter';

export async function fetchUserRole(userId: string): Promise<UserRole | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', userId)
    .maybeSingle();

  if (error) {
    console.error('Rol okunamadı:', error.message);
    return null;
  }

  if (data?.role === 'admin' || data?.role === 'reporter') {
    return data.role;
  }

  return null;
}
