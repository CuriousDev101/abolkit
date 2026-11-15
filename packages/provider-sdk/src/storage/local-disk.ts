import { createHmac, timingSafeEqual } from 'node:crypto'
import { mkdir, readFile, unlink, writeFile } from 'node:fs/promises'
import { dirname, resolve, sep } from 'node:path'

import { ProviderError } from '../errors.ts'
import type { Storage } from '../types.ts'

export type LocalDiskStorageOptions = {
  /** Absolute or relative directory root for object bytes. */
  root: string
  /** HMAC secret used to mint and verify signed download URLs. */
  signingSecret: string
  /**
   * Public API origin used in signed URLs, e.g. `http://127.0.0.1:8787`.
   * Relative `/api/storage/...` paths are used when omitted.
   */
  publicBaseUrl?: string
}

type MimeSidecar = { mime: string }

/**
 * Local-disk Storage adapter for tests and no-Docker development (ADR 0005).
 * Signed URLs point at the API HMAC download route, not a direct file:// link.
 */
export function createLocalDiskStorage(options: LocalDiskStorageOptions): Storage {
  const root = resolve(options.root)
  const secret = options.signingSecret.trim()
  if (!secret) {
    throw new ProviderError(
      'BAD_CONFIG',
      'STORAGE_SIGNING_SECRET is required for local-disk storage.',
    )
  }
  const publicBase = options.publicBaseUrl?.replace(/\/$/, '') ?? ''

  return {
    id: 'local-disk',
    label: 'Local disk',
    sendsDataOffHost: false,

    async put(key, data, mime) {
      const objectPath = resolveObjectPath(root, key)
      await mkdir(dirname(objectPath), { recursive: true })
      const bytes = await toUint8Array(data)
      await writeFile(objectPath, bytes)
      await writeFile(mimePath(objectPath), JSON.stringify({ mime } satisfies MimeSidecar), 'utf8')
    },

    async get(key) {
      const objectPath = resolveObjectPath(root, key)
      try {
        const bytes = new Uint8Array(await readFile(objectPath))
        const mime = await readMime(objectPath)
        return { bytes, mime }
      } catch (err) {
        if (isNotFound(err)) return null
        throw err
      }
    },

    async delete(key) {
      const objectPath = resolveObjectPath(root, key)
      try {
        await unlink(objectPath)
      } catch (err) {
        if (!isNotFound(err)) throw err
      }
      try {
        await unlink(mimePath(objectPath))
      } catch (err) {
        if (!isNotFound(err)) throw err
      }
    },

    async signedUrl(key, ttlSeconds) {
      assertSafeKey(key)
      const ttl = Math.max(1, Math.floor(ttlSeconds))
      const exp = Math.floor(Date.now() / 1000) + ttl
      const sig = signLocalDiskToken(secret, key, exp)
      const query = new URLSearchParams({ key, exp: String(exp), sig })
      const path = `/api/storage/object?${query.toString()}`
      return publicBase ? `${publicBase}${path}` : path
    },
  }
}

/** Verify an HMAC signed local-disk download token. */
export function verifyLocalDiskSignedUrl(
  signingSecret: string,
  key: string,
  exp: number,
  sig: string,
): boolean {
  if (!Number.isFinite(exp) || exp < Math.floor(Date.now() / 1000)) return false
  const expected = signLocalDiskToken(signingSecret, key, exp)
  try {
    const a = Buffer.from(expected, 'hex')
    const b = Buffer.from(sig, 'hex')
    return a.length === b.length && timingSafeEqual(a, b)
  } catch {
    return false
  }
}

export function signLocalDiskToken(signingSecret: string, key: string, exp: number): string {
  assertSafeKey(key)
  return createHmac('sha256', signingSecret).update(`${key}:${exp}`).digest('hex')
}

function resolveObjectPath(root: string, key: string): string {
  assertSafeKey(key)
  const full = resolve(root, ...key.split('/'))
  const rootWithSep = root.endsWith(sep) ? root : root + sep
  if (full !== root && !full.startsWith(rootWithSep)) {
    throw new ProviderError('BAD_KEY', `Storage key escapes root: ${key}`)
  }
  return full
}

function assertSafeKey(key: string): void {
  if (!key || key.includes('\0') || key.startsWith('/') || key.includes('..')) {
    throw new ProviderError('BAD_KEY', `Invalid storage key: ${key}`)
  }
}

function mimePath(objectPath: string): string {
  return `${objectPath}.mime.json`
}

async function readMime(objectPath: string): Promise<string> {
  try {
    const raw = await readFile(mimePath(objectPath), 'utf8')
    const parsed = JSON.parse(raw) as MimeSidecar
    return parsed.mime || 'application/octet-stream'
  } catch {
    return 'application/octet-stream'
  }
}

async function toUint8Array(data: Uint8Array | ReadableStream): Promise<Uint8Array> {
  if (data instanceof Uint8Array) return data
  const reader = data.getReader()
  const chunks: Uint8Array[] = []
  let total = 0
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    if (!value) continue
    chunks.push(value)
    total += value.byteLength
  }
  const out = new Uint8Array(total)
  let offset = 0
  for (const chunk of chunks) {
    out.set(chunk, offset)
    offset += chunk.byteLength
  }
  return out
}

function isNotFound(err: unknown): boolean {
  return (
    typeof err === 'object' &&
    err !== null &&
    'code' in err &&
    (err as { code: string }).code === 'ENOENT'
  )
}
