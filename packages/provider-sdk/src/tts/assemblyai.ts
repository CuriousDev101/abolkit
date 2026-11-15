import { ProviderError } from '../errors.ts'
import type { LangCode, Tts } from '../types.ts'

type Env = Record<string, string | undefined>

export interface AssemblyAiTtsOptions {
  apiKey: string
  /** US: `https://tts.us.assemblyai.com`. EU: `https://tts.eu.assemblyai.com`. */
  baseUrl?: string
  /** Library slug or UUID. Default: AssemblyAI's English voice `aai-kyla`. */
  voiceId?: string
  /** Audio encoding. Job-card summaries use buffered MP3 for browser playback. */
  encoding?: 'mp3' | 'wav' | 'pcm_s16le'
  fetch?: typeof fetch
}

const DEFAULT_BASE_URL = 'https://tts.us.assemblyai.com'
const DEFAULT_VOICE_ID = 'aai-kyla'
const ENGLISH_ONLY: LangCode[] = ['en']

/**
 * AssemblyAI Streaming TTS HTTP adapter (`POST /v1/speech`).
 * English-only for job-card audio summaries. Sends text off the host (ADR 0003).
 */
export function createAssemblyAiTts(options: AssemblyAiTtsOptions): Tts {
  const apiKey = options.apiKey.trim()
  if (!apiKey) {
    throw new ProviderError('BAD_CONFIG', 'TTS=assemblyai requires ASSEMBLYAI_API_KEY')
  }
  const baseUrl = (options.baseUrl?.trim() || DEFAULT_BASE_URL).replace(/\/$/, '')
  const voiceId = options.voiceId?.trim() || DEFAULT_VOICE_ID
  const encoding = options.encoding ?? 'mp3'
  const fetchFn = options.fetch ?? globalThis.fetch

  return {
    id: 'assemblyai',
    label: 'AssemblyAI TTS (cloud)',
    sendsDataOffHost: true,
    languages(): LangCode[] {
      return [...ENGLISH_ONLY]
    },
    async synthesize(text, opts) {
      const lang = opts.lang || 'en'
      if (lang !== 'en' && !lang.startsWith('en-')) {
        throw new ProviderError(
          'BAD_REQUEST',
          `AssemblyAI job-summary TTS supports English only (got lang=${lang})`,
        )
      }
      const trimmed = text.trim()
      if (!trimmed) {
        throw new ProviderError('BAD_REQUEST', 'TTS text is empty')
      }

      let res: Response
      try {
        res = await fetchFn(`${baseUrl}/v1/speech`, {
          method: 'POST',
          headers: {
            Authorization: apiKey,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            text: trimmed,
            voice_id: voiceId,
            encoding,
            language: 'english',
            stream: false,
          }),
          signal: opts.signal,
        })
      } catch (err) {
        if (opts.signal?.aborted) throw err
        const message = err instanceof Error ? err.message : String(err)
        throw new ProviderError('UNREACHABLE', `AssemblyAI TTS unreachable: ${message}`)
      }

      if (!res.ok) {
        const raw = await res.text()
        throw new ProviderError(
          'HTTP_ERROR',
          `AssemblyAI TTS HTTP ${res.status}: ${errorMessage(raw)}`,
          res.status,
        )
      }

      const buffer = new Uint8Array(await res.arrayBuffer())
      if (buffer.byteLength === 0) {
        throw new ProviderError('BAD_RESPONSE', 'AssemblyAI TTS returned empty audio')
      }

      return { bytes: buffer, mime: mimeForEncoding(encoding) }
    },
  }
}

/** Read AssemblyAI TTS settings. Reuses `ASSEMBLYAI_API_KEY`; TTS host/voice are separate. */
export function assemblyAiTtsConfigFromEnv(
  env: Env,
): Omit<AssemblyAiTtsOptions, 'fetch'> {
  const encodingRaw = env.ASSEMBLYAI_TTS_ENCODING?.trim().toLowerCase()
  const encoding =
    encodingRaw === 'wav' || encodingRaw === 'pcm_s16le' || encodingRaw === 'mp3'
      ? encodingRaw
      : undefined

  return {
    apiKey: env.ASSEMBLYAI_API_KEY?.trim() ?? '',
    baseUrl: env.ASSEMBLYAI_TTS_BASE_URL?.trim() || undefined,
    voiceId: env.ASSEMBLYAI_TTS_VOICE_ID?.trim() || undefined,
    encoding,
  }
}

function mimeForEncoding(encoding: NonNullable<AssemblyAiTtsOptions['encoding']>): string {
  switch (encoding) {
    case 'wav':
      return 'audio/wav'
    case 'pcm_s16le':
      return 'audio/pcm'
    case 'mp3':
    default:
      return 'audio/mpeg'
  }
}

function errorMessage(raw: string): string {
  try {
    const body = JSON.parse(raw) as { error?: string; message?: string; detail?: string }
    if (body.error) return body.error
    if (body.message) return body.message
    if (body.detail) return body.detail
  } catch {
    // Not JSON: fall through.
  }
  return raw.slice(0, 300) || 'no body'
}
