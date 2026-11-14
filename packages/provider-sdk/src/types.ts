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
  /** audioPath: 16 kHz mono MP3 produced by the worker (ffmpeg spike #9). */
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
  /** Default after #7: 'mms-http'. Also: 'stub' (no network). */
  transcriber: string
  translator: string
  tts: string
  storage: string
  /** Base URL for mms-http, e.g. http://mms-stt:8000 */
  transcriberUrl?: string
}
