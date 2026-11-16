import type { OpenAPIHono } from '@hono/zod-openapi'

import { resolveJobPostingRoute } from './routes.ts'
import { resolveJobPostingUrl } from './service.ts'

/** Paths served by the public job-posting proxy; the API-key middleware skips them. */
export function isJobPostingPath(path: string): boolean {
  return path === '/api/job-postings/resolve' || path.startsWith('/api/job-postings/')
}

export function registerJobPostingRoutes(app: OpenAPIHono): void {
  app.openapi(resolveJobPostingRoute, async (c) => {
    const { url } = c.req.valid('query')
    const result = await resolveJobPostingUrl(url)
    return c.json(result, 200)
  })
}
