-- Only the new automatic import verified in this audit: a future date was
-- mistaken for a completed release. Preserve the original TMDB capture.
update public.films
set release_status = 'upcoming',
    notes = concat_ws(E'\n', notes,
      'Corrección editorial 2026-09-29: Verity (TMDB 1283515) tiene fecha de estreno 2026-09-30. La presencia de una fecha futura no acredita un estreno realizado; se conserva la captura TMDB original.')
where id = 'verity'
  and tmdb_id = 1283515
  and release_date = '2026-09-30'
  and release_date > current_date
  and release_status = 'released';
