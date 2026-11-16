import { chmod, mkdtemp, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

import { tryImportYoutubeVtt } from './source.ts'

async function writeYtDlpStub(dir: string, body: string): Promise<string> {
  const script = join(dir, 'yt-dlp-stub.sh')
  await writeFile(script, `#!/bin/sh\n${body}\n`, 'utf8')
  await chmod(script, 0o755)
  return script
}

describe('tryImportYoutubeVtt', () => {
  it('returns cues when yt-dlp writes a usable English VTT', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'abol-ytdlp-vtt-'))
    const bin = await writeYtDlpStub(
      dir,
      [
        `cat > "${dir}/subs.en.vtt" <<'EOF'`,
        'WEBVTT',
        '',
        '00:00:00.000 --> 00:00:01.500',
        'Hello from YouTube',
        'EOF',
      ].join('\n'),
    )

    const result = await tryImportYoutubeVtt(
      { url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', kind: 'youtube' },
      dir,
      'en',
      { ytDlpBin: bin },
    )

    expect(result).not.toBeNull()
    expect(result!.language).toBe('en')
    expect(result!.cues).toHaveLength(1)
    expect(result!.cues[0]?.text).toContain('Hello from YouTube')
  })

  it('returns null when yt-dlp writes no VTT (AssemblyAI path should run)', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'abol-ytdlp-empty-'))
    const bin = await writeYtDlpStub(dir, 'exit 0')

    const result = await tryImportYoutubeVtt(
      { url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', kind: 'youtube' },
      dir,
      'en',
      { ytDlpBin: bin },
    )

    expect(result).toBeNull()
  })

  it('skips non-YouTube sources', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'abol-ytdlp-skip-'))
    const result = await tryImportYoutubeVtt(
      { url: 'https://cdn.example.org/lesson.mp4', kind: 'file' },
      dir,
      'en',
      {},
    )
    expect(result).toBeNull()
  })
})
