from types import SimpleNamespace
from pathlib import Path
import struct

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
SCRIPT_PATH = REPO_ROOT / "static" / "js" / "subconscious_maintenance.js"
SPRITE_PATH = REPO_ROOT / "static" / "icons" / "subconscious_maintenance_sprites.png"
VFX_PATH = REPO_ROOT / "static" / "icons" / "subconscious_maintenance_vfx.png"


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

    assert 'data-phase="loading"' in template
    assert 'id="subconscious-maintenance-canvas"' in template
    assert 'id="subconscious-maintenance-hud"' in template
    assert 'id="subconscious-maintenance-neko-mode-btn"' in template
    assert 'id="subconscious-maintenance-neko-mode"' in template
    assert 'id="subconscious-maintenance-buff"' in template
    assert '>清理<' in template
    assert 'id="subconscious-maintenance-loading"' in template
    assert 'id="subconscious-maintenance-loading-exit-btn"' in template
    assert 'id="subconscious-maintenance-setup"' in template
    assert 'id="subconscious-maintenance-pause-layer"' in template
    assert 'id="subconscious-maintenance-end-layer"' in template
    assert 'class="sm-difficulty-btn is-active"' in template
    assert 'id="subconscious-maintenance-start-btn" class="sm-command-btn sm-command-btn--primary" disabled' in template
    assert '/static/css/subconscious_maintenance.css?v={{ subconscious_maintenance_asset_version }}' in template
    assert '/static/js/subconscious_maintenance.js?v={{ subconscious_maintenance_asset_version }}' in template


@pytest.mark.unit
def test_subconscious_maintenance_css_uses_blue_white_setup_panel_and_centered_start_button():
    css = STYLE_PATH.read_text(encoding="utf-8")

    assert '.sm-panel-actions {' in css
    assert 'justify-content: center;' in css
    assert 'touch-action: none;' in css
    assert '.sm-hud-toggle' in css
    assert '.sm-hud-toggle--mode' in css
    assert '.sm-difficulty-btn.is-active' in css
    assert '.sm-command-btn:disabled' in css
    assert 'linear-gradient(180deg, #62c7ff 0%, #31a8f0 100%)' in css


@pytest.mark.unit
def test_subconscious_maintenance_script_has_loading_ready_state_machine_and_sprite_preload():
    script = SCRIPT_PATH.read_text(encoding="utf-8")

    for phase in ("loading", "ready", "playing", "paused", "success", "failed", "exiting"):
        assert f"'{phase}'" in script

    assert "new Image()" in script
    assert "preloadSpriteSheet" in script
    assert "preloadVfxSheet" in script
    assert "markSpriteSheetReady" in script
    assert "markVfxSheetReady" in script
    assert "markSpriteSheetFailed" in script
    assert "var VFX_SHEET_URL = '/static/icons/subconscious_maintenance_vfx.png';" in script
    assert "function withAssetVersion" in script
    assert "withAssetVersion(VFX_SHEET_URL)" in script
    assert "withAssetVersion(SPRITE_SHEET_URL)" in script
    assert "ROUTE_BASE_URL = '/api/game/' + GAME_TYPE + '/route'" in script
    assert "function startRouteSession" in script
    assert "function startRouteHeartbeat" in script
    assert "function endRouteSession" in script
    assert "navigator.sendBeacon" in script
    assert "getCanvasPointFromEvent" in script
    assert "pointermove" in script
    assert "getPointerState" in script
    assert "updateAttackFlash" in script
    assert "state.phase !== 'ready' || !state.spriteReady" in script
    assert "document.addEventListener('visibilitychange', handleVisibilityChange)" in script
    assert "resetFrameClock()" in script


@pytest.mark.unit
def test_subconscious_maintenance_declares_three_enemy_sprites_and_expanded_sheet():
    script = SCRIPT_PATH.read_text(encoding="utf-8")

    assert "var SPRITE_COLUMNS = 4;" in script
    assert "glitchWorm" in script
    assert "logicBomb" in script
    assert "noiseSquid" in script
    assert "var ENEMY_SPRITES = ['glitchWorm', 'logicBomb', 'noiseSquid'];" in script

    with SPRITE_PATH.open("rb") as sprite_file:
        header = sprite_file.read(26)
    width, height, bit_depth, color_type = struct.unpack(">IIBB", header[16:26])
    assert (width, height) == (2048, 1024)
    assert bit_depth == 8
    assert color_type == 6

    with VFX_PATH.open("rb") as vfx_file:
        vfx_header = vfx_file.read(26)
    vfx_width, vfx_height, vfx_bit_depth, vfx_color_type = struct.unpack(">IIBB", vfx_header[16:26])
    assert (vfx_width, vfx_height) == (1536, 1024)
    assert vfx_bit_depth == 8
    assert vfx_color_type == 6


