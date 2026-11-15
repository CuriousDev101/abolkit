import { JobError, JOB_TYPES, type JobType } from '@abolkit/jobs'

import type { JobHandler, JobHandlers } from './runner.ts'

const PLANNED_IN: Record<JobType, string> = {
  transcribe: '#26 (ffmpeg) and #27 (STT)',
  translate: 'a later pipeline issue',
  'describe-tts': 'a later pipeline issue',
  'offline-pack': 'a later pipeline issue',
}

function notImplemented(type: JobType): JobHandler {
  return async () => {
    throw new JobError(`Job type "${type}" is not implemented yet (lands in ${PLANNED_IN[type]})`, {
      retryable: false,
    })
  }
}

/**
 * Every job type has a handler so no job sits queued forever. Real handlers
 * replace these entries as the pipeline issues land.
 */
export function createDefaultHandlers(): JobHandlers {
  return Object.fromEntries(JOB_TYPES.map((type) => [type, notImplemented(type)])) as JobHandlers
}
