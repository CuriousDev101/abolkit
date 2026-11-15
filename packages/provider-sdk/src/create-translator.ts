import { assertOffHostAllowed } from './consent.ts'
import { ProviderError } from './errors.ts'
import { createCloudTranslatorSkeleton } from './translators/cloud.ts'
import { createNoneTranslator } from './translators/none.ts'
import { createStubTranslator } from './translators/stub.ts'
import type { ProviderConfig, Translator } from './types.ts'

/** Build the configured Translator. Default id is `none` (no network). */
export function createTranslator(
  config: Pick<ProviderConfig, 'translator' | 'allowOffHostProviders'>,
): Translator {
  const id = config.translator || 'none'

  switch (id) {
    case 'none':
      return createNoneTranslator()
    case 'stub':
      return createStubTranslator()
    case 'cloud': {
      const translator = createCloudTranslatorSkeleton()
      assertOffHostAllowed(translator, config.allowOffHostProviders)
      return translator
    }
    default:
      throw new ProviderError(
        'BAD_CONFIG',
        `Unknown translator "${id}". Use none, stub, or cloud (requires ALLOW_OFF_HOST_PROVIDERS).`,
      )
  }
}
