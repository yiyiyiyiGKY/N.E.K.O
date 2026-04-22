const pluginId = "mahjong_companion";
let autoRefreshTimer = null;

async function callEntry(entryId, args = {}) {
  const response = await fetch("/plugin/trigger", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      plugin_id: pluginId,
      entry_id: entryId,
      args,
    }),
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data?.detail || data?.error || `HTTP ${response.status}`);
  }
  return data;
}

function renderJson(elementId, payload) {
  const el = document.getElementById(elementId);
  if (!el) return;
  el.textContent = JSON.stringify(payload, null, 2);
}

function unwrapPayload(payload) {
  if (payload && typeof payload === "object" && payload.data && typeof payload.data === "object") {
    return payload.data;
  }
  return payload;
}

function renderSummary(payload) {
  const data = unwrapPayload(payload) || {};
  document.getElementById("host-status").textContent = String(data.status || "-");
  document.getElementById("runtime-status").textContent = String(data.runtime_status || "-");
  document.getElementById("current-mode").textContent = String(data.mode || "-");
  document.getElementById("runtime-mode").textContent = String(data.runtime_mode || "-");
  document.getElementById("game-runtime-status").textContent = String(data.game_runtime_status || "-");
  document.getElementById("runtime-inbound-pending").textContent = String(data.runtime_inbound_pending ?? "-");
  document.getElementById("runtime-outbound-pending").textContent = String(data.runtime_outbound_pending ?? "-");
  document.getElementById("runtime-deduped-outbound").textContent = String(data.runtime_deduped_outbound ?? "-");
  document.getElementById("runtime-interrupt-seq").textContent = String(data.runtime_interrupt_seq ?? "-");
  document.getElementById("runtime-last-action").textContent = String(data.last_runtime_command_action || "-");
  document.getElementById("runtime-last-interrupt-reason").textContent = String(data.last_runtime_interrupt_reason || "-");
  const modeSelect = document.getElementById("mode-select");
  if (modeSelect && typeof data.mode === "string" && data.mode) {
    modeSelect.value = data.mode;
  }
  const runtimeModeSelect = document.getElementById("runtime-mode-select");
  if (runtimeModeSelect && typeof data.runtime_mode === "string" && data.runtime_mode) {
    runtimeModeSelect.value = data.runtime_mode;
  }
  document.getElementById("window-bound").textContent = String(data.window_bound ?? "-");
  document.getElementById("window-title").textContent = String(data.window_title || "-");
  document.getElementById("capture-ok").textContent = String(data.last_capture_ok ?? "-");
  document.getElementById("capture-source").textContent = String(data.last_capture_source || "-");
  document.getElementById("frame-path").textContent = String(data.last_frame_path || "-");
  document.getElementById("scene").textContent = String(data.last_scene || data.scene || "-");
  document.getElementById("scene-confidence").textContent = String(data.last_scene_confidence ?? "-");
  document.getElementById("user-turn").textContent = String(data.last_is_user_turn ?? "-");
  document.getElementById("buttons").textContent = Array.isArray(data.last_buttons) && data.last_buttons.length
    ? data.last_buttons.join(", ")
    : "-";
  document.getElementById("perception-ok").textContent = String(data.last_perception_ok ?? "-");
  document.getElementById("perception-at").textContent = String(data.last_perception_at || "-");
  document.getElementById("decision-type").textContent = String(data.last_decision_type || "-");
  document.getElementById("decision-risk").textContent = String(data.last_decision_risk_level || "-");
  document.getElementById("decision-focus").textContent = String(data.last_decision?.recommended_focus || "-");
  document.getElementById("decision-review-tags").textContent = Array.isArray(data.last_decision?.review_tags) && data.last_decision.review_tags.length
    ? data.last_decision.review_tags.join(", ")
    : "-";
  document.getElementById("decision-at").textContent = String(data.last_decision_at || "-");
  document.getElementById("tile-analysis-available").textContent = String(data.last_tile_analysis_available ?? "-");
  document.getElementById("shanten-estimate").textContent = String(data.last_shanten_estimate ?? "-");
  document.getElementById("ukeire-estimate").textContent = String(data.last_ukeire_estimate ?? "-");
  document.getElementById("narration-type").textContent = String(data.last_narration_type || "-");
  document.getElementById("narration-channel").textContent = String(data.last_narration_channel || "-");
  document.getElementById("narration-delivery").textContent = String(data.last_narration_delivery || "-");
  document.getElementById("companion-mood").textContent = String(data.last_companion_mood || "-");
  document.getElementById("suggestion-level").textContent = String(data.last_companion_view?.suggestion_level || "-");
  document.getElementById("decision-suggestion").textContent = String(data.last_decision?.suggestion || "-");
  document.getElementById("memory-bridge-status").textContent = String(data.last_memory_bridge_status || "-");
  document.getElementById("host-memory-sync-status").textContent = String(data.last_host_memory_sync_status || "-");
  document.getElementById("host-memory-sync-note").textContent = String(data.last_host_memory_sync_note || "-");
  document.getElementById("host-memory-sync-pending").textContent = String(data.last_host_memory_sync_pending ?? "-");
  document.getElementById("review-summary-at").textContent = String(data.last_review_summary_at || "-");
  document.getElementById("review-summary-text").textContent = String(data.last_review_summary_text || "-");
  document.getElementById("review-highlights").textContent = Array.isArray(data.last_review_summary?.highlights) && data.last_review_summary.highlights.length
    ? data.last_review_summary.highlights.join(" / ")
    : "-";
  document.getElementById("review-risk-points").textContent = Array.isArray(data.last_review_summary?.risk_points) && data.last_review_summary.risk_points.length
    ? data.last_review_summary.risk_points.join(" / ")
    : "-";
  document.getElementById("review-coach-note").textContent = String(data.last_review_summary?.coach_note || "-");
  document.getElementById("coaching-trend-at").textContent = String(data.last_coaching_trend_at || "-");
  document.getElementById("coaching-summary-text").textContent = String(data.last_coaching_summary_text || "-");
  document.getElementById("coaching-focus").textContent = String(data.last_coaching_focus || "-");
  document.getElementById("coaching-topics").textContent = Array.isArray(data.last_coaching_topics) && data.last_coaching_topics.length
    ? data.last_coaching_topics.map((item) => item?.title || item?.topic_id || "-").join(" / ")
    : "-";
  document.getElementById("narration-text").textContent = String(data.last_narration_text || "-");
  document.getElementById("voice-mode").textContent = String(data.voice_mode || "-");
  document.getElementById("notification-at").textContent = String(data.last_notification_at || "-");
  document.getElementById("spoken-at").textContent = String(data.last_spoken_at || "-");
  document.getElementById("last-error").textContent = String(data.last_error || "-");
  document.getElementById("action-mode").textContent = String(data.action_mode || "off");
  document.getElementById("last-action-id").textContent = String(data.last_action_id || "-");
  document.getElementById("last-action-ok").textContent = String(data.last_action_ok ?? "-");
  document.getElementById("last-action-blocked").textContent = String(data.last_action_blocked_reason || "-");
  document.getElementById("last-action-guard-aborted").textContent = String(data.last_action_guard_aborted ?? "-");
}

