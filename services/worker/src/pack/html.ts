import { parseVtt, type Cue } from '@abolkit/core'

export type PackCaptionTrack = {
  lang: string
  label: string
  /** Filename inside the zip, e.g. captions.en.vtt */
  fileName: string
  vtt: string
}

export type PackPageOptions = {
  title: string
  /** Primary BCP-47 / HTML lang for the pack shell. */
  lang: string
  captions: PackCaptionTrack[]
  /** When true, link optional 240p video. */
  includeVideo: boolean
  videoFileName?: string
  audioFileName?: string
  transcriptFileName?: string
}

const FONT_STACK =
  'system-ui, "Segoe UI", Roboto, "Noto Sans", "Noto Sans Ethiopic", "Nyala", sans-serif'

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

function formatClock(seconds: number): string {
  const safe = Math.max(0, seconds)
  const m = Math.floor(safe / 60)
  const s = Math.floor(safe % 60)
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

/**
 * Static pack landing page: no required JavaScript.
 * Phone file managers can open this after unzipping.
 */
export function renderIndexHtml(options: PackPageOptions): string {
  const audio = options.audioFileName ?? 'lesson.opus'
  const transcript = options.transcriptFileName ?? 'transcript.html'
  const video = options.videoFileName ?? 'lesson-240p.mp4'
  const title = escapeHtml(options.title)
  const lang = escapeHtml(options.lang || 'en')

  const captionLinks = options.captions
    .map(
      (c) =>
        `      <li><a href="${escapeHtml(c.fileName)}">${escapeHtml(c.label)} captions (${escapeHtml(c.lang)})</a></li>`,
    )
    .join('\n')

  const videoBlock = options.includeVideo
    ? `
  <section>
    <h2>Video (optional)</h2>
    <video controls preload="metadata" src="${escapeHtml(video)}">
      <a href="${escapeHtml(video)}">Download ${escapeHtml(video)}</a>
    </video>
  </section>`
    : ''

  return `<!DOCTYPE html>
<html lang="${lang}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${title}</title>
  <style>
    :root { color-scheme: light dark; }
    body {
      margin: 1.25rem auto;
      max-width: 40rem;
      padding: 0 1rem 2rem;
      font-family: ${FONT_STACK};
      line-height: 1.5;
    }
    h1 { font-size: 1.5rem; margin-bottom: 0.5rem; }
    audio, video { width: 100%; margin: 0.75rem 0; }
    ul { padding-left: 1.25rem; }
    .note { opacity: 0.85; font-size: 0.95rem; }
  </style>
</head>
<body>
  <header>
    <h1>${title}</h1>
    <p class="note">Offline lesson pack. Open this file from your phone after unzipping. No network required.</p>
  </header>

  <section>
    <h2>Audio</h2>
    <audio controls preload="metadata" src="${escapeHtml(audio)}">
      Your browser cannot play Opus in-page.
      <a href="${escapeHtml(audio)}">Download the audio file</a> instead.
    </audio>
    <p><a href="${escapeHtml(audio)}">Download audio (${escapeHtml(audio)})</a></p>
  </section>
${videoBlock}
  <section>
    <h2>Text</h2>
    <ul>
      <li><a href="${escapeHtml(transcript)}">Accessible transcript</a></li>
${captionLinks}
    </ul>
  </section>
</body>
</html>
`
}

/**
 * Accessible dual-language transcript from WebVTT captions (no JS).
 * Prefers a stored transcript when callers supply one instead.
 */
export function renderTranscriptHtml(options: {
  title: string
  captions: PackCaptionTrack[]
}): string {
  const title = escapeHtml(options.title)
  const sections = options.captions
    .map((track) => {
      const cues = parseVtt(track.vtt)
      const body =
        cues.length === 0
          ? '      <p><em>No cues in this track.</em></p>'
          : ['      <ol>', ...cues.map((cue) => renderCueItem(cue)), '      </ol>'].join('\n')
      return `  <section lang="${escapeHtml(track.lang)}">
    <h2>${escapeHtml(track.label)}</h2>
${body}
  </section>`
    })
    .join('\n\n')

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Transcript — ${title}</title>
  <style>
    body {
      margin: 1.25rem auto;
      max-width: 40rem;
      padding: 0 1rem 2rem;
      font-family: ${FONT_STACK};
      line-height: 1.55;
    }
    h1 { font-size: 1.35rem; }
    h2 { font-size: 1.1rem; margin-top: 1.5rem; }
    time { font-variant-numeric: tabular-nums; opacity: 0.75; margin-right: 0.5rem; }
    li { margin: 0.4rem 0; }
  </style>
</head>
<body>
  <h1>Transcript — ${title}</h1>
  <p><a href="index.html">Back to lesson</a></p>
${sections || '  <p><em>No caption tracks were available for this pack.</em></p>'}
</body>
</html>
`
}

function renderCueItem(cue: Cue): string {
  const review = cue.needsReview ? ' data-needs-review="true"' : ''
  const mark = cue.needsReview ? ' <em>(needs review)</em>' : ''
  return `        <li${review}><time datetime="${escapeHtml(String(cue.start))}">${formatClock(cue.start)}</time> ${escapeHtml(cue.text)}${mark}</li>`
}

export function captionFileName(lang: string): string {
  const safe = lang.trim().toLowerCase() || 'en'
  return `captions.${safe}.vtt`
}

export function labelForLang(lang: string): string {
  const l = lang.trim().toLowerCase()
  if (l === 'am') return 'አማርኛ'
  if (l === 'en') return 'English'
  return lang
}
