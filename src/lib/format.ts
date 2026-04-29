export const fmtDuration = (ms: number): string => {
  const total = Math.max(0, Math.round(ms / 1000))
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  if (h > 0) return `${h}h ${m}m`
  if (m > 0) return `${m}m ${s}s`
  return `${s}s`
}

export const fmtWeight = (lbs: number | null | undefined): string => {
  if (lbs == null) return '—'
  return Number.isInteger(lbs) ? `${lbs}` : lbs.toFixed(1)
}

export const fmtVolume = (lbs: number): string => {
  if (lbs >= 10000) return `${(lbs / 1000).toFixed(1)}k`
  return `${Math.round(lbs)}`
}

export const fmtDate = (iso: string): string => {
  const d = new Date(iso)
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

export const fmtDateTime = (iso: string): string => {
  const d = new Date(iso)
  return d.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
}

export const startOfISOWeek = (d: Date): Date => {
  const x = new Date(d)
  const day = (x.getDay() + 6) % 7
  x.setHours(0, 0, 0, 0)
  x.setDate(x.getDate() - day)
  return x
}
