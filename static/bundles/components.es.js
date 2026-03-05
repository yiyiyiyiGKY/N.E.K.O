import e, { forwardRef as z, useState as C, useEffect as R, useRef as D, useCallback as q, useImperativeHandle as F, createContext as Y, useContext as Z, useMemo as P } from "react";
import { createPortal as K } from "react-dom";
function Q({
  variant: i = "primary",
  size: s = "md",
  loading: l = !1,
  icon: p,
  iconRight: n,
  fullWidth: a = !1,
  disabled: f,
  className: u = "",
  label: d,
  children: b,
  ...c
}) {
  const g = f || l, m = b ?? d, y = [
    "btn",
    `btn-${i}`,
    `btn-${s}`,
    a && "btn-full-width",
    l && "btn-loading",
    u
  ].filter(Boolean).join(" ");
  return /* @__PURE__ */ e.createElement(
    "button",
    {
      className: y,
      disabled: g,
      ...c
    },
    l && /* @__PURE__ */ e.createElement("span", { className: "btn-spinner", "aria-hidden": "true" }, /* @__PURE__ */ e.createElement(
      "svg",
      {
        className: "btn-spinner-svg",
        viewBox: "0 0 24 24",
        fill: "none",
        xmlns: "http://www.w3.org/2000/svg"
      },
      /* @__PURE__ */ e.createElement(
        "circle",
        {
          className: "btn-spinner-circle",
          cx: "12",
          cy: "12",
          r: "10",
          stroke: "currentColor",
          strokeWidth: "4",
          strokeLinecap: "round",
          strokeDasharray: "32",
          strokeDashoffset: "32"
        },
        /* @__PURE__ */ e.createElement(
          "animate",
          {
            attributeName: "stroke-dasharray",
            dur: "2s",
            values: "0 32;16 16;0 32;0 32",
            repeatCount: "indefinite"
          }
        ),
        /* @__PURE__ */ e.createElement(
          "animate",
          {
            attributeName: "stroke-dashoffset",
            dur: "2s",
            values: "0;-16;-32;-32",
            repeatCount: "indefinite"
          }
        )
      )
    )),
    p && !l && /* @__PURE__ */ e.createElement("span", { className: "btn-icon-left" }, p),
    m && /* @__PURE__ */ e.createElement("span", { className: "btn-content" }, m),
    n && !l && /* @__PURE__ */ e.createElement("span", { className: "btn-icon-right" }, n)
  );
}
const ee = { BASE_URL: "/", DEV: !1, MODE: "production", PROD: !0, SSR: !1 }, X = (i) => i ? i.replace(/\/+$/, "") : "", te = () => {
  try {
    const i = ee ?? {}, s = typeof window < "u" ? window : {};
    return X(
      s.STATIC_SERVER_URL || s.API_BASE_URL || i.VITE_STATIC_SERVER_URL || i.VITE_API_BASE_URL || ""
    ) || "";
  } catch {
    return "";
  }
}, fe = z(function({ staticBaseUrl: s }, l) {
  const [p, n] = C({
    message: "",
    duration: 3e3,
    isVisible: !1
  });
  R(() => {
    if (typeof document > "u") return;
    const m = X(s || te());
    if (!m) return;
    const y = `${m}/static/icons/toast_background.png`;
    document.documentElement.style.setProperty("--toast-background-url", `url('${y}')`);
  }, [s]);
  const a = D(null), f = D(null), u = D(null), d = D(!1);
  R(() => {
    if (typeof document > "u") return;
    let m = document.getElementById("status-toast-container");
    return m || (m = document.createElement("div"), m.id = "status-toast-container", document.body.appendChild(m), d.current = !0), u.current = m, () => {
      d.current && u.current?.parentNode && u.current.parentNode.removeChild(u.current), u.current = null, d.current = !1;
    };
  }, []);
  const b = q((m, y = 3e3) => {
    if (a.current && (clearTimeout(a.current), a.current = null), f.current && (clearTimeout(f.current), f.current = null), !m || m.trim() === "") {
      n((E) => ({ ...E, isVisible: !1 })), f.current = setTimeout(() => {
        n((E) => ({ ...E, message: "" }));
      }, 300);
      return;
    }
    n({
      message: m,
      duration: y,
      isVisible: !0
    }), a.current = setTimeout(() => {
      n((E) => ({ ...E, isVisible: !1 })), f.current = setTimeout(() => {
        n((E) => ({ ...E, message: "" }));
      }, 300);
    }, y);
  }, []);
  F(
    l,
    () => ({
      show: b
    }),
    [b]
  ), R(() => () => {
    a.current && clearTimeout(a.current), f.current && clearTimeout(f.current);
  }, []), R(() => {
    const m = document.getElementById("status");
    m && (m.textContent = p.message || "");
  }, [p.message]);
  const c = p.message ? p.isVisible ? "show" : "hide" : "", g = /* @__PURE__ */ e.createElement(
    "div",
    {
      id: "status-toast",
      className: c,
      "aria-live": "polite"
    },
    p.message
  );
  return u.current ? K(g, u.current) : g;
}), G = Y(null);
function ge({ t: i, children: s }) {
  return /* @__PURE__ */ e.createElement(G.Provider, { value: i }, s);
}
function ne() {
  try {
    const s = (typeof window < "u" ? window : void 0)?.t;
    return typeof s == "function" ? s : null;
  } catch {
    return null;
  }
}
function S() {
  const i = Z(G);
  if (i) return i;
  const s = ne();
  return s || ((l) => l);
}
function t(i, s, l, p) {
  try {
    const n = i(s, p);
    return !n || n === s ? l : n;
  } catch {
    return l;
  }
}
function j({
  isOpen: i,
  onClose: s,
  title: l,
  children: p,
  closeOnClickOutside: n = !0,
  closeOnEscape: a = !0
}) {
  const f = D(null), u = D(null), d = D(null);
  R(() => {
    if (!i || !a) return;
    const c = (g) => {
      g.key === "Escape" && s();
    };
    return d.current = c, document.addEventListener("keydown", c), () => {
      d.current && (document.removeEventListener("keydown", d.current), d.current = null);
    };
  }, [i, a, s]);
  const b = (c) => {
    n && c.target === f.current && s();
  };
  return R(() => {
    if (i && u.current) {
      const c = setTimeout(() => {
        const g = u.current?.querySelector("input"), m = u.current?.querySelector("button");
        g ? (g.focus(), g instanceof HTMLInputElement && g.select()) : m && m.focus();
      }, 100);
      return () => clearTimeout(c);
    }
  }, [i]), i ? K(
    /* @__PURE__ */ e.createElement(
      "div",
      {
        ref: f,
        className: "modal-overlay",
        onClick: b,
        role: "dialog",
        "aria-modal": "true",
        "aria-labelledby": l ? "modal-title" : void 0
      },
      /* @__PURE__ */ e.createElement("div", { ref: u, className: "modal-dialog" }, l && /* @__PURE__ */ e.createElement("div", { className: "modal-header" }, /* @__PURE__ */ e.createElement("h3", { id: "modal-title", className: "modal-title" }, l)), p)
    ),
    document.body
  ) : null;
}
function re({ apiBase: i }) {
  const [s, l] = C(""), [p, n] = C("48911"), [a, f] = C(!1), u = S();
  R(() => {
    try {
      const c = new URL(i);
      l(c.hostname), c.port && n(c.port);
    } catch {
      const c = i.replace(/^https?:\/\//, "").split(":");
      c[0] && l(c[0]), c[1] && n(c[1]);
    }
  }, [i]);
  const d = `${s}:${p}`, b = async () => {
    try {
      await navigator.clipboard.writeText(d), f(!0), setTimeout(() => f(!1), 2e3);
    } catch {
      const c = document.getElementById("server-address-input");
      c && c.select();
    }
  };
  return /* @__PURE__ */ e.createElement("div", { className: "manual-input-section" }, /* @__PURE__ */ e.createElement("div", { className: "manual-input-title" }, t(u, "webapp.qrDrawer.manualInput", "手动输入地址")), /* @__PURE__ */ e.createElement("div", { className: "manual-input-row" }, /* @__PURE__ */ e.createElement(
    "input",
    {
      id: "server-address-input",
      type: "text",
      className: "manual-input-host",
      value: s,
      onChange: (c) => l(c.target.value),
      placeholder: "192.168.1.100"
    }
  ), /* @__PURE__ */ e.createElement("span", { className: "manual-input-separator" }, ":"), /* @__PURE__ */ e.createElement(
    "input",
    {
      type: "text",
      className: "manual-input-port",
      value: p,
      onChange: (c) => n(c.target.value),
      placeholder: "48911"
    }
  )), /* @__PURE__ */ e.createElement("div", { className: "manual-input-result" }, /* @__PURE__ */ e.createElement("code", { className: "manual-input-address" }, d), /* @__PURE__ */ e.createElement(Q, { variant: "secondary", size: "sm", onClick: b }, a ? t(u, "common.copied", "已复制") : t(u, "common.copy", "复制"))), /* @__PURE__ */ e.createElement("div", { className: "manual-input-hint" }, t(u, "webapp.qrDrawer.manualInputHint", "在 App 中手动输入以上地址")));
}
function he({
  apiBase: i,
  isOpen: s,
  onClose: l,
  title: p,
  endpoint: n = "/getipqrcode"
}) {
  const a = S(), [f, u] = C(null), [d, b] = C(null), [c, g] = C(!1), [m, y] = C(null), E = D(null);
  R(() => {
    if (!s) {
      if (g(!1), y(null), b(null), E.current) {
        try {
          URL.revokeObjectURL(E.current);
        } catch {
        }
        E.current = null;
      }
      u(null);
      return;
    }
    const o = new AbortController();
    let h = null;
    return (async () => {
      g(!0), y(null), b(null);
      try {
        const r = await fetch(`${i}${n}`, {
          method: "GET",
          signal: o.signal,
          headers: {
            Accept: "image/*,application/json"
          }
        });
        if ((r.headers.get("content-type") || "").includes("application/json")) {
          const w = await r.json(), _ = typeof w?.message == "string" && w.message || typeof w?.error == "string" && w.error || t(a, "webapp.qrDrawer.unknownError", "未知錯誤");
          throw new Error(_);
        }
        if (!r.ok)
          throw new Error(t(a, "webapp.qrDrawer.fetchError", `獲取失敗: ${r.status}`));
        const v = await r.blob();
        h = URL.createObjectURL(v), E.current = h, u(h), b(r.headers.get("X-Neko-Access-Url"));
        return;
      } catch (r) {
        if (o.signal.aborted) return;
        y(r?.message || t(a, "webapp.qrDrawer.unknownError", "未知錯誤"));
      } finally {
        o.signal.aborted || g(!1);
      }
    })(), () => {
      if (o.abort(), h) {
        try {
          URL.revokeObjectURL(h);
        } catch {
        }
        E.current === h && (E.current = null);
      }
    };
  }, [i, n, s, a]);
  const I = p || t(a, "webapp.qrDrawer.title", "二维码");
  return /* @__PURE__ */ e.createElement(j, { isOpen: s, onClose: l, title: I }, /* @__PURE__ */ e.createElement("div", { className: "modal-body", "aria-live": "polite", "aria-atomic": "true" }, c && t(a, "webapp.qrDrawer.loading", "加载中…"), !c && m && /* @__PURE__ */ e.createElement("div", { className: "qr-error" }, t(a, "webapp.qrDrawer.error", "二维码加载失败"), /* @__PURE__ */ e.createElement("div", { className: "qr-error-detail" }, m)), !c && !m && !f && t(a, "webapp.qrDrawer.placeholder", "二维码区域（待接入）"), !c && !m && f && /* @__PURE__ */ e.createElement(e.Fragment, null, /* @__PURE__ */ e.createElement("img", { className: "qr-image", src: f, alt: I }), d && /* @__PURE__ */ e.createElement("div", { className: "qr-url" }, d), /* @__PURE__ */ e.createElement("div", { className: "qr-divider" }), /* @__PURE__ */ e.createElement(re, { apiBase: i }))), /* @__PURE__ */ e.createElement("div", { className: "modal-footer" }, /* @__PURE__ */ e.createElement(Q, { variant: "secondary", onClick: l }, t(a, "common.close", "关闭"))));
}
function be({
  apiBase: i,
  isOpen: s,
  onClose: l,
  title: p
}) {
  const n = S(), [a, f] = C(null), [u, d] = C(null), [b, c] = C(!1), [g, m] = C(null), y = D(null);
  R(() => {
    if (!s) {
      if (c(!1), m(null), d(null), y.current) {
        try {
          URL.revokeObjectURL(y.current);
        } catch {
        }
        y.current = null;
      }
      f(null);
      return;
    }
    const o = new AbortController();
    let h = null;
    return (async () => {
      c(!0), m(null), d(null);
      try {
        const r = await fetch(`${i}/lanproxyqrcode`, {
          method: "GET",
          signal: o.signal,
          headers: {
            Accept: "image/*,application/json"
          }
        });
        if ((r.headers.get("content-type") || "").includes("application/json")) {
          const U = await r.json(), L = typeof U?.message == "string" && U.message || t(n, "p2pQr.unknownError", "未知错误");
          throw new Error(L);
        }
        if (!r.ok)
          throw new Error(t(n, "p2pQr.fetchError", `获取失败: ${r.status}`));
        const v = r.headers.get("X-Lan-Ip") || "", w = r.headers.get("X-Port") || "", _ = r.headers.get("X-Token") || "";
        v && _ && d({
          lan_ip: v,
          port: parseInt(w, 10) || 48920,
          token: _
        });
        const A = await r.blob();
        h = URL.createObjectURL(A), y.current = h, f(h);
      } catch (r) {
        if (o.signal.aborted) return;
        m(r?.message || t(n, "p2pQr.unknownError", "未知错误"));
      } finally {
        o.signal.aborted || c(!1);
      }
    })(), () => {
      if (o.abort(), h) {
        try {
          URL.revokeObjectURL(h);
        } catch {
        }
        y.current === h && (y.current = null);
      }
    };
  }, [i, s, n]);
  const E = async () => {
    if (u)
      try {
        const o = JSON.stringify({
          lan_ip: u.lan_ip,
          port: u.port,
          token: u.token
        });
        await navigator.clipboard.writeText(o);
      } catch {
      }
  }, I = p || t(n, "p2pQr.title", "P2P 连接二维码");
  return /* @__PURE__ */ e.createElement(j, { isOpen: s, onClose: l, title: I }, /* @__PURE__ */ e.createElement("div", { className: "modal-body p2p-qr-body", "aria-live": "polite", "aria-atomic": "true" }, /* @__PURE__ */ e.createElement("div", { className: "p2p-qr-description" }, t(n, "p2pQr.description", "使用手机 App 扫码，同 WiFi 下直接连接")), b && /* @__PURE__ */ e.createElement("div", { className: "p2p-qr-loading" }, t(n, "p2pQr.loading", "加载中…")), !b && g && /* @__PURE__ */ e.createElement("div", { className: "p2p-qr-error" }, /* @__PURE__ */ e.createElement("div", { className: "p2p-qr-error-title" }, t(n, "p2pQr.error", "二维码加载失败")), /* @__PURE__ */ e.createElement("div", { className: "p2p-qr-error-detail" }, g)), !b && !g && !a && /* @__PURE__ */ e.createElement("div", { className: "p2p-qr-placeholder" }, t(n, "p2pQr.placeholder", "二维码区域")), !b && !g && a && /* @__PURE__ */ e.createElement(e.Fragment, null, /* @__PURE__ */ e.createElement("div", { className: "p2p-qr-image-wrapper" }, /* @__PURE__ */ e.createElement("img", { className: "p2p-qr-image", src: a, alt: I })), u && /* @__PURE__ */ e.createElement(e.Fragment, null, /* @__PURE__ */ e.createElement("div", { className: "p2p-qr-info" }, /* @__PURE__ */ e.createElement("div", { className: "p2p-qr-info-row" }, /* @__PURE__ */ e.createElement("span", { className: "p2p-qr-info-label" }, "IP:"), /* @__PURE__ */ e.createElement("code", { className: "p2p-qr-info-value" }, u.lan_ip)), /* @__PURE__ */ e.createElement("div", { className: "p2p-qr-info-row" }, /* @__PURE__ */ e.createElement("span", { className: "p2p-qr-info-label" }, t(n, "p2pQr.port", "端口"), ":"), /* @__PURE__ */ e.createElement("code", { className: "p2p-qr-info-value" }, u.port)), /* @__PURE__ */ e.createElement("div", { className: "p2p-qr-info-row" }, /* @__PURE__ */ e.createElement("span", { className: "p2p-qr-info-label" }, "Token:"), /* @__PURE__ */ e.createElement("code", { className: "p2p-qr-info-value p2p-qr-token" }, u.token.slice(0, 8), "...", u.token.slice(-8)))), /* @__PURE__ */ e.createElement("div", { className: "p2p-qr-actions" }, /* @__PURE__ */ e.createElement(Q, { variant: "secondary", size: "sm", onClick: E }, t(n, "p2pQr.copyConnectionInfo", "复制连接信息"))), /* @__PURE__ */ e.createElement("div", { className: "p2p-qr-divider" }), /* @__PURE__ */ e.createElement("div", { className: "p2p-qr-manual" }, /* @__PURE__ */ e.createElement("div", { className: "p2p-qr-manual-title" }, t(n, "p2pQr.manualInput", "手动输入")), /* @__PURE__ */ e.createElement("p", { className: "p2p-qr-manual-hint" }, t(
    n,
    "p2pQr.manualHint",
    "如果扫码失败，请在手机端手动输入以上 IP、端口和 Token"
  )))))), /* @__PURE__ */ e.createElement("div", { className: "modal-footer" }, /* @__PURE__ */ e.createElement(Q, { variant: "secondary", onClick: l }, t(n, "common.close", "关闭"))));
}
function ae({
  isOpen: i,
  onClose: s,
  title: l,
  message: p,
  okText: n,
  onConfirm: a,
  closeOnClickOutside: f = !0,
  closeOnEscape: u = !0
}) {
  const d = S(), b = () => {
    a();
  }, c = () => n || t(d, "common.ok", "确定");
  return /* @__PURE__ */ e.createElement(
    j,
    {
      isOpen: i,
      onClose: s,
      title: l,
      closeOnClickOutside: f,
      closeOnEscape: u
    },
    /* @__PURE__ */ e.createElement("div", { className: "modal-body" }, p),
    /* @__PURE__ */ e.createElement("div", { className: "modal-footer" }, /* @__PURE__ */ e.createElement(
      "button",
      {
        className: "modal-btn modal-btn-primary",
        onClick: b,
        autoFocus: !0
      },
      c()
    ))
  );
}
function oe({
  isOpen: i,
  onClose: s,
  title: l,
  message: p,
  okText: n,
  cancelText: a,
  danger: f = !1,
  onConfirm: u,
  onCancel: d,
  closeOnClickOutside: b = !0,
  closeOnEscape: c = !0
}) {
  const g = S(), m = () => {
    u();
  }, y = () => {
    d && d();
  }, E = () => n || t(g, "common.ok", "确定"), I = () => a || t(g, "common.cancel", "取消");
  return /* @__PURE__ */ e.createElement(
    j,
    {
      isOpen: i,
      onClose: s,
      title: l,
      closeOnClickOutside: b,
      closeOnEscape: c
    },
    /* @__PURE__ */ e.createElement("div", { className: "modal-body" }, p),
    /* @__PURE__ */ e.createElement("div", { className: "modal-footer" }, /* @__PURE__ */ e.createElement(
      "button",
      {
        className: "modal-btn modal-btn-secondary",
        onClick: y
      },
      I()
    ), /* @__PURE__ */ e.createElement(
      "button",
      {
        className: f ? "modal-btn modal-btn-danger" : "modal-btn modal-btn-primary",
        onClick: m,
        autoFocus: !0
      },
      E()
    ))
  );
}
function le({
  isOpen: i,
  onClose: s,
  title: l,
  message: p,
  defaultValue: n = "",
  placeholder: a = "",
  okText: f,
  cancelText: u,
  onConfirm: d,
  onCancel: b,
  closeOnClickOutside: c = !0,
  closeOnEscape: g = !0
}) {
  const [m, y] = C(n), E = D(null);
  R(() => {
    i && y(n);
  }, [i, n]), R(() => {
    if (i && E.current) {
      const v = setTimeout(() => {
        E.current?.focus(), E.current?.select();
      }, 100);
      return () => clearTimeout(v);
    }
  }, [i]);
  const I = () => {
    d(m);
  }, o = () => {
    b && b();
  }, h = (v) => {
    v.key === "Enter" && I();
  }, N = S(), r = () => f || t(N, "common.ok", "确定"), x = () => u || t(N, "common.cancel", "取消");
  return /* @__PURE__ */ e.createElement(
    j,
    {
      isOpen: i,
      onClose: s,
      title: l,
      closeOnClickOutside: c,
      closeOnEscape: g
    },
    /* @__PURE__ */ e.createElement("div", { className: "modal-body" }, p, /* @__PURE__ */ e.createElement(
      "input",
      {
        ref: E,
        type: "text",
        className: "modal-input",
        value: m,
        onChange: (v) => y(v.target.value),
        onKeyDown: h,
        placeholder: a
      }
    )),
    /* @__PURE__ */ e.createElement("div", { className: "modal-footer" }, /* @__PURE__ */ e.createElement(
      "button",
      {
        className: "modal-btn modal-btn-secondary",
        onClick: o
      },
      x()
    ), /* @__PURE__ */ e.createElement(
      "button",
      {
        className: "modal-btn modal-btn-primary",
        onClick: I
      },
      r()
    ))
  );
}
const ve = z(function(s, l) {
  const [p, n] = C({
    isOpen: !1,
    config: null,
    resolve: null
  }), a = S(), f = D(p);
  R(() => {
    f.current = p;
  }, [p]);
  const u = q((o) => new Promise((h) => {
    n({
      isOpen: !0,
      config: o,
      resolve: h
    });
  }), []), d = q(() => {
    n((o) => (o.resolve && o.config && (o.config.type === "prompt" ? o.resolve(null) : o.config.type === "confirm" ? o.resolve(!1) : o.resolve(!0)), {
      isOpen: !1,
      config: null,
      resolve: null
    }));
  }, []), b = q((o) => {
    n((h) => (h.resolve && (h.config?.type === "prompt" ? h.resolve(o || "") : h.resolve(!0)), {
      isOpen: !1,
      config: null,
      resolve: null
    }));
  }, []), c = q(() => {
    n((o) => (o.resolve && (o.config?.type === "prompt" ? o.resolve(null) : o.resolve(!1)), {
      isOpen: !1,
      config: null,
      resolve: null
    }));
  }, []), g = q((o) => {
    switch (o) {
      case "alert":
        return t(a, "common.alert", "提示");
      case "confirm":
        return t(a, "common.confirm", "确认");
      case "prompt":
        return t(a, "common.input", "输入");
      default:
        return "提示";
    }
  }, [a]), m = q(
    (o, h = null) => u({
      type: "alert",
      message: o,
      title: h !== null ? h : g("alert")
    }),
    [u, g]
  ), y = q(
    (o, h = null, N = {}) => u({
      type: "confirm",
      message: o,
      title: h !== null ? h : g("confirm"),
      okText: N.okText,
      cancelText: N.cancelText,
      danger: N.danger || !1
    }),
    [u, g]
  ), E = q(
    (o, h = "", N = null) => u({
      type: "prompt",
      message: o,
      defaultValue: h,
      title: N !== null ? N : g("prompt")
    }),
    [u, g]
  );
  F(
    l,
    () => ({
      alert: m,
      confirm: y,
      prompt: E
    }),
    [m, y, E]
  ), R(() => () => {
    if (!f.current.isOpen) return;
    const { resolve: o, config: h } = f.current;
    o && h && (h.type === "prompt" ? o(null) : h.type === "confirm" ? o(!1) : o(!0)), f.current = {
      isOpen: !1,
      config: null,
      resolve: null
    };
  }, []);
  const I = () => {
    if (!p.config || !p.isOpen) return null;
    const { config: o } = p;
    switch (o.type) {
      case "alert":
        return /* @__PURE__ */ e.createElement(
          ae,
          {
            isOpen: p.isOpen,
            onClose: d,
            title: o.title || void 0,
            message: o.message,
            okText: o.okText,
            onConfirm: b
          }
        );
      case "confirm":
        return /* @__PURE__ */ e.createElement(
          oe,
          {
            isOpen: p.isOpen,
            onClose: d,
            title: o.title || void 0,
            message: o.message,
            okText: o.okText,
            cancelText: o.cancelText,
            danger: o.danger,
            onConfirm: b,
            onCancel: c
          }
        );
      case "prompt":
        return /* @__PURE__ */ e.createElement(
          le,
          {
            isOpen: p.isOpen,
            onClose: c,
            title: o.title || void 0,
            message: o.message,
            defaultValue: o.defaultValue,
            placeholder: o.placeholder,
            okText: o.okText,
            cancelText: o.cancelText,
            onConfirm: b,
            onCancel: c
          }
        );
      default:
        return null;
    }
  };
  return /* @__PURE__ */ e.createElement(e.Fragment, null, I());
});
function Ee({
  visible: i = !0,
  right: s = 460,
  bottom: l,
  top: p,
  isMobile: n,
  micEnabled: a,
  screenEnabled: f,
  goodbyeMode: u,
  openPanel: d,
  onOpenPanelChange: b,
  settings: c,
  onSettingsChange: g,
  agent: m,
  onAgentChange: y,
  onToggleMic: E,
  onToggleScreen: I,
  onGoodbye: o,
  onReturn: h,
  onSettingsMenuClick: N
}) {
  const r = S(), x = D(null), [v, w] = C(null), _ = D(null), A = 240, U = P(() => {
    const k = {
      right: s
    };
    return typeof p == "number" ? k.top = p : k.bottom = typeof l == "number" ? l : 320, k;
  }, [s, p, l]), L = q(
    (k) => {
      w(k), b(null), _.current && clearTimeout(_.current), _.current = setTimeout(() => {
        w((T) => T === k ? null : T), _.current = null;
      }, A);
    },
    [b]
  ), B = q(
    (k) => {
      if (d === k) {
        L(k);
        return;
      }
      d && L(d), b(k);
    },
    [b, d, L]
  );
  R(() => () => {
    _.current && (clearTimeout(_.current), _.current = null);
  }, []), R(() => {
    const k = (T) => {
      const M = x.current;
      if (!M || !d) return;
      const W = T.target;
      W && M.contains(W) || L(d);
    };
    return document.addEventListener("pointerdown", k), () => document.removeEventListener("pointerdown", k);
  }, [d, L]);
  const $ = P(
    () => [
      {
        id: "mic",
        title: t(r, "buttons.voiceControl", "语音控制"),
        hidden: !1,
        active: a,
        onClick: () => E(!a),
        icon: "/static/icons/mic_icon_off.png"
      },
      {
        id: "screen",
        title: t(r, "buttons.screenShare", "屏幕分享"),
        hidden: !1,
        active: f,
        onClick: () => I(!f),
        icon: "/static/icons/screen_icon_off.png"
      },
      {
        id: "agent",
        title: t(r, "buttons.agentTools", "Agent工具"),
        hidden: !!n,
        active: d === "agent",
        onClick: () => B("agent"),
        icon: "/static/icons/Agent_off.png",
        hasPanel: !0
      },
      {
        id: "settings",
        title: t(r, "buttons.settings", "设置"),
        hidden: !1,
        active: d === "settings",
        onClick: () => B("settings"),
        icon: "/static/icons/set_off.png",
        hasPanel: !0
      },
      {
        id: "goodbye",
        title: t(r, "buttons.leave", "请她离开"),
        hidden: !!n,
        active: u,
        onClick: o,
        icon: "/static/icons/rest_off.png",
        hasPanel: !1
      }
    ].filter((k) => !k.hidden),
    [u, n, a, o, E, I, d, f, r, B]
  ), O = P(
    () => [
      {
        id: "mergeMessages",
        label: t(r, "settings.toggles.mergeMessages", "合并消息"),
        checked: c.mergeMessages
      },
      {
        id: "allowInterrupt",
        label: t(r, "settings.toggles.allowInterrupt", "允许打断"),
        checked: c.allowInterrupt
      },
      {
        id: "proactiveChat",
        label: t(r, "settings.toggles.proactiveChat", "主动搭话"),
        checked: c.proactiveChat
      },
      {
        id: "proactiveVision",
        label: t(r, "settings.toggles.proactiveVision", "自主视觉"),
        checked: c.proactiveVision
      }
    ],
    [c, r]
  ), J = P(
    () => [
      {
        id: "master",
        label: t(r, "settings.toggles.agentMaster", "Agent总开关"),
        checked: m.master,
        disabled: !!m.disabled.master
      },
      {
        id: "keyboard",
        label: t(r, "settings.toggles.keyboardControl", "键鼠控制"),
        checked: m.keyboard,
        disabled: !!m.disabled.keyboard
      },
      {
        id: "mcp",
        label: t(r, "settings.toggles.mcpTools", "MCP工具"),
        checked: m.mcp,
        disabled: !!m.disabled.mcp
      },
      {
        id: "userPlugin",
        label: t(r, "settings.toggles.userPlugin", "用户插件"),
        checked: m.userPlugin,
        disabled: !!m.disabled.userPlugin
      }
    ],
    [m, r]
  );
  return i ? /* @__PURE__ */ e.createElement("div", { ref: x, className: "live2d-right-toolbar", style: U }, u ? /* @__PURE__ */ e.createElement(
    "button",
    {
      type: "button",
      className: "live2d-right-toolbar__button live2d-right-toolbar__return",
      title: t(r, "buttons.return", "请她回来"),
      onClick: h
    },
    /* @__PURE__ */ e.createElement("img", { className: "live2d-right-toolbar__icon", src: "/static/icons/rest_off.png", alt: "return" })
  ) : $.map((k) => /* @__PURE__ */ e.createElement("div", { key: k.id, className: "live2d-right-toolbar__item" }, /* @__PURE__ */ e.createElement(
    "button",
    {
      type: "button",
      className: "live2d-right-toolbar__button",
      title: k.title,
      "data-active": k.active ? "true" : "false",
      onClick: k.onClick
    },
    /* @__PURE__ */ e.createElement("img", { className: "live2d-right-toolbar__icon", src: k.icon, alt: k.id })
  ), k.id === "settings" && (d === "settings" || v === "settings") && /* @__PURE__ */ e.createElement(
    "div",
    {
      key: `settings-panel-${d === "settings" ? "open" : "closing"}`,
      className: `live2d-right-toolbar__panel live2d-right-toolbar__panel--settings${v === "settings" && d !== "settings" ? " live2d-right-toolbar__panel--exit" : ""}`,
      role: "menu"
    },
    O.map((T) => /* @__PURE__ */ e.createElement("label", { key: T.id, className: "live2d-right-toolbar__row", "data-disabled": "false" }, /* @__PURE__ */ e.createElement(
      "input",
      {
        type: "checkbox",
        className: "live2d-right-toolbar__checkbox",
        checked: T.checked,
        onChange: (M) => g(T.id, M.target.checked)
      }
    ), /* @__PURE__ */ e.createElement("span", { className: "live2d-right-toolbar__indicator", "aria-hidden": "true" }, /* @__PURE__ */ e.createElement("span", { className: "live2d-right-toolbar__checkmark" }, "✓")), /* @__PURE__ */ e.createElement("span", { className: "live2d-right-toolbar__label" }, T.label))),
    !n && /* @__PURE__ */ e.createElement(e.Fragment, null, /* @__PURE__ */ e.createElement("div", { className: "live2d-right-toolbar__separator" }), /* @__PURE__ */ e.createElement(
      "button",
      {
        type: "button",
        className: "live2d-right-toolbar__menuItem",
        onClick: () => N?.("live2dSettings")
      },
      /* @__PURE__ */ e.createElement("span", { className: "live2d-right-toolbar__menuItemContent" }, /* @__PURE__ */ e.createElement(
        "img",
        {
          className: "live2d-right-toolbar__menuIcon",
          src: "/static/icons/live2d_settings_icon.png",
          alt: t(r, "settings.menu.live2dSettings", "Live2D设置")
        }
      ), t(r, "settings.menu.live2dSettings", "Live2D设置"))
    ), /* @__PURE__ */ e.createElement(
      "button",
      {
        type: "button",
        className: "live2d-right-toolbar__menuItem",
        onClick: () => N?.("apiKeys")
      },
      /* @__PURE__ */ e.createElement("span", { className: "live2d-right-toolbar__menuItemContent" }, /* @__PURE__ */ e.createElement(
        "img",
        {
          className: "live2d-right-toolbar__menuIcon",
          src: "/static/icons/api_key_icon.png",
          alt: t(r, "settings.menu.apiKeys", "API密钥")
        }
      ), t(r, "settings.menu.apiKeys", "API密钥"))
    ), /* @__PURE__ */ e.createElement(
      "button",
      {
        type: "button",
        className: "live2d-right-toolbar__menuItem",
        onClick: () => N?.("characterManage")
      },
      /* @__PURE__ */ e.createElement("span", { className: "live2d-right-toolbar__menuItemContent" }, /* @__PURE__ */ e.createElement(
        "img",
        {
          className: "live2d-right-toolbar__menuIcon",
          src: "/static/icons/character_icon.png",
          alt: t(r, "settings.menu.characterManage", "角色管理")
        }
      ), t(r, "settings.menu.characterManage", "角色管理"))
    ), /* @__PURE__ */ e.createElement(
      "button",
      {
        type: "button",
        className: "live2d-right-toolbar__menuItem",
        onClick: () => N?.("voiceClone")
      },
      /* @__PURE__ */ e.createElement("span", { className: "live2d-right-toolbar__menuItemContent" }, /* @__PURE__ */ e.createElement(
        "img",
        {
          className: "live2d-right-toolbar__menuIcon",
          src: "/static/icons/voice_clone_icon.png",
          alt: t(r, "settings.menu.voiceClone", "声音克隆")
        }
      ), t(r, "settings.menu.voiceClone", "声音克隆"))
    ), /* @__PURE__ */ e.createElement(
      "button",
      {
        type: "button",
        className: "live2d-right-toolbar__menuItem",
        onClick: () => N?.("memoryBrowser")
      },
      /* @__PURE__ */ e.createElement("span", { className: "live2d-right-toolbar__menuItemContent" }, /* @__PURE__ */ e.createElement(
        "img",
        {
          className: "live2d-right-toolbar__menuIcon",
          src: "/static/icons/memory_icon.png",
          alt: t(r, "settings.menu.memoryBrowser", "记忆浏览")
        }
      ), t(r, "settings.menu.memoryBrowser", "记忆浏览"))
    ), /* @__PURE__ */ e.createElement(
      "button",
      {
        type: "button",
        className: "live2d-right-toolbar__menuItem",
        onClick: () => N?.("steamWorkshop")
      },
      /* @__PURE__ */ e.createElement("span", { className: "live2d-right-toolbar__menuItemContent" }, /* @__PURE__ */ e.createElement(
        "img",
        {
          className: "live2d-right-toolbar__menuIcon",
          src: "/static/icons/Steam_icon_logo.png",
          alt: t(r, "settings.menu.steamWorkshop", "创意工坊")
        }
      ), t(r, "settings.menu.steamWorkshop", "创意工坊"))
    ), /* @__PURE__ */ e.createElement(
      "button",
      {
        type: "button",
        className: "live2d-right-toolbar__menuItem",
        onClick: () => N?.("p2pConnection")
      },
      /* @__PURE__ */ e.createElement("span", { className: "live2d-right-toolbar__menuItemContent" }, /* @__PURE__ */ e.createElement(
        "svg",
        {
          className: "live2d-right-toolbar__menuIcon",
          viewBox: "0 0 24 24",
          fill: "none",
          stroke: "currentColor",
          strokeWidth: "2",
          strokeLinecap: "round",
          strokeLinejoin: "round",
          style: { width: 20, height: 20, color: "#4b5563" }
        },
        /* @__PURE__ */ e.createElement("rect", { x: "2", y: "2", width: "20", height: "8", rx: "2", ry: "2" }),
        /* @__PURE__ */ e.createElement("rect", { x: "2", y: "14", width: "20", height: "8", rx: "2", ry: "2" }),
        /* @__PURE__ */ e.createElement("line", { x1: "6", y1: "6", x2: "6.01", y2: "6" }),
        /* @__PURE__ */ e.createElement("line", { x1: "6", y1: "18", x2: "6.01", y2: "18" })
      ), t(r, "settings.menu.p2pConnection", "P2P连接"))
    ))
  ), k.id === "agent" && (d === "agent" || v === "agent") && /* @__PURE__ */ e.createElement(
    "div",
    {
      key: `agent-panel-${d === "agent" ? "open" : "closing"}`,
      className: `live2d-right-toolbar__panel live2d-right-toolbar__panel--agent${v === "agent" && d !== "agent" ? " live2d-right-toolbar__panel--exit" : ""}`,
      role: "menu"
    },
    /* @__PURE__ */ e.createElement("div", { id: "live2d-agent-status", className: "live2d-right-toolbar__status" }, m.statusText),
    J.map((T) => /* @__PURE__ */ e.createElement(
      "label",
      {
        key: T.id,
        className: "live2d-right-toolbar__row",
        "data-disabled": T.disabled ? "true" : "false",
        title: T.disabled ? t(r, "settings.toggles.checking", "查询中...") : void 0
      },
      /* @__PURE__ */ e.createElement(
        "input",
        {
          type: "checkbox",
          className: "live2d-right-toolbar__checkbox",
          checked: T.checked,
          disabled: T.disabled,
          onChange: (M) => y(T.id, M.target.checked)
        }
      ),
      /* @__PURE__ */ e.createElement("span", { className: "live2d-right-toolbar__indicator", "aria-hidden": "true" }, /* @__PURE__ */ e.createElement("span", { className: "live2d-right-toolbar__checkmark" }, "✓")),
      /* @__PURE__ */ e.createElement("span", { className: "live2d-right-toolbar__label" }, T.label)
    ))
  )))) : null;
}
function ce({
  src: i,
  alt: s,
  fallback: l
}) {
  const [p, n] = e.useState(!1);
  return e.useEffect(() => {
    n(!1);
  }, [i]), p ? /* @__PURE__ */ e.createElement("span", { style: { opacity: 0.6 } }, l) : /* @__PURE__ */ e.createElement(
    "img",
    {
      src: i,
      alt: s,
      style: {
        maxWidth: "100%",
        borderRadius: 8,
        display: "block"
      },
      onError: () => n(!0)
    }
  );
}
function se({ messages: i }) {
  const s = S();
  return /* @__PURE__ */ e.createElement(
    "div",
    {
      style: {
        padding: 12,
        display: "flex",
        flexDirection: "column",
        gap: 12
      }
    },
    i.map((l) => /* @__PURE__ */ e.createElement(
      "div",
      {
        key: l.id,
        style: {
          alignSelf: l.role === "user" ? "flex-end" : "flex-start",
          maxWidth: "80%",
          background: l.role === "user" ? "rgba(68, 183, 254, 0.15)" : "rgba(0, 0, 0, 0.05)",
          borderRadius: 8,
          padding: 8,
          wordBreak: "break-word"
        }
      },
      l.image ? /* @__PURE__ */ e.createElement("div", null, /* @__PURE__ */ e.createElement(
        ce,
        {
          src: l.image,
          alt: t(
            s,
            "chat.message.screenshot",
            "截图"
          ),
          fallback: t(
            s,
            "chat.message.imageError",
            "图片加载失败"
          )
        }
      ), l.content && /* @__PURE__ */ e.createElement("div", { style: { marginTop: 8 } }, l.content)) : l.content ? l.content : /* @__PURE__ */ e.createElement("span", { style: { opacity: 0.5 } }, t(s, "chat.message.empty", "空消息"))
    ))
  );
}
function ie() {
  return typeof navigator > "u" ? !1 : /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
    navigator.userAgent
  );
}
const V = 5;
function ue({
  onSend: i,
  onTakePhoto: s,
  pendingScreenshots: l,
  setPendingScreenshots: p,
  disabled: n = !1
}) {
  const a = S(), [f, u] = C("");
  async function d() {
    !f.trim() && (!l || l.length === 0) || (i(f), u(""));
  }
  async function b() {
    if (l && l.length >= V) {
      console.warn(
        t(
          a,
          "chat.screenshot.maxReached",
          `最多只能添加 ${V} 张截图`
        )
      );
      return;
    }
    await s?.();
  }
  return /* @__PURE__ */ e.createElement(
    "div",
    {
      style: {
        padding: 12,
        background: "rgba(255, 255, 255, 0.5)",
        borderTop: "1px solid rgba(0, 0, 0, 0.06)",
        display: "flex",
        flexDirection: "column",
        gap: 8
      }
    },
    l && l.length > 0 && /* @__PURE__ */ e.createElement("div", null, /* @__PURE__ */ e.createElement(
      "div",
      {
        style: {
          display: "flex",
          justifyContent: "space-between",
          fontSize: 12,
          color: "#44b7fe",
          marginBottom: 4
        }
      },
      /* @__PURE__ */ e.createElement("span", null, t(
        a,
        "chat.screenshot.pending",
        `📸 待发送截图 (${l.length})`
      )),
      /* @__PURE__ */ e.createElement(
        "button",
        {
          onClick: () => p?.([]),
          "aria-label": t(a, "chat.screenshot.clearAll", "清除全部截图"),
          style: {
            background: "#ff4d4f",
            color: "#fff",
            border: "none",
            borderRadius: 4,
            padding: "2px 6px",
            cursor: "pointer"
          }
        },
        t(a, "chat.screenshot.clearAll", "清除全部")
      )
    ), /* @__PURE__ */ e.createElement("div", { style: { display: "flex", gap: 8 } }, l.map((c) => /* @__PURE__ */ e.createElement("div", { key: c.id, style: { position: "relative" } }, /* @__PURE__ */ e.createElement(
      "img",
      {
        src: c.base64,
        alt: t(a, "chat.screenshot.preview", "截图预览"),
        style: {
          width: 60,
          height: 60,
          objectFit: "cover",
          borderRadius: 6
        }
      }
    ), /* @__PURE__ */ e.createElement(
      "button",
      {
        onClick: () => p?.(
          (g) => g.filter((m) => m.id !== c.id)
        ),
        "aria-label": t(a, "chat.screenshot.remove", "删除截图"),
        style: {
          position: "absolute",
          top: -6,
          right: -6,
          width: 16,
          height: 16,
          borderRadius: "50%",
          border: "none",
          background: "#ff4d4f",
          color: "#fff",
          cursor: "pointer",
          fontSize: 10,
          lineHeight: "16px"
        }
      },
      "×"
    ))))),
    /* @__PURE__ */ e.createElement(
      "div",
      {
        style: {
          display: "flex",
          alignItems: "stretch",
          // ⭐关键：左右同高
          gap: 8
        }
      },
      /* @__PURE__ */ e.createElement(
        "textarea",
        {
          value: f,
          onChange: (c) => u(c.target.value),
          disabled: n,
          "aria-label": t(a, "chat.input.label", "聊天输入框"),
          placeholder: t(
            a,
            "chat.input.placeholder",
            "Text chat mode...Press Enter to send, Shift+Enter for new line"
          ),
          style: {
            flex: 1,
            resize: "none",
            border: "1px solid rgba(0,0,0,0.1)",
            borderRadius: 6,
            padding: "10px 12px",
            background: n ? "rgba(240,240,240,0.8)" : "rgba(255,255,255,0.8)",
            fontFamily: "inherit",
            fontSize: "0.9rem",
            lineHeight: "1.4",
            height: "100%",
            // ⭐关键
            boxSizing: "border-box",
            // ⭐关键
            opacity: n ? 0.6 : 1,
            cursor: n ? "not-allowed" : "text"
          },
          onKeyDown: (c) => {
            c.key === "Enter" && !c.shiftKey && !n && (c.preventDefault(), d());
          }
        }
      ),
      /* @__PURE__ */ e.createElement(
        "div",
        {
          style: {
            display: "flex",
            flexDirection: "column",
            gap: 8,
            minHeight: "4.5rem"
            // 更响应式
          }
        },
        /* @__PURE__ */ e.createElement(
          "button",
          {
            onClick: d,
            disabled: n,
            style: {
              flex: 1,
              // ⭐均分高度
              background: n ? "#a0d4f7" : "#44b7fe",
              color: "white",
              border: "none",
              borderRadius: 6,
              cursor: n ? "not-allowed" : "pointer",
              fontSize: "0.9rem",
              opacity: n ? 0.6 : 1
            }
          },
          t(a, "chat.send", "发送")
        ),
        s && /* @__PURE__ */ e.createElement(
          "button",
          {
            onClick: b,
            disabled: n,
            style: {
              flex: 1,
              // ⭐均分高度
              background: n ? "rgba(240,240,240,0.8)" : "rgba(255,255,255,0.8)",
              border: "1px solid #44b7fe",
              color: "#44b7fe",
              borderRadius: 6,
              cursor: n ? "not-allowed" : "pointer",
              fontSize: "0.8rem",
              opacity: n ? 0.6 : 1
            }
          },
          ie() ? t(a, "chat.screenshot.buttonMobile", "拍照") : t(a, "chat.screenshot.button", "截图")
        )
      )
    )
  );
}
function me() {
  return typeof navigator > "u" ? !1 : /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
    navigator.userAgent
  );
}
function H() {
  return typeof crypto < "u" && "randomUUID" in crypto ? crypto.randomUUID() : "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (i) => {
    const s = Math.random() * 16 | 0;
    return (i === "x" ? s : s & 3 | 8).toString(16);
  });
}
function ye({
  externalMessages: i,
  onSendMessage: s,
  connectionStatus: l = "idle",
  disabled: p = !1,
  statusText: n
}) {
  const a = S(), [f, u] = C(!1), [d, b] = C([
    {
      id: "sys-1",
      role: "system",
      content: t(
        a,
        "chat.welcome",
        "欢迎来到 React 聊天系统（迁移 Demo）"
      ),
      createdAt: Date.now()
    }
  ]), c = P(() => {
    const r = [...d, ...i || []];
    return r.sort((x, v) => x.createdAt - v.createdAt), r;
  }, [d, i]), [g, m] = C([]);
  function y(r) {
    if (!r.trim() && g.length === 0) return;
    const x = [], v = [];
    let w = Date.now();
    g.forEach((_) => {
      x.push(_.base64), s || v.push({
        id: H(),
        role: "user",
        image: _.base64,
        createdAt: w++
      });
    }), r.trim() && !s && v.push({
      id: H(),
      role: "user",
      content: r,
      createdAt: w
    }), s && s(r.trim(), x.length > 0 ? x : void 0), v.length > 0 && b((_) => [..._, ...v]), m([]);
  }
  const E = q(async () => {
    const r = [
      {
        label: "rear",
        constraints: { video: { facingMode: { ideal: "environment" } } }
      },
      { label: "front", constraints: { video: { facingMode: "user" } } },
      { label: "any", constraints: { video: !0 } }
    ];
    for (const x of r)
      try {
        return await navigator.mediaDevices.getUserMedia(x.constraints);
      } catch {
      }
    throw new Error(
      t(a, "chat.cannot_get_camera", "Unable to access camera")
    );
  }, [a]), I = q(
    (r, x = 0.8) => {
      const v = document.createElement("canvas"), w = v.getContext("2d");
      if (!w) return null;
      let _ = r.videoWidth, A = r.videoHeight;
      const U = 1280, L = 720;
      if (_ > U || A > L) {
        const B = U / _, $ = L / A, O = Math.min(B, $);
        _ = Math.floor(_ * O), A = Math.floor(A * O);
      }
      return v.width = _, v.height = A, w.drawImage(r, 0, 0, _, A), v.toDataURL("image/jpeg", x);
    },
    []
  );
  async function o() {
    const r = me();
    if (r) {
      if (!navigator.mediaDevices?.getUserMedia) {
        alert(
          t(a, "chat.screenshot.unsupported", "您的浏览器不支持拍照")
        );
        return;
      }
    } else if (!navigator.mediaDevices?.getDisplayMedia) {
      alert(
        t(a, "chat.screenshot.unsupported", "您的浏览器不支持截图")
      );
      return;
    }
    let x = null;
    const v = document.createElement("video");
    try {
      r ? x = await E() : x = await navigator.mediaDevices.getDisplayMedia({
        video: { cursor: "always" },
        audio: !1
      }), v.srcObject = x, v.playsInline = !0, v.muted = !0, await v.play(), await new Promise((_) => {
        v.videoWidth > 0 && v.videoHeight > 0 ? _() : v.onloadedmetadata = () => _();
      });
      const w = I(v);
      if (!w) {
        alert(t(a, "chat.screenshot.failed", "截图失败"));
        return;
      }
      m((_) => [..._, { id: H(), base64: w }]);
    } catch (w) {
      if (w?.name === "NotAllowedError" || w?.name === "AbortError")
        return;
      console.error("[ChatContainer] Screenshot error:", w), alert(
        t(
          a,
          "chat.screenshot.failed",
          r ? "拍照失败" : "截图失败"
        )
      );
    } finally {
      x && x.getTracks().forEach((w) => w.stop()), v.srcObject = null;
    }
  }
  function h() {
    switch (l) {
      case "open":
        return "#52c41a";
      // green
      case "connecting":
      case "reconnecting":
      case "closing":
        return "#faad14";
      // yellow
      case "closed":
        return "#ff4d4f";
      // red
      default:
        return "#d9d9d9";
    }
  }
  function N() {
    if (n) return n;
    switch (l) {
      case "open":
        return t(a, "chat.status.connected", "已连接");
      case "connecting":
        return t(a, "chat.status.connecting", "连接中...");
      case "reconnecting":
        return t(a, "chat.status.reconnecting", "重连中...");
      case "closing":
        return t(a, "chat.status.closing", "断开中...");
      case "closed":
        return t(a, "chat.status.disconnected", "已断开");
      default:
        return t(a, "chat.status.idle", "待连接");
    }
  }
  return f ? /* @__PURE__ */ e.createElement(
    "button",
    {
      type: "button",
      onClick: () => u(!1),
      "aria-label": t(a, "chat.expand", "打开聊天"),
      style: {
        position: "fixed",
        left: 16,
        bottom: 16,
        width: 56,
        height: 56,
        borderRadius: "50%",
        background: "#44b7fe",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        cursor: "pointer",
        boxShadow: "0 8px 24px rgba(68,183,254,0.5)",
        zIndex: 9999,
        border: "none",
        padding: 0
      }
    },
    /* @__PURE__ */ e.createElement("span", { style: { color: "#fff", fontSize: 22 } }, "💬")
  ) : /* @__PURE__ */ e.createElement(
    "div",
    {
      style: {
        display: "flex",
        flexDirection: "column",
        width: "100%",
        maxWidth: 400,
        height: 450,
        margin: "0 auto",
        background: "rgba(255, 255, 255, 0.65)",
        backdropFilter: "saturate(180%) blur(20px)",
        WebkitBackdropFilter: "saturate(180%) blur(20px)",
        borderRadius: 12,
        border: "1px solid rgba(255, 255, 255, 0.18)",
        boxShadow: "0 4px 12px rgba(0,0,0,0.08), 0 16px 32px rgba(0,0,0,0.12)",
        overflow: "hidden"
      }
    },
    /* @__PURE__ */ e.createElement(
      "div",
      {
        style: {
          height: 48,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 12px 0 16px",
          borderBottom: "1px solid rgba(0,0,0,0.06)",
          background: "rgba(255,255,255,0.5)",
          flexShrink: 0
        }
      },
      /* @__PURE__ */ e.createElement("div", { style: { display: "flex", alignItems: "center", gap: 8 } }, /* @__PURE__ */ e.createElement("span", { style: { fontWeight: 600 } }, t(a, "chat.title", "💬 Chat")), s && /* @__PURE__ */ e.createElement(
        "div",
        {
          style: {
            display: "flex",
            alignItems: "center",
            gap: 4,
            fontSize: 12,
            color: "#666"
          }
        },
        /* @__PURE__ */ e.createElement(
          "span",
          {
            style: {
              width: 8,
              height: 8,
              borderRadius: "50%",
              background: h(),
              display: "inline-block"
            }
          }
        ),
        /* @__PURE__ */ e.createElement("span", null, N())
      )),
      /* @__PURE__ */ e.createElement(
        "button",
        {
          type: "button",
          onClick: () => u(!0),
          "aria-label": t(a, "chat.minimize", "最小化聊天"),
          style: {
            width: 28,
            height: 28,
            borderRadius: "50%",
            border: "none",
            background: "#e6f4ff",
            color: "#44b7fe",
            cursor: "pointer",
            fontSize: 16,
            lineHeight: "28px"
          }
        },
        "—"
      )
    ),
    /* @__PURE__ */ e.createElement("div", { style: { flex: 1, overflowY: "auto" } }, /* @__PURE__ */ e.createElement(se, { messages: c })),
    /* @__PURE__ */ e.createElement(
      ue,
      {
        onSend: y,
        onTakePhoto: o,
        pendingScreenshots: g,
        setPendingScreenshots: m,
        disabled: p
      }
    )
  );
}
export {
  ae as AlertDialog,
  j as BaseModal,
  Q as Button,
  ye as ChatContainer,
  ue as ChatInput,
  oe as ConfirmDialog,
  ge as I18nProvider,
  Ee as Live2DRightToolbar,
  se as MessageList,
  ve as Modal,
  be as P2pQrMessageBox,
  le as PromptDialog,
  he as QrMessageBox,
  fe as StatusToast,
  t as tOrDefault,
  S as useT
};
