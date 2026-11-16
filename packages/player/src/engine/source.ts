import type { MediaSource } from '../engine.js'

export const isHls = (source: Pick<MediaSource, 'src' | 'type'>) =>
  /mpegurl/i.test(source.type ?? '') || /\.m3u8(?:[?#]|$)/i.test(source.src)

export const isYouTube = (source: Pick<MediaSource, 'src' | 'type'>) =>
  /youtube/i.test(source.type ?? '') ||
  /^(?:https?:)?\/\/(?:[\w-]+\.)?(?:youtube(?:-nocookie)?\.com|youtu\.be)\//i.test(source.src)

/** Extract a YouTube video id from common watch / short / embed / youtu.be URLs. */
export function youtubeVideoId(src: string): string | null {
  const raw = src.trim()
  if (!raw) return null
  try {
    const url = new URL(raw, 'https://youtube.com')
    const host = url.hostname.replace(/^www\./, '')
    if (host === 'youtu.be') {
      const id = url.pathname.split('/').filter(Boolean)[0]
      return id || null
    }
    if (host === 'youtube.com' || host === 'm.youtube.com' || host === 'youtube-nocookie.com') {
      if (url.pathname.startsWith('/embed/') || url.pathname.startsWith('/shorts/')) {
        return url.pathname.split('/')[2] || null
      }
      return url.searchParams.get('v')
    }
  } catch {
    return null
  }
  return null
}
