import { readFile } from 'node:fs/promises'
import path from 'node:path'
import type { Cue } from '@abolkit/core'
import { ProviderError } from '../errors.js'
import type { LangCode, Transcriber } from '../types.js'

/** Successful body from the external MMS ASR wrapper (see spikes/07-stt/contract.md). */
export interface MmsTranscribeResponse {
  text: string
  lang: string
  segments?: Array<{ start: number; end: number; text: string }>
  sendsDataOffHost?: boolean
  model?: string
  durationMs?: number
  needsReview?: boolean
}

export interface MmsHttpTranscriberOptions {
  /** Base URL with no trailing slash, e.g. http://mms-stt:8000 */
  baseUrl: string
  /** Override file reader (tests). Defaults to node:fs. */
  readFile?: (audioPath: string) => Promise<Uint8Array>
  fetch?: typeof fetch
  /**
   * False when the wrapper is our self-hosted service (Compose/EC2 we control).
   * True only if this URL were a third-party SaaS.
   */
  sendsDataOffHost?: boolean
}

function mimeFor(audioPath: string): string {
  const ext = path.extname(audioPath).toLowerCase()
  switch (ext) {
    case '.wav':
      return 'audio/wav'
    case '.mp3':
      return 'audio/mpeg'
    case '.m4a':
      return 'audio/mp4'
    case '.webm':
      return 'audio/webm'
    case '.ogg':
    case '.opus':
      return 'audio/ogg'
    default:
      return 'application/octet-stream'
  }
}

function toCues(body: MmsTranscribeResponse): Cue[] {
  const needsReview = body.needsReview !== false
  if (body.segments && body.segments.length > 0) {
    return body.segments.map((seg, i) => ({
      id: `mms-${i + 1}`,
      start: seg.start,
      end: seg.end,
      text: seg.text.trim(),
      needsReview,
    }))
  }
  const text = body.text?.trim() ?? ''
  if (!text) return []
  return [{ id: 'mms-1', start: 0, end: 0, text, needsReview }]
}

/**
 * Transcriber that POSTs audio to the external MMS ASR wrapper.
 * The Python model does not live in this repo.
 */
export function createMmsHttpTranscriber(options: MmsHttpTranscriberOptions): Transcriber {
  const baseUrl = options.baseUrl.replace(/\/$/, '')
  const read = options.readFile ?? ((p) => readFile(p))
  const fetchFn = options.fetch ?? globalThis.fetch
  const sendsDataOffHost = options.sendsDataOffHost ?? false

  if (!baseUrl) {
    throw new ProviderError('BAD_CONFIG', 'TRANSCRIBER_URL / baseUrl is required for mms-http')
  }

  return {
    id: 'mms-http',
    label: 'MMS ASR (HTTP wrapper)',
    sendsDataOffHost,

    async transcribe(audioPath, opts) {
      const bytes = await read(audioPath)
      const form = new FormData()
      const filename = path.basename(audioPath) || 'audio.wav'
      const ab = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer
      form.append('file', new Blob([ab], { type: mimeFor(audioPath) }), filename)

      const url = `${baseUrl}/transcribe?lang=${encodeURIComponent(opts.lang)}`
      let res: Response
      try {
        res = await fetchFn(url, { method: 'POST', body: form, signal: opts.signal })
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err)
        throw new ProviderError('UNREACHABLE', `MMS wrapper unreachable at ${baseUrl}: ${message}`)
      }

      const raw = await res.text()
      let parsed: unknown
      try {
        parsed = raw ? JSON.parse(raw) : {}
      } catch {
        throw new ProviderError('BAD_RESPONSE', `MMS wrapper returned non-JSON (${res.status})`, res.status)
      }

      if (!res.ok) {
        const errObj = parsed as { error?: { code?: string; message?: string } }
        throw new ProviderError(
          errObj.error?.code ?? 'HTTP_ERROR',
          errObj.error?.message ?? `MMS wrapper HTTP ${res.status}`,
          res.status,
        )
      }

      return toCues(parsed as MmsTranscribeResponse)
    },
  }
}

/** Probe the wrapper without transcribing. */
export async function checkMmsHttpHealth(
  baseUrl: string,
  fetchFn: typeof fetch = globalThis.fetch,
): Promise<{ ok: boolean; ready?: boolean; model?: string }> {
  const url = `${baseUrl.replace(/\/$/, '')}/health`
  const res = await fetchFn(url)
  if (!res.ok) return { ok: false }
  return (await res.json()) as { ok: boolean; ready?: boolean; model?: string }
}

export type { LangCode }
