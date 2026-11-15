import { mkdir, writeFile } from 'node:fs/promises'
import { issueSignedCredential } from './lib/credential.ts'
import {
  loadIssuerKeys,
  VERIFICATION_METHOD,
  generateIssuerKeys,
  writeIssuerKeys,
} from './lib/keys.ts'
import { credentialOutPath, outDir, privateKeyPath } from './lib/paths.ts'
import { verifyCredential, type JsonObject } from './lib/proof.ts'
import { access } from 'node:fs/promises'

async function ensureKeys() {
  try {
    await access(privateKeyPath)
  } catch {
    const keys = await generateIssuerKeys()
    await writeIssuerKeys(keys)
    console.log('generated issuer keypair')
  }
}

async function main() {
  await ensureKeys()
  const keys = await loadIssuerKeys()

  const credential = issueSignedCredential(
    {
      recipientName: 'Ada Graduate',
      achievementName: 'Accessible Media Fundamentals',
      achievementDescription:
        'Completed the Abol Kit accessible learning-media pathway covering captions, audio description, and keyboard-operable playback.',
      criteriaNarrative:
        'Learner finished the demo lesson with reviewed captions and demonstrated use of the certificate share link.',
      validFrom: '2026-11-14T12:00:00Z',
      credentialId: 'urn:uuid:11111111-2222-4333-8444-555555555555',
    },
    keys,
    VERIFICATION_METHOD,
  )

  await mkdir(outDir, { recursive: true })
  await writeFile(credentialOutPath, `${JSON.stringify(credential, null, 2)}\n`, 'utf8')

  const ok = await verifyCredential(credential, keys.publicJwk)
  if (!ok.ok) {
    throw new Error(`fresh credential failed verify: ${ok.reason}`)
  }
  console.log('pass: signed credential verifies')

  const tampered = structuredClone(credential) as JsonObject
  const subject = tampered.credentialSubject as JsonObject
  const achievement = subject.achievement as JsonObject
  achievement.name = 'Tampered Achievement'
  const bad = await verifyCredential(tampered, keys.publicJwk)
  if (bad.ok) {
    throw new Error('tampered credential unexpectedly verified')
  }
  console.log('pass: tamper detected →', bad.reason)
  console.log('wrote', credentialOutPath)
}

main().catch((err) => {
  console.error(err)
  process.exitCode = 1
})
