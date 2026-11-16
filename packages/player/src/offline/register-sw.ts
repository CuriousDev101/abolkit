/** Register the sibling service worker next to the player script when the page allows it. */

let playerScriptUrl = ''

/** Capture at module load so `document.currentScript` is still the player IIFE. */
export function capturePlayerScriptUrl(script: HTMLScriptElement | null | undefined): void {
  if (script?.src) playerScriptUrl = script.src
}

export function getPlayerScriptUrl(): string {
  return playerScriptUrl
}

function swUrlFromPlayerScript(): string | null {
  if (!playerScriptUrl) return null
  try {
    return new URL('abol-player.sw.js', playerScriptUrl).href
  } catch {
    return null
  }
}

/**
 * Register `abol-player.sw.js` beside the player bundle. No-ops when insecure, cross-origin
 * registration is blocked, or the browser has no serviceWorker.
 */
export async function registerOfflineServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return null
  if (!window.isSecureContext) return null
  const swUrl = swUrlFromPlayerScript()
  if (!swUrl) return null
  try {
    // Scope defaults to the SW directory (e.g. /widget/). Hosts that need page-wide coverage
    // should serve the worker with Service-Worker-Allowed: /.
    return await navigator.serviceWorker.register(swUrl, { updateViaCache: 'none' })
  } catch (err) {
    console.warn('[abol-player] Service worker registration failed', err)
    return null
  }
}
