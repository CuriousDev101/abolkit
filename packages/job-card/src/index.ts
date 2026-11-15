// <abol-job-card> entry point. Owner: pair "ol" (pair "ab" reviews accessibility).
import { registerAbolJobCard } from './job-card-element.ts'

export type { JobCardStringKey } from './i18n.ts'
export { jt, sanitizeLangTag } from './i18n.ts'
export type { JobApplyEventDetail, SummaryPlayEventDetail } from './job-card-element.ts'
export { AbolJobCardElement, JOB_CARD_TAG, registerAbolJobCard } from './job-card-element.ts'
export type {
  DescriptionBlock,
  JobCalendar,
  JobDeadlineState,
  JobLocationInfo,
  JobOrganization,
  JobPlace,
  JobSalary,
  NormalizedJobPosting,
} from './schema.ts'
export {
  composePlainSummary,
  formatDeadlineStatus,
  formatEmploymentTypes,
  formatJobDate,
  formatLocation,
  formatSalary,
  getDeadlineState,
  isValidIsoDate,
  parseDescriptionBlocks,
  parseJobPosting,
  serializeJsonLdScript,
  splitPlainParagraphs,
  stripHtmlToPlainText,
  stripPrivacyFields,
  toJobPostingJsonLd,
} from './schema.ts'
export { JOB_CARD_CSS } from './styles.ts'

registerAbolJobCard()
