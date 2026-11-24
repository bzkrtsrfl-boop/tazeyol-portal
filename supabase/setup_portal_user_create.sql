-- Yönetici, Kullanıcılar ekranından hesap açar (Authentication paneline gitmeden).
-- Şifre sıfırlama ile aynı yöntem. SQL Editor'da bir kez Run.

create extension if not exists pgcrypto with schema extensions;

create or replace function public.admin_create_portal_user(
  p_email text,
  p_password text,
  p_full_name text default '',
  p_role text default 'saha',
  p_rental_work_group text default null
)
returns uuid
language plpgsql
security definer
set search_path = public, auth, extensions
as $$
declare
  v_email text;
  v_name text;
  v_role text;
  v_group text;
  v_id uuid;
  v_instance uuid;
begin
  if not public.is_admin() then
    raise exception 'Yalnız yönetici kullanıcı açabilir';
  end if;

  v_email := lower(btrim(coalesce(p_email, '')));
  v_name := btrim(coalesce(p_full_name, ''));
  v_role := coalesce(nullif(btrim(p_role), ''), 'saha');
  v_group := nullif(btrim(coalesce(p_rental_work_group, '')), '');

  if v_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then
    raise exception 'Geçerli e-posta yazın';
  end if;
  if p_password is null or length(btrim(p_password)) < 8 then
    raise exception 'Şifre en az 8 karakter olsun';
  end if;
  if v_role not in ('admin', 'reporter', 'saha') then
    raise exception 'Rol admin, rapor veya personel olmalı';
  end if;
  if v_group is not null and v_group not in ('magazalar', 'bati_marmara_yemek', 'dogu_marmara_yemek') then
    raise exception 'Geçersiz kiralık grup';
  end if;
  if v_role <> 'saha' then
    v_group := null;
  end if;
  if v_name = '' then
    v_name := split_part(v_email, '@', 1);
  end if;
  if exists (select 1 from auth.users u where lower(u.email) = v_email) then
    raise exception 'Bu e-posta zaten kayıtlı';
  end if;

  v_id := gen_random_uuid();
  select u.instance_id into v_instance from auth.users u limit 1;
  if v_instance is null then
    v_instance := '00000000-0000-0000-0000-000000000000';
  end if;

  insert into auth.users (
    instance_id,
    id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    raw_app_meta_data,
    raw_user_meta_data,
    created_at,
    updated_at,
    confirmation_token,
    email_change,
    email_change_token_new,
    recovery_token
  ) values (
    v_instance,
    v_id,
    'authenticated',
    'authenticated',
    v_email,
    extensions.crypt(btrim(p_password), extensions.gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    jsonb_build_object('full_name', v_name),
    now(),
    now(),
    '',
    '',
    '',
    ''
  );

  insert into auth.identities (
    id,
    user_id,
    identity_data,
    provider,
    provider_id,
    last_sign_in_at,
    created_at,
    updated_at
  ) values (
    gen_random_uuid(),
    v_id,
    jsonb_build_object('sub', v_id::text, 'email', v_email, 'email_verified', true),
    'email',
    v_id::text,
    now(),
    now(),
    now()
  );

  insert into public.profiles (id, role, full_name, rental_work_group)
  values (v_id, v_role, v_name, v_group)
  on conflict (id) do update
    set role = excluded.role,
        full_name = excluded.full_name,
        rental_work_group = excluded.rental_work_group;

  return v_id;
end;
$$;

revoke all on function public.admin_create_portal_user(text, text, text, text, text) from public, anon;
grant execute on function public.admin_create_portal_user(text, text, text, text, text) to authenticated;

notify pgrst, 'reload schema';
