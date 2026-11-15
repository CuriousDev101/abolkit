import type { MediaSource } from '../engine.js'

export const isHls = (source: Pick<MediaSource, 'src' | 'type'>) =>
  /mpegurl/i.test(source.type ?? '') || /\.m3u8(?:[?#]|$)/i.test(source.src)

export const isYouTube = (source: Pick<MediaSource, 'src' | 'type'>) =>
  /youtube/i.test(source.type ?? '') ||
  /^(?:https?:)?\/\/(?:[\w-]+\.)?(?:youtube(?:-nocookie)?\.com|youtu\.be)\//i.test(source.src)
