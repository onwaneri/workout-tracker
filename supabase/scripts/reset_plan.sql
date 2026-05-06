-- Reset the plan to the original Upper/Lower/Rest/Upper/Lower2/Rest/Rest structure.
-- This deletes all existing plan data and recreates it from scratch.
-- WARNING: This will break links from existing sessions to their workout_days.

BEGIN;

-- Get the client_uuid (there should be only one user)
DO $$
DECLARE
  v_client_uuid uuid;
  v_plan_id uuid;
  v_pv_id uuid;
  v_day_id uuid;
  v_next_version int;
BEGIN
  SELECT client_uuid INTO v_client_uuid FROM plans LIMIT 1;
  IF v_client_uuid IS NULL THEN
    RAISE EXCEPTION 'No plan found';
  END IF;

  SELECT id INTO v_plan_id FROM plans WHERE client_uuid = v_client_uuid LIMIT 1;

  -- Deactivate current version
  UPDATE plan_versions SET is_active = false WHERE plan_id = v_plan_id AND is_active = true;

  -- Get next version number
  SELECT COALESCE(MAX(version_number), 0) + 1 INTO v_next_version FROM plan_versions WHERE plan_id = v_plan_id;

  -- Create new plan version
  INSERT INTO plan_versions (plan_id, client_uuid, version_number, is_active)
  VALUES (v_plan_id, v_client_uuid, v_next_version, true)
  RETURNING id INTO v_pv_id;

  -- Day 0: Upper
  INSERT INTO workout_days (plan_version_id, client_uuid, name, order_index, is_rest)
  VALUES (v_pv_id, v_client_uuid, 'Upper', 0, false) RETURNING id INTO v_day_id;

  INSERT INTO exercises (workout_day_id, client_uuid, name, muscle_group, type, order_index, default_sets) VALUES
    (v_day_id, v_client_uuid, 'Incline Smith Machine Bench', 'Chest / Front Delt', 'compound', 0, 2),
    (v_day_id, v_client_uuid, 'Skullcrushers', 'Triceps (long head)', 'isolation', 1, 2),
    (v_day_id, v_client_uuid, 'Cable Pushdown', 'Triceps (lateral/medial head)', 'isolation', 2, 2),
    (v_day_id, v_client_uuid, 'Upright Row Machine', 'Lateral Delt / Traps', 'compound', 3, 2),
    (v_day_id, v_client_uuid, 'Pull-Ups', 'Lats / Back', 'compound', 4, 2),
    (v_day_id, v_client_uuid, 'Bicep Curl', 'Biceps', 'isolation', 5, 2),
    (v_day_id, v_client_uuid, 'Brachialis Curl', 'Brachialis', 'isolation', 6, 2),
    (v_day_id, v_client_uuid, 'Lateral Raise', 'Lateral Delt', 'isolation', 7, 2),
    (v_day_id, v_client_uuid, 'Rear Delt Fly', 'Rear Delt', 'isolation', 8, 2);

  -- Day 1: Lower — Quad-Focused
  INSERT INTO workout_days (plan_version_id, client_uuid, name, order_index, is_rest)
  VALUES (v_pv_id, v_client_uuid, 'Lower — Quad-Focused', 1, false) RETURNING id INTO v_day_id;

  INSERT INTO exercises (workout_day_id, client_uuid, name, muscle_group, type, order_index, default_sets) VALUES
    (v_day_id, v_client_uuid, 'Leg Press', 'Quads', 'compound', 0, 2),
    (v_day_id, v_client_uuid, 'Bulgarian Split Squat', 'Quads / Glutes', 'compound', 1, 2),
    (v_day_id, v_client_uuid, 'Sumo RDL', 'Hamstrings / Glutes', 'compound', 2, 2),
    (v_day_id, v_client_uuid, 'Calf Raise', 'Calves', 'isolation', 3, 2);

  -- Day 2: Rest
  INSERT INTO workout_days (plan_version_id, client_uuid, name, order_index, is_rest)
  VALUES (v_pv_id, v_client_uuid, 'Rest', 2, true);

  -- Day 3: Upper (same exercises as Day 0)
  INSERT INTO workout_days (plan_version_id, client_uuid, name, order_index, is_rest)
  VALUES (v_pv_id, v_client_uuid, 'Upper', 3, false) RETURNING id INTO v_day_id;

  INSERT INTO exercises (workout_day_id, client_uuid, name, muscle_group, type, order_index, default_sets) VALUES
    (v_day_id, v_client_uuid, 'Incline Smith Machine Bench', 'Chest / Front Delt', 'compound', 0, 2),
    (v_day_id, v_client_uuid, 'Skullcrushers', 'Triceps (long head)', 'isolation', 1, 2),
    (v_day_id, v_client_uuid, 'Cable Pushdown', 'Triceps (lateral/medial head)', 'isolation', 2, 2),
    (v_day_id, v_client_uuid, 'Upright Row Machine', 'Lateral Delt / Traps', 'compound', 3, 2),
    (v_day_id, v_client_uuid, 'Pull-Ups', 'Lats / Back', 'compound', 4, 2),
    (v_day_id, v_client_uuid, 'Bicep Curl', 'Biceps', 'isolation', 5, 2),
    (v_day_id, v_client_uuid, 'Brachialis Curl', 'Brachialis', 'isolation', 6, 2),
    (v_day_id, v_client_uuid, 'Lateral Raise', 'Lateral Delt', 'isolation', 7, 2),
    (v_day_id, v_client_uuid, 'Rear Delt Fly', 'Rear Delt', 'isolation', 8, 2);

  -- Day 4: Lower — Posterior Chain
  INSERT INTO workout_days (plan_version_id, client_uuid, name, order_index, is_rest)
  VALUES (v_pv_id, v_client_uuid, 'Lower — Posterior Chain', 4, false) RETURNING id INTO v_day_id;

  INSERT INTO exercises (workout_day_id, client_uuid, name, muscle_group, type, order_index, default_sets) VALUES
    (v_day_id, v_client_uuid, 'RDL', 'Hamstrings', 'compound', 0, 2),
    (v_day_id, v_client_uuid, 'Leg Curl', 'Hamstrings', 'isolation', 1, 2),
    (v_day_id, v_client_uuid, 'Cable Kickback', 'Glutes', 'isolation', 2, 2),
    (v_day_id, v_client_uuid, 'Adductor Machine', 'Adductors', 'isolation', 3, 2),
    (v_day_id, v_client_uuid, 'Calf Raise', 'Calves', 'isolation', 4, 2);

  -- Day 5: Rest
  INSERT INTO workout_days (plan_version_id, client_uuid, name, order_index, is_rest)
  VALUES (v_pv_id, v_client_uuid, 'Rest', 5, true);

  -- Day 6: Rest
  INSERT INTO workout_days (plan_version_id, client_uuid, name, order_index, is_rest)
  VALUES (v_pv_id, v_client_uuid, 'Rest', 6, true);

  RAISE NOTICE 'Plan reset complete. New plan_version_id: %', v_pv_id;
END $$;

COMMIT;
