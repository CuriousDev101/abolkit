import { jt, sanitizeLangTag } from './i18n.ts'
import {
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
  toJobPostingJsonLd,
  type DescriptionBlock,
  type JobCalendar,
  type JobDeadlineState,
  type NormalizedJobPosting,
} from './schema.ts'
import { JOB_CARD_CSS } from './styles.ts'

export const JOB_CARD_TAG = 'abol-job-card'
const GENERATED_LD_ATTR = 'data-abol-generated'
const FOLD_CHAR_THRESHOLD = 620
const FOLD_BLOCK_THRESHOLD = 2

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

const ICONS = {
  closing:
    '<svg viewBox="0 0 16 16" fill="none" aria-hidden="true" focusable="false"><circle cx="8" cy="8" r="6.25" stroke="currentColor" stroke-width="1.6"/><path d="M8 4.6v3.7l2.4 1.4" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  closed:
    '<svg viewBox="0 0 16 16" fill="none" aria-hidden="true" focusable="false"><circle cx="8" cy="8" r="6.25" stroke="currentColor" stroke-width="1.6"/><path d="m5.7 5.7 4.6 4.6m0-4.6-4.6 4.6" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>',
  play: '<svg viewBox="0 0 16 16" fill="currentColor" aria-hidden="true" focusable="false"><path d="M4.5 3.3a.8.8 0 0 1 1.2-.7l7.1 4.7a.8.8 0 0 1 0 1.4l-7.1 4.7a.8.8 0 0 1-1.2-.7V3.3Z"/></svg>',
  pause:
    '<svg viewBox="0 0 16 16" fill="currentColor" aria-hidden="true" focusable="false"><rect x="3.8" y="3" width="3" height="10" rx="0.8"/><rect x="9.2" y="3" width="3" height="10" rx="0.8"/></svg>',
} as const

let instanceSeq = 0

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className?: string,
  text?: string,
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag)
  if (className) node.className = className
  if (text !== undefined) node.textContent = text
  return node
}

