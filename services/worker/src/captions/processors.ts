import { mkdir, mkdtemp, rm } from 'node:fs/promises'
import { join } from 'node:path'

import {
  captionApiPath,
  captionStorageKey,
  completeJob,
  createJob,
  getCaption,
  getJob,
  getTranscript,
  getVideo,
  markJobRunning,
  saveCaption,
  setJobProgress,
  updateVideoDetails,
  type CaptionCache,
  type CaptionConfig,
  type CaptionJobRecord,
  type CaptionQueueJob,
  type CaptionQueues,
  type Db,
} from '@abolkit/caption-store'
import { parseVtt, serializeVtt, type Cue } from '@abolkit/core'
import {
  ProviderError,
  transcribeWithDetails,
  withTranslatedText,
  type Storage,
  type Transcriber,
  type Translator,
} from '@abolkit/provider-sdk'
import { UnrecoverableError } from 'bullmq'

import { extractAudio, probeSource, type SourceTools } from './source.ts'

export interface CaptionProcessorDeps {
  db: Db
  cache: CaptionCache
  queues: CaptionQueues
  storage: Storage
  transcriber: Transcriber
  /** `null` when TRANSLATOR=none: translate jobs fail with a clear message. */
  translator: Translator | null
  config: CaptionConfig
  tools: SourceTools
  workDir: string
  log: (event: Record<string, unknown>) => void
}

export interface CaptionProcessors {
  transcribe(job: CaptionQueueJob, signal?: AbortSignal): Promise<void>
  translate(job: CaptionQueueJob, signal?: AbortSignal): Promise<void>
}

/** Provider failures that another attempt cannot fix (bad key, missing consent, no speech in the audio). */
const PERMANENT_CODES = new Set([
  'BAD_CONFIG',
  'CONSENT_REQUIRED',
  'TRANSCRIPTION_FAILED',
  'BLOCKED',
])
const PERMANENT_STATUSES = new Set([400, 401, 403, 404, 413, 422])

export function isPermanentError(error: unknown): boolean {
  if (error instanceof UnrecoverableError) return true
  if (!(error instanceof ProviderError)) return false
  return (
    PERMANENT_CODES.has(error.code) ||
    (error.status != null && PERMANENT_STATUSES.has(error.status))
  )
}

/** Transcriber language codes such as `en_us` become the primary subtag used for caption rows. */
export function normalizeLanguage(code: string): string {
  return code.split(/[-_]/)[0]!.toLowerCase()
}

