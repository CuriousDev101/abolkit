import type { Translator } from '../types.ts'
import { withTranslatedText } from './cue-text.ts'

/** Offline stand-in: tags each line with the target language. For local runs without GEMINI_API_KEY. */
export function createStubTranslator(): Translator {
  return {
    id: 'stub',
    label: 'Stub translator (no model)',
    sendsDataOffHost: false,
    async translate(cues, opts) {
      return withTranslatedText(
        cues,
        cues.map((cue) => `[${opts.to}] ${cue.text}`),
      )
    },
  }
}
