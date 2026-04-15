from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
import platform
import shutil
import subprocess
from typing import Any, Optional, Protocol, Tuple

from ..contracts import FramePacket
from ..window_binding import WindowBindingResult, bind_window_from_keywords

try:
    import pyautogui
except Exception:
    pyautogui = None

try:
    from PIL import ImageGrab  # type: ignore[import-not-found]
except Exception:
    ImageGrab = None


@dataclass
class CaptureContext:
    file_path: Path
    binding_result: WindowBindingResult


class CaptureProvider(Protocol):
    def locate_window(self, keywords: list[str]) -> WindowBindingResult:
        ...

    def capture_frame(self, *, samples_dir: Path, binding_result: WindowBindingResult, save_format: str) -> FramePacket:
        ...


class DefaultCaptureProvider:
    def locate_window(self, keywords: list[str]) -> WindowBindingResult:
        return bind_window_from_keywords(keywords)

    def capture_frame(self, *, samples_dir: Path, binding_result: WindowBindingResult, save_format: str) -> FramePacket:
        samples_dir.mkdir(parents=True, exist_ok=True)
        timestamp = datetime.now(timezone.utc)
        safe_format = save_format if save_format in {"png", "jpg", "jpeg"} else "png"
        file_path = samples_dir / f"{timestamp.strftime('%Y%m%d-%H%M%S-%f')}-frame.{safe_format}"
        source = self._save_screenshot(CaptureContext(file_path=file_path, binding_result=binding_result))
        return FramePacket(
            timestamp_ms=int(timestamp.timestamp() * 1000),
            image_path=str(file_path),
            window_title=binding_result.window_title or binding_result.app_name,
            width=int(binding_result.width or 0),
            height=int(binding_result.height or 0),
            source=source,
        )

    def _save_screenshot(self, context: CaptureContext) -> str:
        region = self._resolve_capture_region(context.binding_result)
        errors: list[str] = []

        if pyautogui is not None:
            try:
                return self._save_with_pyautogui(context.file_path, region)
            except Exception as exc:
                errors.append(f"pyautogui: {exc}")

        if ImageGrab is not None:
            try:
                return self._save_with_imagegrab(context.file_path, region)
            except Exception as exc:
                errors.append(f"imagegrab: {exc}")

        system = platform.system().lower()
        if system == "darwin" and shutil.which("screencapture"):
            try:
                return self._save_with_screencapture(context.file_path, region)
            except Exception as exc:
                errors.append(f"screencapture: {exc}")

        if system == "linux":
            try:
                return self._save_with_linux_tools(context.file_path, region)
            except Exception as exc:
                errors.append(f"linux-tools: {exc}")

        if errors:
            raise RuntimeError("no screenshot backend succeeded: %s" % "; ".join(errors))
        raise RuntimeError("no screenshot backend available")

    def _resolve_capture_region(
        self,
        binding_result: WindowBindingResult,
    ) -> Optional[Tuple[int, int, int, int]]:
        if not binding_result.bound or not binding_result.has_bounds():
            return None
        assert binding_result.left is not None
        assert binding_result.top is not None
        assert binding_result.width is not None
        assert binding_result.height is not None
        return (
            int(binding_result.left),
            int(binding_result.top),
            int(binding_result.width),
            int(binding_result.height),
        )

    def _save_with_pyautogui(
        self,
        file_path: Path,
        region: Optional[Tuple[int, int, int, int]],
    ) -> str:
        source = "pyautogui"
        if region is not None:
            try:
                image = pyautogui.screenshot(region=region)
                source = "pyautogui-region"
            except Exception:
                image = pyautogui.screenshot()
                source = "pyautogui-fullscreen-fallback"
        else:
            image = pyautogui.screenshot()
        self._persist_image(image, file_path)
        return source

    def _save_with_imagegrab(
        self,
        file_path: Path,
        region: Optional[Tuple[int, int, int, int]],
    ) -> str:
        source = "imagegrab"
        if region is not None:
            left, top, width, height = region
            try:
                image = ImageGrab.grab(bbox=(left, top, left + width, top + height))
                source = "imagegrab-region"
            except Exception:
                image = ImageGrab.grab()
                source = "imagegrab-fullscreen-fallback"
        else:
            image = ImageGrab.grab()
        self._persist_image(image, file_path)
        return source

    def _save_with_screencapture(
        self,
        file_path: Path,
        region: Optional[Tuple[int, int, int, int]],
    ) -> str:
        command = ["screencapture", "-x"]
        source = "screencapture"
        if region is not None:
            left, top, width, height = region
            try:
                subprocess.run(
                    command + ["-R", f"{left},{top},{width},{height}", str(file_path)],
                    check=True,
                    stdout=subprocess.DEVNULL,
                    stderr=subprocess.DEVNULL,
                )
                return "screencapture-region"
            except Exception:
                source = "screencapture-fullscreen-fallback"

        subprocess.run(
            command + [str(file_path)],
            check=True,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )
        return source

    def _save_with_linux_tools(
        self,
        file_path: Path,
        region: Optional[Tuple[int, int, int, int]],
    ) -> str:
        if shutil.which("grim"):
            if region is not None:
                left, top, width, height = region
                try:
                    subprocess.run(
                        ["grim", "-g", f"{left},{top} {width}x{height}", str(file_path)],
                        check=True,
                        stdout=subprocess.DEVNULL,
                        stderr=subprocess.DEVNULL,
                    )
                    return "grim-region"
                except Exception:
                    pass
            subprocess.run(
                ["grim", str(file_path)],
                check=True,
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL,
            )
            return "grim-fullscreen-fallback" if region is not None else "grim"

        if shutil.which("gnome-screenshot"):
            subprocess.run(
                ["gnome-screenshot", "-f", str(file_path)],
                check=True,
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL,
            )
            return "gnome-screenshot"

        raise RuntimeError("no supported linux screenshot tool found")

    def _persist_image(self, image: Any, file_path: Path) -> None:
        if file_path.suffix.lower() in {".jpg", ".jpeg"} and getattr(image, "mode", "") not in {"RGB", "L"}:
            image = image.convert("RGB")
        image.save(file_path)
