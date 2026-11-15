/** Format seconds as h:mm:ss or m:ss for accessible progress announcements. */
export function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00'
  const total = Math.floor(seconds)
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  const pad = (n: number) => String(n).padStart(2, '0')
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`
}

/** Minimum interactive target size in CSS pixels (WCAG 2.5.8). */
export const MIN_TARGET_PX = 44

/** Prefers-reduced-motion without touching the DOM (caller supplies match). */
export function shouldReduceMotion(matches: boolean | undefined): boolean {
  return matches === true
}

/** Build a polite live-region announcement for a language switch. */
export function captionLangAnnouncement(label: string): string {
  return `Captions: ${label}`
}
