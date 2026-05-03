import { describe, it, expect } from 'vitest'
import { applyAiDiff } from '../applyAiDiff'
import type { EditedPlan } from '../snapshotPlan'
import type { PlanEditAction } from '@/lib/ai/schemas'

const basePlan: EditedPlan = {
  planId: 'plan-1',
  prevPlanVersionId: 'pv-1',
  prevVersionNumber: 1,
  days: [
    {
      id: 'day-1',
      name: 'Upper A',
      is_rest: false,
      exercises: [
        { id: 'ex-1', name: 'Incline DB Press', muscle_group: 'Chest', type: 'compound', default_sets: 2 },
        { id: 'ex-2', name: 'Pull-Ups', muscle_group: 'Lats', type: 'compound', default_sets: 2 },
        { id: 'ex-3', name: 'Bicep Curl', muscle_group: 'Biceps', type: 'isolation', default_sets: 2 },
      ],
    },
    {
      id: 'day-2',
      name: 'Lower A',
      is_rest: false,
      exercises: [
        { id: 'ex-4', name: 'Leg Press', muscle_group: 'Quads', type: 'compound', default_sets: 2 },
        { id: 'ex-5', name: 'Calf Raise', muscle_group: 'Calves', type: 'isolation', default_sets: 2 },
      ],
    },
    {
      name: 'Rest',
      is_rest: true,
      exercises: [],
    },
  ],
}

describe('applyAiDiff', () => {
  it('applies add action correctly', () => {
    const actions: PlanEditAction[] = [
      {
        action: 'add',
        day_index: 0,
        position: 1,
        exercise: { name: 'Dips', muscle_group: 'Triceps', type: 'compound', default_sets: 3 },
      },
    ]
    const result = applyAiDiff(basePlan, actions)
    expect(result.days[0].exercises).toHaveLength(4)
    expect(result.days[0].exercises[1].name).toBe('Dips')
    expect(result.days[0].exercises[1].default_sets).toBe(3)
  })

  it('applies remove action correctly', () => {
    const actions: PlanEditAction[] = [
      { action: 'remove', day_index: 0, exercise_name: 'Pull-Ups' },
    ]
    const result = applyAiDiff(basePlan, actions)
    expect(result.days[0].exercises).toHaveLength(2)
    expect(result.days[0].exercises.find((e) => e.name === 'Pull-Ups')).toBeUndefined()
  })

  it('applies edit action correctly', () => {
    const actions: PlanEditAction[] = [
      {
        action: 'edit',
        day_index: 0,
        exercise_name: 'Incline DB Press',
        changes: { name: 'Flat Barbell Bench', default_sets: 3 },
      },
    ]
    const result = applyAiDiff(basePlan, actions)
    expect(result.days[0].exercises[0].name).toBe('Flat Barbell Bench')
    expect(result.days[0].exercises[0].default_sets).toBe(3)
    // unchanged fields remain
    expect(result.days[0].exercises[0].muscle_group).toBe('Chest')
    expect(result.days[0].exercises[0].type).toBe('compound')
  })

  it('applies reorder action correctly', () => {
    const actions: PlanEditAction[] = [
      { action: 'reorder', day_index: 0, exercise_name: 'Bicep Curl', new_position: 0 },
    ]
    const result = applyAiDiff(basePlan, actions)
    expect(result.days[0].exercises[0].name).toBe('Bicep Curl')
    expect(result.days[0].exercises[1].name).toBe('Incline DB Press')
    expect(result.days[0].exercises[2].name).toBe('Pull-Ups')
  })

  it('applies multiple actions in sequence', () => {
    const actions: PlanEditAction[] = [
      { action: 'remove', day_index: 0, exercise_name: 'Incline DB Press' },
      {
        action: 'add',
        day_index: 0,
        position: 0,
        exercise: { name: 'Barbell Bench', muscle_group: 'Chest', type: 'compound', default_sets: 2 },
      },
      {
        action: 'add',
        day_index: 0,
        position: 3,
        exercise: { name: 'Back-Off Set Bench', muscle_group: 'Chest', type: 'compound', default_sets: 1 },
      },
    ]
    const result = applyAiDiff(basePlan, actions)
    expect(result.days[0].exercises[0].name).toBe('Barbell Bench')
    // After remove of Incline DB Press (originally idx 0), array is [Pull-Ups, Bicep Curl]
    // Then add Barbell Bench at pos 0: [Barbell Bench, Pull-Ups, Bicep Curl]
    // Then add Back-Off at pos 3: [Barbell Bench, Pull-Ups, Bicep Curl, Back-Off Set Bench]
    expect(result.days[0].exercises).toHaveLength(4)
    expect(result.days[0].exercises[3].name).toBe('Back-Off Set Bench')
  })

  it('throws on invalid day_index', () => {
    const actions: PlanEditAction[] = [
      { action: 'remove', day_index: 99, exercise_name: 'Test' },
    ]
    expect(() => applyAiDiff(basePlan, actions)).toThrow(/Invalid day_index/)
  })

  it('throws on remove of non-existent exercise', () => {
    const actions: PlanEditAction[] = [
      { action: 'remove', day_index: 0, exercise_name: 'Non-Existent Exercise' },
    ]
    expect(() => applyAiDiff(basePlan, actions)).toThrow(/not found/)
  })

  it('case-insensitive exercise name matching for remove', () => {
    const actions: PlanEditAction[] = [
      { action: 'remove', day_index: 0, exercise_name: 'pull-ups' },
    ]
    const result = applyAiDiff(basePlan, actions)
    expect(result.days[0].exercises).toHaveLength(2)
  })

  it('does not mutate the original plan', () => {
    const actions: PlanEditAction[] = [
      { action: 'remove', day_index: 0, exercise_name: 'Pull-Ups' },
    ]
    applyAiDiff(basePlan, actions)
    expect(basePlan.days[0].exercises).toHaveLength(3)
  })

  it('add at position beyond end clamps to last position', () => {
    const actions: PlanEditAction[] = [
      {
        action: 'add',
        day_index: 1,
        position: 100,
        exercise: { name: 'New Exercise', muscle_group: 'Test', type: 'isolation', default_sets: 2 },
      },
    ]
    const result = applyAiDiff(basePlan, actions)
    expect(result.days[1].exercises[result.days[1].exercises.length - 1].name).toBe('New Exercise')
  })

  it('handles action on a different day correctly', () => {
    const actions: PlanEditAction[] = [
      { action: 'remove', day_index: 1, exercise_name: 'Calf Raise' },
    ]
    const result = applyAiDiff(basePlan, actions)
    expect(result.days[1].exercises).toHaveLength(1)
    // Day 0 is unchanged
    expect(result.days[0].exercises).toHaveLength(3)
  })
})
