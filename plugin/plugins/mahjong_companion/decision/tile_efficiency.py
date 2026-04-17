from __future__ import annotations

from collections import Counter
from typing import Any

from ..contracts import MahjongAnalysis, PerceivedGameState
from .mahjong_analysis import attach_confidence_metadata
from .risk_estimator import estimate_defense_alerts


def build_mahjong_analysis(
    state: PerceivedGameState,
    *,
    recommended_focus: str = "",
    review_tags: list[str] | None = None,
) -> MahjongAnalysis:
    hints = state.analysis_hints if isinstance(state.analysis_hints, dict) else {}
    if _has_structured_tile_input(state, hints):
        analysis = _build_structured_analysis(
            state,
            hints=hints,
            recommended_focus=recommended_focus,
            review_tags=review_tags or [],
        )
        return attach_confidence_metadata(analysis, state=state, hints=hints)
    analysis = _build_fallback_analysis(
        state,
        recommended_focus=recommended_focus,
        review_tags=review_tags or [],
    )
    return attach_confidence_metadata(analysis, state=state, hints=hints)


def _has_structured_tile_input(state: PerceivedGameState, hints: dict[str, Any]) -> bool:
    if state.hand_tiles:
        return True
    if hints.get("tile_level_available"):
        return True
    if isinstance(hints.get("candidate_discards"), list) and hints.get("candidate_discards"):
        return True
    if hints.get("shanten_estimate") is not None:
        return True
    return False


def _build_structured_analysis(
    state: PerceivedGameState,
    *,
    hints: dict[str, Any],
    recommended_focus: str,
    review_tags: list[str],
) -> MahjongAnalysis:
    analysis_version = str(hints.get("analysis_version", "mahjong-lite-v2")).strip() or "mahjong-lite-v2"
    candidate_discards = _normalize_candidate_discards(hints.get("candidate_discards"))
    if not candidate_discards and state.hand_tiles:
        candidate_discards = _estimate_candidate_discards(
            state.hand_tiles,
            dora_indicators=state.dora_indicators,
        )

    shanten_estimate = _coerce_int(hints.get("shanten_estimate"))
    if shanten_estimate is None and state.hand_tiles:
        shanten_estimate = _estimate_shanten(state.hand_tiles)

    ukeire_estimate = _coerce_int(hints.get("ukeire_estimate"))
    if ukeire_estimate is None:
        ukeire_estimate = _estimate_ukeire(candidate_discards)

    bias = str(hints.get("attack_defense_bias", "")).strip()
    if not bias:
        bias = _derive_attack_defense_bias(
            state=state,
            shanten_estimate=shanten_estimate,
            candidate_discards=candidate_discards,
        )

    teaching_points = _build_teaching_points(
        state=state,
        recommended_focus=recommended_focus,
        review_tags=review_tags,
        bias=bias,
        candidate_discards=candidate_discards,
        shanten_estimate=shanten_estimate,
        hints=hints,
    )
    defense_alerts = estimate_defense_alerts(
        state,
        candidate_discards=candidate_discards,
        shanten_estimate=shanten_estimate,
        attack_defense_bias=bias,
        hints=hints,
    )

    hand_shape_confidence = _coerce_float(hints.get("hand_shape_confidence"))
    if hand_shape_confidence is None:
        hand_shape_confidence = 0.72 if len(state.hand_tiles) >= 13 else 0.58

    return MahjongAnalysis(
        analysis_version=analysis_version,
        tile_level_available=True,
        tile_level_state="tile_level_reliable",
        analysis_confidence=float(hints.get("analysis_confidence", 0.72) or 0.72),
        hand_shape_confidence=hand_shape_confidence,
        shanten_estimate=shanten_estimate,
        ukeire_estimate=ukeire_estimate,
        candidate_discards=candidate_discards,
        attack_defense_bias=bias,
        defense_alerts=defense_alerts,
        teaching_points=teaching_points,
    )


