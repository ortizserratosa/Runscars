update public.snapshot_schedules
set
  cron_expression = '47 4 * * *',
  updated_at = now()
where season_id = 'oscars-2027'
  and prediction_intention = 'nomination'
  and kind = 'periodic'
  and is_active = true;

comment on table public.snapshot_schedules is
  'Alcances de corte. La aplicación ejecuta los periódicos diariamente y solo bloquea una envolvente cuando cambia el estado profesional efectivo.';
