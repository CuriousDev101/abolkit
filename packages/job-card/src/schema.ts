import { resolveUiLang } from '@abolkit/core'
import { jt, sanitizeLangTag, type JobCardStringKey } from './i18n.ts'

export type JobDeadlineState = 'open' | 'closing-soon' | 'closed'
export type JobCalendar = 'gregory' | 'ethiopic'

export interface JobOrganization {
  name: string
  sameAs?: string
  logo?: string
}

export interface JobSalary {
  currency: string
  value?: number
  minValue?: number
  maxValue?: number
  unitText?: string
}

export interface JobPlace {
  locality?: string
  region?: string
  country?: string
}

export interface JobLocationInfo {
  locality?: string
  region?: string
  country?: string
  places?: JobPlace[]
  remote?: boolean
  applicantLocation?: string
  applicantLocations?: string[]
}

export type DescriptionBlock = { kind: 'p'; text: string } | { kind: 'ul'; items: string[] }

/** Normalized, privacy-safe JobPosting representation used by `<abol-job-card>`. */
export interface NormalizedJobPosting {
  id?: string
  title: string
  description: string
  summaryText: string
  hasExplicitSummary: boolean
  audioSummaryUrl?: string
  hiringOrganization?: JobOrganization
  employmentTypes: string[]
  location: JobLocationInfo
  datePosted?: string
  validThrough?: string
  baseSalary?: JobSalary
  url?: string
  directApply?: boolean
  inLanguage?: string
}

/** Privacy guard (docs-internal/modules/job-card.md): never retain disability/accommodation fields. */
const PRIVACY_BLOCKED_KEY =
  /(accommodation|disabilit|medical|impairment|healthCondition|specialNeeds)/i

const DAY_MS = 24 * 60 * 60 * 1000
const CLOSING_SOON_DAYS = 7

const COUNTRY_NAMES: Record<string, { en: string; am: string }> = {
  ET: { en: 'Ethiopia', am: 'ኢትዮጵያ' },
  ETHIOPIA: { en: 'Ethiopia', am: 'ኢትዮጵያ' },
  KE: { en: 'Kenya', am: 'ኬንያ' },
  KENYA: { en: 'Kenya', am: 'ኬንያ' },
  UG: { en: 'Uganda', am: 'ዩጋንዳ' },
  RW: { en: 'Rwanda', am: 'ሩዋንዳ' },
  NG: { en: 'Nigeria', am: 'ናይጄሪያ' },
  GH: { en: 'Ghana', am: 'ጋና' },
  ZA: { en: 'South Africa', am: 'ደቡብ አፍሪካ' },
  US: { en: 'United States', am: 'አሜሪካ' },
  GB: { en: 'United Kingdom', am: 'ዩናይትድ ኪንግደም' },
}

const EMPLOYMENT_MAP: Record<string, JobCardStringKey> = {
  FULL_TIME: 'fullTime',
  FULLTIME: 'fullTime',
  'FULL-TIME': 'fullTime',
  PART_TIME: 'partTime',
  PARTTIME: 'partTime',
  'PART-TIME': 'partTime',
  CONTRACTOR: 'contractor',
  CONTRACT: 'contract',
  TEMPORARY: 'temporary',
  INTERN: 'intern',
  INTERNSHIP: 'intern',
  VOLUNTEER: 'volunteer',
  PER_DIEM: 'perDiem',
  OTHER: 'otherType',
}

const SALARY_UNIT_MAP: Record<string, JobCardStringKey> = {
  HOUR: 'perHour',
  HUR: 'perHour',
  DAY: 'perDay',
  WEEK: 'perWeek',
  WEE: 'perWeek',
  MONTH: 'perMonth',
  MON: 'perMonth',
  YEAR: 'perYear',
  ANN: 'perYear',
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function cleanString(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : undefined
}

function cleanSafeUrl(value: unknown): string | undefined {
  const raw = cleanString(value)
  if (!raw) return undefined
  if (/^(javascript|data|vbscript):/i.test(raw)) return undefined
  return raw
}

function cleanNumber(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value)
    if (Number.isFinite(parsed)) return parsed
  }
  return undefined
}

function formatList(items: string[], lang?: string | null): string {
  if (items.length === 0) return ''
  if (items.length === 1) return items[0]!
  const ui = resolveUiLang(lang)
  const locale = ui === 'am' ? 'am-ET' : 'en'
  try {
    return new Intl.ListFormat(locale, { style: 'long', type: 'conjunction' }).format(items)
  } catch {
    return items.join(', ')
  }
}