async function refreshStatus(options = {}) {
  const preserveOutput = Boolean(options.preserveOutput);
  const data = await callEntry("get_session_status");
  renderSummary(data);
  renderJson("status", data);
  if (!preserveOutput) {
    renderJson("output", data);
  }
}

function syncAutoRefresh(enabled) {
  if (autoRefreshTimer) {
    clearInterval(autoRefreshTimer);
    autoRefreshTimer = null;
  }

  if (!enabled) return;

  autoRefreshTimer = setInterval(() => {
    refreshStatus().catch((error) => renderJson("output", { error: String(error) }));
  }, 3000);
}

async function runAction(entryId) {
  try {
    const data = await callEntry(entryId);
    renderJson("output", data);
    await refreshStatus({ preserveOutput: true });
  } catch (error) {
    renderJson("output", { error: String(error) });
  }
}

document.getElementById("refresh-btn")?.addEventListener("click", () => {
  refreshStatus().catch((error) => renderJson("output", { error: String(error) }));
});

document.getElementById("start-btn")?.addEventListener("click", () => {
  runAction("start_session");
});

document.getElementById("stop-btn")?.addEventListener("click", () => {
  runAction("stop_session");
});

document.getElementById("set-mode-btn")?.addEventListener("click", async () => {
  const mode = document.getElementById("mode-select")?.value || "teaching";
  try {
    const data = await callEntry("set_mode", { mode });
    renderJson("output", data);
    await refreshStatus({ preserveOutput: true });
  } catch (error) {
    renderJson("output", { error: String(error) });
  }
});

