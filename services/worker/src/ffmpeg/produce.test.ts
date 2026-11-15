import { mkdir, mkdtemp, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { JobError } from '@abolkit/jobs'
import { createLocalDiskStorage } from '@abolkit/provider-sdk'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { audio16kKey, opusAudioKey, sourceKey, video240pKey } from './keys.ts'
import { produceAssetMedia } from './produce.ts'

const ASSET = '22222222-2222-4222-8222-222222222222'

let root: string
let workDir: string

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), 'abolkit-ffmpeg-test-'))
  workDir = join(root, 'work')
  await mkdir(workDir, { recursive: true })
})

afterEach(async () => {
  const { rm } = await import('node:fs/promises')
  await rm(root, { recursive: true, force: true })
})

function storage() {
  return createLocalDiskStorage({
    root: join(root, 'storage'),
    signingSecret: 'test-signing-secret',
  })
}

describe('produceAssetMedia', () => {
  it('writes all three outputs, logs sizes, and cleans the work dir', async () => {
    const store = storage()
    await store.put(sourceKey(ASSET), new Uint8Array([1, 2, 3, 4]), 'video/mp4')

    const logged: Record<string, unknown>[] = []
    const result = await produceAssetMedia({
      storage: store,
      assetId: ASSET,
      workDir,
      log: (event) => logged.push(event),
      run: async (args) => {
        // Last arg is always the output path for our recipes.
        const out = args[args.length - 1]!
        await writeFile(out, Buffer.from(`fake:${out}`))
      },
    })

    expect(result.audio16kKey).toBe(audio16kKey(ASSET))
    expect(result.opusAudioKey).toBe(opusAudioKey(ASSET))
    expect(result.video240pKey).toBe(video240pKey(ASSET))

    expect(result.sizes.outputs).toHaveLength(3)
    expect(result.sizes.totalBytes).toBeGreaterThan(0)
    expect(logged.some((e) => e.event === 'ffmpeg.sizes')).toBe(true)

    expect(await store.get(audio16kKey(ASSET))).not.toBeNull()
    expect(await store.get(opusAudioKey(ASSET))).not.toBeNull()
    expect(await store.get(video240pKey(ASSET))).not.toBeNull()
  })

  it('fails non-retryably when the source object is missing', async () => {
    await expect(
      produceAssetMedia({
        storage: storage(),
        assetId: ASSET,
        workDir,
        run: async () => {},
      }),
    ).rejects.toSatisfy((err: unknown) => err instanceof JobError && err.retryable === false)
  })
})
