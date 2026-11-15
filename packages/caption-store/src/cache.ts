import { createHash } from 'node:crypto'

import { Redis } from 'ioredis'

import type { CaptionRecord } from './repo.ts'

export function createRedis(redisUrl: string): Redis {
  return new Redis(redisUrl, {
    maxRetriesPerRequest: 2,
    enableOfflineQueue: false,
    lazyConnect: false,
  })
}

/**
 * Read-through cache in front of Postgres. Every method swallows Redis errors and reports them to `onError`:
 * when Redis is down, callers read Postgres instead of failing.
 */
export interface CaptionCache {
  getVtt(videoId: string, language: string): Promise<string | null>
  setVtt(videoId: string, language: string, vtt: string): Promise<void>
  getVideoId(url: string): Promise<string | null>
  setVideoId(url: string, videoId: string): Promise<void>
  getCaptionList(videoId: string): Promise<CaptionRecord[] | null>
  setCaptionList(videoId: string, captions: CaptionRecord[]): Promise<void>
  /** Call after a caption is written so the next read sees it. */
  invalidateVideo(videoId: string, language?: string): Promise<void>
}

export function createCaptionCache(
  redis: Redis,
  options: { prefix: string; ttlSeconds: number; onError?: (error: unknown) => void },
): CaptionCache {
  const { prefix, ttlSeconds } = options
  const vttKey = (videoId: string, language: string) =>
    `${prefix}:captions:vtt:${videoId}:${language}`
  const listKey = (videoId: string) => `${prefix}:captions:list:${videoId}`
  const urlKey = (url: string) =>
    `${prefix}:captions:url:${createHash('sha256').update(url).digest('hex')}`

  const safe = async <T>(fallback: T, run: () => Promise<T>): Promise<T> => {
    try {
      return await run()
    } catch (error) {
      options.onError?.(error)
      return fallback
    }
  }

  return {
    getVtt: (videoId, language) => safe(null, () => redis.get(vttKey(videoId, language))),
    setVtt: (videoId, language, vtt) =>
      safe(undefined, async () => {
        await redis.set(vttKey(videoId, language), vtt, 'EX', ttlSeconds)
      }),
    getVideoId: (url) => safe(null, () => redis.get(urlKey(url))),
    setVideoId: (url, videoId) =>
      safe(undefined, async () => {
        await redis.set(urlKey(url), videoId, 'EX', ttlSeconds)
      }),
    getCaptionList: (videoId) =>
      safe(null, async () => {
        const raw = await redis.get(listKey(videoId))
        if (!raw) return null
        return (JSON.parse(raw) as CaptionRecord[]).map((c) => ({
          ...c,
          createdAt: new Date(c.createdAt),
          updatedAt: new Date(c.updatedAt),
        }))
      }),
    setCaptionList: (videoId, captions) =>
      safe(undefined, async () => {
        await redis.set(listKey(videoId), JSON.stringify(captions), 'EX', ttlSeconds)
      }),
    invalidateVideo: (videoId, language) =>
      safe(undefined, async () => {
        const keys = [listKey(videoId)]
        if (language) keys.push(vttKey(videoId, language))
        await redis.del(...keys)
      }),
  }
}
