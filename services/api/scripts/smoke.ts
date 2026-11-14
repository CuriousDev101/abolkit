// #17 / spike #10 proof: health, spec, Scalar, typed client, CORS, JSON errors, API key gate.
// Speech-to-text is not contacted. This process only serves the API.

import { spawnSync } from 'node:child_process'
import { createServer } from 'node:http'
import { createRequire } from 'node:module'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { runInNewContext } from 'node:vm'
import type { AddressInfo } from 'node:net'

import { Hono } from 'hono'
import { serve } from '@hono/node-server'

import { createApiClient, fetchHealth } from './client.ts'
import { createApp } from '../src/app.ts'
import { requireApiKey } from '../src/middleware/api-key.ts'
import { openApiConfig } from '../src/openapi.ts'

const here = dirname(fileURLToPath(import.meta.url))
const repoRoot = join(here, '../../..')
const openapiFile = join(repoRoot, 'spikes/10-zod-openapi/openapi.json')
const hostFile = join(repoRoot, 'spikes/10-zod-openapi/host.html')
const schemaFile = join(here, 'schema.d.ts')
const otherOrigin = 'http://127.0.0.1:8790'

const require = createRequire(import.meta.url)

async function main() {
  const app = createApp({ PORT: '0', CORS_ORIGIN: '*' })

  const health = await app.request('/api/health')
  const healthBody = (await health.json()) as { ok?: boolean; service?: string }
  assert(health.status === 200, `health status ${health.status}`)
  assert(healthBody.ok === true && healthBody.service === 'abolkit-api', 'health body')

  const specResponse = await app.request('/openapi.json')
  const spec = (await specResponse.json()) as {
    openapi?: string
    info?: { description?: string }
    paths?: Record<string, unknown>
  }
  assert(specResponse.status === 200, 'openapi status')
  assert(spec.openapi === '3.1.0', `openapi version ${spec.openapi}`)
  assert(spec.info?.description?.includes('does not run speech-to-text') === true, 'spec names the STT boundary')
  const paths = Object.keys(spec.paths ?? {})
  assert(paths.length === 1 && paths[0] === '/api/health', `paths ${paths.join(',')}`)
  assert(
    !paths.some((path) => path.toLowerCase().includes('transcrib')),
    'spec must not grow an STT route',
  )

  const docs = await app.request('/docs')
  const html = await docs.text()
  assert(docs.status === 200, 'docs status')
  assert(docs.headers.get('content-type')?.includes('text/html') === true, 'docs content type')
  assert(html.includes('src="/docs/scalar.js"'), 'docs script is self-hosted')
  assert(html.includes('"withDefaultFonts": false'), 'docs do not request Scalar fonts')
  assert(html.includes('"proxyUrl": ""'), 'docs client does not use proxy.scalar.com')
  assert(!html.includes('cdn.jsdelivr.net'), 'docs html must not reference jsDelivr')
  assert(!html.includes('fonts.scalar.com'), 'docs html must not reference Scalar fonts')

  const scalarJs = await app.request('/docs/scalar.js')
  const scalarBytes = (await scalarJs.arrayBuffer()).byteLength
  assert(scalarJs.status === 200, 'scalar.js status')
  assert(scalarJs.headers.get('content-type')?.includes('javascript') === true, 'scalar.js type')
  assert(scalarBytes > 100_000, 'scalar.js looks empty')

  const crossOrigin = await app.request('/api/health', {
    headers: { Origin: otherOrigin },
  })
  assert(
    crossOrigin.headers.get('access-control-allow-origin') === '*',
    `CORS header ${crossOrigin.headers.get('access-control-allow-origin')}`,
  )

  const preflight = await app.request('/api/health', {
    method: 'OPTIONS',
    headers: {
      Origin: otherOrigin,
      'Access-Control-Request-Method': 'GET',
    },
  })
  assert(preflight.status === 204, `preflight status ${preflight.status}`)
  assert(preflight.headers.get('access-control-allow-origin') === '*', 'preflight CORS')

  const widget = await app.request('/widget/embed.js', {
    headers: { Origin: otherOrigin },
  })
  const widgetSource = await widget.text()
  assert(widget.status === 200, 'widget status')
  assert(widget.headers.get('access-control-allow-origin') === '*', 'widget CORS')
  assert(widgetSource.includes("/api/health"), 'widget calls health')

  const missing = await app.request('/api/missing')
  const missingBody = (await missing.json()) as { error?: { code?: string; message?: string } }
  assert(missing.status === 404 && missingBody.error?.code === 'NOT_FOUND', '404 shape')
  assert(typeof missingBody.error?.message === 'string', '404 message')

  const components = (
    app.getOpenAPI31Document(openApiConfig) as {
      components?: { schemas?: Record<string, unknown> }
    }
  ).components?.schemas
  assert(components?.ErrorBody !== undefined, 'ErrorBody registered in OpenAPI')
  assert(components?.Health !== undefined, 'Health registered in OpenAPI')

  await assertApiKeyGate()

  const api = await listen(app)
  const host = await listenHost(api.origin)
  try {
    const liveHealth = await fetch(`${api.origin}/api/health`, {
      headers: { Origin: host.origin },
    })
    assert(liveHealth.headers.get('access-control-allow-origin') === '*', 'live CORS')
    const page = await (await fetch(host.origin)).text()
    assert(page.includes(`${api.origin}/widget/embed.js`), 'host page points at the API script')

    const servedScript = await (await fetch(`${api.origin}/widget/embed.js`)).text()
    const embed = await runEmbed(servedScript, api.origin)
    assert(embed.statusText === 'Abol Kit API is up', `embed status ${embed.statusText}`)
    assert(embed.body?.ok === true && embed.body.service === 'abolkit-api', 'embed body')

    const client = createApiClient(api.origin, ((input: RequestInfo | URL, init?: RequestInit) =>
      app.request(input, init)) as typeof fetch)
    const typed = await fetchHealth(client)
    assert(typed.ok === true && typed.service === 'abolkit-api', 'typed client')
  } finally {
    await api.close()
    await host.close()
  }

  const document = app.getOpenAPI31Document(openApiConfig)
  const wrote = spawnSync(
    process.execPath,
    ['--experimental-strip-types', join(here, 'write-openapi.ts')],
    { encoding: 'utf8' },
  )
  if (wrote.status !== 0) {
    throw new Error(wrote.stderr || wrote.stdout || 'openapi write failed')
  }
  generateTypes(openapiFile, schemaFile)

  const tsc = join(repoRoot, 'node_modules/typescript/bin/tsc')
  const checked = spawnSync(process.execPath, [tsc, '-p', join(here, '../tsconfig.client.json')], {
    cwd: join(here, '..'),
    encoding: 'utf8',
  })
  if (checked.status !== 0) {
    throw new Error(checked.stdout || checked.stderr || 'client typecheck failed')
  }

  console.log(
    JSON.stringify({
      ok: true,
      issue: 17,
      openapi: '3.1.0',
      paths,
      specBytes: Buffer.byteLength(JSON.stringify(document)),
      scalarBytes,
      cors: '*',
      errors: '{ error: { code, message } }',
      apiKeyGate: true,
      embed: 'Abol Kit API is up',
      client: 'fetchHealth',
      stt: 'not this service',
      dev: 'pnpm dev:api',
    }),
  )
}

