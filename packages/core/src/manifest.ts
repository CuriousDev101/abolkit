/** Caption track listed on a lesson manifest. */
export interface CaptionTrack {
  lang: string
  label: string
  src: string
  default?: boolean
}

/** Description track (WebVTT) plus optional voice-clip manifest. */
export interface DescriptionTrack {
  lang: string
  src: string
  /** URL of AD clip JSON (`AdClip[]`). */
  clips?: string
}

/** Ethiopian Sign Language (or placeholder) second-video window. */
export interface SignTrack {
  /** ISO 639-3; `ets` for Ethiopian Sign Language. */
  lang: string
  src: string
  /** When true the player shows a visible "sample content" note. */
  placeholder?: boolean
}

export interface LessonMedia {
  video: string
  audio?: string
  poster?: string
}

/**
 * Lesson manifest — static JSON file or `GET /api/lessons/:id`.
 * All fields except `media.video` and one caption track are optional;
 * the player hides features whose data is missing.
 */
export interface LessonManifest {
  id: string
  title: string
  lang: string
  media: LessonMedia
  captions?: CaptionTrack[]
  descriptions?: DescriptionTrack[]
  sign?: SignTrack
  transcript?: { src: string }
  offlinePack?: string
}

/** One audio-description voice clip (`ad.<lang>.json`). */
export interface AdClip {
  id: string
  start: number
  end: number
  text: string
  audio: string
  pauseVideo?: boolean
}

export function isLessonManifest(value: unknown): value is LessonManifest {
  if (!value || typeof value !== 'object') return false
  const m = value as Record<string, unknown>
  if (typeof m.id !== 'string' || typeof m.title !== 'string' || typeof m.lang !== 'string') {
    return false
  }
  const media = m.media
  if (!media || typeof media !== 'object') return false
  return typeof (media as Record<string, unknown>).video === 'string'
}
