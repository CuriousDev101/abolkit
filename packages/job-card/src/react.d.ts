import type { CSSProperties, ForwardRefExoticComponent, ReactNode, RefAttributes } from 'react'
import type {
  AbolJobCardElement,
  JobApplyEventDetail,
  JobCalendar,
  NormalizedJobPosting,
  SummaryPlayEventDetail,
} from './abol-job-card.js'

export type AbolJobCardProps = {
  jobUrl?: string
  src?: string
  lang?: string
  calendar?: JobCalendar | string
  headingLevel?: 2 | 3 | 4 | 5 | 6 | string | number
  audioSummaryApi?: string
  className?: string
  style?: CSSProperties
  children?: ReactNode
  job?: unknown
  onJobApply?: (detail: JobApplyEventDetail) => void
  onSummaryPlay?: (detail: SummaryPlayEventDetail) => void
}

export declare const AbolJobCard: ForwardRefExoticComponent<
  AbolJobCardProps & RefAttributes<AbolJobCardElement>
>

export type { AbolJobCardElement, JobApplyEventDetail, NormalizedJobPosting, SummaryPlayEventDetail }
