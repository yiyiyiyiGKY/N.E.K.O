from __future__ import annotations

from pathlib import Path
from typing import Any

from PIL import Image

from ..contracts import PerceivedGameState
from .action_detector import detect_actions
from .roi import build_default_rois, collect_region_metrics
from .scene_classifier import classify_scene


def analyze_image_path(image_path: Path) -> tuple[PerceivedGameState, dict[str, Any]]:
    if not image_path.exists():
        raise FileNotFoundError("image not found: %s" % image_path)

    with Image.open(image_path) as opened:
        image = opened.convert("RGB")
        width, height = image.size
        rois = build_default_rois(width, height)
        metrics: dict[str, dict[str, Any]] = {
            "full_frame": collect_region_metrics(image, None),
        }
        for name, roi in rois.items():
            metrics[name] = collect_region_metrics(image, roi)

    scene, confidence, scene_notes, roi_hits = classify_scene(metrics)
    buttons, is_user_turn, action_notes = detect_actions(scene, metrics)
    notes = scene_notes + action_notes

    perceived = PerceivedGameState(
        scene=scene,
        confidence=confidence,
        is_user_turn=is_user_turn,
        buttons=buttons,
        notes=notes,
        roi_hits=roi_hits,
    )
    debug_payload = {
        "image_path": str(image_path),
        "image_size": {"width": width, "height": height},
        "roi_boxes": {name: roi.to_dict() for name, roi in rois.items()},
        "roi_metrics": metrics,
    }
    return perceived, debug_payload
