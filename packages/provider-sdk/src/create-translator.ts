import { ProviderError } from './errors.ts'
import {
  createGeminiTranslator,
  geminiConfigFromEnv,
  type GeminiTranslatorOptions,
} from './translators/gemini.ts'
import { createStubTranslator } from './translators/stub.ts'
import type { ProviderConfig, Translator } from './types.ts'

export type TranslatorSelection = Pick<
  ProviderConfig,
  'translator' | 'translatorOffHostConsent'
> & {
  /** Read from GEMINI_* variables; only used when translator is `gemini`. */
  gemini?: Omit<GeminiTranslatorOptions, 'fetch'>
}

/** Build the configured Translator, or null for `none` (translation jobs then fail with a clear error). */
export function createTranslator(config: TranslatorSelection): Translator | null {
  const id = config.translator || 'none'
  switch (id) {
    case 'none':
      return null
    case 'stub':
      return createStubTranslator()
    case 'gemini':
      if (!config.translatorOffHostConsent) {
        throw new ProviderError(
          'CONSENT_REQUIRED',
          'TRANSLATOR=gemini sends caption text off the host. Set TRANSLATOR_OFF_HOST_CONSENT=true only after the operator consents (ADR 0003).',
        )
      }
      return createGeminiTranslator(config.gemini ?? { apiKey: '' })
    default:
      throw new ProviderError(
        'BAD_CONFIG',
        `Unknown translator "${id}". Use none, stub or gemini (consent required).`,
      )
  }
}

export function translatorConfigFromEnv(
  env: Record<string, string | undefined> = process.env,
): TranslatorSelection {
  const consentRaw = env.TRANSLATOR_OFF_HOST_CONSENT?.trim().toLowerCase()
  const translator = env.TRANSLATOR?.trim() || 'none'
  // Default true for URL captions (team:ab): Gemini needs consent to run.
  const consentUnset = consentRaw == null || consentRaw === ''
  return {
    translator,
    translatorOffHostConsent:
      consentUnset || consentRaw === 'true' || consentRaw === '1' || consentRaw === 'yes',
    ...(translator === 'gemini' ? { gemini: geminiConfigFromEnv(env) } : {}),
  }
}
