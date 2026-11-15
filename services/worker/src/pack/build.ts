import { JobError, type JsonObject } from '@abolkit/jobs'
import type { Storage } from '@abolkit/provider-sdk'

import {
  captionsKey,
  descriptionsKey,
  offlinePackKey,
  opusAudioKey,
  transcriptKey,
  video240pKey,
} from '../ffmpeg/keys.ts'
import type { Logger } from '../runner.ts'
import {
  captionFileName,
  descriptionFileName,
  labelForLang,
  renderIndexHtml,
  renderTranscriptHtml,
  type PackCaptionTrack,
  type PackDescriptionTrack,
} from './html.ts'
import { buildZip, type ZipEntry } from './zip.ts'

const DEFAULT_LANGS = ['en', 'am'] as const

export type PackSizeEntry = {
  name: string
  bytes: number
}

/** Shape stored on the offline-pack job result and logged for docs / pitch. */
export type PackSizeReport = {
  assetId: string
  packKey: string
  /** Compressed zip size on the wire. */
  zipBytes: number
  /** Sum of member file sizes before zip compression. */
  membersBytes: number
  files: PackSizeEntry[]
}

export type BuildOfflinePackOptions = {
  storage: Storage
  assetId: string
  /** Shown in index.html / transcript. */
  title?: string
  /** HTML lang + default caption preference. */
  lang?: string
  /** Which caption langs to look up (missing langs are skipped). */
  langs?: string[]
  /** Include optional 240p video (larger pack). Default false. */
  includeVideo?: boolean
  /** Override storage object keys when testing. */
  opusObjectKey?: string
  videoObjectKey?: string
  transcriptObjectKey?: string
  packObjectKey?: string
  signal?: AbortSignal
  progress?: (value: number) => void
  log?: Logger
  now?: Date
}

export type BuildOfflinePackResult = JsonObject & {
  packKey: string
  audioFile: string
  transcriptFile: string
  captionFiles: string[]
  descriptionFiles: string[]
  videoFile: string | null
  sizes: PackSizeReport
  totalBytes: number
}

function asBool(value: unknown, fallback: boolean): boolean {
  if (typeof value === 'boolean') return value
  if (typeof value === 'string') {
    const v = value.trim().toLowerCase()
    if (['1', 'true', 'yes', 'on'].includes(v)) return true
    if (['0', 'false', 'no', 'off'].includes(v)) return false
  }
  return fallback
}

function asStringList(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined
  const out = value
    .filter((v): v is string => typeof v === 'string')
    .map((v) => v.trim().toLowerCase())
    .filter(Boolean)
  return out.length ? out : undefined
}

/** Read pack options from a job `params` object. */
export function packParamsFromJob(params: JsonObject): {
  title?: string
  lang?: string
  langs?: string[]
  includeVideo: boolean
} {
  return {
    title: typeof params.title === 'string' ? params.title : undefined,
    lang: typeof params.lang === 'string' ? params.lang : undefined,
    langs: asStringList(params.langs) ?? asStringList(params.languages),
    includeVideo: asBool(params.includeVideo, false),
  }
}

/**
 * Assemble the static offline pack (#35): Opus + captions + transcript + index.html → zip.
 * Requires renditions from #26 and captions from #27/#28 when available.
 */
