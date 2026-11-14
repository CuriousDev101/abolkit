import { z } from '@hono/zod-openapi'

/** Liveness of this API process. Does not probe the external STT service. */
export const HealthSchema = z
  .object({
    ok: z.literal(true).openapi({ example: true }),
    service: z.literal('abolkit-api').openapi({ example: 'abolkit-api' }),
  })
  .openapi('Health')

/** Error body from docs-internal/architecture.md. Used by the validation hook and #17. */
export const ErrorBodySchema = z
  .object({
    error: z.object({
      code: z.string().openapi({ example: 'VALIDATION' }),
      message: z.string().openapi({ example: 'Invalid request' }),
    }),
  })
  .openapi('ErrorBody')

export type Health = z.infer<typeof HealthSchema>
export type ErrorBody = z.infer<typeof ErrorBodySchema>
