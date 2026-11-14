// @abolkit/core: shared, dependency-free code used by the player, the API and the worker.
// Owner: pair "ab". Reviewer: pair "ol". See docs-internal/modules/player.md and captions contract in architecture.md.

export type { Cue } from './cue.ts'
export { cueAt, hasUnreviewed } from './cue.ts'

export { parseVtt, serializeVtt } from './vtt.ts'

export type {
  AdClip,
  CaptionTrack,
  DescriptionTrack,
  LessonManifest,
  LessonMedia,
  SignTrack,
} from './manifest.ts'
export { isLessonManifest } from './manifest.ts'

export type {
  AdMode,
  CaptionStyle,
  ControlsKeys,
  PlayerSettings,
  SignWindowLayout,
} from './settings.ts'
export {
  DEFAULT_CAPTION_STYLE,
  DEFAULT_PLAYER_SETTINGS,
  DEFAULT_SIGN_LAYOUT,
  mergeSettings,
} from './settings.ts'

export type { UiLang, UiStringKey } from './i18n.ts'
export { isUiStringKey, resolveUiLang, t } from './i18n.ts'

export { captionLangAnnouncement, formatTime, MIN_TARGET_PX, shouldReduceMotion } from './a11y.ts'
