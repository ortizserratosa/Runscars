-- Awards Radar expresa algunas apuestas de interpretación como película
-- principal seguida de una alternativa parentética. La v4 conserva la línea
-- original y usa la primera película para la identidad publicable.

update public.source_connectors
set extractor_version = 'awards-radar-v4'
where id = 'awards-radar-predictions';
