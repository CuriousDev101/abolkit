import { generateIssuerKeys, writeIssuerKeys } from './lib/keys.ts'
import { privateKeyPath, publicKeyPath } from './lib/paths.ts'

async function main() {
  const keys = await generateIssuerKeys()
  await writeIssuerKeys(keys)
  console.log('Wrote private key (gitignored):', privateKeyPath)
  console.log('Wrote public key (safe to commit):', publicKeyPath)
  console.log('Optional env (instead of the private file):')
  console.log(`CREDENTIALS_ISSUER_PRIVATE_JWK='${JSON.stringify(keys.privateJwk)}'`)
}

main().catch((err) => {
  console.error(err)
  process.exitCode = 1
})
