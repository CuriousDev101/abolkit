declare module 'liblouis/easy-api.js' {
  export class EasyApi {
    constructor(build?: unknown)
    translateString(table: string, text: string): string | null
    version(): string
    /** Raw emscripten Module from liblouis-build. */
    capi: {
      _malloc(size: number): number
      _free(ptr: number): void
      stringToUTF16(str: string, outPtr: number, maxBytesToWrite: number): void
      getValue(ptr: number, type: string): number
      setValue(ptr: number, value: number, type: string): void
      ccall(ident: string, returnType: string, argTypes: string[], args: unknown[]): number
      HEAPU16: Uint16Array
    }
    getFilesystem(): {
      mkdir(path: string): void
      writeFile(path: string, data: string): void
    }
  }
}
