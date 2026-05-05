import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { registerSW } from 'virtual:pwa-register'
import { setupQueueDrainTriggers } from '@/lib/offline/queue'

const queryClient = new QueryClient({ defaultOptions: { queries: { staleTime: 30_000, retry: 1 } } })

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  registerSW({ immediate: true })
}

// Only invalidate queries likely affected by offline writes: sessions, session_sets, and related data.
// Goals, plan edits, etc. are rare offline mutations and can use targeted invalidations if needed later.
// Cleanup function not needed here since this runs once at app root, but kept for correctness.
const cleanupOfflineQueue = setupQueueDrainTriggers(() => {
  queryClient.invalidateQueries({ queryKey: ['sessions'] })
  queryClient.invalidateQueries({ queryKey: ['session-sets'] })
  queryClient.invalidateQueries({ queryKey: ['exercise-history'] })
  queryClient.invalidateQueries({ queryKey: ['last-sets'] })
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </StrictMode>,
)