/** Insert `<wbr>` break opportunities after slashes/hyphens in inline URLs so long links break cleanly. */
function appendRichText(target: HTMLElement, text: string): void {
  const urlRe = /https?:\/\/[^\s)]+/g
  let lastIndex = 0
  for (const match of text.matchAll(urlRe)) {
    const index = match.index ?? 0
    if (index > lastIndex) {
      target.appendChild(document.createTextNode(text.slice(lastIndex, index)))
    }
    const url = match[0]
    const span = document.createElement('span')
    const segments = url.split(/(?<=[/?#&=-])/)
    for (let i = 0; i < segments.length; i++) {
      span.appendChild(document.createTextNode(segments[i]!))
      if (i < segments.length - 1) {
        span.appendChild(document.createElement('wbr'))
      }
    }
    target.appendChild(span)
    lastIndex = index + url.length
  }
  if (lastIndex < text.length) {
    target.appendChild(document.createTextNode(text.slice(lastIndex)))
  }
}

function renderBlock(block: DescriptionBlock): HTMLElement {
  if (block.kind === 'ul') {
    const ul = el('ul')
    for (const item of block.items) {
      const li = el('li')
      appendRichText(li, item)
      ul.appendChild(li)
    }
    return ul
  }
  const p = el('p')
  appendRichText(p, block.text)
  return p
}

const HostElement: typeof HTMLElement =
  typeof HTMLElement !== 'undefined' ? HTMLElement : (class {} as unknown as typeof HTMLElement)

export class AbolJobCardElement extends HostElement {
  static observedAttributes = ['src', 'lang', 'calendar', 'heading-level']

  readonly #root: ShadowRoot
  readonly #uid: string
  #job: NormalizedJobPosting | null = null
  #abort: AbortController | null = null
  #observer: MutationObserver | null = null
  #audio: HTMLAudioElement | null = null
  #audioPlaying = false
  #audioFailed = false
  #connected = false

  constructor() {
    super()
    this.#uid = `abol-jc-${++instanceSeq}`
    this.#root = this.attachShadow({ mode: 'open' })
  }

  /** Programmatic access to the normalized `JobPosting` data. */
  get job(): NormalizedJobPosting | null {
    return this.#job
  }

  set job(value: unknown) {
    this.#abort?.abort()
    this.#stopAudio()
    if (value === null || value === undefined) {
      this.#job = null
      this.#clearGeneratedJsonLd()
      if (this.#connected) this.#renderEmpty()
      return
    }
    try {
      const parsed = parseJobPosting(value)
      this.#job = parsed
      this.#audioFailed = false
      this.#syncJsonLd(parsed)
      if (this.#connected) this.#renderJob(parsed)
    } catch {
      this.#job = null
      if (this.#connected) this.#renderStatus(jt(this.#effectiveLang(), 'errorInvalid'), 'error')
    }
  }

  get src(): string {
    return this.getAttribute('src') ?? ''
  }

  set src(value: string) {
    if (value) this.setAttribute('src', value)
    else this.removeAttribute('src')
  }

  connectedCallback(): void {
    this.#connected = true
    this.#observeInlineScript()
    void this.#loadFromSource()
  }

  disconnectedCallback(): void {
    this.#connected = false
    this.#abort?.abort()
    this.#observer?.disconnect()
    this.#observer = null
    this.#stopAudio()
  }

  attributeChangedCallback(name: string, oldValue: string | null, newValue: string | null): void {
    if (!this.#connected || oldValue === newValue) return
    if (name === 'src') {
      void this.#loadFromSource()
      return
    }
    if (this.#job) {
      this.#stopAudio()
      this.#renderJob(this.#job)
    }
  }

  #effectiveLang(job?: NormalizedJobPosting | null): string {
    const own = this.getAttribute('lang')?.trim()
    if (own) return sanitizeLangTag(own)
    if (job?.inLanguage) return sanitizeLangTag(job.inLanguage)
    const docLang = typeof document !== 'undefined' ? document.documentElement.lang.trim() : ''
    return sanitizeLangTag(docLang, 'en')
  }

  #calendar(): JobCalendar {
    const attr = this.getAttribute('calendar')?.trim().toLowerCase()
    return attr === 'ethiopic' || attr === 'ethiopian' ? 'ethiopic' : 'gregory'
  }

  #headingTag(): 'h2' | 'h3' | 'h4' {
    const lvl = this.getAttribute('heading-level')?.trim()
    if (lvl === '3') return 'h3'
    if (lvl === '4') return 'h4'
    return 'h2'
  }

  #observeInlineScript(): void {
    this.#observer?.disconnect()
    this.#observer = new MutationObserver((records) => {
      for (const rec of records) {
        const touchedHostJson = Array.from(rec.addedNodes)
          .concat(Array.from(rec.removedNodes))
          .some(
            (n) =>
              n instanceof HTMLScriptElement &&
              n.type === 'application/ld+json' &&
              !n.hasAttribute(GENERATED_LD_ATTR),
          )
        if (touchedHostJson && !this.hasAttribute('src')) {
          void this.#loadFromSource()
          break
        }
      }
    })
    this.#observer.observe(this, { childList: true })
  }

  #findHostInlineScript(): HTMLScriptElement | null {
    const scripts = this.querySelectorAll<HTMLScriptElement>('script[type="application/ld+json"]')
    for (const script of scripts) {
      if (!script.hasAttribute(GENERATED_LD_ATTR)) return script
    }
    return null
  }

  async #loadFromSource(): Promise<void> {
    this.#abort?.abort()
    this.#stopAudio()
    this.#audioFailed = false

    const src = this.getAttribute('src')?.trim()
    if (src) {
      const controller = new AbortController()
      this.#abort = controller
      this.#renderStatus(jt(this.#effectiveLang(), 'loading'), 'loading')
      try {
        const res = await fetch(src, {
          signal: controller.signal,
          headers: { Accept: 'application/ld+json, application/json;q=0.9, */*;q=0.1' },
        })
        if (!res.ok) {
          throw new Error(`HTTP ${res.status}`)
        }
        const raw: unknown = await res.json()
        if (controller.signal.aborted) return
        const parsed = parseJobPosting(raw)
        this.#job = parsed
        this.#syncJsonLd(parsed)
        this.#renderJob(parsed)
      } catch (err) {
        if (controller.signal.aborted) return
        this.#job = null
        const key =
          err instanceof Error && err.message.includes('JobPosting') ? 'errorInvalid' : 'errorLoad'
        this.#renderStatus(jt(this.#effectiveLang(), key), 'error')
      }
      return
    }

    const inlineScript = this.#findHostInlineScript()
    if (inlineScript?.textContent?.trim()) {
      try {
        const parsed = parseJobPosting(inlineScript.textContent)
        this.#job = parsed
        inlineScript.textContent = serializeJsonLdScript(parsed)
        this.#clearGeneratedJsonLd()
        this.#renderJob(parsed)
      } catch {
        this.#job = null
        this.#renderStatus(jt(this.#effectiveLang(), 'errorInvalid'), 'error')
      }
      return
    }

    if (this.#job) {
      this.#syncJsonLd(this.#job)
      this.#renderJob(this.#job)
      return
    }

    this.#renderEmpty()
  }

  /** Ensure valid `schema.org/JobPosting` JSON-LD exists in light DOM for crawlers and validators. */
  #syncJsonLd(job: NormalizedJobPosting): void {
    const hostScript = this.#findHostInlineScript()
    const serialized = serializeJsonLdScript(job)
    if (hostScript) {
      hostScript.textContent = serialized
      this.#clearGeneratedJsonLd()
      return
    }
    let gen = this.querySelector<HTMLScriptElement>(
      `script[type="application/ld+json"][${GENERATED_LD_ATTR}]`,
    )
    if (!gen) {
      gen = document.createElement('script')
      gen.type = 'application/ld+json'
      gen.setAttribute(GENERATED_LD_ATTR, '')
      this.appendChild(gen)
    }
    gen.textContent = serialized
  }

  #clearGeneratedJsonLd(): void {
    this.querySelectorAll(`script[${GENERATED_LD_ATTR}]`).forEach((node) => node.remove())
  }

  #resetShadowShell(): HTMLElement {
    this.#root.replaceChildren()
    const style = document.createElement('style')
    style.textContent = JOB_CARD_CSS
    const card = el('article', 'card')
    card.setAttribute('part', 'card')
    this.#root.append(style, card)
    return card
  }

  #renderEmpty(): void {
    this.#root.replaceChildren()
  }

  #renderStatus(message: string, kind: 'loading' | 'error'): void {
    const card = this.#resetShadowShell()
    card.lang = this.#effectiveLang()
    const p = el('p', 'state-msg', message)
    p.dataset.kind = kind
    p.setAttribute('role', kind === 'error' ? 'alert' : 'status')
    card.appendChild(p)
  }

  #renderJob(job: NormalizedJobPosting): void {
    const card = this.#resetShadowShell()
    const lang = this.#effectiveLang(job)
    const calendar = this.#calendar()
    const titleId = `${this.#uid}-title`
    const liveId = `${this.#uid}-live`

    card.lang = lang
    card.setAttribute('aria-labelledby', titleId)

    // 1. Masthead: tapered abol pour mark, single heading (role + employer), and conditional status
    const masthead = el('header', 'masthead')
    const pour = el('span', 'pour')
    pour.setAttribute('aria-hidden', 'true')
    masthead.appendChild(pour)

    const heading = el(this.#headingTag(), 'title')
    heading.id = titleId
    heading.setAttribute('part', 'title')
    const roleSpan = el('span', 'title-role', job.title)
    heading.appendChild(roleSpan)

    if (job.hiringOrganization?.name) {
      const sep = el('span', 'sr', ', ')
      const orgSpan = el('span', 'title-org', job.hiringOrganization.name)
      heading.append(sep, orgSpan)
    }
    masthead.appendChild(heading)

    const deadlineState = getDeadlineState(job.validThrough)
    const statusBanner = this.#buildStatusBanner(deadlineState, job.validThrough, lang)
    if (statusBanner) {
      masthead.appendChild(statusBanner)
    }
    card.appendChild(masthead)

    // 2. Plain-language summary FIRST in DOM reading order (stays synced with active lang & calendar)
    const summaryCopy = job.hasExplicitSummary
      ? job.summaryText
      : composePlainSummary(job, lang, calendar)
    const lead = el('p', 'lead', summaryCopy)
    lead.setAttribute('part', 'summary')
    card.appendChild(lead)

    if (job.audioSummaryUrl) {
      const audioBtn = el('button', 'listen')
      audioBtn.type = 'button'
      audioBtn.setAttribute('part', 'audio-button')
      const audioNote = el('p', 'audio-note', jt(lang, 'audioUnavailable'))
      audioNote.hidden = !this.#audioFailed

      this.#syncAudioButton(audioBtn, lang)
      audioBtn.addEventListener('click', () => {
        void this.#toggleAudioSummary(job, audioBtn, audioNote, lang)
      })
      card.append(audioBtn, audioNote)
    }

    // 3. Key facts as a ruled definition list (<dl>)
    const facts = this.#buildFactsLedger(job, lang, calendar)
    if (facts) {
      card.appendChild(facts)
    }

    // 4. Plain-language details with semantic paragraphs & <ul> lists (folds whole blocks, never mid-list)
    const blocks = parseDescriptionBlocks(job.description)
    if (blocks.length > 0 && job.description.trim() !== summaryCopy.trim()) {
      const descriptionBox = el('div', 'description')
      descriptionBox.setAttribute('part', 'details')

      const shouldFold =
        job.description.length > FOLD_CHAR_THRESHOLD && blocks.length > FOLD_BLOCK_THRESHOLD
      const visibleBlocks = shouldFold ? blocks.slice(0, FOLD_BLOCK_THRESHOLD) : blocks
      for (const block of visibleBlocks) {
        descriptionBox.appendChild(renderBlock(block))
      }

      if (shouldFold) {
        const detailsEl = el('details')
        const summaryEl = el('summary', undefined, jt(lang, 'readFullDescription'))
        const moreEl = el('div', 'more')
        for (const block of blocks.slice(FOLD_BLOCK_THRESHOLD)) {
          moreEl.appendChild(renderBlock(block))
        }
        detailsEl.append(summaryEl, moreEl)
        descriptionBox.appendChild(detailsEl)
      }

      card.appendChild(descriptionBox)
    }

    // 5. Actions footer: omit Apply button when closed (status banner in masthead already states closed)
    const isClosed = deadlineState === 'closed'
    const hasEmployerLink = Boolean(job.hiringOrganization?.sameAs)

    if (!isClosed || hasEmployerLink) {
      const actions = el('footer', 'actions')
      actions.setAttribute('part', 'actions')

      if (!isClosed) {
        const applyBtn = el('button', 'apply')
        applyBtn.type = 'button'
        applyBtn.setAttribute('part', 'apply-button')
        applyBtn.textContent = jt(lang, 'applyButton')
        applyBtn.addEventListener('click', () => this.#handleApply(job, lang))
        actions.appendChild(applyBtn)
      }

      if (job.hiringOrganization?.sameAs) {
        const orgLink = el('a', 'employer')
        orgLink.href = job.hiringOrganization.sameAs
        orgLink.target = '_blank'
        orgLink.rel = 'noopener noreferrer'
        const visibleText = job.hiringOrganization.name
          ? jt(lang, 'visitEmployer', { employer: job.hiringOrganization.name })
          : jt(lang, 'visitEmployerGeneric')
        orgLink.appendChild(document.createTextNode(visibleText))
        const srNewTab = el('span', 'sr', ` (${jt(lang, 'opensNewTab')})`)
        orgLink.appendChild(srNewTab)
        actions.appendChild(orgLink)
      }

      card.appendChild(actions)
    }

    const live = el('div', 'sr')
    live.id = liveId
    live.setAttribute('role', 'status')
    live.setAttribute('aria-live', 'polite')
    live.setAttribute('aria-atomic', 'true')
    card.appendChild(live)
  }

  #buildStatusBanner(
    state: JobDeadlineState,
    validThrough: string | undefined,
    lang: string,
  ): HTMLElement | null {
    if (state === 'open') return null
    const status = el('p', 'status')
    status.dataset.state = state
    const icon = state === 'closed' ? ICONS.closed : ICONS.closing
    const text = formatDeadlineStatus(validThrough, lang)
    status.innerHTML = `${icon}<span></span>`
    status.querySelector('span')!.textContent = text
    return status
  }

  #buildFactsLedger(
    job: NormalizedJobPosting,
    lang: string,
    calendar: JobCalendar,
  ): HTMLDListElement | null {
    const entries: Array<{ term: string; value: string; timeIso?: string }> = []

    const locText = formatLocation(job.location, lang)
    if (locText) {
      entries.push({ term: jt(lang, 'location'), value: locText })
    }

    const empText = formatEmploymentTypes(job.employmentTypes, lang)
    if (empText) {
      entries.push({ term: jt(lang, 'jobType'), value: empText })
    }

    const salaryText = formatSalary(job.baseSalary, lang)
    if (salaryText) {
      entries.push({ term: jt(lang, 'salary'), value: salaryText })
    }

    if (job.datePosted) {
      entries.push({
        term: jt(lang, 'datePosted'),
        value: formatJobDate(job.datePosted, lang, calendar),
        ...(isValidIsoDate(job.datePosted) ? { timeIso: job.datePosted } : {}),
      })
    }

    if (job.validThrough) {
      entries.push({
        term: jt(lang, 'deadline'),
        value: formatJobDate(job.validThrough, lang, calendar),
        ...(isValidIsoDate(job.validThrough) ? { timeIso: job.validThrough } : {}),
      })
    }

    if (entries.length === 0) return null

    const dl = el('dl', 'ledger')
    dl.setAttribute('part', 'facts')

    for (const item of entries) {
      const row = el('div', 'row')
      const dt = el('dt', undefined, item.term)
      const dd = el('dd')
      if (item.timeIso) {
        const timeEl = el('time', undefined, item.value)
        timeEl.dateTime = item.timeIso
        dd.appendChild(timeEl)
      } else {
        dd.textContent = item.value
      }
      row.append(dt, dd)
      dl.appendChild(row)
    }

    return dl
  }

  #syncAudioButton(btn: HTMLButtonElement, lang: string): void {
    btn.setAttribute('aria-pressed', String(this.#audioPlaying))
    const icon = this.#audioPlaying ? ICONS.pause : ICONS.play
    const label = jt(lang, this.#audioPlaying ? 'audioSummaryPause' : 'audioSummaryPlay')
    btn.innerHTML = `${icon}<span></span>`
    btn.querySelector('span')!.textContent = label
  }

  async #toggleAudioSummary(
    job: NormalizedJobPosting,
    btn: HTMLButtonElement,
    note: HTMLElement,
    lang: string,
  ): Promise<void> {
    if (!job.audioSummaryUrl) return

    if (this.#audio && this.#audioPlaying) {
      this.#audio.pause()
      this.#audioPlaying = false
      this.#syncAudioButton(btn, lang)
      this.#emitSummaryPlay(false, job.audioSummaryUrl, job)
      return
    }

    const resolvedUrl = new URL(job.audioSummaryUrl, this.baseURI).href
    if (!this.#audio || this.#audio.src !== resolvedUrl) {
      this.#stopAudio()
      const audio = new Audio(resolvedUrl)
      audio.preload = 'none'
      audio.addEventListener('ended', () => {
        this.#audioPlaying = false
        this.#syncAudioButton(btn, lang)
      })
      audio.addEventListener('error', () => {
        this.#audioPlaying = false
        this.#audioFailed = true
        note.hidden = false
        this.#syncAudioButton(btn, lang)
        this.#announce(jt(lang, 'audioUnavailable'))
      })
      this.#audio = audio
    }

    try {
      note.hidden = true
      await this.#audio.play()
      this.#audioFailed = false
      this.#audioPlaying = true
      this.#syncAudioButton(btn, lang)
      this.#emitSummaryPlay(true, job.audioSummaryUrl, job)
    } catch {
      this.#audioPlaying = false
      this.#audioFailed = true
      note.hidden = false
      this.#syncAudioButton(btn, lang)
      this.#announce(jt(lang, 'audioUnavailable'))
    }
  }

  #stopAudio(): void {
    if (this.#audio) {
      this.#audio.pause()
      this.#audio.removeAttribute('src')
      this.#audio = null
    }
    this.#audioPlaying = false
  }

  #emitSummaryPlay(playing: boolean, src: string, job: NormalizedJobPosting): void {
    this.dispatchEvent(
      new CustomEvent<SummaryPlayEventDetail>('abol:summary-play', {
        bubbles: true,
        composed: true,
        detail: { playing, src, job },
      }),
    )
  }

  #handleApply(job: NormalizedJobPosting, lang: string): void {
    const detail: JobApplyEventDetail = {
      job,
      jsonLd: toJobPostingJsonLd(job),
      ...(job.url ? { url: job.url } : {}),
    }
    const event = new CustomEvent<JobApplyEventDetail>('abol:job-apply', {
      bubbles: true,
      composed: true,
      cancelable: true,
      detail,
    })
    const notCancelled = this.dispatchEvent(event)
    this.#announce(jt(lang, 'applyAnnounce', { title: job.title }))
    if (notCancelled && job.url && typeof window !== 'undefined') {
      window.open(job.url, '_blank', 'noopener,noreferrer')
    }
  }

  #announce(text: string): void {
    const live = this.#root.getElementById(`${this.#uid}-live`)
    if (!live) return
    live.textContent = ''
    queueMicrotask(() => {
      live.textContent = text
    })
  }
}

export function registerAbolJobCard(tagName: string = JOB_CARD_TAG): void {
  if (typeof customElements === 'undefined') return
  if (!customElements.get(tagName)) {
    customElements.define(tagName, AbolJobCardElement)
  }
}
