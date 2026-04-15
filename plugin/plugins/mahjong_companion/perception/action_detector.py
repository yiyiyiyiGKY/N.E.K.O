from __future__ import annotations

from typing import Any


def detect_actions(
    scene: str,
    metrics: dict[str, dict[str, Any]],
) -> tuple[list[str], bool, list[str]]:
    bottom = metrics["bottom_action_bar"]
    center = metrics["center_dialog"]
    hand = metrics["bottom_hand_area"]
    right = metrics["right_replay_panel"]
    buttons: list[str] = []
    notes: list[str] = []
    bottom_bar_visible = _looks_like_bottom_action_bar(bottom)
    dark_dialog = _looks_like_dark_dialog(center)
    hand_strip_visible = _looks_like_player_hand_strip(bottom, hand)

    if scene == "replay":
        notes.append("replay scene suppresses user-turn inference")
        return buttons, False, notes

    if scene not in {"menu", "lobby", "result"} and bottom_bar_visible and hand_strip_visible and _looks_like_false_skip(bottom):
        notes.append("bottom strip looks like hand tiles rather than action buttons")
    elif scene not in {"menu", "lobby", "result"} and bottom_bar_visible:
        if bottom["green_ratio"] >= 0.028:
            buttons.append("chi")
            notes.append("green accent in bottom action bar")
        if bottom["gold_ratio"] >= 0.052:
            buttons.append("riichi")
            notes.append("gold accent in bottom action bar")
        if bottom["red_ratio"] >= 0.02:
            buttons.append("ron")
            notes.append("red accent in bottom action bar")
        if bottom["orange_ratio"] >= 0.03:
            buttons.append("skip")
            notes.append("orange accent in bottom action bar")
        if (
            bottom["dark_ratio"] <= 0.52
            and bottom["colorful_ratio"] >= 0.18
            and "skip" not in buttons
        ):
            buttons.append("confirm")
            notes.append("multi-button action bar likely visible")
    elif scene in {"menu", "lobby", "result"} and bottom_bar_visible:
        notes.append("non-match scene suppresses bottom action bar inference")

    if dark_dialog:
        if "confirm" not in buttons:
            buttons.append("confirm")
        notes.append("dark center dialog likely exposes a primary confirm button")
    elif center["bright_ratio"] >= 0.34 and center["stddev"] <= 62.0:
        if "confirm" not in buttons:
            buttons.append("confirm")
        buttons.append("cancel")
        notes.append("center dialog likely exposes confirm/cancel")

    buttons = _dedupe(buttons)
    is_user_turn = False
    if scene in {"in_match", "dialog"} and buttons:
        is_user_turn = True
    elif scene == "unknown" and buttons and right["dark_ratio"] < 0.35:
        is_user_turn = True
        notes.append("button evidence suggests likely user turn despite unknown scene")
    elif not buttons:
        notes.append("insufficient action evidence")

    return buttons, is_user_turn, notes


def _looks_like_bottom_action_bar(bottom: dict[str, Any]) -> bool:
    return (
        bottom["orange_ratio"] >= 0.03
        or bottom["gold_ratio"] >= 0.04
        or bottom["red_ratio"] >= 0.015
        or (
            bottom["dark_ratio"] <= 0.58
            and bottom["colorful_ratio"] >= 0.14
            and (
                bottom["orange_ratio"] >= 0.015
                or bottom["gold_ratio"] >= 0.02
                or bottom["green_ratio"] >= 0.02
            )
        )
    )


def _looks_like_dark_dialog(center: dict[str, Any]) -> bool:
    return (
        center["dark_ratio"] >= 0.55
        and center["stddev"] <= 48.0
        and center["colorful_ratio"] >= 0.16
        and (center["gold_ratio"] >= 0.012 or center["orange_ratio"] >= 0.012)
    )


def _looks_like_player_hand_strip(
    bottom: dict[str, Any],
    hand: dict[str, Any],
) -> bool:
    return (
        hand["bright_ratio"] >= 0.12
        and hand["colorful_ratio"] >= 0.55
        and abs(bottom["dark_ratio"] - hand["dark_ratio"]) <= 0.08
        and abs(bottom["colorful_ratio"] - hand["colorful_ratio"]) <= 0.12
    )


def _looks_like_false_skip(bottom: dict[str, Any]) -> bool:
    return (
        bottom["orange_ratio"] < 0.05
        and bottom["gold_ratio"] < 0.01
        and bottom["red_ratio"] < 0.01
        and bottom["green_ratio"] < 0.01
    )


def _dedupe(items: list[str]) -> list[str]:
    seen: set[str] = set()
    ordered: list[str] = []
    for item in items:
        if item in seen:
            continue
        seen.add(item)
        ordered.append(item)
    return ordered