export async function buildOfflinePack(
  options: BuildOfflinePackOptions,
): Promise<BuildOfflinePackResult> {
  const { storage, assetId, signal, progress, log } = options
  const title = options.title?.trim() || `Lesson ${assetId.slice(0, 8)}`
  const lang = (options.lang?.trim() || 'en').toLowerCase()
  const langs = (options.langs?.length ? options.langs : [...DEFAULT_LANGS]).map((l) =>
    l.trim().toLowerCase(),
  )
  const includeVideo = options.includeVideo === true
  const opusKey = options.opusObjectKey ?? opusAudioKey(assetId)
  const videoKey = options.videoObjectKey ?? video240pKey(assetId)
  const transcriptObjKey = options.transcriptObjectKey ?? transcriptKey(assetId)
  const packKey = options.packObjectKey ?? offlinePackKey(assetId)

  progress?.(5)
  throwIfAborted(signal)

  const opus = await storage.get(opusKey)
  if (!opus) {
    throw new JobError(
      `Opus audio not found: ${opusKey}. Run a transcribe / ffmpeg job (#26) before offline-pack.`,
      { retryable: false },
    )
  }

  progress?.(20)

  const captions: PackCaptionTrack[] = []
  for (const code of langs) {
    throwIfAborted(signal)
    const object = await storage.get(captionsKey(assetId, code))
    if (!object) continue
    const vtt = new TextDecoder().decode(object.bytes)
    captions.push({
      lang: code,
      label: labelForLang(code),
      fileName: captionFileName(code),
      vtt,
    })
  }

  if (captions.length === 0) {
    throw new JobError(
      `No caption tracks found under assets/${assetId}/captions/. Produce captions (#27/#28) before offline-pack.`,
      { retryable: false },
    )
  }

  const descriptions: PackDescriptionTrack[] = []
  for (const code of langs) {
    throwIfAborted(signal)
    const object = await storage.get(descriptionsKey(assetId, code))
    if (!object) continue
    const vtt = new TextDecoder().decode(object.bytes)
    descriptions.push({
      lang: code,
      label: labelForLang(code),
      fileName: descriptionFileName(code),
      vtt,
    })
  }

  progress?.(40)

  const storedTranscript = await storage.get(transcriptObjKey)
  const transcriptHtml = storedTranscript
    ? new TextDecoder().decode(storedTranscript.bytes)
    : renderTranscriptHtml({ title, lang, captions, descriptions })

  // Persist generated transcript so #28 / lesson APIs can reuse it.
  if (!storedTranscript) {
    await storage.put(
      transcriptObjKey,
      new TextEncoder().encode(transcriptHtml),
      'text/html; charset=utf-8',
    )
  }

  progress?.(55)

  let videoBytes: Uint8Array | null = null
  if (includeVideo) {
    const video = await storage.get(videoKey)
    if (!video) {
      throw new JobError(
        `Video rendition not found: ${videoKey}. Re-run ffmpeg (#26) or set includeVideo=false.`,
        { retryable: false },
      )
    }
    videoBytes = video.bytes
  }

  progress?.(65)

  const indexHtml = renderIndexHtml({
    title,
    lang,
    captions,
    descriptions,
    includeVideo: videoBytes != null,
  })

  const entries: ZipEntry[] = [
    { name: 'index.html', data: new TextEncoder().encode(indexHtml) },
    { name: 'lesson.opus', data: opus.bytes },
    { name: 'transcript.html', data: new TextEncoder().encode(transcriptHtml) },
    ...captions.map((c) => ({
      name: c.fileName,
      data: new TextEncoder().encode(c.vtt),
    })),
    ...descriptions.map((d) => ({
      name: d.fileName,
      data: new TextEncoder().encode(d.vtt),
    })),
  ]
  if (videoBytes) {
    entries.push({ name: 'lesson-240p.mp4', data: videoBytes })
  }

  throwIfAborted(signal)
  const zipBytes = buildZip(entries, options.now)
  progress?.(85)

  await storage.put(packKey, zipBytes, 'application/zip')
  progress?.(95)

  const files: PackSizeEntry[] = entries.map((e) => ({ name: e.name, bytes: e.data.byteLength }))
  const membersBytes = files.reduce((sum, f) => sum + f.bytes, 0)
  const sizes: PackSizeReport = {
    assetId,
    packKey,
    zipBytes: zipBytes.byteLength,
    membersBytes,
    files,
  }

  log?.({
    event: 'offline-pack.sizes',
    assetId,
    packKey,
    zipBytes: sizes.zipBytes,
    membersBytes: sizes.membersBytes,
    files: sizes.files,
  })

  progress?.(100)

  return {
    packKey,
    audioFile: 'lesson.opus',
    transcriptFile: 'transcript.html',
    captionFiles: captions.map((c) => c.fileName),
    descriptionFiles: descriptions.map((d) => d.fileName),
    videoFile: videoBytes ? 'lesson-240p.mp4' : null,
    sizes,
    totalBytes: sizes.zipBytes,
  }
}

function throwIfAborted(signal: AbortSignal | undefined): void {
  if (signal?.aborted) {
    throw new JobError('offline-pack aborted', { retryable: true })
  }
}
