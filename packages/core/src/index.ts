// @abolkit/core: shared, dependency-free code used by the player, the API and the worker.
// Owner: pair "ab". Reviewer: pair "ol". See docs-internal/modules/player.md and captions contract in architecture.md.

/** One timed text cue. Times are in seconds. Used for captions, descriptions and transcripts. */
export interface Cue {
  id?: string
  start: number
  end: number
  text: string
  /** Set by the pipeline when a machine produced the text and no human has reviewed it yet. */
  needsReview?: boolean
}

// TODO(#15): parseVtt(text: string): Cue[]   serializeVtt(cues: Cue[]): string   (+ unit tests)
