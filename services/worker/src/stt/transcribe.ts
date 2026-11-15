import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { serializeVtt, type Cue } from '@abolkit/core'
import { JobError } from '@abolkit/jobs'
import { ProviderError, type LangCode, type Storage, type Transcriber } from '@abolkit/provider-sdk'

import { audio16kKey, captionsKey } from '../ffmpeg/keys.ts'
import type { Logger } from '../runner.ts'

export type TranscribeAudioOptions = {
  storage: Storage
  transcriber: Transcriber
  assetId: string
  lang: LangCode
  /** Override the 16 kHz object key (defaults to audio16kKey). */
  audioObjectKey?: string
  workDir?: string
  signal?: AbortSignal
  progress?: (value: number) => void
  log?: Logger
}

export type TranscribeAudioResult = {
  lang: LangCode
  captionsKey: string
  cueCount: number
  needsReview: true
  transcriber: string
  sendsDataOffHost: boolean
  cues: Cue[]
}

/** Mark every machine cue as needing human review (ADR 0003). */
export function markNeedsReview(cues: readonly Cue[]): Cue[] {
  return cues.map((cue, i) => ({
    ...cue,
    id: cue.id ?? `cue-${i + 1}`,
    needsReview: true,
  }))
}

function mapProviderError(err: unknown): never {
  if (err instanceof ProviderError) {
    const retryable = err.code === 'UNREACHABLE' || (err.status != null && err.status >= 500)
    throw new JobError(err.message, { retryable, cause: err })
  }
  throw err
}

/**
 * Download the 16 kHz extract, call the Transcriber adapter, store WebVTT.
 * STT models live outside this repo — only the adapter runs here (#27).
 */
export async function transcribeStoredAudio(
  options: TranscribeAudioOptions,
): Promise<TranscribeAudioResult> {
  const { storage, transcriber, assetId, lang, signal, progress, log } = options
  const audioKey = options.audioObjectKey ?? audio16kKey(assetId)
  const outKey = captionsKey(assetId, lang)

  progress?.(72)

  const audio = await storage.get(audioKey)
  if (!audio) {
    throw new JobError(`STT audio not found: ${audioKey}`, { retryable: false })
  }

  const root = options.workDir?.trim() || join(tmpdir(), 'abolkit-worker')
  await mkdir(root, { recursive: true })
  const work = await mkdtemp(join(root, `${assetId}-stt-`))

  try {
    const audioPath = join(work, '16k-mono.mp3')
    await writeFile(audioPath, audio.bytes)
    progress?.(80)

    let raw: Cue[]
    try {
      raw = await transcriber.transcribe(audioPath, { lang, signal })
    } catch (err) {
      mapProviderError(err)
    }

    const cues = markNeedsReview(raw)
    const vtt = serializeVtt(cues)
    await storage.put(outKey, new TextEncoder().encode(vtt), 'text/vtt')
    progress?.(98)

    log?.({
      event: 'stt.done',
      assetId,
      lang,
      captionsKey: outKey,
      cueCount: cues.length,
      transcriber: transcriber.id,
      sendsDataOffHost: transcriber.sendsDataOffHost,
      needsReview: true,
    })

    return {
      lang,
      captionsKey: outKey,
      cueCount: cues.length,
      needsReview: true,
      transcriber: transcriber.id,
      sendsDataOffHost: transcriber.sendsDataOffHost,
      cues,
    }
  } finally {
    await rm(work, { recursive: true, force: true }).catch(() => {})
  }
}
