import { randomUUID } from 'node:crypto'
import type { DatabaseSync } from 'node:sqlite'

export type AssetRow = {
  id: string
  storageKey: string
  originalName: string | null
  mime: string
  sizeBytes: number
  retentionDays: number
  createdAt: string
  expiresAt: string
}

type AssetDbRow = {
  id: string
  storage_key: string
  original_name: string | null
  mime: string
  size_bytes: number | bigint
  retention_days: number | bigint
  created_at: string
  expires_at: string
}

export function insertAsset(
  db: DatabaseSync,
  input: {
    id?: string
    storageKey: string
    originalName: string | null
    mime: string
    sizeBytes: number
    retentionDays: number
    createdAt?: Date
  },
): AssetRow {
  const id = input.id ?? randomUUID()
  const created = input.createdAt ?? new Date()
  const expires = new Date(created.getTime() + input.retentionDays * 86_400_000)
  const createdAt = created.toISOString()
  const expiresAt = expires.toISOString()

  db.prepare(
    `INSERT INTO assets (
      id, storage_key, original_name, mime, size_bytes, retention_days, created_at, expires_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    id,
    input.storageKey,
    input.originalName,
    input.mime,
    input.sizeBytes,
    input.retentionDays,
    createdAt,
    expiresAt,
  )

  return {
    id,
    storageKey: input.storageKey,
    originalName: input.originalName,
    mime: input.mime,
    sizeBytes: input.sizeBytes,
    retentionDays: input.retentionDays,
    createdAt,
    expiresAt,
  }
}

export function getAssetById(db: DatabaseSync, id: string): AssetRow | null {
  const row = db
    .prepare(
      `SELECT id, storage_key, original_name, mime, size_bytes, retention_days, created_at, expires_at
       FROM assets WHERE id = ?`,
    )
    .get(id) as AssetDbRow | undefined
  return row ? mapRow(row) : null
}

export function deleteAssetRow(db: DatabaseSync, id: string): void {
  db.prepare(`DELETE FROM assets WHERE id = ?`).run(id)
}

export function isExpired(asset: AssetRow, now = new Date()): boolean {
  return Date.parse(asset.expiresAt) <= now.getTime()
}

function mapRow(row: AssetDbRow): AssetRow {
  return {
    id: row.id,
    storageKey: row.storage_key,
    originalName: row.original_name,
    mime: row.mime,
    sizeBytes: Number(row.size_bytes),
    retentionDays: Number(row.retention_days),
    createdAt: row.created_at,
    expiresAt: row.expires_at,
  }
}
