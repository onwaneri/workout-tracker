export function isAiFeaturesEnabled(): boolean {
  return import.meta.env.VITE_AI_FEATURES_ENABLED === 'true'
}
