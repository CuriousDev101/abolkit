import { randomUUID } from 'node:crypto'

import type { Db } from './db.ts'
import type { VideoIdentity, VideoSourceKind } from './video-url.ts'

export interface VideoRecord {
  id: string
  url: string
  sourceUrl: string
  sourceKind: VideoSourceKind
  title: string | null
  durationSeconds: number | null
  sourceLanguage: string | null
  createdAt: Date
  updatedAt: Date
}

export type CaptionKind = 'transcript' | 'translation'

export interface CaptionRecord {
  id: string
  videoId: string
  language: string
  kind: CaptionKind
  translatedFrom: string | null
  provider: string
  providerRef: string | null
  storageKey: string
  url: string
  cueCount: number
  needsReview: boolean
  createdAt: Date
  updatedAt: Date
}

export interface CaptionWithVtt extends CaptionRecord {
  vtt: string
}

export const CAPTION_JOB_TYPES = ['transcribe', 'translate'] as const
export type CaptionJobType = (typeof CAPTION_JOB_TYPES)[number]
export const CAPTION_JOB_STATUSES = ['queued', 'running', 'succeeded', 'failed'] as const
export type CaptionJobStatus = (typeof CAPTION_JOB_STATUSES)[number]

export interface CaptionJobRecord {
  id: string
  videoId: string
  type: CaptionJobType
  language: string | null
  translateTo: string[]
  sourceLanguage: string | null
  status: CaptionJobStatus
  progress: number
  attempts: number
  error: string | null
  createdAt: Date
  updatedAt: Date
  startedAt: Date | null
  finishedAt: Date | null
}

type Row = Record<string, unknown>

export async function upsertVideo(
  db: Db,
  identity: VideoIdentity,
  sourceUrl: string,
): Promise<VideoRecord> {
  const { rows } = await db.query(
    `INSERT INTO videos (id, url, source_url, source_kind) VALUES ($1, $2, $3, $4)
     ON CONFLICT (url) DO UPDATE SET url = EXCLUDED.url
     RETURNING *`,
    [randomUUID(), identity.url, sourceUrl, identity.kind],
  )
  return toVideo(rows[0]!)
}

export async function findVideoByUrl(db: Db, url: string): Promise<VideoRecord | null> {
  const { rows } = await db.query('SELECT * FROM videos WHERE url = $1', [url])
  return rows[0] ? toVideo(rows[0]) : null
}

export async function getVideo(db: Db, id: string): Promise<VideoRecord | null> {
  const { rows } = await db.query('SELECT * FROM videos WHERE id = $1', [id])
  return rows[0] ? toVideo(rows[0]) : null
}

export async function updateVideoDetails(
  db: Db,
  id: string,
  details: {
    title?: string | null
    durationSeconds?: number | null
    sourceLanguage?: string | null
  },
): Promise<void> {
  await db.query(
    `UPDATE videos SET title = COALESCE($2, title), duration_seconds = COALESCE($3, duration_seconds),
       source_language = COALESCE($4, source_language), updated_at = now()
     WHERE id = $1`,
    [id, details.title ?? null, details.durationSeconds ?? null, details.sourceLanguage ?? null],
  )
}

const CAPTION_COLUMNS = `id, video_id, language, kind, translated_from, provider, provider_ref, storage_key, url,
  cue_count, needs_review, created_at, updated_at`

export async function listCaptions(db: Db, videoId: string): Promise<CaptionRecord[]> {
  const { rows } = await db.query(
    `SELECT ${CAPTION_COLUMNS} FROM captions WHERE video_id = $1 ORDER BY kind DESC, language`,
    [videoId],
  )
  return rows.map(toCaption)
}

export async function getCaption(
  db: Db,
  videoId: string,
  language: string,
): Promise<CaptionWithVtt | null> {
  const { rows } = await db.query('SELECT * FROM captions WHERE video_id = $1 AND language = $2', [
    videoId,
    language,
  ])
  return rows[0] ? { ...toCaption(rows[0]), vtt: String(rows[0].vtt) } : null
}

/** The transcript every translation of this video starts from. */
export async function getTranscript(db: Db, videoId: string): Promise<CaptionWithVtt | null> {
  const { rows } = await db.query(
    `SELECT * FROM captions WHERE video_id = $1 AND kind = 'transcript' ORDER BY updated_at DESC LIMIT 1`,
    [videoId],
  )
  return rows[0] ? { ...toCaption(rows[0]), vtt: String(rows[0].vtt) } : null
}

