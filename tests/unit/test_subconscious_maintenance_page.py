from types import SimpleNamespace
from pathlib import Path

import pytest

from main_routers.pages_router import subconscious_maintenance_page
from main_routers.shared_state import init_shared_state


class _DummyTemplates:
    def TemplateResponse(self, template_name, context):
        return {
            "template_name": template_name,
            "context": context,
        }


REPO_ROOT = Path(__file__).resolve().parents[2]
TEMPLATE_PATH = REPO_ROOT / "templates" / "subconscious_maintenance.html"
STYLE_PATH = REPO_ROOT / "static" / "css" / "subconscious_maintenance.css"


@pytest.mark.unit
@pytest.mark.asyncio
async def test_subconscious_maintenance_page_renders():
    templates = _DummyTemplates()
    init_shared_state(
        role_state={},
        steamworks=None,
        templates=templates,
        config_manager=SimpleNamespace(),
        logger=None,
        initialize_character_data=None,
    )

    request = SimpleNamespace()
    response = await subconscious_maintenance_page(request)

    assert response["template_name"] == "templates/subconscious_maintenance.html"
    assert response["context"]["request"] is request
    assert "subconscious_maintenance_asset_version" in response["context"]


@pytest.mark.unit
def test_subconscious_maintenance_template_contains_required_skeleton():
    template = TEMPLATE_PATH.read_text(encoding="utf-8")

    assert 'id="subconscious-maintenance-canvas"' in template
    assert 'id="subconscious-maintenance-hud"' in template
    assert 'id="subconscious-maintenance-setup"' in template
    assert 'id="subconscious-maintenance-pause-layer"' in template
    assert 'id="subconscious-maintenance-end-layer"' in template
    assert 'class="sm-difficulty-btn is-active"' in template
    assert '/static/css/subconscious_maintenance.css?v={{ subconscious_maintenance_asset_version }}' in template
    assert '/static/js/subconscious_maintenance.js?v={{ subconscious_maintenance_asset_version }}' in template


@pytest.mark.unit
def test_subconscious_maintenance_css_uses_blue_white_setup_panel_and_centered_start_button():
    css = STYLE_PATH.read_text(encoding="utf-8")

    assert '.sm-panel-actions {' in css
    assert 'justify-content: center;' in css
    assert '.sm-difficulty-btn.is-active' in css
    assert 'linear-gradient(180deg, #62c7ff 0%, #31a8f0 100%)' in css
