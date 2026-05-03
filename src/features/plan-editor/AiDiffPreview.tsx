import { Button } from '@/components/Button'
import type { PlanEditAction } from '@/lib/ai/schemas'
import type { EditedPlan } from './snapshotPlan'

function ActionDescription({ action, draft }: { action: PlanEditAction; draft: EditedPlan }) {
  const dayName = draft.days[action.day_index]?.name ?? `Day ${action.day_index + 1}`

  switch (action.action) {
    case 'add':
      return (
        <div className="flex items-start gap-2">
          <span className="text-green-400 font-mono text-xs mt-0.5">+</span>
          <div>
            <span className="text-sm font-medium">{action.exercise.name}</span>
            <span className="text-xs text-[color:var(--color-muted)] ml-2">
              {dayName} · pos {action.position + 1} · {action.exercise.muscle_group} · {action.exercise.type}
            </span>
          </div>
        </div>
      )
    case 'remove':
      return (
        <div className="flex items-start gap-2">
          <span className="text-red-400 font-mono text-xs mt-0.5">−</span>
          <div>
            <span className="text-sm font-medium line-through text-red-300/80">{action.exercise_name}</span>
            <span className="text-xs text-[color:var(--color-muted)] ml-2">{dayName}</span>
          </div>
        </div>
      )
    case 'edit': {
      const changes = Object.entries(action.changes)
        .filter(([, v]) => v !== undefined)
        .map(([k, v]) => `${k}: ${String(v)}`)
        .join(', ')
      return (
        <div className="flex items-start gap-2">
          <span className="text-yellow-400 font-mono text-xs mt-0.5">~</span>
          <div>
            <span className="text-sm font-medium">{action.exercise_name}</span>
            <span className="text-xs text-[color:var(--color-muted)] ml-2">{dayName}</span>
            <div className="text-xs text-yellow-300/70 mt-0.5">{changes}</div>
          </div>
        </div>
      )
    }
    case 'reorder':
      return (
        <div className="flex items-start gap-2">
          <span className="text-blue-400 font-mono text-xs mt-0.5">↕</span>
          <div>
            <span className="text-sm font-medium">{action.exercise_name}</span>
            <span className="text-xs text-[color:var(--color-muted)] ml-2">
              {dayName} → position {action.new_position + 1}
            </span>
          </div>
        </div>
      )
  }
}

export function AiDiffPreview({
  actions,
  draft,
  onApply,
  onReject,
}: {
  actions: PlanEditAction[]
  draft: EditedPlan
  onApply: () => void
  onReject: () => void
}) {
  return (
    <div className="mb-4 rounded-xl border border-purple-500/30 bg-purple-500/5 p-3">
      <div className="text-xs font-medium text-purple-300 mb-2">
        Proposed changes ({actions.length})
      </div>

      {/* On mobile: stacked. On desktop: could be side-by-side if we had before/after */}
      <div className="space-y-2 mb-3">
        {actions.map((action, i) => (
          <ActionDescription key={i} action={action} draft={draft} />
        ))}
      </div>

      <div className="flex gap-2">
        <Button variant="primary" onClick={onApply} className="flex-1">
          Apply
        </Button>
        <Button variant="danger" onClick={onReject} className="flex-1">
          Reject
        </Button>
      </div>
    </div>
  )
}
