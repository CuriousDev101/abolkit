import type { Cue } from '@abolkit/core'
import type { Transcriber } from '../types.js'

/**
 * Offline stand-in when TRANSCRIBER_URL is unset (local UI/API work without MMS).
 * Always marks cues as needing review.
 */
export function createStubTranscriber(): Transcriber {
  return {
    id: 'stub',
    label: 'Stub transcriber (no model)',
    sendsDataOffHost: false,
    async transcribe(_audioPath, opts) {
      const cues: Cue[] = [
        {
          id: 'stub-1',
          start: 0,
          end: 1,
          text: `[stub transcript lang=${opts.lang}]`,
          needsReview: true,
        },
      ]
      return cues
    },
  }
}
