alter table public.user_film_states
add column status text not null default 'watched';

alter table public.user_film_states
add constraint user_film_states_status_check
check (status in ('watched', 'not_watched'));

create index user_film_states_film_id_idx
on public.user_film_states (film_id, user_id);

comment on column public.user_profiles.watched_is_public is
'Legacy compatibility column. Public visibility is now derived from public rankings and is not read by the application.';

drop policy user_film_states_read on public.user_film_states;

create policy user_film_states_read
on public.user_film_states for select
to anon, authenticated
using (
  (select auth.uid()) = user_id
  or exists (
    select 1
    from public.user_ranking_entries as entry
    join public.user_rankings as ranking
      on ranking.id = entry.ranking_id
    join public.user_profiles as profile
      on profile.user_id = ranking.user_id
    join public.category_candidates as candidate
      on candidate.id = entry.category_candidate_id
    where ranking.user_id = user_film_states.user_id
      and ranking.is_public
      and profile.is_public
      and candidate.film_id = user_film_states.film_id
  )
);
