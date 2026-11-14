import path from 'node:path'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))

/** Spike package root: spikes/14-open-badges */
export const spikeRoot = path.resolve(here, '../..')

export const keysDir = path.join(spikeRoot, 'keys')
export const privateKeyPath = path.join(keysDir, 'private.jwk')
export const publicKeyPath = path.join(keysDir, 'public.jwk')
export const outDir = path.join(spikeRoot, 'out')
export const credentialOutPath = path.join(outDir, 'sample-credential.json')
