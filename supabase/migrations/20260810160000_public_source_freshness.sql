create view public.public_source_freshness
with (security_barrier = true)
as
select
  source_id,
  max(last_success_at) as last_successful_check_at,
  max(last_failure_at) as last_failure_at
from public.source_connectors
where source_id is not null
group by source_id;

revoke all on table public.public_source_freshness from public;
grant select on table public.public_source_freshness
to anon, authenticated, service_role;

comment on view public.public_source_freshness is
  'Resumen público y sin errores internos de la salud técnica por fuente.';
