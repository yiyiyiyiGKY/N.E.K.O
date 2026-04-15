from __future__ import annotations

from typing import Any

from ..contracts import DecisionResult, PerceivedGameState

WIN_BUTTONS = {"ron", "tsumo"}
DECLARATION_BUTTONS = {"riichi"}
CALL_BUTTONS = {"chi", "pon", "kan"}
PASSIVE_BUTTONS = {"skip", "confirm", "cancel"}
ACTIONABLE_BUTTONS = WIN_BUTTONS | DECLARATION_BUTTONS | CALL_BUTTONS | PASSIVE_BUTTONS


def build_decision(state: PerceivedGameState) -> DecisionResult:
    buttons = list(state.buttons)
    reason_codes: list[str] = []
    review_tags: list[str] = []
    decision_type = "scene_update"
    priority = 20
    risk_level = "low"
    action_required = False
    speakable = False
    summary = "当前局面没有新的关键提醒。"
    detail = "可以继续观察画面变化，暂时不用主动提醒。"
    suggestion = "先继续观察牌桌变化。"
    recommended_focus = "observe"

    win_buttons = [button for button in buttons if button in WIN_BUTTONS]
    declaration_buttons = [button for button in buttons if button in DECLARATION_BUTTONS]
    call_buttons = [button for button in buttons if button in CALL_BUTTONS]
    passive_buttons = [button for button in buttons if button in PASSIVE_BUTTONS]

    if state.scene == "unknown" and not buttons:
        decision_type = "uncertain_state"
        summary = "当前局面还不够清晰。"
        detail = "这一帧暂时没看清楚，可以继续抓下一张图确认。"
        suggestion = "先等下一张清晰帧，再决定是否提醒。"
        recommended_focus = "need_clearer_frame"
        reason_codes.append("scene.unknown")
    elif state.scene == "replay":
        decision_type = "waiting_state"
        summary = "当前更像是回放或等待状态。"
        detail = "现在不像是需要立刻操作的局面，更适合静默陪看。"
        suggestion = "更适合把这一刻当作复盘节点，而不是即时提醒。"
        recommended_focus = "replay_observe"
        reason_codes.append("scene.replay")
        review_tags.append("replay_segment")
    elif state.scene == "dialog" and passive_buttons:
        decision_type = "action_available"
        priority = 58
        risk_level = "medium"
        action_required = True
        speakable = False
        summary = "当前弹出了确认类操作。"
        detail = "这更像是托管、继续或确认一类弹窗，建议先看清内容再点。"
        suggestion = "先确认弹窗语义，再决定是确认、取消还是等待。"
        recommended_focus = "dialog_confirmation"
        reason_codes.append("scene.dialog")
        reason_codes.extend(f"button.{button}_visible" for button in passive_buttons)
        review_tags.append("dialog_confirm")
    elif state.scene == "in_match" and win_buttons:
        decision_type = "danger_action"
        priority = 96
        risk_level = "high"
        action_required = True
        speakable = True
        summary = "当前像是出现了和牌窗口。"
        detail = "检测到 ron 或 tsumo 一类高价值按钮，这通常值得立刻确认。"
        suggestion = "先确认和牌条件与按钮语义，优先别错过这一手。"
        recommended_focus = "win_confirmation"
        reason_codes.extend(f"button.{button}_visible" for button in win_buttons)
        review_tags.extend(["win_window", "high_value_timing"])
    elif state.scene == "in_match" and declaration_buttons:
        decision_type = "danger_action"
        priority = 88
        risk_level = "high"
        action_required = True
        speakable = True
        summary = "当前出现了立直决策点。"
        detail = "检测到 riichi 按钮，这是需要明确路线和风险判断的时刻。"
        suggestion = "先看牌河和当前手型，再决定要不要立直。"
        recommended_focus = "riichi_decision"
        reason_codes.extend(f"button.{button}_visible" for button in declaration_buttons)
        review_tags.extend(["riichi_window", "decision_point"])
    elif state.scene == "in_match" and "kan" in call_buttons:
        decision_type = "danger_action"
        priority = 82
        risk_level = "high"
        action_required = True
        speakable = False
        summary = "当前出现了杠牌决策点。"
        detail = "杠会改变场上信息和后续进张，建议先确认这一手是不是值得开杠。"
        suggestion = "先确认开杠会不会打乱当前路线，再决定是否点下去。"
        recommended_focus = "kan_decision"
        reason_codes.append("button.kan_visible")
        review_tags.extend(["kan_choice", "decision_point"])
    elif state.scene == "in_match" and call_buttons:
        decision_type = "action_available"
        priority = 72
        risk_level = "medium"
        action_required = True
        speakable = bool(state.is_user_turn)
        summary = "当前出现了吃碰一类操作机会。"
        detail = "吃碰会直接改变手牌结构，这一类按钮更适合结合当前路线来判断。"
        suggestion = "先确认你现在是进攻路线还是防守路线，再决定要不要吃碰。"
        recommended_focus = "call_decision"
        reason_codes.extend(f"button.{button}_visible" for button in call_buttons)
        review_tags.extend(["call_window", "route_choice"])
    elif state.scene == "in_match" and passive_buttons:
        decision_type = "action_available"
        priority = 56
        risk_level = "medium"
        action_required = True
        speakable = bool(state.is_user_turn and ("confirm" in passive_buttons or "cancel" in passive_buttons))
        summary = "当前存在确认或略过类操作。"
        detail = "画面更像是在等待用户确认、取消或跳过，这类按钮值得看一眼但通常不必高声打断。"
        suggestion = "先看清这是不是过牌、确认还是取消，再决定是否操作。"
        recommended_focus = "confirm_or_skip"
        reason_codes.extend(f"button.{button}_visible" for button in passive_buttons)
        review_tags.append("ui_confirmation")
    elif state.scene == "in_match" and state.is_user_turn:
        decision_type = "scene_update"
        priority = 44
        risk_level = "medium"
        action_required = True
        speakable = False
        summary = "当前像是轮到用户关注的阶段。"
        detail = "虽然没有明显按钮，但画面像是进入了需要观察摸牌和牌河的时刻。"
        suggestion = "先看最新摸牌、牌河和副露，再决定下一步。"
        recommended_focus = "turn_observe"
        reason_codes.append("turn.user_likely")
        review_tags.append("turn_checkpoint")
    elif state.scene in {"menu", "lobby", "matching", "result", "dialog"}:
        decision_type = "waiting_state"
        priority = 25
        summary = "当前更像是非对局操作阶段。"
        detail = "这是菜单、大厅、对话框或结算一类状态，通常不需要高频播报。"
        suggestion = "更适合静默展示状态，不需要持续提醒。"
        recommended_focus = f"scene_{state.scene}"
        reason_codes.append(f"scene.{state.scene}")
        if state.scene == "result":
            review_tags.append("round_result")
    else:
        reason_codes.append(f"scene.{state.scene}")

    if state.is_user_turn and "turn.user_likely" not in reason_codes:
        reason_codes.append("turn.user_likely")

    if state.confidence < 0.45:
        reason_codes.append("perception.low_confidence")
        detail = f"{detail} 当前识别置信度还不高，最好再看一眼确认。"
        review_tags.append("low_confidence")
        if not win_buttons:
            speakable = False

    if not reason_codes:
        reason_codes.append("state.default")

    review_tags = _dedupe(review_tags)

    return DecisionResult(
        decision_type=decision_type,
        priority=priority,
        risk_level=risk_level,
        action_required=action_required,
        speakable=speakable,
        summary=summary,
        detail=detail,
        suggestion=suggestion,
        recommended_focus=recommended_focus,
        scene=state.scene,
        buttons=buttons,
        reason_codes=reason_codes,
        review_tags=review_tags,
        engine_meta={
            "engine": "rule_based_v2",
            "confidence": state.confidence,
            "focus_area": recommended_focus,
            "button_groups": {
                "win": win_buttons,
                "declaration": declaration_buttons,
                "call": call_buttons,
                "passive": passive_buttons,
            },
            "review_candidate": bool(review_tags and priority >= 44),
        },
    )


def decide_perception(state: PerceivedGameState) -> tuple[DecisionResult, dict[str, Any]]:
    decision = build_decision(state)
    debug_payload = {
        "source_scene": state.scene,
        "source_confidence": state.confidence,
        "source_buttons": list(state.buttons),
        "source_is_user_turn": state.is_user_turn,
        "source_notes": list(state.notes),
        "decision_reason_codes": list(decision.reason_codes),
        "decision_focus_area": decision.recommended_focus,
        "decision_review_tags": list(decision.review_tags),
    }
    return decision, debug_payload


def _dedupe(items: list[str]) -> list[str]:
    seen: set[str] = set()
    ordered: list[str] = []
    for item in items:
        if item in seen:
            continue
        seen.add(item)
        ordered.append(item)
    return ordered
