import type { OpenAPIHono } from '@hono/zod-openapi'
import type { Storage, Tts } from '@abolkit/provider-sdk'
import type { DatabaseSync } from 'node:sqlite'

import type { ApiConfig } from '../config.ts'
import { HttpError } from '../http.ts'
import { ensureJobSummaryAudioRoute, getJobSummaryAudioRoute } from './routes.ts'
import { createJobSummaryService, type JobSummaryService } from './service.ts'

/** Paths served by the public job-summary API; the API-key middleware skips them. */
export function isJobSummaryPath(path: string): boolean {
  return path === '/api/job-summaries/audio' || path.startsWith('/api/job-summaries/')
}

export function registerJobSummaryRoutes(
  app: OpenAPIHono,
  deps: {
    db: DatabaseSync | undefined
    storage: Storage
    config: ApiConfig
    tts: Tts | null
  },
) {
  const service =
    deps.db && deps.tts
      ? createJobSummaryService({
          db: deps.db,
          storage: deps.storage,
          config: deps.config,
          tts: deps.tts,
          voiceId: deps.config.env.ASSEMBLYAI_TTS_VOICE_ID,
        })
      : null

  const need = (): JobSummaryService => {
    if (!deps.db) {
      throw new HttpError(
        503,
        'JOB_SUMMARIES_DISABLED',
        'Job summary audio needs DATABASE_URL (SQLite) on the API',
      )
    }
    if (!deps.tts) {
      throw new HttpError(
        503,
        'JOB_SUMMARIES_DISABLED',
        'Job summary audio needs TTS=assemblyai (or TTS=stub for local tests) and ASSEMBLYAI_API_KEY when using AssemblyAI',
      )
    }
    if (!service) {
      throw new HttpError(503, 'JOB_SUMMARIES_DISABLED', 'Job summary audio is unavailable')
    }
    return service
  }

  app.openapi(ensureJobSummaryAudioRoute, async (c) => {
    const body = c.req.valid('json')
    const out = await need().ensureAudio(body)
    return c.json(out, 200)
  })

  app.openapi(getJobSummaryAudioRoute, async (c) => {
    const { jobId } = c.req.valid('param')
    const out = await need().getAudio(jobId)
    return c.json(out, 200)
  })
}
