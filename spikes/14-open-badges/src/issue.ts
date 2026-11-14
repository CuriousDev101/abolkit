import { mkdir, writeFile } from 'node:fs/promises'
import { issueSignedCredential } from './lib/credential.ts'
import { loadIssuerKeys, VERIFICATION_METHOD } from './lib/keys.ts'
import { credentialOutPath, outDir } from './lib/paths.ts'

async function main() {
  const keys = await loadIssuerKeys()
  const credential = issueSignedCredential(
    {
      recipientName: 'Ada Graduate',
      achievementName: 'Accessible Media Fundamentals',
      achievementDescription:
        'Completed the Abol Kit accessible learning-media pathway covering captions, audio description, and keyboard-operable playback.',
      criteriaNarrative:
        'Learner finished the demo lesson with reviewed captions and demonstrated use of the verifyable certificate share link.',
      validFrom: '2026-11-14T12:00:00Z',
    },
    keys,
    VERIFICATION_METHOD,
  )

  await mkdir(outDir, { recursive: true })
  await writeFile(credentialOutPath, `${JSON.stringify(credential, null, 2)}\n`, 'utf8')
  console.log('Issued credential →', credentialOutPath)
  console.log('id:', credential.id)
}

main().catch((err) => {
  console.error(err)
  process.exitCode = 1
})
