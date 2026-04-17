from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from ..session_state import now_iso


def generate_review_summary(
    cache_dir: Path,
    *,
    session_id: str,
) -> tuple[dict[str, Any], Path]:
    candidates_path = cache_dir / "review_candidates.json"
    candidates = load_review_candidates(candidates_path)
    if not candidates:
        raise ValueError("no review candidates available")

    summary = build_review_summary(
        session_id=session_id,
        candidates=candidates,
    )
    summary_path = cache_dir / "review_summary.json"
    cache_dir.mkdir(parents=True, exist_ok=True)
    summary_path.write_text(json.dumps(summary, ensure_ascii=False, indent=2), encoding="utf-8")
    return summary, summary_path


def load_review_candidates(path: Path) -> list[dict[str, Any]]:
    if not path.exists():
        raise FileNotFoundError("review candidates file not found: %s" % path)
    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
    except Exception as exc:
        raise ValueError("failed to parse review candidates: %s" % exc) from exc
    if not isinstance(payload, dict):
        raise ValueError("review candidates payload is not a JSON object")
    items = payload.get("items", [])
    if not isinstance(items, list):
        raise ValueError("review candidates payload has invalid items field")
    normalized = [item for item in items if isinstance(item, dict)]
    return sorted(normalized, key=_sort_key)


def build_review_summary(
    *,
    session_id: str,
    candidates: list[dict[str, Any]],
) -> dict[str, Any]:
    if not candidates:
        raise ValueError("no review candidates available")

    highlights = _collect_highlights(candidates)
    risk_points = _collect_risk_points(candidates)
    mistake_patterns = _collect_mistake_patterns(candidates)
    coach_note = _build_coach_note(candidates)
    memory_bridge_candidates = _derive_memory_bridge_candidates(candidates)
    summary_text = " ".join(part for part in [highlights[0], coach_note] if part).strip()

    return {
        "session_id": session_id,
        "generated_at": now_iso(),
        "source_candidate_count": len(candidates),
        "highlights": highlights,
        "risk_points": risk_points,
        "mistake_patterns": mistake_patterns,
        "coach_note": coach_note,
        "memory_bridge_candidates": memory_bridge_candidates,
        "summary_text": summary_text,
    }


def _collect_highlights(candidates: list[dict[str, Any]]) -> list[str]:
    lines: list[str] = []
    for candidate in sorted(candidates, key=_highlight_priority, reverse=True):
        tags = set(_list(candidate.get("review_tags")))
        focus = str(candidate.get("recommended_focus", "")).strip()
        if "win_window" in tags:
            lines.append("你这局出现过高价值和牌确认窗口，最值得保留这种关键时刻的确认节奏。")
        elif "riichi_window" in tags:
            lines.append("这局有明确的立直决策点，说明你已经碰到了值得细想路线的时刻。")
        elif {"kan_choice", "call_window", "route_choice"} & tags:
            lines.append("这局出现过副露或开杠路线选择点，说明节奏取舍本身就是复盘重点。")
        elif "tile_efficiency" in tags:
            lines.append("这局已经出现过可读的中盘牌效率节点，说明你可以开始回看取舍是不是够稳。")
        elif focus == "dialog_confirmation":
            lines.append("这局还有确认类窗口值得回看，别让按钮语义判断拖慢关键节奏。")
        elif focus == "turn_observe":
            lines.append("有几次轮到你关注的阶段，适合回看当时为什么会犹豫。")
        else:
            summary = str(candidate.get("summary", "")).strip()
            if summary:
                lines.append(summary)
        if len(_dedupe(lines)) >= 3:
            break
    deduped = _dedupe(lines)
    return deduped[:3] if deduped else ["当前已有关键节点沉淀，但高光还不算足够集中。"]


def _collect_risk_points(candidates: list[dict[str, Any]]) -> list[str]:
    high_risk = [c for c in candidates if str(c.get("risk_level", "")).strip() == "high"]
    low_confidence = [c for c in candidates if "low_confidence" in set(_list(c.get("review_tags")))]
    route_choices = [
        c for c in candidates
        if {"kan_choice", "call_window", "route_choice"} & set(_list(c.get("review_tags")))
    ]

    lines: list[str] = []
    if high_risk:
        lines.append(f"这局一共出现了 {len(high_risk)} 次高风险决策点，关键窗口并不少。")
    if route_choices:
        lines.append(f"其中有 {len(route_choices)} 次更像路线选择题，适合回看当时是不是太急着推进。")
    tile_efficiency = [c for c in candidates if "tile_efficiency" in set(_list(c.get("review_tags")))]
    if tile_efficiency:
        lines.append(f"另有 {len(tile_efficiency)} 次已经带牌理语义的中盘选择，适合回看节奏是不是过于保守或激进。")
    if low_confidence:
        lines.append(f"还有 {len(low_confidence)} 次节点识别置信度偏低，复盘时最好结合截图二次确认。")
    return lines or ["这一局的风险点还不算密集，但关键节点确认节奏仍值得继续练。"]


