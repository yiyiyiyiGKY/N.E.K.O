class j {
  constructor(t) {
    this.listeners = /* @__PURE__ */ new Map(), this.onError = t?.onError;
  }
  /**
   * 订阅事件
   * 
   * @param event - 事件名
   * @param handler - 事件处理器
   * @returns 取消订阅函数
   */
  on(t, r) {
    const l = this.listeners.get(t) || /* @__PURE__ */ new Set();
    return l.add(r), this.listeners.set(t, l), () => {
      const c = this.listeners.get(t);
      c && (c.delete(r), c.size === 0 && this.listeners.delete(t));
    };
  }
  /**
   * 发射事件
   * 
   * @param event - 事件名
   * @param payload - 事件 payload
   */
  emit(t, r) {
    const l = this.listeners.get(t);
    if (l)
      for (const c of l)
        try {
          c(r);
        } catch (y) {
          const S = this.onError;
          if (S)
            S(y, c, r);
          else {
            const p = typeof c == "function" && c.name ? String(c.name) : "<anonymous>";
            console.error(`[TinyEmitter] 事件处理器抛错 (event="${String(t)}", handler="${p}")`, {
              error: y,
              handler: c,
              payload: r
            });
          }
        }
  }
  /**
   * 清空所有事件监听器
   */
  clear() {
    this.listeners.clear();
  }
}
const F = (e) => e.replace(/\/+$/, ""), N = (e) => e.startsWith("/") ? e : `/${e}`, _ = (e) => e.replace(/^http:\/\//i, "ws://").replace(/^https:\/\//i, "wss://");
function J(e, t) {
  const r = F(e), l = N(t);
  return _(`${r}${l}`);
}
function E() {
  try {
    const e = globalThis.location;
    return !e || typeof e.protocol != "string" || typeof e.host != "string" ? "" : `${String(e.protocol).toLowerCase() === "https:" ? "wss:" : "ws:"}//${e.host}`;
  } catch {
    return "";
  }
}
function h(e, t, r) {
  return Math.max(t, Math.min(r, e));
}
function A(e) {
  return typeof e == "string";
}
function B(e) {
  try {
    return { ok: !0, value: JSON.parse(e) };
  } catch (t) {
    return { ok: !1, error: t };
  }
}
function H(e) {
  if (e) return e;
  const t = globalThis.WebSocket;
  if (!t)
    throw new Error("WebSocket is not available in this environment. Please provide options.webSocketCtor.");
  return t;
}
function T(e) {
  if (e.url) return e.url;
  const t = e.path || "";
  if (!t)
    throw new Error("RealtimeClientOptions.url or RealtimeClientOptions.path is required.");
  if (e.buildUrl)
    return e.buildUrl(t);
  const r = E();
  if (!r)
    throw new Error("Cannot infer WebSocket base from location. Please provide options.url or options.buildUrl.");
  return J(r, t);
}
function L(e) {
  const t = new j(), r = e.parseJson !== !1, l = h(e.heartbeat?.intervalMs ?? 3e4, 0, 3600 * 1e3), c = e.heartbeat?.payload ?? { action: "ping" }, y = e.reconnect?.enabled !== !1, S = h(e.reconnect?.minDelayMs ?? 3e3, 0, 3600 * 1e3), p = h(e.reconnect?.maxDelayMs ?? 3e4, 0, 3600 * 1e3), R = h(e.reconnect?.backoffFactor ?? 1.6, 1, 100), $ = h(e.reconnect?.jitterRatio ?? 0.2, 0, 1), w = e.reconnect?.maxAttempts, x = e.reconnect?.shouldReconnect || (() => !0);
  let m = "idle", s = null, g = !1, b = 0, f = null, d = null;
  const u = (n) => {
    m !== n && (m = n, t.emit("state", { state: n }));
  }, k = () => {
    f && (clearTimeout(f), f = null), d && (clearInterval(d), d = null);
  }, M = () => {
    d && (clearInterval(d), d = null);
  }, P = () => {
    M(), !(!l || l <= 0) && (d = setInterval(() => {
      if (!s || s.readyState !== 1) return;
      const n = typeof c == "function" ? c() : c;
      if (typeof n == "string") {
        try {
          s.send(n);
        } catch {
        }
        return;
      }
      try {
        s.send(JSON.stringify(n));
      } catch {
      }
    }, l));
  }, W = (n) => {
    n.onopen = null, n.onmessage = null, n.onclose = null, n.onerror = null;
  }, v = (n) => {
    if (!y || g || w !== void 0 && b >= w || !x({ event: n, attempts: b })) return;
    u("reconnecting"), b += 1;
    const o = Math.min(
      p,
      S * Math.pow(R, Math.max(0, b - 1))
    ), a = o * $, i = h(o + (Math.random() * 2 - 1) * a, 0, p);
    f && clearTimeout(f), f = setTimeout(() => {
      f = null, U();
    }, i);
  }, D = (n) => {
    const o = n?.data;
    if (t.emit("message", { data: o, rawEvent: n }), A(o)) {
      if (t.emit("text", { text: o, rawEvent: n }), r) {
        const a = B(o);
        a.ok && t.emit("json", { json: a.value, text: o, rawEvent: n });
      }
      return;
    }
    t.emit("binary", { data: o, rawEvent: n });
  }, U = () => {
    if (s && (s.readyState === 0 || s.readyState === 1))
      return;
    k(), g = !1;
    const n = T(e), o = H(e.webSocketCtor);
    u("connecting");
    let a;
    try {
      a = new o(n, e.protocols);
    } catch (i) {
      u("closed"), t.emit("error", { event: i }), v(i);
      return;
    }
    s = a, a.onopen = () => {
      b = 0, u("open"), t.emit("open", void 0), P();
    }, a.onmessage = (i) => {
      D(i);
    }, a.onclose = (i) => {
      M(), u("closed"), t.emit("close", { event: i }), W(a), s === a && (s = null), v(i);
    }, a.onerror = (i) => {
      t.emit("error", { event: i });
    };
  }, I = () => {
    m !== "idle" && m !== "closed" || U();
  }, O = (n) => {
    if (g = !0, k(), u("closing"), !s) {
      u("closed");
      return;
    }
    const o = s;
    s = null;
    try {
      W(o), o.close(n?.code, n?.reason);
    } catch {
    } finally {
      u("closed");
    }
  }, C = (n) => {
    if (!s || s.readyState !== 1)
      throw new Error("WebSocket is not open");
    s.send(n);
  };
  return {
    connect: I,
    disconnect: O,
    send: C,
    sendJson: (n) => {
      C(JSON.stringify(n));
    },
    getState: () => m,
    getUrl: () => T(e),
    getSocket: () => s,
    on: (n, o) => t.on(n, o)
  };
}
function z(e) {
  const t = e.buildUrl || ((r) => {
    const l = typeof window < "u" ? window : void 0;
    if (l && typeof l.buildWebSocketUrl == "function")
      return l.buildWebSocketUrl(r);
    const c = E();
    if (!c)
      throw new Error("Cannot infer WebSocket base from location. Please provide options.url or options.buildUrl.");
    return J(c, r);
  });
  return L({
    ...e,
    buildUrl: t
  });
}
export {
  L as createRealtimeClient,
  z as createWebRealtimeClient
};
