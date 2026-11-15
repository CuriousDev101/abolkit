import { createHash } from 'node:crypto'
import type { DatabaseSync } from 'node:sqlite'

export type JobAudioSummaryRow = {
  jobId: string
  textHash: string
  text: string
  lang: string
  storageKey: string
  mime: string
  provider: string
  createdAt: string
  updatedAt: string
}

/** Persist job-card audio summaries keyed by career job id + content hash. */
export function migrateJobAudioSummaries(db: DatabaseSync): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS job_audio_summaries (
      job_id TEXT PRIMARY KEY NOT NULL,
      text_hash TEXT NOT NULL,
      text TEXT NOT NULL,
      lang TEXT NOT NULL,
      storage_key TEXT NOT NULL UNIQUE,
      mime TEXT NOT NULL,
      provider TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS job_audio_summaries_text_hash_idx
      ON job_audio_summaries (text_hash);
  `)
}

export function textHashForSummary(text: string, lang: string, provider: string, voice: string): string {
  return createHash('sha256')
    .update(normalizeSummaryText(text))
    .update('\0')
    .update(lang)
    .update('\0')
    .update(provider)
    .update('\0')
    .update(voice)
    .digest('hex')
}

export function normalizeSummaryText(text: string): string {
  return text.trim().replace(/\s+/g, ' ')
}

export function getJobAudioSummary(db: DatabaseSync, jobId: string): JobAudioSummaryRow | null {
  const row = db
    .prepare(
      `SELECT job_id, text_hash, text, lang, storage_key, mime, provider, created_at, updated_at
       FROM job_audio_summaries WHERE job_id = ?`,
    )
    .get(jobId) as
    | {
        job_id: string
        text_hash: string
        text: string
        lang: string
        storage_key: string
        mime: string
        provider: string
        created_at: string
        updated_at: string
      }
    | undefined

  return row ? mapRow(row) : null
}

export function upsertJobAudioSummary(
  db: DatabaseSync,
  input: {
    jobId: string
    textHash: string
    text: string
    lang: string
    storageKey: string
    mime: string
    provider: string
    now?: Date
  },
): JobAudioSummaryRow {
  const now = (input.now ?? new Date()).toISOString()
  const existing = getJobAudioSummary(db, input.jobId)
  const createdAt = existing?.createdAt ?? now

  db.prepare(
    `INSERT INTO job_audio_summaries
      (job_id, text_hash, text, lang, storage_key, mime, provider, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(job_id) DO UPDATE SET
       text_hash = excluded.text_hash,
       text = excluded.text,
       lang = excluded.lang,
       storage_key = excluded.storage_key,
       mime = excluded.mime,
       provider = excluded.provider,
       updated_at = excluded.updated_at`,
  ).run(
    input.jobId,
    input.textHash,
    input.text,
    input.lang,
    input.storageKey,
    input.mime,
    input.provider,
    createdAt,
    now,
  )

  return {
    jobId: input.jobId,
    textHash: input.textHash,
    text: input.text,
    lang: input.lang,
    storageKey: input.storageKey,
    mime: input.mime,
    provider: input.provider,
    createdAt,
    updatedAt: now,
  }
}

function mapRow(row: {
  job_id: string
  text_hash: string
  text: string
  lang: string
  storage_key: string
  mime: string
  provider: string
  created_at: string
  updated_at: string
}): JobAudioSummaryRow {
  return {
    jobId: row.job_id,
    textHash: row.text_hash,
    text: row.text,
    lang: row.lang,
    storageKey: row.storage_key,
    mime: row.mime,
    provider: row.provider,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}
