import { describe, expect, it } from 'vitest'

import { loadCaptionConfig } from './config.ts'
import { assertAllowedHost, identifyVideoUrl } from './video-url.ts'

describe('identifyVideoUrl', () => {
  it.each([
    'https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=42s',
    'https://youtube.com/watch?feature=share&v=dQw4w9WgXcQ',
    'https://m.youtube.com/watch?v=dQw4w9WgXcQ',
    'https://youtu.be/dQw4w9WgXcQ?si=abc',
    'https://www.youtube.com/embed/dQw4w9WgXcQ',
    'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ',
    'https://www.youtube.com/shorts/dQw4w9WgXcQ',
    'https://www.youtube.com/live/dQw4w9WgXcQ',
  ])('maps %s to one canonical YouTube URL', (raw) => {
    expect(identifyVideoUrl(raw)).toEqual({
      url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      kind: 'youtube',
      youtubeId: 'dQw4w9WgXcQ',
    })
  })

  it('keeps file URLs, dropping only the fragment', () => {
    expect(identifyVideoUrl(' https://cdn.example.org/lesson.mp4?v=2#t=10 ')).toEqual({
      url: 'https://cdn.example.org/lesson.mp4?v=2',
      kind: 'file',
    })
  })

  it.each([
    'ftp://example.org/a.mp4',
    'not a url',
    'https://u:p@example.org/a.mp4',
    'https://youtu.be/short',
  ])('rejects %s', (raw) => {
    expect(() => identifyVideoUrl(raw)).toThrow(expect.objectContaining({ code: 'INVALID_URL' }))
  })
})

describe('assertAllowedHost', () => {
  it('allows listed hosts and their subdomains only', () => {
    const allowed = ['youtube.com', 'example.org']
    expect(() =>
      assertAllowedHost(identifyVideoUrl('https://youtu.be/dQw4w9WgXcQ'), allowed),
    ).not.toThrow()
    expect(() =>
      assertAllowedHost(identifyVideoUrl('https://cdn.example.org/a.mp4'), allowed),
    ).not.toThrow()
    expect(() =>
      assertAllowedHost(identifyVideoUrl('https://badexample.org/a.mp4'), allowed),
    ).toThrow(expect.objectContaining({ code: 'HOST_NOT_ALLOWED' }))
    expect(() => assertAllowedHost(identifyVideoUrl('https://x.test/a.mp4'), ['*'])).not.toThrow()
  })
})

describe('loadCaptionConfig', () => {
  const base = { POSTGRES_URL: 'postgres://x', REDIS_URL: 'redis://x' }

  it('defaults to the four Ethiopian target languages and any host', () => {
    const config = loadCaptionConfig(base)
    expect(config.translationLanguages).toEqual(['am', 'om', 'ti', 'aa'])
    expect(config.allowedHosts).toEqual(['*'])
    expect(config.defaultSourceLanguage).toBe('en')
    expect(config.rateLimit.trustProxy).toBe(false)
  })

  it('requires both stores and validates numbers and language codes', () => {
    expect(() => loadCaptionConfig({ POSTGRES_URL: 'postgres://x' })).toThrow(/REDIS_URL/)
    expect(() => loadCaptionConfig({ ...base, CAPTION_JOB_ATTEMPTS: '0' })).toThrow(
      /CAPTION_JOB_ATTEMPTS/,
    )
    expect(() => loadCaptionConfig({ ...base, TRANSLATION_LANGUAGES: 'am,Amharic' })).toThrow(
      /Amharic/,
    )
  })
})
