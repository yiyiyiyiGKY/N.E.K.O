from pathlib import Path


PROJECT_ROOT = Path(__file__).resolve().parents[2]
SOCCER_AVATAR_HOST_PATH = (
    PROJECT_ROOT / "static/game/games/soccer/soccer-avatar-host.js"
)


def test_soccer_vrm_slots_require_the_unity_renderer():
    source = SOCCER_AVATAR_HOST_PATH.read_text(encoding="utf-8")

    load_section = source.split("async function loadVrmIntoManager", 1)[1].split(
        "function observeAsyncDisposal", 1
    )[0]
    assert "manager instanceof window.UnityVRMManager" in load_section
    assert "Unity VRM renderer required" in load_section
    assert "manager.loadModel(path, { embed: true, restorePreferences: false })" in load_section
    assert "GLTFLoader" not in load_section
    assert "three-vrm" not in load_section
    assert "preparePerspectiveReference" not in load_section


def test_soccer_unity_fit_contract_runs_on_load_and_resize():
    source = SOCCER_AVATAR_HOST_PATH.read_text(encoding="utf-8")

    fit_section = source.split("function fitUnityVrmManager", 1)[1].split(
        "async function loadVrmIntoManager", 1
    )[0]
    assert "manager.resizeSurface?.(size.width, size.height, false);" in fit_section
    assert "manager.fitModel?.(size, fit);" in fit_section
    assert "manager.getModelScreenBounds?.()" in fit_section

    load_section = source.split("async function loadVrmIntoManager", 1)[1].split(
        "function observeAsyncDisposal", 1
    )[0]
    assert "fitUnityVrmManager(manager, containerId, viewport, fit);" in load_section

    controller_section = source.split("function createController", 1)[1]
    assert "canvasId: 'player-vrm-canvas'" in controller_section
    assert "canvasId: 'ai-vrm-canvas'" in controller_section
    template = (PROJECT_ROOT / "templates" / "soccer_demo.html").read_text(encoding="utf-8")
    assert 'id="ai-vrm-canvas"' in template
    assert controller_section.count("await loadVrmIntoManager(") >= 2
    assert "state.layout = fitUnityVrmManager(" in controller_section


def test_soccer_host_contains_no_three_vrm_fallback():
    source = SOCCER_AVATAR_HOST_PATH.read_text(encoding="utf-8")

    for legacy_symbol in (
        "GLTFLoader",
        "VRMLoaderPlugin",
        "VRMUtils",
        "fitPerspectiveModel",
        "applyVrm0FixedCameraFacingFix",
    ):
        assert legacy_symbol not in source
