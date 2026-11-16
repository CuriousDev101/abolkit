import { createServer, type Server } from 'node:http'
import { afterEach, describe, expect, it } from 'vitest'

import { createApp } from './app.ts'
import { assertFetchableJobUrl } from './job-postings/service.ts'

function listen(server: Server): Promise<number> {
  return new Promise((resolve, reject) => {
    server.listen(0, '127.0.0.1', () => {
      const addr = server.address()
      if (addr && typeof addr === 'object') resolve(addr.port)
      else reject(new Error('no port'))
    })
    server.on('error', reject)
  })
}

function close(server: Server): Promise<void> {
  return new Promise((resolve, reject) => {
    server.close((err) => (err ? reject(err) : resolve()))
  })
}

describe('assertFetchableJobUrl', () => {
  it('accepts http(s) URLs and rejects credentials / blocked hosts', () => {
    expect(assertFetchableJobUrl('https://careers.example/jobs/1').href).toBe(
      'https://careers.example/jobs/1',
    )
    expect(() => assertFetchableJobUrl('ftp://careers.example/1')).toThrow(/http/)
    expect(() => assertFetchableJobUrl('https://user:pass@careers.example/1')).toThrow(
      /credentials/,
    )
    expect(() => assertFetchableJobUrl('http://metadata.google.internal/')).toThrow(/not allowed/)
  })
})

describe('GET /api/job-postings/resolve', () => {
  const app = createApp({
    captions: null,
    tts: null,
    env: {
      API_KEY: 'test-key',
      STORAGE_PROVIDER: 'local-disk',
      STORAGE_LOCAL_ROOT: '/tmp/abolkit-job-postings-test',
      STORAGE_SIGNING_SECRET: 'test-signing-secret',
      PUBLIC_BASE_URL: 'http://127.0.0.1:8787',
    },
  })

  let upstream: Server | undefined

  afterEach(async () => {
    if (upstream) {
      await close(upstream)
      upstream = undefined
    }
  })

  it('resolves bare JobPosting JSON without an API key', async () => {
    upstream = createServer((_req, res) => {
      res.writeHead(200, { 'Content-Type': 'application/ld+json' })
      res.end(
        JSON.stringify({
          '@context': 'https://schema.org',
          '@type': 'JobPosting',
          title: 'Caption Reviewer',
          description: 'Review Amharic captions.',
          employmentType: 'FULL_TIME',
        }),
      )
    })
    const port = await listen(upstream)
    const url = `http://127.0.0.1:${port}/job.json`

    const res = await app.request(`/api/job-postings/resolve?url=${encodeURIComponent(url)}`)
    expect(res.status).toBe(200)
    const body = (await res.json()) as {
      sourceUrl: string
      extractedFrom: string
      job: { '@type'?: string; title?: string }
    }
    expect(body.sourceUrl).toBe(url)
    expect(body.extractedFrom).toBe('json')
    expect(body.job['@type']).toBe('JobPosting')
    expect(body.job.title).toBe('Caption Reviewer')
  })

  it('scrapes HTML career pages that have no JSON-LD', async () => {
    upstream = createServer((_req, res) => {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
      res.end(`<!doctype html><html><head>
        <meta property="og:title" content="Sign-Language Mentor" />
        <meta property="og:description" content="Coach learners in weekly clinics." />
        <meta property="og:site_name" content="Abol Careers" />
      </head><body>
        <h1>Sign-Language Mentor</h1>
        <div class="job-location">Addis Ababa</div>
        <section class="job-description"><p>Coach learners in weekly clinics.</p></section>
      </body></html>`)
    })
    const port = await listen(upstream)
    const url = `http://127.0.0.1:${port}/careers/mentor`

    const res = await app.request(`/api/job-postings/resolve?url=${encodeURIComponent(url)}`)
    expect(res.status).toBe(200)
    const body = (await res.json()) as {
      extractedFrom: string
      job: { title?: string; hiringOrganization?: { name?: string } }
    }
    expect(body.extractedFrom).toBe('html')
    expect(body.job.title).toBe('Sign-Language Mentor')
    expect(body.job.hiringOrganization?.name).toBe('Abol Careers')
  })

  it('extracts JobPosting from HTML-embedded JSON-LD', async () => {
    const jsonLd = {
      '@context': 'https://schema.org',
      '@type': 'JobPosting',
      title: 'Offline Pack Builder',
      description: 'Ship offline lessons for low-bandwidth phones.',
    }
    upstream = createServer((_req, res) => {
      res.writeHead(200, { 'Content-Type': 'text/html' })
      res.end(
        `<!doctype html><html><head><script type="application/ld+json">${JSON.stringify(jsonLd)}</script></head><body><h1>Ignore</h1></body></html>`,
      )
    })
    const port = await listen(upstream)
    const url = `http://127.0.0.1:${port}/page`

    const res = await app.request(`/api/job-postings/resolve?url=${encodeURIComponent(url)}`)
    expect(res.status).toBe(200)
    const body = (await res.json()) as { extractedFrom: string; job: { title?: string } }
    expect(body.extractedFrom).toBe('json-ld')
    expect(body.job.title).toBe('Offline Pack Builder')
  })

  it('rejects missing url and blocked hosts', async () => {
    const missing = await app.request('/api/job-postings/resolve')
    expect(missing.status).toBe(400)

    const blocked = await app.request(
      `/api/job-postings/resolve?url=${encodeURIComponent('http://metadata.google.internal/')}`,
    )
    expect(blocked.status).toBe(400)
    const body = (await blocked.json()) as { error?: { code?: string } }
    expect(body.error?.code).toBe('URL_BLOCKED')
  })
})
