import pytest
from playwright.sync_api import Page


@pytest.mark.frontend
def test_bubble_debug_overlay_cannot_be_enabled_from_url_or_public_api(
    mock_page: Page, running_server: str
):
    mock_page.goto(f"{running_server}/?bubbleDebug=1", wait_until="domcontentloaded")
    mock_page.wait_for_function(
        "() => !!(window.appState && window.avatarReactionBubble)",
        timeout=10000,
    )

    state = mock_page.evaluate(
        """
        () => {
            const overlay = document.getElementById('avatar-reaction-bubble-debug-overlay');
            return {
                overlayHidden: overlay ? overlay.getAttribute('aria-hidden') : null,
                hasSetDebugOverlayEnabled:
                    typeof window.avatarReactionBubble.setDebugOverlayEnabled === 'function',
                hasToggleDebugOverlay:
                    typeof window.avatarReactionBubble.toggleDebugOverlay === 'function',
                hasIsDebugOverlayEnabled:
                    typeof window.avatarReactionBubble.isDebugOverlayEnabled === 'function',
                debugEnabled: window.avatarReactionBubble.getState().debugOverlayEnabled === true
            };
        }
        """
    )

    assert state["overlayHidden"] == "true"
    assert state["hasSetDebugOverlayEnabled"] is False
    assert state["hasToggleDebugOverlay"] is False
    assert state["hasIsDebugOverlayEnabled"] is False
    assert state["debugEnabled"] is False

    mock_page.keyboard.press("Shift+B")

    overlay_hidden_after_keypress = mock_page.evaluate(
        """
        () => document
            .getElementById('avatar-reaction-bubble-debug-overlay')
            .getAttribute('aria-hidden')
        """
    )

    assert overlay_hidden_after_keypress == "true"
