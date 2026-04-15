from __future__ import annotations

from dataclasses import asdict, dataclass
from math import hypot
from time import monotonic
from typing import Callable

PointerProvider = Callable[[], tuple[int, int]]


@dataclass
class GuardWindow:
    armed: bool = False
    baseline_x: int = 0
    baseline_y: int = 0
    armed_at: float = 0.0
    expires_at: float = 0.0
    movement_threshold_px: int = 18

    def to_dict(self) -> dict[str, object]:
        return asdict(self)


@dataclass
class GuardDecision:
    should_abort: bool = False
    reason: str = "guard_inactive"
    distance_px: float = 0.0
    pointer: tuple[int, int] | None = None
    armed: bool = False

    def to_dict(self) -> dict[str, object]:
        return {
            "should_abort": self.should_abort,
            "reason": self.reason,
            "distance_px": round(self.distance_px, 2),
            "pointer": list(self.pointer) if self.pointer is not None else None,
            "armed": self.armed,
        }


class HumanOverrideGuard:
    def __init__(self, pointer_provider: PointerProvider | None = None) -> None:
        self._pointer_provider = pointer_provider
        self._window = GuardWindow()

    def configure_pointer_provider(self, pointer_provider: PointerProvider | None) -> None:
        self._pointer_provider = pointer_provider

    def snapshot(self) -> GuardWindow:
        return GuardWindow(**self._window.to_dict())

    def reset(self) -> None:
        self._window = GuardWindow()

    def arm(
        self,
        *,
        enabled: bool,
        active_window_sec: float,
        movement_threshold_px: int,
        pointer: tuple[int, int] | None = None,
        now_monotonic: float | None = None,
    ) -> GuardWindow:
        if not enabled:
            self.reset()
            return self.snapshot()

        baseline = pointer if pointer is not None else self._read_pointer()
        if baseline is None:
            self.reset()
            return self.snapshot()

        now_value = monotonic() if now_monotonic is None else float(now_monotonic)
        ttl = max(0.1, float(active_window_sec))
        threshold = max(1, int(movement_threshold_px))
        self._window = GuardWindow(
            armed=True,
            baseline_x=int(baseline[0]),
            baseline_y=int(baseline[1]),
            armed_at=now_value,
            expires_at=now_value + ttl,
            movement_threshold_px=threshold,
        )
        return self.snapshot()

    def evaluate(
        self,
        *,
        pointer: tuple[int, int] | None = None,
        now_monotonic: float | None = None,
    ) -> GuardDecision:
        if not self._window.armed:
            return GuardDecision(should_abort=False, reason="guard_inactive", armed=False)

        now_value = monotonic() if now_monotonic is None else float(now_monotonic)
        if now_value >= self._window.expires_at:
            self.reset()
            return GuardDecision(should_abort=False, reason="guard_expired", armed=False)

        current = pointer if pointer is not None else self._read_pointer()
        if current is None:
            return GuardDecision(should_abort=False, reason="pointer_unavailable", armed=True)

        distance = hypot(current[0] - self._window.baseline_x, current[1] - self._window.baseline_y)
        if distance >= float(self._window.movement_threshold_px):
            self.reset()
            return GuardDecision(
                should_abort=True,
                reason="human_override_detected",
                distance_px=distance,
                pointer=current,
                armed=False,
            )

        return GuardDecision(
            should_abort=False,
            reason="guard_clear",
            distance_px=distance,
            pointer=current,
            armed=True,
        )

    def _read_pointer(self) -> tuple[int, int] | None:
        if self._pointer_provider is None:
            return None
        try:
            point = self._pointer_provider()
        except Exception:
            return None
        if not isinstance(point, tuple) or len(point) != 2:
            return None
        return int(point[0]), int(point[1])
