import { parseVtt, type Cue } from '@abolkit/core'

export type PackCaptionTrack = {
  lang: string
  label: string
  /** Filename inside the zip, e.g. captions.en.vtt */
  fileName: string
  vtt: string
}

/** Audio-description / visual-description track (WebVTT), reused as image descriptions (#54). */
export type PackDescriptionTrack = {
  lang: string
  label: string
  fileName: string
  vtt: string
}

/**
 * Still image for the accessible document.
 * Meaningful images require a non-empty `alt` from existing metadata — never invent one.
 * Decorative images use `decorative: true` (rendered as `alt=""`).
 */
export type PackImage = {
  src: string
  /** Required unless decorative. Must be a real description from metadata. */
  alt?: string
  decorative?: boolean
  /** Optional longer description (complex diagrams). */
  longDesc?: string
  /** Optional caption shown visually under the figure. */
  caption?: string
}

export type PackPageOptions = {
  title: string
  /** Primary BCP-47 / HTML lang for the pack shell. */
  lang: string
  captions: PackCaptionTrack[]
  descriptions?: PackDescriptionTrack[]
  images?: PackImage[]
  /** When true, link optional 240p video. */
  includeVideo: boolean
  videoFileName?: string
  audioFileName?: string
  transcriptFileName?: string
}

export type TranscriptHtmlOptions = {
  title: string
  /** Document language (default en). */
  lang?: string
  captions: PackCaptionTrack[]
  descriptions?: PackDescriptionTrack[]
  images?: PackImage[]
}

const FONT_STACK =
  'system-ui, "Segoe UI", Roboto, "Noto Sans", "Noto Sans Ethiopic", "Nyala", sans-serif'

const PLACEHOLDER_ALTS = new Set(['image', 'picture', 'photo', 'img', 'graphic', 'icon'])

