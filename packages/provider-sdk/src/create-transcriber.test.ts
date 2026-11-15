import { describe, expect, it } from 'vitest'

import { createTranscriber, transcriberConfigFromEnv } from './create-transcriber.ts'
import { ProviderError } from './errors.ts'

describe('createTranscriber', () => {
  it('builds the offline stub without a URL', () => {
    const t = createTranscriber({ transcriber: 'stub' })
    expect(t.id).toBe('stub')
    expect(t.sendsDataOffHost).toBe(false)
  })

  it('requires TRANSCRIBER_URL for mms-http', () => {
    expect(() => createTranscriber({ transcriber: 'mms-http' })).toThrow(ProviderError)
  })

  it('builds mms-http when a URL is set', () => {
    const t = createTranscriber({
      transcriber: 'mms-http',
      transcriberUrl: 'http://mms-stt:8000',
    })
    expect(t.id).toBe('mms-http')
    expect(t.sendsDataOffHost).toBe(false)
  })

  it('refuses cloud without off-host consent', () => {
    expect(() => createTranscriber({ transcriber: 'cloud' })).toThrow(/CONSENT_REQUIRED|consent/i)
  })

  it('allows cloud only after explicit consent', () => {
    const t = createTranscriber({
      transcriber: 'cloud',
      transcriberOffHostConsent: true,
    })
    expect(t.id).toBe('cloud')
    expect(t.sendsDataOffHost).toBe(true)
  })

  it('has no assemblyai alias', () => {
    expect(() =>
      createTranscriber({ transcriber: 'assemblyai', transcriberOffHostConsent: true }),
    ).toThrow(/Unknown transcriber/)
  })
})

describe('transcriberConfigFromEnv', () => {
  it('defaults to mms-http with consent off', () => {
    expect(transcriberConfigFromEnv({})).toEqual({
      transcriber: 'mms-http',
      transcriberUrl: undefined,
      transcriberOffHostConsent: false,
    })
  })

  it('reads consent from TRANSCRIBER_OFF_HOST_CONSENT', () => {
    expect(
      transcriberConfigFromEnv({
        TRANSCRIBER: 'cloud',
        TRANSCRIBER_OFF_HOST_CONSENT: 'true',
      }),
    ).toMatchObject({ transcriber: 'cloud', transcriberOffHostConsent: true })
  })
})
