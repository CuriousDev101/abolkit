/**
 * Classic script for spike #10. A host page loads it with a script tag; the
 * script then calls GET /api/health on this origin. The real player bundle
 * replaces this file at /widget/abol-player.js (#19, #46).
 */
export const embedScript = `(() => {
  const current = document.currentScript
  if (!current || !current.src) return

  const apiOrigin = new URL(current.src).origin
  const targetId = current.dataset.target || 'abol-spike'
  const status = document.getElementById(targetId)

  fetch(apiOrigin + '/api/health', { credentials: 'omit' })
    .then((response) => {
      if (!response.ok) throw new Error('Health request failed')
      return response.json()
    })
    .then((body) => {
      window.__abolEmbed = { ok: true, body }
      if (status) status.textContent = 'Abol Kit API is up'
      document.dispatchEvent(new CustomEvent('abol:spike-health', { detail: body }))
    })
    .catch(() => {
      window.__abolEmbed = { ok: false }
      if (status) status.textContent = 'Abol Kit API is unreachable'
    })
})()
`
