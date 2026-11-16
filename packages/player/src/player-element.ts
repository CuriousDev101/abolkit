import type { AdClip, PlayerSettings, SignWindowLayout, UiStringKey } from '@abolkit/core'
import {
  DEFAULT_SIGN_LAYOUT,
  formatTime,
  isLessonManifest,
  isUiStringKey,
  resolveUiLang,
  t,
} from '@abolkit/core'
import { downloadBrf, exportBrfFromLines } from './braille/export-brf.js'
import { ensureBrailleCompanion } from './braille/load-companion.js'
import {
  orderCaptionStatusRows,
  parseGenerateCaptions,
  retryCaptions,
  watchCaptions,
  type CaptionStatus,
} from './caption-api.js'
import type { LessonConfig } from './config.js'
import { configFromAttributes, configFromManifest, languageName, mergeConfig } from './config.js'
import type { EngineEvent, MediaEngine } from './engine.js'
import { createEngine } from './engine/create.js'
import { isYouTube } from './engine/source.js'
import {
  canUseOfflineApis,
  downloadLesson,
  getOfflineSnapshot,
  lessonIdFrom,
  removeLesson,
  resolveCachedPlayback,
  type OfflineLessonAssets,
  type OfflineSnapshot,
} from './offline/index.js'
import { OPTIONS, type OptionKey } from './options.js'
import { mountSignMedia, unloadSignMedia, type SignPlayable } from './sign-media.js'
import { hydrateSettings, loadSettings, saveSettings } from './storage.js'
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
        <div class="tr-head-text">
          <h2 id="abol-tr-h" data-l="transcript"></h2>
          <span class="tr-lang" hidden></span>
        </div>
        <div class="tr-head-actions">
          <button type="button" class="tr-close" data-a="transcript" data-la="hideTranscript">${CLOSE_ICON}</button>
        </div>
      </header>
      <div class="tr-search" role="search">
        <label class="tr-search-field">
          <span class="tr-search-icon" aria-hidden="true">
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="none" viewBox="0 0 14 14"><circle cx="6" cy="6" r="4.25" stroke="currentColor" stroke-width="1.5"/><path stroke="currentColor" stroke-linecap="round" stroke-width="1.5" d="m9.5 9.5 2.75 2.75"/></svg>
          </span>
          <input type="search" class="tr-query" data-la="searchTranscript" autocomplete="off" spellcheck="false" />
        </label>
        <span class="tr-count" aria-live="polite"></span>
      </div>
      <div class="tr-body"></div>
    </aside>
  </div>
  <div class="bar" part="toolbar" role="group" hidden>
    <button type="button" data-a="sign" data-l="signToggle" aria-pressed="false" hidden></button>
    <button type="button" data-a="transcript" data-l="transcript" aria-pressed="false" hidden></button>
    <button type="button" data-a="offline" data-la="downloadOffline" aria-pressed="false" hidden></button>
    <a class="offline-pack" data-a="offline-pack" data-la="offlinePackLink" hidden download></a>
    <button type="button" data-a="braille-export" data-la="exportBraille" hidden></button>
    <button type="button" data-a="settings" data-l="settings" aria-expanded="false" aria-controls="abol-st"></button>
  </div>
  <section id="abol-st" class="panel" hidden><div class="settings">${NATIVE_SETTINGS}</div></section>
  <div class="sr" aria-live="polite"></div>
</div>`

const OVERLAYS = `
<div class="caption-jobs" role="status" aria-live="polite" hidden>
  <span class="caption-jobs-title"></span>
  <ul class="caption-jobs-list"></ul>
