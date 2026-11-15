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

/** Machine captions from the Transcriber adapter (#27). Always needsReview until a human edits. */
export function captionsKey(assetId: string, lang: string): string {
  const safe = lang.trim().toLowerCase() || 'en'
  return `assets/${assetId}/captions/${safe}.vtt`
}

/** Audio / visual description WebVTT (#23 / #54 image descriptions in HTML). */
export function descriptionsKey(assetId: string, lang: string): string {
  const safe = lang.trim().toLowerCase() || 'en'
  return `assets/${assetId}/descriptions/${safe}.vtt`
}

/** Optional pre-built accessible transcript (#28 / pack). */
export function transcriptKey(assetId: string): string {
  return `assets/${assetId}/transcript.html`
}

/**
 * Offline pack zip (#35).
 * Asset-scoped for the worker job; ADR also lists lessons/{id}/packs/offline.zip for lesson APIs.
 */
export function offlinePackKey(assetId: string): string {
  return `assets/${assetId}/packs/offline.zip`
}
