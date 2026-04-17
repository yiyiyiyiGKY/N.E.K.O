"""Input adapter: smooth mouse movement, click, and pointer querying."""
from __future__ import annotations

import time
from dataclasses import dataclass
from typing import Any, Callable


ClickExecutor = Callable[[int, int], None]
MoveExecutor = Callable[[int, int, float], None]
PointerProvider = Callable[[], tuple[int, int]]


@dataclass
class InputCommand:
    target_x: int
    target_y: int
    click: bool = True
    click_button: str = "left"
    move_duration_sec: float = 0.25


class InputAdapter:
    def __init__(
        self,
        *,
        click_executor: ClickExecutor | None = None,
        move_executor: MoveExecutor | None = None,
        pointer_provider: PointerProvider | None = None,
    ) -> None:
        self._click_executor = click_executor or _default_click
        self._move_executor = move_executor or _default_move
        self._pointer_provider = pointer_provider or _default_pointer

    def get_pointer(self) -> tuple[int, int] | None:
        try:
            point = self._pointer_provider()
        except Exception:
            return None
        if not isinstance(point, tuple) or len(point) != 2:
            return None
        return int(point[0]), int(point[1])

    def execute(
        self,
        command: InputCommand,
        *,
        guard_check: Callable[[], tuple[bool, str]] | None = None,
    ) -> dict[str, Any]:
        """Execute a single input command with optional guard check.

        Returns a dict with keys: ok, aborted, abort_reason, target_x, target_y, elapsed_ms.
        """
        start = time.monotonic()
        try:
            self._move_executor(command.target_x, command.target_y, command.move_duration_sec)
        except Exception as exc:
            return {
                "ok": False,
                "aborted": False,
                "abort_reason": f"move_failed: {exc}",
                "target_x": command.target_x,
                "target_y": command.target_y,
                "elapsed_ms": _elapsed_ms(start),
            }

        if guard_check is not None:
            should_abort, reason = guard_check()
            if should_abort:
                return {
                    "ok": False,
                    "aborted": True,
                    "abort_reason": reason,
                    "target_x": command.target_x,
                    "target_y": command.target_y,
                    "elapsed_ms": _elapsed_ms(start),
                }

        if command.click:
            try:
                self._click_executor(command.target_x, command.target_y)
            except Exception as exc:
                return {
                    "ok": False,
                    "aborted": False,
                    "abort_reason": f"click_failed: {exc}",
                    "target_x": command.target_x,
                    "target_y": command.target_y,
                    "elapsed_ms": _elapsed_ms(start),
                }

        return {
            "ok": True,
            "aborted": False,
            "abort_reason": "",
            "target_x": command.target_x,
            "target_y": command.target_y,
            "elapsed_ms": _elapsed_ms(start),
        }

    @staticmethod
    def build_command_from_action(
        action_id: str,
        *,
        window_left: int = 0,
        window_top: int = 0,
        window_width: int = 0,
        window_height: int = 0,
    ) -> InputCommand | None:
        """Build an InputCommand for a known action_id based on window geometry.

        Returns None if the action_id is not mapped to a screen coordinate.
        """
        center_x = window_left + window_width // 2
        center_y = window_top + window_height // 2

        action_offsets: dict[str, tuple[int, int, bool]] = {
            "replay_next": (window_width // 2 + 150, window_height - 100, True),
            "replay_prev": (window_width // 2 - 150, window_height - 100, True),
            "dialog_confirm": (window_width // 2 + 100, window_height // 2 + 50, True),
            "dialog_cancel": (window_width // 2 - 100, window_height // 2 + 50, True),
            "menu_back": (50, 50, True),
            "menu_start_replay": (center_x - window_left, center_y - window_top + 100, True),
        }

        offset = action_offsets.get(action_id)
        if offset is None:
            return None

        dx, dy, click = offset
        return InputCommand(
            target_x=window_left + dx,
            target_y=window_top + dy,
            click=click,
        )


def _default_click(x: int, y: int) -> None:
    try:
        import pyautogui
    except ImportError as exc:
        raise RuntimeError("pyautogui unavailable") from exc
    pyautogui.click(x, y)


def _default_move(x: int, y: int, duration: float) -> None:
    try:
        import pyautogui
    except ImportError as exc:
        raise RuntimeError("pyautogui unavailable") from exc
    pyautogui.moveTo(x, y, duration=duration)


def _default_pointer() -> tuple[int, int]:
    try:
        import pyautogui
    except ImportError as exc:
        raise RuntimeError("pyautogui unavailable") from exc
    point = pyautogui.position()
    return int(point.x), int(point.y)


def _elapsed_ms(start: float) -> int:
    return int((time.monotonic() - start) * 1000)
