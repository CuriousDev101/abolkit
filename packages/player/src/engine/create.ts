import type { MediaEngine } from '../engine.js'
import { NativeEngine } from './native.js'

/** Set by build.mjs: false for the lite bundle, so the Video.js branch is dropped entirely. */
declare const __ABOL_VIDEOJS__: boolean
/** Set by build.mjs: true only for the stream bundle, which adds Video.js's lightweight <hls-video>. */
declare const __ABOL_HLS__: boolean

export async function createEngine(kind?: string | null): Promise<MediaEngine> {
  if (__ABOL_VIDEOJS__ && kind !== 'native') {
    try {
      if (__ABOL_HLS__) await import('@videojs/html/media/hls-video')
      const { VideoJsEngine } = await import('./videojs.js')
      return new VideoJsEngine(__ABOL_HLS__)
    } catch (err) {
      console.warn('[abol-player] Video.js unavailable; using native controls.', err)
    }
  }
  return new NativeEngine()
}
