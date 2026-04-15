from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Protocol

from PIL import Image


@dataclass
class FrameGateDecision:
    should_process: bool
    signature: str = ""
    distance: int = 0
    reason: str = ""


class FrameChangeGate(Protocol):
    def evaluate(
        self,
        frame_path: Path,
        *,
        enabled: bool = True,
        min_change_distance: int = 3,
        stable_skip_limit: int = 300,
    ) -> FrameGateDecision:
        ...


class DefaultFrameChangeGate:
    def __init__(self) -> None:
        self._last_signature = ""
        self._stable_skip_count = 0

    def evaluate(
        self,
        frame_path: Path,
        *,
        enabled: bool = True,
        min_change_distance: int = 3,
        stable_skip_limit: int = 300,
    ) -> FrameGateDecision:
        if not enabled:
            return FrameGateDecision(should_process=True, reason="gate_disabled")
        if not frame_path.exists():
            return FrameGateDecision(should_process=True, reason="frame_missing")

        signature = self._compute_dhash(frame_path)
        if not self._last_signature:
            self._last_signature = signature
            self._stable_skip_count = 0
            return FrameGateDecision(should_process=True, signature=signature, reason="initial_frame")

        distance = self._hamming_distance(signature, self._last_signature)
        if distance < max(0, int(min_change_distance)) and self._stable_skip_count < max(0, int(stable_skip_limit)):
            self._stable_skip_count += 1
            return FrameGateDecision(
                should_process=False,
                signature=signature,
                distance=distance,
                reason="frame_unchanged",
            )

        self._last_signature = signature
        self._stable_skip_count = 0
        return FrameGateDecision(
            should_process=True,
            signature=signature,
            distance=distance,
            reason="frame_changed",
        )

    def reset(self) -> None:
        self._last_signature = ""
        self._stable_skip_count = 0

    def _compute_dhash(self, frame_path: Path) -> str:
        with Image.open(frame_path) as opened:
            image = opened.convert("L").resize((9, 8))
            pixels = list(image.getdata())
        bits: list[str] = []
        for row in range(8):
            offset = row * 9
            for column in range(8):
                left = pixels[offset + column]
                right = pixels[offset + column + 1]
                bits.append("1" if left > right else "0")
        digest = int("".join(bits), 2).to_bytes(8, "big", signed=False)
        return digest.hex()

    def _hamming_distance(self, left: str, right: str) -> int:
        left_value = int(left, 16)
        right_value = int(right, 16)
        return (left_value ^ right_value).bit_count()