def _build_fallback_analysis(
    state: PerceivedGameState,
    *,
    recommended_focus: str,
    review_tags: list[str],
) -> MahjongAnalysis:
    tags = set(review_tags)

    teaching_points: list[str] = []
    attack_defense_bias = "neutral"

    if recommended_focus == "win_confirmation":
        teaching_points.append("这一刻先确认和牌语义，别让高价值窗口从眼前滑过去。")
        attack_defense_bias = "attack"
    elif recommended_focus == "riichi_decision":
        teaching_points.append("立直窗口更像路线选择点，先确认现在是继续进攻还是先收一手。")
        attack_defense_bias = "slightly_attack"
    elif recommended_focus in {"kan_decision", "call_decision"}:
        teaching_points.append("副露或开杠会改变路线，这时更适合先看节奏而不是立刻点下去。")
        attack_defense_bias = "slightly_defensive"
    elif recommended_focus in {"dialog_confirmation", "confirm_or_skip"}:
        teaching_points.append("先看清按钮语义，再决定是否继续，不要把确认窗口当作普通过渡帧。")
    elif recommended_focus == "turn_observe":
        teaching_points.append("这巡更适合先观察摸牌、牌河和副露信息，再决定后续方向。")
    elif recommended_focus == "replay_observe":
        teaching_points.append("回放里先盯关键节点，后面更适合再组织成一段复盘摘要。")
    else:
        teaching_points.append("当前先按规则焦点做提醒，牌级建议尚未启用。")

    if "low_confidence" in tags or state.confidence < 0.45:
        teaching_points.append("当前识别置信度偏低，这类建议更适合结合截图二次确认。")
    defense_alerts = estimate_defense_alerts(
        state,
        candidate_discards=[],
        shanten_estimate=None,
        attack_defense_bias=attack_defense_bias,
        hints={},
    )

    return MahjongAnalysis(
        analysis_version="mahjong-lite-v1",
        tile_level_available=False,
        tile_level_state="tile_level_unavailable",
        analysis_confidence=0.0,
        hand_shape_confidence=0.0,
        shanten_estimate=None,
        ukeire_estimate=None,
        candidate_discards=[],
        attack_defense_bias=attack_defense_bias,
        defense_alerts=defense_alerts,
        teaching_points=teaching_points,
    )


def _normalize_candidate_discards(value: Any) -> list[dict[str, Any]]:
    if not isinstance(value, list):
        return []
    normalized: list[dict[str, Any]] = []
    for item in value:
        if not isinstance(item, dict):
            continue
        tile = str(item.get("tile", "")).strip()
        if not tile:
            continue
        normalized.append(
            {
                "tile": tile,
                "score": round(_coerce_float(item.get("score")) or 0.0, 3),
                "ukeire_estimate": _coerce_int(item.get("ukeire_estimate")),
                "safety_hint": str(item.get("safety_hint", "unknown")).strip() or "unknown",
                "reason": str(item.get("reason", "")).strip(),
            }
        )
    return normalized[:5]


def _estimate_candidate_discards(
    hand_tiles: list[str],
    *,
    dora_indicators: list[str],
) -> list[dict[str, Any]]:
    counts = Counter(tile for tile in hand_tiles if _normalize_tile(tile))
    if not counts:
        return []

    dora_tiles = _derive_dora_tiles(dora_indicators)
    candidates: list[dict[str, Any]] = []
    for tile in counts:
        score = _raw_discard_score(tile, counts, dora_tiles)
        candidates.append(
            {
                "tile": tile,
                "raw_score": score,
                "ukeire_estimate": _raw_ukeire_score(tile, counts),
                "safety_hint": _safety_hint(tile, counts),
                "reason": _reason_for_tile(tile, counts, dora_tiles),
            }
        )

    candidates.sort(key=lambda item: (item["raw_score"], item["ukeire_estimate"] or 0), reverse=True)
    if not candidates:
        return []

    highest = max(item["raw_score"] for item in candidates)
    lowest = min(item["raw_score"] for item in candidates)
    span = max(0.001, highest - lowest)
    normalized: list[dict[str, Any]] = []
    for item in candidates[:3]:
        normalized.append(
            {
                "tile": item["tile"],
                "score": round((item["raw_score"] - lowest) / span, 3),
                "ukeire_estimate": item["ukeire_estimate"],
                "safety_hint": item["safety_hint"],
                "reason": item["reason"],
            }
        )
    return normalized


def _estimate_shanten(hand_tiles: list[str]) -> int | None:
    normalized = [_normalize_tile(tile) for tile in hand_tiles]
    normalized = [tile for tile in normalized if tile]
    if len(normalized) < 5:
        return None

    counts = Counter(normalized)
    triples = sum(1 for count in counts.values() if count >= 3)
    pairs = sum(1 for count in counts.values() if count >= 2)
    taatsu = _estimate_taatsu(counts)
    completed = min(4, triples)
    support = min(4 - completed, taatsu)
    pair_bonus = 1 if pairs else 0
    pseudo = 8 - completed * 2 - support - pair_bonus
    return max(0, min(6, pseudo))


