import pg from 'pg'

export type Db = pg.Pool

export function createPool(postgresUrl: string): Db {
  return new pg.Pool({ connectionString: postgresUrl, max: 10 })
}

/** Serialises migrations when the API and worker start at the same time. */
const MIGRATION_LOCK = 7_007_001

const SCHEMA = `
CREATE TABLE IF NOT EXISTS videos (
  id uuid PRIMARY KEY,
  -- Canonical URL (identifyVideoUrl): how a video is found again.
  url text NOT NULL UNIQUE,
  source_url text NOT NULL,
  source_kind text NOT NULL CHECK (source_kind IN ('youtube', 'file')),
  title text,
  duration_seconds double precision,
  -- Spoken language, as detected by the transcriber or given in the request.
  source_language text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS captions (
  id uuid PRIMARY KEY,
  video_id uuid NOT NULL REFERENCES videos (id) ON DELETE CASCADE,
  language text NOT NULL,
  kind text NOT NULL CHECK (kind IN ('transcript', 'translation')),
  translated_from text,
  provider text NOT NULL,
  provider_ref text,
  storage_key text NOT NULL,
  -- API path that serves this file; responses turn it into an absolute URL.
  url text NOT NULL,
  vtt text NOT NULL,
  cue_count integer NOT NULL,
  needs_review boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (video_id, language)
);

CREATE TABLE IF NOT EXISTS caption_jobs (
  id uuid PRIMARY KEY,
  video_id uuid NOT NULL REFERENCES videos (id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('transcribe', 'translate')),
  -- Target language of a translate job.
  language text,
  -- Translations a transcribe job queues once the transcript exists.
  translate_to text[] NOT NULL DEFAULT '{}',
  source_language text,
  status text NOT NULL CHECK (status IN ('queued', 'running', 'succeeded', 'failed')),
  progress integer NOT NULL DEFAULT 0 CHECK (progress BETWEEN 0 AND 100),
  attempts integer NOT NULL DEFAULT 0,
  error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  started_at timestamptz,
  finished_at timestamptz
);

CREATE INDEX IF NOT EXISTS caption_jobs_video_idx ON caption_jobs (video_id, created_at DESC);
-- One queued or running job per video, type and language: repeated requests join it.
CREATE UNIQUE INDEX IF NOT EXISTS caption_jobs_active_idx
  ON caption_jobs (video_id, type, (coalesce(language, '')))
  WHERE status IN ('queued', 'running');
`

export async function migrate(db: Db): Promise<void> {
  const client = await db.connect()
  try {
    await client.query('SELECT pg_advisory_lock($1)', [MIGRATION_LOCK])
    try {
      await client.query(SCHEMA)
    } finally {
      await client.query('SELECT pg_advisory_unlock($1)', [MIGRATION_LOCK])
    }
  } finally {
    client.release()
  }
}
