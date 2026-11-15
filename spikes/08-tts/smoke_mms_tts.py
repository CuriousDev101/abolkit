#!/usr/bin/env python3
"""Throwaway smoke for Meta MMS-TTS Amharic (spike #8).

Does NOT belong in production images. Weights download from Hugging Face on first run.
Licence: facebook/mms-tts-amh is CC-BY-NC 4.0 — non-commercial only.

  python3 -m venv .venv && . .venv/bin/activate
  pip install 'torch' 'transformers>=4.36' 'accelerate' 'scipy' 'uroman'
  python smoke_mms_tts.py --text 'ሰላም። ይህ የድምጽ መግለጫ ሙከራ ነው።' --out /tmp/mms-amh.wav
"""

from __future__ import annotations

import argparse
import time
from pathlib import Path


def main() -> None:
    parser = argparse.ArgumentParser(description="Smoke facebook/mms-tts-amh")
    parser.add_argument(
        "--text",
        default="ሰላም። ይህ የድምጽ መግለጫ ሙከራ ነው።",
        help="Amharic (Ethiopic) text; tokenizer applies uroman when installed",
    )
    parser.add_argument("--out", type=Path, default=Path("mms-amh-smoke.wav"))
    parser.add_argument("--model", default="facebook/mms-tts-amh")
    args = parser.parse_args()

    import torch
    from transformers import AutoTokenizer, VitsModel

    t0 = time.perf_counter()
    model = VitsModel.from_pretrained(args.model)
    tokenizer = AutoTokenizer.from_pretrained(args.model)
    load_s = time.perf_counter() - t0

    t1 = time.perf_counter()
    inputs = tokenizer(args.text, return_tensors="pt")
    with torch.no_grad():
        waveform = model(**inputs).waveform
    infer_s = time.perf_counter() - t1

    import numpy as np
    from scipy.io import wavfile

    audio = waveform.squeeze().cpu().numpy()
    rate = int(model.config.sampling_rate)
    # scipy expects int16-friendly scale for audibility in simple players
    pcm = np.int16(np.clip(audio, -1.0, 1.0) * 32767)
    args.out.parent.mkdir(parents=True, exist_ok=True)
    wavfile.write(str(args.out), rate, pcm)

    print(
        {
            "ok": True,
            "model": args.model,
            "licence": "CC-BY-NC-4.0",
            "sampleRate": rate,
            "secondsAudio": float(len(pcm) / rate),
            "loadSeconds": round(load_s, 3),
            "inferSeconds": round(infer_s, 3),
            "out": str(args.out.resolve()),
            "note": "Non-commercial licence — not the Abol Kit default (see RESULT.md).",
        }
    )


if __name__ == "__main__":
    main()