/** Strip HTML tags & collapse whitespace into readable plain-language text. */
export function stripHtmlToPlainText(input: string): string {
  return input
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|h[1-6]|ul|ol)>/gi, '\n\n')
    .replace(/<\/li>/gi, '\n')
    .replace(/<li[^>]*>/gi, '• ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n[ \t]+/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]{2,}/g, ' ')
    .trim()
}

/** Split plain description text into clean paragraphs for flat text consumers. */
export function splitPlainParagraphs(text: string): string[] {
  const plain = stripHtmlToPlainText(text)
  if (!plain) return []
  return plain
    .split(/\n{2,}|\n(?=\s*[•*-]\s)/)
    .map((chunk) => chunk.trim())
    .filter(Boolean)
}

/**
 * Parse description text into semantic paragraphs (`<p>`) and real bullet lists (`<ul><li>`)
 * so screen readers announce list counts and wrapped lines align properly.
 */
export function parseDescriptionBlocks(text: string): DescriptionBlock[] {
  const plain = stripHtmlToPlainText(text)
  if (!plain) return []

  const blocks: DescriptionBlock[] = []
  let pendingItems: string[] = []

  const flushList = (): void => {
    if (pendingItems.length > 0) {
      blocks.push({ kind: 'ul', items: pendingItems })
      pendingItems = []
    }
  }

  for (const rawBlock of plain.split(/\n{2,}/)) {
    const lines = rawBlock
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean)

    let paragraphLines: string[] = []
    const flushPara = (): void => {
      if (paragraphLines.length > 0) {
        blocks.push({ kind: 'p', text: paragraphLines.join(' ') })
        paragraphLines = []
      }
    }

    for (const line of lines) {
      const bulletMatch = /^[•*-]\s+(.*)$/.exec(line)
      if (bulletMatch?.[1]) {
        flushPara()
        pendingItems.push(bulletMatch[1].trim())
      } else {
        flushList()
        paragraphLines.push(line)
      }
    }
    flushPara()
    flushList()
  }

  return blocks
}

/** Recursively strip privacy-sensitive keys (disability / accommodation) from untrusted JSON. */
export function stripPrivacyFields<T>(input: T): T {
  if (Array.isArray(input)) {
    return input.map((item) => stripPrivacyFields(item)) as T
  }
  if (!isRecord(input)) return input
  const out: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(input)) {
    if (PRIVACY_BLOCKED_KEY.test(key)) continue
    out[key] = stripPrivacyFields(value)
  }
  return out as T
}

function matchesJobPostingType(typeField: unknown): boolean {
  if (typeof typeField === 'string') {
    return typeField === 'JobPosting' || typeField.endsWith('/JobPosting')
  }
  if (Array.isArray(typeField)) {
    return typeField.some((item) => matchesJobPostingType(item))
  }
  return false
}

function findJobPostingNode(raw: unknown): Record<string, unknown> | null {
  if (Array.isArray(raw)) {
    for (const item of raw) {
      const match = findJobPostingNode(item)
      if (match) return match
    }
    return null
  }
  if (!isRecord(raw)) return null
  const typeVal = raw['@type'] ?? raw.type
  if (matchesJobPostingType(typeVal)) return raw
  if (Array.isArray(raw['@graph'])) {
    const fromGraph = findJobPostingNode(raw['@graph'])
    if (fromGraph) return fromGraph
  }
  if (typeVal === undefined && typeof raw.title === 'string') {
    return raw
  }
  return null
}

function parseOrganization(raw: unknown): JobOrganization | undefined {
  if (typeof raw === 'string') {
    const name = cleanString(raw)
    return name ? { name } : undefined
  }
  if (!isRecord(raw)) return undefined
  const name = cleanString(raw.name)
  if (!name) return undefined
  const sameAs = cleanSafeUrl(raw.sameAs ?? raw.url)
  const logo = isRecord(raw.logo) ? cleanSafeUrl(raw.logo.url) : cleanSafeUrl(raw.logo)
  return {
    name,
    ...(sameAs ? { sameAs } : {}),
    ...(logo ? { logo } : {}),
  }
}

