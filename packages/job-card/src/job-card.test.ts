import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import {
  composePlainSummary,
  formatDeadlineStatus,
  formatEmploymentTypes,
  formatJobDate,
  formatLocation,
  formatSalary,
  getDeadlineState,
  isValidIsoDate,
  jt,
  parseDescriptionBlocks,
  parseJobPosting,
  sanitizeLangTag,
  serializeJsonLdScript,
  splitPlainParagraphs,
  stripHtmlToPlainText,
  toJobPostingJsonLd,
} from './index.ts'

const here = dirname(fileURLToPath(import.meta.url))
const spikeFixturePath = join(here, '../../../spikes/14-open-badges/fixtures/job-posting.json')

describe('@abolkit/job-card schema, plain-language copy & JSON-LD', () => {
  it('parses the Spike #14 JobPosting fixture and round-trips strictly valid schema.org JSON-LD', () => {
    const rawJson = readFileSync(spikeFixturePath, 'utf8')
    const job = parseJobPosting(rawJson)

    expect(job.title).toBe('Junior Accessibility Engineer')
    expect(job.hiringOrganization?.name).toBe('Abol Kit Demo Employer')
    expect(job.hiringOrganization?.sameAs).toBe('https://abolkit.local')
    expect(job.employmentTypes).toEqual(['FULL_TIME'])
    expect(job.location.locality).toBe('Addis Ababa')
    expect(job.location.country).toBe('ET')
    expect(job.location.applicantLocation).toBe('Ethiopia')
    expect(job.baseSalary).toEqual({
      currency: 'ETB',
      value: 25000,
      unitText: 'MONTH',
    })
    expect(job.hasExplicitSummary).toBe(true)
    expect(job.summaryText).toContain('Junior Accessibility Engineer in Addis Ababa')
    expect(job.audioSummaryUrl).toBe('/samples/job-summary.opus')

    const ld = toJobPostingJsonLd(job)
    expect(ld['@context']).toBe('https://schema.org')
    expect(ld['@type']).toBe('JobPosting')
    expect(ld.title).toBe('Junior Accessibility Engineer')
    expect(ld.employmentType).toBe('FULL_TIME')
    expect(ld.datePosted).toBe('2026-11-14')
    expect(ld.validThrough).toBe('2026-12-31T23:59:59+03:00')
    // Emitted JSON-LD uses only standard schema.org properties (no custom extension warnings)
    expect(ld.abolSummaryText).toBeUndefined()
    expect(ld.abolAudioSummary).toBeUndefined()
    expect(ld.hiringOrganization).toEqual({
      '@type': 'Organization',
      name: 'Abol Kit Demo Employer',
      sameAs: 'https://abolkit.local',
    })

    const scriptText = serializeJsonLdScript(job)
    expect(() => JSON.parse(scriptText)).not.toThrow()
  })

  it('supports JSON-LD @graph wrappers, semantic description blocks, and natural list conjunctions', () => {
    const job = parseJobPosting({
      '@context': 'https://schema.org',
      '@graph': [
        { '@type': 'WebPage', name: 'Careers' },
        {
          '@type': 'JobPosting',
          title: 'Frontend Accessibility Fellow',
          description:
            '<p>Build clear learning tools.</p><ul><li>Test with keyboard</li><li>Check 200% zoom</li></ul>',
          employmentType: ['PART_TIME', 'INTERN'],
          jobLocationType: 'TELECOMMUTE',
          applicantLocationRequirements: { '@type': 'Country', name: 'ET' },
        },
      ],
    })

    expect(job.title).toBe('Frontend Accessibility Fellow')
    expect(job.description).not.toContain('<p>')
    expect(splitPlainParagraphs(job.description).length).toBeGreaterThanOrEqual(2)

    const blocks = parseDescriptionBlocks(job.description)
    expect(blocks).toEqual([
      { kind: 'p', text: 'Build clear learning tools.' },
      { kind: 'ul', items: ['Test with keyboard', 'Check 200% zoom'] },
    ])

    expect(formatEmploymentTypes(job.employmentTypes, 'en')).toBe('Part-time and Internship')
    expect(formatEmploymentTypes(job.employmentTypes, 'en')).not.toContain('·')
    expect(formatLocation(job.location, 'en')).toBe('Remote in Ethiopia')
    expect(formatLocation(job.location, 'am')).toBe('በኢትዮጵያ ውስጥ በርቀት')
  })

  it('preserves and formats multiple jobLocation entries and round-trips them in JSON-LD', () => {
    const job = parseJobPosting({
      '@context': 'https://schema.org',
      '@type': 'JobPosting',
      title: 'Graduate Field Coordinator',
      description: 'Support partner campuses.',
      jobLocation: [
        {
          '@type': 'Place',
          address: {
            '@type': 'PostalAddress',
            addressLocality: 'Addis Ababa',
            addressCountry: 'ET',
          },
        },
        {
          '@type': 'Place',
          address: {
            '@type': 'PostalAddress',
            addressLocality: 'Hawassa',
            addressCountry: 'ET',
          },
        },
      ],
    })

    expect(job.location.places).toHaveLength(2)
    const locEn = formatLocation(job.location, 'en')
    expect(locEn).toContain('Addis Ababa')
    expect(locEn).toContain('Hawassa')
    expect(locEn).not.toContain('·')

    const ld = toJobPostingJsonLd(job)
    expect(Array.isArray(ld.jobLocation)).toBe(true)
    expect((ld.jobLocation as unknown[]).length).toBe(2)
  })

  it('composes humanized plain-language summaries synced with language and calendar', () => {
    const enJob = parseJobPosting({
      '@type': 'JobPosting',
      title: 'Junior Data Quality Analyst',
      description: 'Detailed internal description.',
      employmentType: 'FULL_TIME',
      hiringOrganization: { '@type': 'Organization', name: 'Blue Nile Learning Services' },
      jobLocation: {
        '@type': 'Place',
        address: { addressLocality: 'Addis Ababa', addressCountry: 'ET' },
      },
      baseSalary: {
        '@type': 'MonetaryAmount',
        currency: 'ETB',
        value: {
          '@type': 'QuantitativeValue',
          minValue: 20000,
          maxValue: 26000,
          unitText: 'MONTH',
        },
      },
      validThrough: '2099-12-20',
    })

    expect(enJob.hasExplicitSummary).toBe(false)
    expect(enJob.summaryText).toContain(
      'Junior Data Quality Analyst is a full-time role with Blue Nile Learning Services in Addis Ababa, Ethiopia.',
    )
    expect(enJob.summaryText).toContain('Pay is 20,000–26,000 ETB per month')
    expect(enJob.summaryText).not.toContain('—')

    const ethiopicSummary = composePlainSummary(enJob, 'en', 'ethiopic')
    expect(ethiopicSummary).toContain('E.C.')
    expect(ethiopicSummary).not.toMatch(/\bAM\b/)

    const amSummary = composePlainSummary(
      {
        title: 'ጀማሪ የሶፍትዌር ሙከራ ባለሙያ',
        hiringOrganization: { name: 'ሲዳማ ዲጂታል ሶሉሽንስ' },
        employmentTypes: ['FULL_TIME'],
        location: { locality: 'ሐዋሳ', country: 'ET' },
        baseSalary: { currency: 'ETB', minValue: 22000, maxValue: 28000, unitText: 'MONTH' },
        validThrough: '2099-12-30',
      },
      'am-ET',
      'ethiopic',
    )
    expect(amSummary).toContain('ጀማሪ የሶፍትዌር ሙከራ ባለሙያ')
    expect(amSummary).toContain('በወር ከ22,000 እስከ 28,000 ብር')
    expect(amSummary).toContain('ዓ.ም.')
  })

  it('enforces the privacy rule: strips accommodation, disability, and medical fields recursively', () => {
    const job = parseJobPosting({
      '@context': 'https://schema.org',
      '@type': 'JobPosting',
      title: 'Backend Developer',
      description: 'Work on TypeScript APIs and queues.',
      disabilityStatus: 'confidential',
      accommodationRequest: 'screen reader',
      healthConditionNote: 'private',
      accommodationNotes: { details: 'must never be stored or emitted' },
    })

    const serialized = serializeJsonLdScript(job)
    expect(serialized).not.toContain('confidential')
    expect(serialized).not.toContain('accommodation')
    expect(serialized).not.toContain('disability')
    expect(serialized).not.toContain('healthCondition')
  })

  it('escapes closing script sequences safely in JSON-LD output', () => {
    const job = parseJobPosting({
      '@type': 'JobPosting',
      title: 'Security Reviewer',
      description: 'Plain text safe check',
      abolSummaryText: 'Safe summary',
      url: 'https://example.org/jobs/1?x=</script>',
    })

    const script = serializeJsonLdScript(job)
    expect(script).not.toContain('</script>')
    expect(JSON.parse(script).url).toBe('https://example.org/jobs/1?x=</script>')
  })

  it('rejects unsafe javascript: URLs and non-JobPosting payloads', () => {
    const job = parseJobPosting({
      '@type': 'JobPosting',
      title: 'QA Analyst',
      description: 'Test web components.',
      url: 'javascript:alert(1)',
      abolAudioSummary: 'javascript:evil()',
    })
    expect(job.url).toBeUndefined()
    expect(job.audioSummaryUrl).toBeUndefined()

    expect(() => parseJobPosting({ '@type': 'Person', name: 'Selam' })).toThrow(/JobPosting/)
    expect(() => parseJobPosting({ '@type': 'JobPosting', title: '   ' })).toThrow(/title/)
  })

  it('parses safe abolAudioSummary URLs and keeps audio i18n keys in sync (en/am)', () => {
    const relative = parseJobPosting({
      '@type': 'JobPosting',
      title: 'Caption Reviewer',
      description: 'Review Amharic captions.',
      abolAudioSummary: './samples/job-summary.wav',
    })
    expect(relative.audioSummaryUrl).toBe('./samples/job-summary.wav')

    const absolute = parseJobPosting({
      '@type': 'JobPosting',
      title: 'Caption Reviewer',
      description: 'Review Amharic captions.',
      abolAudioSummary: 'https://cdn.example.org/jobs/summary.wav',
    })
    expect(absolute.audioSummaryUrl).toBe('https://cdn.example.org/jobs/summary.wav')

    const dataUri = parseJobPosting({
      '@type': 'JobPosting',
      title: 'Caption Reviewer',
      description: 'Review Amharic captions.',
      abolAudioSummary: 'data:audio/wav;base64,AAA',
    })
    expect(dataUri.audioSummaryUrl).toBeUndefined()

    expect(jt('en', 'audioSummaryLabel')).toMatch(/Audio summary/i)
    expect(jt('en', 'audioSummaryPlay')).toMatch(/Listen/i)
    expect(jt('en', 'audioSummaryPause')).toMatch(/Pause/i)
    expect(jt('en', 'audioLoading')).toMatch(/Loading/i)
    expect(jt('en', 'audioUnavailable')).toMatch(/summary above/i)
    expect(jt('am', 'audioSummaryLabel')).toBeTruthy()
    expect(jt('am', 'audioSummaryPlay')).toBeTruthy()
    expect(jt('am', 'audioLoading')).toBeTruthy()
    expect(jt('am', 'audioUnavailable')).toBeTruthy()
  })

  /*
   * Manual demo checks (happy-dom/jsdom custom-element audio not wired here):
   * 1. Open packages/job-card/demo/index.html after `pnpm --filter @abolkit/job-card build`
   * 2. Hero card shows listen strip; play/pause toggles aria-pressed and fires abol:summary-play
   * 3. “More postings” cards have no listen control (text-only)
   * 4. Break the WAV path → note appears, live region announces, summary text remains
   */

  it('computes open, closing-soon, and closed deadline states and humanized countdown text', () => {
    const now = new Date('2026-11-15T10:00:00Z')
    expect(getDeadlineState('2026-12-31T23:59:59+03:00', now)).toBe('open')
    expect(getDeadlineState('2026-11-19', now)).toBe('closing-soon')
    expect(getDeadlineState('2026-11-10', now)).toBe('closed')
    expect(getDeadlineState(undefined, now)).toBe('open')

    expect(formatDeadlineStatus('2026-11-15', 'en', now)).toBe('Closes today')
    expect(formatDeadlineStatus('2026-11-16', 'en', now)).toBe('Closing soon: 1 day left')
    expect(formatDeadlineStatus('2026-11-19', 'en', now)).toBe('Closing soon: 4 days left')
    expect(formatDeadlineStatus('2026-11-10', 'am', now)).toBe('ማመልከቻው ተዘግቷል')
  })

  it('formats dates cleanly with E.C. / ዓ.ም., preserves BCP-47 tags, and formats ETB pay', () => {
    const greg = formatJobDate('2026-11-14', 'en', 'gregory')
    const ethiopicEn = formatJobDate('2026-11-14', 'en', 'ethiopic')
    const ethiopicAm = formatJobDate('2026-11-14', 'am-ET', 'ethiopic')
    expect(greg).toContain('2026')
    expect(ethiopicEn).toContain('E.C.')
    expect(ethiopicEn).not.toMatch(/\bAM\b/)
    expect(ethiopicAm).toContain('ዓ.ም.')
    expect(isValidIsoDate('2026-11-14')).toBe(true)
    expect(isValidIsoDate('2026-02-30')).toBe(false)

    expect(sanitizeLangTag('am-ET')).toBe('am-ET')
    expect(sanitizeLangTag('invalid tag!!', 'en')).toBe('en')

    expect(
      formatSalary({ currency: 'ETB', minValue: 20000, maxValue: 30000, unitText: 'MONTH' }, 'en'),
    ).toBe('20,000–30,000 ETB per month')
    expect(formatSalary({ currency: 'ETB', value: 25000, unitText: 'MONTH' }, 'am')).toBe(
      'በወር 25,000 ብር',
    )
    expect(jt('am-ET', 'applyButton')).toBe('ለዚህ ሥራ ያመልክቱ')
    expect(stripHtmlToPlainText('<div>Hello   <b>world</b>!</div>')).toBe('Hello world !')
  })
})
