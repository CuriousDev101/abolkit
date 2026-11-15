import type { Cue } from '@abolkit/core'

import { ProviderError } from '../errors.ts'
import type { Translator } from '../types.ts'
import { languagePromptName, withTranslatedText } from './cue-text.ts'

type Env = Record<string, string | undefined>

export interface GeminiTranslatorOptions {
  apiKey: string
  /** Gemini model id, e.g. `gemini-3.8-flash`. */
  model?: string
  baseUrl?: string
  /** Cues per request. Each batch is translated in order so nearby lines give context. */
  batchSize?: number
  temperature?: number
  /** Extra tries after a 429 or 503. Gemini 3.8 Flash often answers 503 while it is busy. */
  retryLimit?: number
  sleep?: (ms: number, signal?: AbortSignal) => Promise<void>
  fetch?: typeof fetch
}

export const DEFAULT_GEMINI_MODEL = 'gemini-3.8-flash'
const DEFAULT_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta'

const RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    translations: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          i: { type: 'integer', description: 'Index of the source line' },
          text: { type: 'string', description: 'The translated line' },
        },
        required: ['i', 'text'],
      },
    },
  },
  required: ['translations'],
}

type GenerateResponse = {
  candidates?: Array<{ content?: { parts?: Array<{ text?: string }> }; finishReason?: string }>
  promptFeedback?: { blockReason?: string }
  error?: { message?: string; status?: string }
}

/**
 * Caption translation with the Gemini API. Only cue text is sent, keyed by index; the reply must match the
 * JSON schema and cover every index, and times are copied from the source cues (ADR 0007).
 */
