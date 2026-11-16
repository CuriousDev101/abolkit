// @abolkit/provider-sdk: the boundary that keeps cloud services optional (ADR 0003).
// Owner: pair "ol". Reviewer: pair "ab".
// Default STT: mms-http → external MMS ASR wrapper (spike #7). No model weights in this package.
// Issue #16: adapter interfaces, named config selection, default skeletons, off-host consent.

export type {
  LangCode,
  ProviderConfig,
  ProviderInfo,
  Storage,
  Transcriber,
  TranscriptionResult,
  Translator,
  Tts,
} from './types.ts'

export { ProviderError } from './errors.ts'
export { assertOffHostAllowed } from './consent.ts'
export { providerConfigFromEnv } from './provider-config.ts'

export {
  createTranscriber,
  transcribeWithDetails,
  transcriberConfigFromEnv,
  type TranscriberSelection,
} from './create-transcriber.ts'
export {
  createTranslator,
  translatorConfigFromEnv,
  type TranslatorSelection,
} from './create-translator.ts'
export { createTts, ttsConfigFromEnv, type CreateTtsOptions } from './create-tts.ts'

export {
  assemblyAiConfigFromEnv,
  createAssemblyAiTranscriber,
  type AssemblyAiOptions,
  type AssemblyAiParams,
} from './transcribers/assemblyai.ts'
export {
  checkMmsHttpHealth,
  createMmsHttpTranscriber,
  type MmsHttpTranscriberOptions,
  type MmsTranscribeResponse,
} from './transcribers/mms-http.ts'
export { createStubTranscriber } from './transcribers/stub.ts'
export { createCloudStubTranscriber } from './transcribers/cloud-stub.ts'

export {
  createGeminiTranslator,
  DEFAULT_GEMINI_BATCH_SIZE,
  DEFAULT_GEMINI_MODEL,
  geminiConfigFromEnv,
  type GeminiTranslatorOptions,
} from './translators/gemini.ts'
export { languagePromptName, withTranslatedText } from './translators/cue-text.ts'
export { createNoneTranslator } from './translators/none.ts'
export { createStubTranslator } from './translators/stub.ts'
export { createCloudTranslatorSkeleton } from './translators/cloud.ts'

export { createRecordedClipsTts, type RecordedClipsTtsOptions } from './tts/recorded-clips.ts'
export { createStubTts } from './tts/stub.ts'
export { createCloudTtsSkeleton } from './tts/cloud.ts'
export {
  assemblyAiTtsConfigFromEnv,
  createAssemblyAiTts,
  type AssemblyAiTtsOptions,
} from './tts/assemblyai.ts'

export {
  createStorage,
  storageConfigFromEnv,
  type CreateStorageOptions,
  type StorageEnv,
} from './storage/create-storage.ts'
export {
  createLocalDiskStorage,
  signLocalDiskToken,
  verifyLocalDiskSignedUrl,
  type LocalDiskStorageOptions,
} from './storage/local-disk.ts'
export { createMinioStorage, type MinioStorageOptions } from './storage/minio.ts'