export async function saveCaption(
  db: Db,
  input: {
    videoId: string
    language: string
    kind: CaptionKind
    translatedFrom?: string | null
    provider: string
    providerRef?: string | null
    storageKey: string
    url: string
    vtt: string
    cueCount: number
    needsReview: boolean
  },
): Promise<CaptionRecord> {
  const { rows } = await db.query(
    `INSERT INTO captions (id, video_id, language, kind, translated_from, provider, provider_ref, storage_key, url,
       vtt, cue_count, needs_review)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
     ON CONFLICT (video_id, language) DO UPDATE SET
       kind = EXCLUDED.kind, translated_from = EXCLUDED.translated_from, provider = EXCLUDED.provider,
       provider_ref = EXCLUDED.provider_ref, storage_key = EXCLUDED.storage_key, url = EXCLUDED.url,
       vtt = EXCLUDED.vtt, cue_count = EXCLUDED.cue_count, needs_review = EXCLUDED.needs_review, updated_at = now()
     RETURNING ${CAPTION_COLUMNS}`,
    [
      randomUUID(),
      input.videoId,
      input.language,
      input.kind,
      input.translatedFrom ?? null,
      input.provider,
      input.providerRef ?? null,
      input.storageKey,
      input.url,
      input.vtt,
      input.cueCount,
      input.needsReview,
    ],
  )
  return toCaption(rows[0]!)
}

/**
 * Insert a queued job, or return the queued/running job that already covers the same video, type and language.
 * `created` tells the caller whether it must put the job on the queue.
 */
export async function createJob(
  db: Db,
  input: {
    videoId: string
    type: CaptionJobType
    language?: string | null
    translateTo?: string[]
    sourceLanguage?: string | null
  },
  retries = 3,
): Promise<{ job: CaptionJobRecord; created: boolean }> {
  const { rows } = await db.query(
    `INSERT INTO caption_jobs (id, video_id, type, language, translate_to, source_language, status)
     VALUES ($1, $2, $3, $4, $5, $6, 'queued')
     ON CONFLICT (video_id, type, (coalesce(language, ''))) WHERE status IN ('queued', 'running') DO NOTHING
     RETURNING *`,
    [
      randomUUID(),
      input.videoId,
      input.type,
      input.language ?? null,
      input.translateTo ?? [],
      input.sourceLanguage ?? null,
    ],
  )
  if (rows[0]) return { job: toJob(rows[0]), created: true }

  const existing = await db.query(
    `SELECT * FROM caption_jobs
     WHERE video_id = $1 AND type = $2 AND coalesce(language, '') = coalesce($3, '')
       AND status IN ('queued', 'running')
     LIMIT 1`,
    [input.videoId, input.type, input.language ?? null],
  )
  if (existing.rows[0]) {
    const job = toJob(existing.rows[0])
    const extra = (input.translateTo ?? []).filter((lang) => !job.translateTo.includes(lang))
    if (input.type === 'transcribe' && extra.length) {
      const updated = await db.query(
        `UPDATE caption_jobs SET translate_to = translate_to || $2::text[], updated_at = now()
         WHERE id = $1 RETURNING *`,
        [job.id, extra],
      )
      return { job: toJob(updated.rows[0]!), created: false }
    }
    return { job, created: false }
  }
  // The active job finished between the two statements; try again.
  if (retries <= 0) throw new Error('Could not create or find an active caption job')
  return createJob(db, input, retries - 1)
}

export async function getJob(db: Db, id: string): Promise<CaptionJobRecord | null> {
  const { rows } = await db.query('SELECT * FROM caption_jobs WHERE id = $1', [id])
  return rows[0] ? toJob(rows[0]) : null
}

/** The newest job for each type and language of a video: enough to show progress and the last failure. */
export async function listLatestJobs(db: Db, videoId: string): Promise<CaptionJobRecord[]> {
  const { rows } = await db.query(
    `SELECT DISTINCT ON (type, coalesce(language, '')) * FROM caption_jobs
     WHERE video_id = $1
     ORDER BY type, coalesce(language, ''), created_at DESC`,
    [videoId],
  )
  return rows.map(toJob)
}

export async function markJobRunning(db: Db, id: string, attempt: number): Promise<void> {
  await db.query(
    `UPDATE caption_jobs SET status = 'running', attempts = $2, started_at = COALESCE(started_at, now()),
       updated_at = now()
     WHERE id = $1 AND status IN ('queued', 'running')`,
    [id, attempt],
  )
}

