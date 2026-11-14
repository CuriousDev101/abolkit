import { randomUUID } from 'node:crypto'
import type { Storage } from '@abolkit/provider-sdk'
import type { DatabaseSync } from 'node:sqlite'

import type { ApiConfig } from '../config.ts'
import { getAssetById, insertAsset, isExpired, type AssetRow } from '../db/assets.ts'

export type UploadedFile = {
  data: Uint8Array
  mime: string
  originalName: string | null
  sizeBytes: number
}

export type AssetView = {
  id: string
  mime: string
  sizeBytes: number
  originalName: string | null
  retentionDays: number
  createdAt: string
  expiresAt: string
  downloadUrl: string
  downloadUrlExpiresInSeconds: number
}

export class AssetServiceError extends Error {
  readonly code: string
  readonly status: 400 | 404 | 410 | 413 | 415

  constructor(status: 400 | 404 | 410 | 413 | 415, code: string, message: string) {
    super(message)
    this.name = 'AssetServiceError'
    this.status = status
    this.code = code
  }
}

export function createAssetService(deps: {
  db: DatabaseSync
  storage: Storage
  config: ApiConfig
}) {
  const { db, storage, config } = deps

  return {
    async upload(file: UploadedFile, retentionDays?: number): Promise<{ id: string }> {
      validateUpload(file, config)
      const days = retentionDays ?? config.assetRetentionDays
      if (!Number.isInteger(days) || days <= 0 || days > 365) {
        throw new AssetServiceError(
          400,
          'VALIDATION',
          'retentionDays must be an integer from 1 to 365',
        )
      }

      const id = randomUUID()
      const storageKey = `assets/${id}/source`

      await storage.put(storageKey, file.data, normalizeMime(file.mime))

      try {
        insertAsset(db, {
          id,
          storageKey,
          originalName: file.originalName,
          mime: normalizeMime(file.mime),
          sizeBytes: file.sizeBytes,
          retentionDays: days,
        })
      } catch (err) {
        await storage.delete(storageKey).catch(() => undefined)
        throw err
      }

      return { id }
    },

    async get(id: string): Promise<AssetView> {
      const asset = getAssetById(db, id)
      if (!asset) {
        throw new AssetServiceError(404, 'NOT_FOUND', 'Asset not found')
      }
      if (isExpired(asset)) {
        throw new AssetServiceError(410, 'GONE', 'Asset retention has expired')
      }
      return toView(
        asset,
        await storage.signedUrl(asset.storageKey, config.signedUrlTtlSeconds),
        config,
      )
    },
  }
}

export type AssetService = ReturnType<typeof createAssetService>

function validateUpload(file: UploadedFile, config: ApiConfig): void {
  if (!file.data.byteLength || file.sizeBytes <= 0) {
    throw new AssetServiceError(400, 'VALIDATION', 'Empty upload')
  }
  if (file.sizeBytes > config.assetMaxBytes) {
    throw new AssetServiceError(
      413,
      'PAYLOAD_TOO_LARGE',
      `File exceeds ASSET_MAX_BYTES (${config.assetMaxBytes})`,
    )
  }
  const mime = normalizeMime(file.mime)
  if (!config.assetAllowedMime.includes(mime) && !config.assetAllowedMime.includes('*/*')) {
    throw new AssetServiceError(415, 'UNSUPPORTED_MEDIA_TYPE', `MIME type "${mime}" is not allowed`)
  }
}

function normalizeMime(mime: string): string {
  return (mime || 'application/octet-stream').split(';')[0]!.trim().toLowerCase()
}

function toView(asset: AssetRow, downloadUrl: string, config: ApiConfig): AssetView {
  return {
    id: asset.id,
    mime: asset.mime,
    sizeBytes: asset.sizeBytes,
    originalName: asset.originalName,
    retentionDays: asset.retentionDays,
    createdAt: asset.createdAt,
    expiresAt: asset.expiresAt,
    downloadUrl,
    downloadUrlExpiresInSeconds: config.signedUrlTtlSeconds,
  }
}