@pytest.mark.unit
def test_subconscious_maintenance_script_contains_first_playable_battle_loop():
    script = SCRIPT_PATH.read_text(encoding="utf-8")

    assert "var difficultyConfig = {" in script
    assert "var enemyConfig = {" in script
    assert "function spawnEnemy" in script
    assert "function processPlayerAttack" in script
    assert "function updateEnemies" in script
    assert "function updateNeko" in script
    assert "function updateBattle" in script
    assert "battle.enemies" in script
    assert "battle.fragments" in script
    assert "battle.specialItems" in script
    assert "nekoAttackCooldown" in script
    assert "state.specialItems >= 5" in script
    assert "showResult('success')" in script
    assert "showResult('failed')" in script
    assert "getBattleSnapshot" in script


@pytest.mark.unit
def test_subconscious_maintenance_script_balances_neko_collecting_evasion_and_modes():
    script = SCRIPT_PATH.read_text(encoding="utf-8")

    assert "nekoMode: 'free'" in script
    assert "function toggleNekoMode" in script
    assert "function getNekoDanger" in script
    assert "function getCoreItemThreat" in script
    assert "function addHotZone" in script
    assert "function getHotZoneCenter" in script
    assert "state.nekoIntent = 'evade'" in script
    assert "state.nekoIntent = 'request'" in script
    assert "state.nekoIntent = 'anticipate'" in script
    assert "setNekoHint('帮我开路')" in script
    assert "setNekoHint('我要拿那个大的'" in script
    assert "state.nekoMode === 'follow'" in script
    assert "state.buffLabel" in script
    assert "var FRAGMENTS_PER_BUFF = 10;" in script
    assert "speed_up: { label: '加速', ttl: 10 }" in script
    assert "var NEKO_FOLLOW_MAX_DISTANCE = 126;" in script
    assert "var NEKO_EVADE_ENTER_DISTANCE = 76;" in script
    assert "var NEKO_EVADE_EXIT_DISTANCE = 112;" in script
    assert "var NEKO_EVADE_PRESSURE_ENTER = 0.88;" in script
    assert "var NEKO_EVADE_LOCK_SECONDS = 0.85;" in script
    assert "function applyNekoFollowLeash" in script
    assert "function getNekoFollowAnchor" in script
    assert "function processNekoAssistAttack" in script
    assert "function getLockedNekoEvadeTarget" in script
    assert "battle.nekoEvadeTarget" in script
    assert "nekoFollowSettled" in script
    assert "function getBuffDisplayText" in script
    assert "fragmentBuffProgress" in script
    assert "attackEnemiesInFront" in script
    assert "function drawSpriteFacing" in script
    assert "drawSpriteFacing('player', scene.player.x, scene.player.y, 74, scene.player.facingX || 1)" in script
    assert "function updateEntityFacing" in script
    assert "drawSpriteFacing('neko', scene.neko.x, scene.neko.y, 74, scene.neko.facingX || 1)" in script
    assert "drawSpriteFacing(enemy.spriteKey, enemy.x, enemy.y, enemy.radius * 2.15, enemy.facingX || 1)" in script
    assert "attackFlashRange" in script
    assert "function drawSlashEffectImage" in script
    assert "function drawNekoAssistEffectImage" in script
    assert "function drawVfxSprite" in script
    assert "drawVfxSprite('slash'" in script
    assert "angle + Math.PI" in script
    assert "drawVfxSprite('neko-shot'" in script
    assert "kind: 'neko-shot'" in script
    assert "function triggerSpecialFullScreenAttack" in script
    assert "kind: 'full-shockwave'" in script
    assert "applyEnemyDeath(targets[i], 'full_clear')" in script
    assert "collectDrops(enemy, cause);" in script
    assert "function getComboBoostLevel" in script
    assert "state.stability = Math.min(battle.maxStability, state.stability + 1);" in script
    assert "setNekoHint('稳定 +1', 0.95);" in script
    assert "var attackPoint = state.pointer && state.pointer.active ? state.pointer : scene.target;" in script
    assert "spawnLogicBombShards" in script
    assert "enemy.hidden" in script
    assert "attackEnemyAtPoint" not in script
    assert "setLineDash" not in script
    assert "enemy.radius + 8" not in script


@pytest.mark.unit
def test_subconscious_maintenance_script_uses_slower_clearer_combat_tuning():
    script = SCRIPT_PATH.read_text(encoding="utf-8")

    assert "enemySpeed: 41" in script
    assert "playerSpeed: 180" in script
    assert "nekoSpeed: 75" in script
    assert "nekoAttackCooldown: 2.2" in script
    assert "specialChance: 0.008" in script
    assert "var magnetRadius = 26 + Math.min(18, state.combo * 0.8) + getComboBoostLevel() * 5;" in script
    assert "return 126 + Math.min(24, state.combo * 0.9) + getComboBoostLevel() * 10;" in script
    assert "state.nekoIntent !== 'evade'" not in script
    assert "if (enemy.hidden) continue;" in script
