import type { PlanEditAction } from '@/lib/ai/schemas'
import type { EditedDay, EditedExercise, EditedPlan } from './snapshotPlan'
import type { Exercise, ExerciseType, EquipmentType } from '@/lib/supabase/database.types'
import { findMatchingExerciseId } from '@/lib/queries/exercises'

/**
 * Applies a list of AI-generated plan edit actions to an EditedPlan draft.
 * Returns a new EditedPlan (immutable). Throws on invalid references.
 */
export function applyAiDiff(plan: EditedPlan, actions: PlanEditAction[], allExercises?: Exercise[]): EditedPlan {
  // Deep clone the days array to avoid mutation
  let days: EditedDay[] = plan.days.map((d) => ({
    ...d,
    exercises: d.exercises.map((e) => ({ ...e })),
  }))

  for (const action of actions) {
    const day = days[action.day_index]
    if (!day) {
      throw new Error(`Invalid day_index ${action.day_index} — plan has ${days.length} days`)
    }

    switch (action.action) {
      case 'add': {
        const newEx: EditedExercise = {
          name: action.exercise.name,
          muscle_group: action.exercise.muscle_group,
          type: action.exercise.type as ExerciseType,
          equipment: action.exercise.equipment as EquipmentType,
          default_sets: action.exercise.default_sets,
          prevExerciseId: allExercises ? findMatchingExerciseId(action.exercise.name, allExercises) : undefined,
        }
        const pos = Math.min(action.position, day.exercises.length)
        day.exercises.splice(pos, 0, newEx)
        break
      }

      case 'remove': {
        const idx = day.exercises.findIndex(
          (e) => e.name.toLowerCase() === action.exercise_name.toLowerCase(),
        )
        if (idx === -1) {
          throw new Error(
            `Cannot remove "${action.exercise_name}" — not found in ${day.name}`,
          )
        }
        day.exercises.splice(idx, 1)
        break
      }

      case 'edit': {
        const idx = day.exercises.findIndex(
          (e) => e.name.toLowerCase() === action.exercise_name.toLowerCase(),
        )
        if (idx === -1) {
          throw new Error(
            `Cannot edit "${action.exercise_name}" — not found in ${day.name}`,
          )
        }
        const ex = day.exercises[idx]
        if (action.changes.name !== undefined) ex.name = action.changes.name
        if (action.changes.muscle_group !== undefined) ex.muscle_group = action.changes.muscle_group
        if (action.changes.type !== undefined) ex.type = action.changes.type as ExerciseType
        if (action.changes.equipment !== undefined) ex.equipment = action.changes.equipment as EquipmentType
        if (action.changes.default_sets !== undefined) ex.default_sets = action.changes.default_sets
        break
      }

      case 'reorder': {
        const idx = day.exercises.findIndex(
          (e) => e.name.toLowerCase() === action.exercise_name.toLowerCase(),
        )
        if (idx === -1) {
          throw new Error(
            `Cannot reorder "${action.exercise_name}" — not found in ${day.name}`,
          )
        }
        const [ex] = day.exercises.splice(idx, 1)
        const newPos = Math.min(action.new_position, day.exercises.length)
        day.exercises.splice(newPos, 0, ex)
        break
      }
    }

    // Update the days reference to pick up mutations from splice
    days = days.map((d, i) => (i === action.day_index ? { ...day } : d))
  }

  return { ...plan, days }
}
