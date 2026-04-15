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
  const modeSelect = document.getElementById("mode-select");
  if (modeSelect && typeof data.mode === "string" && data.mode) {
    modeSelect.value = data.mode;
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
  document.getElementById("decision-at").textContent = String(data.last_decision_at || "-");
  document.getElementById("narration-type").textContent = String(data.last_narration_type || "-");
  document.getElementById("narration-channel").textContent = String(data.last_narration_channel || "-");
  document.getElementById("narration-delivery").textContent = String(data.last_narration_delivery || "-");
  document.getElementById("companion-mood").textContent = String(data.last_companion_mood || "-");
  document.getElementById("suggestion-level").textContent = String(data.last_companion_view?.suggestion_level || "-");
  document.getElementById("decision-suggestion").textContent = String(data.last_decision?.suggestion || "-");
  document.getElementById("narration-text").textContent = String(data.last_narration_text || "-");
  document.getElementById("voice-mode").textContent = String(data.voice_mode || "-");
  document.getElementById("notification-at").textContent = String(data.last_notification_at || "-");
  document.getElementById("spoken-at").textContent = String(data.last_spoken_at || "-");
  document.getElementById("last-error").textContent = String(data.last_error || "-");
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

document.getElementById("auto-refresh-toggle")?.addEventListener("change", (event) => {
  syncAutoRefresh(Boolean(event.target?.checked));
});

refreshStatus().catch((error) => renderJson("output", { error: String(error) }));
