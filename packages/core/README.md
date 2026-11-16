# `@abolkit/core`

Shared, dependency-free TypeScript helpers used by Abol Kit packages (WebVTT, cues, player settings, UI i18n, a11y helpers).

## Install

```bash
npm install @abolkit/core
```

## Usage

```js
import { parseVtt, serializeVtt, resolveUiLang, t } from '@abolkit/core'

const cues = parseVtt(vttText)
const lang = resolveUiLang('am-ET')
```

This package has **no runtime dependencies** and does not use the `workspace:` protocol.

## License

MIT
