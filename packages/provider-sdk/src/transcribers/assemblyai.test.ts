import { describe, expect, it } from 'vitest'

import { assemblyAiConfigFromEnv, createAssemblyAiTranscriber } from './assemblyai.ts'

const VTT = `WEBVTT

00:00:00.000 --> 00:00:02.500
Hello and welcome.

00:00:02.500 --> 00:00:05.000
Today we learn fractions.
`

type Call = { url: string; method: string; headers: Record<string, string>; body?: unknown }

function fakeApi(statuses: string[], language = 'en') {
  const calls: Call[] = []
  let poll = 0
  const fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input)
    const headers = init?.headers as Record<string, string>
    const body = typeof init?.body === 'string' ? JSON.parse(init.body) : init?.body
    calls.push({ url, method: init?.method ?? 'GET', headers, body })
    const json = (value: unknown) => new Response(JSON.stringify(value), { status: 200 })
    if (url.endsWith('/v2/upload')) return json({ upload_url: 'https://cdn.assemblyai.test/a' })
    if (url.endsWith('/v2/transcript')) return json({ id: 't1', status: 'queued' })
    if (url.includes('/vtt?')) return new Response(VTT, { status: 200 })
    if (url.endsWith('/v2/transcript/t1')) {
      const status = statuses[Math.min(poll++, statuses.length - 1)]
      return json({ id: 't1', status, language_code: language, error: 'Audio has no speech' })
    }
    return new Response('{}', { status: 404 })
  }) as typeof globalThis.fetch
  return { calls, fetch }
}

const base = {
  apiKey: 'secret',
  readFile: async () => new Uint8Array([1, 2, 3]),
  sleep: async () => {},
}

describe('createAssemblyAiTranscriber', () => {
  it('uploads, polls until completed and returns VTT cues with the detected language', async () => {
    const api = fakeApi(['processing', 'completed'], 'am')
    const t = createAssemblyAiTranscriber({
      ...base,
      fetch: api.fetch,
      params: { speech_models: ['universal-2'], language_detection: true },
      charsPerCaption: 32,
    })
    const result = await t.transcribeDetailed!('/tmp/a.mp3', {})

    expect(result.language).toBe('am')
    expect(result.providerRef).toBe('t1')
    expect(result.cues).toEqual([
      { id: 'aai-1', start: 0, end: 2.5, text: 'Hello and welcome.', needsReview: true },
      { id: 'aai-2', start: 2.5, end: 5, text: 'Today we learn fractions.', needsReview: true },
    ])
    const submit = api.calls.find((c) => c.url.endsWith('/v2/transcript'))!
    expect(submit.headers.authorization).toBe('secret')
    expect(submit.body).toEqual({
      speech_models: ['universal-2'],
      language_detection: true,
      audio_url: 'https://cdn.assemblyai.test/a',
    })
    expect(api.calls.at(-1)!.url).toBe(
      'https://api.assemblyai.com/v2/transcript/t1/vtt?chars_per_caption=32',
    )
  })

  it('uses a known language instead of detection', async () => {
    const api = fakeApi(['completed'])
    const t = createAssemblyAiTranscriber({
      ...base,
      fetch: api.fetch,
      params: {
        language_detection: true,
        language_detection_options: { expected_languages: ['en'] },
      },
    })
    await t.transcribe('/tmp/a.mp3', { lang: 'es' })
    const submit = api.calls.find((c) => c.url.endsWith('/v2/transcript'))!
    expect(submit.body).toEqual({ language_code: 'es', audio_url: 'https://cdn.assemblyai.test/a' })
  })

  it('reports a failed transcript', async () => {
    const api = fakeApi(['error'])
    const t = createAssemblyAiTranscriber({ ...base, fetch: api.fetch })
    await expect(t.transcribeDetailed!('/tmp/a.mp3', {})).rejects.toThrow('Audio has no speech')
  })
})

describe('assemblyAiConfigFromEnv', () => {
  it('maps documented options and lets ASSEMBLYAI_EXTRA_PARAMS add more', () => {
    const config = assemblyAiConfigFromEnv({
      ASSEMBLYAI_API_KEY: 'k',
      ASSEMBLYAI_BASE_URL: 'https://api.eu.assemblyai.com',
      ASSEMBLYAI_SPEECH_MODELS: 'universal-3-5-pro, universal-2',
      ASSEMBLYAI_EXPECTED_LANGUAGES: 'en,am',
      ASSEMBLYAI_FALLBACK_LANGUAGE: 'auto',
      ASSEMBLYAI_SPEAKER_LABELS: 'true',
      ASSEMBLYAI_KEYTERMS: 'fraction,denominator',
      ASSEMBLYAI_CHARS_PER_CAPTION: '40',
      ASSEMBLYAI_EXTRA_PARAMS: '{"entity_detection":true,"punctuate":false}',
    })
    expect(config.baseUrl).toBe('https://api.eu.assemblyai.com')
    expect(config.charsPerCaption).toBe(40)
    expect(config.params).toEqual({
      speech_models: ['universal-3-5-pro', 'universal-2'],
      language_detection: false,
      language_detection_options: { expected_languages: ['en', 'am'], fallback_language: 'auto' },
      punctuate: false,
      format_text: true,
      speaker_labels: true,
      keyterms_prompt: ['fraction', 'denominator'],
      entity_detection: true,
    })
  })

  it('defaults language_detection off when nothing is set', () => {
    expect(assemblyAiConfigFromEnv({ ASSEMBLYAI_API_KEY: 'k' }).params).toEqual({
      language_detection: false,
      punctuate: true,
      format_text: true,
    })
  })

  it('turns detection off when a language code is fixed', () => {
    const config = assemblyAiConfigFromEnv({ ASSEMBLYAI_LANGUAGE_CODE: 'en' })
    expect(config.params).toEqual({ language_code: 'en', punctuate: true, format_text: true })
  })

  it('rejects malformed values', () => {
    expect(() => assemblyAiConfigFromEnv({ ASSEMBLYAI_PUNCTUATE: 'maybe' })).toThrow(
      /true or false/,
    )
    expect(() => assemblyAiConfigFromEnv({ ASSEMBLYAI_EXTRA_PARAMS: '[1]' })).toThrow(/JSON object/)
  })
})
