import type { Redis } from 'ioredis'

export interface RateLimitResult {
  allowed: boolean
  limit: number
  remaining: number
  /** Seconds until the window resets. */
  resetSeconds: number
}

export interface RateLimiter {
  hit(bucket: string, key: string, limit: number): Promise<RateLimitResult>
}

/**
 * Fixed-window counter per bucket and client key. If Redis is unreachable the request is allowed
 * (and reported to `onError`): a cache outage should not take the caption API down.
 */
export function createRateLimiter(
  redis: Redis,
  options: { prefix: string; windowSeconds: number; onError?: (error: unknown) => void },
): RateLimiter {
  const { prefix, windowSeconds } = options
  return {
    async hit(bucket, key, limit) {
      const window = Math.floor(Date.now() / 1000 / windowSeconds)
      const redisKey = `${prefix}:ratelimit:${bucket}:${key}:${window}`
      const resetSeconds = (window + 1) * windowSeconds - Math.floor(Date.now() / 1000)
      try {
        const [[incrError, count], [expireError]] = (await redis
          .multi()
          .incr(redisKey)
          .expire(redisKey, windowSeconds + 1)
          .exec()) as [[Error | null, number], [Error | null, unknown]]
        if (incrError) throw incrError
        if (expireError) throw expireError
        return {
          allowed: count <= limit,
          limit,
          remaining: Math.max(0, limit - count),
          resetSeconds,
        }
      } catch (error) {
        options.onError?.(error)
        return { allowed: true, limit, remaining: limit, resetSeconds }
      }
    },
  }
}
