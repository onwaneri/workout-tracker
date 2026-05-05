export const BODYWEIGHT_LBS = 175

export function isBodyweightExercise(name: string): boolean {
  return /\bpull[-\s]?ups?\b/i.test(name)
}
