-- Parser corrections preserve original observations and locked snapshots.
update public.source_connectors
set extractor_version = case id
  when 'awardswatch-predictions' then 'awardswatch-multicategory-v6'
  when 'awards-daily-predictions' then 'awards-daily-v8'
  when 'awards-radar-predictions' then 'awards-radar-v6'
  else extractor_version end
where id in ('awardswatch-predictions','awards-daily-predictions',
  'awards-radar-predictions');

update public.source_connectors
set configuration = configuration || jsonb_build_object(
  'panel_author', 'Erik Anderson',
  'required_category_ids', jsonb_build_array(
    'best-picture','directing','actor','actress','supporting-actor',
    'supporting-actress','original-screenplay','adapted-screenplay'
  )
)
where id = 'awardswatch-predictions';
