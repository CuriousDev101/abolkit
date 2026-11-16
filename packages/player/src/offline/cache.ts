/** Cache API helpers for lesson assets (audio, captions, transcript, poster). */

export const LESSON_CACHE = 'abol-lesson-v1'

export type CacheProgress = {
  done: number
  total: number
  bytes: number
  url: string
}

async function openCache(): Promise<Cache> {
  return caches.open(LESSON_CACHE)
}

/** Fetch and store each URL; reports progress after each successful put. */
export async function cacheUrls(
  urls: readonly string[],
  onProgress?: (progress: CacheProgress) => void,
): Promise<{ bytes: number; cached: string[] }> {
  const unique = [...new Set(urls.filter(Boolean))]
  const cache = await openCache()
  let bytes = 0
  const cached: string[] = []
  let done = 0
  for (const url of unique) {
    const res = await fetch(url, { credentials: 'same-origin', mode: 'cors' })
    if (!res.ok) throw new Error(`Offline cache HTTP ${res.status} for ${url}`)
    const clone = res.clone()
    const buf = await clone.arrayBuffer()
    bytes += buf.byteLength
    await cache.put(url, res)
    cached.push(url)
    done += 1
    onProgress?.({ done, total: unique.length, bytes, url })
  }
  return { bytes, cached }
}

export async function uncache(urls: readonly string[]): Promise<void> {
  try {
    const cache = await openCache()
    await Promise.all(urls.map((url) => cache.delete(url)))
  } catch {
    // ignore
  }
}

/** Return a blob: object URL for a cached response, or null if missing. */
export async function matchAsObjectUrl(url: string): Promise<string | null> {
  try {
    const cache = await openCache()
    const res = await cache.match(url)
    if (!res) return null
    const blob = await res.blob()
    return URL.createObjectURL(blob)
  } catch {
    return null
  }
}

/** Return cached response text, or null. */
export async function matchAsText(url: string): Promise<string | null> {
  try {
    const cache = await openCache()
    const res = await cache.match(url)
    if (!res) return null
    return res.text()
  } catch {
    return null
  }
}

export async function hasCached(url: string): Promise<boolean> {
  try {
    const cache = await openCache()
    return !!(await cache.match(url))
  } catch {
    return false
  }
}