function parseEmploymentTypes(raw: unknown): string[] {
  if (typeof raw === 'string') {
    return raw
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean)
  }
  if (Array.isArray(raw)) {
    return raw.flatMap((item) => (typeof item === 'string' ? [item.trim()] : [])).filter(Boolean)
  }
  return []
}

function extractCountryName(raw: unknown): string | undefined {
  if (typeof raw === 'string') return cleanString(raw)
  if (isRecord(raw)) return cleanString(raw.name ?? raw.addressCountry)
  return undefined
}

function parseSinglePlace(raw: unknown): JobPlace | null {
  if (typeof raw === 'string') {
    const locality = cleanString(raw)
    return locality ? { locality } : null
  }
  if (!isRecord(raw)) return null
  const addr = raw.address
  if (typeof addr === 'string') {
    const locality = cleanString(addr)
    return locality ? { locality } : null
  }
  if (isRecord(addr)) {
    const locality = cleanString(addr.addressLocality)
    const region = cleanString(addr.addressRegion)
    const country = extractCountryName(addr.addressCountry)
    if (!locality && !region && !country) return null
    return {
      ...(locality ? { locality } : {}),
      ...(region ? { region } : {}),
      ...(country ? { country } : {}),
    }
  }
  const name = cleanString(raw.name)
  return name ? { locality: name } : null
}

function parseLocation(node: Record<string, unknown>): JobLocationInfo {
  const jobLocationType = cleanString(node.jobLocationType)
  const remote = jobLocationType?.toUpperCase() === 'TELECOMMUTE'

  const locItems = Array.isArray(node.jobLocation)
    ? node.jobLocation
    : node.jobLocation !== undefined
      ? [node.jobLocation]
      : []
  const places = locItems
    .map((item) => parseSinglePlace(item))
    .filter((item): item is JobPlace => item !== null)
  const primary = places[0]

  const reqItems = Array.isArray(node.applicantLocationRequirements)
    ? node.applicantLocationRequirements
    : node.applicantLocationRequirements !== undefined
      ? [node.applicantLocationRequirements]
      : []
  const applicantLocations = reqItems
    .map((item) => extractCountryName(item))
    .filter((item): item is string => Boolean(item))

  return {
    ...(primary?.locality ? { locality: primary.locality } : {}),
    ...(primary?.region ? { region: primary.region } : {}),
    ...(primary?.country ? { country: primary.country } : {}),
    ...(places.length > 0 ? { places } : {}),
    ...(remote ? { remote: true } : {}),
    ...(applicantLocations[0] ? { applicantLocation: applicantLocations[0] } : {}),
    ...(applicantLocations.length > 0 ? { applicantLocations } : {}),
  }
}

function parseSalary(raw: unknown): JobSalary | undefined {
  if (!isRecord(raw)) return undefined
  const currency = cleanString(raw.currency ?? raw.salaryCurrency)
  if (!currency) return undefined

  const valField = raw.value
  if (isRecord(valField)) {
    const value = cleanNumber(valField.value)
    const minValue = cleanNumber(valField.minValue)
    const maxValue = cleanNumber(valField.maxValue)
    const unitText = cleanString(valField.unitText)
    if (value === undefined && minValue === undefined && maxValue === undefined) return undefined
    return {
      currency: currency.toUpperCase(),
      ...(value !== undefined ? { value } : {}),
      ...(minValue !== undefined ? { minValue } : {}),
      ...(maxValue !== undefined ? { maxValue } : {}),
      ...(unitText ? { unitText } : {}),
    }
  }

  const direct = cleanNumber(valField)
  if (direct === undefined) return undefined
  const unitText = cleanString(raw.unitText)
  return {
    currency: currency.toUpperCase(),
    value: direct,
    ...(unitText ? { unitText } : {}),
  }
}

/**
 * Build a deterministic, plain-language factual summary when `abolSummaryText` is omitted.
 * Composes normalized facts in sentence case and respects the active language and calendar.
 */