document.getElementById("set-runtime-mode-btn")?.addEventListener("click", async () => {
  const mode = document.getElementById("runtime-mode-select")?.value || "active";
  try {
    const data = await callEntry("set_runtime_mode", { mode });
    renderJson("output", data);
    await refreshStatus({ preserveOutput: true });
  } catch (error) {
    renderJson("output", { error: String(error) });
  }
});

document.getElementById("bind-btn")?.addEventListener("click", () => {
  runAction("bind_window");
});

document.getElementById("unbind-btn")?.addEventListener("click", () => {
  runAction("unbind_window");
});

document.getElementById("capture-btn")?.addEventListener("click", () => {
  runAction("capture_debug_frame");
});

document.getElementById("analyze-btn")?.addEventListener("click", () => {
  runAction("analyze_debug_frame");
});

document.getElementById("decision-btn")?.addEventListener("click", () => {
  runAction("generate_decision");
});

document.getElementById("narration-btn")?.addEventListener("click", () => {
  runAction("generate_narration");
});

document.getElementById("review-summary-btn")?.addEventListener("click", () => {
  runAction("generate_review_summary");
});

document.getElementById("sync-memory-btn")?.addEventListener("click", () => {
  runAction("sync_memory_bridge");
});

document.getElementById("coaching-trend-btn")?.addEventListener("click", () => {
  runAction("get_coaching_trend");
});

document.getElementById("coaching-topics-btn")?.addEventListener("click", () => {
  runAction("get_last_coaching_topics");
});

document.getElementById("pipeline-btn")?.addEventListener("click", async () => {
  try {
    const data = await callEntry("run_companion_pipeline", {
      capture: true,
      dispatch: true,
      force_reply: true,
    });
    renderJson("output", data);
    await refreshStatus({ preserveOutput: true });
  } catch (error) {
    renderJson("output", { error: String(error) });
  }
});

document.getElementById("preview-btn")?.addEventListener("click", () => {
  runAction("preview_companion_view");
});

document.getElementById("speak-btn")?.addEventListener("click", () => {
  runAction("speak_last_narration");
});

document.getElementById("voice-mode-btn")?.addEventListener("click", () => {
  runAction("cycle_voice_mode");
});

document.getElementById("send-runtime-message-btn")?.addEventListener("click", async () => {
  const action = document.getElementById("runtime-action-select")?.value || "refresh_status";
  const interrupt = document.getElementById("runtime-interrupt-check")?.checked ?? true;
  const rawPayload = String(document.getElementById("runtime-payload-input")?.value || "").trim();
  let payload = {};
  if (rawPayload) {
    try {
      payload = JSON.parse(rawPayload);
      if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
        throw new Error("payload 必须是 JSON 对象");
      }
    } catch (error) {
      renderJson("output", { error: `payload 解析失败: ${String(error)}` });
      return;
    }
  }
  try {
    const data = await callEntry("send_runtime_message", {
      action,
      payload,
      interrupt,
      source: "ui_debug",
    });
    renderJson("output", data);
    await refreshStatus({ preserveOutput: true });
  } catch (error) {
    renderJson("output", { error: String(error) });
  }
});

document.getElementById("get-runtime-mailbox-btn")?.addEventListener("click", () => {
  runAction("get_runtime_mailbox");
});

document.getElementById("list-actions-btn")?.addEventListener("click", () => {
  runAction("list_assist_actions");
});

document.getElementById("execute-action-btn")?.addEventListener("click", async () => {
  const actionId = document.getElementById("action-select")?.value || "replay_next";
  const dryRun = document.getElementById("dry-run-check")?.checked ?? true;
  const userConfirmed = document.getElementById("user-confirmed-check")?.checked ?? false;
  try {
    const data = await callEntry("execute_assist_action", {
      action_id: actionId,
      dry_run: dryRun,
      user_confirmed: userConfirmed,
    });
    renderJson("output", data);
    await refreshStatus({ preserveOutput: true });
  } catch (error) {
    renderJson("output", { error: String(error) });
  }
});

document.getElementById("get-action-log-btn")?.addEventListener("click", () => {
  runAction("get_action_log");
});

document.getElementById("clear-action-log-btn")?.addEventListener("click", () => {
  runAction("clear_action_log");
});

document.getElementById("auto-refresh-toggle")?.addEventListener("change", (event) => {
  syncAutoRefresh(Boolean(event.target?.checked));
});

refreshStatus().catch((error) => renderJson("output", { error: String(error) }));
