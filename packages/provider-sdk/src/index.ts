// @abolkit/provider-sdk: the boundary that keeps cloud services optional (ADR 0003).
// Owner: pair "ol". Reviewer: pair "ab".
// Default STT: mms-http → external MMS ASR wrapper (spike #7). No model weights in this package.

export type {
  LangCode,
  ProviderConfig,
  ProviderInfo,
  Storage,
  Transcriber,
  Translator,
  Tts,
} from './types.js'

export { ProviderError } from './errors.js'
export { createTranscriber, transcriberConfigFromEnv } from './create-transcriber.js'
export {
  checkMmsHttpHealth,
  createMmsHttpTranscriber,
  type MmsHttpTranscriberOptions,
  type MmsTranscribeResponse,
} from './transcribers/mms-http.js'
export { createStubTranscriber } from './transcribers/stub.js'
