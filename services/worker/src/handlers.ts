import { JobError, JOB_TYPES, type JobType } from '@abolkit/jobs'
import type { Storage } from '@abolkit/provider-sdk'

import { produceAssetMedia, type RunFfmpeg } from './ffmpeg/index.ts'
import type { JobHandler, JobHandlers, Logger } from './runner.ts'

const PLANNED_IN: Record<JobType, string> = {
  transcribe: '#27 (STT via external MMS)',
  translate: 'a later pipeline issue',
  'describe-tts': 'a later pipeline issue',
  'offline-pack': 'a later pipeline issue',
}

function notImplemented(type: JobType): JobHandler {
  return async () => {
    throw new JobError(`Job type "${type}" is not implemented yet (lands in ${PLANNED_IN[type]})`, {
      retryable: false,
    })
  }
}

export type HandlerDeps = {
  /** Required to run ffmpeg extraction + renditions (#26). */
  storage?: Storage
  workDir?: string
  ffmpegBin?: string
  runFfmpeg?: RunFfmpeg
  log?: Logger
}

/**
 * Every job type has a handler so no job sits queued forever.
 * #26 wires ffmpeg into `transcribe` (extract + Opus + 240p, size report).
 * STT itself stays in the separate MMS service and lands in #27.
 */
export function createDefaultHandlers(deps: HandlerDeps = {}): JobHandlers {
  const handlers = Object.fromEntries(
    JOB_TYPES.map((type) => [type, notImplemented(type)]),
  ) as JobHandlers

  if (deps.storage) {
    const storage = deps.storage
    handlers.transcribe = async (job, ctx) => {
      const result = await produceAssetMedia({
        storage,
        assetId: job.assetId,
        workDir: deps.workDir,
        signal: ctx.signal,
        progress: ctx.progress,
        bin: deps.ffmpegBin,
        run: deps.runFfmpeg,
        log: deps.log,
      })

      return {
        // Media ready for #27 STT (external service) and for the offline pack.
        audio16kKey: result.audio16kKey,
        opusAudioKey: result.opusAudioKey,
        video240pKey: result.video240pKey,
        sizes: result.sizes,
        // Explicit so operators know transcription is the next issue.
        stt: 'pending-#27',
      }
    }
  }

  return handlers
}
