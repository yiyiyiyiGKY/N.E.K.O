from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from .events import NarrationEvent
from .view_model import CompanionViewModel


def write_debug_artifacts(
    frame_path: Path,
    event: NarrationEvent,
    view_model: CompanionViewModel,
    debug_payload: dict[str, Any],
) -> dict[str, str]:
    base_path = frame_path.with_suffix("")
    narration_path = base_path.with_name(base_path.name + "-narration.json")
    narration_path.write_text(
        json.dumps(
            {
                "frame_path": str(frame_path),
                "narration_event": event.to_dict(),
                "companion_view_model": view_model.to_dict(),
                "debug": debug_payload,
            },
            ensure_ascii=False,
            indent=2,
        ),
        encoding="utf-8",
    )
    return {"narration_path": str(narration_path)}
