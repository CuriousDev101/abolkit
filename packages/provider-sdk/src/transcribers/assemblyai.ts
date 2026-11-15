import { readFile } from 'node:fs/promises'

import { parseVtt, type Cue } from '@abolkit/core'

import { ProviderError } from '../errors.ts'
import type { LangCode, Transcriber, TranscriptionResult } from '../types.ts'

type Env = Record<string, string | undefined>

/** Request fields sent to `POST /v2/transcript` (AssemblyAI REST API). */
export type AssemblyAiParams = Record<string, unknown>

export interface AssemblyAiOptions {
  apiKey: string
  /** `https://api.assemblyai.com`, or `https://api.eu.assemblyai.com` for EU data residency. */
  baseUrl?: string
  /** Extra transcript request fields, e.g. speech_models, language_detection, punctuate. */
  params?: AssemblyAiParams
  /** `chars_per_caption` for the WebVTT export. */
  charsPerCaption?: number
  pollIntervalMs?: number
  /** Give up waiting for a transcript after this long. */
  timeoutMs?: number
  readFile?: (path: string) => Promise<Uint8Array>
  fetch?: typeof fetch
  sleep?: (ms: number, signal?: AbortSignal) => Promise<void>
}

type TranscriptBody = {
  id?: string
  status?: 'queued' | 'processing' | 'completed' | 'error'
  error?: string
  language_code?: string
}

const DEFAULT_BASE_URL = 'https://api.assemblyai.com'

/**
 * AssemblyAI pre-recorded transcription: upload the audio, submit a transcript, poll until it completes,
 * then export WebVTT so caption line breaks come from AssemblyAI. Sends audio off the host (ADR 0003).
 */
export function createAssemblyAiTranscriber(options: AssemblyAiOptions): Transcriber {
  const apiKey = options.apiKey.trim()
  if (!apiKey)
    throw new ProviderError('BAD_CONFIG', 'TRANSCRIBER=assemblyai requires ASSEMBLYAI_API_KEY')
  const baseUrl = (options.baseUrl?.trim() || DEFAULT_BASE_URL).replace(/\/$/, '')
  const fetchFn = options.fetch ?? globalThis.fetch
  const read = options.readFile ?? ((path) => readFile(path))
  const sleep = options.sleep ?? abortableSleep
  const pollIntervalMs = options.pollIntervalMs ?? 3000
  const timeoutMs = options.timeoutMs ?? 30 * 60_000
  const charsPerCaption = options.charsPerCaption ?? 42

  async function call<T>(
    path: string,
    init: RequestInit,
    signal?: AbortSignal,
    as: 'json' | 'text' = 'json',
  ): Promise<T> {
    let res: Response
    try {
      res = await fetchFn(`${baseUrl}${path}`, {
        ...init,
        headers: { authorization: apiKey, ...init.headers },
        signal,
      })
    } catch (err) {
      if (signal?.aborted) throw err
      const message = err instanceof Error ? err.message : String(err)
      throw new ProviderError('UNREACHABLE', `AssemblyAI unreachable: ${message}`)
    }
    const raw = await res.text()
    if (!res.ok) {
      throw new ProviderError(
        'HTTP_ERROR',
        `AssemblyAI HTTP ${res.status}: ${errorMessage(raw)}`,
        res.status,
      )
    }
    if (as === 'text') return raw as T
    try {
      return JSON.parse(raw) as T
    } catch {
      throw new ProviderError(
        'BAD_RESPONSE',
        `AssemblyAI returned non-JSON (${res.status})`,
        res.status,
      )
    }
  }

  async function transcribeDetailed(
    audioPath: string,
    opts: { lang?: LangCode; signal?: AbortSignal },
  ): Promise<TranscriptionResult> {
    const { signal } = opts
    const bytes = await read(audioPath)
    const upload = await call<{ upload_url?: string }>(
      '/v2/upload',
      {
        method: 'POST',
        headers: { 'content-type': 'application/octet-stream' },
        body: bytes as BodyInit,
      },
      signal,
    )
    if (!upload.upload_url)
      throw new ProviderError('BAD_RESPONSE', 'AssemblyAI upload returned no upload_url')

    const params: AssemblyAiParams = { ...options.params, audio_url: upload.upload_url }
    if (opts.lang && opts.lang !== 'auto') {
      params.language_code = opts.lang
      delete params.language_detection
      delete params.language_detection_options
    }
    let transcript = await call<TranscriptBody>(
      '/v2/transcript',
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(params),
      },
      signal,
    )
    const id = transcript.id
    if (!id) throw new ProviderError('BAD_RESPONSE', 'AssemblyAI returned no transcript id')

    const deadline = Date.now() + timeoutMs
    while (transcript.status !== 'completed') {
      if (transcript.status === 'error') {
        throw new ProviderError(
          'TRANSCRIPTION_FAILED',
          `AssemblyAI: ${transcript.error ?? 'transcription failed'}`,
        )
      }
      if (Date.now() > deadline) {
        throw new ProviderError(
          'TIMEOUT',
          `AssemblyAI transcript ${id} did not finish in ${timeoutMs} ms`,
          504,
        )
      }
      await sleep(pollIntervalMs, signal)
      transcript = await call<TranscriptBody>(`/v2/transcript/${id}`, { method: 'GET' }, signal)
    }

    const vtt = await call<string>(
      `/v2/transcript/${id}/vtt?chars_per_caption=${charsPerCaption}`,
      { method: 'GET' },
      signal,
      'text',
    )
    const cues: Cue[] = parseVtt(vtt).map((cue, i) => ({
      ...cue,
      id: `aai-${i + 1}`,
      needsReview: true,
    }))
    return { cues, language: transcript.language_code ?? opts.lang, providerRef: id }
  }

  return {
    id: 'assemblyai',
    label: 'AssemblyAI (cloud)',
    sendsDataOffHost: true,
    async transcribe(audioPath, opts) {
      return (await transcribeDetailed(audioPath, opts)).cues
    },
    transcribeDetailed,
  }
}

