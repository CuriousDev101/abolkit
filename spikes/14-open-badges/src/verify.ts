import { readFile } from 'node:fs/promises'
import { loadPublicJwk } from './lib/keys.ts'
import { credentialOutPath } from './lib/paths.ts'
import { verifyCredential, type JsonObject } from './lib/proof.ts'

async function main() {
  const path = process.argv[2] ?? credentialOutPath
  const raw = await readFile(path, 'utf8')
  const credential = JSON.parse(raw) as JsonObject
  const publicJwk = await loadPublicJwk()
  const result = await verifyCredential(credential, publicJwk)
  if (result.ok) {
    console.log('VALID')
    process.exitCode = 0
    return
  }
  console.log('INVALID:', result.reason)
  process.exitCode = 1
}

main().catch((err) => {
  console.error(err)
  process.exitCode = 1
})
