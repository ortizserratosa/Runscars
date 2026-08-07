insert into public.user_profiles (
  user_id,
  slug,
  display_name
)
select
  users.id,
  'usuario-' || replace(users.id::text, '-', ''),
  coalesce(
    left(nullif(trim(users.raw_user_meta_data ->> 'display_name'), ''), 60),
    'Usuario Runscars'
  )
from auth.users as users
where not exists (
  select 1
  from public.user_profiles as profile
  where profile.user_id = users.id
)
on conflict (user_id) do nothing;

comment on table public.user_profiles is
  'Perfil mínimo separado de auth.users; privado por defecto y retroactivo para cuentas existentes.';
