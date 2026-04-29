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

self.addEventListener('message', (event) => {
  const data = event.data as ScheduleRestMessage | undefined
  if (!data || data.type !== 'SCHEDULE_REST') return
  const delay = Math.max(0, data.at - Date.now())
  // Best-effort: setTimeout works while the SW is alive. Browsers may suspend the SW;
  // for cold-start reliability, future work could use TimestampTrigger where supported.
  self.setTimeout(() => {
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
