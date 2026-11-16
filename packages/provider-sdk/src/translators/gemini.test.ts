import type { Cue } from '@abolkit/core'
import { describe, expect, it } from 'vitest'

import { createTranslator, translatorConfigFromEnv } from '../create-translator.ts'
import { withTranslatedText } from './cue-text.ts'
import { createGeminiTranslator } from './gemini.ts'

const CUES: Cue[] = [
  { id: 'a', start: 0, end: 2.5, text: 'Hello and welcome.' },
  { id: 'b', start: 2.5, end: 5.25, text: 'Today we learn fractions.' },
  { id: 'c', start: 61.04, end: 63.9, text: 'Thank you.' },
]

type GeminiBody = {
  contents: [{ parts: [{ text: string }] }]
  systemInstruction: { parts: [{ text: string }] }
  generationConfig: { responseMimeType: string }
}
type Request = { url: string; headers: Record<string, string>; body: GeminiBody }

/** Answers each batch with `reply(lines)`, as Gemini's structured output would. */
function fakeGemini(reply: (lines: Array<{ i: number; text: string }>) => unknown) {
  const requests: Request[] = []
  const fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const body = JSON.parse(String(init?.body)) as GeminiBody
    requests.push({ url: String(input), headers: init?.headers as Record<string, string>, body })
    const lines = JSON.parse(body.contents[0].parts[0].text).lines
    const text = JSON.stringify(reply(lines))
    return new Response(
      JSON.stringify({ candidates: [{ content: { parts: [{ text }] }, finishReason: 'STOP' }] }),
    )
  }) as typeof globalThis.fetch
  return { requests, fetch }
}

