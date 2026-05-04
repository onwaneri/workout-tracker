-- One-off: wipe all logged session data. Plan, days, exercises are preserved.
-- session_sets has FK -> sessions, so CASCADE handles ordering.
truncate table public.session_sets, public.sessions restart identity cascade;
