import type { AdClip, PlayerSettings, SignWindowLayout, UiStringKey } from '@abolkit/core'
import {
  DEFAULT_SIGN_LAYOUT,
  formatTime,
  isLessonManifest,
  isUiStringKey,
  resolveUiLang,
  t,
} from '@abolkit/core'
import { parseGenerateCaptions, watchCaptions } from './caption-api.js'
import type { LessonConfig } from './config.js'
import { configFromAttributes, configFromManifest, languageName, mergeConfig } from './config.js'
import type { EngineEvent, MediaEngine } from './engine.js'
import { createEngine } from './engine/create.js'
import { isYouTube } from './engine/source.js'
import { OPTIONS, type OptionKey } from './options.js'
import { loadSettings, saveSettings } from './storage.js'
import { PLAYER_CSS } from './styles.js'

const TAG = 'abol-player'
const DRIFT_S = 0.3
/** Auto-scroll waits this long after the viewer scrolls the transcript themselves. */
const MANUAL_SCROLL_MS = 4000
const AD_MODES = ['off', 'text', 'voice'] as const
const DOCKS: SignWindowLayout['dock'][] = ['top-right', 'top-left', 'bottom-left', 'bottom-right']
const SHORTCUTS: Record<string, string> = { d: 'ad', s: 'sign', t: 'transcript' }
/** Must match TOGGLE_EVENT in engine/skin.ts (not imported, so the lite build stays free of Video.js). */
const TOGGLE_EVENT = 'abol-toggle'
/** Our control-bar toggles: in the Video.js skin, or in the native fallback bar. */
const toggles = (action: string) =>
  `abol-toggle-button[data-action="${action}"], .bar [data-a="${action}"]`
const CLOSE_ICON =
  '<svg viewBox="0 0 18 18" width="18" height="18" aria-hidden="true"><path stroke="currentColor" stroke-linecap="round" stroke-width="2" d="m4.5 4.5 9 9m0-9-9 9"/></svg>'

/** Fallback controls for the native engine only; with Video.js these live in its control bar (engine/skin.ts). */
const NATIVE_SETTINGS = OPTIONS.map(
  (o) =>
    `<label><span data-l="${o.label}"></span><select data-s="${o.key}">${o.choices
      .map(([value, label]) => `<option value="${value}" data-l="${label}">${label}</option>`)
      .join('')}</select></label>`,
).join('')

const TEMPLATE = `
<div class="root" part="root">
  <p class="status" role="status" hidden></p>
  <div class="layout">
    <div class="stage" part="stage"></div>
    <aside class="transcript" id="abol-tr" part="transcript" aria-labelledby="abol-tr-h" hidden>
      <header class="tr-head">
        <h2 id="abol-tr-h" data-l="transcript"></h2>
        <button type="button" class="tr-close" data-a="transcript" data-la="hideTranscript">${CLOSE_ICON}</button>
      </header>
      <div class="tr-search" role="search">
        <input type="search" class="tr-query" data-la="searchTranscript" autocomplete="off" spellcheck="false" />
        <span class="tr-count" aria-live="polite"></span>
      </div>
      <div class="tr-body"></div>
    </aside>
  </div>
  <div class="bar" part="toolbar" role="group" hidden>
    <button type="button" data-a="sign" data-l="signToggle" aria-pressed="false" hidden></button>
    <button type="button" data-a="transcript" data-l="transcript" aria-pressed="false" hidden></button>
    <button type="button" data-a="settings" data-l="settings" aria-expanded="false" aria-controls="abol-st"></button>
  </div>
  <section id="abol-st" class="panel" hidden><div class="settings">${NATIVE_SETTINGS}</div></section>
  <div class="sr" aria-live="polite"></div>
</div>`

const OVERLAYS = `
<div class="captions" aria-hidden="true"><span class="cue" hidden></span></div>
<div class="sign" role="group" hidden>
  <div class="sign-bar">
    <button type="button" data-a="sign-move" data-la="moveResize" aria-pressed="false">✥</button>
    <button type="button" data-a="sign-dock" data-la="dockCorner">◰</button>
    <button type="button" data-a="sign-reset" data-la="resetSign">↺</button>
  </div>
  <video muted playsinline preload="metadata" aria-hidden="true" tabindex="-1"></video>
  <p class="sign-note" data-l="sampleSign" hidden></p>
  <span class="sign-grip" aria-hidden="true"></span>
</div>`

/** One transcript entry: a cue line, a timed element of the host's HTML, or (untimed) a block of it. */
interface TranscriptItem {
  start: number
  end: number
  /** Gets aria-current; hidden by search when `filter` is set. */
  el: HTMLElement
  /** Where search marks are drawn, restored from `original` on every query. */
  text: HTMLElement
  original: Node
  filter: HTMLElement | null
}

const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n))
const cueText = (cue: TextTrackCue) => ((cue as VTTCue).text ?? '').replace(/<[^>]+>/g, '').trim()
const isCaption = (track: TextTrack) => track.kind === 'captions' || track.kind === 'subtitles'
const noop = () => undefined
const reducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches

/** Parse host-supplied transcript HTML without scripts, frames or inline handlers. */
function safeFragment(html: string): DocumentFragment {
  const doc = new DOMParser().parseFromString(html, 'text/html')
  doc.querySelectorAll('script,style,iframe,object,embed,link,meta,form').forEach((n) => n.remove())
  for (const node of doc.body.querySelectorAll('*')) {
    for (const { name, value } of Array.from(node.attributes)) {
      if (/^on/i.test(name) || /^\s*javascript:/i.test(value)) node.removeAttribute(name)
    }
  }
  const fragment = document.createDocumentFragment()
  fragment.append(...Array.from(doc.body.childNodes))
  return fragment
}

/** Wrap case-insensitive matches of `query` in <mark>, starting from a pristine copy. */
function markMatches(target: HTMLElement, original: Node, query: string): boolean {
  target.replaceChildren(...Array.from(original.cloneNode(true).childNodes))
  if (!query) return false
  const walker = document.createTreeWalker(target, NodeFilter.SHOW_TEXT)
  const nodes: Text[] = []
  while (walker.nextNode()) nodes.push(walker.currentNode as Text)
  let found = false
  for (const node of nodes) {
    const lower = node.data.toLocaleLowerCase()
    let at = lower.indexOf(query)
    if (at < 0) continue
    found = true
    const parts = document.createDocumentFragment()
    let last = 0
    while (at >= 0) {
      const mark = document.createElement('mark')
      mark.textContent = node.data.slice(at, at + query.length)
      parts.append(node.data.slice(last, at), mark)
      last = at + query.length
      at = lower.indexOf(query, last)
    }
    parts.append(node.data.slice(last))
    node.replaceWith(parts)
  }
  return found
}