async function assertApiKeyGate() {
  const gated = new Hono()
  gated.use('*', requireApiKey('secret-demo'))
  gated.post('/write', (c) => c.json({ ok: true }))

  const unset = new Hono()
  unset.use('*', requireApiKey(undefined))
  unset.post('/write', (c) => c.json({ ok: true }))

  const denied = await gated.request('/write', { method: 'POST' })
  const deniedBody = (await denied.json()) as { error?: { code?: string } }
  assert(denied.status === 401 && deniedBody.error?.code === 'UNAUTHORIZED', 'api key denied')

  const allowed = await gated.request('/write', {
    method: 'POST',
    headers: { 'X-API-Key': 'secret-demo' },
  })
  assert(allowed.status === 200, 'api key accepted')

  const bearer = await gated.request('/write', {
    method: 'POST',
    headers: { Authorization: 'Bearer secret-demo' },
  })
  assert(bearer.status === 200, 'bearer api key accepted')

  const missingConfig = await unset.request('/write', { method: 'POST' })
  const missingBody = (await missingConfig.json()) as { error?: { code?: string } }
  assert(
    missingConfig.status === 503 && missingBody.error?.code === 'API_KEY_UNSET',
    'writes refuse when API_KEY unset',
  )
}

function generateTypes(input: string, output: string) {
  const entry = require.resolve('openapi-typescript')
  const cli = join(dirname(entry), '../bin/cli.js')
  const result = spawnSync(process.execPath, [cli, input, '-o', output], {
    cwd: join(here, '..'),
    encoding: 'utf8',
  })
  if (result.status !== 0) {
    throw new Error(result.stderr || result.stdout || 'openapi-typescript failed')
  }
}

async function runEmbed(source: string, apiOrigin: string) {
  let statusText = 'Waiting for the API…'
  const page: { __abolEmbed?: { ok: boolean; body?: { ok: boolean; service: string } } } = {}
  const document = {
    currentScript: {
      src: `${apiOrigin}/widget/embed.js`,
      dataset: { target: 'abol-spike' },
    },
    getElementById(id: string) {
      if (id !== 'abol-spike') return null
      return {
        set textContent(value: string) {
          statusText = value
        },
      }
    },
    dispatchEvent() {
      return true
    },
  }

  runInNewContext(source, {
    document,
    window: page,
    fetch,
    URL,
    CustomEvent,
  })

  const started = Date.now()
  while (!page.__abolEmbed && Date.now() - started < 2000) {
    await new Promise((resolve) => setTimeout(resolve, 20))
  }
  if (!page.__abolEmbed) throw new Error('embed script did not finish')
  return { statusText, body: page.__abolEmbed.body }
}

function listen(app: ReturnType<typeof createApp>) {
  return new Promise<{ origin: string; close: () => Promise<void> }>((resolve, reject) => {
    const server = serve(
      { fetch: app.fetch, port: 0, hostname: '127.0.0.1' },
      (info) => {
        resolve({
          origin: `http://127.0.0.1:${info.port}`,
          close: () => closeServer(server),
        })
      },
    )
    server.on('error', reject)
  })
}

function listenHost(apiOrigin: string) {
  const html = readFileSync(hostFile, 'utf8').replaceAll('__API_ORIGIN__', apiOrigin)
  return new Promise<{ origin: string; close: () => Promise<void> }>((resolve, reject) => {
    const server = createServer((_req, res) => {
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' })
      res.end(html)
    })
    server.on('error', reject)
    server.listen(0, '127.0.0.1', () => {
      const address = server.address() as AddressInfo
      resolve({
        origin: `http://127.0.0.1:${address.port}`,
        close: () => closeServer(server),
      })
    })
  })
}

function closeServer(server: { close(callback?: (err?: Error) => void): unknown }) {
  return new Promise<void>((resolve, reject) => {
    server.close((err) => (err ? reject(err) : resolve()))
  })
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message)
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : err)
  process.exitCode = 1
})
