from __future__ import annotations

import platform
import shutil
import subprocess
from dataclasses import asdict, dataclass
from typing import Any, Optional


@dataclass
class WindowBindingResult:
    bound: bool
    window_title: str = ""
    app_name: str = ""
    match_keyword: str = ""
    source: str = ""
    error: str = ""
    left: Optional[int] = None
    top: Optional[int] = None
    width: Optional[int] = None
    height: Optional[int] = None

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)

    def has_bounds(self) -> bool:
        return (
            isinstance(self.left, int)
            and isinstance(self.top, int)
            and isinstance(self.width, int)
            and self.width > 0
            and isinstance(self.height, int)
            and self.height > 0
        )


def _normalize_title(value: str) -> str:
    return " ".join(str(value).split()).strip()


def _get_active_window_windows() -> WindowBindingResult:
    try:
        import pygetwindow as gw  # type: ignore[import-not-found]
    except Exception as exc:
        return WindowBindingResult(bound=False, source="pygetwindow", error=f"pygetwindow unavailable: {exc}")

    try:
        active = gw.getActiveWindow()
        if active is None:
            return WindowBindingResult(bound=False, source="pygetwindow", error="no active window")
        title = _normalize_title(getattr(active, "title", "") or "")
        left = int(getattr(active, "left", 0) or 0)
        top = int(getattr(active, "top", 0) or 0)
        width = int(getattr(active, "width", 0) or 0)
        height = int(getattr(active, "height", 0) or 0)
        return WindowBindingResult(
            bound=False,
            window_title=title,
            source="pygetwindow",
            left=left,
            top=top,
            width=width or None,
            height=height or None,
        )
    except Exception as exc:
        return WindowBindingResult(bound=False, source="pygetwindow", error=str(exc))


def _get_active_window_macos() -> WindowBindingResult:
    if shutil.which("osascript") is None:
        return WindowBindingResult(bound=False, source="osascript", error="osascript unavailable")

    script = r'''
tell application "System Events"
    set frontApp to first application process whose frontmost is true
    set appName to name of frontApp
    set winTitle to ""
    set winPos to "0,0"
    set winSize to "0,0"
    try
        set winTitle to name of front window of frontApp
        set winPosList to position of front window of frontApp
        set winSizeList to size of front window of frontApp
        set winPos to (item 1 of winPosList as text) & "," & (item 2 of winPosList as text)
        set winSize to (item 1 of winSizeList as text) & "," & (item 2 of winSizeList as text)
    end try
    return appName & "||" & winTitle & "||" & winPos & "||" & winSize
end tell
'''
    try:
        output = subprocess.check_output(
            ["osascript", "-e", script],
            text=True,
            stderr=subprocess.STDOUT,
            timeout=3.0,
        ).strip()
        parts = output.split("||")
        app_name = _normalize_title(parts[0]) if len(parts) > 0 else ""
        title = _normalize_title(parts[1]) if len(parts) > 1 else ""
        pos = parts[2] if len(parts) > 2 else "0,0"
        size = parts[3] if len(parts) > 3 else "0,0"
        left_s, top_s = (pos.split(",", 1) + ["0"])[:2]
        width_s, height_s = (size.split(",", 1) + ["0"])[:2]
        return WindowBindingResult(
            bound=False,
            window_title=title,
            app_name=app_name,
            source="osascript",
            left=int(left_s) if left_s.strip().lstrip("-").isdigit() else None,
            top=int(top_s) if top_s.strip().lstrip("-").isdigit() else None,
            width=int(width_s) if width_s.strip().isdigit() else None,
            height=int(height_s) if height_s.strip().isdigit() else None,
        )
    except Exception as exc:
        return WindowBindingResult(bound=False, source="osascript", error=str(exc))


def _get_active_window_linux() -> WindowBindingResult:
    if shutil.which("xdotool"):
        try:
            window_id = subprocess.check_output(
                ["xdotool", "getactivewindow"],
                text=True,
                stderr=subprocess.STDOUT,
                timeout=3.0,
            ).strip()
            title = subprocess.check_output(
                ["xdotool", "getwindowname", window_id],
                text=True,
                stderr=subprocess.STDOUT,
                timeout=3.0,
            ).strip()
            geometry_raw = subprocess.check_output(
                ["xdotool", "getwindowgeometry", "--shell", window_id],
                text=True,
                stderr=subprocess.STDOUT,
                timeout=3.0,
            )
            geometry: dict[str, int] = {}
            for line in geometry_raw.splitlines():
                if "=" not in line:
                    continue
                key, value = line.split("=", 1)
                key = key.strip()
                value = value.strip()
                if value.lstrip("-").isdigit():
                    geometry[key] = int(value)
            return WindowBindingResult(
                bound=False,
                window_title=_normalize_title(title),
                source="xdotool",
                left=geometry.get("X"),
                top=geometry.get("Y"),
                width=geometry.get("WIDTH"),
                height=geometry.get("HEIGHT"),
            )
        except Exception as exc:
            return WindowBindingResult(bound=False, source="xdotool", error=str(exc))

    return WindowBindingResult(bound=False, source="xdotool", error="no supported active-window backend")


def get_active_window_info() -> WindowBindingResult:
    system = platform.system().lower()
    if system == "windows":
        return _get_active_window_windows()
    if system == "darwin":
        return _get_active_window_macos()
    if system == "linux":
        return _get_active_window_linux()
    return WindowBindingResult(bound=False, source="unknown", error=f"unsupported platform: {system}")


def bind_window_from_keywords(keywords: list[str]) -> WindowBindingResult:
    probe = get_active_window_info()
    if not probe.window_title and not probe.app_name:
        return WindowBindingResult(
            bound=False,
            window_title=probe.window_title,
            app_name=probe.app_name,
            source=probe.source,
            error=probe.error or "no active window info available",
            left=probe.left,
            top=probe.top,
            width=probe.width,
            height=probe.height,
        )

    haystack = f"{probe.window_title} {probe.app_name}".lower()
    cleaned_keywords = [str(item).strip() for item in keywords if str(item).strip()]
    if not cleaned_keywords:
        return WindowBindingResult(
            bound=bool(probe.window_title or probe.app_name),
            window_title=probe.window_title,
            app_name=probe.app_name,
            source=probe.source,
            error="" if (probe.window_title or probe.app_name) else (probe.error or "no keywords configured"),
            left=probe.left,
            top=probe.top,
            width=probe.width,
            height=probe.height,
        )

    for keyword in cleaned_keywords:
        if keyword.lower() in haystack:
            return WindowBindingResult(
                bound=True,
                window_title=probe.window_title,
                app_name=probe.app_name,
                match_keyword=keyword,
                source=probe.source,
                error="",
                left=probe.left,
                top=probe.top,
                width=probe.width,
                height=probe.height,
            )

    return WindowBindingResult(
        bound=False,
        window_title=probe.window_title,
        app_name=probe.app_name,
        source=probe.source,
        error="active window does not match keywords",
        left=probe.left,
        top=probe.top,
        width=probe.width,
        height=probe.height,
    )
