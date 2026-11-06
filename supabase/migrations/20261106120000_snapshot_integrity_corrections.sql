-- Corrections are additive: preserve every locked payload and its content hash.
create table public.snapshot_integrity_corrections (
  snapshot_id text primary key references public.aggregate_snapshots (id)
    on delete restrict,
  reason text not null check (length(btrim(reason)) between 1 and 1000),
  corrected_at timestamptz not null default now()
);

alter table public.snapshot_integrity_corrections enable row level security;
revoke all on table public.snapshot_integrity_corrections from anon, authenticated, service_role;
grant select on table public.snapshot_integrity_corrections to anon, authenticated;
grant select, insert on table public.snapshot_integrity_corrections to service_role;

create policy snapshot_integrity_corrections_public_read
on public.snapshot_integrity_corrections for select
to anon, authenticated, service_role
using (true);

create policy snapshot_integrity_corrections_service_insert
on public.snapshot_integrity_corrections for insert
to service_role
with check (true);

create trigger snapshot_integrity_corrections_immutable
before update or delete on public.snapshot_integrity_corrections
for each row execute function public.prevent_locked_record_mutation();

comment on table public.snapshot_integrity_corrections is
  'Public correction notices for locked snapshots excluded from consensus history and movements. Original payloads and hashes remain immutable.';

-- Confirmed against the source receipts and rows durable at each lock time.
-- Pending editorial matches count as persisted evidence. Legacy revisions with
-- equivalent rows reused across captures are not presumed incomplete.
with corrections(snapshot_id, reason) as (
  values
    (
      'periodic-oscars-2027-best-picture-nomination-2026-11-04-4c018ee649f5',
      'Importación incompleta al bloquear el corte: The Ankler conservaba 1 de 10 filas y The Rolling Tape 11 de 20. Se retira de la serie pública; el original permanece intacto.'
    ),
    (
      'periodic-oscars-2027-supporting-actor-nomination-2026-11-04-9948bd1cde61',
      'Importación incompleta al bloquear el corte: Variety conservaba 8 de las 10 filas dentro de la ventana de puntuación. Se retira de la serie pública; el original permanece intacto.'
    ),
    (
      'periodic-oscars-2027-best-picture-nomination-2026-11-06-0f8ac40c5ad8',
      'Importación incompleta al bloquear el corte: Awards Radar conservaba 6 de 20 filas y Variety 19 de 20 dentro de la ventana de puntuación. Se retira de la serie pública; el original permanece intacto.'
    ),
    (
      'periodic-oscars-2027-actor-nomination-2026-11-06-0b50b64438ac',
      'Importación incompleta al bloquear el corte: Variety conservaba 7 de las 10 filas dentro de la ventana de puntuación. Se retira de la serie pública; el original permanece intacto.'
    )
)
insert into public.snapshot_integrity_corrections(snapshot_id, reason)
select snapshot.id, corrections.reason
from corrections
join public.aggregate_snapshots snapshot on snapshot.id = corrections.snapshot_id
where snapshot.method_version = 'runscars-aggregation-v4'
on conflict (snapshot_id) do nothing;
