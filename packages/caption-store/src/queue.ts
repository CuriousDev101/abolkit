import { Queue, Worker, type Job, type JobsOptions } from 'bullmq'

import type { CaptionConfig } from './config.ts'
import type { CaptionJobType } from './repo.ts'

export const QUEUE_NAMES: Record<CaptionJobType, string> = {
  transcribe: 'captions-transcribe',
  translate: 'captions-translate',
}

/** Postgres (`caption_jobs`) is the record; the BullMQ job only carries its id. */
export interface CaptionJobData {
  captionJobId: string
  videoId: string
}

export type CaptionQueueJob = Job<CaptionJobData>

export interface CaptionQueues {
  enqueue(type: CaptionJobType, data: CaptionJobData): Promise<void>
  close(): Promise<void>
}

function connection(config: CaptionConfig) {
  // BullMQ workers block on Redis; ioredis must not give up on those commands.
  return { url: config.redisUrl, maxRetriesPerRequest: null }
}

export function createCaptionQueues(config: CaptionConfig): CaptionQueues {
  const options = { connection: connection(config), prefix: config.redisPrefix }
  const queues: Record<CaptionJobType, Queue<CaptionJobData>> = {
    transcribe: new Queue<CaptionJobData>(QUEUE_NAMES.transcribe, options),
    translate: new Queue<CaptionJobData>(QUEUE_NAMES.translate, options),
  }
  const jobOptions: JobsOptions = {
    attempts: config.jobAttempts,
    backoff: { type: 'exponential', delay: config.jobBackoffMs },
    removeOnComplete: { age: 24 * 3600, count: 1000 },
    removeOnFail: { age: 7 * 24 * 3600 },
  }
  return {
    async enqueue(type, data) {
      // jobId = caption job id, so a retried enqueue of the same row is a no-op.
      await queues[type].add(type, data, { ...jobOptions, jobId: data.captionJobId })
    },
    async close() {
      await Promise.all([queues.transcribe.close(), queues.translate.close()])
    },
  }
}

export function createCaptionWorker(
  config: CaptionConfig,
  type: CaptionJobType,
  processor: (job: CaptionQueueJob, signal?: AbortSignal) => Promise<void>,
): Worker<CaptionJobData> {
  return new Worker<CaptionJobData>(
    QUEUE_NAMES[type],
    (job, _token, signal) => processor(job, signal),
    {
      connection: connection(config),
      prefix: config.redisPrefix,
      concurrency:
        type === 'transcribe' ? config.transcribeConcurrency : config.translateConcurrency,
    },
  )
}