export function escapeHtml(value: string): string {
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

/** Reject empty or placeholder alts like "image" / "picture". */
export function isMeaningfulAlt(alt: string | undefined): boolean {
  if (alt == null) return false
  const trimmed = alt.trim()
  if (!trimmed) return false
  if (PLACEHOLDER_ALTS.has(trimmed.toLowerCase())) return false
  if (/^image\s*\d+$/i.test(trimmed)) return false
  return true
}

/**
 * Render a figure. Decorative → alt="". Meaningful without alt → omitted (do not invent).
 */
export function renderFigure(image: PackImage, index: number): string | null {
  if (image.decorative === true) {
    const caption = image.caption
      ? `\n    <figcaption>${escapeHtml(image.caption)}</figcaption>`
      : ''
    return `  <figure>
    <img src="${escapeHtml(image.src)}" alt="" role="presentation">${caption}
  </figure>`
  }

  if (!isMeaningfulAlt(image.alt)) {
    return null
  }

  const id = `fig-desc-${index + 1}`
  const long =
    image.longDesc?.trim() && isMeaningfulAlt(image.longDesc)
      ? `\n    <p id="${id}">${escapeHtml(image.longDesc.trim())}</p>`
      : ''
  const describedBy = long ? ` aria-describedby="${id}"` : ''
  const caption = image.caption ? `\n    <figcaption>${escapeHtml(image.caption)}</figcaption>` : ''

  return `  <figure>
    <img src="${escapeHtml(image.src)}" alt="${escapeHtml(image.alt!.trim())}"${describedBy}>${long}${caption}
  </figure>`
}

function renderFigures(images: PackImage[] | undefined): string {
  if (!images?.length) return ''
  const parts: string[] = []
  images.forEach((img, i) => {
    const html = renderFigure(img, i)
    if (html) parts.push(html)
  })
  if (!parts.length) return ''
  return `
  <section aria-labelledby="figures-heading">
    <h2 id="figures-heading">Figures</h2>
${parts.join('\n')}
  </section>`
}

function renderCueList(cues: Cue[]): string {
  if (cues.length === 0) return '      <p><em>No cues in this track.</em></p>'
  return ['      <ol>', ...cues.map((cue) => renderCueItem(cue)), '      </ol>'].join('\n')
}

/**
 * Static pack landing page: no required JavaScript.
 * Semantic structure for screen readers (#54); phone file managers can open after unzip.
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
        `          <li><a href="${escapeHtml(c.fileName)}">${escapeHtml(c.label)} captions (${escapeHtml(c.lang)})</a></li>`,
    )
    .join('\n')

  const descriptionLinks = (options.descriptions ?? [])
    .map(
      (d) =>
        `          <li><a href="${escapeHtml(d.fileName)}">${escapeHtml(d.label)} visual descriptions (${escapeHtml(d.lang)})</a></li>`,
    )
    .join('\n')

  const videoBlock = options.includeVideo
    ? `
    <section aria-labelledby="video-heading">
      <h2 id="video-heading">Video (optional)</h2>
      <video controls preload="metadata" src="${escapeHtml(video)}">
        <a href="${escapeHtml(video)}">Download the optional video file (${escapeHtml(video)})</a>
      </video>
    </section>`
    : ''

  const figures = renderFigures(options.images)

  return `<!DOCTYPE html>
<html lang="${lang}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${title}</title>
  <style>
    :root { color-scheme: light dark; }
    body {
      margin: 0;
      font-family: ${FONT_STACK};
      line-height: 1.5;
    }
    main {
      margin: 1.25rem auto;
      max-width: 40rem;
      padding: 0 1rem 2rem;
    }
    h1 { font-size: 1.5rem; margin-bottom: 0.5rem; }
    audio, video, img { width: 100%; max-width: 100%; margin: 0.75rem 0; height: auto; }
    ul { padding-left: 1.25rem; }
    .note { opacity: 0.85; font-size: 0.95rem; }
    figure { margin: 1rem 0; }
    figcaption { font-size: 0.95rem; opacity: 0.9; }
  </style>
</head>
<body>
  <main>
    <header>
      <h1>${title}</h1>
      <p class="note">Offline lesson pack. Open this file from your phone after unzipping. No network required.</p>
    </header>

    <nav aria-label="Lesson materials">
      <h2>Materials</h2>
      <ul>
        <li><a href="${escapeHtml(transcript)}">Accessible transcript</a></li>
${captionLinks}
${descriptionLinks}
        <li><a href="${escapeHtml(audio)}">Download lesson audio (${escapeHtml(audio)})</a></li>
      </ul>
    </nav>

    <section aria-labelledby="audio-heading">
      <h2 id="audio-heading">Audio</h2>
      <audio controls preload="metadata" src="${escapeHtml(audio)}">
        Your browser cannot play Opus in-page.
        <a href="${escapeHtml(audio)}">Download the audio file</a> instead.
      </audio>
    </section>
${videoBlock}${figures}

    <footer>
      <p>Generated by Abol Kit offline pack. Machine captions may still need human review.</p>
    </footer>
  </main>
</body>
</html>
`
}

/**
 * Accessible transcript HTML (#35 / #54): captions + visual descriptions + optional figures.
 * No required JavaScript. Does not invent image descriptions.
 */
export function renderTranscriptHtml(options: TranscriptHtmlOptions): string {
  const title = escapeHtml(options.title)
  const lang = escapeHtml(options.lang || 'en')

  const captionSections = options.captions
    .map((track) => {
      const cues = parseVtt(track.vtt)
      return `    <section lang="${escapeHtml(track.lang)}" aria-labelledby="cap-${escapeHtml(track.lang)}">
      <h2 id="cap-${escapeHtml(track.lang)}">Captions — ${escapeHtml(track.label)}</h2>
${renderCueList(cues)}
    </section>`
    })
    .join('\n\n')

  const descriptionSections = (options.descriptions ?? [])
    .map((track) => {
      const cues = parseVtt(track.vtt)
      return `    <section lang="${escapeHtml(track.lang)}" aria-labelledby="desc-${escapeHtml(track.lang)}">
      <h2 id="desc-${escapeHtml(track.lang)}">Visual descriptions — ${escapeHtml(track.label)}</h2>
      <p>Timed descriptions of on-screen visuals (audio description cues). Reviewed text only; nothing is invented here.</p>
${renderCueList(cues)}
    </section>`
    })
    .join('\n\n')

  const figures = renderFigures(options.images)
  const figuresIndented = figures
    ? figures
        .split('\n')
        .map((line) => (line ? `  ${line}` : line))
        .join('\n')
    : ''

  const body =
    [captionSections, descriptionSections, figuresIndented].filter(Boolean).join('\n\n') ||
    '    <p><em>No caption or description tracks were available for this pack.</em></p>'

  return `<!DOCTYPE html>
<html lang="${lang}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Transcript — ${title}</title>
  <style>
    body { margin: 0; font-family: ${FONT_STACK}; line-height: 1.55; }
    main {
      margin: 1.25rem auto;
      max-width: 40rem;
      padding: 0 1rem 2rem;
    }
    h1 { font-size: 1.35rem; }
    h2 { font-size: 1.1rem; margin-top: 1.5rem; }
    time { font-variant-numeric: tabular-nums; opacity: 0.75; margin-right: 0.5rem; }
    li { margin: 0.4rem 0; }
    figure { margin: 1rem 0; }
    img { max-width: 100%; height: auto; }
  </style>
</head>
<body>
  <main>
    <header>
      <h1>Transcript — ${title}</h1>
      <p><a href="index.html">Back to lesson</a></p>
    </header>

${body}

    <footer>
      <p>End of transcript.</p>
    </footer>
  </main>
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

export function descriptionFileName(lang: string): string {
  const safe = lang.trim().toLowerCase() || 'en'
  return `descriptions.${safe}.vtt`
}

export function labelForLang(lang: string): string {
  const l = lang.trim().toLowerCase()
  if (l === 'am') return 'አማርኛ'
  if (l === 'en') return 'English'
  return lang
}
