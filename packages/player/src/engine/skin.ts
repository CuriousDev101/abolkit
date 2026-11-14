// <abol-skin>: the Video.js compat skin with our bottom-right control group (ADR 0001).
// Video.js 10 has no control-bar API; its documented route for adding or rearranging controls is to own the skin
// markup. We clone the packaged compat template and replace only that one group, so the rest of the skin
// (hotkeys, gestures, indicators, error dialog, styles) stays upstream.
import '@videojs/html/video/compat-skin'
import '@videojs/html/ui/playback-rate-button'
import {
  CaptionsButtonElement,
  MenuRadioGroupElement,
  type PropertyValues,
  UIElement,
} from '@videojs/html'
import { registerIcons } from '@videojs/html/icons'
import { qualityIcon } from '@videojs/html/icons/compat'
import { CompatVideoSkinElement } from '@videojs/html/video'
import { OPTIONS, type PlayerOption } from '../options.js'

export const TOGGLE_EVENT = 'abol-toggle'

const SVG =
  'xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="none" aria-hidden="true" viewBox="0 0 18 18"'
registerIcons('compat', {
  quality: qualityIcon,
  transcript: `<svg ${SVG}><rect width="14" height="14" x="2" y="2" stroke="currentColor" stroke-linejoin="round" stroke-width="2" rx="2"/><path stroke="currentColor" stroke-linecap="round" stroke-width="2" d="M5.5 6.5h7m-7 3h7m-7 3h4"/></svg>`,
  sign: `<svg ${SVG}><path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.75" d="M5.5 9.5V4.25a1.25 1.25 0 0 1 2.5 0V8.5m0-.5V2.75a1.25 1.25 0 0 1 2.5 0V8.5m0 0V3.75a1.25 1.25 0 0 1 2.5 0V10m0 0V6.25a1.25 1.25 0 0 1 2.5 0V11a5.5 5.5 0 0 1-5.5 5.5H9.2a4 4 0 0 1-2.9-1.25L2.9 11.7a1.3 1.3 0 0 1 1.85-1.8l.75.7V9.5"/></svg>`,
})

/**
 * A pressed/unpressed control-bar button (sign language window, transcript). State lives in <abol-player>; the
 * button reports activation as `abol-toggle` with its `data-action` and reflects `active`.
 */
export class ToggleButtonElement extends UIElement {
  static readonly tagName = 'abol-toggle-button'
  #abort: AbortController | null = null

  override connectedCallback(): void {
    super.connectedCallback()
    this.#abort?.abort()
    this.#abort = new AbortController()
    const { signal } = this.#abort
    this.setAttribute('role', 'button')
    this.setAttribute('tabindex', '0')
    if (!this.hasAttribute('aria-pressed')) this.setAttribute('aria-pressed', 'false')
    this.addEventListener('click', this.#activate, { signal })
    this.addEventListener(
      'keydown',
      (ev) => {
        if (ev.key === 'Enter') {
          ev.preventDefault()
          this.#activate()
        } else if (ev.key === ' ') ev.preventDefault()
      },
      { signal },
    )
    // ARIA button pattern: Space activates on keyup.
    this.addEventListener('keyup', (ev) => ev.key === ' ' && this.#activate(), { signal })
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback()
    this.#abort?.abort()
    this.#abort = null
  }

  get active(): boolean {
    return this.hasAttribute('data-active')
  }

  set active(on: boolean) {
    this.toggleAttribute('data-active', on)
    this.setAttribute('aria-pressed', String(on))
  }

  #activate = (): void => {
    this.dispatchEvent(
      new CustomEvent(TOGGLE_EVENT, {
        bubbles: true,
        composed: true,
        detail: { action: this.dataset.action },
      }),
    )
  }
}

/**
 * Video.js's captions button, but always the trigger of the captions menu (tracks plus caption style) instead of
 * toggling when there is a single track. The `c` hotkey still toggles captions through the base class.
 */
export class CaptionsMenuButtonElement extends CaptionsButtonElement {
  constructor() {
    super()
    // CaptionsButtonCore.getAttrs() also returns `hidden`, bypassing reflectsHidden() (Video.js 10.4.0).
    const core = this.core
    const getAttrs = core.getAttrs.bind(core)
    // The key must be absent, not undefined: applyElementProps would remove the menu's `hidden`.
    core.getAttrs = (state) => {
      const attrs = { ...getAttrs(state) }
      delete attrs.hidden
      return attrs as ReturnType<typeof getAttrs>
    }
  }