def _estimate_taatsu(counts: Counter[str]) -> int:
    taatsu = 0
    by_suit: dict[str, list[int]] = {"m": [], "p": [], "s": []}
    for tile in counts:
        parsed = _parse_suited_tile(tile)
        if parsed is None:
            continue
        number, suit = parsed
        by_suit[suit].extend([number] * counts[tile])
    for numbers in by_suit.values():
        unique = sorted(set(numbers))
        for index, number in enumerate(unique[:-1]):
            next_number = unique[index + 1]
            if next_number - number in {1, 2}:
                taatsu += 1
    return min(4, taatsu)


def _estimate_ukeire(candidate_discards: list[dict[str, Any]]) -> int | None:
    if not candidate_discards:
        return None
    top = candidate_discards[0].get("ukeire_estimate")
    value = _coerce_int(top)
    if value is not None:
        return value
    return max(4, len(candidate_discards) * 4)


def _derive_attack_defense_bias(
    *,
    state: PerceivedGameState,
    shanten_estimate: int | None,
    candidate_discards: list[dict[str, Any]],
) -> str:
    if state.riichi_players:
        return "slightly_defensive"
    if shanten_estimate is not None and shanten_estimate <= 1:
        return "slightly_attack"
    if candidate_discards and any(item.get("safety_hint") == "high" for item in candidate_discards):
        return "slightly_defensive"
    return "neutral"


def _build_teaching_points(
    *,
    state: PerceivedGameState,
    recommended_focus: str,
    review_tags: list[str],
    bias: str,
    candidate_discards: list[dict[str, Any]],
    shanten_estimate: int | None,
    hints: dict[str, Any],
) -> list[str]:
    teaching_points: list[str] = []
    top = candidate_discards[0] if candidate_discards else None

    if top is not None:
        teaching_points.append("这巡已经拿到结构化手牌信息，可以开始给出轻量牌效率建议。")
        tile = str(top.get("tile", "")).strip()
        reason = str(top.get("reason", "")).strip()
        if tile and reason:
            teaching_points.append(f"当前更自然的处理方向是先考虑 {tile}，因为{reason}。")
    elif recommended_focus == "turn_observe":
        teaching_points.append("虽然轮到你关注了，但当前牌理输入还不够完整，先别把轻量建议当成精算答案。")

    if shanten_estimate is not None:
        if shanten_estimate <= 1:
            teaching_points.append("当前已经接近成型，优先别打散已经连起来的块。")
        elif shanten_estimate >= 3:
            teaching_points.append("当前离成型还比较远，更适合先处理改善较弱的孤张或边张。")

    if bias == "slightly_defensive":
        teaching_points.append("这手更适合稍微稳一点，先保留更容易回旋的形。")
    elif bias == "slightly_attack":
        teaching_points.append("这手已经有继续推进的空间，可以优先保留更能改善进张的部分。")

    if state.riichi_players:
        teaching_points.append("场上已经有人立直，轻量牌理建议也要带一点防守意识。")

    extra_points = hints.get("teaching_points")
    if isinstance(extra_points, list):
        for item in extra_points:
            text = str(item).strip()
            if text:
                teaching_points.append(text)

    if "low_confidence" in set(review_tags) or state.confidence < 0.45:
        teaching_points.append("当前识别置信度仍偏低，最好把这类建议和截图一起看。")

    return _dedupe(teaching_points)[:4]


def _raw_discard_score(tile: str, counts: Counter[str], dora_tiles: set[str]) -> float:
    normalized = _normalize_tile(tile)
    if not normalized:
        return 0.0
    count = counts[normalized]
    base = 0.0
    if _is_honor(normalized):
        base += 2.2 if count == 1 else -1.2 * min(count, 3)
    else:
        number, suit = _parse_suited_tile(normalized) or (0, "")
        left = counts.get(f"{number - 1}{suit}", 0)
        right = counts.get(f"{number + 1}{suit}", 0)
        left_two = counts.get(f"{number - 2}{suit}", 0)
        right_two = counts.get(f"{number + 2}{suit}", 0)
        connectivity = left + right + 0.5 * (left_two + right_two)
        base += 1.3 if number in {1, 9} else 0.2
        base -= 0.9 * connectivity
        if left and right:
            base -= 0.8
        if count >= 2:
            base -= 1.4 * min(count, 3)
    if normalized in dora_tiles:
        base -= 1.6
    return base