export function composePlainSummary(
  fields: {
    title: string
    hiringOrganization?: JobOrganization
    employmentTypes: string[]
    location: JobLocationInfo
    baseSalary?: JobSalary
    validThrough?: string
  },
  lang?: string | null,
  calendar: JobCalendar = 'gregory',
): string {
  const ui = resolveUiLang(lang)
  const workType = formatEmploymentTypes(fields.employmentTypes, ui)
  const loc = formatLocation(fields.location, ui)
  const salary = formatSalary(fields.baseSalary, ui)
  const deadline = formatJobDate(fields.validThrough, ui, calendar)
  const isClosed = getDeadlineState(fields.validThrough) === 'closed'
  const org = fields.hiringOrganization?.name

  if (ui === 'am') {
    const ctxParts: string[] = []
    if (org) ctxParts.push(`በ${org}`)
    if (loc) ctxParts.push(loc)
    const ctx = ctxParts.join('፣ ')
    const typePhrase = workType
      ? workType.startsWith('የ')
        ? `${workType} የሥራ ዕድል`
        : `የ${workType} የሥራ ዕድል`
      : 'የሥራ ዕድል'
    const first = ctx
      ? `${fields.title} ${ctx} ${typePhrase} ነው።`
      : `${fields.title} ${typePhrase} ነው።`

    if (isClosed) {
      return salary ? `${first} ክፍያው ${salary} ነበር። ማመልከቻው ተዘግቷል።` : `${first} ማመልከቻው ተዘግቷል።`
    }
    if (salary && deadline) {
      return `${first} ክፍያው ${salary} ሲሆን፣ እስከ ${deadline} ያመልክቱ።`
    }
    if (salary) {
      return `${first} ክፍያው ${salary} ነው።`
    }
    if (deadline) {
      return `${first} እስከ ${deadline} ያመልክቱ።`
    }
    return first
  }

  const lowerType = workType ? workType.toLowerCase() : ''
  const article = lowerType && /^[aeiou]/i.test(lowerType) ? 'an' : 'a'
  let first = lowerType ? `${fields.title} is ${article} ${lowerType} role` : `${fields.title} role`
  if (org) first += ` with ${org}`
  if (loc) {
    first += fields.location.remote ? `, ${loc.toLowerCase()}` : ` in ${loc}`
  }
  first += '.'

  if (isClosed) {
    return salary
      ? `${first} Pay was ${salary}. Applications are now closed.`
      : `${first} Applications are now closed.`
  }
  if (salary && deadline) {
    return `${first} Pay is ${salary}; apply by ${deadline}.`
  }
  if (salary) {
    return `${first} Pay is ${salary}.`
  }
  if (deadline) {
    return `${first} Apply by ${deadline}.`
  }
  return first
}

/**
 * Parse and validate a `schema.org/JobPosting` JSON string or object.
 * Strips any accommodation/disability keys per the privacy contract.
 */
export function parseJobPosting(input: unknown): NormalizedJobPosting {
  let raw: unknown = input
  if (typeof input === 'string') {
    raw = JSON.parse(input) as unknown
  }
  const sanitized = stripPrivacyFields(raw)
  const node = findJobPostingNode(sanitized)
  if (!node) {
    throw new Error('Expected a schema.org/JobPosting object')
  }

  const title = cleanString(node.title)
  if (!title) {
    throw new Error('JobPosting requires a non-empty "title"')
  }

  const rawDescription = cleanString(node.description) ?? ''
  const explicitSummary = cleanString(node.abolSummaryText)
  const description = stripHtmlToPlainText(rawDescription || explicitSummary || title)
  const hiringOrganization = parseOrganization(node.hiringOrganization)
  const audioSummaryUrl = cleanSafeUrl(node.abolAudioSummary)
  const employmentTypes = parseEmploymentTypes(node.employmentType)
  const location = parseLocation(node)
  const datePosted = cleanString(node.datePosted)
  const validThrough = cleanString(node.validThrough)
  const baseSalary = parseSalary(node.baseSalary)
  const url = cleanSafeUrl(node.url ?? node.applicationUrl)
  const id = cleanString(node['@id'] ?? node.identifier)
  const rawLang = cleanString(node.inLanguage)
  const inLanguage = rawLang ? sanitizeLangTag(rawLang) : undefined
  const directApply = typeof node.directApply === 'boolean' ? node.directApply : undefined

  const hasExplicitSummary = Boolean(explicitSummary)
  const summaryText = explicitSummary
    ? stripHtmlToPlainText(explicitSummary)
    : composePlainSummary(
        {
          title,
          ...(hiringOrganization ? { hiringOrganization } : {}),
          employmentTypes,
          location,
          ...(baseSalary ? { baseSalary } : {}),
          ...(validThrough ? { validThrough } : {}),
        },
        inLanguage,
      )

  return {
    ...(id ? { id } : {}),
    title,
    description,
    summaryText,
    hasExplicitSummary,
    ...(audioSummaryUrl ? { audioSummaryUrl } : {}),
    ...(hiringOrganization ? { hiringOrganization } : {}),
    employmentTypes,
    location,
    ...(datePosted ? { datePosted } : {}),
    ...(validThrough ? { validThrough } : {}),
    ...(baseSalary ? { baseSalary } : {}),
    ...(url ? { url } : {}),
    ...(directApply !== undefined ? { directApply } : {}),
    ...(inLanguage ? { inLanguage } : {}),
  }
}

