import type { RunFfmpeg } from './run.ts'
import { runFfmpeg } from './run.ts'

export type RecipeOptions = {
  signal?: AbortSignal
  bin?: string
  run?: RunFfmpeg
}

async function run(args: string[], options: RecipeOptions): Promise<void> {
  const exec = options.run ?? runFfmpeg
  await exec(args, { signal: options.signal, bin: options.bin })
}

/**
 * Extract 16 kHz mono MP3 for STT (external MMS). Mirrors
 * `spikes/09-ffmpeg/recipes/extract-16k-mono.sh`.
 */
export async function extract16kMono(
  inputPath: string,
  outputPath: string,
  options: RecipeOptions = {},
): Promise<void> {
  await run(
    [
      '-hide_banner',
      '-y',
      '-i',
      inputPath,
      '-vn',
      '-ac',
      '1',
      '-ar',
      '16000',
      '-c:a',
      'libmp3lame',
      '-b:a',
      '32k',
      outputPath,
    ],
    options,
  )
}

/**
 * Low-bitrate Opus for offline pack / audio-only playback.
 * Mirrors `spikes/09-ffmpeg/recipes/opus-24k.sh`.
 */
export async function encodeOpus24k(
  inputPath: string,
  outputPath: string,
  options: RecipeOptions = {},
): Promise<void> {
  await run(
    [
      '-hide_banner',
      '-y',
      '-i',
      inputPath,
      '-vn',
      '-ac',
      '1',
      '-ar',
      '48000',
      '-c:a',
      'libopus',
      '-b:a',
      '24k',
      '-vbr',
      'on',
      '-compression_level',
      '10',
      '-application',
      'voip',
      outputPath,
    ],
    options,
  )
}

/**
 * 240p H.264 rendition (optional offline / low-bandwidth video).
 * Mirrors `spikes/09-ffmpeg/recipes/video-240p.sh`.
 */
export async function encodeVideo240p(
  inputPath: string,
  outputPath: string,
  options: RecipeOptions = {},
): Promise<void> {
  await run(
    [
      '-hide_banner',
      '-y',
      '-i',
      inputPath,
      '-vf',
      'scale=-2:240',
      '-c:v',
      'libx264',
      '-preset',
      'medium',
      '-crf',
      '28',
      '-profile:v',
      'baseline',
      '-level',
      '3.0',
      '-pix_fmt',
      'yuv420p',
      '-movflags',
      '+faststart',
      '-c:a',
      'aac',
      '-b:a',
      '64k',
      '-ac',
      '1',
      '-ar',
      '44100',
      outputPath,
    ],
    options,
  )
}
