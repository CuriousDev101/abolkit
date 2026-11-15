import { createStubTts } from '@abolkit/provider-sdk'
import { mkdtempSync, rmSync } from 'node:fs'
import type { DatabaseSync } from 'node:sqlite'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { createApp } from './app.ts'
import { openDatabase } from './db/sqlite.ts'

let root: string
let db: DatabaseSync
let app: ReturnType<typeof createApp>
let synthesizeCalls: number

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'abolkit-job-summaries-'))
  db = openDatabase(':memory:')
  synthesizeCalls = 0
  const stub = createStubTts()
  const tts = {
    ...stub,
    async synthesize(text: string, opts: { lang: 'en' | 'am'; signal?: AbortSignal }) {
      synthesizeCalls += 1
      return stub.synthesize(text, opts)
    },
  }
  app = createApp({
    db,
    tts,
    captions: null,
    env: {
      API_KEY: 'test-key',
      STORAGE_PROVIDER: 'local-disk',
      STORAGE_LOCAL_ROOT: join(root, 'storage'),
      STORAGE_SIGNING_SECRET: 'test-signing-secret',
      DATABASE_URL: ':memory:',
      PUBLIC_BASE_URL: 'http://127.0.0.1:8787',
      TTS: 'stub',
    },
  })
})

afterEach(() => {
  rmSync(root, { recursive: true, force: true })
})

describe('POST /api/job-summaries/audio', () => {
  it('synthesizes once, persists by job id, and reuses cached audio', async () => {
    const body = {
      jobId: 'job-junior-a11y',
      text: 'Junior Accessibility Engineer in Addis Ababa. Full time.',
      lang: 'en',
    }

    const first = await app.request('/api/job-summaries/audio', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    const firstJson = (await first.json()) as {
      jobId: string
      cached: boolean
      audioUrl: string
      textHash: string
      provider: string
    }
    expect(first.status).toBe(200)
    expect(firstJson.jobId).toBe(body.jobId)
    expect(firstJson.cached).toBe(false)
    expect(firstJson.provider).toBe('stub')
    expect(firstJson.audioUrl).toContain('/api/storage/object')
    expect(synthesizeCalls).toBe(1)

    const second = await app.request('/api/job-summaries/audio', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    const secondJson = (await second.json()) as { cached: boolean; textHash: string }
    expect(second.status).toBe(200)
    expect(secondJson.cached).toBe(true)
    expect(secondJson.textHash).toBe(firstJson.textHash)
    expect(synthesizeCalls).toBe(1)

    const get = await app.request(`/api/job-summaries/${body.jobId}`)
    const getJson = (await get.json()) as { jobId: string; cached: boolean }
    expect(get.status).toBe(200)
    expect(getJson.jobId).toBe(body.jobId)
    expect(getJson.cached).toBe(true)

    const audioPath = new URL(firstJson.audioUrl).pathname + new URL(firstJson.audioUrl).search
    const download = await app.request(audioPath)
    expect(download.status).toBe(200)
    expect(download.headers.get('content-type')).toContain('audio/wav')
  })

  it('regenerates when the summary text changes', async () => {
    const jobId = 'job-regen'
    await app.request('/api/job-summaries/audio', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jobId, text: 'First summary.', lang: 'en' }),
    })
    expect(synthesizeCalls).toBe(1)

    const updated = await app.request('/api/job-summaries/audio', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jobId, text: 'Updated summary with new deadline.', lang: 'en' }),
    })
    const json = (await updated.json()) as { cached: boolean }
    expect(updated.status).toBe(200)
    expect(json.cached).toBe(false)
    expect(synthesizeCalls).toBe(2)
  })

  it('rejects non-English requests and works without an API key', async () => {
    const am = await app.request('/api/job-summaries/audio', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jobId: 'j1', text: 'ሰላም', lang: 'am' }),
    })
    expect(am.status).toBe(400)
    expect(((await am.json()) as { error: { code: string } }).error.code).toBe(
      'UNSUPPORTED_LANGUAGE',
    )
    expect(synthesizeCalls).toBe(0)
  })
})
