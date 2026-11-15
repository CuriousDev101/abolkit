import type { EngineEvent, MediaEngine, MediaSource } from '../engine.js'

/** What an engine drives: a <video>, or a Video.js media element (e.g. <youtube-video>) that mirrors its API. */
export type Playable = Pick<
  HTMLVideoElement,
  | 'play'
  | 'pause'
  | 'currentTime'
  | 'duration'
  | 'paused'
  | 'volume'
  | 'muted'
  | 'playbackRate'
  | 'textTracks'
  | 'addEventListener'
  | 'removeEventListener'
>

export function buildVideo(source: MediaSource): HTMLVideoElement {
  const video = document.createElement('video')
  video.className = 'main'
  video.playsInline = true
  video.preload = 'metadata'
  if (source.crossOrigin != null) video.crossOrigin = source.crossOrigin
  if (source.poster) video.poster = source.poster
  video.src = source.src
  for (const info of source.tracks ?? []) {
    const track = document.createElement('track')
    track.kind = info.kind
    track.src = info.src
    track.srclang = info.lang
    track.label = info.label
    track.default = info.default === true
    video.append(track)
  }
  return video
}

/** Native `<video controls>` engine: no Video.js cost, used by the lite build and as a fallback. */
export class NativeEngine implements MediaEngine {
  readonly kind: 'videojs' | 'native' = 'native'
  protected media: Playable | null = null
  protected root: HTMLElement | null = null

  mount(container: HTMLElement, source: MediaSource): void {
    this.destroy()
    const video = buildVideo(source)
    video.controls = true
    const frame = document.createElement('div')
    frame.className = 'native-frame'
    frame.append(video)
    container.replaceChildren(frame)
    this.media = video
    this.root = frame
  }

  destroy(): void {
    const media = this.media
    if (media instanceof HTMLMediaElement) {
      media.pause()
      media.removeAttribute('src')
      media.load()
    }
    this.root?.remove()
    this.media = null
    this.root = null
  }

  protected get mounted(): Playable {
    if (!this.media) throw new Error('Engine is not mounted')
    return this.media
  }

  play(): Promise<void> {
    return this.mounted.play()
  }

  pause(): void {
    this.media?.pause()
  }

  seek(seconds: number): void {
    if (this.media && Number.isFinite(seconds)) this.media.currentTime = Math.max(0, seconds)
  }

  get currentTime(): number {
    return this.media?.currentTime ?? 0
  }

  get duration(): number {
    const d = this.media?.duration ?? 0
    return Number.isFinite(d) ? d : 0
  }

  get paused(): boolean {
    return this.media?.paused ?? true
  }

  get volume(): number {
    return this.media?.volume ?? 1
  }

  set volume(value: number) {
    if (this.media) this.media.volume = Math.min(1, Math.max(0, value))
  }

  get muted(): boolean {
    return this.media?.muted ?? false
  }

  set muted(value: boolean) {
    if (this.media) this.media.muted = value
  }

  get playbackRate(): number {
    return this.media?.playbackRate ?? 1
  }

  set playbackRate(value: number) {
    if (this.media) this.media.playbackRate = value
  }

  setSource(src: string): void {
    const media = this.mounted
    if (media instanceof HTMLMediaElement) media.src = src
  }

  get textTracks(): TextTrackList {
    return this.mounted.textTracks
  }

  get customTracks(): boolean {
    return false
  }

  whenLoaded(track: TextTrack, handler: () => void): boolean {
    const media = this.media
    const element =
      media instanceof HTMLMediaElement
        ? Array.from(media.querySelectorAll('track')).find((el) => el.track === track)
        : undefined
    if (!element || element.readyState === HTMLTrackElement.LOADED) return false
    element.addEventListener('load', handler, { once: true })
    return true
  }

  get controls(): ShadowRoot | null {
    return null
  }

  get overlay(): HTMLElement {
    if (!this.root) throw new Error('Engine is not mounted')
    return this.root
  }

  on(event: EngineEvent, handler: () => void): () => void {
    const media = this.mounted
    media.addEventListener(event, handler)
    return () => media.removeEventListener(event, handler)
  }
}
