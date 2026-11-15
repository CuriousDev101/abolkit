// @abolkit/provider-sdk: the boundary that keeps cloud services optional (ADR 0003).
// Owner: pair "ol". Reviewer: pair "ab".
// Default STT: mms-http → external MMS ASR wrapper (spike #7). No model weights in this package.

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
export {
  assemblyAiConfigFromEnv,
  createAssemblyAiTranscriber,
  type AssemblyAiOptions,
  type AssemblyAiParams,
} from './transcribers/assemblyai.ts'
export {
  createGeminiTranslator,
  DEFAULT_GEMINI_MODEL,
  geminiConfigFromEnv,
  type GeminiTranslatorOptions,
} from './translators/gemini.ts'
export { createStubTranslator } from './translators/stub.ts'
export { languagePromptName, withTranslatedText } from './translators/cue-text.ts'
export {
  checkMmsHttpHealth,
  createMmsHttpTranscriber,
  type MmsHttpTranscriberOptions,
  type MmsTranscribeResponse,
} from './transcribers/mms-http.ts'
export { createStubTranscriber } from './transcribers/stub.ts'
export { createCloudStubTranscriber } from './transcribers/cloud-stub.ts'
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
