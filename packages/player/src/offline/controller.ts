import { cacheUrls, matchAsObjectUrl, matchAsText, uncache } from './cache.js'
import {
  deleteLesson,
  getLesson,
  putLesson,
  type OfflineLessonRecord,
  type OfflineStatus,
} from './idb.js'

export type OfflineLessonAssets = {
  id: string
  title?: string
  /** URLs to cache for offline replay (audio, VTTs, transcript, poster). */
  urls: string[]
  /** Preferred media URL when offline (usually audio). */
  mediaUrl?: string
  transcriptUrl?: string
  offlinePackUrl?: string
}

export type OfflineSnapshot = {
  status: OfflineStatus
  progress: number
  bytes?: number
  error?: string
  cachedAt?: number
}

function idleSnapshot(): OfflineSnapshot {
  return { status: 'idle', progress: 0 }
}

function fromRecord(record: OfflineLessonRecord | undefined): OfflineSnapshot {
  if (!record) return idleSnapshot()
  return {
    status: record.status,
    progress: record.progress,
    bytes: record.bytes,
    error: record.error,
    cachedAt: record.cachedAt,
  }
}

/** Stable lesson id from manifest id or media URL. */
export function lessonIdFrom(id: string | undefined, fallbackUrl: string | undefined): string {
  if (id?.trim()) return id.trim()
  if (fallbackUrl) {
    try {
      return `url:${new URL(fallbackUrl, document.baseURI).href}`
    } catch {
      return `url:${fallbackUrl}`
    }
  }
  return 'unknown'
}

export async function getOfflineSnapshot(id: string): Promise<OfflineSnapshot> {
  return fromRecord(await getLesson(id))
}

export async function downloadLesson(
  assets: OfflineLessonAssets,
  onProgress?: (snapshot: OfflineSnapshot) => void,
): Promise<OfflineSnapshot> {
  const existing = await getLesson(assets.id)
  const record: OfflineLessonRecord = {
    id: assets.id,
    title: assets.title,
    urls: [...new Set(assets.urls.filter(Boolean))],
    progress: 0,
    status: 'downloading',
    error: undefined,
    transcriptHtml: existing?.transcriptHtml,
  }
  await putLesson(record)
  onProgress?.(fromRecord(record))

  try {
    if (!record.urls.length) throw new Error('No offline assets to cache')
    const { bytes, cached } = await cacheUrls(record.urls, (p) => {
      record.progress = p.total ? p.done / p.total : 0
      record.bytes = p.bytes
      void putLesson({ ...record })
      onProgress?.(fromRecord(record))
    })
    record.urls = cached
    record.bytes = bytes
    record.progress = 1
    record.status = 'ready'
    record.cachedAt = Date.now()
    if (assets.transcriptUrl) {
      const html = await matchAsText(assets.transcriptUrl)
      if (html != null) record.transcriptHtml = html
    }
    await putLesson(record)
    const snap = fromRecord(record)
    onProgress?.(snap)
    return snap
  } catch (err) {
    record.status = 'error'
    record.error = err instanceof Error ? err.message : String(err)
    await putLesson(record)
    const snap = fromRecord(record)
    onProgress?.(snap)
    throw err
  }
}

export async function removeLesson(id: string): Promise<void> {
  const record = await getLesson(id)
  if (record?.urls.length) await uncache(record.urls)
  await deleteLesson(id)
}

/** Resolve cached media/transcript for offline boot. */
export async function resolveCachedPlayback(assets: OfflineLessonAssets): Promise<{
  mediaUrl?: string
  trackUrls: Map<string, string>
  transcriptHtml?: string
  objectUrls: string[]
} | null> {
  const record = await getLesson(assets.id)
  if (!record || record.status !== 'ready') return null

  const objectUrls: string[] = []
  const trackUrls = new Map<string, string>()
  let mediaUrl: string | undefined

  const prefer = assets.mediaUrl
  if (prefer) {
    const cached = await matchAsObjectUrl(prefer)
    if (cached) {
      mediaUrl = cached
      objectUrls.push(cached)
    }
  }

  for (const url of assets.urls) {
    if (url === prefer) continue
    const cached = await matchAsObjectUrl(url)
    if (!cached) continue
    objectUrls.push(cached)
    trackUrls.set(url, cached)
  }

  let transcriptHtml = record.transcriptHtml
  if (!transcriptHtml && assets.transcriptUrl) {
    transcriptHtml = (await matchAsText(assets.transcriptUrl)) ?? undefined
  }

  if (!mediaUrl && !trackUrls.size && !transcriptHtml) return null
  return { mediaUrl, trackUrls, transcriptHtml, objectUrls }
}

export function canUseOfflineApis(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof caches !== 'undefined' &&
    typeof indexedDB !== 'undefined' &&
    !!window.isSecureContext
  )
}
