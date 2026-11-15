import { inflateRawSync } from 'node:zlib'

import { describe, expect, it } from 'vitest'

import { buildZip } from './zip.ts'

describe('buildZip', () => {
  it('writes a central directory and recoverable UTF-8 entries', () => {
    const payload = new TextEncoder().encode('hello offline pack')
    const zip = buildZip(
      [
        { name: 'index.html', data: new TextEncoder().encode('<p>hi</p>') },
        { name: 'lesson.opus', data: payload },
      ],
      new Date('2026-11-15T12:00:00.000Z'),
    )

    expect(zip.byteLength).toBeGreaterThan(50)
    // End of central directory signature
    expect(Buffer.from(zip.subarray(zip.length - 22, zip.length - 18)).readUInt32LE(0)).toBe(
      0x06054b50,
    )

    const names = listZipNames(zip)
    expect(names).toEqual(['index.html', 'lesson.opus'])

    const opus = readZipEntry(zip, 'lesson.opus')
    expect(new TextDecoder().decode(opus)).toBe('hello offline pack')
  })
})

/** Minimal STORED/DEFLATE reader for tests (first matching local header). */
function listZipNames(zip: Uint8Array): string[] {
  const buf = Buffer.from(zip)
  const names: string[] = []
  let i = 0
  while (i + 30 <= buf.length) {
    const sig = buf.readUInt32LE(i)
    if (sig !== 0x04034b50) break
    const method = buf.readUInt16LE(i + 8)
    const comp = buf.readUInt32LE(i + 18)
    const nameLen = buf.readUInt16LE(i + 26)
    const extraLen = buf.readUInt16LE(i + 28)
    const name = buf.subarray(i + 30, i + 30 + nameLen).toString('utf8')
    names.push(name)
    void method
    i += 30 + nameLen + extraLen + comp
  }
  return names
}

function readZipEntry(zip: Uint8Array, want: string): Uint8Array {
  const buf = Buffer.from(zip)
  let i = 0
  while (i + 30 <= buf.length) {
    const sig = buf.readUInt32LE(i)
    if (sig !== 0x04034b50) break
    const method = buf.readUInt16LE(i + 8)
    const comp = buf.readUInt32LE(i + 18)
    const uncomp = buf.readUInt32LE(i + 22)
    const nameLen = buf.readUInt16LE(i + 26)
    const extraLen = buf.readUInt16LE(i + 28)
    const name = buf.subarray(i + 30, i + 30 + nameLen).toString('utf8')
    const start = i + 30 + nameLen + extraLen
    const body = buf.subarray(start, start + comp)
    if (name === want) {
      if (method === 0) return new Uint8Array(body)
      if (method === 8) {
        const out = inflateRawSync(body)
        expect(out.length).toBe(uncomp)
        return new Uint8Array(out)
      }
      throw new Error(`unsupported method ${method}`)
    }
    i = start + comp
  }
  throw new Error(`missing entry ${want}`)
}
