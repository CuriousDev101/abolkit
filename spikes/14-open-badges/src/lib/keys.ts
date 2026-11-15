import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { exportJWK, generateKeyPair } from 'jose'
import type { JWK } from 'jose'
import { keysDir, privateKeyPath, publicKeyPath } from './paths.ts'

export const ISSUER_ID = 'https://abolkit.local/issuers/abolkit'
export const VERIFICATION_METHOD = `${ISSUER_ID}#key-1`

export type IssuerKeys = {
  privateJwk: JWK
  publicJwk: JWK
}

function publicOnly(jwk: JWK): JWK {
  const pub: JWK = { ...jwk }
  delete pub.d
  pub.kid = 'key-1'
  pub.use = 'sig'
  pub.alg = 'EdDSA'
  return pub
}

export async function generateIssuerKeys(): Promise<IssuerKeys> {
  const { privateKey } = await generateKeyPair('EdDSA', {
    crv: 'Ed25519',
    extractable: true,
  })
  const privateJwk = await exportJWK(privateKey)
  privateJwk.kid = 'key-1'
  privateJwk.alg = 'EdDSA'
  privateJwk.use = 'sig'
  return {
    privateJwk,
    publicJwk: publicOnly(privateJwk),
  }
}

export async function writeIssuerKeys(keys: IssuerKeys): Promise<void> {
  await mkdir(keysDir, { recursive: true })
  await writeFile(privateKeyPath, `${JSON.stringify(keys.privateJwk, null, 2)}\n`, 'utf8')
  await writeFile(publicKeyPath, `${JSON.stringify(keys.publicJwk, null, 2)}\n`, 'utf8')
}

async function loadPrivateJwk(): Promise<JWK> {
  const fromEnv = process.env.CREDENTIALS_ISSUER_PRIVATE_JWK?.trim()
  if (fromEnv) {
    return JSON.parse(fromEnv) as JWK
  }
  const pathOverride = process.env.CREDENTIALS_ISSUER_PRIVATE_JWK_PATH?.trim()
  const filePath = pathOverride || privateKeyPath
  const raw = await readFile(filePath, 'utf8')
  return JSON.parse(raw) as JWK
}

export async function loadIssuerKeys(): Promise<IssuerKeys> {
  const privateJwk = await loadPrivateJwk()
  if (privateJwk.kty !== 'OKP' || privateJwk.crv !== 'Ed25519' || !privateJwk.d) {
    throw new Error('Private key must be an Ed25519 OKP JWK with a private `d` component')
  }
  return { privateJwk, publicJwk: publicOnly(privateJwk) }
}

export async function loadPublicJwk(filePath = publicKeyPath): Promise<JWK> {
  const raw = await readFile(filePath, 'utf8')
  return JSON.parse(raw) as JWK
}
