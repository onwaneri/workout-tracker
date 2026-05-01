/// <reference lib="webworker" />
import { precacheAndRoute } from 'workbox-precaching'

declare const self: ServiceWorkerGlobalScope

precacheAndRoute(self.__WB_MANIFEST)

self.addEventListener('install', () => {
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim())
})

type ScheduleRestMessage = { type: 'SCHEDULE_REST'; at: number; body: string }
type CancelRestMessage = { type: 'CANCEL_REST' }
type RestMessage = ScheduleRestMessage | CancelRestMessage

let pendingRestTimeoutId: number | null = null

self.addEventListener('message', (event) => {
  const data = event.data as RestMessage | undefined
  if (!data) return
  if (data.type === 'CANCEL_REST') {
    if (pendingRestTimeoutId !== null) {
      self.clearTimeout(pendingRestTimeoutId)
      pendingRestTimeoutId = null
    }
    return
  }
  if (data.type !== 'SCHEDULE_REST') return
  if (pendingRestTimeoutId !== null) {
    self.clearTimeout(pendingRestTimeoutId)
    pendingRestTimeoutId = null
  }
  const delay = Math.max(0, data.at - Date.now())
  // Best-effort: setTimeout works while the SW is alive. Browsers may suspend the SW;
  // for cold-start reliability, future work could use TimestampTrigger where supported.
  pendingRestTimeoutId = self.setTimeout(() => {
    pendingRestTimeoutId = null
    self.registration.showNotification('Rest done', {
      body: data.body,
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-192.png',
      tag: 'rest-timer',
      silent: false,
    })
  }, delay)
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  event.waitUntil(
    self.clients.matchAll({ type: 'window' }).then((clients) => {
      const existing = clients.find((c) => 'focus' in c)
      if (existing) return existing.focus()
      return self.clients.openWindow('/')
    }),
  )
})
