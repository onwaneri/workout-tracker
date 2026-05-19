export type ExerciseTarget = {
  weight: number | null
  reps: number | null
  basis: 'progression' | 'hold' | 'no-rpe' | 'override'
}

export type TargetOverride = {
  weight: number | null
  reps: number | null
  source: 'manual' | 'ai'
  createdAt: number
}

type LastSet = {
  weight: number | null
  reps: number | null
  rpe: number | null
}

type LastSetWithTimestamp = LastSet & { logged_at: string }

const WEIGHT_INCREMENT = 2.5

/**
 * Compute the next target from the most recent working set using
 * deterministic progressive overload rules.
 *
 * - RPE < 9: increase weight by 2.5 lb, keep reps
 * - RPE 9-10: keep weight, increase reps by 1
 * - No RPE: suggest same weight/reps
 * - Bodyweight (null weight): increase reps only
 * - No history: return null
 */
export function computeNextTarget(lastSet: LastSet | null): ExerciseTarget | null {
  if (!lastSet) return null

  const { weight, reps, rpe } = lastSet

  // No RPE recorded — suggest same
  if (rpe == null) {
    return { weight, reps, basis: 'no-rpe' }
  }

  // Bodyweight exercise (null weight) — increase reps only
  if (weight == null) {
    return {
      weight: null,
      reps: reps != null ? reps + 1 : reps,
      basis: rpe < 9 ? 'progression' : 'hold',
    }
  }

  // RPE < 9 — room to grow: increase weight
  if (rpe < 9) {
    return {
      weight: weight + WEIGHT_INCREMENT,
      reps,
      basis: 'progression',
    }
  }

  // RPE 9-10 — near failure: keep weight, increase reps
  return {
    weight,
    reps: reps != null ? reps + 1 : reps,
    basis: 'hold',
  }
}

/**
 * Resolve the effective target for an exercise, checking for a fresh
 * override first, then falling back to computed progression.
 */
export function resolveTarget(
  exerciseName: string,
  lastSet: LastSetWithTimestamp | null,
  overrides: Record<string, TargetOverride>,
): ExerciseTarget | null {
  const key = exerciseName.trim().toLowerCase()
  const override = overrides[key]

  if (override) {
    // Override is fresh if no new data has been logged since it was created
    const isFresh = !lastSet || override.createdAt > new Date(lastSet.logged_at).getTime()
    if (isFresh) {
      return {
        weight: override.weight,
        reps: override.reps,
        basis: 'override',
      }
    }
  }

  return computeNextTarget(lastSet)
}