  protected override activate(_state: unknown, event?: UIEvent): void {
    // Pointer activation opens the menu through `commandfor`; keyboard activation is not routed there.
    if (!(event instanceof KeyboardEvent) || !this.commandfor) return
    const menu = (this.getRootNode() as ShadowRoot).getElementById(this.commandfor) as
      (HTMLElement & { open: boolean }) | null
    if (menu && 'open' in menu) menu.open = !menu.open
  }

  /** Available whenever the menu is: YouTube lessons can have host caption tracks that Video.js does not list. */
  protected override getIsButtonDisabled(): boolean {
    return !!this.disabled
  }

  /** The captions menu owns visibility; hiding ourselves before it binds would leave the button hidden for good. */
  protected override reflectsHidden(): boolean {
    return false
  }
}

const CHECK = `<media-menu-item-indicator force-mount class="media-menu-indicator"><media-icon family="compat" name="check" class="media-menu-radio-icon"></media-icon></media-menu-item-indicator>`
const radioItem = (value: string, label: string, l = true) =>
  `<media-menu-radio-item class="media-menu-radio-item" value="${value}"><span data-part="label"${l ? ` data-l="${label}"` : ''}></span>${CHECK}</media-menu-radio-item>`

/**
 * A menu radio group that reports to its menu like Video.js's media option groups do: the menu then writes the
 * selected label into the parent item's hint and hides that item (or the trigger) while `unavailable`.
 */
export class OptionGroupElement extends MenuRadioGroupElement {
  static override readonly tagName = 'abol-option-group'
  static override properties = {
    ...MenuRadioGroupElement.properties,
    unavailable: { type: Boolean },
  }
  declare unavailable: boolean

  #abort: AbortController | null = null

  constructor() {
    super()
    this.unavailable = false
  }

