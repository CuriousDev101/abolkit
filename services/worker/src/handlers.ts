import { JobError, JOB_TYPES, type JobType } from '@abolkit/jobs'
import type { Storage, Transcriber } from '@abolkit/provider-sdk'

import { produceAssetMedia, type RunFfmpeg } from './ffmpeg/index.ts'
import { buildOfflinePack, packParamsFromJob } from './pack/index.ts'
import type { JobHandler, JobHandlers, Logger } from './runner.ts'
import { langFromJobParams, transcribeStoredAudio } from './stt/index.ts'

const PLANNED_IN: Record<JobType, string> = {
  transcribe: '#27 (STT via provider adapter)',
  translate: 'a later pipeline issue',
  'describe-tts': 'a later pipeline issue',
  'offline-pack': '#35 (static zip + size report)',
}

function notImplemented(type: JobType): JobHandler {
  return async () => {
    throw new JobError(`Job type "${type}" is not implemented yet (lands in ${PLANNED_IN[type]})`, {
      retryable: false,
    })
  }
}

export type HandlerDeps = {
  /** Required for ffmpeg extract + renditions (#26), captions (#27), and pack (#35). */
  storage?: Storage
  /** Required for STT (#27). Models stay outside this process. */
  transcriber?: Transcriber
  workDir?: string
  ffmpegBin?: string
  runFfmpeg?: RunFfmpeg
  log?: Logger
}

/**
 * Every job type has a handler so no job sits queued forever.
 * #26: ffmpeg extract + Opus + 240p.
 * #27: Transcriber adapter → WebVTT cues marked needsReview.
 * #35: offline pack zip (Opus + transcript HTML + captions + index.html) + size report.
 */
export function createDefaultHandlers(deps: HandlerDeps = {}): JobHandlers {
  const handlers = Object.fromEntries(
    JOB_TYPES.map((type) => [type, notImplemented(type)]),
  ) as JobHandlers

  if (deps.storage) {
    const storage = deps.storage

    handlers['offline-pack'] = async (job, ctx) => {
      const params = packParamsFromJob(job.params)
      return buildOfflinePack({
        storage,
        assetId: job.assetId,
        title: params.title,
        lang: params.lang,
        langs: params.langs,
        includeVideo: params.includeVideo,
        includeBraille: params.includeBraille,
        brailleTable: params.brailleTable,
        signal: ctx.signal,
        progress: ctx.progress,
        log: deps.log,
      })
    }

    if (deps.transcriber) {
      const transcriber = deps.transcriber
      handlers.transcribe = async (job, ctx) => {
        const media = await produceAssetMedia({
          storage,
          assetId: job.assetId,
          workDir: deps.workDir,
          signal: ctx.signal,
          progress: (value) => ctx.progress(Math.min(70, Math.round(value * 0.7))),
          bin: deps.ffmpegBin,
          run: deps.runFfmpeg,
          log: deps.log,
        })

        const lang = langFromJobParams(job.params)
        const stt = await transcribeStoredAudio({
          storage,
          transcriber,
          assetId: job.assetId,
          lang,
          audioObjectKey: media.audio16kKey,
          workDir: deps.workDir,
          signal: ctx.signal,
          progress: ctx.progress,
          log: deps.log,
        })

        ctx.progress(100)

        return {
          audio16kKey: media.audio16kKey,
          opusAudioKey: media.opusAudioKey,
          video240pKey: media.video240pKey,
          sizes: media.sizes,
          lang: stt.lang,
          captionsKey: stt.captionsKey,
          cueCount: stt.cueCount,
          needsReview: true,
          transcriber: stt.transcriber,
          sendsDataOffHost: stt.sendsDataOffHost,
        }
      }
    }
  }

  return handlers
}
