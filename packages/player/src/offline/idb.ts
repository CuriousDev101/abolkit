/** IndexedDB for offline download state, cached transcripts, and mirrored player settings. */

export const DB_NAME = 'abol-offline'
export const DB_VERSION = 1
export const LESSONS_STORE = 'lessons'
export const SETTINGS_STORE = 'settings'
export const SETTINGS_KEY = 'player'

export type OfflineStatus = 'idle' | 'downloading' | 'ready' | 'error'

export interface OfflineLessonRecord {
  id: string
  title?: string
  urls: string[]
  bytes?: number
  progress: number
  status: OfflineStatus
  cachedAt?: number
  error?: string
  /** Cached transcript HTML when the network copy is unavailable. */
  transcriptHtml?: string
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB unavailable'))
      return
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(LESSONS_STORE)) db.createObjectStore(LESSONS_STORE, { keyPath: 'id' })
      if (!db.objectStoreNames.contains(SETTINGS_STORE)) db.createObjectStore(SETTINGS_STORE)
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error ?? new Error('IndexedDB open failed'))
  })
}

function reqToPromise<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error ?? new Error('IndexedDB request failed'))
  })
}

export async function getLesson(id: string): Promise<OfflineLessonRecord | undefined> {
  try {
    const db = await openDb()
    try {
      const result = await reqToPromise(
        db.transaction(LESSONS_STORE, 'readonly').objectStore(LESSONS_STORE).get(id),
      )
      return result as OfflineLessonRecord | undefined
    } finally {
      db.close()
    }
  } catch {
    return undefined
  }
}

export async function putLesson(record: OfflineLessonRecord): Promise<void> {
  const db = await openDb()
  try {
    await reqToPromise(db.transaction(LESSONS_STORE, 'readwrite').objectStore(LESSONS_STORE).put(record))
  } finally {
    db.close()
  }
}

export async function deleteLesson(id: string): Promise<void> {
  try {
    const db = await openDb()
    try {
      await reqToPromise(db.transaction(LESSONS_STORE, 'readwrite').objectStore(LESSONS_STORE).delete(id))
    } finally {
      db.close()
    }
  } catch {
    // ignore
  }
}

export async function getIdbSettings<T>(): Promise<T | undefined> {
  try {
    const db = await openDb()
    try {
      return (await reqToPromise(
        db.transaction(SETTINGS_STORE, 'readonly').objectStore(SETTINGS_STORE).get(SETTINGS_KEY),
      )) as T | undefined
    } finally {
      db.close()
    }
  } catch {
    return undefined
  }
}

export async function putIdbSettings<T>(value: T): Promise<void> {
  try {
    const db = await openDb()
    try {
      await reqToPromise(
        db.transaction(SETTINGS_STORE, 'readwrite').objectStore(SETTINGS_STORE).put(value, SETTINGS_KEY),
      )
    } finally {
      db.close()
    }
  } catch {
    // storage blocked — ignore
  }
}
