import { createHash, createPrivateKey, createPublicKey, sign, verify } from 'node:crypto'
import canonicalize from 'canonicalize'
import bs58 from 'bs58'
import type { JWK } from 'jose'

/**
 * Spike proof: Data Integrity shape with cryptosuite `eddsa-jcs-2022`
 * (JCS / RFC 8785 instead of RDFC). OB 3.0 conformance tests prefer
 * `eddsa-rdfc-2022`; we document that gap in RESULT.md and keep jose + JCS
 * for a hackathon-sized spike with no RDF stack.
 */

export const PROOF_TYPE = 'DataIntegrityProof'
export const CRYPTOSUITE = 'eddsa-jcs-2022'

export type JsonObject = Record<string, unknown>

export type DataIntegrityProof = {
  type: typeof PROOF_TYPE
  cryptosuite: typeof CRYPTOSUITE
  created: string
  verificationMethod: string
  proofPurpose: 'assertionMethod'
  proofValue: string
}

function sha256(data: string): Buffer {
  return createHash('sha256').update(data, 'utf8').digest()
}

function jcs(value: unknown): string {
  const out = canonicalize(value)
  if (out === undefined) {
    throw new Error('canonicalize returned undefined')
  }
  return out
}

function withoutProof(document: JsonObject): JsonObject {
  const rest: JsonObject = { ...document }
  delete rest.proof
  return rest
}

function buildProofConfig(
  document: JsonObject,
  options: Omit<DataIntegrityProof, 'proofValue'>,
): JsonObject {
  return {
    '@context': document['@context'],
    type: options.type,
    cryptosuite: options.cryptosuite,
    created: options.created,
    verificationMethod: options.verificationMethod,
    proofPurpose: options.proofPurpose,
  }
}

function hashData(document: JsonObject, proofConfig: JsonObject): Buffer {
  const proofConfigHash = sha256(jcs(proofConfig))
  const documentHash = sha256(jcs(withoutProof(document)))
  return Buffer.concat([proofConfigHash, documentHash])
}

function encodeProofValue(signature: Buffer): string {
  return `z${bs58.encode(signature)}`
}

function decodeProofValue(proofValue: string): Buffer {
  if (!proofValue.startsWith('z')) {
    throw new Error('proofValue must be multibase base58btc (prefix z)')
  }
  return Buffer.from(bs58.decode(proofValue.slice(1)))
}

function ed25519Sign(privateJwk: JWK, data: Buffer): Buffer {
  const keyObject = createPrivateKey({ key: privateJwk, format: 'jwk' })
  return sign(null, data, keyObject)
}

function ed25519Verify(publicJwk: JWK, data: Buffer, signature: Buffer): boolean {
  const keyObject = createPublicKey({ key: publicJwk, format: 'jwk' })
  return verify(null, data, keyObject, signature)
}

export function signCredential(
  document: JsonObject,
  privateJwk: JWK,
  verificationMethod: string,
  created = new Date().toISOString().replace(/\.\d{3}Z$/, 'Z'),
): JsonObject {
  if (document.proof) {
    throw new Error('document already has a proof')
  }
  if (privateJwk.kty !== 'OKP' || privateJwk.crv !== 'Ed25519' || !privateJwk.d) {
    throw new Error('privateJwk must be an Ed25519 OKP key with `d`')
  }
  const options: Omit<DataIntegrityProof, 'proofValue'> = {
    type: PROOF_TYPE,
    cryptosuite: CRYPTOSUITE,
    created,
    verificationMethod,
    proofPurpose: 'assertionMethod',
  }
  const proofConfig = buildProofConfig(document, options)
  const data = hashData(document, proofConfig)
  const signature = ed25519Sign(privateJwk, data)
  const proof: DataIntegrityProof = {
    ...options,
    proofValue: encodeProofValue(signature),
  }
  return { ...document, proof }
}

export async function verifyCredential(
  document: JsonObject,
  publicJwk: JWK,
): Promise<{ ok: true } | { ok: false; reason: string }> {
  const proof = document.proof
  if (!proof || typeof proof !== 'object' || Array.isArray(proof)) {
    return { ok: false, reason: 'missing embedded proof object' }
  }
  const p = proof as Partial<DataIntegrityProof>
  if (p.type !== PROOF_TYPE) {
    return { ok: false, reason: `unsupported proof type: ${String(p.type)}` }
  }
  if (p.cryptosuite !== CRYPTOSUITE) {
    return { ok: false, reason: `unsupported cryptosuite: ${String(p.cryptosuite)}` }
  }
  if (p.proofPurpose !== 'assertionMethod') {
    return { ok: false, reason: 'proofPurpose must be assertionMethod' }
  }
  if (typeof p.created !== 'string' || typeof p.verificationMethod !== 'string') {
    return { ok: false, reason: 'proof missing created or verificationMethod' }
  }
  if (typeof p.proofValue !== 'string') {
    return { ok: false, reason: 'proof missing proofValue' }
  }

  const options: Omit<DataIntegrityProof, 'proofValue'> = {
    type: PROOF_TYPE,
    cryptosuite: CRYPTOSUITE,
    created: p.created,
    verificationMethod: p.verificationMethod,
    proofPurpose: 'assertionMethod',
  }
  const proofConfig = buildProofConfig(document, options)
  const data = hashData(document, proofConfig)

  let signature: Buffer
  try {
    signature = decodeProofValue(p.proofValue)
  } catch (err) {
    return { ok: false, reason: err instanceof Error ? err.message : 'bad proofValue' }
  }

  const valid = ed25519Verify(publicJwk, data, signature)
  if (!valid) {
    return { ok: false, reason: 'signature mismatch (tampered or wrong key)' }
  }
  return { ok: true }
}
