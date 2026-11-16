import { describe, expect, it, vi } from 'vitest'

import {
  orderCaptionStatusRows,
  orderCaptionsForDelivery,
  parseGenerateCaptions,
  retryCaptions,
  type ApiCaption,
  type CaptionStatus,
} from './caption-api.ts'

describe('parseGenerateCaptions', () => {
  it('accepts empty (transcript only) and known languages', () => {
    expect(parseGenerateCaptions('')).toEqual({ valid: true, languages: [] })
    expect(parseGenerateCaptions('am om')).toEqual({ valid: true, languages: ['am', 'om'] })
  })

  it('rejects unknown languages', () => {
    expect(parseGenerateCaptions('fr')).toMatchObject({ valid: false })
  })
})

describe('orderCaptionsForDelivery', () => {
  it('puts transcript before translations', () => {
    const captions: ApiCaption[] = [
      { language: 'am', kind: 'translation', url: '/am', needsReview: true },
      { language: 'en', kind: 'transcript', url: '/en', needsReview: false },
      { language: 'om', kind: 'translation', url: '/om', needsReview: true },
    ]
    expect(orderCaptionsForDelivery(captions).map((c) => c.language)).toEqual(['en', 'am', 'om'])
  })
})

describe('orderCaptionStatusRows', () => {
  it('lists English/source first, then wanted translations', () => {
    const status: CaptionStatus = {
      status: 'processing',
      captions: [],
      jobs: [
        {
          id: 't1',
          type: 'transcribe',
          language: 'en',
          status: 'running',
          progress: 40,
          error: null,
        },
        {
          id: 'a1',
          type: 'translate',
          language: 'am',
          status: 'queued',
          progress: 0,
          error: null,
        },
      ],
    }
    const rows = orderCaptionStatusRows(status, ['am', 'om'], 'en')
    expect(rows.map((r) => r.language)).toEqual(['en', 'am', 'om'])
    expect(rows[0]).toMatchObject({ kind: 'transcript', state: 'running', progress: 40 })
    expect(rows[1]).toMatchObject({ kind: 'translation', state: 'queued' })
    expect(rows[2]).toMatchObject({ kind: 'translation', state: 'queued' })
  })

  it('marks failed translation rows for refresh', () => {
    const status: CaptionStatus = {
      status: 'failed',
      captions: [{ language: 'en', kind: 'transcript', url: '/en', needsReview: false }],
      jobs: [
        {
          id: 't1',
          type: 'transcribe',
          language: 'en',
          status: 'succeeded',
          progress: 100,
          error: null,
        },
        {
          id: 'a1',
          type: 'translate',
          language: 'am',
          status: 'failed',
          progress: 0,
          error: 'boom',
        },
      ],
    }
    const rows = orderCaptionStatusRows(status, ['am'], 'en')
    expect(rows[0]).toMatchObject({ language: 'en', state: 'succeeded' })
    expect(rows[1]).toMatchObject({ language: 'am', state: 'failed' })
  })
})

describe('retryCaptions', () => {
  it('force-POSTs generate then delivers transcript before translations', async () => {
    const calls: string[] = []
    const status: CaptionStatus = {
      status: 'ready',
      captions: [
        { language: 'am', kind: 'translation', url: 'https://api.test/am.vtt', needsReview: true },
        { language: 'en', kind: 'transcript', url: 'https://api.test/en.vtt', needsReview: false },
      ],
      jobs: [],
    }
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input)
        calls.push(`${init?.method ?? 'GET'} ${url}`)
        if (url.endsWith('/api/captions/generate')) {
          return new Response(JSON.stringify(status), { status: 200 })
        }
        if (url.endsWith('.vtt')) {
          return new Response(`WEBVTT\n\n00:00:00.000 --> 00:00:01.000\n${url}\n`, {
            status: 200,
          })
        }
        return new Response('missing', { status: 404 })
      }),
    )

    const delivered: string[] = []
    await retryCaptions({
      api: 'https://api.test',
      videoUrl: 'https://youtu.be/abc',
      languages: ['am'],
      signal: new AbortController().signal,
      onCaption: (caption) => delivered.push(caption.language),
    })

    expect(calls.some((c) => c.startsWith('POST ') && c.includes('/generate'))).toBe(true)
    expect(delivered).toEqual(['en', 'am'])
    vi.unstubAllGlobals()
  })
})
