/** Spec metadata. Routes are registered on the app; this is only the document header. */
export const openApiConfig = {
  openapi: '3.1.0' as const,
  info: {
    title: 'Abol Kit API',
    version: '0.0.0',
    description:
      'HTTP API for Abol Kit. This process does not run speech-to-text. ' +
      'The worker calls a separate MMS ASR service (TRANSCRIBER_URL). ' +
      'Read routes are open with CORS; write routes require API_KEY. ' +
      'Assets use the configured Storage adapter (local-disk default; MinIO for Compose).',
  },
  servers: [
    {
      url: '/',
      description: 'This API origin. A host page on another origin calls it with CORS.',
    },
  ],
}
