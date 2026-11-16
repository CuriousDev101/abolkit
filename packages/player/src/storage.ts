import type { PlayerSettings } from '@abolkit/core'
import { mergeSettings } from '@abolkit/core'
import { getIdbSettings, putIdbSettings } from './offline/idb.js'

const KEY = 'abol-player-settings'

/** Sync load from localStorage; works when storage is empty or blocked. */
export function loadSettings(): PlayerSettings {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return mergeSettings()
    return mergeSettings(JSON.parse(raw) as Partial<PlayerSettings>)
  } catch {
    return mergeSettings()
  }
}

/**
 * Prefer IndexedDB when a settings record exists (offline docs / multi-tab), else keep localStorage.
 * Call once after connect; returns merged settings when IDB had a value.
 */
export async function hydrateSettings(): Promise<PlayerSettings | null> {
  const fromIdb = await getIdbSettings<Partial<PlayerSettings>>()
  if (!fromIdb) return null
  const merged = mergeSettings(fromIdb)
  try {
    localStorage.setItem(KEY, JSON.stringify(merged))
  } catch {
    // ignore
  }
  return merged
}

export function saveSettings(settings: PlayerSettings): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(settings))
  } catch {
    // storage blocked — ignore
  }
  void putIdbSettings(settings)
}
