import { parseVtt } from '@abolkit/core'
import type { MediaTrack } from '../engine.js'

/** The VTTCue fields the player reads. */
export interface TimedCue {
  id: string
  startTime: number
  endTime: number
  text: string
}

/**
 * A TextTrack stand-in for media that cannot hold `<track>` elements (the YouTube iframe): the host's VTT file,
 * with `activeCues` and `cuechange` driven by the engine's clock instead of the browser.
 */
export class CueTrack extends EventTarget {
  readonly id = ''
  readonly kind: MediaTrack['kind']
  readonly label: string
  readonly language: string
  cues: TimedCue[] | null = null
  activeCues: TimedCue[] = []
  loaded = false
  #mode: TextTrackMode
  #list: CueTrackList

  constructor(info: MediaTrack, list: CueTrackList) {
    super()
    this.kind = info.kind
    this.label = info.label
    this.language = info.lang
    this.#list = list
    this.#mode =
      info.default && (info.kind === 'captions' || info.kind === 'subtitles')
        ? 'showing'
        : 'disabled'
  }

  get mode(): TextTrackMode {
    return this.#mode
  }

  set mode(value: TextTrackMode) {
    if (value === this.#mode) return
    this.#mode = value
    this.#list.onModeChange(this)
  }

  async load(src: string, signal: AbortSignal): Promise<void> {
    try {
      const res = await fetch(src, { signal })
      if (!res.ok) throw new Error(`Track HTTP ${res.status}`)
      this.cues = parseVtt(await res.text()).map((cue, i) => ({
        id: cue.id ?? String(i),
        startTime: cue.start,
        endTime: cue.end,
        text: cue.text,
      }))
    } catch (err) {
      if (signal.aborted) return
      console.warn('[abol-player] Could not load track', src, err)
      this.cues = []
    }
    this.loaded = true
    this.dispatchEvent(new Event('load'))
  }

  /** Recompute `activeCues` for `time`; fires `cuechange` when the set changes. */
  tick(time: number): void {
    const next =
      this.#mode === 'disabled' || !this.cues
        ? []
        : this.cues.filter((c) => time >= c.startTime && time < c.endTime)
    if (next.length === this.activeCues.length && next.every((c, i) => c === this.activeCues[i]))
      return
    this.activeCues = next
    this.dispatchEvent(new Event('cuechange'))
  }
}

/** TextTrackList-shaped: iterable, indexed, and fires `change` (once per tick) when a mode changes. */
export class CueTrackList extends EventTarget {
  readonly #tracks: CueTrack[]
  readonly #clock: () => number
  readonly #abort = new AbortController()
  #changeQueued = false

  constructor(infos: readonly MediaTrack[], clock: () => number) {
    super()
    this.#clock = clock
    this.#tracks = []
    for (const info of infos) this.#push(info)
  }

  /** Add a track after construction; fires `addtrack` like a TextTrackList. */
  add(info: MediaTrack): CueTrack {
    const track = this.#push(info)
    const event = new Event('addtrack') as Event & { track: CueTrack }
    event.track = track
    this.dispatchEvent(event)
    return track
  }

  #push(info: MediaTrack): CueTrack {
    const track = new CueTrack(info, this)
    Object.defineProperty(this, this.#tracks.length, { value: track, enumerable: true })
    this.#tracks.push(track)
    void track.load(info.src, this.#abort.signal).then(() => track.tick(this.#clock()))
    return track
  }

  get length(): number {
    return this.#tracks.length
  }

  [Symbol.iterator](): Iterator<CueTrack> {
    return this.#tracks[Symbol.iterator]()
  }

  tick(time: number): void {
    for (const track of this.#tracks) track.tick(time)
  }

  onModeChange(track: CueTrack): void {
    track.tick(this.#clock())
    if (this.#changeQueued) return
    this.#changeQueued = true
    queueMicrotask(() => {
      this.#changeQueued = false
      this.dispatchEvent(new Event('change'))
    })
  }

  destroy(): void {
    this.#abort.abort()
  }
}
