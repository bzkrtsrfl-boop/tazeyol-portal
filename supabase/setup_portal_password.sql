-- Yönetici, Kullanıcılar ekranından şifre sıfırlar.
-- SQL Editor'da bir kez Run.

create extension if not exists pgcrypto with schema extensions;

create or replace function public.admin_reset_portal_password(p_user_id uuid, p_password text)
returns boolean
language plpgsql
security definer
set search_path = public, auth, extensions
as $$
begin
  if not public.is_admin() then
    raise exception 'Yalnız yönetici şifre sıfırlayabilir';
  end if;
  if p_user_id is null then
    raise exception 'Kullanıcı seçin';
  end if;
  if p_password is null or length(btrim(p_password)) < 8 then
    raise exception 'Yeni şifre en az 8 karakter olsun';
  end if;
  update auth.users
  set
    encrypted_password = extensions.crypt(btrim(p_password), extensions.gen_salt('bf')),
    updated_at = now()
  where id = p_user_id;
  if not found then
    raise exception 'Kullanıcı bulunamadı';
  end if;
  return true;
end;
$$;

revoke all on function public.admin_reset_portal_password(uuid, text) from public, anon;
grant execute on function public.admin_reset_portal_password(uuid, text) to authenticated;
