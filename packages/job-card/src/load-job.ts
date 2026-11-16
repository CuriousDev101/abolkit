import {
  parseJobPosting,
  stripHtmlToPlainText,
  toJobPostingJsonLd,
  type NormalizedJobPosting,
} from './schema.ts'

const LD_SCRIPT_RE =
  /<script\b[^>]*\btype\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi

export type JobExtractSource = 'json' | 'json-ld' | 'html'

export type JobRemoteParseResult = {
  job: NormalizedJobPosting
  /** schema.org JobPosting object suitable for the card / crawlers */
  jsonLd: Record<string, unknown>
  extractedFrom: JobExtractSource
}

/** Pull JSON-LD documents out of an HTML page (script tags). */
export function extractJsonLdDocuments(html: string): unknown[] {
  const docs: unknown[] = []
  for (const match of html.matchAll(LD_SCRIPT_RE)) {
    const raw = match[1]?.trim()
    if (!raw) continue
    try {
      docs.push(JSON.parse(raw) as unknown)
    } catch {
      // skip malformed blocks
    }
  }
  return docs
}

function decodeEntities(text: string): string {
  return text
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(Number.parseInt(n, 16)))
}

function metaContent(html: string, names: string[]): string | undefined {
  for (const name of names) {
    const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const re = new RegExp(
      `<meta\\b[^>]*(?:name|property)\\s*=\\s*["']${escaped}["'][^>]*content\\s*=\\s*["']([^"']+)["'][^>]*>|<meta\\b[^>]*content\\s*=\\s*["']([^"']+)["'][^>]*(?:name|property)\\s*=\\s*["']${escaped}["'][^>]*>`,
      'i',
    )
    const match = re.exec(html)
    const value = match?.[1] ?? match?.[2]
    if (value?.trim()) return decodeEntities(value.trim())
  }
  return undefined
}

function firstMatch(html: string, patterns: RegExp[]): string | undefined {
  for (const re of patterns) {
    const match = re.exec(html)
    const raw = match?.[1]
    if (!raw) continue
    const text = stripHtmlToPlainText(decodeEntities(raw)).trim()
    if (text) return text
  }
  return undefined
}

function itemprop(html: string, prop: string): string | undefined {
  const escaped = prop.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return firstMatch(html, [
    new RegExp(
      `<[^>]+\\bitemprop\\s*=\\s*["'][^"']*\\b${escaped}\\b[^"']*["'][^>]*content\\s*=\\s*["']([^"']+)["'][^>]*>`,
      'i',
    ),
    new RegExp(
      `<[^>]+\\bitemprop\\s*=\\s*["'][^"']*\\b${escaped}\\b[^"']*["'][^>]*>([\\s\\S]*?)</[^>]+>`,
      'i',
    ),
  ])
}

/**
 * Build a JobPosting-shaped object from HTML when JSON-LD is missing:
 * microdata itemprops, Open Graph / Twitter meta, and common career-page markup.
 */
