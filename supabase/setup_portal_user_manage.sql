-- Kullanıcı kartında e-posta değiştirme ve aktif / pasif.
-- SQL Editor'da bir kez Run.

alter table public.profiles add column if not exists is_active boolean not null default true;
update public.profiles set is_active = true where is_active is null;

drop function if exists public.list_portal_users();
create or replace function public.list_portal_users()
returns table (
  id uuid,
  email text,
  full_name text,
  role text,
  rental_work_group text,
  rental_work_groups text[],
  portal_access jsonb,
  is_active boolean,
  created_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select p.id, u.email::text, p.full_name, p.role, p.rental_work_group, p.rental_work_groups, p.portal_access, coalesce(p.is_active, true), p.created_at
  from public.profiles p
  join auth.users u on u.id = p.id
  where public.is_admin()
  order by p.created_at;
$$;

revoke all on function public.list_portal_users() from public, anon;
grant execute on function public.list_portal_users() to authenticated;

create or replace function public.admin_update_portal_login(
  p_user_id uuid,
  p_email text,
  p_is_active boolean
)
returns boolean
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_email text;
  v_old text;
  v_role text;
  v_active_admins int;
begin
  if not public.is_admin() then
    raise exception 'Yalnız yönetici kullanıcı düzenleyebilir';
  end if;
  if p_user_id is null then
    raise exception 'Kullanıcı seçin';
  end if;

  v_email := lower(btrim(coalesce(p_email, '')));
  if v_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then
    raise exception 'Geçerli e-posta yazın';
  end if;

  select u.email::text, p.role into v_old, v_role
  from auth.users u
  join public.profiles p on p.id = u.id
  where u.id = p_user_id;
  if v_old is null then
    raise exception 'Kullanıcı bulunamadı';
  end if;

  if p_is_active is false then
    if p_user_id = auth.uid() then
      raise exception 'Kendi hesabınızı pasif yapamazsınız';
    end if;
    if v_role = 'admin' then
      select count(*) into v_active_admins
      from public.profiles
      where role = 'admin' and coalesce(is_active, true) and id <> p_user_id;
      if coalesce(v_active_admins, 0) < 1 then
        raise exception 'Son aktif yönetici pasif yapılamaz';
      end if;
    end if;
  end if;

  if exists (select 1 from auth.users u where lower(u.email) = v_email and u.id <> p_user_id) then
    raise exception 'Bu e-posta başka bir hesapta kayıtlı';
  end if;

  update auth.users
  set
    email = v_email,
    email_confirmed_at = coalesce(email_confirmed_at, now()),
    banned_until = case when p_is_active then null else 'infinity'::timestamptz end,
    updated_at = now()
  where id = p_user_id;

  update auth.identities
  set
    identity_data = coalesce(identity_data, '{}'::jsonb) || jsonb_build_object('email', v_email, 'email_verified', true),
    provider_id = case
      when provider = 'email' and provider_id = v_old then v_email
      else provider_id
    end,
    updated_at = now()
  where user_id = p_user_id;

  update public.profiles
  set is_active = p_is_active
  where id = p_user_id;

  return true;
end;
$$;

revoke all on function public.admin_update_portal_login(uuid, text, boolean) from public, anon;
grant execute on function public.admin_update_portal_login(uuid, text, boolean) to authenticated;

notify pgrst, 'reload schema';
