import { resolveUiLang, type UiLang } from '@abolkit/core'

const EN = {
  loading: 'Loading job details',
  errorLoad: 'Job details could not be loaded. Check the link and try again.',
  errorInvalid: 'This job posting is missing required details. Check the job data.',
  summaryHeading: 'Plain-language summary',
  factsHeading: 'Key facts',
  detailsHeading: 'About this role',
  readFullDescription: 'Read the full description',
  organization: 'Employer',
  location: 'Location',
  remote: 'Remote',
  remoteIn: 'Remote in {place}',
  jobType: 'Work type',
  salary: 'Pay',
  datePosted: 'Posted',
  deadline: 'Apply by',
  statusOpen: 'Open for applications',
  statusClosingSoon: 'Closing soon',
  statusClosingToday: 'Closes today',
  statusClosingOneDay: 'Closing soon: 1 day left',
  statusClosingDays: 'Closing soon: {days} days left',
  statusClosed: 'Applications closed',
  applyButton: 'Apply for this role',
  applyClosed: 'Applications closed',
  applyAnnounce: 'Application options opened for {title}.',
  visitEmployer: 'About {employer}',
  visitEmployerGeneric: 'Employer website',
  opensNewTab: 'opens in a new tab',
  audioSummaryLabel: 'Audio summary',
  audioSummaryPlay: 'Listen to the summary',
  audioSummaryPause: 'Pause summary',
  audioLoading: 'Loading audio…',
  audioUnavailable: 'Audio isn’t available right now. The summary above has the same words.',
  fullTime: 'Full-time',
  partTime: 'Part-time',
  contract: 'Contract',
  contractor: 'Contractor',
  temporary: 'Temporary',
  intern: 'Internship',
  volunteer: 'Volunteer',
  perDiem: 'Daily work',
  otherType: 'Other',
  perHour: 'per hour',
  perDay: 'per day',
  perWeek: 'per week',
  perMonth: 'per month',
  perYear: 'per year',
} as const

export type JobCardStringKey = keyof typeof EN

const AM: Record<JobCardStringKey, string> = {
  loading: 'የሥራው ዝርዝር እየተጫነ ነው',
  errorLoad: 'የሥራውን ዝርዝር መጫን አልተቻለም። አገናኙን ያረጋግጡና እንደገና ይሞክሩ።',
  errorInvalid: 'በዚህ የሥራ ማስታወቂያ ውስጥ አስፈላጊ መረጃ ይጎድላል። የሥራውን መረጃ ያረጋግጡ።',
  summaryHeading: 'አጭርና ግልጽ ማጠቃለያ',
  factsHeading: 'ዋና መረጃዎች',
  detailsHeading: 'ስለ ሥራው',
  readFullDescription: 'ሙሉ መግለጫውን ያንብቡ',
  organization: 'ቀጣሪ',
  location: 'ቦታ',
  remote: 'በርቀት',
  remoteIn: 'በ{place} ውስጥ በርቀት',
  jobType: 'የሥራ ዓይነት',
  salary: 'ክፍያ',
  datePosted: 'የተለጠፈበት ቀን',
  deadline: 'የማመልከቻ መጨረሻ',
  statusOpen: 'ማመልከቻው ክፍት ነው',
  statusClosingSoon: 'በቅርቡ ይዘጋል',
  statusClosingToday: 'ዛሬ ይዘጋል',
  statusClosingOneDay: 'በቅርቡ ይዘጋል፦ 1 ቀን ቀርቷል',
  statusClosingDays: 'በቅርቡ ይዘጋል፦ {days} ቀናት ቀርተዋል',
  statusClosed: 'ማመልከቻው ተዘግቷል',
  applyButton: 'ለዚህ ሥራ ያመልክቱ',
  applyClosed: 'ማመልከቻው ተዘግቷል',
  applyAnnounce: 'ለ{title} የማመልከቻ አማራጮች ተከፍተዋል።',
  visitEmployer: 'ስለ {employer}',
  visitEmployerGeneric: 'የቀጣሪው ድረ ገጽ',
  opensNewTab: 'በአዲስ ትር ይከፈታል',
  audioSummaryLabel: 'የድምፅ ማጠቃለያ',
  audioSummaryPlay: 'ማጠቃለያውን ያዳምጡ',
  audioSummaryPause: 'ማጠቃለያውን ለአፍታ ያቁሙ',
  audioLoading: 'ድምፅ እየተጫነ ነው…',
  audioUnavailable: 'የድምፅ ማጠቃለያው አሁን አልተገኘም። ከላይ ያለው ማጠቃለያ ተመሳሳይ ቃላት አሉት።',
  fullTime: 'የሙሉ ጊዜ',
  partTime: 'የትርፍ ጊዜ',
  contract: 'የውል ሥራ',
  contractor: 'የተቋራጭ ሥራ',
  temporary: 'ጊዜያዊ',
  intern: 'ልምምድ',
  volunteer: 'የበጎ ፈቃድ',
  perDiem: 'የቀን ሥራ',
  otherType: 'ሌላ',
  perHour: 'በሰዓት',
  perDay: 'በቀን',
  perWeek: 'በሳምንት',
  perMonth: 'በወር',
  perYear: 'በዓመት',
}

const TABLES: Record<UiLang, Record<JobCardStringKey, string>> = { en: EN, am: AM }

export function jt(
  lang: string | null | undefined,
  key: JobCardStringKey,
  vars?: Record<string, string | number>,
): string {
  const ui = resolveUiLang(lang)
  let template: string = TABLES[ui][key] ?? EN[key]
  if (vars) {
    for (const [k, v] of Object.entries(vars)) {
      template = template.replaceAll(`{${k}}`, String(v))
    }
  }
  return template
}

/** Validate and normalize a BCP-47 language tag while preserving regional subtags like `am-ET`. */
export function sanitizeLangTag(lang: string | null | undefined, fallback = 'en'): string {
  const trimmed = lang?.trim()
  if (!trimmed) return fallback
  return /^[a-zA-Z]{2,3}(?:-[a-zA-Z0-9]{2,8})*$/.test(trimmed) ? trimmed : fallback
}
