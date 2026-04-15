from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from ..contracts import DecisionResult


def write_debug_artifacts(
    frame_path: Path,
    decision: DecisionResult,
    debug_payload: dict[str, Any],
) -> dict[str, str]:
    base_path = frame_path.with_suffix("")
    decision_path = base_path.with_name(base_path.name + "-decision.json")
    decision_path.write_text(
        json.dumps(
            {
                "frame_path": str(frame_path),
                "decision_result": decision.to_dict(),
                "debug": debug_payload,
            },
            ensure_ascii=False,
            indent=2,
        ),
        encoding="utf-8",
    )
    return {"decision_path": str(decision_path)}
