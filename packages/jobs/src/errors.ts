/**
 * Thrown by job handlers. `retryable: false` fails the job immediately
 * (bad input, unsupported type); any other error is retried with backoff.
 */
export class JobError extends Error {
  readonly retryable: boolean

  constructor(message: string, options: { retryable?: boolean; cause?: unknown } = {}) {
    super(message, { cause: options.cause })
    this.name = 'JobError'
    this.retryable = options.retryable ?? true
  }
}

export function isRetryable(err: unknown): boolean {
  return err instanceof JobError ? err.retryable : true
}
