import { randomUUID } from 'node:crypto'
import { ISSUER_ID, type IssuerKeys } from './keys.ts'
import { signCredential, type JsonObject } from './proof.ts'

export type IssueInput = {
  recipientName: string
  recipientId?: string
  achievementName: string
  achievementDescription: string
  criteriaNarrative: string
  validFrom?: string
  credentialId?: string
}

export function buildOpenBadgeCredential(input: IssueInput): JsonObject {
  const id = input.credentialId ?? `urn:uuid:${randomUUID()}`
  const achievementId = `urn:uuid:${randomUUID()}`
  const validFrom = input.validFrom ?? new Date().toISOString().replace(/\.\d{3}Z$/, 'Z')

  return {
    '@context': [
      'https://www.w3.org/ns/credentials/v2',
      'https://purl.imsglobal.org/spec/ob/v3p0/context-3.0.3.json',
    ],
    id,
    type: ['VerifiableCredential', 'OpenBadgeCredential'],
    name: input.achievementName,
    issuer: {
      id: ISSUER_ID,
      type: ['Profile'],
      name: 'Abol Kit',
    },
    validFrom,
    credentialSubject: {
      id: input.recipientId ?? `urn:uuid:${randomUUID()}`,
      type: ['AchievementSubject'],
      identifier: {
        type: 'IdentityObject',
        identityHash: input.recipientName,
        identityType: 'name',
        hashed: false,
      },
      achievement: {
        id: achievementId,
        type: ['Achievement'],
        name: input.achievementName,
        description: input.achievementDescription,
        criteria: {
          narrative: input.criteriaNarrative,
        },
      },
    },
  }
}

export function issueSignedCredential(
  input: IssueInput,
  keys: IssuerKeys,
  verificationMethod: string,
): JsonObject {
  const unsigned = buildOpenBadgeCredential(input)
  return signCredential(unsigned, keys.privateJwk, verificationMethod)
}
