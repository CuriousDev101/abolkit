import { describe, expect, it } from 'vitest'

import {
  isMeaningfulAlt,
  renderFigure,
  renderIndexHtml,
  renderTranscriptHtml,
  type PackCaptionTrack,
  type PackDescriptionTrack,
  type PackImage,
} from './html.ts'

const captions: PackCaptionTrack[] = [
  {
    lang: 'en',
    label: 'English',
    fileName: 'captions.en.vtt',
    vtt: 'WEBVTT\n\n00:00:00.000 --> 00:00:01.000\nA flower opens.\n',
  },
  {
    lang: 'am',
    label: 'አማርኛ',
    fileName: 'captions.am.vtt',
    vtt: 'WEBVTT\n\n00:00:00.000 --> 00:00:01.000\nአበባ ይከፈታል።\n',
  },
]

const descriptions: PackDescriptionTrack[] = [
  {
    lang: 'en',
    label: 'English',
    fileName: 'descriptions.en.vtt',
    vtt: 'WEBVTT\n\nad-1\n00:00:01.000 --> 00:00:03.000\nClose-up of a yellow flower filling the frame.\n',
  },
]

describe('isMeaningfulAlt', () => {
  it('rejects empty and placeholder alts', () => {
    expect(isMeaningfulAlt(undefined)).toBe(false)
    expect(isMeaningfulAlt('')).toBe(false)
    expect(isMeaningfulAlt('image')).toBe(false)
    expect(isMeaningfulAlt('picture')).toBe(false)
    expect(isMeaningfulAlt('image 1')).toBe(false)
  })

  it('accepts real descriptions', () => {
    expect(isMeaningfulAlt('Close-up of a yellow flower')).toBe(true)
  })
})

describe('renderFigure', () => {
  it('uses empty alt for decorative images', () => {
    const html = renderFigure({ src: 'decor.svg', decorative: true }, 0)
    expect(html).toContain('alt=""')
    expect(html).toContain('role="presentation"')
  })

  it('omits meaningful images that lack a real alt (no invention)', () => {
    expect(renderFigure({ src: 'slide.png', alt: 'image' }, 0)).toBeNull()
    expect(renderFigure({ src: 'slide.png' }, 0)).toBeNull()
  })

  it('renders meaningful alt and optional long description', () => {
    const html = renderFigure(
      {
        src: 'diagram.png',
        alt: 'Bar chart of enrolment by region',
        longDesc: 'Amhara has the tallest bar; Afar the shortest.',
      },
      0,
    )
    expect(html).toContain('alt="Bar chart of enrolment by region"')
    expect(html).toContain('aria-describedby="fig-desc-1"')
    expect(html).toContain('Amhara has the tallest bar')
  })
})

describe('accessible HTML (#54)', () => {
  it('sets document language and title on index and transcript', () => {
    const index = renderIndexHtml({
      title: 'Intro lesson',
      lang: 'am',
      captions,
      includeVideo: false,
    })
    const transcript = renderTranscriptHtml({
      title: 'Intro lesson',
      lang: 'en',
      captions,
      descriptions,
    })

    expect(index).toMatch(/<html lang="am">/)
    expect(index).toContain('<title>Intro lesson</title>')
    expect(transcript).toMatch(/<html lang="en">/)
    expect(transcript).toContain('<title>Transcript — Intro lesson</title>')
  })

  it('uses semantic landmarks and heading hierarchy', () => {
    const index = renderIndexHtml({
      title: 'Intro lesson',
      lang: 'en',
      captions,
      descriptions,
      includeVideo: false,
    })
    const transcript = renderTranscriptHtml({ title: 'Intro lesson', captions, descriptions })

    expect(index).toContain('<main>')
    expect(index).toContain('<header>')
    expect(index).toContain('<nav aria-label="Lesson materials">')
    expect(index).toContain('<footer>')
    expect(index).toMatch(/<h1>Intro lesson<\/h1>/)
    expect(index).toContain('<h2>Materials</h2>')
    expect(index).toContain('id="audio-heading"')

    expect(transcript).toContain('<main>')
    expect(transcript).toContain('<h1>Transcript — Intro lesson</h1>')
    expect(transcript).toContain('Captions — English')
    expect(transcript).toContain('Visual descriptions — English')
    expect(transcript).toContain('<ol>')
    expect(transcript).toContain('Close-up of a yellow flower')
  })

  it('uses ordered lists for cues and accessible link text', () => {
    const index = renderIndexHtml({
      title: 'Intro lesson',
      lang: 'en',
      captions,
      includeVideo: true,
    })
    expect(index).toContain('Accessible transcript')
    expect(index).toContain('English captions (en)')
    expect(index).toContain('Download the optional video file')
    expect(index).not.toMatch(/>click here</i)
  })

  it('includes figures only when alt metadata is meaningful', () => {
    const images: PackImage[] = [
      { src: 'poster.jpg', alt: 'Yellow flower against a blue sky' },
      { src: 'spacer.png', decorative: true },
      { src: 'unknown.png', alt: 'image' },
    ]
    const transcript = renderTranscriptHtml({ title: 'Intro', captions, images })
    expect(transcript).toContain('alt="Yellow flower against a blue sky"')
    expect(transcript).toContain('alt=""')
    expect(transcript).not.toContain('unknown.png')
  })

  it('avoids required script tags (offline pack constraint)', () => {
    const index = renderIndexHtml({ title: 'T', lang: 'en', captions, includeVideo: false })
    const transcript = renderTranscriptHtml({ title: 'T', captions })
    expect(index.toLowerCase()).not.toMatch(/<script/)
    expect(transcript.toLowerCase()).not.toMatch(/<script/)
  })
})