export class AbolPlayerElement extends HTMLElement {
  static observedAttributes = [
    'src',
    'manifest',
    'captions',
    'captions-lang',
    'sign',
    'lang',
    'caption-api',
    'generate-captions',
  ]

  #shadow: ShadowRoot
  #engine: MediaEngine | null = null
  #config: LessonConfig | null = null
  #settings: PlayerSettings = loadSettings()
  #off: Array<() => void> = []
  #boots = 0
  #scheduled = false
  #clips: AdClip[] = []
  #clipAudio: HTMLAudioElement | null = null
  #lastAd: TextTrackCue | null = null
  #captionLang: string | null = null
  #audioOnly = false
  #moveMode = false
  #resumeAfterSign = false
  #drag: {
    mode: 'move' | 'resize'
    x: number
    y: number
    w: number
    h: number
    start: SignWindowLayout
  } | null = null
  #layers: HTMLElement | null = null
  #cue: HTMLElement | null = null
  #sign: HTMLElement | null = null
  #signVideo: HTMLVideoElement | null = null
  #boundTracks = new WeakSet<TextTrack>()
  /** Fetched transcript HTML, kept so a language switch can rebuild without refetching. */
  #trHtml: string | null = null
  #trTrack: TextTrack | null = null
  #trCueCount = 0
  #trItems: TranscriptItem[] = []
  #trActive: TranscriptItem | null = null
  #trQuery = ''
  #trManualUntil = 0
  #frameObserver: ResizeObserver | null = null

  constructor() {
    super()
    this.#shadow = this.attachShadow({ mode: 'open' })
    this.#shadow.innerHTML = `<style>${PLAYER_CSS}</style>${TEMPLATE}`
    this.#shadow.addEventListener('click', (ev) => {
      const target = (ev.target as Element).closest<HTMLElement>('[data-a]')
      if (target) this.#act(target.dataset.a!, target)
    })
    this.#shadow.addEventListener(TOGGLE_EVENT, (ev) => {
      const action = (ev as CustomEvent<{ action?: string }>).detail?.action
      if (action) this.#act(action)
    })
    this.#shadow.addEventListener('change', (ev) => {
      const input = ev.target as HTMLSelectElement
      if (input.dataset.s) this.#setOption(input.dataset.s as OptionKey, input.value)
    })
    const root = this.#q('.root')
    root.addEventListener('keydown', this.#blockShortcuts, true)
    root.addEventListener('keydown', this.#onKey)

    const body = this.#q('.tr-body')
    const manual = () => (this.#trManualUntil = Date.now() + MANUAL_SCROLL_MS)
    body.addEventListener('wheel', manual, { passive: true })
    body.addEventListener('touchmove', manual, { passive: true })
    body.addEventListener('keydown', (ev) => {
      const item = (ev.target as HTMLElement).closest<HTMLElement>('[role="button"][data-a="seek"]')
      if (item && (ev.key === 'Enter' || ev.key === ' ')) {
        ev.preventDefault()
        this.#act('seek', item)
      }
    })
    const query = this.#q<HTMLInputElement>('.tr-query')
    query.addEventListener('input', () => this.#search(query.value))
    query.addEventListener('keydown', (ev) => {
      if (ev.key !== 'Enter') return
      ev.preventDefault()
      this.#q('.tr-body')
        .querySelector<HTMLElement>('mark')
        ?.closest<HTMLElement>('[data-a="seek"]')
        ?.focus()
    })
  }

  connectedCallback(): void {
    this.#frameObserver?.disconnect()
    this.#frameObserver = new ResizeObserver(() => this.#syncTranscriptFrame())
    this.#frameObserver.observe(this.#q('.root'))
    this.#schedule()
  }

  disconnectedCallback(): void {
    this.#frameObserver?.disconnect()
    this.#frameObserver = null
    this.#teardown()
  }

  attributeChangedCallback(name: string, oldValue: string | null, value: string | null): void {
    if (oldValue === value || !this.#config) return
    if (name === 'lang') this.#label()
    else this.#schedule()
  }

  play(): Promise<void> {
    return this.#engine?.play() ?? Promise.resolve()
  }

  pause(): void {
    this.#engine?.pause()
  }

  seek(seconds: number): void {
    this.#engine?.seek(seconds)
  }

  #q<T extends Element = HTMLElement>(selector: string): T {
    return this.#shadow.querySelector(selector) as T
  }

  /** Our controls: inside the Video.js control bar when present, plus the native fallback bar. */
  #all<T extends Element = HTMLElement>(selector: string): T[] {
    const controls = this.#engine?.controls
    return [
      ...Array.from(this.#shadow.querySelectorAll<T>(selector)),
      ...(controls ? Array.from(controls.querySelectorAll<T>(selector)) : []),
    ]
  }

  get #lang(): string {
    return resolveUiLang(
      this.getAttribute('lang') ?? this.#config?.lang ?? document.documentElement.lang,
    )
  }

  /** Boot once per burst of attribute changes, after `<track>` children have been parsed. */
  #schedule(): void {
    if (this.#scheduled) return
    this.#scheduled = true
    const run = () => {
      this.#scheduled = false
      if (this.isConnected) void this.#boot()
    }
    if (document.readyState === 'loading')
      document.addEventListener('DOMContentLoaded', run, { once: true })
    else queueMicrotask(run)
  }

  async #boot(): Promise<void> {
    const boot = ++this.#boots
    this.#teardown()
    this.#status('loading')
    try {
      let config = configFromAttributes(this)
      const manifest = this.getAttribute('manifest')
      if (manifest) {
        const res = await fetch(manifest)
        if (!res.ok) throw new Error(`Manifest HTTP ${res.status}`)
        const data: unknown = await res.json()
        if (!isLessonManifest(data)) throw new Error('Invalid lesson manifest')
        config = mergeConfig(
          configFromManifest(data, res.url || new URL(manifest, document.baseURI).href),
          config,
        )
      }
      if (!config.src) throw new Error('Set the src or manifest attribute')

      const keys = this.getAttribute('controls-keys')
      if (keys === 'off' || keys === 'focus') this.#settings.controlsKeys = keys
      const preferred = this.#settings.captionsLang
      if (
        preferred !== undefined &&
        config.tracks.some((tr) => tr.lang === preferred || preferred === '')
      ) {
        for (const tr of config.tracks)
          if (tr.kind === 'captions' || tr.kind === 'subtitles') tr.default = tr.lang === preferred
      }

      const engine = await createEngine(this.getAttribute('engine'))
      if (boot !== this.#boots) return
      if (
        engine.kind === 'native' &&
        isYouTube({ src: config.src, type: this.getAttribute('type') })
      ) {
        throw new Error(
          'YouTube sources need the Video.js build (abol-player.js), not the lite build',
        )
      }
      this.#config = config
      this.#engine = engine
      engine.mount(this.#q('.stage'), {
        src: config.src,
        type: this.getAttribute('type'),
        poster: config.poster,
        title: config.title,
        tracks: config.tracks,
        crossOrigin: this.getAttribute('crossorigin'),
      })
      this.#q('.bar').hidden = !!engine.controls
      this.#mountOverlays(engine, config)
      this.#bindMedia(engine)
      this.#bindControls(engine)
      if (config.adClips) void this.#loadClips(config.adClips, boot)

      this.#applyStyle()
      this.#applyAd()
      this.#showSign()
      this.#refreshAvailability()
      this.#label()
      if (this.#settings.transcriptOpen && this.#hasTranscript()) void this.#setTranscriptOpen(true)
      this.#status(null)
      this.#emit('abol:ready', { engine: engine.kind })
      this.#startCaptionApi(engine, config)
    } catch (err) {
      if (boot !== this.#boots) return
      console.error('[abol-player]', err)
      this.#status('error', true)
      this.#emit('abol:error', { message: err instanceof Error ? err.message : String(err) })
    }
  }

  /**
   * Opt-in: with `caption-api` and a valid `generate-captions`, ask the caption API for this video's
   * transcript and translations, and add each one as a caption track when it is ready.
   */
  #startCaptionApi(engine: MediaEngine, config: LessonConfig): void {
    const api = this.getAttribute('caption-api')
    const request = parseGenerateCaptions(this.getAttribute('generate-captions'))
    if (!api || !request || !config.src) return
    if (!request.valid) {
      console.warn('[abol-player]', request.reason)
      return
    }
    const controller = new AbortController()
    const blobs: string[] = []
    this.#off.push(() => {
      controller.abort()
      for (const url of blobs) URL.revokeObjectURL(url)
    })
    // Tracks the host supplied win over generated ones in the same language.
    const have = new Set(
      config.tracks
        .filter((tr) => tr.kind === 'captions' || tr.kind === 'subtitles')
        .map((tr) => tr.lang),
    )
    let announced = false
    watchCaptions({
      api: new URL(api, document.baseURI).href,
      videoUrl: config.src,
      languages: request.languages,
      // Trust the host's lang / captions-lang when present; otherwise the API assumes English.
      sourceLanguage:
        this.getAttribute('lang')?.trim() ||
        this.getAttribute('captions-lang')?.trim() ||
        undefined,
      signal: controller.signal,
      onStatus: (status) => {
        if (status === 'processing' && !announced) {
          announced = true
          this.#announce(t(this.#lang, 'captionsGenerating'))
        }
        this.#emit('abol:captions', { status })
      },
      onCaption: (caption, vtt) => {
        if (have.has(caption.language)) return
        have.add(caption.language)
        const src = URL.createObjectURL(new Blob([vtt], { type: 'text/vtt' }))
        blobs.push(src)
        const label = languageName(caption.language)
        if (!engine.addTrack({ kind: 'captions', src, lang: caption.language, label })) return
        const preferred = this.#settings.captionsLang
        if (preferred === caption.language || (preferred !== '' && !this.#showingCaption())) {
          this.#selectCaption(caption.language)
        }
        this.#announce(`${t(this.#lang, 'captionsReady')}: ${label}`)
        this.#emit('abol:captions', {
          status: 'caption',
          lang: caption.language,
          kind: caption.kind,
          needsReview: caption.needsReview,
        })
      },
    }).catch((err: unknown) => {
      if (controller.signal.aborted) return
      console.warn('[abol-player] Caption API:', err)
      this.#emit('abol:captions', {
        status: 'error',
        message: err instanceof Error ? err.message : String(err),
      })
    })
  }

  #mountOverlays(engine: MediaEngine, config: LessonConfig): void {
    const layers = document.createElement('div')
    layers.className = 'layers'
    layers.innerHTML = OVERLAYS
    engine.overlay.append(layers)
    this.#layers = layers
    this.#cue = layers.querySelector('.cue')
    this.#sign = layers.querySelector('.sign')
    this.#signVideo = layers.querySelector('.sign video')
    if (!config.sign) return

    const sign = this.#sign!
    this.#signVideo!.src = config.sign.src
    sign.querySelector<HTMLElement>('.sign-note')!.hidden = !config.sign.placeholder
    // The skin treats pointer and key events in its container as player gestures/hotkeys.
    sign.addEventListener('click', (ev) => {
      const target = (ev.target as Element).closest<HTMLElement>('[data-a]')
      if (target) this.#act(target.dataset.a!, target)
      ev.stopPropagation()
    })
    sign.addEventListener('keydown', (ev) => {
      this.#onSignKey(ev)
      ev.stopPropagation()
    })
    sign.addEventListener('pointerdown', (ev) => {
      ev.stopPropagation()
      const target = ev.target as Element
      if (target.closest('button')) return
      const mode = target.closest('.sign-grip')
        ? 'resize'
        : target.closest('.sign-bar')
          ? 'move'
          : null
      if (!mode) return
      const rect = layers.getBoundingClientRect()
      this.#drag = {
        mode,
        x: ev.clientX,
        y: ev.clientY,
        w: rect.width,
        h: rect.height,
        start: { ...this.#layout },
      }
      sign.setPointerCapture(ev.pointerId)
    })
    sign.addEventListener('pointermove', (ev) => {
      if (!this.#drag) return
      const { mode, x, y, w, h, start } = this.#drag
      const dx = ((ev.clientX - x) / w) * 100
      const dy = ((ev.clientY - y) / h) * 100
      const layout = this.#layout
      layout.dock = 'free'
      if (mode === 'move') {
        layout.x = start.x + dx
        layout.y = start.y + dy
      } else {
        layout.width = start.width + dx
      }
      this.#placeSign()
    })
    const endDrag = (ev: PointerEvent) => {
      ev.stopPropagation()
      if (!this.#drag) return
      this.#drag = null
      saveSettings(this.#settings)
    }
    sign.addEventListener('pointerup', endDrag)
    sign.addEventListener('pointercancel', endDrag)
  }

  #bindMedia(engine: MediaEngine): void {
    const sign = this.#signVideo!
    const on = (event: EngineEvent, handler: () => void) =>
      this.#off.push(engine.on(event, handler))
    const listen = (target: EventTarget, type: string, handler: (ev: Event) => void) => {
      target.addEventListener(type, handler)
      this.#off.push(() => target.removeEventListener(type, handler))
    }

    on('play', () => this.#signShown() && void sign.play().catch(noop))
    on('playing', () => this.#signShown() && void sign.play().catch(noop))
    on('pause', () => sign.pause())
    on('waiting', () => sign.pause())
    on('ratechange', () => (sign.playbackRate = engine.playbackRate))
    on('seeked', () => {
      this.#syncSign(true)
      this.#syncTranscript(true)
    })
    on('timeupdate', () => {
      this.#syncSign(false)
      this.#syncTranscript(false)
    })
    on('volumechange', () => {
      this.#settings.volume = engine.volume
      this.#settings.muted = engine.muted
    })

    let resumeTimer = 0
    const resume = () => {
      clearTimeout(resumeTimer)
      if (!this.#resumeAfterSign) return
      this.#resumeAfterSign = false
      void engine.play().catch(noop)
    }
    // Pause both while the sign video buffers; a slow sign stream must never stall the lesson for long.
    sign.addEventListener('waiting', () => {
      if (!this.#signShown() || engine.paused) return
      this.#resumeAfterSign = true
      engine.pause()
      if (sign.readyState >= HTMLMediaElement.HAVE_FUTURE_DATA) queueMicrotask(resume)
      else resumeTimer = window.setTimeout(resume, 3000)
    })
    this.#off.push(() => clearTimeout(resumeTimer))
    on('play', () => (this.#resumeAfterSign = false))
    sign.addEventListener('canplay', resume)
    sign.addEventListener('error', () => {
      if (this.#sign) this.#sign.hidden = true
      resume()
    })

    // Tracks can appear after load: in-band captions/descriptions in the file or an HLS manifest.
    const tracks = engine.textTracks
    for (const track of Array.from(tracks)) this.#bindTrack(track)
    listen(tracks, 'addtrack', (ev) => {
      const track = (ev as TrackEvent).track as TextTrack | null
      if (track) this.#bindTrack(track)
      this.#onTrackListChange()
    })
    listen(tracks, 'removetrack', () => this.#onTrackListChange())
    listen(tracks, 'change', () => this.#onTracksChange())
    // A cue active at 0:00 gets no cuechange until playback moves.
    for (const track of Array.from(tracks)) engine.whenLoaded(track, () => this.#renderCue())
  }

  #bindTrack(track: TextTrack): void {
    if (this.#boundTracks.has(track)) return
    this.#boundTracks.add(track)
    const handler = track.kind === 'descriptions' ? this.#onDescription : () => this.#renderCue()
    track.addEventListener('cuechange', handler)
    this.#off.push(() => track.removeEventListener('cuechange', handler))
  }

  /** Settings menu radio groups in the Video.js control bar (engine/skin.ts). */
  #bindControls(engine: MediaEngine): void {
    const controls = engine.controls
    if (!controls) return
    const onValue = (ev: Event) => {
      const group = (ev.target as HTMLElement).closest<HTMLElement>('[data-opt]')
      const value = (ev as CustomEvent<{ value: string }>).detail?.value
      if (!group || typeof value !== 'string') return
      if (group.dataset.opt === 'captionTrack') this.#selectCaption(value)
      else this.#setOption(group.dataset.opt as OptionKey, value)
    }
    controls.addEventListener('value-change', onValue)
    this.#off.push(() => controls.removeEventListener('value-change', onValue))
  }

  #onTrackListChange(): void {
    this.#refreshAvailability()
    this.#applyAd()
    if (this.#transcriptOpen && !this.#trItems.length) void this.#loadTranscript()
  }

  #captionTracks(): TextTrack[] {
    return this.#engine ? Array.from(this.#engine.textTracks).filter(isCaption) : []
  }

  #showingCaption(): TextTrack | undefined {
    return this.#captionTracks().find((tr) => tr.mode === 'showing')
  }

  /** Engine-managed (YouTube) caption tracks: our own menu group picks one; `''` turns them off. */
  #selectCaption(lang: string): void {
    for (const track of this.#captionTracks()) {
      if (lang && track.language === lang) track.mode = 'showing'
      else if (track.mode === 'showing')
        track.mode = track === this.#trTrack ? 'hidden' : 'disabled'
    }
  }

  #descTrack(): TextTrack | undefined {
    const tracks = this.#engine ? Array.from(this.#engine.textTracks) : []
    const desc = tracks.filter((tr) => tr.kind === 'descriptions')
    return desc.find((tr) => tr.language === this.#lang) ?? desc[0]
  }

  #hasTranscript(): boolean {
    return !!this.#config?.transcript || this.#captionTracks().length > 0
  }

  /** Show only the controls this lesson can use. */
  #refreshAvailability(): void {
    const config = this.#config
    const captions = this.#captionTracks()
    const available: Partial<Record<OptionKey | 'captionTrack', boolean>> = {
      adMode: !!this.#descTrack(),
      signVisible: !!config?.sign,
      audioOnly: !!config?.audio,
      captionTrack: !!this.#engine?.customTracks && captions.length > 0,
    }
    // Caption style only applies to captions we draw; without any, the captions menu keeps just Video.js's tracks.
    for (const { key, group } of OPTIONS)
      if (group === 'caption') available[key] = captions.length > 0
    type Group = HTMLElement & {
      unavailable: boolean
      setChoices?(choices: Array<[string, string]>): void
    }
    for (const [key, ok] of Object.entries(available)) {
      // Video.js menu: the group reports to its menu, which hides the parent item.
      for (const group of this.#all<Group>(`abol-option-group[data-opt="${key}"]`))
        group.unavailable = !ok
      for (const label of this.#all(`label:has(> [data-s="${key}"])`)) label.hidden = !ok
    }
    if (available.captionTrack) {
      const choices: Array<[string, string]> = [
        ['', t(this.#lang, 'off')],
        ...captions.map((tr): [string, string] => [tr.language, tr.label || tr.language]),
      ]
      for (const group of this.#all<Group>('abol-option-group[data-opt="captionTrack"]'))
        group.setChoices?.(choices)
      this.#reflectCaptions()
    }
    for (const node of this.#all(toggles('transcript'))) node.hidden = !this.#hasTranscript()
    for (const node of this.#all(toggles('sign'))) node.hidden = !config?.sign
  }

  /** Engine-managed captions: Video.js cannot see them, so we mirror their state on the captions button and menu. */
  #reflectCaptions(): void {
    if (!this.#engine?.customTracks) return
    const showing = this.#showingCaption()
    for (const button of this.#all('abol-captions-button'))
      button.toggleAttribute('data-abol-active', !!showing)
    for (const group of this.#all<HTMLElement & { value: string }>(
      'abol-option-group[data-opt="captionTrack"]',
    )) {
      group.value = showing?.language ?? ''
    }
  }

  #onTracksChange(): void {
    this.#renderCue()
    this.#reflectCaptions()
    const track = this.#showingCaption()
    const lang = track?.language ?? ''
    if (lang === this.#captionLang) return
    const initial = this.#captionLang === null
    this.#captionLang = lang
    this.#settings.captionsLang = lang
    saveSettings(this.#settings)
    if (!initial) {
      this.#announce(
        track ? `${t(this.#lang, 'captions')}: ${track.label}` : t(this.#lang, 'captionsOff'),
      )
      this.#emit('abol:caption-change', { lang: lang || null })
    }
    // Follow the viewer's caption language; turning captions off keeps the current transcript.
    if (track && this.#transcriptOpen && track.language !== this.#q('.tr-body').lang)
      void this.#loadTranscript()
  }

  #renderCue(): void {
    if (!this.#cue) return
    const track = this.#showingCaption()
    let active = track?.activeCues ? Array.from(track.activeCues) : []
    // Chrome leaves activeCues empty until playback first moves.
    const now = this.#engine?.currentTime ?? 0
    if (!active.length && track?.cues)
      active = Array.from(track.cues).filter((c) => c.startTime <= now && now < c.endTime)
    const text = active.map(cueText).join('\n')
    this.#cue.textContent = text
    this.#cue.hidden = !text
    if (track) this.#cue.lang = track.language
  }

  #onDescription = (ev: Event): void => {
    if (this.#settings.adMode === 'off') return
    const cue = (ev.target as TextTrack).activeCues?.[0]
    if (!cue || cue === this.#lastAd) return
    this.#lastAd = cue
    const text = cueText(cue)
    if (this.#settings.adMode === 'voice' && this.#speak(cue, text)) return
    this.#announce(text)
  }

  /** Voice AD: a recorded clip if the manifest has one, else an on-device voice. Never a cloud voice (ADR 0003). */
  #speak(cue: TextTrackCue, text: string): boolean {
    const video = this.#engine
    if (!video) return false
    const volume = video.volume
    const duck = () => (video.volume = Math.min(volume, 0.3))
    const restore = () => (video.volume = volume)

    const clip = this.#clips.find(
      (c) => c.id === cue.id || Math.abs(c.start - cue.startTime) < 0.05,
    )
    if (clip) {
      this.#clipAudio?.pause()
      const audio = new Audio(new URL(clip.audio, this.#config?.adClips).href)
      this.#clipAudio = audio
      duck()
      if (clip.pauseVideo) video.pause()
      audio.addEventListener('ended', () => {
        restore()
        if (clip.pauseVideo) void video.play().catch(noop)
      })
      audio.play().catch(() => {
        restore()
        this.#announce(text)
      })
      return true
    }

    const synth = globalThis.speechSynthesis
    const lang = this.#descTrack()?.language || this.#lang
    const voice = synth
      ?.getVoices()
      .find((v) => v.localService && v.lang.toLowerCase().startsWith(lang))
    if (!voice) return false
    const utterance = new SpeechSynthesisUtterance(text)
    utterance.voice = voice
    utterance.lang = voice.lang
    utterance.onend = restore
    utterance.onerror = restore
    duck()
    synth.speak(utterance)
    return true
  }

  async #loadClips(url: string, boot: number): Promise<void> {
    try {
      const res = await fetch(url)
      if (res.ok && boot === this.#boots) this.#clips = (await res.json()) as AdClip[]
    } catch {
      this.#clips = []
    }
  }

  #applyAd(): void {
    const track = this.#descTrack()
    if (track) track.mode = this.#settings.adMode === 'off' ? 'disabled' : 'hidden'
    this.#lastAd = null
  }

  get #layout(): SignWindowLayout {
    return this.#settings.signLayout
  }

  #signShown(): boolean {
    return !!this.#sign && !this.#sign.hidden
  }

  #showSign(): void {
    if (!this.#sign || !this.#signVideo) return
    const show = !!this.#config?.sign && this.#settings.signVisible && !this.#audioOnly
    this.#sign.hidden = !show
    this.#reflectSign()
    if (!show) {
      this.#signVideo.pause()
      return
    }
    this.#placeSign()
    this.#syncSign(true)
    if (this.#engine && !this.#engine.paused) void this.#signVideo.play().catch(noop)
  }

  #placeSign(): void {
    const sign = this.#sign
    const layers = this.#layers
    if (!sign || !layers) return
    const layout = this.#layout
    layout.width = clamp(layout.width, 15, 60)
    sign.style.width = `${layout.width}%`
    const height = layers.clientHeight ? (sign.offsetHeight / layers.clientHeight) * 100 : 30
    const maxY = Math.max(0, 100 - height)
    // The transcript covers the right of the frame, so docked corners and drags stay clear of it.
    const inset = this.#signInsetPct()
    const right = Math.max(2, 98 - layout.width - inset)
    // Top corners sit below the skin's top button row; bottom corners above its control bar.
    const corners: Partial<Record<SignWindowLayout['dock'], [number, number]>> = {
      'top-left': [2, 14],
      'top-right': [right, 14],
      'bottom-left': [2, maxY - 14],
      'bottom-right': [right, maxY - 14],
    }
    const corner = corners[layout.dock]
    if (corner) [layout.x, layout.y] = corner
    layout.x = clamp(layout.x, 0, Math.max(0, 100 - layout.width - inset))
    layout.y = clamp(layout.y, 0, maxY)
    sign.style.left = `${layout.x}%`
    sign.style.top = `${layout.y}%`
  }

  #reflectSign(): void {
    const on = this.#settings.signVisible
    const label = t(this.#lang, on ? 'hideSign' : 'showSign')
    for (const button of this.#all(toggles('sign'))) {
      if ('active' in button) (button as HTMLElement & { active: boolean }).active = on
      else button.setAttribute('aria-pressed', String(on))
      button.setAttribute('aria-label', label)
    }
    for (const tip of this.#all('[data-abol-tip="sign"]')) tip.textContent = label
  }

  #syncSign(force: boolean): void {
    const sign = this.#signVideo
    const video = this.#engine
    if (!sign || !video || !this.#signShown() || sign.readyState === 0) return
    if (force || Math.abs(sign.currentTime - video.currentTime) > DRIFT_S)
      sign.currentTime = video.currentTime
  }

  #setMoveMode(on: boolean): void {
    this.#moveMode = on
    this.#sign?.querySelector('[data-a="sign-move"]')?.setAttribute('aria-pressed', String(on))
    this.#announce(
      on
        ? 'Arrow keys move, Shift and arrow keys resize, Escape to finish.'
        : t(this.#lang, 'signWindow'),
    )
  }

  #onSignKey(ev: KeyboardEvent): void {
    if (!this.#moveMode) return
    if (ev.key === 'Escape') {
      ev.preventDefault()
      this.#setMoveMode(false)
      return
    }
    const step = (
      { ArrowLeft: [-2, 0], ArrowRight: [2, 0], ArrowUp: [0, -2], ArrowDown: [0, 2] } as Record<
        string,
        number[]
      >
    )[ev.key]
    if (!step) return
    ev.preventDefault()
    const [dx = 0, dy = 0] = step
    const layout = this.#layout
    layout.dock = 'free'
    if (ev.shiftKey) layout.width += dx || -dy
    else {
      layout.x += dx
      layout.y += dy
    }
    this.#placeSign()
    saveSettings(this.#settings)
  }

  #setAudioOnly(on: boolean): void {
    const config = this.#config
    const engine = this.#engine
    if (!config?.audio || !engine || !config.src || on === this.#audioOnly) return
    const time = engine.currentTime
    const playing = !engine.paused
    this.#audioOnly = on
    const off = engine.on('loadedmetadata', () => {
      off()
      engine.seek(time)
      if (playing) void engine.play().catch(noop)
    })
    this.#off.push(off)
    engine.setSource(on ? config.audio : config.src)
    // Stop the sign video downloading while the viewer saves bandwidth.
    if (on) this.#signVideo?.removeAttribute('src')
    else if (config.sign && this.#signVideo) this.#signVideo.src = config.sign.src
    this.#showSign()
  }

  // ── Viewer options (Video.js settings menu, or the native fallback panel) ────────────────

  #optionValue(key: OptionKey): string {
    const settings = this.#settings
    switch (key) {
      case 'adMode':
        return settings.adMode
      case 'signVisible':
        return settings.signVisible ? 'on' : 'off'
      case 'audioOnly':
        return this.#audioOnly ? 'on' : 'off'
      case 'controlsKeys':
        return settings.controlsKeys
      default:
        return String(settings.captionStyle[key])
    }
  }

  #setOption(key: OptionKey, value: string): void {
    if (value === this.#optionValue(key)) return
    const settings = this.#settings
    const style = settings.captionStyle
    switch (key) {
      case 'adMode':
        settings.adMode = AD_MODES.find((m) => m === value) ?? 'off'
        this.#applyAd()
        this.#announce(`${t(this.#lang, 'audioDescription')}: ${this.#choiceLabel(key)}`)
        this.#emit('abol:description-toggle', { mode: settings.adMode })
        break
      case 'signVisible':
        settings.signVisible = value === 'on'
        this.#showSign()
        this.#emit('abol:sign-toggle', { visible: settings.signVisible })
        break
      case 'audioOnly':
        this.#setAudioOnly(value === 'on')
        break
      case 'controlsKeys':
        settings.controlsKeys = value === 'off' ? 'off' : 'focus'
        break
      case 'fontScale':
      case 'backgroundOpacity':
        style[key] = Number(value)
        break
      case 'position':
        style.position = value === 'top' ? 'top' : 'bottom'
        break
      case 'edge':
        style.edge = value === 'shadow' || value === 'outline' ? value : 'none'
        break
      case 'color':
      case 'background':
        style[key] = value
        break
    }
    saveSettings(settings)
    this.#applyStyle()
  }

  #choiceLabel(key: OptionKey): string {
    const value = this.#optionValue(key)
    const label =
      OPTIONS.find((o) => o.key === key)?.choices.find(([v]) => v === value)?.[1] ?? value
    return isUiStringKey(label) ? t(this.#lang, label) : label
  }

  /** Reflect settings into the caption overlay and every option control. */
  #applyStyle(): void {
    const style = this.#settings.captionStyle
    const cue = this.#cue
    if (cue) {
      cue.dataset.edge = style.edge
      cue.style.color = style.color
      cue.style.setProperty('--abol-cue-scale', String(style.fontScale))
      const alpha = Math.round(clamp(style.backgroundOpacity, 0, 1) * 255)
        .toString(16)
        .padStart(2, '0')
      cue.style.background = `${style.background}${alpha}`
      cue.parentElement!.dataset.pos = style.position
    }
    for (const { key } of OPTIONS) {
      const value = this.#optionValue(key)
      for (const node of this.#all<HTMLElement & { value: string }>(
        `[data-opt="${key}"], [data-s="${key}"]`,
      )) {
        if (node.value !== value) node.value = value
      }
    }
  }

  // ── Transcript sidebar ─────────────────────────────────────────────────────────────────

  get #transcriptOpen(): boolean {
    return !this.#q('#abol-tr').hidden
  }

  async #setTranscriptOpen(open: boolean): Promise<void> {
    this.#q('#abol-tr').hidden = !open
    this.#q('.layout').toggleAttribute('data-transcript', open)
    this.#syncTranscriptFrame()
    this.#settings.transcriptOpen = open
    saveSettings(this.#settings)
    this.#reflectTranscript()
    if (open && !this.#trItems.length) await this.#loadTranscript()
    if (open) this.#syncTranscript(true)
  }

  /**
   * Wide players: the transcript covers the right of the video, and the video keeps the height it has on its own.
   * Narrow players: it stacks underneath, so the control bar stays full width.
   */
  #syncTranscriptFrame(): void {
    const overlay = this.#transcriptOpen && this.#q('.root').clientWidth > 640
    this.#engine?.overlay.toggleAttribute('data-transcript', overlay)
    if (this.#signShown()) this.#placeSign()
  }

  /** Percent of the frame the transcript covers, so the sign window is not parked underneath it. */
  #signInsetPct(): number {
    const layers = this.#layers
    if (!layers || !this.#engine?.overlay.hasAttribute('data-transcript')) return 0
    return layers.clientWidth ? (this.#q('.transcript').offsetWidth / layers.clientWidth) * 100 : 0
  }

  #reflectTranscript(): void {
    const open = this.#transcriptOpen
    const label = t(this.#lang, open ? 'hideTranscript' : 'showTranscript')
    for (const button of this.#all(toggles('transcript'))) {
      if ('active' in button) (button as HTMLElement & { active: boolean }).active = open
      else button.setAttribute('aria-pressed', String(open))
      button.setAttribute('aria-label', label)
      button.setAttribute('aria-controls', 'abol-tr')
    }
    for (const tip of this.#all('[data-abol-tip="transcript"]')) tip.textContent = label
  }

  /** Prefer a host transcript with timings, then captions (synced), then the host's untimed HTML. */
  async #loadTranscript(): Promise<void> {
    const src = this.#config?.transcript
    if (src && this.#trHtml === null) {
      try {
        const res = await fetch(src)
        if (!res.ok) throw new Error(`Transcript HTTP ${res.status}`)
        this.#trHtml = await res.text()
      } catch {
        this.#trHtml = ''
      }
    }
    const lang = this.#transcriptLang()
    const fragment = this.#trHtml ? safeFragment(this.#trHtml) : null
    if (fragment?.querySelector('[data-start]')) this.#renderHtmlTranscript(fragment, lang, true)
    else if (this.#renderCueTranscript()) return
    else if (fragment) this.#renderHtmlTranscript(fragment, lang, false)
    else this.#renderEmptyTranscript()
  }

  #transcriptLang(): string {
    return this.#showingCaption()?.language || this.#trTrack?.language || this.#lang
  }

  #setTranscriptBody(content: Node, lang: string, items: TranscriptItem[]): void {
    const body = this.#q('.tr-body')
    body.replaceChildren(content)
    body.lang = lang
    this.#trItems = items
    this.#trActive = null
    this.#q('.tr-search').hidden = !items.length
    this.#search(this.#trQuery)
    this.#syncTranscript(true)
  }

  #renderEmptyTranscript(): void {
    const note = document.createElement('p')
    note.className = 'tr-empty'
    note.textContent = t(this.#lang, 'noTranscript')
    this.#setTranscriptBody(note, this.#lang, [])
  }

  /** Lines from the caption track; for in-band tracks cues arrive over time, so this reruns as they grow. */
  #renderCueTranscript(): boolean {
    const engine = this.#engine
    const tracks = this.#captionTracks()
    const track =
      this.#showingCaption() ??
      tracks.find((tr) => tr.language === this.#transcriptLang()) ??
      tracks.find((tr) => tr.language === this.#lang) ??
      tracks[0]
    if (!engine || !track) return false
    if (track.mode === 'disabled') track.mode = 'hidden'
    if (
      !track.cues?.length &&
      engine.whenLoaded(track, () => this.#transcriptOpen && void this.#loadTranscript())
    ) {
      this.#trTrack = track
      return true
    }
    const cues = Array.from(track.cues ?? [])
    this.#trTrack = track
    this.#trCueCount = cues.length
    if (!cues.length) return false

    const list = document.createElement('ol')
    list.className = 'tr-list'
    const items = cues.map((cue): TranscriptItem => {
      const button = document.createElement('button')
      button.type = 'button'
      button.dataset.a = 'seek'
      button.dataset.t = String(cue.startTime)
      const time = document.createElement('span')
      time.className = 'tr-time'
      time.textContent = formatTime(cue.startTime)
      const text = document.createElement('span')
      text.className = 'tr-text'
      text.textContent = cueText(cue)
      button.append(time, text)
      const item = document.createElement('li')
      item.append(button)
      list.append(item)
      return {
        start: cue.startTime,
        end: cue.endTime,
        el: button,
        text,
        original: text.cloneNode(true),
        filter: item,
      }
    })
    this.#setTranscriptBody(list, track.language, items)
    return true
  }

  /** Host HTML. Timed (`data-start`/`data-end`) elements become seekable and sync; blocks in another language are dropped. */
  #renderHtmlTranscript(fragment: DocumentFragment, lang: string, timed: boolean): void {
    const blocks = Array.from(fragment.children) as HTMLElement[]
    const base = (l: string) => l.toLowerCase().split('-')[0]
    if (blocks.some((b) => b.lang) && blocks.some((b) => base(b.lang) === base(lang))) {
      for (const block of blocks) if (block.lang && base(block.lang) !== base(lang)) block.remove()
    }
    const wrap = document.createElement('div')
    wrap.className = 'tr-html'
    wrap.append(fragment)
    let items: TranscriptItem[]
    if (timed) {
      const timedEls = Array.from(wrap.querySelectorAll<HTMLElement>('[data-start]'))
      items = timedEls.map((el, i) => {
        const start = Number(el.dataset.start)
        const next = Number(timedEls[i + 1]?.dataset.start)
        const end = Number(el.dataset.end ?? (Number.isFinite(next) ? next : Infinity))
        el.dataset.a = 'seek'
        el.dataset.t = String(start)
        el.setAttribute('role', 'button')
        el.tabIndex = 0
        return { start, end, el, text: el, original: el.cloneNode(true), filter: null }
      })
    } else {
      items = (Array.from(wrap.children) as HTMLElement[]).map((el) => ({
        start: NaN,
        end: NaN,
        el,
        text: el,
        original: el.cloneNode(true),
        filter: el,
      }))
    }
    this.#trTrack = null
    this.#setTranscriptBody(wrap, lang, items)
  }

  /** Highlight the line being spoken and keep it in view, unless the viewer is reading elsewhere. */
  #syncTranscript(force: boolean): void {
    if (!this.#transcriptOpen || !this.#engine) return
    const track = this.#trTrack
    if (track?.cues && track.cues.length !== this.#trCueCount) {
      this.#renderCueTranscript()
      return
    }
    const now = this.#engine.currentTime
    const active = this.#trItems.find((item) => now >= item.start && now < item.end) ?? null
    if (active === this.#trActive && !force) return
    this.#trActive?.el.removeAttribute('aria-current')
    this.#trActive = active
    if (!active) return
    active.el.setAttribute('aria-current', 'true')
    const body = this.#q('.tr-body')
    const reading =
      this.#trQuery || Date.now() < this.#trManualUntil || body.contains(this.#shadow.activeElement)
    if (reading && !force) return
    const top =
      active.el.getBoundingClientRect().top - body.getBoundingClientRect().top + body.scrollTop
    body.scrollTo({
      top: top - body.clientHeight / 2 + active.el.offsetHeight / 2,
      behavior: reducedMotion() ? 'auto' : 'smooth',
    })
  }

  #search(raw: string): void {
    const query = raw.trim().toLocaleLowerCase()
    this.#trQuery = query
    let hits = 0
    for (const item of this.#trItems) {
      const match = markMatches(item.text, item.original, query)
      if (match) hits++
      if (item.filter) item.filter.hidden = !!query && !match
    }
    const count = this.#q('.tr-count')
    count.textContent = query
      ? hits
        ? `${hits} ${t(this.#lang, hits === 1 ? 'match' : 'matches')}`
        : t(this.#lang, 'noMatches')
      : ''
    if (query) this.#q('.tr-body').querySelector('mark')?.scrollIntoView({ block: 'nearest' })
    else this.#syncTranscript(true)
  }

  #act(action: string, target?: HTMLElement): void {
    const settings = this.#settings
    switch (action) {
      case 'sign':
        this.#setOption('signVisible', settings.signVisible ? 'off' : 'on')
        break
      case 'ad':
        this.#setOption(
          'adMode',
          AD_MODES[(AD_MODES.indexOf(settings.adMode) + 1) % AD_MODES.length]!,
        )
        break
      case 'transcript':
        if (this.#hasTranscript()) void this.#setTranscriptOpen(!this.#transcriptOpen)
        return
      case 'settings': {
        const panel = this.#q('#abol-st')
        panel.hidden = !panel.hidden
        this.#q('.bar [data-a="settings"]').setAttribute('aria-expanded', String(!panel.hidden))
        return
      }
      case 'seek':
        // Just past the start, so the previous cue (which ends at this instant) is not also active.
        this.#engine?.seek(Number(target?.dataset.t) + 0.01)
        return
      case 'sign-move':
        this.#setMoveMode(!this.#moveMode)
        return
      case 'sign-dock':
        this.#layout.dock = DOCKS[(DOCKS.indexOf(this.#layout.dock) + 1) % DOCKS.length]!
        this.#placeSign()
        break
      case 'sign-reset':
        settings.signLayout = { ...DEFAULT_SIGN_LAYOUT }
        this.#placeSign()
        break
      default:
        return
    }
    saveSettings(settings)
  }

  #label(): void {
    const lang = this.#lang
    const text = (key: string) => (isUiStringKey(key) ? t(lang, key) : key)
    for (const node of this.#all('[data-l]')) node.textContent = text(node.dataset.l!)
    for (const node of this.#all('[data-la]')) {
      const label = text(node.dataset.la!)
      node.setAttribute('aria-label', label)
      node.title = label
      if (node instanceof HTMLInputElement) node.placeholder = label
    }
    // Control-bar buttons: name only, since Video.js tooltips already show it (a title would double it).
    for (const node of this.#all('[data-aria]'))
      node.setAttribute('aria-label', text(node.dataset.aria!))
    // Option groups copy the selected label into their menu hint when they update.
    for (const group of this.#all<HTMLElement & { requestUpdate(): void }>('abol-option-group'))
      group.requestUpdate()
    this.#q('.bar').setAttribute('aria-label', t(lang, 'settings'))
    this.#sign?.setAttribute('aria-label', t(lang, 'signWindow'))
    this.#reflectTranscript()
    this.#reflectSign()
    this.#applyStyle()
  }

  /** `controls-keys="off"`: stop single-character keys before Video.js hotkeys or ours see them (WCAG 2.1.4). */
  #blockShortcuts = (ev: KeyboardEvent): void => {
    if (this.#settings.controlsKeys !== 'off') return
    const origin = ev.composedPath()[0] as HTMLElement
    if (origin instanceof HTMLInputElement) return
    if (ev.key.length === 1 && ev.key !== ' ' && !ev.ctrlKey && !ev.metaKey && !ev.altKey)
      ev.stopPropagation()
  }

  #onKey = (ev: KeyboardEvent): void => {
    const origin = ev.composedPath()[0] as HTMLElement
    if (ev.key === 'Escape') {
      if (!this.#q('#abol-st').hidden) {
        this.#act('settings')
        this.#q<HTMLElement>('.bar [data-a="settings"]').focus()
      } else if (this.#transcriptOpen && this.#q('#abol-tr').contains(origin)) {
        if (origin.classList.contains('tr-query') && this.#trQuery) return
        void this.#setTranscriptOpen(false)
        this.#all(toggles('transcript'))
          .find((b) => !b.hidden)
          ?.focus()
      }
      return
    }
    if (ev.ctrlKey || ev.metaKey || ev.altKey) return
    if (/^(INPUT|SELECT|TEXTAREA)$/.test(origin.tagName) || origin.isContentEditable) return
    const action = SHORTCUTS[ev.key.toLowerCase()]
    if (!action) return
    const available = {
      ad: !!this.#descTrack(),
      sign: !!this.#config?.sign,
      transcript: this.#hasTranscript(),
    }
    if (!available[action as keyof typeof available]) return
    ev.preventDefault()
    this.#act(action)
  }

  #announce(message: string): void {
    const live = this.#q('.sr')
    live.textContent = ''
    requestAnimationFrame(() => (live.textContent = message))
  }

  #status(key: UiStringKey | null, failed = false): void {
    const status = this.#q('.status')
    status.hidden = !key
    status.textContent = key ? t(this.#lang, key) : ''
    this.#q('.layout').hidden = failed
    if (failed) this.#q('.bar').hidden = true
  }

  #emit(type: string, detail: unknown): void {
    this.dispatchEvent(new CustomEvent(type, { bubbles: true, composed: true, detail }))
  }

  #teardown(): void {
    for (const off of this.#off) off()
    this.#off = []
    this.#clipAudio?.pause()
    this.#clipAudio = null
    globalThis.speechSynthesis?.cancel()
    this.#signVideo?.removeAttribute('src')
    this.#engine?.destroy()
    this.#engine = null
    this.#layers = this.#cue = this.#sign = this.#signVideo = null
    this.#boundTracks = new WeakSet()
    this.#clips = []
    this.#lastAd = null
    this.#captionLang = null
    this.#audioOnly = false
    this.#moveMode = false
    this.#resumeAfterSign = false
    this.#trHtml = null
    this.#trTrack = null
    this.#trCueCount = 0
    this.#trItems = []
    this.#trActive = null
    this.#q('.tr-body').replaceChildren()
    this.#q('#abol-tr').hidden = true
    this.#q('.layout').removeAttribute('data-transcript')
    this.#q('#abol-st').hidden = true
    this.#q('.bar [data-a="settings"]').setAttribute('aria-expanded', 'false')
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'abol-player': AbolPlayerElement
  }
}

export function registerAbolPlayer(): void {
  if (!customElements.get(TAG)) customElements.define(TAG, AbolPlayerElement)
}
