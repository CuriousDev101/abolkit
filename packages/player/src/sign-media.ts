import { isYouTube, youtubeVideoId } from './engine/source.js'

/** Sign-window media: native `<video>` or an isolated YouTube IFrame player (not `<youtube-video>`). */
export type SignPlayable = {
  play(): Promise<void>
  pause(): void
  currentTime: number
  playbackRate: number
  readyState: number
  paused: boolean
  muted: boolean
  addEventListener(
    type: string,
    listener: EventListenerOrEventListenerObject,
    options?: boolean | AddEventListenerOptions,
  ): void
  removeEventListener(
    type: string,
    listener: EventListenerOrEventListenerObject,
    options?: boolean | EventListenerOptions,
  ): void
  /** Present on the isolated YouTube follower. */
  destroy?: () => void
}

type YtPlayer = {
  playVideo(): void
  pauseVideo(): void
  seekTo(seconds: number, allowSeekAhead: boolean): void
  mute(): void
  unMute(): void
  getCurrentTime(): number
  getPlayerState(): number
  getPlaybackRate(): number
  setPlaybackRate(rate: number): void
  destroy(): void
}

type YtNamespace = {
  Player: new (
    el: HTMLElement | string,
    opts: {
      videoId: string
      width?: string | number
      height?: string | number
      playerVars?: Record<string, string | number>
      events?: {
        onReady?: (ev: { target: YtPlayer }) => void
        onStateChange?: (ev: { data: number; target: YtPlayer }) => void
        onError?: () => void
      }
    },
  ) => YtPlayer
  ready: (cb: () => void) => void
  PlayerState: { PLAYING: number; PAUSED: number; BUFFERING: number; ENDED: number; CUED: number }
}

declare global {
  // eslint-disable-next-line no-var
  var YT: YtNamespace | undefined
}

let ytApiPromise: Promise<YtNamespace> | null = null

/**
 * Wait for the YouTube IFrame API without touching `onYouTubeIframeAPIReady`.
 * Video.js's `<youtube-video>` also loads this script; hijacking that callback breaks the main player.
 */
function loadYouTubeApi(): Promise<YtNamespace> {
  if (ytApiPromise) return ytApiPromise
  ytApiPromise = (async () => {
    const ready = async (api: YtNamespace) => {
      await new Promise<void>((resolve) => api.ready(resolve))
      return api
    }
    if (globalThis.YT?.Player) return ready(globalThis.YT)

    if (!document.querySelector('script[src*="youtube.com/iframe_api"]')) {
      await new Promise<void>((resolve, reject) => {
        const script = document.createElement('script')
        script.src = 'https://www.youtube.com/iframe_api'
        script.async = true
        script.onload = () => resolve()
        script.onerror = () => reject(new Error('Failed to load YouTube iframe API script'))
        document.head.append(script)
      })
    }

    for (let i = 0; i < 200; i++) {
      if (globalThis.YT?.Player) return ready(globalThis.YT)
      await new Promise((r) => setTimeout(r, 50))
    }
    throw new Error('YouTube iframe API failed to load')
  })().catch((err) => {
    ytApiPromise = null
    throw err
  })
  return ytApiPromise
}

/**
 * Isolated YouTube follower for the sign window.
 * Uses YT.Player directly — never `<youtube-video>` — so it does not fight the main lesson iframe.
 */
class SignYouTubeMedia implements SignPlayable {
  #player: YtPlayer | null = null
  #paused = true
  #readyState = 0
  #time = 0
  #rate = 1
  #muted = true
  #listeners = new Map<string, Set<EventListenerOrEventListenerObject>>()
  #poll = 0
  #ready: Promise<void>
  #destroyed = false

