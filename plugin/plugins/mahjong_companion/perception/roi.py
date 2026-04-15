from __future__ import annotations

from dataclasses import asdict, dataclass
from typing import Any, Optional

from PIL import Image, ImageStat


@dataclass
class RoiBox:
    name: str
    left: int
    top: int
    width: int
    height: int

    @property
    def right(self) -> int:
        return self.left + self.width

    @property
    def bottom(self) -> int:
        return self.top + self.height

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


def build_default_rois(width: int, height: int) -> dict[str, RoiBox]:
    return {
        "top_banner": _relative_roi("top_banner", width, height, 0.05, 0.03, 0.90, 0.12),
        "center_dialog": _relative_roi("center_dialog", width, height, 0.25, 0.20, 0.50, 0.30),
        "bottom_action_bar": _relative_roi("bottom_action_bar", width, height, 0.18, 0.76, 0.64, 0.16),
        "bottom_hand_area": _relative_roi("bottom_hand_area", width, height, 0.12, 0.68, 0.76, 0.26),
        "right_replay_panel": _relative_roi("right_replay_panel", width, height, 0.78, 0.10, 0.18, 0.70),
    }


def collect_region_metrics(
    image: Image.Image,
    box: Optional[RoiBox],
    sample_step: int = 6,
) -> dict[str, Any]:
    region = image.crop((box.left, box.top, box.right, box.bottom)) if box is not None else image
    rgb_region = region.convert("RGB")
    grayscale_region = rgb_region.convert("L")
    stat = ImageStat.Stat(rgb_region)
    avg_r, avg_g, avg_b = [float(value) for value in stat.mean[:3]]
    stddev = sum(float(value) for value in stat.stddev[:3]) / 3.0

    width, height = rgb_region.size
    step_x = max(1, sample_step)
    step_y = max(1, sample_step)
    total = 0
    bright = 0
    dark = 0
    white = 0
    colorful = 0
    gold = 0
    orange = 0
    red = 0
    green = 0

    for y in range(0, height, step_y):
        for x in range(0, width, step_x):
            r, g, b = rgb_region.getpixel((x, y))
            total += 1
            brightness = (int(r) + int(g) + int(b)) / 3.0
            max_c = max(r, g, b)
            min_c = min(r, g, b)
            saturation = max_c - min_c

            if brightness >= 200:
                bright += 1
            if brightness <= 70:
                dark += 1
            if brightness >= 225 and saturation <= 25:
                white += 1
            if saturation >= 55:
                colorful += 1
            if r >= 170 and g >= 135 and b <= 130 and r >= b + 45:
                gold += 1
            if r >= 185 and g >= 90 and g <= 190 and b <= 125 and r >= g >= b:
                orange += 1
            if r >= 175 and g <= 110 and b <= 120:
                red += 1
            if g >= 150 and g >= r + 25 and g >= b + 25:
                green += 1

    mean_luma = float(ImageStat.Stat(grayscale_region).mean[0])
    sample_count = max(1, total)

    return {
        "box": box.to_dict() if box is not None else None,
        "size": {"width": width, "height": height},
        "avg_rgb": {"r": round(avg_r, 2), "g": round(avg_g, 2), "b": round(avg_b, 2)},
        "mean_luma": round(mean_luma, 2),
        "stddev": round(stddev, 2),
        "bright_ratio": round(bright / sample_count, 4),
        "dark_ratio": round(dark / sample_count, 4),
        "white_ratio": round(white / sample_count, 4),
        "colorful_ratio": round(colorful / sample_count, 4),
        "gold_ratio": round(gold / sample_count, 4),
        "orange_ratio": round(orange / sample_count, 4),
        "red_ratio": round(red / sample_count, 4),
        "green_ratio": round(green / sample_count, 4),
        "sample_count": sample_count,
    }


def _relative_roi(
    name: str,
    width: int,
    height: int,
    rel_left: float,
    rel_top: float,
    rel_width: float,
    rel_height: float,
) -> RoiBox:
    left = max(0, min(width - 1, int(width * rel_left)))
    top = max(0, min(height - 1, int(height * rel_top)))
    roi_width = max(1, min(width - left, int(width * rel_width)))
    roi_height = max(1, min(height - top, int(height * rel_height)))
    return RoiBox(name=name, left=left, top=top, width=roi_width, height=roi_height)
