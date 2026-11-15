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

  it('fails when the model skips a line instead of shifting the rest', async () => {
    const api = fakeGemini((lines) => ({
      translations: lines.slice(1).map(({ i, text }) => ({ i, text })),
    }))
    const t = createGeminiTranslator({ apiKey: 'key', fetch: api.fetch })
    await expect(t.translate(CUES, { from: 'en', to: 'om' })).rejects.toThrow(
      /skipped caption line 0/,
    )
  })

  it('surfaces HTTP errors with their status so the job can retry', async () => {
    const fetch = (async () =>
      new Response(JSON.stringify({ error: { status: 'RESOURCE_EXHAUSTED', message: 'quota' } }), {
        status: 429,
      })) as typeof globalThis.fetch
    const t = createGeminiTranslator({ apiKey: 'key', fetch })
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
