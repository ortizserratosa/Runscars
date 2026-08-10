-- PostgREST can retain a stale schema cache after a view is created remotely.
-- Keep the refresh versioned so every environment exposes the same public API.
notify pgrst, 'reload schema';
