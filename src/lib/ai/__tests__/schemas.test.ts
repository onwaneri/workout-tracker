import { describe, it, expect } from 'vitest'
import {
  aiPlanEditResultSchema,
  exerciseSwapResponseSchema,
  planEditActionSchema,
} from '../schemas'

describe('aiPlanEditResultSchema', () => {
  it('validates a valid diff response', () => {
    const input = {
      type: 'diff',
      changes: [
        {
          action: 'add',
          day_index: 0,
          position: 2,
          exercise: {
            name: 'Barbell Bench Press',
            muscle_group: 'Chest',
            type: 'compound',
            default_sets: 3,
          },
        },
        {
          action: 'remove',
          day_index: 0,
          exercise_name: 'Incline DB Press',
        },
      ],
      summary: 'Swapped Incline DB Press for Barbell Bench Press',
    }
    const result = aiPlanEditResultSchema.parse(input)
    expect(result.type).toBe('diff')
    if (result.type === 'diff') {
      expect(result.changes).toHaveLength(2)
      expect(result.summary).toBeTruthy()
    }
  })

  it('validates a clarification response', () => {
    const input = {
      type: 'clarification',
      question: 'Do you want a flat or incline barbell variant?',
    }
    const result = aiPlanEditResultSchema.parse(input)
    expect(result.type).toBe('clarification')
    if (result.type === 'clarification') {
      expect(result.question).toBeTruthy()
    }
  })

  it('rejects invalid diff with missing exercise fields', () => {
    const input = {
      type: 'diff',
      changes: [
        {
          action: 'add',
          day_index: 0,
          position: 2,
          exercise: {
            name: 'Barbell Bench Press',
            // missing muscle_group, type, default_sets
          },
        },
      ],
      summary: 'Added exercise',
    }
    expect(() => aiPlanEditResultSchema.parse(input)).toThrow()
  })

  it('rejects unknown action types', () => {
    const input = {
      type: 'diff',
      changes: [{ action: 'delete', day_index: 0, exercise_name: 'X' }],
      summary: 'test',
    }
    expect(() => aiPlanEditResultSchema.parse(input)).toThrow()
  })

  it('rejects invalid type at top level', () => {
    const input = { type: 'unknown', data: {} }
    expect(() => aiPlanEditResultSchema.parse(input)).toThrow()
  })

  it('validates edit action with partial changes', () => {
    const input = {
      action: 'edit',
      day_index: 1,
      exercise_name: 'Pull-Ups',
      changes: { default_sets: 4 },
    }
    const result = planEditActionSchema.parse(input)
    expect(result.action).toBe('edit')
  })

  it('validates reorder action', () => {
    const input = {
      action: 'reorder',
      day_index: 0,
      exercise_name: 'Bicep Curl',
      new_position: 5,
    }
    const result = planEditActionSchema.parse(input)
    expect(result.action).toBe('reorder')
  })

  it('rejects add with default_sets out of range', () => {
    const input = {
      action: 'add',
      day_index: 0,
      position: 0,
      exercise: {
        name: 'Test',
        muscle_group: 'Test',
        type: 'compound',
        default_sets: 0, // must be >= 1
      },
    }
    expect(() => planEditActionSchema.parse(input)).toThrow()
  })

  it('rejects add with default_sets too high', () => {
    const input = {
      action: 'add',
      day_index: 0,
      position: 0,
      exercise: {
        name: 'Test',
        muscle_group: 'Test',
        type: 'isolation',
        default_sets: 11, // must be <= 10
      },
    }
    expect(() => planEditActionSchema.parse(input)).toThrow()
  })
})

describe('exerciseSwapResponseSchema', () => {
  it('validates a valid 3-suggestion response', () => {
    const input = {
      suggestions: [
        {
          name: 'Flat Barbell Bench',
          muscle_group: 'Chest',
          type: 'compound',
          rationale: 'Direct replacement for incline, targets same muscles.',
        },
        {
          name: 'Dumbbell Floor Press',
          muscle_group: 'Chest',
          type: 'compound',
          rationale: 'Chest press variant with reduced shoulder stress.',
        },
        {
          name: 'Machine Chest Press',
          muscle_group: 'Chest',
          type: 'compound',
          rationale: 'Simplest substitution with similar movement pattern.',
        },
      ],
    }
    const result = exerciseSwapResponseSchema.parse(input)
    expect(result.suggestions).toHaveLength(3)
    expect(result.suggestions[0].name).toBe('Flat Barbell Bench')
  })

  it('rejects empty suggestions array', () => {
    const input = { suggestions: [] }
    expect(() => exerciseSwapResponseSchema.parse(input)).toThrow()
  })

  it('rejects suggestion with invalid type', () => {
    const input = {
      suggestions: [
        {
          name: 'Test',
          muscle_group: 'Test',
          type: 'hybrid', // invalid
          rationale: 'test',
        },
      ],
    }
    expect(() => exerciseSwapResponseSchema.parse(input)).toThrow()
  })

  it('rejects suggestion missing rationale', () => {
    const input = {
      suggestions: [
        {
          name: 'Test',
          muscle_group: 'Test',
          type: 'compound',
          // missing rationale
        },
      ],
    }
    expect(() => exerciseSwapResponseSchema.parse(input)).toThrow()
  })
})
