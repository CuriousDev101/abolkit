import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { JobError } from '@abolkit/jobs'
import type { Storage } from '@abolkit/provider-sdk'

import { audio16kKey, opusAudioKey, sourceKey, video240pKey } from './keys.ts'
import { encodeOpus24k, encodeVideo240p, extract16kMono } from './recipes.ts'
import type { RunFfmpeg } from './run.ts'

export type MediaSizeEntry = {
  key: string
  bytes: number
  role: 'stt-audio' | 'opus-audio' | 'video-240p'
}

/** Shape stored on the job result and logged for the offline-pack report. */
export type MediaSizeReport = {
  assetId: string
  outputs: MediaSizeEntry[]
  totalBytes: number
}

export type ProduceAssetMediaOptions = {
  storage: Storage
  assetId: string
  /** Parent directory for a unique temp work folder. */
  workDir?: string
  signal?: AbortSignal
  /** 0–100 progress callback. */
  progress?: (value: number) => void
  bin?: string
  run?: RunFfmpeg
  /** Override source object key (defaults to assets/{id}/source). */
  sourceObjectKey?: string
  log?: (event: Record<string, unknown>) => void
}

export type ProduceAssetMediaResult = {
  sourceKey: string
  audio16kKey: string
  opusAudioKey: string
  video240pKey: string
  sizes: MediaSizeReport
}

/**
 * Download the uploaded source, run spike #9 recipes, upload outputs, log sizes.
 * Does not call STT — that stays in the separate MMS service (#27).
 */
export async function produceAssetMedia(
  options: ProduceAssetMediaOptions,
): Promise<ProduceAssetMediaResult> {
  const { storage, assetId, signal, progress, bin, run, log } = options
  const srcKey = options.sourceObjectKey ?? sourceKey(assetId)
  const outAudio = audio16kKey(assetId)
  const outOpus = opusAudioKey(assetId)
  const outVideo = video240pKey(assetId)

  progress?.(5)

  const object = await storage.get(srcKey)
  if (!object) {
    throw new JobError(`Source media not found: ${srcKey}`, { retryable: false })
  }

  const root = options.workDir?.trim() || join(tmpdir(), 'abolkit-worker')
  await mkdir(root, { recursive: true })
  const work = await mkdtemp(join(root, `${assetId}-`))

  const recipeOpts = { signal, bin, run }

  try {
    const inputPath = join(work, 'source')
    const audioPath = join(work, '16k-mono.mp3')
    const opusPath = join(work, 'audio.opus')
    const videoPath = join(work, 'video-240p.mp4')

    await writeFile(inputPath, object.bytes)
    progress?.(15)

    await extract16kMono(inputPath, audioPath, recipeOpts)
    progress?.(40)

    await encodeOpus24k(inputPath, opusPath, recipeOpts)
    progress?.(65)

    await encodeVideo240p(inputPath, videoPath, recipeOpts)
    progress?.(85)

    const audioBytes = await readFile(audioPath)
    const opusBytes = await readFile(opusPath)
    const videoBytes = await readFile(videoPath)

    await storage.put(outAudio, new Uint8Array(audioBytes), 'audio/mpeg')
    await storage.put(outOpus, new Uint8Array(opusBytes), 'audio/opus')
    await storage.put(outVideo, new Uint8Array(videoBytes), 'video/mp4')
    progress?.(95)

    const sizes: MediaSizeReport = {
      assetId,
      outputs: [
        { key: outAudio, bytes: audioBytes.byteLength, role: 'stt-audio' },
        { key: outOpus, bytes: opusBytes.byteLength, role: 'opus-audio' },
        { key: outVideo, bytes: videoBytes.byteLength, role: 'video-240p' },
      ],
      totalBytes: audioBytes.byteLength + opusBytes.byteLength + videoBytes.byteLength,
    }

    log?.({
      event: 'ffmpeg.sizes',
      assetId,
      sizes: sizes.outputs,
      totalBytes: sizes.totalBytes,
    })

    progress?.(100)

    return {
      sourceKey: srcKey,
      audio16kKey: outAudio,
      opusAudioKey: outOpus,
      video240pKey: outVideo,
      sizes,
    }
  } finally {
    await rm(work, { recursive: true, force: true }).catch(() => {})
  }
}
