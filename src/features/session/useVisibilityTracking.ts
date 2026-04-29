import { useEffect } from 'react'
import { useSession } from './sessionStore'

export function useVisibilityTracking(active: boolean) {
  const addForegroundMs = useSession((s) => s.addForegroundMs)
  const addBackgroundMs = useSession((s) => s.addBackgroundMs)

  useEffect(() => {
    if (!active) return
    let last = performance.now()
    let visible = document.visibilityState === 'visible'

    const flush = () => {
      const now = performance.now()
      const delta = now - last
      last = now
      if (visible) addForegroundMs(delta)
      else addBackgroundMs(delta)
    }

    const onVis = () => {
      flush()
      visible = document.visibilityState === 'visible'
    }

    const tick = window.setInterval(flush, 5000)
    document.addEventListener('visibilitychange', onVis)
    window.addEventListener('pagehide', flush)
    window.addEventListener('beforeunload', flush)

    return () => {
      flush()
      window.clearInterval(tick)
      document.removeEventListener('visibilitychange', onVis)
      window.removeEventListener('pagehide', flush)
      window.removeEventListener('beforeunload', flush)
    }
  }, [active, addForegroundMs, addBackgroundMs])
}
