export {
  captionsEnabled,
  DEFAULT_ALLOWED_HOSTS,
  DEFAULT_TRANSLATION_LANGUAGES,
  isLanguageCode,
  loadCaptionConfig,
} from './config.ts'
export type { CaptionConfig } from './config.ts'
export { createPool, migrate } from './db.ts'
export type { Db } from './db.ts'
export {
  CAPTION_JOB_STATUSES,
  CAPTION_JOB_TYPES,
  completeJob,
  createCaptionRepository,
  createJob,
  failJob,
  findVideoByUrl,
  getCaption,
  getJob,
  getTranscript,
  getVideo,
  listCaptions,
  listLatestJobs,
  markJobRunning,
  saveCaption,
  setJobProgress,
  updateVideoDetails,
  upsertVideo,
} from './repo.ts'
export type {
  CaptionJobRecord,
  CaptionJobStatus,
  CaptionJobType,
  CaptionKind,
  CaptionRecord,
  CaptionRepository,
  CaptionWithVtt,
  VideoRecord,
} from './repo.ts'
export { createCaptionQueues, createCaptionWorker, QUEUE_NAMES } from './queue.ts'
export type { CaptionJobData, CaptionQueueJob, CaptionQueues } from './queue.ts'
export { createCaptionCache, createRedis } from './cache.ts'
export type { CaptionCache } from './cache.ts'
export { createRateLimiter } from './rate-limit.ts'
export type { RateLimiter, RateLimitResult } from './rate-limit.ts'
export { assertAllowedHost, identifyVideoUrl, VideoUrlError } from './video-url.ts'
export type { VideoIdentity, VideoSourceKind } from './video-url.ts'

/** Object key in MinIO / local storage for one caption file. */
export function captionStorageKey(videoId: string, language: string): string {
  return `videos/${videoId}/captions/${language}.vtt`
}

/** API path that serves a caption; stored in `captions.url`. */
export function captionApiPath(videoId: string, language: string): string {
  return `/api/videos/${videoId}/captions/${language}`
}