</div>
<div class="captions" aria-hidden="true"><span class="cue" hidden></span></div>
<div class="sign" role="group" hidden>
  <div class="sign-bar">
    <button type="button" data-a="sign-move" data-la="moveResize" aria-pressed="false">✥</button>
    <button type="button" data-a="sign-dock" data-la="dockCorner">◰</button>
    <button type="button" data-a="sign-reset" data-la="resetSign">↺</button>
  </div>
  <div class="sign-media"></div>
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
    'braille-export',
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
  #signMediaHost: HTMLElement | null = null
  /** Native `<video>` or isolated YouTube follower in the floating sign window. */
  #signVideo: SignPlayable | null = null
  #boundSignMedia = new WeakSet<object>()
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
  #offline: OfflineSnapshot = { status: 'idle', progress: 0 }
  #offlineBusy = false
  #cachedObjectUrls: string[] = []
  /** Network URLs for Cache API download/remove (kept when boot remaps src to blob:). */
  #offlineNetwork: OfflineLessonAssets | null = null
  /** Live caption-api session so Refresh can re-POST without restarting the whole player. */
  #captionApi: {
    api: string
    videoUrl: string
    languages: string[]
    sourceLanguage?: string
    controller: AbortController
    have: Set<string>
    blobs: string[]
  } | null = null
  #captionStatus: CaptionStatus | null = null
  #brailleBusy = false

  constructor() {
    super()
    this.#shadow = this.attachShadow({ mode: 'open' })
    this.#shadow.innerHTML = `<style>${PLAYER_CSS}</style>${TEMPLATE}`
    this.#shadow.addEventListener('click', (ev) => {
      const refresh = (ev.target as Element).closest<HTMLElement>('[data-caption-refresh]')
      if (refresh) {
        ev.preventDefault()
        ev.stopPropagation()
        this.#retryCaptionLanguage(refresh.dataset.captionRefresh || '')
        return
      }
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
    void hydrateSettings().then((settings) => {
      if (settings) this.#settings = settings
    })
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

  get currentTime(): number {
    return this.#engine?.currentTime ?? 0
  }

  set currentTime(seconds: number) {
    this.seek(seconds)
  }

  get duration(): number {
    return this.#engine?.duration ?? 0
  }

  get volume(): number {
    return this.#engine?.volume ?? 1
  }

  set volume(value: number) {
    if (this.#engine) this.#engine.volume = value
  }

  get playbackRate(): number {
    return this.#engine?.playbackRate ?? 1
  }

  set playbackRate(value: number) {
    if (this.#engine) this.#engine.playbackRate = value
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
      // Attribute shortcut for hosts that do not use a full manifest.
      const packAttr = this.getAttribute('offline-pack')
      if (packAttr && !config.offlinePack)
        config.offlinePack = new URL(packAttr, document.baseURI).href

      const keys = this.getAttribute('controls-keys')
      if (keys === 'off' || keys === 'focus') this.#settings.controlsKeys = keys
      const preferred = this.#settings.captionsLang
      // undefined = never chosen (keep HTML/manifest defaults). '' = viewer turned captions off.
      if (preferred !== undefined) {
        if (preferred === '' || config.tracks.some((tr) => tr.lang === preferred)) {
          for (const tr of config.tracks)
            if (tr.kind === 'captions' || tr.kind === 'subtitles')
              tr.default = preferred !== '' && tr.lang === preferred
        }
      }

      const offlineAssets = this.#offlineAssets(config)
      this.#offlineNetwork = offlineAssets
      this.#offline = await getOfflineSnapshot(offlineAssets.id)
      // When the network is down, remount from Cache API object URLs (audio-first).
      if (canUseOfflineApis() && !navigator.onLine) {
        const cached = await resolveCachedPlayback(offlineAssets)
        if (cached?.mediaUrl) {
          this.#revokeCachedUrls()
          this.#cachedObjectUrls = cached.objectUrls
          config = {
            ...config,
            src: cached.mediaUrl,
            audio: cached.mediaUrl,
            poster: config.poster
              ? (cached.trackUrls.get(config.poster) ?? config.poster)
              : undefined,
            tracks: config.tracks.map((tr) => ({
              ...tr,
              src: cached.trackUrls.get(tr.src) ?? tr.src,
            })),
          }
          if (cached.transcriptHtml) this.#trHtml = cached.transcriptHtml
          this.#audioOnly = true
        }
      }
      if (boot !== this.#boots) return
      const src = config.src
      if (!src) throw new Error('Set the src or manifest attribute')

      const engine = await createEngine(this.getAttribute('engine'))
      if (boot !== this.#boots) return
      if (
        engine.kind === 'native' &&
        isYouTube({ src, type: this.getAttribute('type') })
      ) {
        throw new Error(
          'YouTube sources need the Video.js build (abol-player.js), not the lite build',
        )
      }
      this.#config = config
      this.#engine = engine
      engine.mount(this.#q('.stage'), {
        src,
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
      this.#reflectOffline()
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
    // Tracks the host supplied win over generated ones in the same language.
    const have = new Set(
      config.tracks
        .filter((tr) => tr.kind === 'captions' || tr.kind === 'subtitles')
        .map((tr) => tr.lang),
    )
    this.#captionApi = {
      api: new URL(api, document.baseURI).href,
      videoUrl: config.src,
      languages: request.languages,
      // Trust the host's lang / captions-lang when present; otherwise the API assumes English.
      sourceLanguage:
        this.getAttribute('lang')?.trim() ||
        this.getAttribute('captions-lang')?.trim() ||
        undefined,
      controller,
      have,
      blobs,
    }
    this.#off.push(() => {
      controller.abort()
      for (const url of blobs) URL.revokeObjectURL(url)
      if (this.#captionApi?.controller === controller) {
        this.#captionApi = null
        this.#captionStatus = null
      }
    })
    this.#runCaptionWatch(engine, false)
  }

  /** Poll (and optionally force-generate) using the current caption-api session. */
  #runCaptionWatch(engine: MediaEngine, forceGenerate: boolean): void {
    const session = this.#captionApi
    if (!session) return
    const signal = session.controller.signal
    let announced = false
    const run = forceGenerate ? retryCaptions : watchCaptions
    run({
      api: session.api,
      videoUrl: session.videoUrl,
      languages: session.languages,
      sourceLanguage: session.sourceLanguage,
      signal,
      forceGenerate,
      onStatus: (status) => {
        this.#captionStatus = status
        this.#renderCaptionJobs(status, session.languages)
        this.#refreshAvailability()
        if (status.status === 'processing' && !announced) {
          announced = true
          this.#announce(t(this.#lang, 'captionsGenerating'))
        }
        this.#emit('abol:captions', {
          status: status.status,
          jobs: status.jobs,
          languages: status.captions.map((c) => c.language),
        })
      },
      onCaption: (caption, vtt) => {
        if (session.have.has(caption.language)) return
        session.have.add(caption.language)
        const src = URL.createObjectURL(new Blob([vtt], { type: 'text/vtt' }))
        session.blobs.push(src)
        const label = languageName(caption.language, this.#lang)
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
    })
      .catch((err: unknown) => {
        if (signal.aborted) return
        console.warn('[abol-player] Caption API:', err)
        this.#renderCaptionJobsError(err instanceof Error ? err.message : String(err))
        this.#emit('abol:captions', {
          status: 'error',
          message: err instanceof Error ? err.message : String(err),
        })
      })
      .finally(() => {
        if (!signal.aborted) this.#hideCaptionJobsSoon()
      })
  }

  /**
   * Re-request generate for a failed language (or the transcript when `lang` is empty / source).
   * Aborts the previous poll loop and starts a fresh force-generate watch.
   */
  #retryCaptionLanguage(lang: string): void {
    const session = this.#captionApi
    const engine = this.#engine
    if (!session || !engine) return
    const source =
      session.sourceLanguage?.split(/[-_]/)[0]?.toLowerCase() ||
      this.#captionStatus?.captions.find((c) => c.kind === 'transcript')?.language ||
      'en'
    // Empty / source lang → ask for all configured languages (transcript may also be missing).
    const languages =
      !lang || lang === source
        ? session.languages
        : Array.from(new Set([...session.languages, lang]))
    session.languages = languages
    session.controller.abort()
    const controller = new AbortController()
    session.controller = controller
    this.#off.push(() => controller.abort())
    this.#announce(t(this.#lang, 'captionsRetry'))
    this.#runCaptionWatch(engine, true)
  }

  #mountOverlays(engine: MediaEngine, config: LessonConfig): void {
    const layers = document.createElement('div')
    layers.className = 'layers'
    layers.innerHTML = OVERLAYS
    engine.overlay.append(layers)
    this.#layers = layers
    this.#cue = layers.querySelector('.cue')
    this.#sign = layers.querySelector('.sign')
    this.#signMediaHost = layers.querySelector('.sign-media')
    if (!config.sign || !this.#sign || !this.#signMediaHost) return

    const sign = this.#sign
    // Defer YouTube sign mount so the main lesson's <youtube-video> can claim the IFrame API first.
    const mount = () => {
      if (!this.#signMediaHost || !this.#config?.sign || !this.#engine) return
      this.#signVideo = mountSignMedia(this.#signMediaHost, this.#config.sign.src)
      this.#bindSignMedia(this.#engine)
      this.#showSign()
    }
    if (/youtube|youtu\.be/i.test(config.sign.src)) {
      window.setTimeout(mount, 0)
    } else {
      mount()
    }
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
    const on = (event: EngineEvent, handler: () => void) =>
      this.#off.push(engine.on(event, handler))
    const listen = (target: EventTarget, type: string, handler: (ev: Event) => void) => {
      target.addEventListener(type, handler)
      this.#off.push(() => target.removeEventListener(type, handler))
    }

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

    // Main lesson is the clock. Resolve sign media dynamically (YouTube sign mounts deferred).
    const followPlay = () => {
      const sign = this.#signVideo
      if (!sign || !this.#signShown() || engine.paused) return
      void sign.play().catch(noop)
    }
    const followPause = () => {
      const sign = this.#signVideo
      if (!sign) return
      try {
        sign.pause()
      } catch {
        /* ignore */
      }
    }
    on('play', followPlay)
    on('playing', followPlay)
    on('pause', followPause)
    on('waiting', followPause)
    on('ratechange', () => {
      const sign = this.#signVideo
      if (!sign) return
      try {
        sign.playbackRate = engine.playbackRate
      } catch {
        /* ignore */
      }
    })
    this.#bindSignMedia(engine)

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

  /** Sign-only listeners (rogue autoplay / errors). Safe to call again after deferred YouTube mount. */
  #bindSignMedia(engine: MediaEngine): void {
    const sign = this.#signVideo
    if (!sign || this.#boundSignMedia.has(sign)) return
    this.#boundSignMedia.add(sign)
    const blockRoguePlay = () => {
      if (engine.paused || !this.#signShown()) {
        try {
          sign.pause()
        } catch {
          /* ignore */
        }
      }
    }
    sign.addEventListener('play', blockRoguePlay)
    sign.addEventListener('playing', blockRoguePlay)
    sign.addEventListener('error', () => {
      if (this.#sign) this.#sign.hidden = true
    })
    try {
      sign.pause()
    } catch {
      /* ignore */
    }
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
    // Refresh lives beside failed language rows in the captions menu (not a radio value).
    const onClick = (ev: Event) => {
      const refresh = (ev.target as Element | null)?.closest?.<HTMLElement>('[data-caption-refresh]')
      if (!refresh || !controls.contains(refresh)) return
      ev.preventDefault()
      ev.stopPropagation()
      this.#retryCaptionLanguage(refresh.dataset.captionRefresh || '')
    }
    controls.addEventListener('value-change', onValue)
    controls.addEventListener('click', onClick, true)
    this.#off.push(() => {
      controls.removeEventListener('value-change', onValue)
      controls.removeEventListener('click', onClick, true)
    })
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
    const jobUi = this.#captionJobMenuActive()
    // YouTube / CueTrack: our abol-option-group owns the list. Hide Video.js's media-captions-radio-group so
    // Off/English are not listed twice (YouTube-native + host/API tracks). Also show while API jobs run.
    const useCustomCaptions = !!this.#engine?.customTracks && (captions.length > 0 || jobUi)
    const available: Partial<Record<OptionKey | 'captionTrack', boolean>> = {
      adMode: !!this.#descTrack(),
      signVisible: !!config?.sign,
      audioOnly: !!config?.audio,
      captionTrack: useCustomCaptions,
      // Caption style is in the settings menu (1-level); always offer it.
      fontScale: true,
      color: true,
      background: true,
      backgroundOpacity: true,
      position: true,
      edge: true,
    }
    type Group = HTMLElement & {
      unavailable: boolean
      setChoices?(choices: Array<[string, string]>): void
    }
    for (const [key, ok] of Object.entries(available)) {
      // Video.js menu: the group reports to its menu, which hides the parent item.
      for (const group of this.#all<Group>(`abol-option-group[data-opt="${key}"]`))
        group.unavailable = !ok
      for (const label of this.#all(`label:has(> [data-s="${key}"])`)) label.hidden = !ok
      for (const item of this.#all(`media-menu-item[data-page="abol-opt-${key}"]`))
        item.hidden = !ok
    }
    for (const menu of this.#all<HTMLElement>('#abol-captions-menu'))
      menu.toggleAttribute('data-abol-custom-captions', useCustomCaptions)
    for (const group of this.#all<Group>('abol-option-group[data-opt="captionTrack"]')) {
      // Template starts hidden; show only while we own the track list (CSS also gates on the menu flag).
      group.hidden = !useCustomCaptions
      if (useCustomCaptions) {
        const trackLabel = (tr: TextTrack) => {
          const raw = tr.label?.trim()
          if (raw && raw.toLowerCase() !== tr.language.toLowerCase()) return raw
          return languageName(tr.language, this.#lang) || tr.language || raw || ''
        }
        group.setChoices?.([
          ['', t(this.#lang, 'off')],
          ...captions.map((tr): [string, string] => [tr.language, trackLabel(tr)]),
        ])
      }
    }
    this.#renderCaptionMenuStatus()
    if (useCustomCaptions) this.#reflectCaptions()
    for (const node of this.#all(toggles('transcript'))) node.hidden = !this.#hasTranscript()
    for (const node of this.#all(toggles('sign'))) node.hidden = !config?.sign
    this.#reflectBrailleExport()
    this.#reflectOffline()
  }

  /** Hosts may set `braille-export="off"` to hide the control even when Amharic cues exist. */
  #brailleExportAllowed(): boolean {
    const raw = this.getAttribute('braille-export')?.trim().toLowerCase()
    return raw !== 'off' && raw !== 'false' && raw !== '0'
  }

  #amharicCaptionTrack(): TextTrack | undefined {
    return this.#captionTracks().find((tr) => tr.language.split(/[-_]/)[0]?.toLowerCase() === 'am')
  }

  #amharicCueTexts(): string[] {
    const track = this.#amharicCaptionTrack()
    if (!track) return []
    if (track.mode === 'disabled') track.mode = 'hidden'
    return Array.from(track.cues ?? [])
      .map((cue) => cueText(cue))
      .filter(Boolean)
  }

  #reflectBrailleExport(): void {
    const show =
      this.#brailleExportAllowed() &&
      !!this.#amharicCaptionTrack() &&
      this.#amharicCueTexts().length > 0
    const short = this.#brailleBusy
      ? t(this.#lang, 'exportBrailleBusy')
      : t(this.#lang, 'exportBraille')
    const label = `${short} — ${t(this.#lang, 'exportBrailleExperimental')}`
    for (const btn of this.#all(toggles('braille-export'))) {
      btn.hidden = !show
      btn.setAttribute('aria-label', label)
      // Native bar has no Video.js tooltip; control-bar tips come from data-abol-tip.
      if (btn.matches('.bar [data-a]')) {
        btn.title = label
        btn.textContent = short
        ;(btn as HTMLButtonElement).disabled = this.#brailleBusy
      } else {
        btn.removeAttribute('title')
        btn.removeAttribute('aria-pressed')
        btn.toggleAttribute('disabled', this.#brailleBusy)
        btn.setAttribute('aria-disabled', String(this.#brailleBusy))
      }
    }
    for (const tip of this.#all('[data-abol-tip="braille-export"]')) tip.textContent = short
  }

  async #exportBraille(): Promise<void> {
    if (this.#brailleBusy || !this.#brailleExportAllowed()) return
    const lines = this.#amharicCueTexts()
    if (!lines.length) {
      this.#announce(t(this.#lang, 'exportBrailleFailed'))
      return
    }
    this.#brailleBusy = true
    this.#reflectBrailleExport()
    this.#announce(t(this.#lang, 'exportBrailleBusy'))
    try {
      const companion = await ensureBrailleCompanion()
      const result = await exportBrfFromLines({
        lines,
        title: this.#config?.title,
        translateFn: (text, table) => companion.translate(text, table),
      })
      downloadBrf(result.bytes, result.filename)
      this.#announce(
        `${t(this.#lang, 'exportBrailleReady')}. ${t(this.#lang, 'exportBrailleExperimental')}`,
      )
      this.#emit('abol:braille', {
        status: 'ready',
        filename: result.filename,
        cueCount: result.cueCount,
        experimental: true,
      })
    } catch (err) {
      console.warn('[abol-player] Braille export:', err)
      this.#announce(t(this.#lang, 'exportBrailleFailed'))
      this.#emit('abol:braille', {
        status: 'error',
        message: err instanceof Error ? err.message : String(err),
      })
    } finally {
      this.#brailleBusy = false
      this.#reflectBrailleExport()
    }
  }

  /** True while the caption API still has in-flight or failed languages to surface in the menu. */
  #captionJobMenuActive(): boolean {
    const status = this.#captionStatus
    if (!status || !this.#captionApi) return false
    if (status.status === 'processing' || status.status === 'failed') return true
    return status.jobs.some((j) => j.status === 'queued' || j.status === 'running' || j.status === 'failed')
  }

  /**
   * Per-language generation rows under the captions track list: EN/source first, then translations.
   * Failed rows get a Refresh control; ready languages stay in the radio group only.
   */
  #renderCaptionMenuStatus(): void {
    const session = this.#captionApi
    const status = this.#captionStatus
    for (const host of this.#all<HTMLElement>('.abol-caption-status')) {
      if (!session || !status || !this.#captionJobMenuActive()) {
        host.hidden = true
        host.replaceChildren()
        continue
      }
      const source = session.sourceLanguage?.split(/[-_]/)[0]?.toLowerCase() || 'en'
      const ready = new Set(this.#captionTracks().map((tr) => tr.language))
      const rows = orderCaptionStatusRows(status, session.languages, source).filter(
        (row) => row.state !== 'succeeded' || !ready.has(row.language),
      )
      // Drop succeeded rows that already appear as selectable tracks.
      const pending = rows.filter((row) => !ready.has(row.language))
      if (!pending.length) {
        host.hidden = true
        host.replaceChildren()
        continue
      }
      host.hidden = false
      host.replaceChildren(
        ...pending.map((row) => {
          const el = document.createElement('div')
          el.className = 'abol-caption-status-row'
          el.dataset.state = row.state
          el.dataset.lang = row.language
          const name = document.createElement('span')
          name.className = 'abol-caption-status-lang'
          name.textContent = languageName(row.language, this.#lang) || row.language
          const meta = document.createElement('span')
          meta.className = 'abol-caption-status-meta'
          meta.textContent = this.#captionStateLabel(row.state, row.progress)
          el.append(name, meta)
          if (row.state === 'failed') {
            const btn = document.createElement('button')
            btn.type = 'button'
            btn.className = 'abol-caption-refresh'
            btn.dataset.captionRefresh = row.language
            btn.textContent = t(this.#lang, 'captionsRefresh')
            btn.setAttribute('aria-label', `${t(this.#lang, 'captionsRefresh')}: ${name.textContent}`)
            el.append(btn)
          }
          return el
        }),
      )
    }
  }

  #captionStateLabel(state: string, progress?: number): string {
    if (state === 'succeeded') return t(this.#lang, 'captionsReady')
    if (state === 'failed') return t(this.#lang, 'captionsFailed')
    if (state === 'running')
      return `${t(this.#lang, 'captionsGenerating')}${progress != null ? ` ${progress}%` : ''}`
    return t(this.#lang, 'captionsQueued')
  }

  #offlineAssets(config: LessonConfig): OfflineLessonAssets {
    const urls = [
      config.audio,
      config.poster,
      config.transcript,
      ...config.tracks.map((tr) => tr.src),
    ].filter((u): u is string => !!u && !u.startsWith('blob:'))
    return {
      id: lessonIdFrom(config.id, config.src ?? config.audio),
      title: config.title,
      urls,
      mediaUrl: config.audio?.startsWith('blob:') ? undefined : config.audio,
      transcriptUrl: config.transcript?.startsWith('blob:') ? undefined : config.transcript,
      offlinePackUrl: config.offlinePack,
    }
  }

  #reflectOffline(): void {
    const assets = this.#offlineNetwork
    const canCache = canUseOfflineApis() && !!assets?.urls.length
    const ready = this.#offline.status === 'ready'
    const downloading = this.#offline.status === 'downloading'
    const labelKey =
      downloading
        ? 'downloadingOffline'
        : ready
          ? 'removeOffline'
          : this.#offline.status === 'error'
            ? 'offlineError'
            : 'downloadOffline'
    const label = t(this.#lang, labelKey)
    for (const node of this.#all(toggles('offline'))) {
      node.hidden = !canCache
      node.setAttribute('aria-label', label)
      node.title = label
      if ('active' in node) (node as HTMLElement & { active: boolean }).active = ready
      else node.setAttribute('aria-pressed', String(ready))
      if (node.hasAttribute('data-l')) node.textContent = label
    }
    for (const tip of this.#all('[data-abol-tip="offline"]')) tip.textContent = label
    const pack = this.#config?.offlinePack
    for (const link of this.#all<HTMLAnchorElement>('a.offline-pack, a[data-a="offline-pack"]')) {
      link.hidden = !pack
      if (pack) {
        link.href = pack
        const packLabel = t(this.#lang, 'offlinePackLink')
        link.setAttribute('aria-label', packLabel)
        link.title = packLabel
        link.textContent = packLabel
      }
    }
  }

  async #toggleOffline(): Promise<void> {
    if (this.#offlineBusy || !this.#config) return
    const assets =
      this.#offlineNetwork ??
      (this.#config ? this.#offlineAssets(this.#config) : null)
    if (!assets) return
    if (!assets.urls.length) {
      if (assets.offlinePackUrl) window.open(assets.offlinePackUrl, '_blank', 'noopener')
      return
    }
    if (!canUseOfflineApis()) {
      if (assets.offlinePackUrl) window.open(assets.offlinePackUrl, '_blank', 'noopener')
      return
    }
    this.#offlineBusy = true
    try {
      if (this.#offline.status === 'ready') {
        await removeLesson(assets.id)
        this.#offline = { status: 'idle', progress: 0 }
        this.#announce(t(this.#lang, 'downloadOffline'))
      } else {
        this.#offline = await downloadLesson(assets, (snap) => {
          this.#offline = snap
          this.#reflectOffline()
          if (snap.status === 'downloading') {
            const pct = Math.round((snap.progress || 0) * 100)
            this.#announce(`${t(this.#lang, 'downloadingOffline')} ${pct}%`)
          }
        })
        if (this.#offline.status === 'ready') this.#announce(t(this.#lang, 'offlineReady'))
        else if (this.#offline.status === 'error')
          this.#announce(this.#offline.error || t(this.#lang, 'offlineError'))
      }
    } catch (err) {
      this.#offline = {
        status: 'error',
        progress: this.#offline.progress,
        error: err instanceof Error ? err.message : String(err),
      }
      this.#announce(t(this.#lang, 'offlineError'))
    } finally {
      this.#offlineBusy = false
      this.#reflectOffline()
    }
  }

  #revokeCachedUrls(): void {
    for (const url of this.#cachedObjectUrls) URL.revokeObjectURL(url)
    this.#cachedObjectUrls = []
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
    // Do not persist "off" from the first reflection — tracks may still be loading, and an empty
    // captionsLang in localStorage would force every default=false on the next boot.
    if (!initial || lang) {
      this.#settings.captionsLang = lang
      saveSettings(this.#settings)
    }
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
    if (!sign || !video || !this.#signShown()) return
    // Without the main lesson playing, the sign window must not run on its own.
    if (video.paused) {
      if (!sign.paused) {
        try {
          sign.pause()
        } catch {
          /* ignore */
        }
      }
      return
    }
    if (sign.readyState === 0) return
    try {
      if (force || Math.abs(sign.currentTime - video.currentTime) > DRIFT_S) {
        sign.currentTime = video.currentTime
      }
      if (sign.paused) void sign.play().catch(noop)
    } catch {
      /* YouTube seek/play can fail while the iframe boots */
    }
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
    // Stop the sign media downloading while the viewer saves bandwidth.
    if (on) {
      unloadSignMedia(this.#signVideo, this.#signMediaHost)
      this.#signVideo = null
    } else if (config.sign && this.#signMediaHost && this.#engine) {
      this.#signVideo = mountSignMedia(this.#signMediaHost, config.sign.src)
      this.#bindSignMedia(this.#engine)
    }
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
    const badge = this.#q<HTMLElement>('.tr-lang')
    const label = languageName(lang, this.#lang)
    badge.hidden = !items.length || !label
    badge.textContent = label
    this.#search(this.#trQuery)
    this.#syncTranscript(true)
    this.#reflectBrailleExport()
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
      case 'offline':
        void this.#toggleOffline()
        return
      case 'offline-pack':
        return
      case 'braille-export':
        void this.#exportBraille()
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
    this.#reflectBrailleExport()
    this.#reflectOffline()
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

  /** Live multi-language caption job strip while the API is generating tracks. */
  #renderCaptionJobs(status: CaptionStatus, wanted: string[]): void {
    const panel = this.#layers?.querySelector<HTMLElement>('.caption-jobs')
    if (!panel) return
    const title = panel.querySelector('.caption-jobs-title')
    const list = panel.querySelector('.caption-jobs-list')
    if (!title || !list) return

    const source =
      this.#captionApi?.sourceLanguage?.split(/[-_]/)[0]?.toLowerCase() || 'en'
    const rows = orderCaptionStatusRows(status, wanted, source)
    const active = rows.filter((row) => row.state === 'queued' || row.state === 'running')
    const failed = rows.filter((row) => row.state === 'failed')
    const transcriptPending = rows.some(
      (row) => row.kind === 'transcript' && row.state !== 'succeeded',
    )

    if (status.status === 'ready' && active.length === 0 && failed.length === 0) {
      panel.hidden = true
      panel.removeAttribute('data-state')
      return
    }

    panel.hidden = false
    panel.dataset.state =
      status.status === 'failed' || (failed.length > 0 && active.length === 0)
        ? 'failed'
        : 'processing'

    if (panel.dataset.state === 'failed') {
      title.textContent = t(this.#lang, 'captionsFailed')
    } else if (transcriptPending) {
      title.textContent = t(this.#lang, 'captionsTranscribing')
    } else if (active.some((row) => row.kind === 'translation')) {
      title.textContent = t(this.#lang, 'captionsTranslating')
    } else {
      title.textContent = t(this.#lang, 'captionsGenerating')
    }

    list.replaceChildren(
      ...rows.map((row) => {
        const li = document.createElement('li')
        li.dataset.state = row.state
        li.dataset.lang = row.language
        const name = document.createElement('span')
        name.className = 'caption-jobs-lang'
        name.textContent = languageName(row.language, this.#lang) || row.language
        const meta = document.createElement('span')
        meta.className = 'caption-jobs-meta'
        meta.textContent = this.#captionStateLabel(row.state, row.progress)
        li.append(name, meta)
        if (row.state === 'failed') {
          const btn = document.createElement('button')
          btn.type = 'button'
          btn.className = 'caption-jobs-refresh'
          btn.dataset.captionRefresh = row.language
          btn.textContent = t(this.#lang, 'captionsRefresh')
          btn.setAttribute(
            'aria-label',
            `${t(this.#lang, 'captionsRefresh')}: ${name.textContent}`,
          )
          li.append(btn)
        }
        return li
      }),
    )
  }

  #renderCaptionJobsError(message: string): void {
    const panel = this.#layers?.querySelector<HTMLElement>('.caption-jobs')
    if (!panel) return
    panel.hidden = false
    panel.dataset.state = 'failed'
    const title = panel.querySelector('.caption-jobs-title')
    const list = panel.querySelector('.caption-jobs-list')
    if (title) title.textContent = t(this.#lang, 'captionsFailed')
    if (list) {
      list.replaceChildren()
      const li = document.createElement('li')
      li.dataset.state = 'failed'
      const text = document.createElement('span')
      text.className = 'caption-jobs-lang'
      text.textContent = message
      const btn = document.createElement('button')
      btn.type = 'button'
      btn.className = 'caption-jobs-refresh'
      btn.dataset.captionRefresh = ''
      btn.textContent = t(this.#lang, 'captionsRefresh')
      btn.setAttribute('aria-label', t(this.#lang, 'captionsRetry'))
      li.append(text, btn)
      list.append(li)
    }
  }

  #hideCaptionJobsSoon(): void {
    const panel = this.#layers?.querySelector<HTMLElement>('.caption-jobs')
    if (!panel || panel.dataset.state === 'failed') return
    window.setTimeout(() => {
      if (panel.dataset.state !== 'failed') panel.hidden = true
    }, 2500)
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
    unloadSignMedia(this.#signVideo, this.#signMediaHost)
    this.#engine?.destroy()
    this.#engine = null
    this.#layers = this.#cue = this.#sign = this.#signMediaHost = this.#signVideo = null
    this.#boundTracks = new WeakSet()
    this.#clips = []
    this.#lastAd = null
    this.#captionLang = null
    this.#audioOnly = false
    this.#moveMode = false
    this.#offlineBusy = false
    this.#offlineNetwork = null
    this.#revokeCachedUrls()
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
