import { useEffect, useMemo, useRef } from 'react'
import type { WorkoutDay } from '@/lib/supabase/database.types'

export type CycleChip = { offset: number; day: WorkoutDay; key: string }

const offsetLabel = (offset: number): string => {
  if (offset === 0) return 'Next'
  return offset > 0 ? `+${offset}` : `${offset}`
}

function dayAbbrev(name: string): string {
  const n = name.toLowerCase()
  if (n.includes('push')) return 'P'
  if (n.includes('pull')) return 'L'
  if (n.includes('squat')) return 'Q'
  if (n.includes('hinge')) return 'H'
  if (n.includes('upper')) return 'U'
  if (n.includes('lower')) return 'Lo'
  return name.charAt(0).toUpperCase()
}

export function CycleStrip({
  workoutDays,
  nextDayId,
  selectedDayId,
  onSelect,
}: {
  workoutDays: WorkoutDay[]
  nextDayId: string
  selectedDayId: string | null
  onSelect: (offset: number, day: WorkoutDay) => void
}) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const chipRefs = useRef<Map<number, HTMLButtonElement>>(new Map())

  const chips = useMemo<CycleChip[]>(() => {
    if (workoutDays.length === 0) return []
    const nextIdx = workoutDays.findIndex((d) => d.id === nextDayId)
    if (nextIdx === -1) return []
    const out: CycleChip[] = []
    for (let offset = -1; offset < workoutDays.length; offset++) {
      const idx = ((nextIdx + offset) % workoutDays.length + workoutDays.length) % workoutDays.length
      out.push({ offset, day: workoutDays[idx], key: `${offset}-${workoutDays[idx].id}` })
    }
    return out
  }, [workoutDays, nextDayId])

  useEffect(() => {
    const currentOffsets = new Set(chips.map((c) => c.offset))
    for (const offset of chipRefs.current.keys()) {
      if (!currentOffsets.has(offset)) chipRefs.current.delete(offset)
    }
  }, [chips])

  const activeOffset = useMemo(() => {
    if (selectedDayId == null) return 0
    const match = chips.find((c) => c.offset >= 0 && c.day.id === selectedDayId)
    return match?.offset ?? 0
  }, [chips, selectedDayId])

  useEffect(() => {
    const el = chipRefs.current.get(activeOffset)
    if (el) el.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' })
  }, [activeOffset])

  useEffect(() => {
    const el = chipRefs.current.get(0)
    if (el) el.scrollIntoView({ inline: 'center', block: 'nearest' })
  }, [])

  if (chips.length === 0) return null

  return (
    <div
      ref={scrollRef}
      className="-mx-5"
      style={{ overflowX: 'auto', scrollSnapType: 'x mandatory', WebkitOverflowScrolling: 'touch' }}
    >
      <div style={{ display: 'flex', gap: 6, padding: '0 20px' }}>
        {chips.map((chip) => {
          const isActive = chip.offset === activeOffset
          const isPast = chip.offset < 0

          return (
            <button
              key={chip.key}
              ref={(el) => {
                if (el) chipRefs.current.set(chip.offset, el)
              }}
              onClick={() => onSelect(chip.offset, chip.day)}
              style={{
                scrollSnapAlign: 'center',
                flexShrink: 0,
                minHeight: 56,
                padding: '8px 10px',
                borderRadius: 14,
                border: isActive ? 'none' : '1px solid var(--color-border)',
                background: isActive ? 'var(--color-accent)' : isPast ? 'transparent' : 'var(--color-surface)',
                color: isActive ? 'var(--color-accent-ink)' : isPast ? 'var(--color-faint)' : 'var(--color-text)',
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3,
                cursor: 'pointer',
                opacity: isPast ? 0.5 : 1,
                minWidth: 44,
              }}
            >
              <span style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 9,
                letterSpacing: '0.06em',
                opacity: 0.7,
              }}>
                {offsetLabel(chip.offset)}
              </span>
              <span style={{
                fontFamily: 'var(--font-display)',
                fontSize: 13,
                fontWeight: 600,
                letterSpacing: '-0.02em',
              }}>
                {dayAbbrev(chip.day.name)}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
