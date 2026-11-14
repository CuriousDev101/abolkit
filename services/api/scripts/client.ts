import createClient, { type Client } from 'openapi-fetch'

import type { paths } from './schema.js'

export type ApiClient = Client<paths>

/** Typed client for the generated OpenAPI document. `baseUrl` is the API origin. */
export function createApiClient(baseUrl: string, fetchImpl?: typeof fetch): ApiClient {
  return createClient<paths>({ baseUrl, fetch: fetchImpl })
}

export async function fetchHealth(client: ApiClient) {
  const { data, response } = await client.GET('/api/health')
  if (!response.ok || !data) {
    throw new Error(`GET /api/health failed with ${response.status}`)
  }
  return data
}
