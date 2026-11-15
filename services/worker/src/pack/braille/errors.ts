/** Errors from the experimental Amharic Braille exporter (#55). */
export class BrailleExportError extends Error {
  readonly code:
    | 'LIBLOUIS_UNAVAILABLE'
    | 'TABLE_MISSING'
    | 'TRANSLATE_FAILED'
    | 'INVALID_INPUT'
    | 'BRIDGE_FAILED'

  constructor(
    code: BrailleExportError['code'],
    message: string,
    options?: { cause?: unknown },
  ) {
    super(message, options?.cause !== undefined ? { cause: options.cause } : undefined)
    this.name = 'BrailleExportError'
    this.code = code
  }
}
