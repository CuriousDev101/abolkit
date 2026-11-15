import type { Cue } from '@abolkit/core'

import { ProviderError } from '../errors.ts'

/**
 * Put translated text on the source cues. Ids and times always come from the source,
 * so a translator can never shift, merge or drop a cue.
 */
export function withTranslatedText(source: readonly Cue[], texts: readonly string[]): Cue[] {
  if (texts.length !== source.length) {
    throw new ProviderError(
      'BAD_RESPONSE',
      `Translator returned ${texts.length} lines for ${source.length} cues`,
    )
  }
  return source.map((cue, i) => ({
    ...(cue.id === undefined ? {} : { id: cue.id }),
    start: cue.start,
    end: cue.end,
    text: texts[i]!.trim() || cue.text,
    needsReview: true,
  }))
}

/** English names and scripts used in translation prompts. */
const LANGUAGE_PROMPT_NAMES: Record<string, string> = {
  en: 'English',
  am: 'Amharic (Ethiopic script)',
  om: 'Afaan Oromo (Latin script, Qubee)',
  ti: 'Tigrinya (Ethiopic script)',
  aa: 'Afar (Latin script, Qafar af)',
}

export function languagePromptName(lang: string): string {
  const known = LANGUAGE_PROMPT_NAMES[lang] ?? LANGUAGE_PROMPT_NAMES[lang.split('-')[0]!]
  if (known) return known
  try {
    return new Intl.DisplayNames(['en'], { type: 'language' }).of(lang) ?? lang
  } catch {
    return lang
  }
}
