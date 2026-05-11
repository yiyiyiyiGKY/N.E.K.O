import json
from pathlib import Path

import pytest


REPO_ROOT = Path(__file__).resolve().parents[2]
LOCALES_DIR = REPO_ROOT / "static" / "locales"
MEMORY_BROWSER_TEMPLATE = REPO_ROOT / "templates" / "memory_browser.html"
MEMORY_BROWSER_SCRIPT = REPO_ROOT / "static" / "js" / "memory_browser.js"
APP_REACT_CHAT_SCRIPT = REPO_ROOT / "static" / "app-react-chat-window.js"


@pytest.mark.unit
def test_memory_browser_has_subconscious_maintenance_entry_button():
    template = MEMORY_BROWSER_TEMPLATE.read_text(encoding="utf-8")
    assert "subconscious-maintenance-open-btn" in template
    assert 'data-i18n="memory.subconsciousMaintenanceEntry"' in template


@pytest.mark.unit
def test_memory_browser_subconscious_maintenance_entry_exists_in_all_locales():
    for locale_path in sorted(LOCALES_DIR.glob("*.json")):
        payload = json.loads(locale_path.read_text(encoding="utf-8"))
        memory = payload.get("memory")
        assert isinstance(memory, dict), locale_path.name
        value = str(memory.get("subconsciousMaintenanceEntry") or "").strip()
        assert value, locale_path.name


@pytest.mark.unit
def test_subconscious_maintenance_launch_paths_carry_overlay_marker():
    memory_browser_script = MEMORY_BROWSER_SCRIPT.read_text(encoding="utf-8")
    app_react_chat_script = APP_REACT_CHAT_SCRIPT.read_text(encoding="utf-8")

    assert "nekoOverlay=subconscious_maintenance" in memory_browser_script
    assert "SUBCONSCIOUS_MAINTENANCE_OVERLAY_FEATURE" in app_react_chat_script
    assert "window.open('', '_blank', preOpenFeatures)" in app_react_chat_script
    assert "window.open(payload.url, '_blank', windowFeatures)" in app_react_chat_script
