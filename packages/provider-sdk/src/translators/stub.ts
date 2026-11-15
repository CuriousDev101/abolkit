import type { Cue } from '@abolkit/core'
import type { Translator } from '../types.ts'

/**
 * Offline stand-in that marks every cue as needing review.
 * Useful for pipeline wiring without a real EN↔AM model.
 */
export function createStubTranslator(): Translator {
  return {
    id: 'stub',
    label: 'Stub translator (no model)',
    sendsDataOffHost: false,
    async translate(cues: Cue[], opts): Promise<Cue[]> {
      return cues.map((cue, i) => ({
        ...cue,
        id: cue.id ?? `stub-tr-${i + 1}`,
        text: `[stub ${opts.from}→${opts.to}] ${cue.text}`,
        needsReview: true,
      }))
    },
  }
}
