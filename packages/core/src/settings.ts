/** Caption overlay appearance. Defaults keep ≥ 4.5:1 contrast. */
export interface CaptionStyle {
  /** Font scale relative to base (1 = 100%). */
  fontScale: number
  color: string
  background: string
  /** 0–1 */
  backgroundOpacity: number
  position: 'bottom' | 'top'
  edge: 'none' | 'shadow' | 'outline'
}

/** Position and width as percentages of the video frame, so the window scales with fullscreen. */
export interface SignWindowLayout {
  x: number
  y: number
  width: number
  dock: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | 'free'
}

export type AdMode = 'off' | 'text' | 'voice'
export type ControlsKeys = 'off' | 'focus'

export interface PlayerSettings {
  /** Last caption language the viewer chose; empty string means captions off. */
  captionsLang?: string
  captionStyle: CaptionStyle
  signVisible: boolean
  signLayout: SignWindowLayout
  adMode: AdMode
  /** Transcript sidebar open beside the video. */
  transcriptOpen: boolean
  /** Single-key shortcuts while the player has focus (WCAG 2.1.4). */
  controlsKeys: ControlsKeys
  volume: number
  muted: boolean
  reducedMotion: boolean
}

export const DEFAULT_CAPTION_STYLE: CaptionStyle = {
  fontScale: 1,
  color: '#ffffff',
  background: '#000000',
  backgroundOpacity: 0.75,
  position: 'bottom',
  edge: 'shadow',
}

export const DEFAULT_SIGN_LAYOUT: SignWindowLayout = {
  x: 2,
  y: 58,
  width: 28,
  dock: 'bottom-left',
}

/**
 * The previous default was top-right. Docking rewrites `x`, so a window the viewer never placed still has
 * `dock: top-right`, `y: 14` and `width: 28`.
 */
function isLegacySign(layout: Partial<SignWindowLayout> | undefined): boolean {
  return !!layout && layout.dock === 'top-right' && layout.y === 14 && layout.width === 28
}

export const DEFAULT_PLAYER_SETTINGS: PlayerSettings = {
  captionStyle: { ...DEFAULT_CAPTION_STYLE },
  signVisible: true,
  signLayout: { ...DEFAULT_SIGN_LAYOUT },
  adMode: 'off',
  transcriptOpen: false,
  controlsKeys: 'focus',
  volume: 1,
  muted: false,
  reducedMotion: false,
}

/** Shallow-merge partial settings onto defaults (pure; no storage). */
export function mergeSettings(partial?: Partial<PlayerSettings> | null): PlayerSettings {
  const base = DEFAULT_PLAYER_SETTINGS
  if (!partial) {
    return {
      ...base,
      captionStyle: { ...base.captionStyle },
      signLayout: { ...base.signLayout },
    }
  }
  return {
    ...base,
    ...partial,
    captionStyle: { ...base.captionStyle, ...partial.captionStyle },
    signLayout: isLegacySign(partial.signLayout) ? { ...DEFAULT_SIGN_LAYOUT } : { ...base.signLayout, ...partial.signLayout },
  }
}
