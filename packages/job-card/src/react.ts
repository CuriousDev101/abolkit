/**
 * Optional React helper for `<abol-job-card>`.
 * Import from `@abolkit/job-card/react` (peer dependency: react >= 17).
 */
import {
  createElement,
  forwardRef,
  useEffect,
  useRef,
  type CSSProperties,
  type ReactElement,
  type ReactNode,
} from 'react'
import {
  JOB_CARD_TAG,
  registerAbolJobCard,
  type AbolJobCardElement,
  type JobApplyEventDetail,
  type SummaryPlayEventDetail,
} from './job-card-element.ts'

registerAbolJobCard()

export type AbolJobCardProps = {
  jobUrl?: string
  src?: string
  lang?: string
  calendar?: string
  headingLevel?: 2 | 3 | 4 | 5 | 6 | string | number
  audioSummaryApi?: string
  className?: string
  style?: CSSProperties
  children?: ReactNode
  job?: unknown
  onJobApply?: (detail: JobApplyEventDetail) => void
  onSummaryPlay?: (detail: SummaryPlayEventDetail) => void
}

/** React wrapper: syncs props to attributes/properties and forwards custom events. */
export const AbolJobCard = forwardRef<AbolJobCardElement, AbolJobCardProps>(
  function AbolJobCard(props, ref): ReactElement {
    const {
      jobUrl,
      src,
      lang,
      calendar,
      headingLevel,
      audioSummaryApi,
      className,
      style,
      children,
      job,
      onJobApply,
      onSummaryPlay,
    } = props

    const localRef = useRef<AbolJobCardElement | null>(null)

    useEffect(() => {
      const el = localRef.current
      if (!el) return

      const setOrRemove = (name: string, value: string | undefined) => {
        if (value === undefined || value === '') el.removeAttribute(name)
        else el.setAttribute(name, value)
      }

      setOrRemove('job-url', jobUrl)
      setOrRemove('src', src)
      setOrRemove('lang', lang)
      setOrRemove('calendar', calendar)
      setOrRemove(
        'heading-level',
        headingLevel === undefined || headingLevel === '' ? undefined : String(headingLevel),
      )
      setOrRemove('audio-summary-api', audioSummaryApi)

      if (job !== undefined) el.job = job
    }, [jobUrl, src, lang, calendar, headingLevel, audioSummaryApi, job])

    useEffect(() => {
      const el = localRef.current
      if (!el) return

      const onApply = (event: Event) => {
        onJobApply?.((event as CustomEvent<JobApplyEventDetail>).detail)
      }
      const onPlay = (event: Event) => {
        onSummaryPlay?.((event as CustomEvent<SummaryPlayEventDetail>).detail)
      }

      el.addEventListener('abol:job-apply', onApply)
      el.addEventListener('abol:summary-play', onPlay)
      return () => {
        el.removeEventListener('abol:job-apply', onApply)
        el.removeEventListener('abol:summary-play', onPlay)
      }
    }, [onJobApply, onSummaryPlay])

    return createElement(
      JOB_CARD_TAG,
      {
        className,
        style,
        ref: (node: AbolJobCardElement | null) => {
          localRef.current = node
          if (typeof ref === 'function') ref(node)
          else if (ref) ref.current = node
        },
      },
      children,
    )
  },
)

export type { AbolJobCardElement, JobApplyEventDetail, SummaryPlayEventDetail }
