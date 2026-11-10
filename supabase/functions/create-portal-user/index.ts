import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

const GROUPS = new Set(['magazalar', 'bati_marmara_yemek', 'dogu_marmara_yemek']);
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

function json(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' }
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json(405, { error: 'Yalnız POST' });

  const url = Deno.env.get('SUPABASE_URL') || '';
  const anon = Deno.env.get('SUPABASE_ANON_KEY') || '';
  const service = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
  const authHeader = req.headers.get('Authorization') || '';
  if (!url || !anon || !service || !authHeader) return json(500, { error: 'Sunucu ayarı eksik' });

  const caller = createClient(url, anon, { global: { headers: { Authorization: authHeader } } });
  const { data: userData, error: userErr } = await caller.auth.getUser();
  if (userErr || !userData.user) return json(401, { error: 'Oturum yok' });

  const { data: profile } = await caller.from('profiles').select('role').eq('id', userData.user.id).maybeSingle();
  if (profile?.role !== 'admin') return json(403, { error: 'Yalnız yönetici kullanıcı açabilir' });

  let body: any;
  try {
    body = await req.json();
  } catch {
    return json(400, { error: 'Geçersiz istek' });
  }

  const email = String(body.email || '').trim().toLowerCase();
  const password = String(body.password || '');
  const full_name = String(body.full_name || '').trim();
  const role = body.role === 'admin' ? 'admin' : body.role === 'reporter' ? 'reporter' : 'saha';
  const rental_work_group = String(body.rental_work_group || '').trim() || null;

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return json(400, { error: 'Geçerli e-posta yazın' });
  if (password.length < 8) return json(400, { error: 'Şifre en az 8 karakter olsun' });
  if (role === 'saha' && (!rental_work_group || !GROUPS.has(rental_work_group))) {
    return json(400, { error: 'Saha için kiralık grup seçin' });
  }
  if (rental_work_group && !GROUPS.has(rental_work_group)) return json(400, { error: 'Geçersiz grup' });

  const admin = createClient(url, service);
  const created = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: full_name || email.split('@')[0] }
  });
  if (created.error || !created.data.user) {
    const msg = created.error?.message || 'Kullanıcı açılamadı';
    if (/already/i.test(msg)) return json(409, { error: 'Bu e-posta zaten kayıtlı' });
    return json(400, { error: msg });
  }

  const id = created.data.user.id;
  const upsert = await admin.from('profiles').upsert({
    id,
    role,
    full_name: full_name || email.split('@')[0],
    rental_work_group: role === 'saha' ? rental_work_group : null
  });
  if (upsert.error) {
    return json(500, { error: 'Hesap açıldı ama profil yazılamadı: ' + upsert.error.message });
  }

  return json(200, { ok: true, id, email });
});
