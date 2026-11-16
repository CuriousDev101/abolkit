import { describe, expect, it } from 'vitest'

import { isYouTube, youtubeVideoId } from './engine/source.js'

describe('sign media source detection', () => {
  it('treats YouTube watch / short / embed URLs as YouTube', () => {
    expect(isYouTube({ src: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' })).toBe(true)
    expect(isYouTube({ src: 'https://youtu.be/dQw4w9WgXcQ' })).toBe(true)
    expect(isYouTube({ src: 'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ' })).toBe(true)
    expect(isYouTube({ src: 'https://example.com/sign.mp4' })).toBe(false)
  })

  it('parses YouTube video ids', () => {
    expect(youtubeVideoId('https://www.youtube.com/watch?v=dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ')
    expect(youtubeVideoId('https://youtu.be/M7lc1UVf-VE')).toBe('M7lc1UVf-VE')
    expect(youtubeVideoId('https://www.youtube.com/embed/M7lc1UVf-VE')).toBe('M7lc1UVf-VE')
    expect(youtubeVideoId('https://www.youtube.com/shorts/abc123xyz00')).toBe('abc123xyz00')
    expect(youtubeVideoId('https://example.com/sign.mp4')).toBeNull()
  })
})
