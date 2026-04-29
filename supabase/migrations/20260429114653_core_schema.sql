-- Core schema for plan versioning, sessions, sets, supersets, goals.
-- All tables RLS-scoped via the x-client-uuid request header (matches the plans table).

-- ============================================================
-- plan_versions
-- ============================================================
CREATE TABLE plan_versions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    plan_id uuid NOT NULL REFERENCES plans(id) ON DELETE CASCADE,
    client_uuid uuid NOT NULL,
    version_number integer NOT NULL,
    is_active boolean NOT NULL DEFAULT false,
    created_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (plan_id, version_number)
);

CREATE UNIQUE INDEX plan_versions_one_active_per_plan
    ON plan_versions (plan_id) WHERE is_active;

CREATE INDEX plan_versions_by_client ON plan_versions (client_uuid, plan_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON plan_versions TO anon;
ALTER TABLE plan_versions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Scope plan_versions to client_uuid" ON plan_versions FOR ALL
    USING (client_uuid = (current_setting('request.headers', true)::json->>'x-client-uuid')::uuid)
    WITH CHECK (client_uuid = (current_setting('request.headers', true)::json->>'x-client-uuid')::uuid);

-- ============================================================
-- workout_days
-- ============================================================
CREATE TABLE workout_days (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    plan_version_id uuid NOT NULL REFERENCES plan_versions(id) ON DELETE CASCADE,
    client_uuid uuid NOT NULL,
    name text NOT NULL,
    order_index integer NOT NULL,
    is_rest boolean NOT NULL DEFAULT false,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX workout_days_by_version ON workout_days (plan_version_id, order_index);
CREATE INDEX workout_days_by_client ON workout_days (client_uuid);

GRANT SELECT, INSERT, UPDATE, DELETE ON workout_days TO anon;
ALTER TABLE workout_days ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Scope workout_days to client_uuid" ON workout_days FOR ALL
    USING (client_uuid = (current_setting('request.headers', true)::json->>'x-client-uuid')::uuid)
    WITH CHECK (client_uuid = (current_setting('request.headers', true)::json->>'x-client-uuid')::uuid);

-- ============================================================
-- exercises
-- ============================================================
CREATE TABLE exercises (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    workout_day_id uuid NOT NULL REFERENCES workout_days(id) ON DELETE CASCADE,
    client_uuid uuid NOT NULL,
    name text NOT NULL,
    muscle_group text NOT NULL,
    type text NOT NULL CHECK (type IN ('compound', 'isolation')),
    order_index integer NOT NULL,
    default_sets integer NOT NULL DEFAULT 2,
    previous_exercise_id uuid REFERENCES exercises(id) ON DELETE SET NULL,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX exercises_by_day ON exercises (workout_day_id, order_index);
CREATE INDEX exercises_by_client ON exercises (client_uuid);
CREATE INDEX exercises_by_previous ON exercises (previous_exercise_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON exercises TO anon;
ALTER TABLE exercises ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Scope exercises to client_uuid" ON exercises FOR ALL
    USING (client_uuid = (current_setting('request.headers', true)::json->>'x-client-uuid')::uuid)
    WITH CHECK (client_uuid = (current_setting('request.headers', true)::json->>'x-client-uuid')::uuid);

-- ============================================================
-- superset_groups
-- ============================================================
CREATE TABLE superset_groups (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    workout_day_id uuid NOT NULL REFERENCES workout_days(id) ON DELETE CASCADE,
    client_uuid uuid NOT NULL,
    exercise_ids uuid[] NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX superset_groups_by_day ON superset_groups (workout_day_id);
CREATE INDEX superset_groups_by_client ON superset_groups (client_uuid);

GRANT SELECT, INSERT, UPDATE, DELETE ON superset_groups TO anon;
ALTER TABLE superset_groups ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Scope superset_groups to client_uuid" ON superset_groups FOR ALL
    USING (client_uuid = (current_setting('request.headers', true)::json->>'x-client-uuid')::uuid)
    WITH CHECK (client_uuid = (current_setting('request.headers', true)::json->>'x-client-uuid')::uuid);

-- ============================================================
-- sessions
-- ============================================================
CREATE TABLE sessions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    client_uuid uuid NOT NULL,
    plan_version_id uuid NOT NULL REFERENCES plan_versions(id) ON DELETE RESTRICT,
    workout_day_id uuid NOT NULL REFERENCES workout_days(id) ON DELETE RESTRICT,
    started_at timestamptz NOT NULL DEFAULT now(),
    ended_at timestamptz,
    foreground_ms bigint NOT NULL DEFAULT 0,
    background_ms bigint NOT NULL DEFAULT 0
);

CREATE INDEX sessions_by_client_started ON sessions (client_uuid, started_at DESC);
CREATE INDEX sessions_by_day ON sessions (workout_day_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON sessions TO anon;
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Scope sessions to client_uuid" ON sessions FOR ALL
    USING (client_uuid = (current_setting('request.headers', true)::json->>'x-client-uuid')::uuid)
    WITH CHECK (client_uuid = (current_setting('request.headers', true)::json->>'x-client-uuid')::uuid);

-- ============================================================
-- session_sets
-- ============================================================
CREATE TABLE session_sets (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id uuid NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    exercise_id uuid NOT NULL REFERENCES exercises(id) ON DELETE RESTRICT,
    client_uuid uuid NOT NULL,
    set_order integer NOT NULL,
    weight numeric(7,2),
    reps integer,
    rpe numeric(3,1) CHECK (rpe IS NULL OR (rpe >= 1 AND rpe <= 10)),
    is_warmup boolean NOT NULL DEFAULT false,
    is_skipped boolean NOT NULL DEFAULT false,
    note text,
    logged_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX session_sets_by_session ON session_sets (session_id, set_order);
CREATE INDEX session_sets_by_exercise ON session_sets (exercise_id, logged_at DESC);
CREATE INDEX session_sets_by_client ON session_sets (client_uuid);

GRANT SELECT, INSERT, UPDATE, DELETE ON session_sets TO anon;
ALTER TABLE session_sets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Scope session_sets to client_uuid" ON session_sets FOR ALL
    USING (client_uuid = (current_setting('request.headers', true)::json->>'x-client-uuid')::uuid)
    WITH CHECK (client_uuid = (current_setting('request.headers', true)::json->>'x-client-uuid')::uuid);

-- ============================================================
-- goals
-- ============================================================
CREATE TABLE goals (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    client_uuid uuid NOT NULL,
    exercise_id uuid REFERENCES exercises(id) ON DELETE CASCADE,
    muscle_group text,
    target_weight numeric(7,2),
    target_reps integer,
    weekly_volume_target numeric(10,2),
    created_at timestamptz NOT NULL DEFAULT now(),
    CHECK (
        (exercise_id IS NOT NULL AND (target_weight IS NOT NULL OR target_reps IS NOT NULL))
        OR (muscle_group IS NOT NULL AND weekly_volume_target IS NOT NULL)
    )
);

CREATE INDEX goals_by_client ON goals (client_uuid);
CREATE INDEX goals_by_exercise ON goals (exercise_id);
CREATE INDEX goals_by_muscle_group ON goals (client_uuid, muscle_group);

GRANT SELECT, INSERT, UPDATE, DELETE ON goals TO anon;
ALTER TABLE goals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Scope goals to client_uuid" ON goals FOR ALL
    USING (client_uuid = (current_setting('request.headers', true)::json->>'x-client-uuid')::uuid)
    WITH CHECK (client_uuid = (current_setting('request.headers', true)::json->>'x-client-uuid')::uuid);
