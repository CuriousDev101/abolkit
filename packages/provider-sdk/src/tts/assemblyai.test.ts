import { describe, expect, it } from 'vitest'

import { assemblyAiTtsConfigFromEnv, createAssemblyAiTts } from './assemblyai.ts'

describe('createAssemblyAiTts', () => {
  it('posts buffered MP3 English speech and returns audio bytes', async () => {
    const calls: Array<{ url: string; body: unknown; headers: HeadersInit | undefined }> = []
    const audio = new Uint8Array([1, 2, 3, 4])
    const fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      calls.push({
        url: String(input),
        body: typeof init?.body === 'string' ? JSON.parse(init.body) : init?.body,
        headers: init?.headers,
      })
      return new Response(audio, {
        status: 200,
        headers: { 'Content-Type': 'audio/mpeg' },
      })
    }) as typeof globalThis.fetch

    const tts = createAssemblyAiTts({
      apiKey: 'secret',
      fetch,
      voiceId: 'aai-kyla',
    })

    const out = await tts.synthesize('Hello graduates.', { lang: 'en' })
    expect(out.mime).toBe('audio/mpeg')
    expect(out.bytes).toEqual(audio)
    expect(tts.languages()).toEqual(['en'])
    expect(tts.sendsDataOffHost).toBe(true)

    expect(calls).toHaveLength(1)
    expect(calls[0]!.url).toBe('https://tts.us.assemblyai.com/v1/speech')
    expect(calls[0]!.body).toEqual({
      text: 'Hello graduates.',
      voice_id: 'aai-kyla',
      encoding: 'mp3',
      language: 'english',
      stream: false,
    })
    expect((calls[0]!.headers as Record<string, string>).Authorization).toBe('secret')
  })

  it('rejects non-English languages', async () => {
    const tts = createAssemblyAiTts({
      apiKey: 'secret',
      fetch: (async () => new Response(new Uint8Array([1]), { status: 200 })) as typeof fetch,
    })
    await expect(tts.synthesize('ሰላም', { lang: 'am' })).rejects.toMatchObject({
      code: 'BAD_REQUEST',
    })
  })

  it('maps HTTP failures to ProviderError', async () => {
    const tts = createAssemblyAiTts({
      apiKey: 'secret',
      fetch: (async () =>
        new Response(JSON.stringify({ error: 'bad voice' }), {
          status: 422,
        })) as typeof fetch,
    })
    await expect(tts.synthesize('Hello', { lang: 'en' })).rejects.toMatchObject({
      code: 'HTTP_ERROR',
      message: expect.stringContaining('bad voice'),
    })
  })
})

describe('assemblyAiTtsConfigFromEnv', () => {
  it('reads key, TTS host, voice and encoding', () => {
    expect(
      assemblyAiTtsConfigFromEnv({
        ASSEMBLYAI_API_KEY: 'k',
        ASSEMBLYAI_TTS_BASE_URL: 'https://tts.eu.assemblyai.com/',
        ASSEMBLYAI_TTS_VOICE_ID: 'aai-donatien',
        ASSEMBLYAI_TTS_ENCODING: 'wav',
      }),
    ).toEqual({
      apiKey: 'k',
      baseUrl: 'https://tts.eu.assemblyai.com/',
      voiceId: 'aai-donatien',
      encoding: 'wav',
    })
  })
})
