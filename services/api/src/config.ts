// API process config. Speech-to-text is not configured here: the worker calls the
// external MMS wrapper (services/worker, TRANSCRIBER_URL).

type Env = Record<string, string | undefined>

export type ApiConfig = {
  port: number
  /** `*` or one origin. Read routes stay open so a host page can call them. */
  corsOrigin: string
  /**
   * Shared secret for write routes (#24+). Reads never require it.
   * Empty means writes must refuse until configured.
   */
  apiKey: string | undefined
}

export function loadApiConfig(env: Env = process.env as Env): ApiConfig {
  const port = Number(env.PORT ?? 8787)
  if (!Number.isInteger(port) || port < 0 || port > 65535) {
    throw new Error(`PORT must be an integer from 0 to 65535, got ${env.PORT}`)
  }

  const apiKey = env.API_KEY?.trim()
  return {
    port,
    corsOrigin: env.CORS_ORIGIN ?? '*',
    apiKey: apiKey || undefined,
  }
}
