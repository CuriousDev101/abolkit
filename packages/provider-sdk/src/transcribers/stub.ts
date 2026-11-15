import type { Cue } from '@abolkit/core'
import type { LangCode, Transcriber } from '../types.ts'

function stubCues(lang: LangCode): Cue[] {
  return [
    { id: 'stub-1', start: 0, end: 1, text: `[stub transcript lang=${lang}]`, needsReview: true },
  ]
}

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
      return stubCues(opts.lang)
    },
    async transcribeDetailed(_audioPath, opts) {
      const language = opts.lang && opts.lang !== 'auto' ? opts.lang : 'en'
      return { cues: stubCues(language), language }
    },
  }
}
