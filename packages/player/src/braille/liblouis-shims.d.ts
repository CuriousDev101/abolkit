declare module 'liblouis/easy-api.js' {
  export class EasyApi {
    constructor(build?: unknown)
    translateString(table: string, text: string): string | null
    version(): string
    getFilesystem(): {
      mkdir(path: string): void
      writeFile(path: string, data: string): void
    }
  }
}
