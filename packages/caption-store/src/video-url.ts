export type VideoSourceKind = 'youtube' | 'file'

/** How a video is identified: the same lesson submitted as different URL spellings maps to one row. */
export interface VideoIdentity {
  /** Canonical URL stored in `videos.url`. */
  url: string
  kind: VideoSourceKind
  youtubeId?: string
}

export class VideoUrlError extends Error {
  readonly code: 'INVALID_URL' | 'HOST_NOT_ALLOWED'

  constructor(code: VideoUrlError['code'], message: string) {
    super(message)
    this.name = 'VideoUrlError'
    this.code = code
  }
}

const YOUTUBE_HOSTS = ['youtube.com', 'youtube-nocookie.com', 'youtu.be']
const YOUTUBE_ID = /^[A-Za-z0-9_-]{11}$/
const MAX_URL_LENGTH = 2048

/** Canonical identity for a video URL. YouTube links of any form become `https://www.youtube.com/watch?v=ID`. */
export function identifyVideoUrl(raw: string): VideoIdentity {
  const trimmed = raw.trim()
  if (!trimmed || trimmed.length > MAX_URL_LENGTH) {
    throw new VideoUrlError('INVALID_URL', `url must be 1-${MAX_URL_LENGTH} characters`)
  }
  let url: URL
  try {
    url = new URL(trimmed)
  } catch {
    throw new VideoUrlError('INVALID_URL', 'url must be an absolute http(s) URL')
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    throw new VideoUrlError('INVALID_URL', 'url must use http or https')
  }
  if (url.username || url.password) {
    throw new VideoUrlError('INVALID_URL', 'url must not contain credentials')
  }

  const host = url.hostname.toLowerCase()
  if (YOUTUBE_HOSTS.some((h) => hostMatches(host, h))) {
    const id = youtubeId(url, host)
    if (!id) throw new VideoUrlError('INVALID_URL', 'YouTube url has no video id')
    return { url: `https://www.youtube.com/watch?v=${id}`, kind: 'youtube', youtubeId: id }
  }

  url.hash = ''
  return { url: url.href, kind: 'file' }
}

function youtubeId(url: URL, host: string): string | undefined {
  const parts = url.pathname.split('/').filter(Boolean)
  const candidate = hostMatches(host, 'youtu.be')
    ? parts[0]
    : parts[0] === 'watch'
      ? (url.searchParams.get('v') ?? undefined)
      : ['embed', 'shorts', 'live', 'v'].includes(parts[0] ?? '')
        ? parts[1]
        : undefined
  return candidate && YOUTUBE_ID.test(candidate) ? candidate : undefined
}

function hostMatches(host: string, entry: string): boolean {
  return host === entry || host.endsWith(`.${entry}`)
}

/**
 * The worker downloads whatever URL it is given, so only listed hosts (and their subdomains) are accepted.
 * `*` allows any host; only use it on a closed network.
 */
export function assertAllowedHost(identity: VideoIdentity, allowedHosts: readonly string[]): void {
  if (allowedHosts.includes('*')) return
  const host = new URL(identity.url).hostname.toLowerCase()
  if (!allowedHosts.some((entry) => hostMatches(host, entry.toLowerCase()))) {
    throw new VideoUrlError(
      'HOST_NOT_ALLOWED',
      `Videos from ${host} are not allowed on this server`,
    )
  }
}
