// API entry (#17 + #24): health, assets upload/metadata, signed downloads,
// /openapi.json, Scalar at /docs, CORS, JSON errors.
// STT is not this process. The worker calls the external MMS wrapper.
// Next: jobs (#25+), gated with requireApiKey.

import { serve } from '@hono/node-server'

import { createApp } from './app.ts'
import { loadApiConfig } from './config.ts'

export { createApp } from './app.ts'
export { loadApiConfig } from './config.ts'
export { requireApiKey } from './middleware/api-key.ts'

export function start(env: Record<string, string | undefined> = process.env) {
  const config = loadApiConfig(env)
  const app = createApp(env)

  const server = serve({ fetch: app.fetch, port: config.port, hostname: '127.0.0.1' }, (info) => {
    console.log(
      JSON.stringify({
        ok: true,
        service: 'abolkit-api',
        url: `http://127.0.0.1:${info.port}`,
        docs: `http://127.0.0.1:${info.port}/docs`,
        openapi: `http://127.0.0.1:${info.port}/openapi.json`,
        health: `http://127.0.0.1:${info.port}/api/health`,
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
