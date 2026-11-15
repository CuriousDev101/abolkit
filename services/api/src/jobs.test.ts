import { mkdtempSync, rmSync } from 'node:fs'
import type { DatabaseSync } from 'node:sqlite'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { createApp } from './app.ts'
import { insertAsset } from './db/assets.ts'
import { openDatabase } from './db/sqlite.ts'

const KEY = 'test-key'
const MISSING = '99999999-9999-4999-8999-999999999999'

let root: string
let db: DatabaseSync
let app: ReturnType<typeof createApp>

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'abolkit-jobs-'))
  db = openDatabase(':memory:')
  app = createApp({
    db,
    env: {
      API_KEY: KEY,
      STORAGE_PROVIDER: 'local-disk',
      STORAGE_LOCAL_ROOT: join(root, 'storage'),
      STORAGE_SIGNING_SECRET: 'test-signing-secret',
      DATABASE_URL: ':memory:',
      JOB_MAX_ATTEMPTS: '4',
    },
  })
})

afterEach(() => {
  rmSync(root, { recursive: true, force: true })
})

function seedAsset(retentionDays = 7, createdAt = new Date()) {
  return insertAsset(db, {
    storageKey: `assets/${crypto.randomUUID()}/source`,
    originalName: 'lesson.mp4',
    mime: 'video/mp4',
    sizeBytes: 10,
    retentionDays,
    createdAt,
  })
}

function postJob(assetId: string, body: unknown, key: string | null = KEY) {
  return app.request(`/api/assets/${assetId}/jobs`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(key ? { 'X-API-Key': key } : {}),
    },
    body: JSON.stringify(body),
  })
}

describe('POST /api/assets/:id/jobs', () => {
  it('queues a job and GET /api/jobs/:id returns it', async () => {
    const asset = seedAsset()
    const res = await postJob(asset.id, { type: 'transcribe', params: { language: 'am' } })
    const job = (await res.json()) as Record<string, unknown>

    expect(res.status).toBe(202)
    expect(res.headers.get('location')).toBe(`/api/jobs/${job.id}`)
    expect(job).toMatchObject({
      assetId: asset.id,
      type: 'transcribe',
      status: 'queued',
      progress: 0,
      attempts: 0,
      maxAttempts: 4,
      error: null,
      result: null,
      params: { language: 'am' },
      startedAt: null,
      finishedAt: null,
    })
    expect(typeof job.nextAttemptAt).toBe('string')

    const status = await app.request(`/api/jobs/${job.id}`)
    expect(status.status).toBe(200)
    expect(await status.json()).toEqual(job)
  })

  it('requires the API key', async () => {
    const asset = seedAsset()
    expect((await postJob(asset.id, { type: 'transcribe' }, null)).status).toBe(401)
    expect((await postJob(asset.id, { type: 'transcribe' }, 'wrong')).status).toBe(401)
  })

  it('rejects unknown job types', async () => {
    const asset = seedAsset()
    const res = await postJob(asset.id, { type: 'mine-bitcoin' })
    const body = (await res.json()) as { error?: { code?: string } }
    expect(res.status).toBe(400)
    expect(body.error?.code).toBe('VALIDATION')
  })

  it('returns 404 for a missing asset and 410 for an expired one', async () => {
    expect((await postJob(MISSING, { type: 'transcribe' })).status).toBe(404)

    const expired = seedAsset(1, new Date(Date.now() - 2 * 86_400_000))
    expect((await postJob(expired.id, { type: 'transcribe' })).status).toBe(410)
  })
})

describe('GET /api/jobs/:id', () => {
  it('returns 404 for an unknown job and 400 for a malformed id', async () => {
    expect((await app.request(`/api/jobs/${MISSING}`)).status).toBe(404)
    expect((await app.request('/api/jobs/not-a-uuid')).status).toBe(400)
  })

  it('is listed in the OpenAPI spec with the job create route', async () => {
    const spec = (await (await app.request('/openapi.json')).json()) as {
      paths?: Record<string, unknown>
    }
    expect(Object.keys(spec.paths ?? {})).toEqual(
      expect.arrayContaining(['/api/assets/{id}/jobs', '/api/jobs/{id}']),
    )
  })
})
