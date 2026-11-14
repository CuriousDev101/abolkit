# MMS HTTP wrapper contract (external repo)

Abol Kit expects this shape from `TRANSCRIBER_URL` (no trailing slash).

## Endpoints

### `GET /health`
```json
{ "ok": true, "ready": true, "model": "facebook/mms-1b-all", "version": "0.1.0" }
```

### `GET /ready`
`200` when model loaded; `503` otherwise.

### `POST /transcribe`
- `multipart/form-data` field `file`
- query `lang`: `am` | `en`
- response:

```json
{
  "text": "full transcript",
  "lang": "am",
  "segments": [{ "start": 0.0, "end": 2.4, "text": "..." }],
  "sendsDataOffHost": false,
  "model": "facebook/mms-1b-all",
  "durationMs": 1840,
  "needsReview": true
}
```

Errors:
```json
{ "error": { "code": "BAD_AUDIO", "message": "..." } }
```

## Env (abolkit)

```bash
TRANSCRIBER=mms-http
TRANSCRIBER_URL=http://mms-stt:8000
```
