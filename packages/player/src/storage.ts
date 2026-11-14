import type { PlayerSettings } from '@abolkit/core'
import { mergeSettings } from '@abolkit/core'

const KEY = 'abol-player-settings'

/** Load viewer settings; works when storage is empty or blocked. */
export function loadSettings(): PlayerSettings {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return mergeSettings()
    return mergeSettings(JSON.parse(raw) as Partial<PlayerSettings>)
  } catch {
    return mergeSettings()
  }
}

export function saveSettings(settings: PlayerSettings): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(settings))
  } catch {
    // storage blocked — ignore
  }
}