def _raw_ukeire_score(tile: str, counts: Counter[str]) -> int:
    normalized = _normalize_tile(tile)
    if not normalized:
        return 0
    if _is_honor(normalized):
        return 4 if counts[normalized] >= 2 else 2
    parsed = _parse_suited_tile(normalized)
    if parsed is None:
        return 2
    number, suit = parsed
    left = counts.get(f"{number - 1}{suit}", 0)
    right = counts.get(f"{number + 1}{suit}", 0)
    left_two = counts.get(f"{number - 2}{suit}", 0)
    right_two = counts.get(f"{number + 2}{suit}", 0)
    support = left + right + left_two + right_two
    return max(4, min(20, 4 + support * 2))


def _reason_for_tile(tile: str, counts: Counter[str], dora_tiles: set[str]) -> str:
    normalized = _normalize_tile(tile)
    if not normalized:
        return "当前结构信息不足"
    if normalized in dora_tiles:
        return "它本身接近宝牌价值，轻量建议并不倾向优先打掉"
    count = counts[normalized]
    if _is_honor(normalized):
        return "字牌在当前样本里更像单张孤张，改善空间通常偏窄"
    number, suit = _parse_suited_tile(normalized) or (0, "")
    left = counts.get(f"{number - 1}{suit}", 0)
    right = counts.get(f"{number + 1}{suit}", 0)
    if count >= 2:
        return "它已经形成对子，轻量建议通常更想先保留一下"
    if not left and not right and number in {1, 9}:
        return "它更像孤张幺九，和当前主线的连接感偏弱"
    if not left and not right:
        return "它暂时比较孤立，改善路线没有那么多"
    return "它虽然还能连，但在当前样本里改善优先级不算最高"


def _safety_hint(tile: str, counts: Counter[str]) -> str:
    normalized = _normalize_tile(tile)
    if not normalized:
        return "unknown"
    if _is_honor(normalized):
        return "high" if counts[normalized] == 1 else "medium"
    number, suit = _parse_suited_tile(normalized) or (0, "")
    support = counts.get(f"{number - 1}{suit}", 0) + counts.get(f"{number + 1}{suit}", 0)
    if number in {1, 9} and support == 0:
        return "high"
    if support <= 1:
        return "medium"
    return "low"


def _derive_dora_tiles(indicators: list[str]) -> set[str]:
    derived: set[str] = set()
    for indicator in indicators:
        normalized = _normalize_tile(indicator)
        if not normalized:
            continue
        if _is_honor(normalized):
            if normalized in {"1z", "2z", "3z", "4z"}:
                winds = ["1z", "2z", "3z", "4z"]
                derived.add(winds[(winds.index(normalized) + 1) % 4])
            elif normalized in {"5z", "6z", "7z"}:
                dragons = ["5z", "6z", "7z"]
                derived.add(dragons[(dragons.index(normalized) + 1) % 3])
            continue
        parsed = _parse_suited_tile(normalized)
        if parsed is None:
            continue
        number, suit = parsed
        derived.add(f"{1 if number == 9 else number + 1}{suit}")
    return derived


def _normalize_tile(tile: Any) -> str:
    value = str(tile).strip()
    honor_alias = {
        "E": "1z",
        "S": "2z",
        "W": "3z",
        "N": "4z",
        "P": "5z",
        "F": "6z",
        "C": "7z",
    }
    if value in honor_alias:
        return honor_alias[value]
    if len(value) == 2 and value[0].isdigit() and value[1] in {"m", "p", "s", "z"}:
        return value
    return ""


def _parse_suited_tile(tile: str) -> tuple[int, str] | None:
    normalized = _normalize_tile(tile)
    if len(normalized) != 2 or normalized[1] not in {"m", "p", "s"}:
        return None
    return int(normalized[0]), normalized[1]


def _is_honor(tile: str) -> bool:
    return _normalize_tile(tile).endswith("z")


def _coerce_int(value: Any) -> int | None:
    if value is None or value == "":
        return None
    try:
        return int(value)
    except Exception:
        return None


def _coerce_float(value: Any) -> float | None:
    if value is None or value == "":
        return None
    try:
        return float(value)
    except Exception:
        return None


def _dedupe(items: list[str]) -> list[str]:
    seen: set[str] = set()
    ordered: list[str] = []
    for item in items:
        if item in seen:
            continue
        seen.add(item)
        ordered.append(item)
    return ordered
