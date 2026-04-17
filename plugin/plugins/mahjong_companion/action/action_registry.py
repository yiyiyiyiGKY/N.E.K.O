"""Assist-action registry: defines allowed actions, scene whitelists, and confirmation policies."""
from __future__ import annotations

from typing import Any

from ..contracts import AssistAction

BUILTIN_ACTIONS: list[dict[str, Any]] = [
    {
        "action_id": "replay_next",
        "category": "replay_control",
        "label": "回放下一手",
        "allowed_contexts": ["replay"],
        "requires_confirmation": False,
        "requires_running_session": False,
    },
    {
        "action_id": "replay_prev",
        "category": "replay_control",
        "label": "回放上一手",
        "allowed_contexts": ["replay"],
        "requires_confirmation": False,
        "requires_running_session": False,
    },
    {
        "action_id": "dialog_confirm",
        "category": "dialog",
        "label": "确认弹窗",
        "allowed_contexts": ["dialog", "replay", "menu"],
        "requires_confirmation": True,
        "requires_running_session": False,
    },
    {
        "action_id": "dialog_cancel",
        "category": "dialog",
        "label": "取消弹窗",
        "allowed_contexts": ["dialog", "replay", "menu"],
        "requires_confirmation": False,
        "requires_running_session": False,
    },
    {
        "action_id": "menu_back",
        "category": "menu_navigation",
        "label": "返回上一级",
        "allowed_contexts": ["menu", "lobby"],
        "requires_confirmation": False,
        "requires_running_session": False,
    },
    {
        "action_id": "menu_start_replay",
        "category": "menu_navigation",
        "label": "打开回放",
        "allowed_contexts": ["menu", "lobby"],
        "requires_confirmation": True,
        "requires_running_session": False,
    },
]


class ActionRegistry:
    def __init__(self, extra_actions: list[dict[str, Any]] | None = None) -> None:
        self._actions: dict[str, AssistAction] = {}
        for raw in BUILTIN_ACTIONS:
            action = AssistAction(
                action_id=raw["action_id"],
                category=raw["category"],
                label=raw["label"],
                allowed_contexts=list(raw.get("allowed_contexts", [])),
                requires_confirmation=bool(raw.get("requires_confirmation", True)),
                requires_running_session=bool(raw.get("requires_running_session", False)),
            )
            self._actions[action.action_id] = action
        if extra_actions:
            for raw in extra_actions:
                action = AssistAction(
                    action_id=raw["action_id"],
                    category=raw["category"],
                    label=raw["label"],
                    allowed_contexts=list(raw.get("allowed_contexts", [])),
                    requires_confirmation=bool(raw.get("requires_confirmation", True)),
                    requires_running_session=bool(raw.get("requires_running_session", False)),
                )
                self._actions[action.action_id] = action

    def list_actions(self) -> list[AssistAction]:
        return list(self._actions.values())

    def get_action(self, action_id: str) -> AssistAction | None:
        return self._actions.get(action_id)

    def validate(
        self,
        action_id: str,
        *,
        current_scene: str,
        action_mode: str,
        session_running: bool,
        user_confirmed: bool = False,
    ) -> tuple[bool, str]:
        """Validate whether an action is allowed to execute.

        Returns (allowed, reason).
        """
        if action_mode not in {"assist", "semi_auto"}:
            return False, f"action_mode is '{action_mode}', not enabled"

        action = self._actions.get(action_id)
        if action is None:
            return False, f"unknown action_id: {action_id}"

        if action.requires_running_session and not session_running:
            return False, "action requires a running session"

        if current_scene not in action.allowed_contexts:
            return False, f"scene '{current_scene}' not in allowed_contexts {action.allowed_contexts}"

        if action.requires_confirmation and not user_confirmed:
            return False, "action requires user confirmation"

        return True, "allowed"
