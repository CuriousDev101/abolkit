// @abolkit/core: shared, dependency-free code used by the player, the API and the worker.
// Owner: pair "ab". Reviewer: pair "ol". See docs-internal/modules/player.md and captions contract in architecture.md.

export type { Cue } from './cue.js'
export { cueAt, hasUnreviewed } from './cue.js'

export { parseVtt, serializeVtt } from './vtt.js'

export type {
  AdClip,
  CaptionTrack,
  DescriptionTrack,
  LessonManifest,
  LessonMedia,
  SignTrack,
} from './manifest.js'
export { isLessonManifest } from './manifest.js'

export type {
  AdMode,
  CaptionStyle,
  ControlsKeys,
  PlayerSettings,
  SignWindowLayout,
} from './settings.js'
export {
  DEFAULT_CAPTION_STYLE,
  DEFAULT_PLAYER_SETTINGS,
  DEFAULT_SIGN_LAYOUT,
  mergeSettings,
} from './settings.js'

export type { UiLang, UiStringKey } from './i18n.js'
export { isUiStringKey, resolveUiLang, t } from './i18n.js'

export { captionLangAnnouncement, formatTime, MIN_TARGET_PX, shouldReduceMotion } from './a11y.js'
