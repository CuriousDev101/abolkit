import { ProviderError } from '../errors.ts'
import type { Transcriber } from '../types.ts'

/**
 * Optional cloud STT skeleton (ADR 0003 / spike #7).
 * Off by default; `createTranscriber` requires `allowOffHostProviders` before returning this.
 */
export function createAssemblyAiTranscriberSkeleton(): Transcriber {
  return {
    id: 'assemblyai',
    label: 'AssemblyAI (cloud, not implemented)',
    sendsDataOffHost: true,
    async transcribe() {
      throw new ProviderError(
        'NOT_IMPLEMENTED',
        'AssemblyAI adapter is a skeleton only. Use TRANSCRIBER=mms-http or stub for self-hosted defaults.',
      )
    },
  }
}
