// Client for the URL caption API (services/api, ADR 0007). Used only when the host opts in with
// `caption-api` + a valid `generate-captions` attribute.

/** Languages the player may ask the API to translate into. Must stay a subset of the API's TRANSLATION_LANGUAGES. */
export const GENERATABLE_LANGUAGES = ['am', 'om', 'ti', 'aa'] as const

export type GenerateRequest =
  { valid: true; languages: string[] } | { valid: false; reason: string }

/**
 * `generate-captions=""` asks for the transcript only; `generate-captions="am om"` adds translations.
 * Any unknown token makes the whole value invalid, and then nothing is requested.
 */
export function parseGenerateCaptions(value: string | null): GenerateRequest | null {
  if (value === null) return null
  const tokens = value
    .trim()
    .split(/[\s,]+/)
    .filter(Boolean)
  const unknown = tokens.filter(
    (tok) => !(GENERATABLE_LANGUAGES as readonly string[]).includes(tok),
  )
  if (unknown.length) {
    return {
      valid: false,
      reason: `generate-captions has unsupported language(s): ${unknown.join(', ')}. Use: ${GENERATABLE_LANGUAGES.join(' ')}`,
    }
  }
  return { valid: true, languages: [...new Set(tokens)] }
}

export interface ApiCaption {
  language: string
  kind: 'transcript' | 'translation'
  url: string
  needsReview: boolean
}

export interface ApiCaptionJob {
  id: string
  type: 'transcribe' | 'translate'
  language: string | null
  status: 'queued' | 'running' | 'succeeded' | 'failed'
  progress: number
  error: string | null
}

export interface CaptionStatus {
  status: 'ready' | 'processing' | 'failed'
  captions: ApiCaption[]
  jobs: ApiCaptionJob[]
}

export interface WatchOptions {
  /** API origin, e.g. `https://captions.example.org`. */
  api: string
  videoUrl: string
  languages: string[]
  /** Spoken language of the video when the host knows it; the API trusts this. */
  sourceLanguage?: string
  signal: AbortSignal
  /** Called once per caption file, with its WebVTT text. */
  onCaption(caption: ApiCaption, vtt: string): void
  /** Full API status each poll (jobs, overall state). */
  onStatus?(status: CaptionStatus): void
  pollMs?: number
  /** Stop polling after this long; the job keeps running on the server. */
  maxWaitMs?: number
}

/**
 * Look up captions for the video; request the missing ones once; poll until no job is left, delivering
 * each caption file (the transcript and the requested languages) as it appears.
 */
export async function watchCaptions(options: WatchOptions): Promise<void> {
  const { signal } = options
  const base = options.api.replace(/\/+$/, '')
  const pollMs = options.pollMs ?? 5_000
  const deadline = Date.now() + (options.maxWaitMs ?? 2 * 3600_000)
  const delivered = new Set<string>()
  let requested = false

  const wanted = (caption: ApiCaption) =>
    caption.kind === 'transcript' || options.languages.includes(caption.language)

  const missing = (status: CaptionStatus) => {
    const transcript = status.captions.find((c) => c.kind === 'transcript')
    if (!transcript) return true
    return options.languages.some(
      (lang) => lang !== transcript.language && !status.captions.some((c) => c.language === lang),
    )
  }

  while (!signal.aborted && Date.now() < deadline) {
    let status = await lookup(base, options.videoUrl, signal)
    if (!requested && (!status || (status.status !== 'processing' && missing(status)))) {
      requested = true
      status = await request(base, options.videoUrl, options.languages, signal, options.sourceLanguage)
    }
    if (!status) return
    options.onStatus?.(status)

    for (const caption of status.captions) {
      if (!wanted(caption) || delivered.has(caption.language)) continue
      const res = await fetch(caption.url, { signal })
      if (!res.ok) continue
      delivered.add(caption.language)
      options.onCaption(caption, await res.text())
    }
    if (status.status !== 'processing') return
    await sleep(pollMs, signal)
  }
}

async function lookup(
  base: string,
  videoUrl: string,
  signal: AbortSignal,
): Promise<CaptionStatus | null> {
  const res = await fetch(`${base}/api/captions?url=${encodeURIComponent(videoUrl)}`, { signal })
  if (res.status === 404) return null
  if (!res.ok) throw new Error(`Caption API HTTP ${res.status}`)
  return normalizeStatus(await res.json())
}

async function request(
  base: string,
  videoUrl: string,
  languages: string[],
  signal: AbortSignal,
  sourceLanguage?: string,
): Promise<CaptionStatus> {
  const res = await fetch(`${base}/api/captions/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      url: videoUrl,
      languages,
      ...(sourceLanguage ? { sourceLanguage } : {}),
    }),
    signal,
  })
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { error?: { message?: string } } | null
    throw new Error(body?.error?.message ?? `Caption API HTTP ${res.status}`)
  }
  return normalizeStatus(await res.json())
}

function normalizeStatus(raw: unknown): CaptionStatus {
  const body = raw as Partial<CaptionStatus> & { jobs?: ApiCaptionJob[] }
  return {
    status: body.status === 'processing' || body.status === 'failed' ? body.status : 'ready',
    captions: Array.isArray(body.captions) ? body.captions : [],
    jobs: Array.isArray(body.jobs) ? body.jobs : [],
  }
}

function sleep(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    const timer = setTimeout(done, ms)
    signal.addEventListener('abort', done, { once: true })
    function done() {
      clearTimeout(timer)
      signal.removeEventListener('abort', done)
      resolve()
    }
  })
}
