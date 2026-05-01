import { useEffect, useMemo, useRef } from 'react'
import type { WorkoutDay } from '@/lib/supabase/database.types'

export type CycleChip = { offset: number; day: WorkoutDay; key: string }

const offsetLabel = (offset: number): string => {
  if (offset === 0) return 'Next'
  return offset > 0 ? `+${offset}` : `${offset}`
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
    // One past day for backward scroll, then a full cycle forward starting at "Next".
    for (let offset = -1; offset < workoutDays.length; offset++) {
      const idx = ((nextIdx + offset) % workoutDays.length + workoutDays.length) % workoutDays.length
      out.push({ offset, day: workoutDays[idx], key: `${offset}-${workoutDays[idx].id}` })
    }
    return out
  }, [workoutDays, nextDayId])

  const activeOffset = useMemo(() => {
    if (selectedDayId == null) return 0
    const match = chips.find((c) => c.offset >= 0 && c.day.id === selectedDayId)
    return match?.offset ?? 0
  }, [chips, selectedDayId])

  useEffect(() => {
    const el = chipRefs.current.get(activeOffset)
    if (el) el.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' })
  }, [activeOffset])

  // Center the "Next" chip on first mount without smooth scroll so it doesn't animate from 0.
  useEffect(() => {
    const el = chipRefs.current.get(0)
    if (el) el.scrollIntoView({ inline: 'center', block: 'nearest' })
  }, [])

  if (chips.length === 0) return null

  return (
    <div
      ref={scrollRef}
      className="-mx-4 overflow-x-auto pb-1"
      style={{ scrollSnapType: 'x mandatory', WebkitOverflowScrolling: 'touch' }}
    >
      <div className="flex gap-2 px-4">
        {chips.map((chip) => {
          const isActive = chip.offset === activeOffset
          return (
            <button
              key={chip.key}
              ref={(el) => {
                if (el) chipRefs.current.set(chip.offset, el)
              }}
              onClick={() => onSelect(chip.offset, chip.day)}
              style={{ scrollSnapAlign: 'center' }}
              className={[
                'shrink-0 min-h-[44px] px-4 rounded-full border text-sm whitespace-nowrap',
                isActive
                  ? 'border-[color:var(--color-accent)] bg-[color:var(--color-accent)]/15 text-[color:var(--color-text)]'
                  : 'border-[color:var(--color-border)] bg-[color:var(--color-surface)] text-[color:var(--color-muted)]',
              ].join(' ')}
            >
              <span className="text-[10px] uppercase tracking-wide opacity-75 mr-2">{offsetLabel(chip.offset)}</span>
              <span className="font-medium">{chip.day.name}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