export function createGeminiTranslator(options: GeminiTranslatorOptions): Translator {
  const apiKey = options.apiKey.trim()
  if (!apiKey) throw new ProviderError('BAD_CONFIG', 'TRANSLATOR=gemini requires GEMINI_API_KEY')
  const model = options.model?.trim() || DEFAULT_GEMINI_MODEL
  const baseUrl = (options.baseUrl?.trim() || DEFAULT_BASE_URL).replace(/\/$/, '')
  const batchSize = Math.max(1, Math.trunc(options.batchSize ?? 60))
  const retryLimit = Math.max(0, Math.trunc(options.retryLimit ?? 4))
  const fetchFn = options.fetch ?? globalThis.fetch
  const sleep = options.sleep ?? abortableSleep

  async function translateBatch(
    lines: string[],
    from: string,
    to: string,
    signal?: AbortSignal,
  ): Promise<string[]> {
    const instruction = [
      `Translate video captions from ${languagePromptName(from)} to ${languagePromptName(to)}.`,
      'The input is JSON: {"lines":[{"i":number,"text":string}]}. Lines are consecutive captions of one video.',
      'Return exactly one translation for every input index, with the same i. Never merge, split, drop or reorder lines.',
      'Keep each translation short enough to read as a caption. Keep names, numbers and speaker labels like "Speaker A:" as they are.',
      'Write only the translation text, with no notes or quotes.',
    ].join('\n')
    const body = {
      systemInstruction: { parts: [{ text: instruction }] },
      contents: [
        {
          role: 'user',
          parts: [{ text: JSON.stringify({ lines: lines.map((text, i) => ({ i, text })) }) }],
        },
      ],
      generationConfig: {
        temperature: options.temperature ?? 0.2,
        responseMimeType: 'application/json',
        responseJsonSchema: RESPONSE_SCHEMA,
      },
    }

    const timeout = AbortSignal.timeout(45_000)
    const requestSignal = signal ? AbortSignal.any([signal, timeout]) : timeout
    let res: Response
    try {
      res = await fetchFn(`${baseUrl}/models/${encodeURIComponent(model)}:generateContent`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-goog-api-key': apiKey },
        body: JSON.stringify(body),
        signal: requestSignal,
      })
    } catch (err) {
      if (signal?.aborted) throw err
      if (timeout.aborted) {
        throw new ProviderError('TIMEOUT', 'Gemini did not respond within 45 s', 503)
      }
      const message = err instanceof Error ? err.message : String(err)
      throw new ProviderError('UNREACHABLE', `Gemini unreachable: ${message}`)
    }

    const raw = await res.text()
    let parsed: GenerateResponse
    try {
      parsed = JSON.parse(raw) as GenerateResponse
    } catch {
      throw new ProviderError(
        'BAD_RESPONSE',
        `Gemini returned non-JSON (${res.status})`,
        res.status,
      )
    }
    if (!res.ok) {
      throw new ProviderError(
        parsed.error?.status ?? 'HTTP_ERROR',
        `Gemini HTTP ${res.status}: ${parsed.error?.message ?? 'request failed'}`,
        res.status,
      )
    }
    if (parsed.promptFeedback?.blockReason) {
      throw new ProviderError(
        'BLOCKED',
        `Gemini blocked the request: ${parsed.promptFeedback.blockReason}`,
      )
    }

    const candidate = parsed.candidates?.[0]
    const text = candidate?.content?.parts?.map((part) => part.text ?? '').join('') ?? ''
    let reply: { translations?: Array<{ i?: unknown; text?: unknown }> }
    try {
      reply = JSON.parse(text) as typeof reply
    } catch {
      throw new ProviderError(
        'BAD_RESPONSE',
        `Gemini reply was not valid JSON (finishReason ${candidate?.finishReason ?? 'unknown'})`,
        502,
      )
    }

    const out = new Array<string | undefined>(lines.length)
    for (const item of reply.translations ?? []) {
      if (
        typeof item.i === 'number' &&
        typeof item.text === 'string' &&
        item.i >= 0 &&
        item.i < lines.length
      ) {
        out[item.i] = item.text
      }
    }
    const missing = out.findIndex((value) => value === undefined)
    if (missing >= 0) {
      throw new ProviderError(
        'BAD_RESPONSE',
        `Gemini skipped caption line ${missing} of ${lines.length}`,
        502,
      )
    }
    return out as string[]
  }

  async function translateBatchWithRetry(
    lines: string[],
    from: string,
    to: string,
    signal?: AbortSignal,
  ): Promise<string[]> {
    for (let attempt = 0; ; attempt++) {
      try {
        return await translateBatch(lines, from, to, signal)
      } catch (error) {
        const retryable =
          error instanceof ProviderError &&
          (error.status === 429 ||
            error.status === 503 ||
            error.code === 'UNREACHABLE' ||
            error.code === 'TIMEOUT')
        if (!retryable || attempt >= retryLimit) throw error
        await sleep(2_000 * 2 ** attempt, signal)
      }
    }
  }

  return {
    id: 'gemini',
    label: `Gemini (${model}, cloud)`,
    sendsDataOffHost: true,
    async translate(cues: Cue[], opts) {
      const texts: string[] = []
      for (let at = 0; at < cues.length; at += batchSize) {
        const batch = cues.slice(at, at + batchSize).map((cue) => cue.text)
        texts.push(...(await translateBatchWithRetry(batch, opts.from, opts.to, opts.signal)))
      }
      return withTranslatedText(cues, texts)
    },
  }
}

export function geminiConfigFromEnv(env: Env): Omit<GeminiTranslatorOptions, 'fetch'> {
  const number = (name: string) => {
    const raw = env[name]?.trim()
    if (!raw) return undefined
    const n = Number(raw)
    if (!Number.isFinite(n))
      throw new ProviderError('BAD_CONFIG', `${name} must be a number, got ${raw}`)
    return n
  }
  return {
    apiKey: env.GEMINI_API_KEY?.trim() ?? '',
    model: env.GEMINI_MODEL?.trim() || undefined,
    baseUrl: env.GEMINI_BASE_URL?.trim() || undefined,
    batchSize: number('GEMINI_BATCH_SIZE'),
    temperature: number('GEMINI_TEMPERATURE'),
  }
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
