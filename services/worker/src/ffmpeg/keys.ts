/** Storage object keys for ffmpeg outputs (ADR 0005 + spike #9 MP3 extract). */

export function sourceKey(assetId: string): string {
  return `assets/${assetId}/source`
}

/** 16 kHz mono MP3 for the external STT service (#27). */
export function audio16kKey(assetId: string): string {
  return `assets/${assetId}/audio/16k-mono.mp3`
}

/** ~24 kbps Opus for the offline pack. */
export function opusAudioKey(assetId: string): string {
  return `assets/${assetId}/renditions/audio.opus`
}

/** 240p H.264 for optional low-bandwidth video. */
export function video240pKey(assetId: string): string {
  return `assets/${assetId}/renditions/video-240p.mp4`
}