export function formatEmploymentTypes(types: string[], lang?: string | null): string {
  if (types.length === 0) return ''
  const labels = types.map((raw) => {
    const normalized = raw.trim().toUpperCase().replace(/\s+/g, '_')
    const mapped = EMPLOYMENT_MAP[normalized]
    if (mapped) return jt(lang, mapped)
    const cleaned = raw.trim().replace(/[_-]+/g, ' ').toLowerCase()
    return cleaned ? cleaned.charAt(0).toUpperCase() + cleaned.slice(1) : raw
  })
  return formatList(labels, lang)
}

function expandCountry(codeOrName: string | undefined, lang?: string | null): string | undefined {
  if (!codeOrName) return undefined
  const ui = resolveUiLang(lang)
  const upper = codeOrName.trim().toUpperCase()
  const known = COUNTRY_NAMES[upper]
  if (known) return known[ui]
  return codeOrName
}

function formatSinglePlace(place: JobPlace, lang?: string | null): string {
  const parts: string[] = []
  if (place.locality) parts.push(place.locality)
  if (place.region && place.region.toLowerCase() !== place.locality?.toLowerCase()) {
    parts.push(place.region)
  }
  const country = expandCountry(place.country, lang)
  if (country && country.toLowerCase() !== place.locality?.toLowerCase()) {
    parts.push(country)
  }
  return parts.join(resolveUiLang(lang) === 'am' ? '፣ ' : ', ')
}

export function formatLocation(location: JobLocationInfo, lang?: string | null): string {
  const places: JobPlace[] =
    location.places && location.places.length > 0
      ? location.places
      : location.locality || location.region || location.country
        ? [
            {
              ...(location.locality ? { locality: location.locality } : {}),
              ...(location.region ? { region: location.region } : {}),
              ...(location.country ? { country: location.country } : {}),
            },
          ]
        : []

  const placeText = formatList(places.map((p) => formatSinglePlace(p, lang)).filter(Boolean), lang)

  const applicantList =
    location.applicantLocations && location.applicantLocations.length > 0
      ? location.applicantLocations
      : location.applicantLocation
        ? [location.applicantLocation]
        : []
  const applicantText = formatList(
    applicantList.map((c) => expandCountry(c, lang)).filter((c): c is string => Boolean(c)),
    lang,
  )

  if (location.remote) {
    const scope = applicantText || placeText
    return scope ? jt(lang, 'remoteIn', { place: scope }) : jt(lang, 'remote')
  }
  if (placeText) return placeText
  if (applicantText) return applicantText
  return ''
}

export function formatSalary(salary: JobSalary | undefined, lang?: string | null): string {
  if (!salary) return ''
  const ui = resolveUiLang(lang)
  const locale = ui === 'am' ? 'am-ET' : 'en-US'
  const currency = salary.currency.toUpperCase()

  const fmtDigits = (n: number): string =>
    new Intl.NumberFormat(locale, {
      maximumFractionDigits: Number.isInteger(n) ? 0 : 2,
    }).format(n)

  const hasRange =
    salary.minValue !== undefined &&
    salary.maxValue !== undefined &&
    salary.minValue !== salary.maxValue
  const singleVal =
    salary.value ??
    (salary.minValue !== undefined && salary.minValue === salary.maxValue
      ? salary.minValue
      : (salary.minValue ?? salary.maxValue))

  if (!hasRange && singleVal === undefined) return ''

  const unitKey = salary.unitText
    ? SALARY_UNIT_MAP[salary.unitText.trim().toUpperCase()]
    : undefined
  const unitLabel = unitKey
    ? jt(lang, unitKey)
    : salary.unitText
      ? salary.unitText.toLowerCase()
      : ''

  if (ui === 'am') {
    const currLabel = currency === 'ETB' ? 'ብር' : currency
    const amount = hasRange
      ? `ከ${fmtDigits(salary.minValue!)} እስከ ${fmtDigits(salary.maxValue!)} ${currLabel}`
      : `${fmtDigits(singleVal!)} ${currLabel}`
    return unitLabel ? `${unitLabel} ${amount}` : amount
  }

  const amount = hasRange
    ? `${fmtDigits(salary.minValue!)}–${fmtDigits(salary.maxValue!)} ${currency}`
    : `${fmtDigits(singleVal!)} ${currency}`
  return unitLabel ? `${amount} ${unitLabel}` : amount
}

