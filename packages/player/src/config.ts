import type { LessonManifest } from '@abolkit/core'
import type { MediaTrack } from './engine.js'

/** Everything the player needs, from attributes, `<track>` children, a manifest, or a mix. */
export interface LessonConfig {
  src?: string
  poster?: string
  /** Low-bandwidth audio-only version of the lesson. */
  audio?: string
  title?: string
  lang?: string
  tracks: MediaTrack[]
  sign?: { src: string; placeholder: boolean }
  transcript?: string
  /** AD voice clip manifest (`AdClip[]`). */
  adClips?: string
}

export function languageName(lang: string): string {
  try {
    return new Intl.DisplayNames([lang], { type: 'language' }).of(lang) ?? lang
  } catch {
    return lang
  }
}

const TRACK_KINDS = ['captions', 'subtitles', 'descriptions', 'chapters']

export function configFromAttributes(el: HTMLElement): LessonConfig {
  const attr = (name: string) => el.getAttribute(name) || undefined
  const url = (name: string) => {
    const value = attr(name)
    return value ? new URL(value, document.baseURI).href : undefined
  }
  const lang = attr('lang') ?? (document.documentElement.lang || 'en')
  const tracks: MediaTrack[] = []

  const captions = url('captions')
  if (captions) {
    const captionsLang = attr('captions-lang') ?? lang
    tracks.push({
      kind: 'captions',
      src: captions,
      lang: captionsLang,
      label: attr('captions-label') ?? languageName(captionsLang),
      default: true,
    })
  }

  const descriptions = url('descriptions')
  if (descriptions) tracks.push({ kind: 'descriptions', src: descriptions, lang, label: 'Audio description' })

  for (const child of el.querySelectorAll<HTMLTrackElement>(':scope > track')) {
    const kind = child.getAttribute('kind') ?? 'captions'
    if (!child.src || !TRACK_KINDS.includes(kind)) continue
    const trackLang = child.srclang || lang
    tracks.push({
      kind: kind as MediaTrack['kind'],
      src: child.src,
      lang: trackLang,
      label: child.label || languageName(trackLang),
      default: child.default,
    })
  }

  const sign = url('sign')
  return {
    src: url('src'),
    poster: url('poster'),
    audio: url('audio'),
    lang: attr('lang'),
    tracks,
    sign: sign ? { src: sign, placeholder: el.hasAttribute('sign-placeholder') } : undefined,
    transcript: url('transcript'),
  }
}

export function configFromManifest(m: LessonManifest, base: string): LessonConfig {
  const url = (value?: string) => (value ? new URL(value, base).href : undefined)
  return {
    src: url(m.media.video),
    poster: url(m.media.poster),
    audio: url(m.media.audio),
    title: m.title,
    lang: m.lang,
    tracks: [
      ...(m.captions ?? []).map((c) => ({
        kind: 'captions' as const,
        src: url(c.src)!,
        lang: c.lang,
        label: c.label,
        default: c.default,
      })),
      ...(m.descriptions ?? []).map((d) => ({
        kind: 'descriptions' as const,
        src: url(d.src)!,
        lang: d.lang,
        label: 'Audio description',
      })),
    ],
    sign: m.sign ? { src: url(m.sign.src)!, placeholder: m.sign.placeholder === true } : undefined,
    transcript: url(m.transcript?.src),
    adClips: url(m.descriptions?.[0]?.clips),
  }
}

/** Attribute values win over the manifest; tracks from both are kept. */
export function mergeConfig(base: LessonConfig, over: LessonConfig): LessonConfig {
  const merged: LessonConfig = { ...base, tracks: [...base.tracks, ...over.tracks] }
  for (const [key, value] of Object.entries(over)) {
    if (key !== 'tracks' && value !== undefined) Object.assign(merged, { [key]: value })
  }
  return merged
}
