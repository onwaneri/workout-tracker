import { useCallback, useEffect, useState } from 'react'

const DENIED_AT_KEY = 'rest-notif-denied-at'
const LAST_PROMPT_SESSION_KEY = 'rest-notif-last-prompt-session'

export type NotifPermission = 'default' | 'granted' | 'denied' | 'unsupported'

export function getPermission(): NotifPermission {
  if (typeof Notification === 'undefined') return 'unsupported'
  return Notification.permission
}

// README locked decision: ask on first session, re-prompt next session if denied, then stay silent.
export async function maybeRequestPermission(currentSessionId: string): Promise<NotifPermission> {
  if (typeof Notification === 'undefined') return 'unsupported'
  const lastPromptSession = localStorage.getItem(LAST_PROMPT_SESSION_KEY)
  if (Notification.permission === 'granted') return 'granted'
  if (Notification.permission === 'default') {
    localStorage.setItem(LAST_PROMPT_SESSION_KEY, currentSessionId)
    const result = await Notification.requestPermission()
    if (result === 'denied') localStorage.setItem(DENIED_AT_KEY, String(Date.now()))
    return result
  }
  // permission === 'denied'; re-prompt once if this is a new session
  if (lastPromptSession !== currentSessionId) {
    localStorage.setItem(LAST_PROMPT_SESSION_KEY, currentSessionId)
    const result = await Notification.requestPermission()
    if (result === 'denied') localStorage.setItem(DENIED_AT_KEY, String(Date.now()))
    return result
  }
  return 'denied'
}

export function scheduleRestNotification(restSeconds: number, body: string): void {
  if (typeof navigator === 'undefined' || !navigator.serviceWorker?.controller) return
  if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return
  navigator.serviceWorker.controller.postMessage({
    type: 'SCHEDULE_REST',
    at: Date.now() + restSeconds * 1000,
    body,
  })
}

export function cancelRestNotification(): void {
  if (typeof navigator === 'undefined' || !navigator.serviceWorker?.controller) return
  navigator.serviceWorker.controller.postMessage({ type: 'CANCEL_REST' })
}

export function useRestNotification(activeSessionId: string | null) {
  const [permission, setPermission] = useState<NotifPermission>(getPermission())

  const ensure = useCallback(async () => {
    if (!activeSessionId) return
    const next = await maybeRequestPermission(activeSessionId)
    setPermission(next)
  }, [activeSessionId])

  useEffect(() => {
    if (activeSessionId) ensure()
  }, [activeSessionId, ensure])

  return { permission, ensure }
}