export function createCaptionProcessors(deps: CaptionProcessorDeps): CaptionProcessors {
  const { db, cache, config, log } = deps

  async function begin(job: CaptionQueueJob): Promise<CaptionJobRecord | null> {
    const record = await getJob(db, job.data.captionJobId)
    if (!record || record.status === 'succeeded' || record.status === 'failed') {
      log({
        event: 'captions.job.skipped',
        captionJobId: job.data.captionJobId,
        status: record?.status ?? null,
      })
      return null
    }
    await markJobRunning(db, record.id, job.attemptsMade + 1)
    return record
  }

  async function store(input: {
    videoId: string
    language: string
    cues: Cue[]
    kind: 'transcript' | 'translation'
    translatedFrom?: string
    provider: string
    providerRef?: string
  }): Promise<void> {
    const vtt = serializeVtt(input.cues)
    const storageKey = captionStorageKey(input.videoId, input.language)
    await deps.storage.put(storageKey, new TextEncoder().encode(vtt), 'text/vtt; charset=utf-8')
    await saveCaption(db, {
      videoId: input.videoId,
      language: input.language,
      kind: input.kind,
      translatedFrom: input.translatedFrom,
      provider: input.provider,
      providerRef: input.providerRef,
      storageKey,
      url: captionApiPath(input.videoId, input.language),
      vtt,
      cueCount: input.cues.length,
      needsReview: input.cues.some((cue) => cue.needsReview),
    })
    await cache.invalidateVideo(input.videoId, input.language)
    await cache.setVtt(input.videoId, input.language, vtt)
  }

  /** Queue a translate job for every requested language that has no caption yet. */
  async function queueTranslations(videoId: string, sourceLanguage: string, languages: string[]) {
    for (const language of languages) {
      if (language === sourceLanguage || (await getCaption(db, videoId, language))) continue
      const { job, created } = await createJob(db, {
        videoId,
        type: 'translate',
        language,
        sourceLanguage,
      })
      if (created) await deps.queues.enqueue('translate', { captionJobId: job.id, videoId })
    }
  }

  return {
    async transcribe(job, signal) {
      const record = await begin(job)
      if (!record) return
      const video = await getVideo(db, record.videoId)
      if (!video) throw new UnrecoverableError(`Video ${record.videoId} no longer exists`)

      let transcript = await getTranscript(db, video.id)
      if (!transcript) {
        const source = { url: video.url, kind: video.sourceKind }
        const info = await probeSource(source, deps.tools, signal)
        if (info.durationSeconds != null && info.durationSeconds > config.maxDurationSeconds) {
          throw new UnrecoverableError(
            `Video is ${Math.round(info.durationSeconds)} s long; the limit is ${config.maxDurationSeconds} s`,
          )
        }
        await updateVideoDetails(db, video.id, info)
        await setJobProgress(db, record.id, 10)

        await mkdir(deps.workDir, { recursive: true })
        const dir = await mkdtemp(join(deps.workDir, `caption-${video.id}-`))
        try {
          const audio = await extractAudio(source, dir, {
            ...deps.tools,
            maxDurationSeconds: config.maxDurationSeconds,
            signal,
          })
          await setJobProgress(db, record.id, 40)
          // Trust the request language when present; otherwise always assume the server default (English).
          const language = normalizeLanguage(record.sourceLanguage ?? config.defaultSourceLanguage)
          const result = await transcribeWithDetails(deps.transcriber, audio, {
            lang: language,
            fallbackLang: config.defaultSourceLanguage,
            signal,
          })
          if (!result.cues.length)
            throw new UnrecoverableError('The transcriber found no speech in this video')
          await store({
            videoId: video.id,
            language,
            cues: result.cues,
            kind: 'transcript',
            provider: deps.transcriber.id,
            providerRef: result.providerRef,
          })
          await updateVideoDetails(db, video.id, { sourceLanguage: language })
          log({
            event: 'captions.transcribed',
            videoId: video.id,
            language,
            cues: result.cues.length,
          })
        } finally {
          await rm(dir, { recursive: true, force: true })
        }
        transcript = await getTranscript(db, video.id)
        if (!transcript) throw new Error('Transcript was not saved')
      }

      await queueTranslations(video.id, transcript.language, record.translateTo)
      await completeJob(db, record.id)
      // Languages added by requests that joined this job while it was finishing.
      const latest = await getJob(db, record.id)
      const late = latest?.translateTo.filter((lang) => !record.translateTo.includes(lang)) ?? []
      if (late.length) await queueTranslations(video.id, transcript.language, late)
    },

    async translate(job, signal) {
      const record = await begin(job)
      if (!record) return
      const target = record.language
      if (!target) throw new UnrecoverableError('Translate job has no target language')
      const transcript = await getTranscript(db, record.videoId)
      if (!transcript)
        throw new UnrecoverableError('No transcript to translate; generate captions first')
      if (transcript.language === target) {
        await completeJob(db, record.id)
        return
      }
      if (!deps.translator) {
        throw new UnrecoverableError('Translation is off on this server (TRANSLATOR=none)')
      }

      const source = parseVtt(transcript.vtt)
      await setJobProgress(db, record.id, 10)
      const translated = await deps.translator.translate(source, {
        from: transcript.language,
        to: target,
        signal,
      })
      // Times always come from the source cues, whatever the translator returned.
      const cues = withTranslatedText(
        source,
        translated.map((cue) => cue.text),
      )
      await store({
        videoId: record.videoId,
        language: target,
        cues,
        kind: 'translation',
        translatedFrom: transcript.language,
        provider: deps.translator.id,
      })
      await completeJob(db, record.id)
      log({
        event: 'captions.translated',
        videoId: record.videoId,
        from: transcript.language,
        to: target,
      })
    },
  }
}
