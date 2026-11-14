// The seam between our UI and whatever plays the media (ADR 0001).
// Video.js is the first implementation; a native <video> implementation is the planned fallback.
// Captions overlay, sign window and audio description talk ONLY to this interface.

export type EngineEvent =
  | 'play'
  | 'pause'
  | 'seeking'
  | 'seeked'
  | 'timeupdate'
  | 'ratechange'
  | 'volumechange'
  | 'waiting'
  | 'canplay'
  | 'ended'
  | 'error'

export interface MediaEngine {
  /** Mount the media element(s) inside the given container (a node inside our Shadow DOM). */
  mount(container: HTMLElement, source: { src: string; type?: string; poster?: string }): void
  destroy(): void

  play(): Promise<void>
  pause(): void
  seek(seconds: number): void

  readonly currentTime: number
  readonly duration: number
  readonly paused: boolean
  volume: number
  muted: boolean
  playbackRate: number

  on(event: EngineEvent, handler: () => void): () => void // returns an unsubscribe function

  /** Needed by the sign window to stay in sync and by the offline mode to pick the audio-only source. */
  readonly element: HTMLMediaElement
}
