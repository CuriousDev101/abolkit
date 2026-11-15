import type { Cue } from '@abolkit/core'
import type { Transcriber } from '../types.ts'

/**
 * Optional cloud STT placeholder. Off by default.
 * `sendsDataOffHost: true` — createTranscriber refuses this id unless the
 * operator sets an explicit off-host consent flag (ADR 0003).
 * Returns placeholder text only; no paid API is called.
 */
export function createCloudStubTranscriber(): Transcriber {
  return {
    id: 'cloud',
    label: 'Optional cloud STT (consent required; no live API)',
    sendsDataOffHost: true,
    async transcribe(_audioPath, opts) {
      const cues: Cue[] = [
        {
          id: 'cloud-1',
          start: 0,
          end: 1.5,
          text: `[cloud-stub lang=${opts.lang}] machine draft — needs human review`,
          needsReview: true,
        },
      ]
      return cues
    },
  }
}
