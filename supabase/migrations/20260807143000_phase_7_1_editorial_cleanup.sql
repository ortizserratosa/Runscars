-- Fase 7.1.1: créditos editoriales verificados e higiene final de la cola.

insert into public.tmdb_movies (tmdb_id, last_checked_at)
values
  (1176962, '2026-08-07T12:30:00Z'),
  (1532610, '2026-08-07T12:30:00Z')
on conflict (tmdb_id) do update set
  last_checked_at = excluded.last_checked_at;

select public.record_film_tmdb_match(
  'rose-2026',
  1176962,
  'manual',
  'Rose',
  'Título, año y reparto con Sandra Hüller distinguen esta película del homónimo de 2026',
  'migration-20260807143000'
);

select public.record_film_tmdb_match(
  'ink',
  1532610,
  'manual',
  'Ink',
  'Título, dirección de Danny Boyle y reparto con Guy Pearce identifican la película citada por las fuentes',
  'migration-20260807143000'
);

update public.films
set notes = 'Alta editorial 7.1.1 documentada en manifiesto; identidad y créditos verificados aplicados por migración trazable'
where id in ('rose-2026', 'ink', 'elsinore', 'possible-love');

insert into public.films (
  id,
  title,
  eligibility_year,
  release_status,
  verification_url,
  notes
)
values (
  'the-odyssey',
  'The Odyssey',
  2026,
  'upcoming',
  'https://www.themoviedb.org/movie/1368337-the-odyssey',
  'Stub reproducible para el crédito editorial; el seed conserva la ficha vigente'
)
on conflict (id) do nothing;

insert into public.season_films (season_id, film_id)
values ('oscars-2027', 'the-odyssey')
on conflict (season_id, film_id) do nothing;

insert into public.tmdb_people (tmdb_id, last_checked_at)
values
  (7152, '2026-08-07T12:30:00Z'),
  (529, '2026-08-07T12:30:00Z'),
  (2034, '2026-08-07T12:30:00Z'),
  (2206, '2026-08-07T12:30:00Z'),
  (556435, '2026-08-07T12:30:00Z')
on conflict (tmdb_id) do update set
  last_checked_at = excluded.last_checked_at;

insert into public.people (id, name, tmdb_id)
values
  ('tmdb-7152', 'Sandra Hüller', 7152),
  ('tmdb-529', 'Guy Pearce', 529),
  ('tmdb-2034', 'Danny Boyle', 2034),
  ('tmdb-2206', 'Samantha Morton', 2206),
  ('tmdb-556435', 'Cho Yeo-jeong', 556435)
on conflict (tmdb_id) do update set
  name = excluded.name;

insert into public.film_credits (
  film_id,
  person_id,
  tmdb_credit_id,
  credit_kind,
  role,
  department,
  billing_order
)
values
  ('rose-2026', 'tmdb-7152', '64ff9e036a222700c3b58d6a', 'cast', 'Rose', 'Acting', 0),
  ('ink', 'tmdb-529', '68a4a1d643c40b84e3834530', 'cast', 'Rupert Murdoch', 'Acting', 0),
  ('ink', 'tmdb-2034', 'editorial-tmdb-2034-director', 'crew', 'Director', 'Directing', null),
  ('the-odyssey', 'tmdb-2206', '6984d0420986ab4e0e6e771b', 'cast', 'Circe', 'Acting', 57),
  ('possible-love', 'tmdb-556435', '6847b06d7a1db9c21a293384', 'cast', 'Ye-ji', 'Acting', 3)
on conflict (film_id, tmdb_credit_id) do update set
  person_id = excluded.person_id,
  credit_kind = excluded.credit_kind,
  role = excluded.role,
  department = excluded.department,
  billing_order = excluded.billing_order;

insert into public.film_credit_match_history (
  film_id,
  person_id,
  tmdb_credit_id,
  role,
  department,
  source_url,
  reason,
  actor
)
values
  (
    'rose-2026',
    'tmdb-7152',
    '64ff9e036a222700c3b58d6a',
    'Rose',
    'Acting',
    'https://www.themoviedb.org/movie/1176962-rose/cast',
    'Crédito y personaje verificados en el reparto público de TMDB',
    'migration-20260807143000'
  ),
  (
    'ink',
    'tmdb-529',
    '68a4a1d643c40b84e3834530',
    'Rupert Murdoch',
    'Acting',
    'https://www.themoviedb.org/movie/1532610-ink/cast',
    'Crédito y personaje verificados en el reparto público de TMDB',
    'migration-20260807143000'
  ),
  (
    'ink',
    'tmdb-2034',
    'editorial-tmdb-2034-director',
    'Director',
    'Directing',
    'https://www.themoviedb.org/movie/1532610-ink/cast',
    'Dirección verificada en el equipo público de TMDB',
    'migration-20260807143000'
  ),
  (
    'the-odyssey',
    'tmdb-2206',
    '6984d0420986ab4e0e6e771b',
    'Circe',
    'Acting',
    'https://www.themoviedb.org/movie/1368337-the-odyssey/cast',
    'Crédito y personaje verificados en el reparto público de TMDB',
    'migration-20260807143000'
  ),
  (
    'possible-love',
    'tmdb-556435',
    '6847b06d7a1db9c21a293384',
    'Ye-ji',
    'Acting',
    'https://www.themoviedb.org/movie/1483525-possible-love/cast',
    'Crédito, grafía y personaje verificados en el reparto público de TMDB',
    'migration-20260807143000'
  )
on conflict (film_id, person_id, role, source_url) do nothing;

update public.professional_observations
set
  state = 'excluded',
  participates = false
where source_id = 'awards-daily'
  and original_subject in (
    'Facebook',
    'LinkedIn',
    'Print',
    'Reddit',
    'Twitter'
  );

update public.ingestion_review_items as review
set
  status = 'dismissed',
  resolution_note = 'Excluida: la observación asociada no está pendiente de revisión',
  resolved_at = now(),
  resolved_by = 'migration-20260807143000'
from public.professional_observations as observation
where observation.id = review.observation_id
  and review.status = 'pending'
  and observation.state <> 'pending_review';
