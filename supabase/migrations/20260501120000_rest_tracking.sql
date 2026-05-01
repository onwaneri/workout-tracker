-- Track actual rest taken after each working set + the recommended target at the time it was logged.
-- rest_ms: ms elapsed between this set's log and the next set / skip / session end. Null for skipped, warmup, or unrested.
-- rest_target_seconds: snapshot of the recommended rest at log time so historical aggregates stay stable if defaults change.

ALTER TABLE session_sets ADD COLUMN rest_ms bigint;
ALTER TABLE session_sets ADD COLUMN rest_target_seconds integer;
