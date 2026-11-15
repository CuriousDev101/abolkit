import { spawn } from 'node:child_process'
import { access } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { BrailleExportError } from './errors.ts'

/** Default Ethiopic Grade 1 table (Liblouis). Prefer this over gez.tbl alias. */
export const ETHIO_G1_TABLE = 'ethio-g1.ctb'

export type TranslateBrailleOptions = {
  text: string
  /** Liblouis table id (default ethio-g1.ctb). */
  table?: string
  /** Override path to the Python bridge script. */
  bridgeScript?: string
  /** Python executable (default python3). */
  pythonPath?: string
  /** Injected translator for tests. */
  translateFn?: (text: string, table: string) => Promise<string>
  signal?: AbortSignal
}

function defaultBridgeScript(): string {
  // services/worker/src/pack/braille → services/worker/scripts/
  const here = dirname(fileURLToPath(import.meta.url))
  return join(here, '../../../scripts/liblouis_translate.py')
}

/**
 * Translate print text to braille ASCII via Liblouis (Python bridge).
 * Does not fall back to the original text on failure.
 */
export async function translateToBraille(options: TranslateBrailleOptions): Promise<string> {
  const table = options.table?.trim() || ETHIO_G1_TABLE
  const text = options.text

  if (typeof text !== 'string') {
    throw new BrailleExportError('INVALID_INPUT', 'text must be a string')
  }

  // Empty captions short-circuit before any bridge / injectible translator call.
  if (text.length === 0) return ''

  if (options.translateFn) {
    return options.translateFn(text, table)
  }

  const script = options.bridgeScript ?? defaultBridgeScript()
  try {
    await access(script)
  } catch (err) {
    throw new BrailleExportError('BRIDGE_FAILED', `Liblouis bridge script not found at ${script}`, {
      cause: err,
    })
  }

  const python = options.pythonPath?.trim() || process.env.PYTHON?.trim() || 'python3'
  const payload = JSON.stringify({ text, table })

  const result = await runPythonBridge(python, script, payload, options.signal)
  if (!result.ok) {
    const msg = result.error || 'unknown bridge error'
    if (/liblouis_unavailable/i.test(msg) || /louis module not installed/i.test(msg)) {
      throw new BrailleExportError(
        'LIBLOUIS_UNAVAILABLE',
        `Liblouis is not available in this environment: ${msg}. Install python3-louis and liblouis-data (see docs).`,
      )
    }
    if (/Cannot find table|table.*not found|Cannot resolve table/i.test(msg)) {
      throw new BrailleExportError('TABLE_MISSING', `Liblouis table "${table}" is missing: ${msg}`)
    }
    throw new BrailleExportError('TRANSLATE_FAILED', msg)
  }
  return result.braille ?? ''
}

type BridgeOk = { ok: true; braille: string; table?: string; liblouis?: string }
type BridgeErr = { ok: false; error: string }

async function runPythonBridge(
  python: string,
  script: string,
  payload: string,
  signal?: AbortSignal,
): Promise<BridgeOk | BridgeErr> {
  return new Promise((resolve, reject) => {
    const child = spawn(python, [script], {
      stdio: ['pipe', 'pipe', 'pipe'],
      signal,
    })
    let stdout = ''
    let stderr = ''
    child.stdout.setEncoding('utf8')
    child.stderr.setEncoding('utf8')
    child.stdout.on('data', (chunk: string) => {
      stdout += chunk
    })
    child.stderr.on('data', (chunk: string) => {
      stderr += chunk
    })
    child.on('error', (err) => {
      reject(
        new BrailleExportError(
          'LIBLOUIS_UNAVAILABLE',
          `Failed to start Python (${python}): ${err.message}. Install python3 and python3-louis.`,
          { cause: err },
        ),
      )
    })
    child.on('close', (code) => {
      const trimmed = stdout.trim()
      if (!trimmed) {
        resolve({
          ok: false,
          error: `bridge_failed: empty stdout (exit ${code})${stderr ? `; stderr: ${stderr.trim()}` : ''}`,
        })
        return
      }
      try {
        const parsed = JSON.parse(trimmed) as BridgeOk | BridgeErr
        resolve(parsed)
      } catch (err) {
        resolve({
          ok: false,
          error: `bridge_failed: non-JSON stdout (exit ${code}): ${trimmed.slice(0, 200)}`,
        })
        void err
      }
    })
    child.stdin.write(payload)
    child.stdin.end()
  })
}

/** Probe whether Liblouis + ethio-g1.ctb are usable (for docs / --info). */
export async function probeLiblouis(
  options: Pick<TranslateBrailleOptions, 'bridgeScript' | 'pythonPath' | 'table'> = {},
): Promise<{ ok: true; sample: string; table: string } | { ok: false; error: string }> {
  try {
    const sample = await translateToBraille({
      text: 'ሰላም',
      table: options.table ?? ETHIO_G1_TABLE,
      bridgeScript: options.bridgeScript,
      pythonPath: options.pythonPath,
    })
    return { ok: true, sample, table: options.table ?? ETHIO_G1_TABLE }
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    }
  }
}
