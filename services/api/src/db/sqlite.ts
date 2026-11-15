import { mkdirSync } from 'node:fs'
import { dirname, isAbsolute, resolve } from 'node:path'
import { DatabaseSync } from 'node:sqlite'

/**
 * Open (and migrate) the API SQLite file used for asset metadata.
 * Uses Node's built-in `node:sqlite` (no native addon).
 */
export function openDatabase(databaseUrl: string): DatabaseSync {
  const trimmed = databaseUrl.trim()
  const memory =
    trimmed === ':memory:' ||
    trimmed === 'file::memory:' ||
    trimmed === 'file:memdb1?mode=memory&cache=shared'

  const db = memory
    ? new DatabaseSync(':memory:')
    : (() => {
        const filePath = sqlitePathFromUrl(trimmed)
        mkdirSync(dirname(filePath), { recursive: true })
        return new DatabaseSync(filePath)
      })()

  db.exec('PRAGMA foreign_keys = ON;')
  if (!memory) db.exec('PRAGMA journal_mode = WAL;')
  migrate(db)
  return db
}

/** Resolve `file:./data/abolkit.sqlite`, `file:///data/x.sqlite`, or a plain path. */
export function sqlitePathFromUrl(databaseUrl: string): string {
  const trimmed = databaseUrl.trim()
  if (!trimmed) {
    throw new Error('DATABASE_URL is empty')
  }

  let pathPart = trimmed.startsWith('file:') ? trimmed.slice('file:'.length) : trimmed

  // file:///C:/data/x.sqlite or file:///data/x.sqlite
  if (pathPart.startsWith('///')) {
    pathPart = pathPart.slice(2) // keep one leading /
    if (/^\/[A-Za-z]:/.test(pathPart)) {
      pathPart = pathPart.slice(1)
    }
  } else if (pathPart.startsWith('//') && /^\/\/[A-Za-z]:/.test(pathPart)) {
    pathPart = pathPart.slice(2)
  }

  if (isAbsolute(pathPart) || /^[A-Za-z]:[\\/]/.test(pathPart)) {
    return pathPart
  }
  return resolve(pathPart)
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
