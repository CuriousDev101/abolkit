import {
  createTts,
  ProviderError,
  ttsConfigFromEnv,
  type Storage,
  type Tts,
} from '@abolkit/provider-sdk'
import type { DatabaseSync } from 'node:sqlite'

import type { ApiConfig } from '../config.ts'
import {
  getJobAudioSummary,
  normalizeSummaryText,
  textHashForSummary,
  upsertJobAudioSummary,
} from '../db/job-audio-summaries.ts'
import { HttpError } from '../http.ts'

export type JobSummaryAudioView = {
  jobId: string
  textHash: string
  lang: string
  mime: string
  audioUrl: string
  cached: boolean
  provider: string
  createdAt: string
  updatedAt: string
}

export type JobSummaryService = {
  ensureAudio(input: {
    jobId: string
    text: string
    lang?: string
  }): Promise<JobSummaryAudioView>
  getAudio(jobId: string): Promise<JobSummaryAudioView>
}

const ENGLISH = 'en'
const MAX_TEXT = 2000

export function createJobSummaryService(deps: {
  db: DatabaseSync
  storage: Storage
  config: ApiConfig
  tts: Tts
  /** Included in the cache key so voice changes regenerate audio. */
  voiceId?: string
}): JobSummaryService {
  const { db, storage, config, tts } = deps
  const voiceId = deps.voiceId?.trim() || 'default'

  return {
    async ensureAudio(input) {
      const jobId = input.jobId.trim()
      const text = normalizeSummaryText(input.text)
      const lang = normalizeLang(input.lang)

      if (!jobId) throw new HttpError(400, 'VALIDATION', 'jobId is required')
      if (!text) throw new HttpError(400, 'VALIDATION', 'text is required')
      if (text.length > MAX_TEXT) {
        throw new HttpError(400, 'VALIDATION', `text must be at most ${MAX_TEXT} characters`)
      }
      if (lang !== ENGLISH) {
        throw new HttpError(
          400,
          'UNSUPPORTED_LANGUAGE',
          'Job summary audio currently supports English only (lang=en)',
        )
      }

      const textHash = textHashForSummary(text, lang, tts.id, voiceId)
      const existing = getJobAudioSummary(db, jobId)
      if (existing && existing.textHash === textHash) {
        return toView(existing, await signedUrl(storage, existing.storageKey, config), true)
      }

      let synthesized: { bytes: Uint8Array; mime: string }
      try {
        synthesized = await tts.synthesize(text, { lang })
      } catch (err) {
        if (err instanceof ProviderError) {
          const status =
            err.code === 'BAD_REQUEST' ? 400 : err.code === 'CONSENT_REQUIRED' ? 503 : 502
          throw new HttpError(status, err.code, err.message)
        }
        throw err
      }
      const ext = synthesized.mime.includes('wav')
        ? 'wav'
        : synthesized.mime.includes('mpeg') || synthesized.mime.includes('mp3')
          ? 'mp3'
          : 'bin'
      const storageKey = `job-summaries/${safeSegment(jobId)}/${textHash}.${ext}`
      await storage.put(storageKey, synthesized.bytes, synthesized.mime)

      try {
        const row = upsertJobAudioSummary(db, {
          jobId,
          textHash,
          text,
          lang,
          storageKey,
          mime: synthesized.mime,
          provider: tts.id,
        })
        if (existing && existing.storageKey !== storageKey) {
          await storage.delete(existing.storageKey).catch(() => undefined)
        }
        return toView(row, await signedUrl(storage, storageKey, config), false)
      } catch (err) {
        await storage.delete(storageKey).catch(() => undefined)
        throw err
      }
    },

    async getAudio(jobId) {
      const row = getJobAudioSummary(db, jobId.trim())
      if (!row) {
        throw new HttpError(404, 'NOT_FOUND', 'No audio summary stored for this job')
      }
      return toView(row, await signedUrl(storage, row.storageKey, config), true)
    },
  }
}

/** Build TTS for the API process. Injected in tests; AssemblyAI or stub in production. */
export function createApiTts(
  env: Record<string, string | undefined>,
  injected?: Tts,
): Tts | null {
  if (injected) return injected
  const selection = ttsConfigFromEnv(env)
  // Job summaries need a working synthesizer. recorded-clips / cloud skeletons are not usable here.
  if (selection.tts !== 'assemblyai' && selection.tts !== 'stub') {
    return null
  }
  try {
    return createTts(selection)
  } catch {
    return null
  }
}

function normalizeLang(raw: string | undefined): string {
  const trimmed = raw?.trim().toLowerCase()
  if (!trimmed) return ENGLISH
  if (trimmed === 'en' || trimmed.startsWith('en-')) return ENGLISH
  return trimmed
}

function safeSegment(jobId: string): string {
  return jobId.replace(/[^a-zA-Z0-9._-]+/g, '_').slice(0, 120) || 'job'
}

async function signedUrl(storage: Storage, key: string, config: ApiConfig): Promise<string> {
  return storage.signedUrl(key, config.signedUrlTtlSeconds)
}

function toView(
  row: {
    jobId: string
    textHash: string
    lang: string
    mime: string
    provider: string
    createdAt: string
    updatedAt: string
  },
  audioUrl: string,
  cached: boolean,
): JobSummaryAudioView {
  return {
    jobId: row.jobId,
    textHash: row.textHash,
    lang: row.lang,
    mime: row.mime,
    audioUrl,
    cached,
    provider: row.provider,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }
}
