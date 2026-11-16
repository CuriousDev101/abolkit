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
  /**
   * Max cues per Gemini call. Short videos with fewer cues go in **one shot**.
   * Input context is huge (~1M); the real limit is **output** completeness for
   * structured JSON — on failure we retry, then split the batch.
   */
  batchSize?: number
  temperature?: number
  /** Extra tries after a 429, 503, or incomplete structured reply. */
  retryLimit?: number
  sleep?: (ms: number, signal?: AbortSignal) => Promise<void>
  fetch?: typeof fetch
}

export const DEFAULT_GEMINI_MODEL = 'gemini-3.8-flash'
/**
 * Prefer one request for typical short/medium captions (e.g. ~2–3 min speech).
 * Override with GEMINI_BATCH_SIZE. Gemini Flash output ceiling is 65_536 tokens;
 * caption JSON is tiny next to that, but models still occasionally skip an index.
 */
export const DEFAULT_GEMINI_BATCH_SIZE = 80
/** Soft budget so structured replies are not cut off mid-JSON. */
const MAX_OUTPUT_TOKENS_CAP = 8_192
const DEFAULT_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta'

function responseSchemaFor(lineCount: number) {
  return {
    type: 'object',
    properties: {
      translations: {
        type: 'array',
        minItems: lineCount,
        maxItems: lineCount,
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
  const batchSize = Math.max(1, Math.trunc(options.batchSize ?? DEFAULT_GEMINI_BATCH_SIZE))
  const retryLimit = Math.max(0, Math.trunc(options.retryLimit ?? 4))
  const fetchFn = options.fetch ?? globalThis.fetch
  const sleep = options.sleep ?? abortableSleep

  async function requestTranslations(
    lines: string[],
    from: string,
    to: string,
    signal?: AbortSignal,
  ): Promise<{ translations?: Array<{ i?: unknown; text?: unknown }> }> {
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
        // Caption JSON is small; leave headroom so Ethiopic script + schema wrapping fit.
        maxOutputTokens: Math.min(MAX_OUTPUT_TOKENS_CAP, Math.max(1_024, lines.length * 96)),
        responseMimeType: 'application/json',
        responseJsonSchema: responseSchemaFor(lines.length),
      },
    }

    const timeoutMs = Math.min(120_000, 30_000 + lines.length * 400)
    const timeout = AbortSignal.timeout(timeoutMs)
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
        throw new ProviderError(
          'TIMEOUT',
          `Gemini did not respond within ${Math.round(timeoutMs / 1000)} s`,
          503,
        )
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
    const finishReason = candidate?.finishReason ?? 'unknown'
    if (finishReason === 'MAX_TOKENS') {
      throw new ProviderError(
        'BAD_RESPONSE',
        `Gemini hit maxOutputTokens mid-reply (${lines.length} lines)`,
        502,
      )
    }
    const text = candidate?.content?.parts?.map((part) => part.text ?? '').join('') ?? ''
    try {
      return JSON.parse(text) as { translations?: Array<{ i?: unknown; text?: unknown }> }
    } catch {
      throw new ProviderError(
        'BAD_RESPONSE',
        `Gemini reply was not valid JSON (finishReason ${finishReason})`,
        502,
      )
    }
  }

  /**
   * Prefer index-aligned replies; if indices are wrong but the count matches, use order.
   * Returns undefined slots when the model still skipped lines.
   */
  function assembleTranslations(
    lineCount: number,
    reply: { translations?: Array<{ i?: unknown; text?: unknown }> },
  ): Array<string | undefined> {
    const items = reply.translations ?? []
    // Dense array — sparse `new Array(n)` makes `.every()` skip holes and look "complete".
    const byIndex: Array<string | undefined> = Array.from({ length: lineCount }, () => undefined)
    for (const item of items) {
      if (
        typeof item.i === 'number' &&
        typeof item.text === 'string' &&
        Number.isInteger(item.i) &&
        item.i >= 0 &&
        item.i < lineCount
      ) {
        byIndex[item.i] = item.text
      }
    }
    if (byIndex.every((value) => typeof value === 'string')) return byIndex

    const texts = items
      .filter((item): item is { i?: unknown; text: string } => typeof item.text === 'string')
      .map((item) => item.text)
    if (texts.length === lineCount) return texts

    return byIndex
  }

  async function translateBatch(
    lines: string[],
    from: string,
    to: string,
    signal?: AbortSignal,
  ): Promise<string[]> {
    const reply = await requestTranslations(lines, from, to, signal)
    const out = assembleTranslations(lines.length, reply)
    const missing = out.findIndex((value) => typeof value !== 'string')
    if (missing >= 0) {
      throw new ProviderError(
        'BAD_RESPONSE',
        `Gemini skipped caption line ${missing} of ${lines.length}`,
        502,
      )
    }
    return out as string[]
  }

  function isRetryable(error: unknown): boolean {
    return (
      error instanceof ProviderError &&
      (error.status === 429 ||
        error.status === 502 ||
        error.status === 503 ||
        error.code === 'BAD_RESPONSE' ||
        error.code === 'UNREACHABLE' ||
        error.code === 'TIMEOUT')
    )
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
        if (!isRetryable(error) || attempt >= retryLimit) throw error
        await sleep(2_000 * 2 ** attempt, signal)
      }
    }
  }

  /**
   * One shot when `lines` fit in batchSize. If Gemini still flakes after retries,
   * split in half (output-size / skip-index recovery) instead of failing the job.
   */
  async function translateLines(
    lines: string[],
    from: string,
    to: string,
    signal?: AbortSignal,
  ): Promise<string[]> {
    try {
      return await translateBatchWithRetry(lines, from, to, signal)
    } catch (error) {
      if (!(error instanceof ProviderError) || error.code !== 'BAD_RESPONSE' || lines.length < 2) {
        throw error
      }
      const mid = Math.ceil(lines.length / 2)
      const left = await translateLines(lines.slice(0, mid), from, to, signal)
      const right = await translateLines(lines.slice(mid), from, to, signal)
      return [...left, ...right]
    }
  }

  return {
    id: 'gemini',
    label: `Gemini (${model}, cloud)`,
    sendsDataOffHost: true,
    async translate(cues: Cue[], opts) {
      // Prefer one Gemini call for the whole short transcript (cues.length ≤ batchSize).
      const texts: string[] = []
      for (let at = 0; at < cues.length; at += batchSize) {
        const batch = cues.slice(at, at + batchSize).map((cue) => cue.text)
        texts.push(...(await translateLines(batch, opts.from, opts.to, opts.signal)))
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
