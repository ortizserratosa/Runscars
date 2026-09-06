-- Correcciones verificadas el 2026-09-03 contra las páginas oficiales vivas.

update public.festival_editions
set selection_url = 'https://www.berlinale.de/en/programme/berlinale-programme.html/y%3D2026',
    updated_at = now()
where id = 'berlinale-2026';

update public.festival_connectors
set endpoint_url = 'https://www.berlinale.de/en/programme/berlinale-programme.html/y%3D2026',
    configuration = jsonb_set(
      configuration,
      '{selection_url}',
      to_jsonb('https://www.berlinale.de/en/programme/berlinale-programme.html/y%3D2026'::text)
    ),
    updated_at = now()
where id = 'festival-berlinale';

update public.festival_editions
set selection_url = 'https://www.sansebastianfestival.com/2026/sections_and_films/official_selection/8/in',
    updated_at = now()
where id = 'san-sebastian-2026';

update public.festival_connectors
set endpoint_url = 'https://www.sansebastianfestival.com/2026/sections_and_films/official_selection/8/in',
    configuration = jsonb_set(
      configuration,
      '{selection_url}',
      to_jsonb('https://www.sansebastianfestival.com/2026/sections_and_films/official_selection/8/in'::text)
    ),
    updated_at = now()
where id = 'festival-san-sebastian';
