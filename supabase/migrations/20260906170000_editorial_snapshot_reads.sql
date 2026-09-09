-- The editorial dashboard reads these already-public immutable records through
-- its server-only service client after checking the administrator allowlist.
-- Make this independent of hosted-project default grants; grant no mutations.
grant select on public.aggregate_snapshots, public.official_result_sets to service_role;