export function scrapeJobPostingFromHtml(html: string, pageUrl?: string): Record<string, unknown> {
  const title =
    itemprop(html, 'title') ??
    metaContent(html, ['og:title', 'twitter:title']) ??
    firstMatch(html, [
      /<h1\b[^>]*>([\s\S]*?)<\/h1>/i,
      /<(?:div|span|p)\b[^>]*(?:class|id)\s*=\s*["'][^"']*(?:job[-_ ]?title|posting[-_ ]?title|position[-_ ]?title)[^"']*["'][^>]*>([\s\S]*?)<\/(?:div|span|p)>/i,
      /<title\b[^>]*>([\s\S]*?)<\/title>/i,
    ])

  const description =
    itemprop(html, 'description') ??
    metaContent(html, ['og:description', 'twitter:description', 'description']) ??
    firstMatch(html, [
      /<(?:div|section|article)\b[^>]*(?:class|id)\s*=\s*["'][^"']*(?:job[-_ ]?description|posting[-_ ]?description|description|job[-_ ]?details)[^"']*["'][^>]*>([\s\S]*?)<\/(?:div|section|article)>/i,
    ])

  const orgName =
    itemprop(html, 'hiringOrganization') ??
    itemprop(html, 'name') ??
    metaContent(html, ['og:site_name']) ??
    firstMatch(html, [
      /<(?:div|span|a|p)\b[^>]*(?:class|id)\s*=\s*["'][^"']*(?:company|employer|hiring[-_ ]?org|organization)[^"']*["'][^>]*>([\s\S]*?)<\/(?:div|span|a|p)>/i,
    ])

  const locality =
    itemprop(html, 'addressLocality') ??
    itemprop(html, 'jobLocation') ??
    firstMatch(html, [
      /<(?:div|span|p)\b[^>]*(?:class|id)\s*=\s*["'][^"']*(?:job[-_ ]?location|location|city)[^"']*["'][^>]*>([\s\S]*?)<\/(?:div|span|p)>/i,
    ])

  const datePosted = itemprop(html, 'datePosted') ?? metaContent(html, ['article:published_time'])
  const validThrough =
    itemprop(html, 'validThrough') ??
    firstMatch(html, [
      /<(?:div|span|time|p)\b[^>]*(?:class|id)\s*=\s*["'][^"']*(?:deadline|closing|valid[-_ ]?through|apply[-_ ]?by)[^"']*["'][^>]*>([\s\S]*?)<\/(?:div|span|time|p)>/i,
    ])
  const employmentType = itemprop(html, 'employmentType')
  const salaryText =
    itemprop(html, 'baseSalary') ??
    firstMatch(html, [
      /<(?:div|span|p)\b[^>]*(?:class|id)\s*=\s*["'][^"']*(?:salary|pay|compensation|wage)[^"']*["'][^>]*>([\s\S]*?)<\/(?:div|span|p)>/i,
    ])

  const applyUrl =
    itemprop(html, 'url') ??
    metaContent(html, ['og:url']) ??
    firstMatch(html, [
      /<a\b[^>]*(?:class|id)\s*=\s*["'][^"']*(?:apply|application)[^"']*["'][^>]*href\s*=\s*["']([^"']+)["'][^>]*>/i,
      /<a\b[^>]*href\s*=\s*["']([^"']+)["'][^>]*(?:class|id)\s*=\s*["'][^"']*(?:apply|application)[^"']*["'][^>]*>/i,
    ]) ??
    pageUrl

  if (!title) {
    throw new Error('Could not find a job title in the HTML page')
  }

  const posting: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'JobPosting',
    title,
    description: description || title,
  }
  if (orgName) posting.hiringOrganization = { '@type': 'Organization', name: orgName }
  if (locality) {
    posting.jobLocation = {
      '@type': 'Place',
      address: { '@type': 'PostalAddress', addressLocality: locality },
    }
  }
  if (datePosted) posting.datePosted = datePosted
  if (validThrough) posting.validThrough = validThrough
  if (employmentType) posting.employmentType = employmentType
  if (applyUrl) posting.url = applyUrl
  if (salaryText && !description?.toLowerCase().includes(salaryText.toLowerCase())) {
    // Keep readable pay text in the description when structured salary is unavailable.
    posting.description = `${posting.description}\n\nPay: ${salaryText}`
  }
  if (pageUrl) posting['@id'] = pageUrl
  return posting
}

/**
 * Parse a JobPosting from a remote response body.
 * Accepts bare JSON/JSON-LD, HTML with JSON-LD, or plain HTML career pages (scraped).
 */
export function parseJobPostingFromRemote(
  body: string,
  contentType = '',
  pageUrl?: string,
): JobRemoteParseResult {
  const type = contentType.toLowerCase()
  const looksHtml =
    type.includes('text/html') || type.includes('application/xhtml') || /^\s*</.test(body)

  if (!looksHtml) {
    const job = parseJobPosting(JSON.parse(body) as unknown)
    return { job, jsonLd: toJobPostingJsonLd(job), extractedFrom: 'json' }
  }

  const docs = extractJsonLdDocuments(body)
  const errors: string[] = []
  for (const doc of docs) {
    try {
      const job = parseJobPosting(doc)
      return { job, jsonLd: toJobPostingJsonLd(job), extractedFrom: 'json-ld' }
    } catch (err) {
      errors.push(err instanceof Error ? err.message : String(err))
    }
  }

  try {
    const scraped = scrapeJobPostingFromHtml(body, pageUrl)
    const job = parseJobPosting(scraped)
    return { job, jsonLd: toJobPostingJsonLd(job), extractedFrom: 'html' }
  } catch (err) {
    const scrapeMsg = err instanceof Error ? err.message : String(err)
    if (docs.length > 0 && errors[0]) {
      throw new Error(`No usable JobPosting in page JSON-LD (${errors[0]}); HTML scrape: ${scrapeMsg}`)
    }
    throw new Error(scrapeMsg)
  }
}