  override connectedCallback(): void {
    super.connectedCallback()
    this.#abort?.abort()
    this.#abort = new AbortController()
    // Video.js closes the page on every radio choice (completeMenuItemSelection). Caption style then jumps back a
    // page, so the choice looks like it did nothing. Keep the page open and apply the value ourselves.
    this.addEventListener(
      'click',
      (ev) => {
        const item = (ev.target as Element).closest('media-menu-radio-item')
        if (!item || !this.contains(item)) return
        ev.stopPropagation()
        const value = item.getAttribute('value') ?? ''
        if (this.value === value) return
        this.value = value
        this.dispatchEvent(new CustomEvent('value-change', { bubbles: true, detail: { value } }))
      },
      { capture: true, signal: this.#abort.signal },
    )
  }

  override disconnectedCallback(): void {
    this.#abort?.abort()
    this.#abort = null
    super.disconnectedCallback()
  }

  /** Replace the items; labels are shown as given (used for caption tracks, whose labels come from the host). */
  setChoices(choices: ReadonlyArray<readonly [string, string]>): void {
    this.innerHTML = choices.map(([value]) => radioItem(value, '', false)).join('')
    this.querySelectorAll('[data-part="label"]').forEach(
      (el, i) => (el.textContent = choices[i]![1]),
    )
  }

  protected override update(changed: PropertyValues): void {
    super.update(changed)
    this.publishMenuOptionState(
      false,
      this.unavailable,
      this.unavailable ? 'unavailable' : 'available',
    )
  }
}

const tooltip = (trigger: string, content: string) =>
  `<media-tooltip trigger="${trigger}" side="top" class="media-popup media-popup-safe-area media-popup-transition media-tooltip-popup">${content}</media-tooltip>`
const icon = (name: string, cls = 'media-button-icon') =>
  `<media-icon family="compat" name="${name}" class="${cls}"></media-icon>`
const LABEL_TIP =
  '<media-tooltip-label></media-tooltip-label><media-tooltip-shortcut class="media-tooltip-shortcut"></media-tooltip-shortcut>'
const HINT = `<span class="media-menu-hint"><span data-part="value" class="media-menu-hint-label"></span>${icon('chevron', 'media-menu-forward-chevron')}</span>`
const MENU =
  'class="media-popup media-popup-safe-area media-menu-popup media-menu-resizable-popup" side="top" align="center"'

/** One of Video.js's media option groups (audio, captions, speed, quality), items from its template. */
const mediaGroup = (group: string, extra = '') =>
  `<${group} class="media-menu-radio-group"><template><media-menu-radio-item class="media-menu-radio-item">
    <span data-part="label"></span>${extra}${CHECK}</media-menu-radio-item></template></${group}>`
const optionMenu = (id: string, group: string, extra = '') =>
  `<media-menu id="${id}" ${MENU}><media-menu-content class="media-menu-content">${mediaGroup(group, extra)}</media-menu-content></media-menu>`

const pageItem = (target: string, label: string, hint = HINT) =>
  `<media-menu-item commandfor="${target}" class="media-menu-item" data-page="${target}"><span data-l="${label}"></span>${hint}</media-menu-item>`
const back = (label: string) =>
  `<media-menu-item class="media-menu-back-item">${icon('chevron', 'media-menu-back-chevron')}<span data-l="${label}"></span></media-menu-item><media-menu-separator class="media-menu-separator"></media-menu-separator>`
const SEPARATOR = '<media-menu-separator class="media-menu-separator"></media-menu-separator>'
const optionPage = (option: PlayerOption) =>
  `<media-menu-content class="media-menu-content" id="abol-opt-${option.key}">${back(option.label)}
    <abol-option-group class="media-menu-radio-group" data-opt="${option.key}">${option.choices
      .map(([value, label]) => radioItem(value, label))
      .join('')}</abol-option-group></media-menu-content>`

const main = OPTIONS.filter((o) => o.group === 'main')
const caption = OPTIONS.filter((o) => o.group === 'caption')
const toggle = (action: string, name: string) =>
  `<abol-toggle-button class="media-button abol-toggle-button" id="abol-${action}-trigger" data-action="${action}" hidden>${icon(name)}</abol-toggle-button>
${tooltip(`abol-${action}-trigger`, `<span data-abol-tip="${action}"></span>`)}`

/** Left to right: sign language, transcript, audio, captions, speed, quality, settings. */
const CONTROLS = `
${toggle('sign', 'sign')}
${toggle('transcript', 'transcript')}

<button type="button" commandfor="abol-audio-menu" class="media-button" id="abol-audio-trigger" data-aria="audioTrack">${icon('speech')}</button>
${tooltip('abol-audio-trigger', '<media-text token="menu.audio">Audio</media-text>')}
${optionMenu('abol-audio-menu', 'media-audio-track-radio-group')}

<abol-captions-button commandfor="abol-captions-menu" class="media-button media-captions-button abol-captions-button" id="abol-captions-trigger">
  ${icon('captions-off', 'media-button-icon media-captions-button-off-icon')}${icon('captions-on', 'media-button-icon media-captions-button-on-icon')}
</abol-captions-button>
${tooltip('abol-captions-trigger', LABEL_TIP)}
<media-menu id="abol-captions-menu" ${MENU}>
  <media-menu-content class="media-menu-content">
    ${mediaGroup('media-captions-radio-group', '<span data-part="badge" class="media-menu-badge"></span>')}
    <abol-option-group class="media-menu-radio-group" data-opt="captionTrack"></abol-option-group>
    ${SEPARATOR}
    ${pageItem('abol-page-caption', 'captionSettings', icon('chevron', 'media-menu-forward-chevron'))}
  </media-menu-content>
  <media-menu-content class="media-menu-content" id="abol-page-caption">${back('captionSettings')}
    ${caption.map((o) => pageItem(`abol-opt-${o.key}`, o.label)).join('')}
  </media-menu-content>
  ${caption.map(optionPage).join('')}
</media-menu>

<media-playback-rate-button commandfor="abol-speed-menu" class="media-button abol-speed-button" id="abol-speed-trigger">${icon('speed')}</media-playback-rate-button>
${tooltip('abol-speed-trigger', LABEL_TIP)}
${optionMenu('abol-speed-menu', 'media-playback-rate-radio-group')}

<button type="button" commandfor="abol-quality-menu" class="media-button" id="abol-quality-trigger" data-aria="quality">${icon('quality')}</button>
${tooltip('abol-quality-trigger', '<media-text token="menu.quality">Quality</media-text>')}
${optionMenu('abol-quality-menu', 'media-quality-radio-group', '<span data-part="badge" class="media-menu-badge"></span>')}

<button type="button" commandfor="abol-settings-menu" class="media-button media-settings-button" id="abol-settings-trigger" data-aria="settings">
  ${icon('gear', 'media-button-icon media-settings-button-icon')}
</button>
${tooltip('abol-settings-trigger', '<media-text token="menu.settings">Settings</media-text>')}
<media-menu id="abol-settings-menu" ${MENU}>
  <media-menu-content class="media-menu-content">
    ${main.map((o) => pageItem(`abol-opt-${o.key}`, o.label)).join('')}
  </media-menu-content>
  ${main.map(optionPage).join('')}
</media-menu>`

/** Video.js's skin styles stop at its own controls; these cover ours. */
const SKIN_CSS = `
.abol-toggle-button { position: relative; }
.abol-toggle-button[data-active] { color: var(--media-accent-color, currentColor); }
.abol-toggle-button[data-active]::after {
  content: ""; position: absolute; left: 25%; right: 25%; bottom: 3px; height: 2px;
  border-radius: 1px; background: currentColor;
}
.abol-captions-button[data-abol-active] .media-captions-button-off-icon { display: none; }
.abol-captions-button[data-abol-active] .media-captions-button-on-icon { display: block; }
/* A choice page is a grandchild of the root. Video.js only slides the direct parent away, so the track list
   stayed underneath the choices and took the click. Slide the root away whenever any page of the menu is open. */
media-menu:has(> media-menu-content[data-submenu][data-open]) > media-menu-content:not([data-submenu]) {
  filter: blur(var(--media-hidden-blur, 8px));
  clip-path: inset(0 0 0 100%);
  transform: translateX(-100%);
  pointer-events: none;
}
media-menu:has(> media-menu-content[data-submenu][data-open]) > media-menu-content:not([data-submenu]):dir(rtl) {
  clip-path: inset(0 100% 0 0);
  transform: translateX(100%);
}
/* Transcript covers the right of the frame; the bars are absolutely positioned, so inset them. */
:host([data-transcript]) .video-controls-bottom { inset-inline-end: calc(var(--abol-transcript-width) + 8px); }
:host([data-transcript]) .video-controls-top { inset-inline-end: calc(var(--abol-transcript-width) + 12px); }
`

function buildTemplate(): HTMLTemplateElement {
  const base = CompatVideoSkinElement.template
  if (!base) throw new Error('Video.js compat skin template is missing')
  const template = base.cloneNode(true) as HTMLTemplateElement
  const group = template.content.querySelector(
    '.video-controls-row > .video-controls-group:last-child',
  )
  if (!group)
    throw new Error('Video.js compat skin layout changed: bottom-right control group not found')
  group.innerHTML = CONTROLS
  const style = document.createElement('style')
  style.textContent = SKIN_CSS
  template.content.prepend(style)
  return template
}

export const SKIN_TAG = 'abol-skin'

export class AbolSkinElement extends CompatVideoSkinElement {
  static override template = buildTemplate()
}

const ELEMENTS: Array<[string, CustomElementConstructor]> = [
  [ToggleButtonElement.tagName, ToggleButtonElement],
  ['abol-captions-button', CaptionsMenuButtonElement],
  [OptionGroupElement.tagName, OptionGroupElement],
]
for (const [tag, element] of ELEMENTS)
  if (!customElements.get(tag)) customElements.define(tag, element)
if (!customElements.get(SKIN_TAG)) customElements.define(SKIN_TAG, AbolSkinElement)
