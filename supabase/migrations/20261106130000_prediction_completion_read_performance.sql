-- The service-only cohort views do not form a public security boundary.
-- Their nested security barriers prevented predicates from reaching the
-- observation/member indexes, reducing estimates to one row and replaying
-- full cohort scans inside each public source/category join. Keep the public
-- evidence barrier, RLS, private grants and atomic completion guard intact.
alter view public.completed_professional_observations set (security_barrier = false);
alter view public.completed_source_publication_captures set (security_barrier = false);
