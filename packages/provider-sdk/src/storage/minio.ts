import {
  CreateBucketCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadBucketCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'

import { ProviderError } from '../errors.ts'
import type { Storage } from '../types.ts'

export type MinioStorageOptions = {
  endpoint: string
  /** Host:port browsers use for presigned URLs (often localhost:9000). */
  publicEndpoint?: string
  accessKey: string
  secretKey: string
  bucket: string
  useSsl?: boolean
  /** When true, create the bucket if HeadBucket returns 404. */
  ensureBucket?: boolean
}

/**
 * MinIO / S3-compatible Storage adapter (Compose default, ADR 0005).
 * `sendsDataOffHost` is false: MinIO runs on the host stack, not a third-party SaaS.
 */
export function createMinioStorage(options: MinioStorageOptions): Storage {
  const endpoint = normalizeEndpoint(options.endpoint, options.useSsl === true)
  const publicEndpoint = options.publicEndpoint
    ? normalizeEndpoint(options.publicEndpoint, options.useSsl === true)
    : endpoint

  const credentials = {
    accessKeyId: options.accessKey,
    secretAccessKey: options.secretKey,
  }

  const internal = new S3Client({
    region: 'us-east-1',
    endpoint,
    forcePathStyle: true,
    credentials,
  })

  const publicClient =
    publicEndpoint === endpoint
      ? internal
      : new S3Client({
          region: 'us-east-1',
          endpoint: publicEndpoint,
          forcePathStyle: true,
          credentials,
        })

  const bucket = options.bucket.trim()
  if (!bucket) {
    throw new ProviderError('BAD_CONFIG', 'MINIO_BUCKET is required for minio storage.')
  }

  let bucketReady: Promise<void> | undefined

  async function ensureBucket(): Promise<void> {
    if (options.ensureBucket === false) return
    if (!bucketReady) {
      bucketReady = (async () => {
        try {
          await internal.send(new HeadBucketCommand({ Bucket: bucket }))
        } catch {
          try {
            await internal.send(new CreateBucketCommand({ Bucket: bucket }))
          } catch (err) {
            // Race: another process created it.
            try {
              await internal.send(new HeadBucketCommand({ Bucket: bucket }))
            } catch {
              throw new ProviderError(
                'STORAGE',
                `Unable to ensure MinIO bucket "${bucket}": ${err instanceof Error ? err.message : String(err)}`,
              )
            }
          }
        }
      })()
    }
    await bucketReady
  }

  return {
    id: 'minio',
    label: 'MinIO',
    sendsDataOffHost: false,

    async put(key, data, mime) {
      assertSafeKey(key)
      await ensureBucket()
      const body = await toUint8Array(data)
      await internal.send(
        new PutObjectCommand({
          Bucket: bucket,
          Key: key,
          Body: body,
          ContentType: mime,
        }),
      )
    },

    async get(key) {
      assertSafeKey(key)
      await ensureBucket()
      try {
        const out = await internal.send(new GetObjectCommand({ Bucket: bucket, Key: key }))
        const bytes = await streamToUint8Array(out.Body)
        return { bytes, mime: out.ContentType || 'application/octet-stream' }
      } catch (err) {
        if (isNotFound(err)) return null
        throw err
      }
    },

    async delete(key) {
      assertSafeKey(key)
      await ensureBucket()
      try {
        await internal.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }))
      } catch (err) {
        if (!isNotFound(err)) throw err
      }
    },

    async signedUrl(key, ttlSeconds) {
      assertSafeKey(key)
      await ensureBucket()
      const ttl = Math.max(1, Math.floor(ttlSeconds))
      const command = new GetObjectCommand({ Bucket: bucket, Key: key })
      return getSignedUrl(publicClient, command, { expiresIn: ttl })
    },
  }
}

function normalizeEndpoint(value: string, useSsl: boolean): string {
  const trimmed = value.trim()
  if (!trimmed) {
    throw new ProviderError('BAD_CONFIG', 'MinIO endpoint is empty.')
  }
  if (/^https?:\/\//i.test(trimmed)) return trimmed.replace(/\/$/, '')
  return `${useSsl ? 'https' : 'http'}://${trimmed.replace(/\/$/, '')}`
}

function assertSafeKey(key: string): void {
  if (!key || key.includes('\0') || key.startsWith('/') || key.includes('..')) {
    throw new ProviderError('BAD_KEY', `Invalid storage key: ${key}`)
  }
}

async function toUint8Array(data: Uint8Array | ReadableStream): Promise<Uint8Array> {
  if (data instanceof Uint8Array) return data
  return streamToUint8Array(data)
}

async function streamToUint8Array(body: unknown): Promise<Uint8Array> {
  if (body == null) return new Uint8Array()
  if (body instanceof Uint8Array) return body
  if (Buffer.isBuffer(body)) return new Uint8Array(body)

  // AWS SDK v3 may return a web stream or Node stream-like with transformToByteArray.
  if (typeof body === 'object' && body !== null && 'transformToByteArray' in body) {
    const bytes = await (
      body as { transformToByteArray: () => Promise<Uint8Array> }
    ).transformToByteArray()
    return bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes)
  }

  if (typeof body === 'object' && body !== null && Symbol.asyncIterator in body) {
    const chunks: Uint8Array[] = []
    let total = 0
    for await (const chunk of body as AsyncIterable<Uint8Array | Buffer>) {
      const part = chunk instanceof Uint8Array ? chunk : new Uint8Array(chunk)
      chunks.push(part)
      total += part.byteLength
    }
    const out = new Uint8Array(total)
    let offset = 0
    for (const chunk of chunks) {
      out.set(chunk, offset)
      offset += chunk.byteLength
    }
    return out
  }

  throw new ProviderError('STORAGE', 'Unsupported MinIO object body type')
}

function isNotFound(err: unknown): boolean {
  if (typeof err !== 'object' || err === null) return false
  const name = 'name' in err ? String((err as { name: unknown }).name) : ''
  const code =
    '$metadata' in err &&
    typeof (err as { $metadata?: { httpStatusCode?: number } }).$metadata?.httpStatusCode ===
      'number'
      ? (err as { $metadata: { httpStatusCode: number } }).$metadata.httpStatusCode
      : undefined
  return name === 'NoSuchKey' || name === 'NotFound' || code === 404
}
