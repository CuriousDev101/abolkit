/**
 * Public typings for `@abolkit/job-card`.
 * Importing the package registers `<abol-job-card>` when `customElements` exists.
 */

export type JobCalendar = 'gregory' | 'ethiopic'

export interface NormalizedJobPosting {
  title: string
  description: string
  summaryText: string
  hasExplicitSummary: boolean
  url?: string
  id?: string
  audioSummaryUrl?: string
  employmentTypes: string[]
  datePosted?: string
  validThrough?: string
  hiringOrganization?: { name?: string; sameAs?: string }
  location: {
    locality?: string
    region?: string
    country?: string
    applicantLocation?: string
  }
  baseSalary?: {
    currency: string
    value?: number
    minValue?: number
    maxValue?: number
    unitText?: string
  }
}

export interface JobApplyEventDetail {
  job: NormalizedJobPosting
  jsonLd: Record<string, unknown>
  url?: string
}

export interface SummaryPlayEventDetail {
  playing: boolean
  src: string
  job: NormalizedJobPosting
}

export declare const JOB_CARD_TAG: 'abol-job-card'
export declare const JOB_CARD_CSS: string

export declare class AbolJobCardElement extends HTMLElement {
  static observedAttributes: string[]
  get job(): NormalizedJobPosting | null
  set job(value: unknown)
  get src(): string
  set src(value: string)
  get jobUrl(): string
  set jobUrl(value: string)
  get lang(): string
  set lang(value: string)
  get calendar(): string
  set calendar(value: string)
  get audioSummaryApi(): string
  set audioSummaryApi(value: string)
}

export declare function registerAbolJobCard(tagName?: string): void

export type JobExtractSource = 'json' | 'json-ld' | 'html'
export type JobRemoteParseResult = {
  job: NormalizedJobPosting
  jsonLd: Record<string, unknown>
  extractedFrom: JobExtractSource
}

export declare function extractJsonLdDocuments(html: string): unknown[]
export declare function scrapeJobPostingFromHtml(
  html: string,
  pageUrl?: string,
): Record<string, unknown>
export declare function parseJobPostingFromRemote(
  body: string,
  contentType?: string,
  pageUrl?: string,
): JobRemoteParseResult
export declare function parseJobPosting(input: unknown): NormalizedJobPosting
export declare function toJobPostingJsonLd(job: NormalizedJobPosting): Record<string, unknown>
export declare function serializeJsonLdScript(job: NormalizedJobPosting): string

declare global {
  interface HTMLElementTagNameMap {
    'abol-job-card': AbolJobCardElement
  }

  interface HTMLElementEventMap {
    'abol:job-apply': CustomEvent<JobApplyEventDetail>
    'abol:summary-play': CustomEvent<SummaryPlayEventDetail>
  }
}

/** Intrinsic element props for JSX hosts (React / Preact / Solid). */
export type AbolJobCardJSXProps = {
  src?: string
  'job-url'?: string
  lang?: string
  calendar?: JobCalendar | string
  'heading-level'?: string | number
  'audio-summary-api'?: string
  children?: unknown
  class?: string
  className?: string
  style?: unknown
  ref?: unknown
}

declare namespace React {
  namespace JSX {
    interface IntrinsicElements {
      'abol-job-card': AbolJobCardJSXProps
    }
  }
}

declare namespace JSX {
  interface IntrinsicElements {
    'abol-job-card': AbolJobCardJSXProps
  }
}

export {}
