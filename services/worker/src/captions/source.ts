import { spawn } from 'node:child_process'
import { join } from 'node:path'

import type { VideoSourceKind } from '@abolkit/caption-store'

import { runFfmpeg } from '../ffmpeg/run.ts'

export interface SourceTools {
  ffmpegBin?: string
  ffprobeBin?: string
  ytDlpBin?: string
  /** Passed to `yt-dlp --js-runtimes`; YouTube needs a JavaScript runtime to resolve formats. */
  ytDlpJsRuntimes?: string
  /** Netscape cookies file for YouTube when the server IP gets bot checks. */
  ytDlpCookiesFile?: string
}

export interface SourceInfo {
  title: string | null
  durationSeconds: number | null
}

/** Remote file inputs: no `file:`, `concat:` or other local protocols. */
const PROTOCOL_WHITELIST = 'https,http,tls,tcp,crypto'

/** Title and duration, read before any audio is downloaded so long videos can be refused early. */
export async function probeSource(
  source: { url: string; kind: VideoSourceKind },
  tools: SourceTools,
  signal?: AbortSignal,
): Promise<SourceInfo> {
  if (source.kind === 'youtube') {
    const stdout = await runProcess(
      tools.ytDlpBin || 'yt-dlp',
      [...ytDlpCommonArgs(tools), '-J', source.url],
      signal,
    )
    const info = JSON.parse(stdout) as { title?: string; duration?: number }
    return { title: info.title ?? null, durationSeconds: finiteOrNull(info.duration) }
  }
  const stdout = await runProcess(
    tools.ffprobeBin || 'ffprobe',
    [
      '-v',
      'error',
      '-protocol_whitelist',
      PROTOCOL_WHITELIST,
      '-show_entries',
      'format=duration:format_tags=title',
      '-of',
      'json',
      source.url,
    ],
    signal,
  )
  const info = JSON.parse(stdout) as { format?: { duration?: string; tags?: { title?: string } } }
  return {
    title: info.format?.tags?.title ?? null,
    durationSeconds: finiteOrNull(Number(info.format?.duration)),
  }
}

/**
 * Write 16 kHz mono MP3 (the same recipe as `extract16kMono`) for the transcriber.
 * YouTube audio is downloaded by yt-dlp first; file URLs are read by ffmpeg directly.
 */
export async function extractAudio(
  source: { url: string; kind: VideoSourceKind },
  workDir: string,
  options: SourceTools & { maxDurationSeconds: number; signal?: AbortSignal },
): Promise<string> {
  let input = source.url
  const inputArgs: string[] = []
  if (source.kind === 'youtube') {
    const stdout = await runProcess(
      options.ytDlpBin || 'yt-dlp',
      [
        ...ytDlpCommonArgs(options),
        '-f',
        'bestaudio/best',
        '--no-part',
        '-o',
        join(workDir, 'source.%(ext)s'),
        '--print',
        'after_move:filepath',
        '--no-simulate',
        source.url,
      ],
      options.signal,
    )
    const downloaded = stdout.trim().split('\n').at(-1)?.trim()
    if (!downloaded) throw new Error('yt-dlp did not report the downloaded file')
    input = downloaded
  } else {
    inputArgs.push('-protocol_whitelist', PROTOCOL_WHITELIST)
  }

  const output = join(workDir, 'audio-16k-mono.mp3')
  await runFfmpeg(
    [
      '-hide_banner',
      '-y',
      ...inputArgs,
      '-i',
      input,
      '-t',
      String(options.maxDurationSeconds),
      '-vn',
      '-ac',
      '1',
      '-ar',
      '16000',
      '-c:a',
      'libmp3lame',
      '-b:a',
      '32k',
      output,
    ],
    { bin: options.ffmpegBin, signal: options.signal },
  )
  return output
}

function ytDlpCommonArgs(tools: SourceTools): string[] {
  const args = ['--no-playlist', '--no-warnings', '--no-progress']
  if (tools.ytDlpJsRuntimes) args.push('--js-runtimes', tools.ytDlpJsRuntimes)
  if (tools.ytDlpCookiesFile) args.push('--cookies', tools.ytDlpCookiesFile)
  return args
}

function finiteOrNull(value: number | undefined): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

/** Run a tool and return its stdout; stderr becomes the error message. */
export function runProcess(bin: string, args: string[], signal?: AbortSignal): Promise<string> {
  if (signal?.aborted) return Promise.reject(new Error(`${bin} aborted before start`))
  return new Promise((resolve, reject) => {
    const child = spawn(bin, args, { stdio: ['ignore', 'pipe', 'pipe'] })
    const stdout: Buffer[] = []
    let stderr = ''
    child.stdout.on('data', (chunk: Buffer) => stdout.push(chunk))
    child.stderr.setEncoding('utf8')
    child.stderr.on('data', (chunk: string) => {
      stderr = (stderr + chunk).slice(-8_000)
    })
    const onAbort = () => child.kill('SIGTERM')
    signal?.addEventListener('abort', onAbort, { once: true })
    child.on('error', (err) => {
      signal?.removeEventListener('abort', onAbort)
      reject(new Error(`Failed to start ${bin}: ${err.message}`))
    })
    child.on('close', (code) => {
      signal?.removeEventListener('abort', onAbort)
      if (signal?.aborted) return reject(new Error(`${bin} aborted`))
      if (code === 0) return resolve(Buffer.concat(stdout).toString('utf8'))
      reject(new Error(`${bin} failed: ${stderr.trim() || `exit ${code}`}`))
    })
  })
}
