/**
 * GPL companion entry: `dist/abol-player.braille.js`
 *
 * Loads sibling `abol-player.braille.capi.js` (emscripten Liblouis) then embeds ethio-g1
 * tables. The MIT player loads this file lazily and never imports liblouis into main bundles.
 */
import { registerBrailleGlobal } from './liblouis-browser.js'

void registerBrailleGlobal()