export function isValidIsoDate(iso: string | undefined): boolean {
  if (!iso) return false
  return parseIsoDate(iso) !== null
}

function parseIsoDate(iso: string): { date: Date; dateOnly: boolean } | null {
  const trimmed = iso.trim()
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    const [y, m, d] = trimmed.split('-').map(Number)
    if (!y || !m || !d) return null
    const date = new Date(Date.UTC(y, m - 1, d, 12, 0, 0))
    if (
      Number.isNaN(date.getTime()) ||
      date.getUTCFullYear() !== y ||
      date.getUTCMonth() !== m - 1 ||
      date.getUTCDate() !== d
    ) {
      return null
    }
    return { date, dateOnly: true }
  }
  const date = new Date(trimmed)
  return Number.isNaN(date.getTime()) ? null : { date, dateOnly: false }
}

/**
 * Format an ISO date/datetime with `Intl.DateTimeFormat`.
 * Supports optional Ethiopian calendar (`calendar = 'ethiopic'`), replacing ambiguous
 * English `"AM"` (*Amete Mihret*) era markers with unambiguous `"E.C."` / `"ዓ.ም."`.
 */
export function formatJobDate(
  iso: string | undefined,
  lang?: string | null,
  calendar: JobCalendar = 'gregory',
): string {
  if (!iso) return ''
  const parsed = parseIsoDate(iso)
  if (!parsed) return iso

  const ui = resolveUiLang(lang)
  const baseLocale = ui === 'am' ? 'am-ET' : 'en-GB'
  const locale = calendar === 'ethiopic' ? `${baseLocale}-u-ca-ethiopic` : baseLocale

  try {
    const formatter = new Intl.DateTimeFormat(locale, {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      ...(parsed.dateOnly ? { timeZone: 'UTC' } : {}),
    })
    if (calendar !== 'ethiopic') {
      return formatter.format(parsed.date)
    }
    const core = formatter
      .formatToParts(parsed.date)
      .filter((part) => part.type !== 'era')
      .map((part) => part.value)
      .join('')
      .replace(/\s{2,}/g, ' ')
      .trim()
    return ui === 'am' ? `${core} ዓ.ም.` : `${core} E.C.`
  } catch {
    return new Intl.DateTimeFormat(baseLocale, {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      ...(parsed.dateOnly ? { timeZone: 'UTC' } : {}),
    }).format(parsed.date)
  }
}

function deadlineEndMs(validThrough: string): number | null {
  const parsed = parseIsoDate(validThrough)
  if (!parsed) return null
  return parsed.dateOnly
    ? Date.UTC(
        parsed.date.getUTCFullYear(),
        parsed.date.getUTCMonth(),
        parsed.date.getUTCDate(),
        23,
        59,
        59,
        999,
      )
    : parsed.date.getTime()
}

export function getDeadlineState(
  validThrough: string | undefined,
  now: Date = new Date(),
): JobDeadlineState {
  if (!validThrough) return 'open'
  const endMs = deadlineEndMs(validThrough)
  if (endMs === null) return 'open'

  const diff = endMs - now.getTime()
  if (diff < 0) return 'closed'
  if (diff <= CLOSING_SOON_DAYS * DAY_MS) return 'closing-soon'
  return 'open'
}

