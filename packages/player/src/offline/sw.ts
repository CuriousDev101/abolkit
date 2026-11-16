// @ts-nocheck — service-worker globals; built as dist/abol-player.sw.js via esbuild.
/** Cache-first for lesson assets in abol-lesson-v1; network otherwise. */

const LESSON_CACHE = 'abol-lesson-v1'
const SHELL_CACHE = 'abol-shell-v1'

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      try {
        const cache = await caches.open(SHELL_CACHE)
        const base = self.registration.scriptURL
        const player = new URL('abol-player.js', base).href
        const lite = new URL('abol-player.lite.js', base).href
        await cache.addAll([base]).catch(() => undefined)
        await Promise.all(
          [player, lite].map((url) =>
            fetch(url)
              .then((res) => (res.ok ? cache.put(url, res) : undefined))
              .catch(() => undefined),
          ),
        )
      } catch {
        // ignore
      }
      await self.skipWaiting()
    })(),
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim())
})

self.addEventListener('fetch', (event) => {
  const req = event.request
  if (req.method !== 'GET') return
  const url = new URL(req.url)
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return

  event.respondWith(
    (async () => {
      const lesson = await caches.open(LESSON_CACHE)
      const hit = await lesson.match(req)
      if (hit) return hit

      const shell = await caches.open(SHELL_CACHE)
      const shellHit = await shell.match(req)
      if (shellHit) return shellHit

      try {
        return await fetch(req)
      } catch {
        return new Response('Offline', { status: 503, statusText: 'Offline' })
      }
    })(),
  )
})
