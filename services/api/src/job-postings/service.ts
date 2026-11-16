import { parseJobPostingFromRemote } from '@abolkit/job-card/load-job'

import { HttpError } from '../http.ts'

const FETCH_TIMEOUT_MS = 12_000
const MAX_BYTES = 2_000_000

/** Block obvious SSRF targets while still allowing local demos on loopback. */
export function assertFetchableJobUrl(raw: string): URL {
  let url: URL
  try {
    url = new URL(raw)
  } catch {
    throw new HttpError(400, 'INVALID_URL', 'Job URL must be an absolute http(s) URL')
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new HttpError(400, 'INVALID_URL', 'Job URL must use http or https')
  }
  if (url.username || url.password) {
    throw new HttpError(400, 'INVALID_URL', 'Job URL must not include credentials')
  }
  const host = url.hostname.toLowerCase()
  if (
    host === 'metadata.google.internal' ||
    host.endsWith('.internal') ||
    host === '0.0.0.0'
  ) {
    throw new HttpError(400, 'URL_BLOCKED', 'That job URL host is not allowed')
  }
  return url
}

export async function resolveJobPostingUrl(rawUrl: string): Promise<{
  sourceUrl: string
  extractedFrom: 'json' | 'json-ld' | 'html'
  job: Record<string, unknown>
}> {
  const url = assertFetchableJobUrl(rawUrl)
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      redirect: 'follow',
      headers: {
        Accept: 'application/ld+json, application/json;q=0.9, text/html;q=0.8, */*;q=0.1',
        'User-Agent': 'AbolKitJobCard/0.1 (+https://github.com/CuriousDev101/abolkit)',
      },
    })
    if (!res.ok) {
      throw new HttpError(502, 'UPSTREAM_HTTP', `Job URL returned HTTP ${res.status}`)
    }
    const length = Number(res.headers.get('content-length') ?? '0')
    if (Number.isFinite(length) && length > MAX_BYTES) {
      throw new HttpError(400, 'PAYLOAD_TOO_LARGE', 'Job page is too large to fetch')
    }
    const buf = await res.arrayBuffer()
    if (buf.byteLength > MAX_BYTES) {
      throw new HttpError(400, 'PAYLOAD_TOO_LARGE', 'Job page is too large to fetch')
    }
    const body = new TextDecoder('utf-8').decode(buf)
    try {
      const parsed = parseJobPostingFromRemote(body, res.headers.get('content-type') ?? '', url.href)
      return {
        sourceUrl: url.href,
        extractedFrom: parsed.extractedFrom,
        job: parsed.jsonLd,
      }
    } catch (err) {
      throw new HttpError(
        400,
        'JOB_PARSE_FAILED',
        err instanceof Error ? err.message : 'Could not extract a JobPosting from that URL',
      )
    }
  } catch (err) {
    if (err instanceof HttpError) throw err
    if (err instanceof Error && err.name === 'AbortError') {
      throw new HttpError(502, 'UPSTREAM_TIMEOUT', 'Timed out fetching the job URL')
    }
    throw new HttpError(
      502,
      'UPSTREAM_FETCH',
      err instanceof Error ? err.message : 'Could not fetch the job URL',
    )
  } finally {
    clearTimeout(timer)
  }
}
