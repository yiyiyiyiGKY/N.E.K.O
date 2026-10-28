using System.Runtime.InteropServices;
using UnityEngine;

namespace Neko.Avatar
{
    internal static class NekoAvatarBrowserBridge
    {
#if UNITY_WEBGL && !UNITY_EDITOR
        [DllImport("__Internal")]
        private static extern void NekoAvatarEmitEvent(string json);
#endif

        public static void Emit(string json)
        {
#if UNITY_WEBGL && !UNITY_EDITOR
            NekoAvatarEmitEvent(json);
#else
            Debug.Log("[NekoAvatarEvent] " + json);
#endif
        }
    }
}
