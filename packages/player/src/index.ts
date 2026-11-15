// <abol-player> entry point. Owner: pair "ab".
import { registerAbolPlayer } from './player-element.js'

export type { EngineEvent, MediaEngine, MediaSource, MediaTrack } from './engine.js'
export type { LessonConfig } from './config.js'
export {
  GENERATABLE_LANGUAGES,
  parseGenerateCaptions,
  watchCaptions,
} from './caption-api.js'
export type { ApiCaption, ApiCaptionJob, CaptionStatus } from './caption-api.js'
export { AbolPlayerElement, registerAbolPlayer } from './player-element.js'
export { createEngine } from './engine/create.js'

registerAbolPlayer()
