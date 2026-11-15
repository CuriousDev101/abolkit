import { describe, expect, it } from 'vitest'

import { BrailleExportError } from './errors.ts'
import { ETHIO_G1_TABLE, probeLiblouis, translateToBraille } from './translate.ts'

describe('translateToBraille (injected)', () => {
  it('returns empty string for empty input without calling the bridge', async () => {
    let calls = 0
    const out = await translateToBraille({
      text: '',
      translateFn: async () => {
        calls += 1
        return 'x'
      },
    })
    expect(out).toBe('')
    expect(calls).toBe(0)
  })

  it('uses injectible translator and default table', async () => {
    const out = await translateToBraille({
      text: 'ሰላም',
      translateFn: async (text, table) => {
        expect(text).toBe('ሰላም')
        expect(table).toBe(ETHIO_G1_TABLE)
        return 's5lam'
      },
    })
    expect(out).toBe('s5lam')
  })

  it('does not fall back to original text on failure', async () => {
    await expect(
      translateToBraille({
        text: 'ሰላም',
        translateFn: async () => {
          throw new BrailleExportError('TRANSLATE_FAILED', 'boom')
        },
      }),
    ).rejects.toMatchObject({ code: 'TRANSLATE_FAILED' })
  })
})

describe('translateToBraille (Liblouis engine regression)', () => {
  it('matches known ethio-g1 smoke output when Liblouis is installed', async () => {
    const probe = await probeLiblouis()
    if (!probe.ok) {
      // CI / hosts without python3-louis — skip without failing the suite.
      expect(probe.ok).toBe(false)
      return
    }
    expect(probe.sample).toBe('s5lam')
    const mixed = await translateToBraille({ text: 'ሰላም Hello 123' })
    expect(mixed).toBe('s5lam Hello #abc')
    const punct = await translateToBraille({ text: 'አበባ።' })
    expect(typeof punct).toBe('string')
    expect(punct.length).toBeGreaterThan(0)
    expect(punct).not.toBe('አበባ።')
  })

  it('fails clearly for a missing table when Liblouis is installed', async () => {
    const probe = await probeLiblouis()
    if (!probe.ok) return
    await expect(
      translateToBraille({ text: 'ሰላም', table: 'abolkit-does-not-exist.ctb' }),
    ).rejects.toBeInstanceOf(BrailleExportError)
  })
})

describe('translateToBraille (missing dependency)', () => {
  it('raises LIBLOUIS_UNAVAILABLE when Python cannot start', async () => {
    await expect(
      translateToBraille({
        text: 'ሰላም',
        pythonPath: '/nonexistent/python-abolkit-braille',
      }),
    ).rejects.toMatchObject({ code: 'LIBLOUIS_UNAVAILABLE' })
  })
})
