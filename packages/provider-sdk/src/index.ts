// @abolkit/provider-sdk: the boundary that keeps cloud services optional (ADR 0003).
// Owner: pair "ol". Reviewer: pair "ab".
import type { Cue } from '@abolkit/core'

/** BCP 47 tag. We plan for 'en' and 'am' first. */
export type LangCode = 'en' | 'am' | (string & {})

/**
 * Every adapter declares whether using it sends user data off the host.
 * The API must show a consent notice and require explicit opt-in when this is true.
 */
export interface ProviderInfo {
  readonly id: string
  readonly label: string
  readonly sendsDataOffHost: boolean
}

export interface Transcriber extends ProviderInfo {
  /** audioPath: 16 kHz mono file produced by the worker (ffmpeg). */
  transcribe(audioPath: string, opts: { lang: LangCode; signal?: AbortSignal }): Promise<Cue[]>
}

export interface Translator extends ProviderInfo {
  translate(cues: Cue[], opts: { from: LangCode; to: LangCode; signal?: AbortSignal }): Promise<Cue[]>
}

export interface Tts extends ProviderInfo {
  /** Which languages this provider can voice. Do not assume 'am' is present. */
  languages(): LangCode[]
  synthesize(text: string, opts: { lang: LangCode; signal?: AbortSignal }): Promise<{ bytes: Uint8Array; mime: string }>
}

export interface Storage extends ProviderInfo {
  put(key: string, data: Uint8Array | ReadableStream, mime: string): Promise<void>
  get(key: string): Promise<{ bytes: Uint8Array; mime: string } | null>
  delete(key: string): Promise<void>
  /** Time-limited URL. Local-disk storage returns an API route with a signed token. */
  signedUrl(key: string, ttlSeconds: number): Promise<string>
}

/** Chosen at deploy time from environment/config. Defaults must work with no accounts and no network. */
export interface ProviderConfig {
  transcriber: string // e.g. 'faster-whisper' (default) | 'assemblyai'
  translator: string // e.g. 'nllb-local' | 'none' | 'cloud'
  tts: string // e.g. 'recorded-clips' | 'mms-local' | 'cloud'
  storage: string // e.g. 'local-disk' (default) | 'minio' | 'r2'
}
