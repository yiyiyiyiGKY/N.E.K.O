from __future__ import annotations

from typing import Any

from ..contracts import PerceivedGameState


def estimate_defense_alerts(
    state: PerceivedGameState,
    *,
    candidate_discards: list[dict[str, Any]] | None = None,
    shanten_estimate: int | None = None,
    attack_defense_bias: str = "neutral",
    hints: dict[str, Any] | None = None,
) -> list[str]:
    hints = hints if isinstance(hints, dict) else {}
    hinted = hints.get("defense_alerts")
    if isinstance(hinted, list) and hinted:
        normalized = [str(item).strip() for item in hinted if str(item).strip()]
        if normalized:
            return _dedupe(normalized)[:3]

    candidate_discards = candidate_discards or []
    alerts: list[str] = []

    if state.riichi_players:
        alerts.append("场上已经有立直压力，这巡先确认现物与安牌会更稳。")

    high_safety_tiles = [
        str(item.get("tile", "")).strip()
        for item in candidate_discards
        if str(item.get("safety_hint", "")).strip() == "high" and str(item.get("tile", "")).strip()
    ]
    if high_safety_tiles and state.riichi_players:
        alerts.append(f"候选里已有相对安全的牌，例如 {high_safety_tiles[0]}，需要时可以先用它过渡。")

    if shanten_estimate is not None and shanten_estimate >= 2 and attack_defense_bias in {"slightly_defensive", "defensive"}:
        alerts.append("当前离成型还不算近，面对场压时先别急着强行推进。")

    if "kan" in state.buttons and state.riichi_players:
        alerts.append("场上有立直时再开杠风险会更高，先确认这手值不值得冒险。")

    if attack_defense_bias == "defensive" and not alerts:
        alerts.append("当前分析更偏防守，优先保留退路会更自然。")

    return _dedupe(alerts)[:3]


def _dedupe(items: list[str]) -> list[str]:
    seen: set[str] = set()
    ordered: list[str] = []
    for item in items:
        if item in seen:
            continue
        seen.add(item)
        ordered.append(item)
    return ordered
