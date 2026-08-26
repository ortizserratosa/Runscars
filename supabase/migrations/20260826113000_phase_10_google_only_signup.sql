create or replace function public.hook_allow_google_signup_only(event jsonb)
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  signup_provider text := event #>> '{user,app_metadata,provider}';
begin
  if signup_provider = 'google' then
    return '{}'::jsonb;
  end if;

  return jsonb_build_object(
    'error',
    jsonb_build_object(
      'http_code', 403,
      'message', 'New accounts are available through Google during the public beta.'
    )
  );
end;
$$;

revoke all on function public.hook_allow_google_signup_only(jsonb)
from public, anon, authenticated;

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'supabase_auth_admin') then
    grant usage on schema public to supabase_auth_admin;
    grant execute on function public.hook_allow_google_signup_only(jsonb)
      to supabase_auth_admin;
  end if;
end;
$$;

comment on function public.hook_allow_google_signup_only(jsonb) is
  'Before-user-created Auth hook: during the public beta only Google may create accounts.';
