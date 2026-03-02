import { WebTokenStorage as h, createRequestClient as T } from "@project_neko/request";
import { createRealtimeClient as p } from "@project_neko/realtime";
const E = { BASE_URL: "/", DEV: !1, MODE: "production", PROD: !0, SSR: !1 }, U = (e) => /^(?:https?:|wss?:)?\/\//.test(e), w = (e) => e ? e.replace(/\/+$/, "") : "", S = (e) => e.startsWith("/") ? e : `/${e}`, m = (e) => {
  try {
    return E?.[e];
  } catch {
    return;
  }
}, R = () => window.API_BASE_URL || m("VITE_API_BASE_URL") || "http://localhost:48911", y = (e) => window.STATIC_SERVER_URL || m("VITE_STATIC_SERVER_URL") || e, B = (e) => window.WEBSOCKET_URL || m("VITE_WEBSOCKET_URL") || e, _ = (e = {}) => e.apiBaseUrl || e.baseURL || R(), f = (e, t) => {
  if (U(t)) return t;
  const n = w(e), o = S(t);
  return `${n}${o}`;
}, b = (e) => e.replace(/^http:\/\//i, "ws://").replace(/^https:\/\//i, "wss://");
function q() {
  let t = new URLSearchParams(window.location.search).get("lanlan_name") || "";
  if (!t) {
    const n = window.location.pathname.split("/").filter(Boolean);
    n.length > 0 && !["focus", "api", "static", "templates"].includes(n[0]) && (t = decodeURIComponent(n[0]));
  }
  return t;
}
function v(e) {
  if (typeof window > "u")
    return () => {
    };
  let t = !1;
  const n = window.__statusToastQueue && window.__statusToastQueue.length > 0 ? [...window.__statusToastQueue] : [], o = (r, a = 3e3) => {
    if (!(!r || r.trim() === "")) {
      if (window.__REACT_READY) {
        e.show(r, a);
        return;
      }
      if (window.__statusToastQueue || (window.__statusToastQueue = []), window.__statusToastQueue.push({ message: r, duration: a }), !t) {
        const d = () => {
          (window.__statusToastQueue || []).forEach((c) => e.show(c.message, c.duration)), window.__statusToastQueue = [], t = !1;
        };
        window.addEventListener("react-ready", d, { once: !0 }), t = !0;
      }
    }
  };
  if (Object.defineProperty(window, "showStatusToast", {
    value: o,
    writable: !0,
    configurable: !0,
    enumerable: !0
  }), n.length > 0) {
    const r = n[n.length - 1];
    r && setTimeout(() => {
      o(r.message, r.duration);
    }, 300), window.__statusToastQueue = [];
  }
  const u = () => {
    setTimeout(() => {
      const r = window.__statusToastQueue || [];
      if (r.length > 0) {
        const a = r[r.length - 1];
        a && (o(a.message, a.duration), window.__statusToastQueue = []);
      } else if (typeof window.lanlan_config < "u" && window.lanlan_config?.lanlan_name) {
        const a = window.t?.("app.started", { name: window.lanlan_config.lanlan_name }) ?? `${window.lanlan_config.lanlan_name}已启动`;
        o(a, 3e3);
      }
    }, 1500);
  }, s = document.readyState !== "complete";
  s ? window.addEventListener("load", u, { once: !0 }) : u();
  const i = setTimeout(() => {
    window.dispatchEvent(new CustomEvent("statusToastReady")), setTimeout(() => {
      const r = window.__statusToastQueue || [];
      if (r.length > 0) {
        const a = r[r.length - 1];
        a && (o(a.message, a.duration), window.__statusToastQueue = []);
      }
    }, 100);
  }, 50);
  return () => {
    clearTimeout(i), s && window.removeEventListener("load", u);
  };
}
function A(e) {
  if (typeof window > "u")
    return () => {
    };
  const t = (i) => {
    try {
      if (window.t && typeof window.t == "function")
        switch (i) {
          case "alert":
            return window.t("common.alert");
          case "confirm":
            return window.t("common.confirm");
          case "prompt":
            return window.t("common.input");
          default:
            return "提示";
        }
    } catch {
    }
    switch (i) {
      case "alert":
        return "提示";
      case "confirm":
        return "确认";
      case "prompt":
        return "输入";
      default:
        return "提示";
    }
  }, n = (i, r = null) => e.alert(i, r !== null ? r : t("alert")), o = (i, r = null, a = {}) => e.confirm(i, r !== null ? r : t("confirm"), a), u = (i, r = "", a = null) => e.prompt(i, r, a !== null ? a : t("prompt"));
  Object.defineProperty(window, "showAlert", {
    value: n,
    writable: !0,
    configurable: !0,
    enumerable: !0
  }), Object.defineProperty(window, "showConfirm", {
    value: o,
    writable: !0,
    configurable: !0,
    enumerable: !0
  }), Object.defineProperty(window, "showPrompt", {
    value: u,
    writable: !0,
    configurable: !0,
    enumerable: !0
  });
  const s = setTimeout(() => {
    window.dispatchEvent(new CustomEvent("modalReady")), window.__modalReady = !0;
  }, 50);
  return () => {
    clearTimeout(s);
  };
}
function O(e) {
  const t = [];
  return e.toast && t.push(v(e.toast)), e.modal && t.push(A(e.modal)), () => {
    t.forEach((n) => n && n());
  };
}
function g(e, t = {}) {
  if (typeof window > "u")
    return () => {
    };
  const n = w(t.apiBaseUrl || R()), o = w(t.staticServerUrl || y(n)), u = w(t.websocketUrl || B(n)), s = (l) => f(n, l), i = (l) => f(o || n, l), r = (l) => {
    if (U(l))
      return b(l);
    const c = f(u || n, l);
    return b(c);
  }, a = (l, c) => fetch(s(l), c);
  Object.defineProperty(window, "request", {
    value: e,
    writable: !0,
    configurable: !0,
    enumerable: !0
  }), window.API_BASE_URL = n, window.STATIC_SERVER_URL = o, window.WEBSOCKET_URL = u, window.buildApiUrl = s, window.buildStaticUrl = i, window.buildWebSocketUrl = r, window.fetchWithBaseUrl = a;
  const d = setTimeout(() => {
    window.dispatchEvent(new CustomEvent("requestReady"));
  }, 0);
  return () => {
    clearTimeout(d);
  };
}
function L(e = {}) {
  if (typeof window > "u")
    return { client: null, cleanup: () => {
    } };
  Object.defineProperty(window, "createRealtimeClient", {
    value: (i) => p(i),
    writable: !0,
    configurable: !0,
    enumerable: !0
  });
  let n = null;
  (e.url || e.path) && (n = p({
    url: e.url,
    path: e.path,
    protocols: e.protocols,
    buildUrl: typeof window.buildWebSocketUrl == "function" ? window.buildWebSocketUrl : void 0
  }), Object.defineProperty(window, "realtime", {
    value: n,
    writable: !0,
    configurable: !0,
    enumerable: !0
  }));
  const u = setTimeout(() => {
    window.dispatchEvent(new CustomEvent("websocketReady"));
  }, 0);
  return { client: n, cleanup: () => {
    clearTimeout(u);
  } };
}
function I(e = {}) {
  const t = _(e), n = e.storage || new h(), o = e.refreshApi || (async () => {
    throw new Error("refreshApi not implemented");
  }), u = T({
    ...e,
    baseURL: t,
    storage: n,
    refreshApi: o
  }), s = g(u, {
    apiBaseUrl: t,
    staticServerUrl: e.staticServerUrl,
    websocketUrl: e.websocketUrl
  });
  return { client: u, cleanup: s };
}
function P(e = {}) {
  const t = _(e), n = e.storage || new h(), o = e.refreshApi || (async () => {
    throw new Error("refreshApi not implemented");
  });
  return T({
    ...e,
    baseURL: t,
    storage: n,
    refreshApi: o
  });
}
function C(e = {}) {
  const t = _(e), n = P({
    ...e,
    apiBaseUrl: t,
    baseURL: t
  }), o = g(n, {
    apiBaseUrl: t,
    staticServerUrl: e.staticServerUrl,
    websocketUrl: e.websocketUrl
  });
  return { client: n, cleanup: o };
}
function W() {
  if (typeof window > "u") return null;
  if (window.__nekoBridgeRequestBound && window.request)
    return window.request;
  const { client: e } = C();
  return window.__nekoBridgeRequestBound = !0, e;
}
typeof window < "u" && (W(), window.__nekoBridgeRealtimeBound || (L(), window.__nekoBridgeRealtimeBound = !0));
export {
  W as autoBindDefaultRequest,
  O as bindComponentsToWindow,
  C as bindDefaultRequestToWindow,
  A as bindModalToWindow,
  L as bindRealtimeToWindow,
  g as bindRequestToWindow,
  v as bindStatusToastToWindow,
  I as createAndBindRequest,
  P as createDefaultRequestClient,
  q as resolveLanlanNameFromLocation
};