/**
 * Read AssemblyAI settings. Each documented request field can be set by its own variable;
 * ASSEMBLYAI_EXTRA_PARAMS (JSON) adds anything else and wins over the rest.
 */
export function assemblyAiConfigFromEnv(
  env: Env,
): Omit<AssemblyAiOptions, 'readFile' | 'fetch' | 'sleep'> {
  const params: AssemblyAiParams = {}
  const list = (name: string) =>
    env[name]
      ?.split(',')
      .map((part) => part.trim())
      .filter(Boolean)
  const setBool = (field: string, name: string, fallback?: boolean) => {
    const value = parseBool(env[name], name) ?? fallback
    if (value !== undefined) params[field] = value
  }
  const setNumber = (field: string, name: string) => {
    const value = parseNumber(env[name], name)
    if (value !== undefined) params[field] = value
  }

  const models = list('ASSEMBLYAI_SPEECH_MODELS')
  if (models?.length) params.speech_models = models
  const languageCode = env.ASSEMBLYAI_LANGUAGE_CODE?.trim()
  if (languageCode) params.language_code = languageCode
  else {
    // Off by default: the worker always passes a trusted language (request or English).
    setBool('language_detection', 'ASSEMBLYAI_LANGUAGE_DETECTION', false)
    const expected = list('ASSEMBLYAI_EXPECTED_LANGUAGES')
    if (expected?.length) {
      const fallback = env.ASSEMBLYAI_FALLBACK_LANGUAGE?.trim()
      params.language_detection_options = {
        expected_languages: expected,
        ...(fallback ? { fallback_language: fallback } : {}),
      }
    }
    setNumber('language_confidence_threshold', 'ASSEMBLYAI_LANGUAGE_CONFIDENCE_THRESHOLD')
  }
  setBool('punctuate', 'ASSEMBLYAI_PUNCTUATE', true)
  setBool('format_text', 'ASSEMBLYAI_FORMAT_TEXT', true)
  setBool('disfluencies', 'ASSEMBLYAI_DISFLUENCIES')
  setBool('filter_profanity', 'ASSEMBLYAI_FILTER_PROFANITY')
  setBool('speaker_labels', 'ASSEMBLYAI_SPEAKER_LABELS')
  setNumber('speakers_expected', 'ASSEMBLYAI_SPEAKERS_EXPECTED')
  setBool('entity_detection', 'ASSEMBLYAI_ENTITY_DETECTION')
  setNumber('speech_threshold', 'ASSEMBLYAI_SPEECH_THRESHOLD')
  const keyterms = list('ASSEMBLYAI_KEYTERMS')
  if (keyterms?.length) params.keyterms_prompt = keyterms
  const prompt = env.ASSEMBLYAI_PROMPT?.trim()
  if (prompt) params.prompt = prompt

  const extra = env.ASSEMBLYAI_EXTRA_PARAMS?.trim()
  if (extra) {
    let parsed: unknown
    try {
      parsed = JSON.parse(extra)
    } catch {
      throw new ProviderError('BAD_CONFIG', 'ASSEMBLYAI_EXTRA_PARAMS must be a JSON object')
    }
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new ProviderError('BAD_CONFIG', 'ASSEMBLYAI_EXTRA_PARAMS must be a JSON object')
    }
    Object.assign(params, parsed)
  }

  return {
    apiKey: env.ASSEMBLYAI_API_KEY?.trim() ?? '',
    baseUrl: env.ASSEMBLYAI_BASE_URL?.trim() || undefined,
    params,
    charsPerCaption: parseNumber(env.ASSEMBLYAI_CHARS_PER_CAPTION, 'ASSEMBLYAI_CHARS_PER_CAPTION'),
    pollIntervalMs: parseNumber(env.ASSEMBLYAI_POLL_INTERVAL_MS, 'ASSEMBLYAI_POLL_INTERVAL_MS'),
    timeoutMs: parseNumber(env.ASSEMBLYAI_TIMEOUT_MS, 'ASSEMBLYAI_TIMEOUT_MS'),
  }
}

function errorMessage(raw: string): string {
  try {
    const body = JSON.parse(raw) as { error?: string }
    if (body.error) return body.error
  } catch {
    // Not JSON: fall through to the raw text.
  }
  return raw.slice(0, 300) || 'no body'
}

function parseBool(raw: string | undefined, name: string): boolean | undefined {
  if (raw == null || raw.trim() === '') return undefined
  const v = raw.trim().toLowerCase()
  if (['1', 'true', 'yes', 'on'].includes(v)) return true
  if (['0', 'false', 'no', 'off'].includes(v)) return false
  throw new ProviderError('BAD_CONFIG', `${name} must be true or false, got ${raw}`)
}

function parseNumber(raw: string | undefined, name: string): number | undefined {
  if (raw == null || raw.trim() === '') return undefined
  const n = Number(raw)
  if (!Number.isFinite(n))
    throw new ProviderError('BAD_CONFIG', `${name} must be a number, got ${raw}`)
  return n
}

function abortableSleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(signal.reason)
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort)
      resolve()
    }, ms)
    const onAbort = () => {
      clearTimeout(timer)
      reject(signal?.reason)
    }
    signal?.addEventListener('abort', onAbort, { once: true })
  })
}
