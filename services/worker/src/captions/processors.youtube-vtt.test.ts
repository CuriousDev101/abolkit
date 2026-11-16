import { mkdtemp } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import type {
  CaptionCache,
  CaptionConfig,
  CaptionJobRecord,
  CaptionQueues,
  Db,
  VideoRecord,
} from '@abolkit/caption-store'
import type { Storage, Transcriber } from '@abolkit/provider-sdk'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@abolkit/caption-store', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@abolkit/caption-store')>()
  return {
    ...actual,
    getJob: vi.fn(),
    markJobRunning: vi.fn(),
    getVideo: vi.fn(),
    getTranscript: vi.fn(),
    getCaption: vi.fn(),
    updateVideoDetails: vi.fn(),
    setJobProgress: vi.fn(),
    saveCaption: vi.fn(),
    completeJob: vi.fn(),
    createJob: vi.fn(),
  }
})

vi.mock('./source.ts', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./source.ts')>()
  return {
    ...actual,
    probeSource: vi.fn(async () => ({ title: 'Demo', durationSeconds: 12 })),
    tryImportYoutubeVtt: vi.fn(),
    extractAudio: vi.fn(async () => {
      throw new Error('extractAudio must not run when YouTube VTT import succeeds')
    }),
  }
})

import {
  completeJob,
  createJob,
  getCaption,
  getJob,
  getTranscript,
  getVideo,
  markJobRunning,
  saveCaption,
  updateVideoDetails,
} from '@abolkit/caption-store'

import { createCaptionProcessors } from './processors.ts'
import { tryImportYoutubeVtt } from './source.ts'

describe('createCaptionProcessors YouTube VTT prefer', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('stores youtube-subs and never calls the transcriber when VTT import succeeds', async () => {
    const workDir = await mkdtemp(join(tmpdir(), 'abol-cap-proc-'))
    const jobRecord: CaptionJobRecord = {
      id: 'job-1',
      videoId: 'vid-1',
      type: 'transcribe',
      language: null,
      sourceLanguage: 'en',
      translateTo: ['am'],
      status: 'queued',
      progress: 0,
      attempts: 0,
      error: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      startedAt: null,
      finishedAt: null,
    }

    const video: VideoRecord = {
      id: 'vid-1',
      url: 'https://www.youtube.com/watch?v=abc',
      sourceUrl: 'https://www.youtube.com/watch?v=abc',
      sourceKind: 'youtube',
      title: null,
      durationSeconds: null,
      sourceLanguage: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    }

    vi.mocked(getJob).mockResolvedValue(jobRecord)
    vi.mocked(markJobRunning).mockResolvedValue(undefined as never)
    vi.mocked(getVideo).mockResolvedValue(video)
    vi.mocked(getTranscript)
      .mockResolvedValueOnce(null)
      .mockResolvedValue({
        id: 'cap-en',
        videoId: 'vid-1',
        language: 'en',
        kind: 'transcript',
        translatedFrom: null,
        provider: 'youtube-subs',
        providerRef: null,
        storageKey: 'videos/vid-1/captions/en.vtt',
        url: '/api/videos/vid-1/captions/en',
        cueCount: 1,
        needsReview: false,
        createdAt: new Date(),
        updatedAt: new Date(),
        vtt: 'WEBVTT\n\n00:00:00.000 --> 00:00:01.000\nFrom YouTube\n',
      })
    vi.mocked(getCaption).mockResolvedValue(null)
    vi.mocked(createJob).mockResolvedValue({
      job: { ...jobRecord, id: 'job-am', type: 'translate', language: 'am' },
      created: true,
    })
    vi.mocked(tryImportYoutubeVtt).mockResolvedValue({
      cues: [{ start: 0, end: 1, text: 'From YouTube' }],
      language: 'en',
      file: join(workDir, 'subs.en.vtt'),
    })
    vi.mocked(saveCaption).mockResolvedValue(undefined as never)
    vi.mocked(updateVideoDetails).mockResolvedValue(undefined as never)
    vi.mocked(completeJob).mockResolvedValue(undefined as never)

    const transcribe = vi.fn(async () => {
      throw new Error('AssemblyAI / TRANSCRIBER must not be called')
    })
    const transcriber = {
      id: 'assemblyai',
      sendsDataOffHost: true,
      transcribe,
    } as unknown as Transcriber

    const storage = {
      id: 'memory',
      sendsDataOffHost: false,
      put: vi.fn(async () => undefined),
    } as unknown as Storage

    const cache = {
      invalidateVideo: vi.fn(async () => undefined),
      setVtt: vi.fn(async () => undefined),
    } as unknown as CaptionCache

    const queues = {
      enqueue: vi.fn(async () => undefined),
      close: vi.fn(async () => undefined),
    } as unknown as CaptionQueues

    const config = {
      maxDurationSeconds: 3600,
      defaultSourceLanguage: 'en',
    } as CaptionConfig

    const events: Array<Record<string, unknown>> = []
    const processors = createCaptionProcessors({
      db: {} as Db,
      cache,
      queues,
      storage,
      transcriber,
      translator: null,
      config,
      tools: {},
      workDir,
      log: (event) => events.push(event),
    })

    await processors.transcribe({
      data: { captionJobId: 'job-1', videoId: 'vid-1' },
      attemptsMade: 0,
    } as never)

    expect(transcribe).not.toHaveBeenCalled()
    expect(saveCaption).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        language: 'en',
        kind: 'transcript',
        provider: 'youtube-subs',
      }),
    )
    expect(events.some((e) => e.event === 'captions.imported_youtube_vtt')).toBe(true)
  })
})
