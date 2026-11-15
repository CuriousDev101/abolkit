import type { Cue } from '@abolkit/core'
import type { Translator } from '../types.ts'

/** Default translator: leave cues unchanged (no network, no accounts). */
export function createNoneTranslator(): Translator {
  return {
    id: 'none',
    label: 'No translation',
    sendsDataOffHost: false,
    async translate(cues: Cue[]): Promise<Cue[]> {
      return cues.map((cue) => ({ ...cue }))
    },
  }
}