/** Humanized deadline status copy for closing-soon and closed states (never colour alone). */
export function formatDeadlineStatus(
  validThrough: string | undefined,
  lang?: string | null,
  now: Date = new Date(),
): string {
  const state = getDeadlineState(validThrough, now)
  if (state === 'closed') return jt(lang, 'statusClosed')
  if (state === 'open') return jt(lang, 'statusOpen')
  if (!validThrough) return jt(lang, 'statusClosingSoon')

  const endMs = deadlineEndMs(validThrough)
  if (endMs === null) return jt(lang, 'statusClosingSoon')

  const remainingMs = Math.max(0, endMs - now.getTime())
  const daysLeft = Math.floor(remainingMs / DAY_MS)
  if (daysLeft === 0) return jt(lang, 'statusClosingToday')
  if (daysLeft === 1) return jt(lang, 'statusClosingOneDay')
  return jt(lang, 'statusClosingDays', { days: daysLeft })
}

function placeToJsonLd(place: JobPlace): Record<string, unknown> {
  return {
    '@type': 'Place',
    address: {
      '@type': 'PostalAddress',
      ...(place.locality ? { addressLocality: place.locality } : {}),
      ...(place.region ? { addressRegion: place.region } : {}),
      ...(place.country ? { addressCountry: place.country } : {}),
    },
  }
}

/**
 * Serialize a normalized job posting into clean, strictly valid `schema.org/JobPosting` JSON-LD
 * with zero non-standard warnings in Schema Markup Validator / Rich Results Test.
 */
export function toJobPostingJsonLd(job: NormalizedJobPosting): Record<string, unknown> {
  const ld: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'JobPosting',
    title: job.title,
    description: job.description,
  }

  if (job.id) ld['@id'] = job.id
  if (job.datePosted) ld.datePosted = job.datePosted
  if (job.validThrough) ld.validThrough = job.validThrough

  if (job.employmentTypes.length === 1) {
    ld.employmentType = job.employmentTypes[0]
  } else if (job.employmentTypes.length > 1) {
    ld.employmentType = job.employmentTypes
  }

  if (job.hiringOrganization) {
    ld.hiringOrganization = {
      '@type': 'Organization',
      name: job.hiringOrganization.name,
      ...(job.hiringOrganization.sameAs ? { sameAs: job.hiringOrganization.sameAs } : {}),
      ...(job.hiringOrganization.logo ? { logo: job.hiringOrganization.logo } : {}),
    }
  }

  if (job.location.remote) {
    ld.jobLocationType = 'TELECOMMUTE'
  }

  const places: JobPlace[] =
    job.location.places && job.location.places.length > 0
      ? job.location.places
      : job.location.locality || job.location.region || job.location.country
        ? [
            {
              ...(job.location.locality ? { locality: job.location.locality } : {}),
              ...(job.location.region ? { region: job.location.region } : {}),
              ...(job.location.country ? { country: job.location.country } : {}),
            },
          ]
        : []

  if (places.length === 1) {
    ld.jobLocation = placeToJsonLd(places[0]!)
  } else if (places.length > 1) {
    ld.jobLocation = places.map((p) => placeToJsonLd(p))
  }

  const appLocs =
    job.location.applicantLocations && job.location.applicantLocations.length > 0
      ? job.location.applicantLocations
      : job.location.applicantLocation
        ? [job.location.applicantLocation]
        : []

  if (appLocs.length === 1) {
    ld.applicantLocationRequirements = { '@type': 'Country', name: appLocs[0]! }
  } else if (appLocs.length > 1) {
    ld.applicantLocationRequirements = appLocs.map((name) => ({ '@type': 'Country', name }))
  }

  if (job.baseSalary) {
    const quant: Record<string, unknown> = {
      '@type': 'QuantitativeValue',
      ...(job.baseSalary.value !== undefined ? { value: job.baseSalary.value } : {}),
      ...(job.baseSalary.minValue !== undefined ? { minValue: job.baseSalary.minValue } : {}),
      ...(job.baseSalary.maxValue !== undefined ? { maxValue: job.baseSalary.maxValue } : {}),
      ...(job.baseSalary.unitText ? { unitText: job.baseSalary.unitText } : {}),
    }
    ld.baseSalary = {
      '@type': 'MonetaryAmount',
      currency: job.baseSalary.currency,
      value: quant,
    }
  }

  if (job.url) ld.url = job.url
  if (job.directApply !== undefined) ld.directApply = job.directApply
  if (job.inLanguage) ld.inLanguage = job.inLanguage

  return ld
}

/** Safely serialize JSON-LD for embedding inside `<script type="application/ld+json">`. */
export function serializeJsonLdScript(job: NormalizedJobPosting): string {
  return JSON.stringify(toJobPostingJsonLd(job), null, 2).replace(/</g, '\\u003c')
}
