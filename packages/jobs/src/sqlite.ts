import { mkdirSync } from 'node:fs'
import { dirname, isAbsolute, resolve } from 'node:path'
import { DatabaseSync } from 'node:sqlite'

/**
 * Open the shared SQLite file (asset metadata + job queue) without migrating.
 * Uses Node's built-in `node:sqlite` (no native addon). The API and the worker
 * open the same file from two processes, so writers wait on locks instead of
 * failing with SQLITE_BUSY.
 */
export function openSqlite(
  databaseUrl: string,
  options: { busyTimeoutMs?: number } = {},
): DatabaseSync {
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

  db.exec(`PRAGMA busy_timeout = ${Math.max(0, Math.trunc(options.busyTimeoutMs ?? 5000))};`)
  db.exec('PRAGMA foreign_keys = ON;')
  if (!memory) db.exec('PRAGMA journal_mode = WAL;')
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
