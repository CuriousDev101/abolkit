import { ProviderError } from '../errors.ts'
import type { LangCode, Tts } from '../types.ts'

export type RecordedClipsTtsOptions = {
  /**
   * Directory of pre-recorded AD / summary clips keyed by a stable id.
   * Full lookup lands with worker TTS jobs; this skeleton only exposes the contract.
   */
  clipsRoot?: string
}

/**
 * Default TTS: play host-local recorded clips (no cloud voice, ADR 0003 / spike #8).
 * Synthesis is a skeleton until clip packing (#28) wires real files.
 */
export function createRecordedClipsTts(options: RecordedClipsTtsOptions = {}): Tts {
  const clipsRoot = options.clipsRoot?.trim()

  return {
    id: 'recorded-clips',
    label: 'Recorded clips (local)',
    sendsDataOffHost: false,
    languages(): LangCode[] {
      // Recorded packs declare what they contain; do not assume Amharic.
      return ['en', 'am']
    },
    async synthesize(text, opts) {
      throw new ProviderError(
        'NOT_IMPLEMENTED',
        `recorded-clips TTS skeleton: no clip resolved for lang=${opts.lang}` +
          (clipsRoot ? ` under ${clipsRoot}` : '') +
          ` (text length ${text.length}). Wire clip lookup in the worker TTS job.`,
      )
    },
  }
}
