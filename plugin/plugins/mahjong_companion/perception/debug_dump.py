from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from ..contracts import PerceivedGameState


def write_debug_artifacts(
    frame_path: Path,
    perceived: PerceivedGameState,
    debug_payload: dict[str, Any],
) -> dict[str, str]:
    base_path = frame_path.with_suffix("")
    perception_path = base_path.with_name(base_path.name + "-perception.json")
    overlay_path = base_path.with_name(base_path.name + "-overlay.json")

    perception_path.write_text(
        json.dumps(
            {
                "frame_path": str(frame_path),
                "perceived_state": perceived.to_dict(),
                "debug": debug_payload,
            },
            ensure_ascii=False,
            indent=2,
        ),
        encoding="utf-8",
    )
    overlay_path.write_text(
        json.dumps(
            {
                "frame_path": str(frame_path),
                "roi_boxes": debug_payload.get("roi_boxes", {}),
                "roi_hits": perceived.roi_hits,
                "notes": perceived.notes,
            },
            ensure_ascii=False,
            indent=2,
        ),
        encoding="utf-8",
    )
    return {
        "perception_path": str(perception_path),
        "overlay_path": str(overlay_path),
    }
