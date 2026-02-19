import e, { forwardRef as z, useState as D, useEffect as R, useRef as S, useCallback as I, useImperativeHandle as F, createContext as Y, useContext as J, useMemo as O } from "react";
import { createPortal as K } from "react-dom";
function Z({
  variant: s = "primary",
  size: i = "md",
  loading: l = !1,
  icon: d,
  iconRight: a,
  fullWidth: n = !1,
  disabled: g,
  className: f = "",
  label: u,
  children: v,
  ...m
}) {
  const h = g || l, c = v ?? u, k = [
    "btn",
    `btn-${s}`,
    `btn-${i}`,
    n && "btn-full-width",
    l && "btn-loading",
    f
  ].filter(Boolean).join(" ");
  return /* @__PURE__ */ e.createElement(
    "button",
    {
      className: k,
      disabled: h,
      ...m
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
    d && !l && /* @__PURE__ */ e.createElement("span", { className: "btn-icon-left" }, d),
    c && /* @__PURE__ */ e.createElement("span", { className: "btn-content" }, c),
    a && !l && /* @__PURE__ */ e.createElement("span", { className: "btn-icon-right" }, a)
  );
}
const ee = { BASE_URL: "/", DEV: !1, MODE: "production", PROD: !0, SSR: !1 }, Q = (s) => s ? s.replace(/\/+$/, "") : "", te = () => {
  try {
    const s = ee ?? {}, i = typeof window < "u" ? window : {};
    return Q(
      i.STATIC_SERVER_URL || i.API_BASE_URL || s.VITE_STATIC_SERVER_URL || s.VITE_API_BASE_URL || ""
    ) || "";
  } catch {
    return "";
  }
}, fe = z(function({ staticBaseUrl: i }, l) {
  const [d, a] = D({
    message: "",
    duration: 3e3,
    isVisible: !1
  });
  R(() => {
    if (typeof document > "u") return;
    const c = Q(i || te());
    if (!c) return;
    const k = `${c}/static/icons/toast_background.png`;
    document.documentElement.style.setProperty("--toast-background-url", `url('${k}')`);
  }, [i]);
  const n = S(null), g = S(null), f = S(null), u = S(!1);
  R(() => {
    if (typeof document > "u") return;
    let c = document.getElementById("status-toast-container");
    return c || (c = document.createElement("div"), c.id = "status-toast-container", document.body.appendChild(c), u.current = !0), f.current = c, () => {
      u.current && f.current?.parentNode && f.current.parentNode.removeChild(f.current), f.current = null, u.current = !1;
    };
  }, []);
  const v = I((c, k = 3e3) => {
    if (n.current && (clearTimeout(n.current), n.current = null), g.current && (clearTimeout(g.current), g.current = null), !c || c.trim() === "") {
      a((y) => ({ ...y, isVisible: !1 })), g.current = setTimeout(() => {
        a((y) => ({ ...y, message: "" }));
      }, 300);
      return;
    }
    a({
      message: c,
      duration: k,
      isVisible: !0
    }), n.current = setTimeout(() => {
      a((y) => ({ ...y, isVisible: !1 })), g.current = setTimeout(() => {
        a((y) => ({ ...y, message: "" }));
      }, 300);
    }, k);
  }, []);
  F(
    l,
    () => ({
      show: v
    }),
    [v]
  ), R(() => () => {
    n.current && clearTimeout(n.current), g.current && clearTimeout(g.current);
  }, []), R(() => {
    const c = document.getElementById("status");
    c && (c.textContent = d.message || "");
  }, [d.message]);
  const m = d.message ? d.isVisible ? "show" : "hide" : "", h = /* @__PURE__ */ e.createElement(
    "div",
    {
      id: "status-toast",
      className: m,
      "aria-live": "polite"
    },
    d.message
  );
  return f.current ? K(h, f.current) : h;
}), X = Y(null);
function ge({ t: s, children: i }) {
  return /* @__PURE__ */ e.createElement(X.Provider, { value: s }, i);
}
function ne() {
  try {
    const i = (typeof window < "u" ? window : void 0)?.t;
    return typeof i == "function" ? i : null;
  } catch {
    return null;
  }
}
function A() {
  const s = J(X);
  if (s) return s;
  const i = ne();
  return i || ((l) => l);
}
function t(s, i, l, d) {
  try {
    const a = s(i, d);
    return !a || a === i ? l : a;
  } catch {
    return l;
  }
}
function j({
  isOpen: s,
  onClose: i,
  title: l,
  children: d,
  closeOnClickOutside: a = !0,
  closeOnEscape: n = !0
}) {
  const g = S(null), f = S(null), u = S(null);
  R(() => {
    if (!s || !n) return;
    const m = (h) => {
      h.key === "Escape" && i();
    };
    return u.current = m, document.addEventListener("keydown", m), () => {
      u.current && (document.removeEventListener("keydown", u.current), u.current = null);
    };
  }, [s, n, i]);
  const v = (m) => {
    a && m.target === g.current && i();
  };
  return R(() => {
    if (s && f.current) {
      const m = setTimeout(() => {
        const h = f.current?.querySelector("input"), c = f.current?.querySelector("button");
        h ? (h.focus(), h instanceof HTMLInputElement && h.select()) : c && c.focus();
      }, 100);
      return () => clearTimeout(m);
    }
  }, [s]), s ? K(
    /* @__PURE__ */ e.createElement(
      "div",
      {
        ref: g,
        className: "modal-overlay",
        onClick: v,
        role: "dialog",
        "aria-modal": "true",
        "aria-labelledby": l ? "modal-title" : void 0
      },
      /* @__PURE__ */ e.createElement("div", { ref: f, className: "modal-dialog" }, l && /* @__PURE__ */ e.createElement("div", { className: "modal-header" }, /* @__PURE__ */ e.createElement("h3", { id: "modal-title", className: "modal-title" }, l)), d)
    ),
    document.body
  ) : null;
}
function he({
  apiBase: s,
  isOpen: i,
  onClose: l,
  title: d,
  endpoint: a = "/getipqrcode"
}) {
  const n = A(), [g, f] = D(null), [u, v] = D(null), [m, h] = D(!1), [c, k] = D(null), y = S(null);
  R(() => {
    if (!i) {
      if (h(!1), k(null), v(null), y.current) {
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
    let p = null;
    return (async () => {
      h(!0), k(null), v(null);
      try {
        const r = await fetch(`${s}${a}`, {
          method: "GET",
          signal: o.signal,
          headers: {
            Accept: "image/*,application/json"
          }
        });
        if ((r.headers.get("content-type") || "").includes("application/json")) {
          const w = await r.json(), E = typeof w?.message == "string" && w.message || typeof w?.error == "string" && w.error || t(n, "webapp.qrDrawer.unknownError", "未知錯誤");
          throw new Error(E);
        }
        if (!r.ok)
          throw new Error(t(n, "webapp.qrDrawer.fetchError", `獲取失敗: ${r.status}`));
        const b = await r.blob();
        p = URL.createObjectURL(b), y.current = p, f(p), v(r.headers.get("X-Neko-Access-Url"));
        return;
      } catch (r) {
        if (o.signal.aborted) return;
        k(r?.message || t(n, "webapp.qrDrawer.unknownError", "未知錯誤"));
      } finally {
        o.signal.aborted || h(!1);
      }
    })(), () => {
      if (o.abort(), p) {
        try {
          URL.revokeObjectURL(p);
        } catch {
        }
        y.current === p && (y.current = null);
      }
    };
  }, [s, a, i, n]);
  const T = d || t(n, "webapp.qrDrawer.title", "二维码");
  return /* @__PURE__ */ e.createElement(j, { isOpen: i, onClose: l, title: T }, /* @__PURE__ */ e.createElement("div", { className: "modal-body", "aria-live": "polite", "aria-atomic": "true" }, m && t(n, "webapp.qrDrawer.loading", "加载中…"), !m && c && /* @__PURE__ */ e.createElement("div", { className: "qr-error" }, t(n, "webapp.qrDrawer.error", "二维码加载失败"), /* @__PURE__ */ e.createElement("div", { className: "qr-error-detail" }, c)), !m && !c && !g && t(n, "webapp.qrDrawer.placeholder", "二维码区域（待接入）"), !m && !c && g && /* @__PURE__ */ e.createElement(e.Fragment, null, /* @__PURE__ */ e.createElement("img", { className: "qr-image", src: g, alt: T }), u && /* @__PURE__ */ e.createElement("div", { className: "qr-url" }, u))), /* @__PURE__ */ e.createElement("div", { className: "modal-footer" }, /* @__PURE__ */ e.createElement(Z, { variant: "secondary", onClick: l }, t(n, "common.close", "关闭"))));
}
function re({
  isOpen: s,
  onClose: i,
  title: l,
  message: d,
  okText: a,
  onConfirm: n,
  closeOnClickOutside: g = !0,
  closeOnEscape: f = !0
}) {
  const u = A(), v = () => {
    n();
  }, m = () => a || t(u, "common.ok", "确定");
  return /* @__PURE__ */ e.createElement(
    j,
    {
      isOpen: s,
      onClose: i,
      title: l,
      closeOnClickOutside: g,
      closeOnEscape: f
    },
    /* @__PURE__ */ e.createElement("div", { className: "modal-body" }, d),
    /* @__PURE__ */ e.createElement("div", { className: "modal-footer" }, /* @__PURE__ */ e.createElement(
      "button",
      {
        className: "modal-btn modal-btn-primary",
        onClick: v,
        autoFocus: !0
      },
      m()
    ))
  );
}
function ae({
  isOpen: s,
  onClose: i,
  title: l,
  message: d,
  okText: a,
  cancelText: n,
  danger: g = !1,
  onConfirm: f,
  onCancel: u,
  closeOnClickOutside: v = !0,
  closeOnEscape: m = !0
}) {
  const h = A(), c = () => {
    f();
  }, k = () => {
    u && u();
  }, y = () => a || t(h, "common.ok", "确定"), T = () => n || t(h, "common.cancel", "取消");
  return /* @__PURE__ */ e.createElement(
    j,
    {
      isOpen: s,
      onClose: i,
      title: l,
      closeOnClickOutside: v,
      closeOnEscape: m
    },
    /* @__PURE__ */ e.createElement("div", { className: "modal-body" }, d),
    /* @__PURE__ */ e.createElement("div", { className: "modal-footer" }, /* @__PURE__ */ e.createElement(
      "button",
      {
        className: "modal-btn modal-btn-secondary",
        onClick: k
      },
      T()
    ), /* @__PURE__ */ e.createElement(
      "button",
      {
        className: g ? "modal-btn modal-btn-danger" : "modal-btn modal-btn-primary",
        onClick: c,
        autoFocus: !0
      },
      y()
    ))
  );
}
function oe({
  isOpen: s,
  onClose: i,
  title: l,
  message: d,
  defaultValue: a = "",
  placeholder: n = "",
  okText: g,
  cancelText: f,
  onConfirm: u,
  onCancel: v,
  closeOnClickOutside: m = !0,
  closeOnEscape: h = !0
}) {
  const [c, k] = D(a), y = S(null);
  R(() => {
    s && k(a);
  }, [s, a]), R(() => {
    if (s && y.current) {
      const b = setTimeout(() => {
        y.current?.focus(), y.current?.select();
      }, 100);
      return () => clearTimeout(b);
    }
  }, [s]);
  const T = () => {
    u(c);
  }, o = () => {
    v && v();
  }, p = (b) => {
    b.key === "Enter" && T();
  }, C = A(), r = () => g || t(C, "common.ok", "确定"), x = () => f || t(C, "common.cancel", "取消");
  return /* @__PURE__ */ e.createElement(
    j,
    {
      isOpen: s,
      onClose: i,
      title: l,
      closeOnClickOutside: m,
      closeOnEscape: h
    },
    /* @__PURE__ */ e.createElement("div", { className: "modal-body" }, d, /* @__PURE__ */ e.createElement(
      "input",
      {
        ref: y,
        type: "text",
        className: "modal-input",
        value: c,
        onChange: (b) => k(b.target.value),
        onKeyDown: p,
        placeholder: n
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
        onClick: T
      },
      r()
    ))
  );
}
const be = z(function(i, l) {
  const [d, a] = D({
    isOpen: !1,
    config: null,
    resolve: null
  }), n = A(), g = S(d);
  R(() => {
    g.current = d;
  }, [d]);
  const f = I((o) => new Promise((p) => {
    a({
      isOpen: !0,
      config: o,
      resolve: p
    });
  }), []), u = I(() => {
    a((o) => (o.resolve && o.config && (o.config.type === "prompt" ? o.resolve(null) : o.config.type === "confirm" ? o.resolve(!1) : o.resolve(!0)), {
      isOpen: !1,
      config: null,
      resolve: null
    }));
  }, []), v = I((o) => {
    a((p) => (p.resolve && (p.config?.type === "prompt" ? p.resolve(o || "") : p.resolve(!0)), {
      isOpen: !1,
      config: null,
      resolve: null
    }));
  }, []), m = I(() => {
    a((o) => (o.resolve && (o.config?.type === "prompt" ? o.resolve(null) : o.resolve(!1)), {
      isOpen: !1,
      config: null,
      resolve: null
    }));
  }, []), h = I((o) => {
    switch (o) {
      case "alert":
        return t(n, "common.alert", "提示");
      case "confirm":
        return t(n, "common.confirm", "确认");
      case "prompt":
        return t(n, "common.input", "输入");
      default:
        return "提示";
    }
  }, [n]), c = I(
    (o, p = null) => f({
      type: "alert",
      message: o,
      title: p !== null ? p : h("alert")
    }),
    [f, h]
  ), k = I(
    (o, p = null, C = {}) => f({
      type: "confirm",
      message: o,
      title: p !== null ? p : h("confirm"),
      okText: C.okText,
      cancelText: C.cancelText,
      danger: C.danger || !1
    }),
    [f, h]
  ), y = I(
    (o, p = "", C = null) => f({
      type: "prompt",
      message: o,
      defaultValue: p,
      title: C !== null ? C : h("prompt")
    }),
    [f, h]
  );
  F(
    l,
    () => ({
      alert: c,
      confirm: k,
      prompt: y
    }),
    [c, k, y]
  ), R(() => () => {
    if (!g.current.isOpen) return;
    const { resolve: o, config: p } = g.current;
    o && p && (p.type === "prompt" ? o(null) : p.type === "confirm" ? o(!1) : o(!0)), g.current = {
      isOpen: !1,
      config: null,
      resolve: null
    };
  }, []);
  const T = () => {
    if (!d.config || !d.isOpen) return null;
    const { config: o } = d;
    switch (o.type) {
      case "alert":
        return /* @__PURE__ */ e.createElement(
          re,
          {
            isOpen: d.isOpen,
            onClose: u,
            title: o.title || void 0,
            message: o.message,
            okText: o.okText,
            onConfirm: v
          }
        );
      case "confirm":
        return /* @__PURE__ */ e.createElement(
          ae,
          {
            isOpen: d.isOpen,
            onClose: u,
            title: o.title || void 0,
            message: o.message,
            okText: o.okText,
            cancelText: o.cancelText,
            danger: o.danger,
            onConfirm: v,
            onCancel: m
          }
        );
      case "prompt":
        return /* @__PURE__ */ e.createElement(
          oe,
          {
            isOpen: d.isOpen,
            onClose: m,
            title: o.title || void 0,
            message: o.message,
            defaultValue: o.defaultValue,
            placeholder: o.placeholder,
            okText: o.okText,
            cancelText: o.cancelText,
            onConfirm: v,
            onCancel: m
          }
        );
      default:
        return null;
    }
  };
  return /* @__PURE__ */ e.createElement(e.Fragment, null, T());
});
function pe({
  visible: s = !0,
  right: i = 460,
  bottom: l,
  top: d,
  isMobile: a,
  micEnabled: n,
  screenEnabled: g,
  goodbyeMode: f,
  openPanel: u,
  onOpenPanelChange: v,
  settings: m,
  onSettingsChange: h,
  agent: c,
  onAgentChange: k,
  onToggleMic: y,
  onToggleScreen: T,
  onGoodbye: o,
  onReturn: p,
  onSettingsMenuClick: C
}) {
  const r = A(), x = S(null), [b, w] = D(null), E = S(null), B = 240, q = O(() => {
    const _ = {
      right: i
    };
    return typeof d == "number" ? _.top = d : _.bottom = typeof l == "number" ? l : 320, _;
  }, [i, d, l]), M = I(
    (_) => {
      w(_), v(null), E.current && clearTimeout(E.current), E.current = setTimeout(() => {
        w((N) => N === _ ? null : N), E.current = null;
      }, B);
    },
    [v]
  ), U = I(
    (_) => {
      if (u === _) {
        M(_);
        return;
      }
      u && M(u), v(_);
    },
    [v, u, M]
  );
  R(() => () => {
    E.current && (clearTimeout(E.current), E.current = null);
  }, []), R(() => {
    const _ = (N) => {
      const L = x.current;
      if (!L || !u) return;
      const W = N.target;
      W && L.contains(W) || M(u);
    };
    return document.addEventListener("pointerdown", _), () => document.removeEventListener("pointerdown", _);
  }, [u, M]);
  const V = O(
    () => [
      {
        id: "mic",
        title: t(r, "buttons.voiceControl", "语音控制"),
        hidden: !1,
        active: n,
        onClick: () => y(!n),
        icon: "/static/icons/mic_icon_off.png"
      },
      {
        id: "screen",
        title: t(r, "buttons.screenShare", "屏幕分享"),
        hidden: !1,
        active: g,
        onClick: () => T(!g),
        icon: "/static/icons/screen_icon_off.png"
      },
      {
        id: "agent",
        title: t(r, "buttons.agentTools", "Agent工具"),
        hidden: !!a,
        active: u === "agent",
        onClick: () => U("agent"),
        icon: "/static/icons/Agent_off.png",
        hasPanel: !0
      },
      {
        id: "settings",
        title: t(r, "buttons.settings", "设置"),
        hidden: !1,
        active: u === "settings",
        onClick: () => U("settings"),
        icon: "/static/icons/set_off.png",
        hasPanel: !0
      },
      {
        id: "goodbye",
        title: t(r, "buttons.leave", "请她离开"),
        hidden: !!a,
        active: f,
        onClick: o,
        icon: "/static/icons/rest_off.png",
        hasPanel: !1
      }
    ].filter((_) => !_.hidden),
    [f, a, n, o, y, T, u, g, r, U]
  ), P = O(
    () => [
      {
        id: "mergeMessages",
        label: t(r, "settings.toggles.mergeMessages", "合并消息"),
        checked: m.mergeMessages
      },
      {
        id: "allowInterrupt",
        label: t(r, "settings.toggles.allowInterrupt", "允许打断"),
        checked: m.allowInterrupt
      },
      {
        id: "proactiveChat",
        label: t(r, "settings.toggles.proactiveChat", "主动搭话"),
        checked: m.proactiveChat
      },
      {
        id: "proactiveVision",
        label: t(r, "settings.toggles.proactiveVision", "自主视觉"),
        checked: m.proactiveVision
      }
    ],
    [m, r]
  ), G = O(
    () => [
      {
        id: "master",
        label: t(r, "settings.toggles.agentMaster", "Agent总开关"),
        checked: c.master,
        disabled: !!c.disabled.master
      },
      {
        id: "keyboard",
        label: t(r, "settings.toggles.keyboardControl", "键鼠控制"),
        checked: c.keyboard,
        disabled: !!c.disabled.keyboard
      },
      {
        id: "mcp",
        label: t(r, "settings.toggles.mcpTools", "MCP工具"),
        checked: c.mcp,
        disabled: !!c.disabled.mcp
      },
      {
        id: "userPlugin",
        label: t(r, "settings.toggles.userPlugin", "用户插件"),
        checked: c.userPlugin,
        disabled: !!c.disabled.userPlugin
      }
    ],
    [c, r]
  );
  return s ? /* @__PURE__ */ e.createElement("div", { ref: x, className: "live2d-right-toolbar", style: q }, f ? /* @__PURE__ */ e.createElement(
    "button",
    {
      type: "button",
      className: "live2d-right-toolbar__button live2d-right-toolbar__return",
      title: t(r, "buttons.return", "请她回来"),
      onClick: p
    },
    /* @__PURE__ */ e.createElement("img", { className: "live2d-right-toolbar__icon", src: "/static/icons/rest_off.png", alt: "return" })
  ) : V.map((_) => /* @__PURE__ */ e.createElement("div", { key: _.id, className: "live2d-right-toolbar__item" }, /* @__PURE__ */ e.createElement(
    "button",
    {
      type: "button",
      className: "live2d-right-toolbar__button",
      title: _.title,
      "data-active": _.active ? "true" : "false",
      onClick: _.onClick
    },
    /* @__PURE__ */ e.createElement("img", { className: "live2d-right-toolbar__icon", src: _.icon, alt: _.id })
  ), _.id === "settings" && (u === "settings" || b === "settings") && /* @__PURE__ */ e.createElement(
    "div",
    {
      key: `settings-panel-${u === "settings" ? "open" : "closing"}`,
      className: `live2d-right-toolbar__panel live2d-right-toolbar__panel--settings${b === "settings" && u !== "settings" ? " live2d-right-toolbar__panel--exit" : ""}`,
      role: "menu"
    },
    P.map((N) => /* @__PURE__ */ e.createElement("label", { key: N.id, className: "live2d-right-toolbar__row", "data-disabled": "false" }, /* @__PURE__ */ e.createElement(
      "input",
      {
        type: "checkbox",
        className: "live2d-right-toolbar__checkbox",
        checked: N.checked,
        onChange: (L) => h(N.id, L.target.checked)
      }
    ), /* @__PURE__ */ e.createElement("span", { className: "live2d-right-toolbar__indicator", "aria-hidden": "true" }, /* @__PURE__ */ e.createElement("span", { className: "live2d-right-toolbar__checkmark" }, "✓")), /* @__PURE__ */ e.createElement("span", { className: "live2d-right-toolbar__label" }, N.label))),
    !a && /* @__PURE__ */ e.createElement(e.Fragment, null, /* @__PURE__ */ e.createElement("div", { className: "live2d-right-toolbar__separator" }), /* @__PURE__ */ e.createElement(
      "button",
      {
        type: "button",
        className: "live2d-right-toolbar__menuItem",
        onClick: () => C?.("live2dSettings")
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
        onClick: () => C?.("apiKeys")
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
        onClick: () => C?.("characterManage")
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
        onClick: () => C?.("voiceClone")
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
        onClick: () => C?.("memoryBrowser")
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
        onClick: () => C?.("steamWorkshop")
      },
      /* @__PURE__ */ e.createElement("span", { className: "live2d-right-toolbar__menuItemContent" }, /* @__PURE__ */ e.createElement(
        "img",
        {
          className: "live2d-right-toolbar__menuIcon",
          src: "/static/icons/Steam_icon_logo.png",
          alt: t(r, "settings.menu.steamWorkshop", "创意工坊")
        }
      ), t(r, "settings.menu.steamWorkshop", "创意工坊"))
    ))
  ), _.id === "agent" && (u === "agent" || b === "agent") && /* @__PURE__ */ e.createElement(
    "div",
    {
      key: `agent-panel-${u === "agent" ? "open" : "closing"}`,
      className: `live2d-right-toolbar__panel live2d-right-toolbar__panel--agent${b === "agent" && u !== "agent" ? " live2d-right-toolbar__panel--exit" : ""}`,
      role: "menu"
    },
    /* @__PURE__ */ e.createElement("div", { id: "live2d-agent-status", className: "live2d-right-toolbar__status" }, c.statusText),
    G.map((N) => /* @__PURE__ */ e.createElement(
      "label",
      {
        key: N.id,
        className: "live2d-right-toolbar__row",
        "data-disabled": N.disabled ? "true" : "false",
        title: N.disabled ? t(r, "settings.toggles.checking", "查询中...") : void 0
      },
      /* @__PURE__ */ e.createElement(
        "input",
        {
          type: "checkbox",
          className: "live2d-right-toolbar__checkbox",
          checked: N.checked,
          disabled: N.disabled,
          onChange: (L) => k(N.id, L.target.checked)
        }
      ),
      /* @__PURE__ */ e.createElement("span", { className: "live2d-right-toolbar__indicator", "aria-hidden": "true" }, /* @__PURE__ */ e.createElement("span", { className: "live2d-right-toolbar__checkmark" }, "✓")),
      /* @__PURE__ */ e.createElement("span", { className: "live2d-right-toolbar__label" }, N.label)
    ))
  )))) : null;
}
function le({
  src: s,
  alt: i,
  fallback: l
}) {
  const [d, a] = e.useState(!1);
  return e.useEffect(() => {
    a(!1);
  }, [s]), d ? /* @__PURE__ */ e.createElement("span", { style: { opacity: 0.6 } }, l) : /* @__PURE__ */ e.createElement(
    "img",
    {
      src: s,
      alt: i,
      style: {
        maxWidth: "100%",
        borderRadius: 8,
        display: "block"
      },
      onError: () => a(!0)
    }
  );
}
function ie({ messages: s }) {
  const i = A();
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
    s.map((l) => /* @__PURE__ */ e.createElement(
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
        le,
        {
          src: l.image,
          alt: t(
            i,
            "chat.message.screenshot",
            "截图"
          ),
          fallback: t(
            i,
            "chat.message.imageError",
            "图片加载失败"
          )
        }
      ), l.content && /* @__PURE__ */ e.createElement("div", { style: { marginTop: 8 } }, l.content)) : l.content ? l.content : /* @__PURE__ */ e.createElement("span", { style: { opacity: 0.5 } }, t(i, "chat.message.empty", "空消息"))
    ))
  );
}
function se() {
  return typeof navigator > "u" ? !1 : /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
    navigator.userAgent
  );
}
const $ = 5;
function ce({
  onSend: s,
  onTakePhoto: i,
  pendingScreenshots: l,
  setPendingScreenshots: d,
  disabled: a = !1
}) {
  const n = A(), [g, f] = D("");
  async function u() {
    !g.trim() && (!l || l.length === 0) || (s(g), f(""));
  }
  async function v() {
    if (l && l.length >= $) {
      console.warn(
        t(
          n,
          "chat.screenshot.maxReached",
          `最多只能添加 ${$} 张截图`
        )
      );
      return;
    }
    await i?.();
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
        n,
        "chat.screenshot.pending",
        `📸 待发送截图 (${l.length})`
      )),
      /* @__PURE__ */ e.createElement(
        "button",
        {
          onClick: () => d?.([]),
          "aria-label": t(n, "chat.screenshot.clearAll", "清除全部截图"),
          style: {
            background: "#ff4d4f",
            color: "#fff",
            border: "none",
            borderRadius: 4,
            padding: "2px 6px",
            cursor: "pointer"
          }
        },
        t(n, "chat.screenshot.clearAll", "清除全部")
      )
    ), /* @__PURE__ */ e.createElement("div", { style: { display: "flex", gap: 8 } }, l.map((m) => /* @__PURE__ */ e.createElement("div", { key: m.id, style: { position: "relative" } }, /* @__PURE__ */ e.createElement(
      "img",
      {
        src: m.base64,
        alt: t(n, "chat.screenshot.preview", "截图预览"),
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
        onClick: () => d?.(
          (h) => h.filter((c) => c.id !== m.id)
        ),
        "aria-label": t(n, "chat.screenshot.remove", "删除截图"),
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
          value: g,
          onChange: (m) => f(m.target.value),
          disabled: a,
          "aria-label": t(n, "chat.input.label", "聊天输入框"),
          placeholder: t(
            n,
            "chat.input.placeholder",
            "Text chat mode...Press Enter to send, Shift+Enter for new line"
          ),
          style: {
            flex: 1,
            resize: "none",
            border: "1px solid rgba(0,0,0,0.1)",
            borderRadius: 6,
            padding: "10px 12px",
            background: a ? "rgba(240,240,240,0.8)" : "rgba(255,255,255,0.8)",
            fontFamily: "inherit",
            fontSize: "0.9rem",
            lineHeight: "1.4",
            height: "100%",
            // ⭐关键
            boxSizing: "border-box",
            // ⭐关键
            opacity: a ? 0.6 : 1,
            cursor: a ? "not-allowed" : "text"
          },
          onKeyDown: (m) => {
            m.key === "Enter" && !m.shiftKey && !a && (m.preventDefault(), u());
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
            onClick: u,
            disabled: a,
            style: {
              flex: 1,
              // ⭐均分高度
              background: a ? "#a0d4f7" : "#44b7fe",
              color: "white",
              border: "none",
              borderRadius: 6,
              cursor: a ? "not-allowed" : "pointer",
              fontSize: "0.9rem",
              opacity: a ? 0.6 : 1
            }
          },
          t(n, "chat.send", "发送")
        ),
        i && /* @__PURE__ */ e.createElement(
          "button",
          {
            onClick: v,
            disabled: a,
            style: {
              flex: 1,
              // ⭐均分高度
              background: a ? "rgba(240,240,240,0.8)" : "rgba(255,255,255,0.8)",
              border: "1px solid #44b7fe",
              color: "#44b7fe",
              borderRadius: 6,
              cursor: a ? "not-allowed" : "pointer",
              fontSize: "0.8rem",
              opacity: a ? 0.6 : 1
            }
          },
          se() ? t(n, "chat.screenshot.buttonMobile", "拍照") : t(n, "chat.screenshot.button", "截图")
        )
      )
    )
  );
}
function ue() {
  return typeof navigator > "u" ? !1 : /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
    navigator.userAgent
  );
}
function H() {
  return typeof crypto < "u" && "randomUUID" in crypto ? crypto.randomUUID() : "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (s) => {
    const i = Math.random() * 16 | 0;
    return (s === "x" ? i : i & 3 | 8).toString(16);
  });
}
function ve({
  externalMessages: s,
  onSendMessage: i,
  connectionStatus: l = "idle",
  disabled: d = !1,
  statusText: a
}) {
  const n = A(), [g, f] = D(!1), [u, v] = D([
    {
      id: "sys-1",
      role: "system",
      content: t(
        n,
        "chat.welcome",
        "欢迎来到 React 聊天系统（迁移 Demo）"
      ),
      createdAt: Date.now()
    }
  ]), m = O(() => {
    const r = [...u, ...s || []];
    return r.sort((x, b) => x.createdAt - b.createdAt), r;
  }, [u, s]), [h, c] = D([]);
  function k(r) {
    if (!r.trim() && h.length === 0) return;
    const x = [], b = [];
    let w = Date.now();
    h.forEach((E) => {
      x.push(E.base64), i || b.push({
        id: H(),
        role: "user",
        image: E.base64,
        createdAt: w++
      });
    }), r.trim() && !i && b.push({
      id: H(),
      role: "user",
      content: r,
      createdAt: w
    }), i && i(r.trim(), x.length > 0 ? x : void 0), b.length > 0 && v((E) => [...E, ...b]), c([]);
  }
  const y = I(async () => {
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
      t(n, "chat.cannot_get_camera", "Unable to access camera")
    );
  }, [n]), T = I(
    (r, x = 0.8) => {
      const b = document.createElement("canvas"), w = b.getContext("2d");
      if (!w) return null;
      let E = r.videoWidth, B = r.videoHeight;
      const q = 1280, M = 720;
      if (E > q || B > M) {
        const U = q / E, V = M / B, P = Math.min(U, V);
        E = Math.floor(E * P), B = Math.floor(B * P);
      }
      return b.width = E, b.height = B, w.drawImage(r, 0, 0, E, B), b.toDataURL("image/jpeg", x);
    },
    []
  );
  async function o() {
    const r = ue();
    if (r) {
      if (!navigator.mediaDevices?.getUserMedia) {
        alert(
          t(n, "chat.screenshot.unsupported", "您的浏览器不支持拍照")
        );
        return;
      }
    } else if (!navigator.mediaDevices?.getDisplayMedia) {
      alert(
        t(n, "chat.screenshot.unsupported", "您的浏览器不支持截图")
      );
      return;
    }
    let x = null;
    const b = document.createElement("video");
    try {
      r ? x = await y() : x = await navigator.mediaDevices.getDisplayMedia({
        video: { cursor: "always" },
        audio: !1
      }), b.srcObject = x, b.playsInline = !0, b.muted = !0, await b.play(), await new Promise((E) => {
        b.videoWidth > 0 && b.videoHeight > 0 ? E() : b.onloadedmetadata = () => E();
      });
      const w = T(b);
      if (!w) {
        alert(t(n, "chat.screenshot.failed", "截图失败"));
        return;
      }
      c((E) => [...E, { id: H(), base64: w }]);
    } catch (w) {
      if (w?.name === "NotAllowedError" || w?.name === "AbortError")
        return;
      console.error("[ChatContainer] Screenshot error:", w), alert(
        t(
          n,
          "chat.screenshot.failed",
          r ? "拍照失败" : "截图失败"
        )
      );
    } finally {
      x && x.getTracks().forEach((w) => w.stop()), b.srcObject = null;
    }
  }
  function p() {
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
  function C() {
    if (a) return a;
    switch (l) {
      case "open":
        return t(n, "chat.status.connected", "已连接");
      case "connecting":
        return t(n, "chat.status.connecting", "连接中...");
      case "reconnecting":
        return t(n, "chat.status.reconnecting", "重连中...");
      case "closing":
        return t(n, "chat.status.closing", "断开中...");
      case "closed":
        return t(n, "chat.status.disconnected", "已断开");
      default:
        return t(n, "chat.status.idle", "待连接");
    }
  }
  return g ? /* @__PURE__ */ e.createElement(
    "button",
    {
      type: "button",
      onClick: () => f(!1),
      "aria-label": t(n, "chat.expand", "打开聊天"),
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
        height: 520,
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
      /* @__PURE__ */ e.createElement("div", { style: { display: "flex", alignItems: "center", gap: 8 } }, /* @__PURE__ */ e.createElement("span", { style: { fontWeight: 600 } }, t(n, "chat.title", "💬 Chat")), i && /* @__PURE__ */ e.createElement(
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
              background: p(),
              display: "inline-block"
            }
          }
        ),
        /* @__PURE__ */ e.createElement("span", null, C())
      )),
      /* @__PURE__ */ e.createElement(
        "button",
        {
          type: "button",
          onClick: () => f(!0),
          "aria-label": t(n, "chat.minimize", "最小化聊天"),
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
    /* @__PURE__ */ e.createElement("div", { style: { flex: 1, overflowY: "auto" } }, /* @__PURE__ */ e.createElement(ie, { messages: m })),
    /* @__PURE__ */ e.createElement(
      ce,
      {
        onSend: k,
        onTakePhoto: o,
        pendingScreenshots: h,
        setPendingScreenshots: c,
        disabled: d
      }
    )
  );
}
export {
  re as AlertDialog,
  j as BaseModal,
  Z as Button,
  ve as ChatContainer,
  ce as ChatInput,
  ae as ConfirmDialog,
  ge as I18nProvider,
  pe as Live2DRightToolbar,
  ie as MessageList,
  be as Modal,
  oe as PromptDialog,
  he as QrMessageBox,
  fe as StatusToast,
  t as tOrDefault,
  A as useT
};
