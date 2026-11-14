import { ProviderError } from '../errors.ts'
import type { ProviderConfig, Storage } from '../types.ts'
import { createLocalDiskStorage } from './local-disk.ts'
import { createMinioStorage } from './minio.ts'

export type StorageEnv = Record<string, string | undefined>

export type CreateStorageOptions = {
  /** Provider id: `local-disk` | `minio` (and later `r2`). */
  storage: string
  env?: StorageEnv
  /** Optional override for local-disk signed URL origin. */
  publicBaseUrl?: string
}

/** Build the configured Storage adapter (ADR 0005). */
export function createStorage(options: CreateStorageOptions): Storage {
  const id = (options.storage || 'local-disk').trim()
  const env = options.env ?? process.env

  switch (id) {
    case 'local-disk': {
      const root = env.STORAGE_LOCAL_ROOT?.trim() || './data/storage'
      const signingSecret = env.STORAGE_SIGNING_SECRET?.trim()
      if (!signingSecret) {
        throw new ProviderError(
          'BAD_CONFIG',
          'STORAGE_PROVIDER=local-disk requires STORAGE_SIGNING_SECRET.',
        )
      }
      return createLocalDiskStorage({
        root,
        signingSecret,
        publicBaseUrl: options.publicBaseUrl ?? env.PUBLIC_BASE_URL?.trim(),
      })
    }
    case 'minio': {
      const endpoint = env.MINIO_ENDPOINT?.trim()
      const accessKey = env.MINIO_ACCESS_KEY?.trim()
      const secretKey = env.MINIO_SECRET_KEY?.trim()
      const bucket = env.MINIO_BUCKET?.trim()
      if (!endpoint || !accessKey || !secretKey || !bucket) {
        throw new ProviderError(
          'BAD_CONFIG',
          'STORAGE_PROVIDER=minio requires MINIO_ENDPOINT, MINIO_ACCESS_KEY, MINIO_SECRET_KEY, and MINIO_BUCKET.',
        )
      }
      return createMinioStorage({
        endpoint,
        publicEndpoint: env.MINIO_PUBLIC_ENDPOINT?.trim(),
        accessKey,
        secretKey,
        bucket,
        useSsl: parseBool(env.MINIO_USE_SSL, false),
        ensureBucket: parseBool(env.MINIO_ENSURE_BUCKET, true),
      })
    }
    default:
      throw new ProviderError('BAD_CONFIG', `Unknown storage "${id}". Use local-disk or minio.`)
  }
}

/** Read storage provider selection from process env (api/worker). */
export function storageConfigFromEnv(
  env: StorageEnv = process.env,
): Pick<ProviderConfig, 'storage'> {
  return {
    storage: env.STORAGE_PROVIDER?.trim() || env.STORAGE?.trim() || 'local-disk',
  }
}

function parseBool(value: string | undefined, fallback: boolean): boolean {
  if (value == null || value.trim() === '') return fallback
  const v = value.trim().toLowerCase()
  if (['1', 'true', 'yes', 'on'].includes(v)) return true
  if (['0', 'false', 'no', 'off'].includes(v)) return false
  return fallback
}
