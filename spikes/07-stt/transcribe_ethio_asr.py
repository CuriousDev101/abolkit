#!/usr/bin/env python3
"""Spike #7 helper: run badrex/Ethio-ASR-amharic on a WAV file."""

from __future__ import annotations

import argparse
import time
from pathlib import Path

import torch
import torchaudio
from transformers import AutoModelForCTC, AutoProcessor

MODEL_ID = "badrex/Ethio-ASR-amharic"
TARGET_SR = 16_000


def load_mono_16k(path: Path) -> torch.Tensor:
    audio, sr = torchaudio.load(str(path))
    if audio.shape[0] > 1:
        audio = audio.mean(dim=0, keepdim=True)
    if sr != TARGET_SR:
        audio = torchaudio.functional.resample(audio, sr, TARGET_SR)
    return audio.squeeze(0)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("audio", type=Path, help="Path to a WAV (or other) audio file")
    parser.add_argument(
        "--model",
        default=MODEL_ID,
        help=f"Hugging Face model id (default: {MODEL_ID})",
    )
    args = parser.parse_args()

    if not args.audio.exists():
        raise SystemExit(f"Audio not found: {args.audio}")

    print(f"Loading model: {args.model}")
    t0 = time.perf_counter()
    processor = AutoProcessor.from_pretrained(args.model)
    model = AutoModelForCTC.from_pretrained(args.model)
    model.eval()
    load_s = time.perf_counter() - t0
    print(f"Model load: {load_s:.1f}s  device=cpu  params≈600M")

    waveform = load_mono_16k(args.audio)
    duration = waveform.numel() / TARGET_SR
    print(f"Audio: {args.audio.name}  {duration:.2f}s @ {TARGET_SR} Hz mono")

    inputs = processor(waveform.numpy(), sampling_rate=TARGET_SR, return_tensors="pt")

    t1 = time.perf_counter()
    with torch.no_grad():
        logits = model(**inputs).logits
    pred_ids = torch.argmax(logits, dim=-1)
    transcription = processor.batch_decode(pred_ids)[0]
    infer_s = time.perf_counter() - t1

    print("---")
    print(transcription)
    print("---")
    print(f"Inference: {infer_s:.2f}s  RTF={infer_s / max(duration, 1e-6):.2f}")


if __name__ == "__main__":
    main()
