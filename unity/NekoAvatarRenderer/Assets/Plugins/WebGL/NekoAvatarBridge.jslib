mergeInto(LibraryManager.library, {
  NekoAvatarEmitEvent: function (jsonPointer) {
    var raw = UTF8ToString(jsonPointer);
    var detail;
    try {
      detail = JSON.parse(raw);
    } catch (error) {
      detail = {
        protocolVersion: 1,
        type: 'protocolError',
        message: 'Unity emitted invalid JSON'
      };
    }

    if (window.NekoUnityAvatar && typeof window.NekoUnityAvatar.onUnityEvent === 'function') {
      window.NekoUnityAvatar.onUnityEvent(raw);
    }
    window.dispatchEvent(new CustomEvent('neko-unity-avatar-event', { detail: detail }));
  }
});
