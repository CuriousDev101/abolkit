// API entry (#17 + #24 + #25): health, assets upload/metadata, signed downloads,
// job create/status, /openapi.json, Scalar at /docs, CORS, JSON errors.
// STT is not this process. The API only queues jobs; services/worker runs them
// and calls the external MMS wrapper.

import { serve } from '@hono/node-server'

import { createApp } from './app.ts'
import { loadApiConfig } from './config.ts'

export { createApp } from './app.ts'
export { loadApiConfig } from './config.ts'
export { requireApiKey } from './middleware/api-key.ts'

export function start(env: Record<string, string | undefined> = process.env) {
  const config = loadApiConfig(env)
  const app = createApp(env)
  const publicHost = config.host === '0.0.0.0' ? '127.0.0.1' : config.host

  const server = serve({ fetch: app.fetch, port: config.port, hostname: config.host }, (info) => {
    const origin = `http://${publicHost}:${info.port}`
    console.log(
      JSON.stringify({
        ok: true,
        service: 'abolkit-api',
        url: origin,
        docs: `${origin}/docs`,
        openapi: `${origin}/openapi.json`,
        health: `${origin}/api/health`,
      }),
    )
  })

  return server
}

const entry = process.argv[1]?.replaceAll('\\', '/')
const isDirectRun =
  entry?.endsWith('api/src/index.ts') === true || entry?.endsWith('api/src/index.js') === true

if (isDirectRun) {
  start()
}
