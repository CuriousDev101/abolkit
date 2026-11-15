/**
 * Idempotent Compose sample seed (#43).
 * Loads samples/lesson-1 into MinIO + the shared SQLite assets table.
 * Safe to re-run: a fixed demo asset id is skipped when already present.
 *
 * Usage (Compose): node --experimental-strip-types services/api/scripts/seed-demo.ts
 */
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'

import { createStorage } from '@abolkit/provider-sdk'

import { getAssetById, insertAsset } from '../src/db/assets.ts'
import { openDatabase } from '../src/db/sqlite.ts'

/** Stable id so restarts never create duplicate demo rows. */
export const DEMO_ASSET_ID = '00000000-0000-4000-8000-000000000001'

const enc = new TextEncoder()

async function main(env: Record<string, string | undefined> = process.env): Promise<void> {
  const databaseUrl = env.DATABASE_URL?.trim() || 'file:/data/abolkit.sqlite'
  const samplesRoot = resolve(env.SAMPLES_DIR?.trim() || 'samples/lesson-1')
  const retentionDays = Number(env.ASSET_RETENTION_DAYS ?? 365)

  const db = openDatabase(databaseUrl)
  const existing = getAssetById(db, DEMO_ASSET_ID)
  if (existing) {
    console.log(
      JSON.stringify({
        ok: true,
        event: 'seed.skipped',
        reason: 'demo asset already present',
        assetId: DEMO_ASSET_ID,
      }),
    )
    db.close()
    return
  }

  const storage = createStorage({
    storage: env.STORAGE_PROVIDER?.trim() || env.STORAGE?.trim() || 'minio',
    env,
    publicBaseUrl: env.PUBLIC_BASE_URL?.trim(),
  })

  const sourceBytes = await readFile(resolve(samplesRoot, 'demo-source.wav'))
  const sourceKey = `assets/${DEMO_ASSET_ID}/source`
  await storage.put(sourceKey, new Uint8Array(sourceBytes), 'audio/wav')

  insertAsset(db, {
    id: DEMO_ASSET_ID,
    storageKey: sourceKey,
    originalName: 'demo-source.wav',
    mime: 'audio/wav',
    sizeBytes: sourceBytes.byteLength,
    retentionDays: Number.isFinite(retentionDays) && retentionDays > 0 ? retentionDays : 365,
  })

  const extras: Array<{ file: string; key: string; mime: string }> = [
    { file: 'en.vtt', key: `assets/${DEMO_ASSET_ID}/captions/en.vtt`, mime: 'text/vtt' },
    { file: 'am.vtt', key: `assets/${DEMO_ASSET_ID}/captions/am.vtt`, mime: 'text/vtt' },
    {
      file: 'transcript.html',
      key: `assets/${DEMO_ASSET_ID}/transcript.html`,
      mime: 'text/html; charset=utf-8',
    },
  ]

  for (const item of extras) {
    const bytes = await readFile(resolve(samplesRoot, item.file))
    await storage.put(item.key, new Uint8Array(bytes), item.mime)
  }

  // Tiny marker so operators can see seed completed in object storage too.
  await storage.put(
    `assets/${DEMO_ASSET_ID}/seed.json`,
    enc.encode(
      JSON.stringify({
        assetId: DEMO_ASSET_ID,
        title: 'Compose demo lesson',
        seededAt: new Date().toISOString(),
      }),
    ),
    'application/json',
  )

  console.log(
    JSON.stringify({
      ok: true,
      event: 'seed.completed',
      assetId: DEMO_ASSET_ID,
      sourceKey,
      captions: extras.filter((e) => e.key.includes('/captions/')).map((e) => e.key),
      get: `/api/assets/${DEMO_ASSET_ID}`,
    }),
  )

  db.close()
}

const entry = process.argv[1]?.replaceAll('\\', '/')
const isDirectRun =
  entry?.endsWith('seed-demo.ts') === true || entry?.endsWith('seed-demo.js') === true

if (isDirectRun) {
  main().catch((err: unknown) => {
    console.error(
      JSON.stringify({
        ok: false,
        event: 'seed.failed',
        error: err instanceof Error ? err.message : String(err),
      }),
    )
    process.exitCode = 1
  })
}