def _collect_mistake_patterns(candidates: list[dict[str, Any]]) -> list[str]:
    tags = _flatten_tags(candidates)
    lines: list[str] = []
    if "low_confidence" in tags:
        lines.append("当前样本里有一部分更像信息不够清晰时的犹豫，而不是明确的牌效率失误。")
    if {"kan_choice", "call_window", "route_choice"} & tags:
        lines.append("这局更容易出现的是路线取舍问题，尤其是吃碰或开杠时机的判断。")
    if "tile_efficiency" in tags:
        lines.append("当前已经能沉淀轻量牌效率节点，下一步适合回看哪些弃牌方向总是拖慢节奏。")
    if "dialog_confirm" in tags:
        lines.append("确认类窗口也值得回看，避免把关键确认拖成额外犹豫。")
    if not lines:
        lines.append("当前样本更像是按钮决策节奏问题，而不是完整牌理层面的明确错误。")
    return lines[:3]


def _build_coach_note(candidates: list[dict[str, Any]]) -> str:
    tags = _flatten_tags(candidates)
    if "win_window" in tags:
        return "这局最值得继续练的是关键窗口出现时的确认速度，先把高价值时刻稳稳抓住。"
    if {"kan_choice", "call_window", "route_choice"} & tags:
        return "后面可以重点练路线取舍：先确认节奏，再决定要不要副露或开杠。"
    if "tile_efficiency" in tags:
        return "后面可以开始练轻量牌效率判断，尤其是中盘该先处理哪类孤张。"
    if "low_confidence" in tags:
        return "下一步更适合先提升截图和识别稳定度，再去追更细的牌理建议。"
    return "这局已经有可读的关键节点了，下一步适合把这些节点继续串成更完整的复盘。"


def _derive_memory_bridge_candidates(candidates: list[dict[str, Any]]) -> list[str]:
    mapped: list[str] = []
    for candidate in candidates:
        tags = set(_list(candidate.get("review_tags")))
        risk_level = str(candidate.get("risk_level", "")).strip()
        if {"win_window", "high_value_timing"} & tags:
            mapped.append("mahjong_high_value_timing")
        if "riichi_window" in tags:
            mapped.append("mahjong_riichi_preference")
        if {"kan_choice", "call_window", "route_choice"} & tags:
            mapped.append("mahjong_route_choice")
        if "tile_efficiency" in tags:
            mapped.append("mahjong_tile_efficiency")
        if risk_level == "high":
            mapped.append("mahjong_risk_focus")
        if "low_confidence" in tags:
            mapped.append("mahjong_needs_review")
    return _dedupe(mapped)


def _flatten_tags(candidates: list[dict[str, Any]]) -> set[str]:
    flattened: set[str] = set()
    for candidate in candidates:
        flattened.update(_list(candidate.get("review_tags")))
    return flattened


def _highlight_priority(candidate: dict[str, Any]) -> tuple[int, int]:
    tags = set(_list(candidate.get("review_tags")))
    priority = int(candidate.get("priority", 0) or 0)
    bonus = 0
    if "win_window" in tags:
        bonus += 30
    if "riichi_window" in tags:
        bonus += 20
    if {"kan_choice", "call_window", "route_choice"} & tags:
        bonus += 10
    return priority + bonus, priority


def _sort_key(candidate: dict[str, Any]) -> tuple[str, int]:
    return str(candidate.get("captured_at", "")), int(candidate.get("priority", 0) or 0)


def _list(value: Any) -> list[str]:
    if not isinstance(value, list):
        return []
    return [str(item) for item in value if str(item).strip()]


def _dedupe(items: list[str]) -> list[str]:
    seen: set[str] = set()
    ordered: list[str] = []
    for item in items:
        if item in seen:
            continue
        seen.add(item)
        ordered.append(item)
    return ordered
