import { migrateJobs, openSqlite } from '@abolkit/jobs'
import type { DatabaseSync } from 'node:sqlite'

import { migrateJobAudioSummaries } from './job-audio-summaries.ts'

export { sqlitePathFromUrl } from '@abolkit/jobs'

/**
 * Open (and migrate) the SQLite file shared with the worker: asset metadata
 * plus the DB-backed job queue (ADR 0005) and job-card audio summaries.
 */
export function openDatabase(databaseUrl: string): DatabaseSync {
  const db = openSqlite(databaseUrl)
  migrate(db)
  migrateJobs(db)
  migrateJobAudioSummaries(db)
  return db
}

function migrate(db: DatabaseSync): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS assets (
      id TEXT PRIMARY KEY NOT NULL,
      storage_key TEXT NOT NULL UNIQUE,
      original_name TEXT,
      mime TEXT NOT NULL,
      size_bytes INTEGER NOT NULL,
      retention_days INTEGER NOT NULL,
      created_at TEXT NOT NULL,
      expires_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS assets_expires_at_idx ON assets (expires_at);
  `)
}
