// Only the player, the compat skin's components and a few extra UI elements are imported (see skin.ts).
// build.mjs rejects any other @videojs/html entry and strips the 50+ Video.js locale packs (English is built in).
import '@videojs/html/video/player'
import '@videojs/html/media/youtube-video'
import type { MediaSource, MediaTrack } from '../engine.js'
import { CueTrackList } from './cue-track.js'
import { buildVideo, NativeEngine, type Playable } from './native.js'
import { SKIN_TAG } from './skin.js'
import { isHls, isYouTube } from './source.js'

const isCaption = (track: { kind: string }) =>
  track.kind === 'captions' || track.kind === 'subtitles'

export class VideoJsEngine extends NativeEngine {
  override readonly kind = 'videojs' as const
  #skin: HTMLElement | null = null
  /** <hls-video> or <youtube-video>: whichever owns the source URL. */
  #stream: HTMLElement | null = null
  /** YouTube only: the host's VTT tracks, since the iframe cannot load them. */
  #cueTracks: CueTrackList | null = null
  #unbind: Array<() => void> = []

  readonly hls: boolean

  /** @param hls whether <hls-video> is registered (the stream build). */
  constructor(hls = false) {
    super()
    this.hls = hls
  }

  override mount(container: HTMLElement, source: MediaSource): void {
    this.destroy()
    const player = document.createElement('video-player')
    if (source.poster) player.setAttribute('poster', source.poster)
    if (source.title) player.setAttribute('content-title', source.title)
    const skin = document.createElement(SKIN_TAG)
    player.append(skin)
    container.replaceChildren(player)
    this.root = player
    this.#skin = skin

    if (isYouTube(source)) {
      this.#mountYouTube(skin, source)
      return
    }
    const video = buildVideo(source)
    if (this.hls && isHls(source)) {
      const stream = document.createElement('hls-video')
      video.removeAttribute('src')
      video.slot = 'media'
      stream.className = 'stream'
      stream.setAttribute('src', source.src)
      if (source.crossOrigin != null) stream.setAttribute('crossorigin', source.crossOrigin)
      stream.append(video)
      skin.append(stream)
      this.#stream = stream
    } else {
      skin.append(video)
    }
    this.media = video
  }

  #mountYouTube(skin: HTMLElement, source: MediaSource): void {
    const yt = document.createElement('youtube-video')
    yt.className = 'stream'
    yt.setAttribute('src', source.src)
    yt.setAttribute('playsinline', '')
    skin.append(yt)
    const media = yt as unknown as Playable
    this.media = media
    this.#stream = yt

    const tracks = new CueTrackList(source.tracks ?? [], () => media.currentTime)
    this.#cueTracks = tracks
    const tick = () => tracks.tick(media.currentTime)
    const listen = (target: EventTarget, type: string, handler: () => void) => {
      target.addEventListener(type, handler)
      this.#unbind.push(() => target.removeEventListener(type, handler))
    }
    listen(yt, 'timeupdate', tick)
    listen(yt, 'seeked', tick)
    // One caption source at a time: picking a host track turns YouTube's off, and the reverse.
    const own = media.textTracks as TextTrackList | undefined
    listen(tracks, 'change', () => {
      if (own && [...tracks].some((tr) => isCaption(tr) && tr.mode === 'showing')) {
        for (const tr of Array.from(own)) tr.mode = 'disabled'
      }
    })
    if (own) {
      listen(own, 'change', () => {
        if (!Array.from(own).some((tr) => tr.mode === 'showing')) return
        for (const tr of tracks) if (isCaption(tr) && tr.mode === 'showing') tr.mode = 'disabled'
      })
    }
  }

  override setSource(src: string): void {
    if (this.#stream) this.#stream.setAttribute('src', src)
    else super.setSource(src)
  }

  override get textTracks(): TextTrackList {
    return (this.#cueTracks as unknown as TextTrackList | null) ?? super.textTracks
  }

  override get customTracks(): boolean {
    return !!this.#cueTracks
  }

  override addTrack(info: MediaTrack): TextTrack | null {
    if (!this.#cueTracks) return super.addTrack(info)
    return this.#cueTracks.add(info) as unknown as TextTrack
  }

  override whenLoaded(track: TextTrack, handler: () => void): boolean {
    if (!this.#cueTracks) return super.whenLoaded(track, handler)
    const cueTrack = track as unknown as { loaded: boolean } & EventTarget
    if (cueTrack.loaded) return false
    cueTrack.addEventListener('load', handler, { once: true })
    return true
  }

  override destroy(): void {
    for (const off of this.#unbind) off()
    this.#unbind = []
    this.#cueTracks?.destroy()
    this.#cueTracks = null
    this.#stream?.removeAttribute('src')
    super.destroy()
    this.#skin = null
    this.#stream = null
  }

  /** Children of the skin are slotted inside its media container, which is what goes fullscreen. */
  override get overlay(): HTMLElement {
    if (!this.#skin) throw new Error('Engine is not mounted')
    return this.#skin
  }

  override get controls(): ShadowRoot | null {
    return this.#skin?.shadowRoot ?? null
  }
}
