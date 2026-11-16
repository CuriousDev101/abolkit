// <abol-player> entry point. Owner: pair "ab".
import { capturePlayerScriptUrl, registerOfflineServiceWorker } from './offline/index.js'
import { registerAbolPlayer } from './player-element.js'

export type { EngineEvent, MediaEngine, MediaSource, MediaTrack } from './engine.js'
export type { LessonConfig } from './config.js'
export {
  GENERATABLE_LANGUAGES,
  orderCaptionStatusRows,
  orderCaptionsForDelivery,
  parseGenerateCaptions,
  retryCaptions,
  watchCaptions,
} from './caption-api.js'
export type { ApiCaption, ApiCaptionJob, CaptionStatus } from './caption-api.js'
export { AbolPlayerElement, registerAbolPlayer } from './player-element.js'
export { createEngine } from './engine/create.js'
export {
  canUseOfflineApis,
  downloadLesson,
  getOfflineSnapshot,
  lessonIdFrom,
  registerOfflineServiceWorker,
  removeLesson,
} from './offline/index.js'

capturePlayerScriptUrl(document.currentScript as HTMLScriptElement | null)
registerAbolPlayer()
void registerOfflineServiceWorker()
