// "Upper A" → "Upper", "Lower B" → "Lower", "Push" → "Push"
export function workoutDayGroup(name: string): string {
  return name.replace(/\s+[A-Z\d]$/i, '').trim()
}
