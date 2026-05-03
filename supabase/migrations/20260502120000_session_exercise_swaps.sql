-- session_exercise_swaps: tracks per-session exercise substitutions without mutating the plan_version.
-- When a user swaps an exercise mid-session, we record what was planned vs. what was performed.

CREATE TABLE session_exercise_swaps (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id uuid NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    planned_exercise_id uuid NOT NULL REFERENCES exercises(id) ON DELETE RESTRICT,
    performed_exercise_name text NOT NULL,
    performed_muscle_group text NOT NULL,
    performed_type text NOT NULL CHECK (performed_type IN ('compound', 'isolation')),
    reason text,
    client_uuid uuid NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX session_exercise_swaps_by_session ON session_exercise_swaps (session_id);
CREATE INDEX session_exercise_swaps_by_client ON session_exercise_swaps (client_uuid);

GRANT SELECT, INSERT, UPDATE, DELETE ON session_exercise_swaps TO anon;
ALTER TABLE session_exercise_swaps ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Scope session_exercise_swaps to client_uuid" ON session_exercise_swaps FOR ALL
    USING (client_uuid = (current_setting('request.headers', true)::json->>'x-client-uuid')::uuid)
    WITH CHECK (client_uuid = (current_setting('request.headers', true)::json->>'x-client-uuid')::uuid);