export async function setJobProgress(db: Db, id: string, progress: number): Promise<void> {
  const clamped = Math.min(100, Math.max(0, Math.round(progress)))
  await db.query(
    `UPDATE caption_jobs SET progress = GREATEST(progress, $2), updated_at = now()
     WHERE id = $1 AND status = 'running'`,
    [id, clamped],
  )
}

export async function completeJob(db: Db, id: string): Promise<void> {
  await db.query(
    `UPDATE caption_jobs SET status = 'succeeded', progress = 100, error = NULL, finished_at = now(),
       updated_at = now()
     WHERE id = $1`,
    [id],
  )
}

/** `final` means no retry is left: the job is failed. Otherwise it waits for BullMQ's next attempt. */
export async function failJob(db: Db, id: string, error: string, final: boolean): Promise<void> {
  await db.query(
    final
      ? `UPDATE caption_jobs SET status = 'failed', error = $2, finished_at = now(), updated_at = now() WHERE id = $1`
      : `UPDATE caption_jobs SET status = 'queued', error = $2, updated_at = now() WHERE id = $1`,
    [id, error.slice(0, 2000)],
  )
}

/** The queries the API needs, bound to one pool. Tests swap in an in-memory version. */
export interface CaptionRepository {
  upsertVideo(identity: VideoIdentity, sourceUrl: string): Promise<VideoRecord>
  findVideoByUrl(url: string): Promise<VideoRecord | null>
  getVideo(id: string): Promise<VideoRecord | null>
  listCaptions(videoId: string): Promise<CaptionRecord[]>
  getCaption(videoId: string, language: string): Promise<CaptionWithVtt | null>
  getTranscript(videoId: string): Promise<CaptionWithVtt | null>
  createJob(
    input: Parameters<typeof createJob>[1],
  ): Promise<{ job: CaptionJobRecord; created: boolean }>
  getJob(id: string): Promise<CaptionJobRecord | null>
  listLatestJobs(videoId: string): Promise<CaptionJobRecord[]>
  failJob(id: string, error: string, final: boolean): Promise<void>
}

export function createCaptionRepository(db: Db): CaptionRepository {
  return {
    upsertVideo: (identity, sourceUrl) => upsertVideo(db, identity, sourceUrl),
    findVideoByUrl: (url) => findVideoByUrl(db, url),
    getVideo: (id) => getVideo(db, id),
    listCaptions: (videoId) => listCaptions(db, videoId),
    getCaption: (videoId, language) => getCaption(db, videoId, language),
    getTranscript: (videoId) => getTranscript(db, videoId),
    createJob: (input) => createJob(db, input),
    getJob: (id) => getJob(db, id),
    listLatestJobs: (videoId) => listLatestJobs(db, videoId),
    failJob: (id, error, final) => failJob(db, id, error, final),
  }
}

function toVideo(row: Row): VideoRecord {
  return {
    id: String(row.id),
    url: String(row.url),
    sourceUrl: String(row.source_url),
    sourceKind: row.source_kind as VideoSourceKind,
    title: (row.title as string | null) ?? null,
    durationSeconds: row.duration_seconds == null ? null : Number(row.duration_seconds),
    sourceLanguage: (row.source_language as string | null) ?? null,
    createdAt: row.created_at as Date,
    updatedAt: row.updated_at as Date,
  }
}

function toCaption(row: Row): CaptionRecord {
  return {
    id: String(row.id),
    videoId: String(row.video_id),
    language: String(row.language),
    kind: row.kind as CaptionKind,
    translatedFrom: (row.translated_from as string | null) ?? null,
    provider: String(row.provider),
    providerRef: (row.provider_ref as string | null) ?? null,
    storageKey: String(row.storage_key),
    url: String(row.url),
    cueCount: Number(row.cue_count),
    needsReview: row.needs_review === true,
    createdAt: row.created_at as Date,
    updatedAt: row.updated_at as Date,
  }
}

function toJob(row: Row): CaptionJobRecord {
  return {
    id: String(row.id),
    videoId: String(row.video_id),
    type: row.type as CaptionJobType,
    language: (row.language as string | null) ?? null,
    translateTo: (row.translate_to as string[] | null) ?? [],
    sourceLanguage: (row.source_language as string | null) ?? null,
    status: row.status as CaptionJobStatus,
    progress: Number(row.progress),
    attempts: Number(row.attempts),
    error: (row.error as string | null) ?? null,
    createdAt: row.created_at as Date,
    updatedAt: row.updated_at as Date,
    startedAt: (row.started_at as Date | null) ?? null,
    finishedAt: (row.finished_at as Date | null) ?? null,
  }
}
