// #24 proof: multipart upload, metadata, signed local-disk download, limits, API key.

import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { createApp } from '../src/app.ts'

async function main() {
  const root = mkdtempSync(join(tmpdir(), 'abolkit-assets-'))
  const env = {
    PORT: '0',
    CORS_ORIGIN: '*',
    API_KEY: 'smoke-key',
    STORAGE_PROVIDER: 'local-disk',
    STORAGE_LOCAL_ROOT: join(root, 'storage'),
    STORAGE_SIGNING_SECRET: 'smoke-signing-secret',
    DATABASE_URL: ':memory:',
    ASSET_MAX_BYTES: '1024',
    ASSET_RETENTION_DAYS: '7',
    SIGNED_URL_TTL_SECONDS: '60',
    ASSET_ALLOWED_MIME: 'video/mp4,audio/mpeg,application/octet-stream',
  }

  try {
    const app = createApp(env)

    const denied = await app.request('/api/assets', { method: 'POST' })
    assert(denied.status === 401, `upload without key → ${denied.status}`)

    const form = new FormData()
    form.set('file', new File([Buffer.from('fake-mp4-bytes')], 'lesson.mp4', { type: 'video/mp4' }))
    form.set('retentionDays', '3')

    const created = await app.request('/api/assets', {
      method: 'POST',
      headers: { 'X-API-Key': 'smoke-key' },
      body: form,
    })
    const createdBody = (await created.json()) as { id?: string; error?: { code?: string } }
    assert(created.status === 201, `create status ${created.status} ${JSON.stringify(createdBody)}`)
    assert(typeof createdBody.id === 'string', 'create id')

    const meta = await app.request(`/api/assets/${createdBody.id}`)
    const asset = (await meta.json()) as {
      id?: string
      mime?: string
      sizeBytes?: number
      retentionDays?: number
      downloadUrl?: string
      error?: { code?: string }
    }
    assert(meta.status === 200, `meta status ${meta.status}`)
    assert(asset.id === createdBody.id, 'meta id')
    assert(asset.mime === 'video/mp4', `mime ${asset.mime}`)
    assert(asset.sizeBytes === 14, `size ${asset.sizeBytes}`)
    assert(asset.retentionDays === 3, `retention ${asset.retentionDays}`)
    assert(typeof asset.downloadUrl === 'string' && asset.downloadUrl.includes('/api/storage/object'), 'signed url')

    const download = await app.request(asset.downloadUrl!)
    const bytes = Buffer.from(await download.arrayBuffer())
    assert(download.status === 200, `download status ${download.status}`)
    assert(download.headers.get('content-type')?.includes('video/mp4') === true, 'download mime')
    assert(bytes.equals(Buffer.from('fake-mp4-bytes')), 'download bytes')

    const badSig = await app.request('/api/storage/object?key=assets/x/source&exp=9999999999&sig=dead')
    assert(badSig.status === 401, `bad sig ${badSig.status}`)

    const huge = new FormData()
    huge.set('file', new File([Buffer.alloc(2048)], 'big.mp4', { type: 'video/mp4' }))
    const tooBig = await app.request('/api/assets', {
      method: 'POST',
      headers: { 'X-API-Key': 'smoke-key' },
      body: huge,
    })
    const tooBigBody = (await tooBig.json()) as { error?: { code?: string } }
    assert(tooBig.status === 413 && tooBigBody.error?.code === 'PAYLOAD_TOO_LARGE', 'size limit')

    const wrongType = new FormData()
    wrongType.set('file', new File([Buffer.from('x')], 'x.txt', { type: 'text/plain' }))
    const unsupported = await app.request('/api/assets', {
      method: 'POST',
      headers: { 'X-API-Key': 'smoke-key' },
      body: wrongType,
    })
    const unsupportedBody = (await unsupported.json()) as { error?: { code?: string } }
    assert(
      unsupported.status === 415 && unsupportedBody.error?.code === 'UNSUPPORTED_MEDIA_TYPE',
      'mime limit',
    )

    const spec = (await (await app.request('/openapi.json')).json()) as {
      paths?: Record<string, unknown>
    }
    const paths = Object.keys(spec.paths ?? {})
    assert(paths.includes('/api/assets'), 'openapi has POST /api/assets')
    assert(paths.includes('/api/assets/{id}'), 'openapi has GET /api/assets/{id}')
    assert(paths.includes('/api/storage/object'), 'openapi has signed download')

    console.log(
      JSON.stringify({
        ok: true,
        issue: 24,
        assetId: createdBody.id,
        storage: 'local-disk',
        paths,
      }),
    )
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message)
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : err)
  process.exitCode = 1
})
