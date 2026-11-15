#!/usr/bin/env python3
"""Liblouis bridge for the worker Braille exporter (#55).

Reads JSON from stdin: { "text": "...", "table": "ethio-g1.ctb" }
Writes JSON to stdout: { "ok": true, "braille": "..." } or { "ok": false, "error": "..." }

Experimental Amharic Braille — linguistic correctness is not verified by this script.
"""
from __future__ import annotations

import json
import sys


def main() -> int:
    try:
        raw = sys.stdin.read()
        payload = json.loads(raw) if raw.strip() else {}
    except json.JSONDecodeError as err:
        print(json.dumps({"ok": False, "error": f"invalid_json: {err}"}))
        return 2

    text = payload.get("text")
    table = payload.get("table") or "ethio-g1.ctb"
    if not isinstance(text, str):
        print(json.dumps({"ok": False, "error": "text must be a string"}))
        return 2
    if not isinstance(table, str) or not table.strip():
        print(json.dumps({"ok": False, "error": "table must be a non-empty string"}))
        return 2

    try:
        import louis  # type: ignore
    except ImportError as err:
        print(
            json.dumps(
                {
                    "ok": False,
                    "error": f"liblouis_unavailable: Python louis module not installed ({err})",
                }
            )
        )
        return 3

    try:
        # Engine regression only — not a linguistic correctness check.
        braille = louis.translateString([table], text, None, 0)
    except RuntimeError as err:
        print(json.dumps({"ok": False, "error": f"translate_failed: {err}"}))
        return 4
    except Exception as err:  # noqa: BLE001 — surface any table/lib error to Node
        print(json.dumps({"ok": False, "error": f"translate_failed: {type(err).__name__}: {err}"}))
        return 4

    print(json.dumps({"ok": True, "braille": braille, "table": table, "liblouis": louis.version()}))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
