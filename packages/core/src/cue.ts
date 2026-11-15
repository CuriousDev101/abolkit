/** One timed text cue. Times are in seconds. Used for captions, descriptions and transcripts. */
export interface Cue {
  id?: string
  start: number
  end: number
  text: string
  /** Set by the pipeline when a machine produced the text and no human has reviewed it yet. */
  needsReview?: boolean
}

/** Find the active cue at `time` (seconds). Returns the last match if cues overlap. */
export function cueAt(cues: readonly Cue[], time: number): Cue | undefined {
  let found: Cue | undefined
  for (const cue of cues) {
    if (time >= cue.start && time < cue.end) found = cue
  }
  return found
}

/** True when any cue still needs human review. */
export function hasUnreviewed(cues: readonly Cue[]): boolean {
  return cues.some((c) => c.needsReview === true)
}
