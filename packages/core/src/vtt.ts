import type { Cue } from './cue.js'

/**
 * Parse a WebVTT document into cues.
 * Tolerant of BOM, missing WEBVTT header, CRLF, NOTE/STYLE blocks, and cue settings.
 * Ethiopic and other Unicode text is preserved as-is.
 */
export function parseVtt(text: string): Cue[] {
  const normalized = text.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n')
  const blocks = normalized.split(/\n\n+/)
  const cues: Cue[] = []

  for (const raw of blocks) {
    const block = raw.trim()
    if (!block) continue
    if (/^WEBVTT\b/i.test(block)) continue
    if (/^(NOTE|STYLE|REGION)\b/i.test(block)) continue

    const lines = block.split('\n')
    const timingIndex = lines.findIndex((line) => line.includes('-->'))
    if (timingIndex < 0) continue

    const id = timingIndex > 0 ? lines[0]?.trim() || undefined : undefined
    const timingLine = lines[timingIndex] ?? ''
    const arrow = timingLine.indexOf('-->')
    if (arrow < 0) continue

    const start = parseTimestamp(timingLine.slice(0, arrow).trim())
    const afterArrow = timingLine.slice(arrow + 3).trim()
    const endToken = afterArrow.split(/\s+/)[0] ?? ''
    const end = parseTimestamp(endToken)
    if (start === null || end === null || end < start) continue

    const textLines = lines.slice(timingIndex + 1)
    const text = textLines
      .map((line) => stripVttTags(line))
      .join('\n')
      .trim()
    if (!text) continue

    const cue: Cue = { start, end, text }
    if (id) cue.id = id
    if (/\bneedsReview\b/i.test(timingLine) || /\bneeds-review\b/i.test(id ?? '')) {
      cue.needsReview = true
    }
    cues.push(cue)
  }

  return cues
}

/** Serialize cues to a WebVTT document (round-trip safe for text and times). */
export function serializeVtt(cues: readonly Cue[]): string {
  const parts = ['WEBVTT', '']
  for (const cue of cues) {
    if (cue.id) parts.push(cue.id)
    const settings = cue.needsReview ? ' needsReview' : ''
    parts.push(`${formatTimestamp(cue.start)} --> ${formatTimestamp(cue.end)}${settings}`)
    parts.push(cue.text)
    parts.push('')
  }
  return parts.join('\n')
}

function parseTimestamp(value: string): number | null {
  const m = /^(\d{1,2}):(\d{2})(?::(\d{2}))?\.(\d{1,3})$/.exec(value.trim())
  if (!m) return null
  const hasHours = m[3] !== undefined
  const hours = hasHours ? Number(m[1]) : 0
  const minutes = hasHours ? Number(m[2]) : Number(m[1])
  const seconds = hasHours ? Number(m[3]) : Number(m[2])
  const frac = (m[4] ?? '0').padEnd(3, '0').slice(0, 3)
  if (minutes >= 60 || seconds >= 60) return null
  return hours * 3600 + minutes * 60 + seconds + Number(frac) / 1000
}

function formatTimestamp(seconds: number): string {
  const safe = Math.max(0, seconds)
  const h = Math.floor(safe / 3600)
  const m = Math.floor((safe % 3600) / 60)
  const s = Math.floor(safe % 60)
  const ms = Math.round((safe % 1) * 1000)
  const pad = (n: number, w = 2) => String(n).padStart(w, '0')
  return `${pad(h)}:${pad(m)}:${pad(s)}.${pad(ms, 3)}`
}

/** Strip simple WebVTT tags (`<c>`, `<v>`, `<b>`, timestamps) while keeping text. */
function stripVttTags(line: string): string {
  return line
    .replace(/<\d{1,2}:\d{2}(?::\d{2})?\.\d{1,3}>/g, '')
    .replace(/<\/?[cibuv](\s[^>]*)?>/gi, '')
    .replace(/<[^>]+>/g, '')
}