describe('createGeminiTranslator', () => {
  it('translates text only and keeps every timestamp', async () => {
    const api = fakeGemini((lines) => ({
      translations: lines.map(({ i, text }) => ({ i, text: `AM:${text}` })).reverse(),
    }))
    const t = createGeminiTranslator({
      apiKey: 'key',
      model: 'gemini-test',
      batchSize: 2,
      fetch: api.fetch,
    })
    const out = await t.translate(CUES, { from: 'en', to: 'am' })

    expect(out).toEqual([
      { id: 'a', start: 0, end: 2.5, text: 'AM:Hello and welcome.', needsReview: true },
      { id: 'b', start: 2.5, end: 5.25, text: 'AM:Today we learn fractions.', needsReview: true },
      { id: 'c', start: 61.04, end: 63.9, text: 'AM:Thank you.', needsReview: true },
    ])
    expect(api.requests).toHaveLength(2)
    const first = api.requests[0]!
    expect(first.url).toBe(
      'https://generativelanguage.googleapis.com/v1beta/models/gemini-test:generateContent',
    )
    expect(first.headers['x-goog-api-key']).toBe('key')
    expect(first.body.generationConfig.responseMimeType).toBe('application/json')
    expect(first.body.systemInstruction.parts[0].text).toContain('Amharic (Ethiopic script)')
    expect(JSON.stringify(first.body)).not.toContain('2.5')
  })

  it('uses positional order when indices are wrong but the count matches', async () => {
    const api = fakeGemini((lines) => ({
      translations: lines.map(({ text }, order) => ({ i: order + 99, text: `TI:${text}` })),
    }))
    const t = createGeminiTranslator({ apiKey: 'key', fetch: api.fetch, batchSize: 10 })
    const out = await t.translate(CUES, { from: 'en', to: 'ti' })
    expect(out.map((c) => c.text)).toEqual([
      'TI:Hello and welcome.',
      'TI:Today we learn fractions.',
      'TI:Thank you.',
    ])
  })

  it('fails when the model skips a line and retries are exhausted', async () => {
    const api = fakeGemini((lines) => ({
      translations: lines.slice(1).map(({ i, text }) => ({ i, text })),
    }))
    const t = createGeminiTranslator({ apiKey: 'key', fetch: api.fetch, retryLimit: 0 })
    await expect(t.translate(CUES, { from: 'en', to: 'om' })).rejects.toThrow(
      /skipped caption line 0/,
    )
  })

  it('retries incomplete structured replies', async () => {
    let calls = 0
    const fetch = (async (_input: RequestInfo | URL, init?: RequestInit) => {
      calls++
      const body = JSON.parse(String(init?.body)) as GeminiBody
      const lines = JSON.parse(body.contents[0].parts[0].text).lines as Array<{
        i: number
        text: string
      }>
      const translations =
        calls === 1
          ? lines.slice(1).map(({ i, text }) => ({ i, text: `AA:${text}` }))
          : lines.map(({ i, text }) => ({ i, text: `AA:${text}` }))
      return new Response(
        JSON.stringify({
          candidates: [{ content: { parts: [{ text: JSON.stringify({ translations }) }] } }],
        }),
      )
    }) as typeof globalThis.fetch
    const t = createGeminiTranslator({
      apiKey: 'key',
      fetch,
      retryLimit: 2,
      sleep: async () => undefined,
    })
    const out = await t.translate(CUES, { from: 'en', to: 'aa' })
    expect(calls).toBe(2)
    expect(out[0]?.text).toBe('AA:Hello and welcome.')
  })

  it('sends a short transcript in one Gemini call', async () => {
    const api = fakeGemini((lines) => ({
      translations: lines.map(({ i, text }) => ({ i, text: `AM:${text}` })),
    }))
    const t = createGeminiTranslator({ apiKey: 'key', fetch: api.fetch, batchSize: 80 })
    await t.translate(CUES, { from: 'en', to: 'am' })
    expect(api.requests).toHaveLength(1)
    expect(api.requests[0]!.body.generationConfig).toMatchObject({
      responseMimeType: 'application/json',
    })
    expect(
      (api.requests[0]!.body.generationConfig as { maxOutputTokens?: number }).maxOutputTokens,
    ).toBeGreaterThanOrEqual(1024)
  })

  it('splits a batch after retries keep skipping lines', async () => {
    let calls = 0
    const fetch = (async (_input: RequestInfo | URL, init?: RequestInit) => {
      calls++
      const body = JSON.parse(String(init?.body)) as GeminiBody
      const lines = JSON.parse(body.contents[0].parts[0].text).lines as Array<{
        i: number
        text: string
      }>
      // Full-size attempts always skip; half-size (≤2) succeed.
      const translations =
        lines.length > 2
          ? lines.slice(1).map(({ i, text }) => ({ i, text: `OM:${text}` }))
          : lines.map(({ i, text }) => ({ i, text: `OM:${text}` }))
      return new Response(
        JSON.stringify({
          candidates: [{ content: { parts: [{ text: JSON.stringify({ translations }) }] } }],
        }),
      )
    }) as typeof globalThis.fetch
    const t = createGeminiTranslator({
      apiKey: 'key',
      fetch,
      batchSize: 80,
      retryLimit: 0,
      sleep: async () => undefined,
    })
    const out = await t.translate(CUES, { from: 'en', to: 'om' })
    expect(calls).toBeGreaterThan(1)
    expect(out.map((c) => c.text)).toEqual([
      'OM:Hello and welcome.',
      'OM:Today we learn fractions.',
      'OM:Thank you.',
    ])
  })

  it('surfaces HTTP errors with their status so the job can retry', async () => {
    const fetch = (async () =>
      new Response(JSON.stringify({ error: { status: 'RESOURCE_EXHAUSTED', message: 'quota' } }), {
        status: 429,
      })) as typeof globalThis.fetch
    const t = createGeminiTranslator({ apiKey: 'key', fetch, retryLimit: 0 })
    await expect(t.translate(CUES, { from: 'en', to: 'ti' })).rejects.toMatchObject({
      code: 'RESOURCE_EXHAUSTED',
      status: 429,
    })
  })
})

describe('withTranslatedText', () => {
  it('rejects a line count that does not match', () => {
    expect(() => withTranslatedText(CUES, ['one'])).toThrow(/1 lines for 3 cues/)
  })
})

describe('createTranslator', () => {
  it('returns null for none and refuses gemini when consent is explicitly false', () => {
    expect(createTranslator(translatorConfigFromEnv({}))).toBeNull()
    expect(() =>
      createTranslator(
        translatorConfigFromEnv({
          TRANSLATOR: 'gemini',
          GEMINI_API_KEY: 'k',
          TRANSLATOR_OFF_HOST_CONSENT: 'false',
        }),
      ),
    ).toThrow(/consent/i)
  })

  it('defaults consent on so gemini builds when only the key is set', () => {
    const t = createTranslator(
      translatorConfigFromEnv({ TRANSLATOR: 'gemini', GEMINI_API_KEY: 'k' }),
    )
    expect(t?.id).toBe('gemini')
  })

  it('builds gemini with consent and a key', () => {
    const t = createTranslator(
      translatorConfigFromEnv({
        TRANSLATOR: 'gemini',
        TRANSLATOR_OFF_HOST_CONSENT: 'true',
        GEMINI_API_KEY: 'k',
        GEMINI_MODEL: 'gemini-x',
      }),
    )
    expect(t?.id).toBe('gemini')
    expect(t?.sendsDataOffHost).toBe(true)
  })
})
