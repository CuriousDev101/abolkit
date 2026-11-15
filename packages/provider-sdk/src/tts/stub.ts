import type { LangCode, Tts } from '../types.ts'

/** Minimal silent-ish WAV (very short) so pipeline tests can run without audio assets. */
function silentWavBytes(): Uint8Array {
  // 44-byte header + 0 samples is invalid for some players; include 1 frame of silence.
  const dataSize = 2
  const buffer = new ArrayBuffer(44 + dataSize)
  const view = new DataView(buffer)
  const bytes = new Uint8Array(buffer)
  const writeStr = (offset: number, s: string) => {
    for (let i = 0; i < s.length; i++) bytes[offset + i] = s.charCodeAt(i)
  }
  writeStr(0, 'RIFF')
  view.setUint32(4, 36 + dataSize, true)
  writeStr(8, 'WAVE')
  writeStr(12, 'fmt ')
  view.setUint32(16, 16, true)
  view.setUint16(20, 1, true) // PCM
  view.setUint16(22, 1, true) // mono
  view.setUint32(24, 16000, true)
  view.setUint32(28, 32000, true)
  view.setUint16(32, 2, true)
  view.setUint16(34, 16, true)
  writeStr(36, 'data')
  view.setUint32(40, dataSize, true)
  return bytes
}

/** Offline stand-in TTS that returns a tiny silent WAV (no network). */
export function createStubTts(): Tts {
  return {
    id: 'stub',
    label: 'Stub TTS (silent)',
    sendsDataOffHost: false,
    languages(): LangCode[] {
      return ['en', 'am']
    },
    async synthesize() {
      return { bytes: silentWavBytes(), mime: 'audio/wav' }
    },
  }
}
