-- The editorial TMDB correction is performed by tmdb:match with its immutable
-- matching history and fresh movie/person snapshots. Correct the canonical
-- fallback metadata only once that verified identity has been installed.
update public.films
set release_date = '2026-12-25',
    release_status = 'upcoming',
    verification_url = 'https://www.themoviedb.org/movie/1492198',
    notes = concat_ws(E'\n', notes,
      'Corrección editorial 2026-09-29: Artificial de Luca Guadagnino, verificada en https://www.filmlinc.org/nyff2026/films/artificial/ y TMDB 1492198. El antiguo TMDB 1586108, estreno 2026-10-01 y estado released correspondían al homónimo de Tyler Woods; se conservan los snapshots originales y film_tmdb_match_history. La fecha TMDB no acredita elegibilidad Oscar.')
where id = 'artificial'
  and tmdb_id = 1492198
  and verification_url = 'https://www.themoviedb.org/movie/1586108';
