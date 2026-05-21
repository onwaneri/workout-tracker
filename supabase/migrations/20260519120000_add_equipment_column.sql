ALTER TABLE exercises ADD COLUMN equipment text NOT NULL DEFAULT 'barbell'
  CHECK (equipment IN ('barbell', 'dumbbell', 'machine', 'cable', 'bodyweight'));
