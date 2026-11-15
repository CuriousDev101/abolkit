import { spawn } from 'node:child_process'

export type RunFfmpegOptions = {
  /** Defaults to `FFMPEG_BIN` or `ffmpeg`. */
  bin?: string
  signal?: AbortSignal
  /** Extra env for the child process. */
  env?: NodeJS.ProcessEnv
}

/**
 * Run ffmpeg with the given args. Rejects on non-zero exit or abort.
 * Spike #9 recipes are the source of truth for flags.
 */
export async function runFfmpeg(args: string[], options: RunFfmpegOptions = {}): Promise<void> {
  const bin = options.bin?.trim() || process.env.FFMPEG_BIN?.trim() || 'ffmpeg'
  const signal = options.signal

  if (signal?.aborted) {
    throw new Error('ffmpeg aborted before start')
  }

  await new Promise<void>((resolve, reject) => {
    const child = spawn(bin, args, {
      stdio: ['ignore', 'pipe', 'pipe'],
      env: options.env ?? process.env,
    })

    let stderr = ''
    child.stderr?.setEncoding('utf8')
    child.stderr?.on('data', (chunk: string) => {
      stderr += chunk
      if (stderr.length > 8_000) stderr = stderr.slice(-8_000)
    })

    const onAbort = () => {
      child.kill('SIGTERM')
    }
    signal?.addEventListener('abort', onAbort, { once: true })

    child.on('error', (err) => {
      signal?.removeEventListener('abort', onAbort)
      reject(
        new Error(
          `Failed to start ffmpeg (${bin}): ${err.message}. Install ffmpeg or set FFMPEG_BIN.`,
        ),
      )
    })

    child.on('close', (code, killSignal) => {
      signal?.removeEventListener('abort', onAbort)
      if (signal?.aborted) {
        reject(new Error('ffmpeg aborted'))
        return
      }
      if (code === 0) {
        resolve()
        return
      }
      const detail = stderr.trim() || `exit ${code ?? killSignal ?? 'unknown'}`
      reject(new Error(`ffmpeg failed: ${detail}`))
    })
  })
}

export type RunFfmpeg = typeof runFfmpeg