  constructor(host: HTMLElement, videoId: string) {
    const mount = document.createElement('div')
    mount.className = 'sign-stream sign-yt'
    host.append(mount)
    host.toggleAttribute('data-youtube', true)

    this.#ready = loadYouTubeApi().then(
      (api) =>
        new Promise<void>((resolve, reject) => {
          if (this.#destroyed) {
            resolve()
            return
          }
          this.#player = new api.Player(mount, {
            videoId,
            width: '100%',
            height: '100%',
            playerVars: {
              autoplay: 0,
              controls: 0,
              disablekb: 1,
              fs: 0,
              modestbranding: 1,
              playsinline: 1,
              rel: 0,
              iv_load_policy: 3,
              mute: 1,
              origin: typeof location !== 'undefined' ? location.origin : '',
            },
            events: {
              onReady: ({ target }) => {
                if (this.#destroyed) {
                  target.destroy()
                  return
                }
                this.#player = target
                this.#readyState = HTMLMediaElement.HAVE_ENOUGH_DATA
                try {
                  target.mute()
                  target.pauseVideo()
                } catch {
                  /* ignore */
                }
                this.#paused = true
                this.#emit('canplay')
                this.#poll = window.setInterval(() => this.#tick(), 250)
                resolve()
              },
              onStateChange: (ev) => {
                const state = api.PlayerState
                const playing = ev.data === (state?.PLAYING ?? 1)
                const paused =
                  ev.data === (state?.PAUSED ?? 2) ||
                  ev.data === (state?.ENDED ?? 0) ||
                  ev.data === (state?.CUED ?? 5)
                if (playing) {
                  this.#paused = false
                  this.#emit('play')
                  this.#emit('playing')
                } else if (paused) {
                  this.#paused = true
                  this.#emit('pause')
                } else if (ev.data === (state?.BUFFERING ?? 3)) {
                  this.#emit('waiting')
                }
              },
              onError: () => this.#emit('error'),
            },
          })
        }),
    )
  }

  #tick(): void {
    if (!this.#player?.getCurrentTime) return
    try {
      const t = this.#player.getCurrentTime()
      if (Number.isFinite(t) && Math.abs(t - this.#time) > 0.05) {
        this.#time = t
        this.#emit('timeupdate')
      }
    } catch {
      /* player torn down */
    }
  }

  #emit(type: string): void {
    const list = this.#listeners.get(type)
    if (!list) return
    const ev = new Event(type)
    for (const listener of list) {
      if (typeof listener === 'function') listener.call(this, ev)
      else listener.handleEvent(ev)
    }
  }

  play(): Promise<void> {
    return this.#ready.then(() => {
      if (this.#destroyed || !this.#player) return
      try {
        this.#player.mute()
        this.#player.playVideo()
        this.#paused = false
      } catch {
        /* ignore */
      }
    })
  }

  pause(): void {
    if (!this.#player) {
      this.#paused = true
      return
    }
    try {
      this.#player.pauseVideo()
    } catch {
      /* ignore */
    }
    this.#paused = true
  }

  get currentTime(): number {
    try {
      return this.#player?.getCurrentTime?.() ?? this.#time
    } catch {
      return this.#time
    }
  }

  set currentTime(seconds: number) {
    this.#time = seconds
    try {
      this.#player?.seekTo(seconds, true)
    } catch {
      /* ignore */
    }
  }

  get playbackRate(): number {
    try {
      return this.#player?.getPlaybackRate?.() ?? this.#rate
    } catch {
      return this.#rate
    }
  }

  set playbackRate(rate: number) {
    this.#rate = rate
    try {
      this.#player?.setPlaybackRate(rate)
    } catch {
      /* ignore */
    }
  }

  get readyState(): number {
    return this.#readyState
  }

  get paused(): boolean {
    return this.#paused
  }

  get muted(): boolean {
    return this.#muted
  }

  set muted(value: boolean) {
    this.#muted = value
    try {
      if (value) this.#player?.mute()
      else this.#player?.unMute()
    } catch {
      /* ignore */
    }
  }

  addEventListener(
    type: string,
    listener: EventListenerOrEventListenerObject,
    _options?: boolean | AddEventListenerOptions,
  ): void {
    let set = this.#listeners.get(type)
    if (!set) {
      set = new Set()
      this.#listeners.set(type, set)
    }
    set.add(listener)
  }

  removeEventListener(
    type: string,
    listener: EventListenerOrEventListenerObject,
    _options?: boolean | EventListenerOptions,
  ): void {
    this.#listeners.get(type)?.delete(listener)
  }

  destroy(): void {
    this.#destroyed = true
    window.clearInterval(this.#poll)
    this.#poll = 0
    this.#listeners.clear()
    try {
      this.#player?.destroy()
    } catch {
      /* ignore */
    }
    this.#player = null
    this.#readyState = 0
  }
}

/**
 * Mount MP4/direct file as `<video>`, or YouTube as an isolated YT.Player follower
 * (never a second `<youtube-video>`, which races the main lesson iframe).
 */
export function mountSignMedia(host: HTMLElement, src: string): SignPlayable | null {
  host.replaceChildren()
  const url = src.trim()
  if (!url) return null

  if (isYouTube({ src: url })) {
    const id = youtubeVideoId(url)
    if (!id) {
      console.warn('[abol-player] Could not parse YouTube id for sign window:', url)
      return null
    }
    return new SignYouTubeMedia(host, id)
  }

  host.removeAttribute('data-youtube')
  const video = document.createElement('video')
  video.muted = true
  video.playsInline = true
  video.controls = false
  video.preload = 'metadata'
  video.setAttribute('aria-hidden', 'true')
  video.tabIndex = -1
  video.src = url
  host.append(video)
  return video
}

/** Stop download while audio-only / teardown; clear the host slot. */
export function unloadSignMedia(media: SignPlayable | null, host: HTMLElement | null): void {
  if (!media) {
    host?.replaceChildren()
    host?.removeAttribute('data-youtube')
    return
  }
  try {
    media.pause()
  } catch {
    /* ignore */
  }
  if (typeof media.destroy === 'function') {
    media.destroy()
  } else if (media instanceof HTMLMediaElement) {
    media.removeAttribute('src')
    media.load()
  }
  host?.replaceChildren()
  host?.removeAttribute('data-youtube')
}
