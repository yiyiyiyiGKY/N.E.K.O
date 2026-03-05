class q {
  constructor(o) {
    this.listeners = /* @__PURE__ */ new Map(), this.onError = o?.onError;
  }
  /**
   * 订阅事件
   * 
   * @param event - 事件名
   * @param handler - 事件处理器
   * @returns 取消订阅函数
   */
  on(o, i) {
    const c = this.listeners.get(o) || /* @__PURE__ */ new Set();
    return c.add(i), this.listeners.set(o, c), () => {
      const l = this.listeners.get(o);
      l && (l.delete(i), l.size === 0 && this.listeners.delete(o));
    };
  }
  /**
   * 发射事件
   * 
   * @param event - 事件名
   * @param payload - 事件 payload
   */
  emit(o, i) {
    const c = this.listeners.get(o);
    if (c)
      for (const l of c)
        try {
          l(i);
        } catch (v) {
          const w = this.onError;
          if (w)
            w(v, l, i);
          else {
            const r = typeof l == "function" && l.name ? String(l.name) : "<anonymous>";
            console.error(`[TinyEmitter] 事件处理器抛错 (event="${String(o)}", handler="${r}")`, {
              error: v,
              handler: l,
              payload: i
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
function j(t, o, i) {
  return { code: t, message: o, cause: i };
}
function J(t, o) {
  if (typeof t != "number" || !Number.isFinite(t))
    throw new TypeError(`[live2d-service] ${o} 必须是有限数值，收到: ${String(t)}`);
}
function K(t, o) {
  const i = new q({ onError: o?.onEventHandlerError });
  let c = { status: "idle" };
  const l = (r) => {
    const n = c;
    c = r, i.emit("stateChanged", { prev: n, next: r });
  }, v = (r, n) => {
    if (r === "error") {
      const P = n;
      l({ status: "error", model: c.model, error: P });
    }
    i.emit(r, n);
  };
  try {
    t.setEventSink?.(v);
  } catch {
  }
  const w = {
    getState: () => c,
    on: (r, n) => i.on(r, n),
    async loadModel(r, n) {
      if (!r || typeof r != "object" || typeof r.uri != "string") {
        const P = j("INVALID_MODEL_REF", "model 必须是包含 uri: string 的对象");
        throw l({ status: "error", error: P }), i.emit("error", P), new TypeError(P.message);
      }
      l({ status: "loading", model: r });
      try {
        await t.loadModel(r, n), l({ status: "ready", model: r }), i.emit("modelLoaded", { model: r });
      } catch (P) {
        const g = j("MODEL_LOAD_FAILED", `加载模型失败: ${r.uri}`, P);
        throw l({ status: "error", model: r, error: g }), i.emit("error", g), P;
      }
    },
    async unloadModel() {
      const r = c.model;
      try {
        await t.unloadModel?.();
      } finally {
        l({ status: "idle" }), i.emit("modelUnloaded", { prevModel: r });
      }
    },
    async playMotion(r) {
      if (!t.playMotion)
        throw new Error("[live2d-service] 当前 adapter 不支持 playMotion()");
      if (!r || typeof r != "object" || typeof r.group != "string")
        throw new TypeError("[live2d-service] motion 必须是包含 group: string 的对象");
      return await t.playMotion(r);
    },
    async setExpression(r) {
      if (!t.setExpression)
        throw new Error("[live2d-service] 当前 adapter 不支持 setExpression()");
      if (!r || typeof r != "object" || typeof r.id != "string")
        throw new TypeError("[live2d-service] expression 必须是包含 id: string 的对象");
      return await t.setExpression(r);
    },
    setMouthValue(r) {
      if (!t.setMouthValue)
        throw new Error("[live2d-service] 当前 adapter 不支持 setMouthValue()");
      J(r, "mouthValue"), t.setMouthValue(Math.max(0, Math.min(1, r)));
    },
    async setTransform(r) {
      if (!t.setTransform)
        throw new Error("[live2d-service] 当前 adapter 不支持 setTransform()");
      if (!r || typeof r != "object")
        throw new TypeError("[live2d-service] transform 必须是对象");
      return await t.setTransform(r);
    },
    getViewProps() {
      try {
        return t.getViewProps?.() ?? {};
      } catch {
        return {};
      }
    },
    async dispose() {
      try {
        await w.unloadModel();
      } catch {
      }
      try {
        await t.dispose?.();
      } catch {
      }
    }
  };
  return w;
}
function Q(t) {
  return Number.isFinite(t) ? Math.max(0, Math.min(1, t)) : 0;
}
function k(t) {
  if (!t || t.length === 0) return null;
  const o = Math.floor(Math.random() * t.length);
  return t[o] ?? null;
}
function oe(t, o) {
  const i = K(t, { onEventHandlerError: o?.onEventHandlerError });
  let c = !1, l = { drag: !0, wheelZoom: !0, pinchZoom: !0, tap: !0 }, v = null, w = 0, r = "additive", n = null, P = null;
  const g = () => t.getRuntime?.() ?? null, I = () => {
    const a = g()?.parameters;
    a?.installOverrideLayer && a.installOverrideLayer(() => ({
      mouthValue: w,
      mode: r,
      savedParameters: n,
      persistentParameters: P
    }));
  }, O = () => g()?.getTransformSnapshot?.() ?? null, E = async (e) => {
    if (!o?.preferences) return null;
    try {
      return await o.preferences.load(e);
    } catch {
      return null;
    }
  }, F = async () => {
    if (!o?.preferences || !v) return;
    const e = O(), a = {
      modelUri: v,
      position: e ? { x: e.position.x, y: e.position.y } : void 0,
      scale: e ? { x: e.scale.x, y: e.scale.y } : void 0
    };
    await o.preferences.save(a);
  }, m = async (e) => {
    const d = g()?.parameters;
    if (!d?.setParameterValueById)
      throw new Error("[live2d-service] 当前 adapter 不支持参数写入（parameters runtime 未实现）");
    for (const [y, p] of Object.entries(e || {}))
      typeof y == "string" && (typeof p != "number" || !Number.isFinite(p) || d.setParameterValueById(y, p, 1));
  }, f = {
    service: i,
    getRuntime: g,
    getState: () => i.getState(),
    on: (e, a) => i.on(e, a),
    async loadModel(e, a) {
      v = e;
      const d = a?.preferences ?? await E(e), y = {};
      if (d?.position || d?.scale)
        try {
          await i.loadModel({ uri: e, source: "url" }, y);
          const p = d?.position, N = d?.scale;
          (p || N) && await i.setTransform({
            position: p ? { x: p.x, y: p.y } : void 0,
            scale: N ? { x: N.x, y: N.y } : void 0
          });
        } catch (p) {
          throw p;
        }
      else
        await i.loadModel({ uri: e, source: "url" }, y);
      try {
        I();
      } catch {
      }
      if (d?.parameters)
        try {
          await m(d.parameters);
        } catch {
        }
    },
    unloadModel: () => i.unloadModel(),
    getTransformSnapshot: O,
    setTransform: (e) => i.setTransform(e),
    resetModelPosition: async () => {
      await i.setTransform({ position: { x: 0, y: 0 }, scale: { x: 1, y: 1 } });
    },
    savePreferences: F,
    loadPreferences: E,
    playMotion: (e) => i.playMotion(e),
    setExpression: (e) => i.setExpression(e),
    setEmotion: async (e) => {
      const a = v;
      if (!a) return;
      const d = o?.emotionMappingProvider;
      if (!d) {
        await i.setExpression({ id: e }), await i.playMotion({ group: e });
        return;
      }
      const y = await d.getEmotionMapping(a), p = y?.expressions?.[e] ?? [], N = y?.motions?.[e] ?? [], M = k(p);
      M && await i.setExpression({ id: M });
      const x = k(N);
      if (x) {
        await i.playMotion({ group: x });
        return;
      }
      await i.playMotion({ group: e });
    },
    clearExpression: async () => {
    },
    clearEmotionEffects: async () => {
    },
    setMouth(e) {
      w = Q(e), i.setMouthValue(w);
      try {
        I();
      } catch {
      }
    },
    applyModelParameters: m,
    async setSavedModelParameters(e) {
      n = e ? { ...e } : null;
      try {
        I();
      } catch {
      }
    },
    async setPersistentParameters(e) {
      P = e ? { ...e } : null;
      try {
        I();
      } catch {
      }
    },
    setParameterOverrideMode(e) {
      r = e;
      try {
        I();
      } catch {
      }
    },
    setLocked(e) {
      c = !!e;
    },
    setInteractionOptions(e) {
      l = { ...l, ...e || {} };
    },
    async snapToScreen() {
      return !1;
    },
    async dispose() {
      await i.dispose(), v = null;
    }
  };
  return f._locked = () => c, f._interaction = () => l, f;
}
function H(t, o) {
  const i = document.getElementById(t);
  if (!i) throw new Error(`[live2d-service:web] 找不到 ${o} 元素: #${t}`);
  return i;
}
function ee(t) {
  return typeof t == "string" ? H(t, "canvas") : t;
}
function te(t) {
  return typeof t == "string" ? H(t, "container") : t;
}
function re() {
  try {
    return globalThis.PIXI;
  } catch {
    return;
  }
}
function $() {
  try {
    return typeof window > "u" ? !1 : window.matchMedia?.("(max-width: 768px)")?.matches ?? window.innerWidth <= 768;
  } catch {
    return !1;
  }
}
function X(t) {
  return Number.isFinite(t) ? Math.max(0, Math.min(1, t)) : 0;
}
const R = ["ParamMouthOpenY", "ParamMouthForm", "ParamMouthOpen", "ParamA", "ParamI", "ParamU", "ParamE", "ParamO"], z = ["ParamOpacity", "ParamVisibility"];
function Y(t, o) {
  !t || !t.scale || (typeof o == "number" ? t.scale.set(o) : t.scale.set(o.x, o.y));
}
function _(t, o) {
  t && (Number.isFinite(o.x) && (t.x = o.x), Number.isFinite(o.y) && (t.y = o.y));
}
function D(t) {
  return t?.internalModel?.coreModel ?? null;
}
function U(t, o) {
  const i = Number(t?.clientWidth) || o.w, c = Number(t?.clientHeight) || o.h;
  return { w: i, h: c };
}
function ne(t, o) {
  try {
    const i = t?.renderer;
    if (!i || typeof i.resize != "function") return;
    const { w: c, h: l } = U(o, { w: Number(i.width) || 0, h: Number(i.height) || 0 });
    c > 0 && l > 0 && i.resize(c, l);
  } catch {
  }
}
function ie(t, o, i) {
  if (!(!t || !o))
    try {
      const c = o.renderer, l = Number(c?.width) || 0, v = Number(c?.height) || 0, { w, h: r } = U(i, { w: l || 360, h: v || 520 });
      let n = 0;
      try {
        const O = Number(t.width) || 0, E = Number(t.height) || 0;
        O > 0 && E > 0 && (n = Math.min(w / O, r / E) * 0.9);
      } catch {
      }
      let P = 0.25;
      try {
        const O = typeof window < "u" ? window.innerWidth : w, E = typeof window < "u" ? window.innerHeight : r;
        $() ? P = Math.min(0.5, E * 1.3 / 4e3, O * 1.2 / 2e3) : P = Math.min(0.5, E * 0.75 / 7e3, O * 0.6 / 7e3);
      } catch {
      }
      const g = n > 0 ? n : P, I = Math.max(1e-4, Math.min(0.5, g || 0.25));
      Y(t, I), $() ? _(t, { x: (Number(c?.width) || w) * 0.5, y: (Number(c?.height) || r) * 0.28 }) : _(t, { x: Number(c?.width) || w, y: Number(c?.height) || r });
    } catch {
    }
}
function ae(t, o) {
  if (!t) return;
  const i = ["ParamMouthOpenY", "ParamO"];
  for (const c of i)
    try {
      const l = t.getParameterIndex(c);
      l >= 0 && (typeof t.setParameterValueById == "function" ? t.setParameterValueById(c, o, 1) : typeof t.setParameterValueByIndex == "function" && t.setParameterValueByIndex(l, o));
    } catch {
    }
}
function se(t) {
  const o = {
    motions: !0,
    expressions: !0,
    mouth: !0,
    transform: !0,
    // parameters: 通过 runtime 提供 best-effort 的参数读写能力（用于对齐 legacy Live2DManager）
    parameters: !0
  }, i = ee(t.canvas), c = te(t.container), l = t.PIXI ?? re();
  if (!l)
    throw new Error(
      "[live2d-service:web] PIXI 未提供。请通过 options.PIXI 注入，或确保页面已加载并暴露 window.PIXI。"
    );
  const v = t.Live2DModel ?? l?.live2d?.Live2DModel;
  if (!v || typeof v.from != "function")
    throw new Error(
      "[live2d-service:web] Live2DModel 未找到。请注入 options.Live2DModel，或确保 PIXI.live2d.Live2DModel 可用。"
    );
  let w = null, r = null, n = null, P = 0, g = null, I = null;
  const O = () => {
    if (r) return r;
    const m = { ...t.appOptions ?? {} };
    return "transparent" in m && delete m.transparent, r = new l.Application({
      view: i,
      resizeTo: c,
      autoStart: !0,
      ...m ?? {},
      // 显式覆盖：确保透明背景（alpha=0）
      backgroundAlpha: 0
    }), r;
  }, E = () => {
    if (!(!r || !n)) {
      try {
        r.stage?.removeChild?.(n);
      } catch {
      }
      try {
        n.destroy?.({ children: !0 });
      } catch {
      }
      n = null;
    }
  }, F = {
    platform: "web",
    capabilities: o,
    setEventSink(m) {
      w = m;
    },
    getRuntime() {
      return {
        getTransformSnapshot() {
          if (!n) return null;
          const s = Number(n.scale?.x), u = Number(n.scale?.y);
          return {
            position: { x: Number(n.x) || 0, y: Number(n.y) || 0 },
            scale: {
              x: Number.isFinite(s) ? s : 1,
              y: Number.isFinite(u) ? u : 1
            }
          };
        },
        async setTransform(s) {
          return await F.setTransform?.(s);
        },
        getBounds() {
          if (!n) return null;
          try {
            const s = n.getBounds?.();
            if (!s) return null;
            const u = Number(s.left) || 0, f = Number(s.top) || 0, e = Number(s.right) || 0, a = Number(s.bottom) || 0;
            return {
              left: u,
              top: f,
              right: e,
              bottom: a,
              width: Number(s.width) || Math.max(0, e - u),
              height: Number(s.height) || Math.max(0, a - f)
            };
          } catch {
            return null;
          }
        },
        parameters: {
          setParameterValueById(s, u, f) {
            if (!n) return;
            const e = D(n);
            if (!e) return;
            const a = Number(u);
            if (!Number.isFinite(a)) return;
            const d = typeof f == "number" && Number.isFinite(f) ? f : 1;
            try {
              if (typeof e.setParameterValueById == "function") {
                e.setParameterValueById(s, a, d);
                return;
              }
            } catch {
            }
            try {
              if (typeof e.getParameterIndex == "function" && typeof e.setParameterValueByIndex == "function") {
                const y = e.getParameterIndex(s);
                typeof y == "number" && y >= 0 && e.setParameterValueByIndex(y, a);
              }
            } catch {
            }
          },
          getParameterValueById(s) {
            if (!n) return null;
            const u = D(n);
            if (!u) return null;
            try {
              if (typeof u.getParameterIndex == "function" && typeof u.getParameterValueByIndex == "function") {
                const f = u.getParameterIndex(s);
                if (typeof f == "number" && f >= 0) {
                  const e = u.getParameterValueByIndex(f);
                  return typeof e == "number" && Number.isFinite(e) ? e : null;
                }
              }
            } catch {
            }
            return null;
          },
          getParameterDefaultValueById(s) {
            if (!n) return null;
            const u = D(n);
            if (!u) return null;
            try {
              if (typeof u.getParameterIndex == "function" && typeof u.getParameterDefaultValueByIndex == "function") {
                const f = u.getParameterIndex(s);
                if (typeof f == "number" && f >= 0) {
                  const e = u.getParameterDefaultValueByIndex(f);
                  return typeof e == "number" && Number.isFinite(e) ? e : null;
                }
              }
            } catch {
            }
            return null;
          },
          getParameterCount() {
            if (!n) return null;
            const s = D(n);
            if (!s) return null;
            try {
              if (typeof s.getParameterCount == "function") {
                const u = s.getParameterCount();
                return typeof u == "number" && Number.isFinite(u) ? u : null;
              }
            } catch {
            }
            return null;
          },
          getParameterIds() {
            if (!n) return [];
            const s = D(n);
            if (!s) return [];
            try {
              const u = typeof s.getParameterCount == "function" ? s.getParameterCount() : 0;
              if (typeof u != "number" || !Number.isFinite(u) || u <= 0) return [];
              const f = [];
              for (let e = 0; e < u; e++) {
                try {
                  if (typeof s.getParameterId == "function") {
                    const a = s.getParameterId(e);
                    if (typeof a == "string" && a) {
                      f.push(a);
                      continue;
                    }
                  }
                } catch {
                }
                f.push(`param_${e}`);
              }
              return f;
            } catch {
              return [];
            }
          },
          installOverrideLayer(s) {
            try {
              g?.();
            } catch {
            }
            g = null, I = s;
            const u = (e) => {
              const a = I?.();
              if (!a) return;
              const d = a.mode || "off", y = a.savedParameters || null;
              if (y && (d === "override" || d === "additive")) {
                const M = a.persistentParameters || null, x = new Set(Object.keys(M || {}));
                for (const [h, L] of Object.entries(y)) {
                  if (!h || R.includes(h) || z.includes(h) || x.has(h)) continue;
                  const B = Number(L);
                  if (Number.isFinite(B)) {
                    try {
                      if (typeof e.setParameterValueById == "function") {
                        if (d === "override")
                          e.setParameterValueById(h, B, 1);
                        else {
                          const b = e.getParameterIndex?.(h);
                          if (typeof b == "number" && b >= 0 && typeof e.getParameterDefaultValueByIndex == "function") {
                            const V = typeof e.getParameterValueByIndex == "function" ? e.getParameterValueByIndex(b) : 0, A = e.getParameterDefaultValueByIndex(b), S = Number(B) - Number(A || 0);
                            e.setParameterValueById(h, Number(V || 0) + S, 1);
                          } else
                            e.setParameterValueById(h, B, 1);
                        }
                        continue;
                      }
                    } catch {
                    }
                    try {
                      if (typeof e.getParameterIndex == "function" && typeof e.setParameterValueByIndex == "function") {
                        const b = e.getParameterIndex(h);
                        if (typeof b == "number" && b >= 0)
                          if (d === "override")
                            e.setParameterValueByIndex(b, B);
                          else {
                            const V = typeof e.getParameterValueByIndex == "function" ? e.getParameterValueByIndex(b) : 0, A = typeof e.getParameterDefaultValueByIndex == "function" ? e.getParameterDefaultValueByIndex(b) : 0, S = Number(B) - Number(A || 0);
                            e.setParameterValueByIndex(b, Number(V || 0) + S);
                          }
                      }
                    } catch {
                    }
                  }
                }
              }
              const p = X(Number(a.mouthValue));
              for (const M of ["ParamMouthOpenY", "ParamO"])
                try {
                  if (typeof e.setParameterValueById == "function")
                    e.setParameterValueById(M, p, 1);
                  else if (typeof e.getParameterIndex == "function" && typeof e.setParameterValueByIndex == "function") {
                    const x = e.getParameterIndex(M);
                    typeof x == "number" && x >= 0 && e.setParameterValueByIndex(x, p);
                  }
                } catch {
                }
              const N = a.persistentParameters || null;
              if (N)
                for (const [M, x] of Object.entries(N)) {
                  if (!M || R.includes(M)) continue;
                  const h = Number(x);
                  if (Number.isFinite(h))
                    try {
                      if (typeof e.setParameterValueById == "function")
                        e.setParameterValueById(M, h, 1);
                      else if (typeof e.getParameterIndex == "function" && typeof e.setParameterValueByIndex == "function") {
                        const L = e.getParameterIndex(M);
                        typeof L == "number" && L >= 0 && e.setParameterValueByIndex(L, h);
                      }
                    } catch {
                    }
                }
            };
            (() => {
              if (!n) return;
              const e = n?.internalModel, a = e?.coreModel, d = e?.motionManager;
              if (!a) return;
              const y = typeof d?.update == "function" ? d.update.bind(d) : null, p = typeof a.update == "function" ? a.update.bind(a) : null;
              y && d && (d.update = (...N) => {
                const M = {};
                try {
                  const x = I?.(), h = x?.savedParameters || null, L = x?.mode || "off";
                  if (h && L === "additive" && typeof a.getParameterIndex == "function" && typeof a.getParameterValueByIndex == "function")
                    for (const B of Object.keys(h)) {
                      if (!B) continue;
                      const b = a.getParameterIndex(B);
                      if (typeof b == "number" && b >= 0) {
                        const V = a.getParameterValueByIndex(b);
                        typeof V == "number" && Number.isFinite(V) && (M[B] = V);
                      }
                    }
                } catch {
                }
                try {
                  y(...N);
                } catch {
                }
                try {
                  const x = I?.(), h = x?.mode || "off";
                  if (h === "additive") {
                    const L = x?.savedParameters || null, B = x?.persistentParameters || null, b = new Set(Object.keys(B || {}));
                    if (L && typeof a.getParameterIndex == "function" && typeof a.getParameterValueByIndex == "function")
                      for (const [V, A] of Object.entries(L)) {
                        if (!V || R.includes(V) || z.includes(V) || b.has(V)) continue;
                        const S = Number(A);
                        if (!Number.isFinite(S)) continue;
                        const T = a.getParameterIndex(V);
                        if (typeof T != "number" || T < 0) continue;
                        const C = a.getParameterValueByIndex(T), W = M[V] ?? C, G = typeof a.getParameterDefaultValueByIndex == "function" ? a.getParameterDefaultValueByIndex(T) : 0, Z = S - Number(G || 0);
                        Math.abs(Number(C) - Number(W)) > 1e-3 ? a.setParameterValueByIndex(T, Number(C || 0) + Z) : a.setParameterValueByIndex(T, S);
                      }
                  }
                  u(a);
                } catch {
                }
              }), p && (a.update = (...N) => {
                try {
                  u(a);
                } catch {
                }
                try {
                  return p(...N);
                } catch {
                  return;
                }
              }), g = () => {
                try {
                  y && d && (d.update = y);
                } catch {
                }
                try {
                  p && (a.update = p);
                } catch {
                }
              };
            })();
          },
          uninstallOverrideLayer() {
            try {
              g?.();
            } finally {
              g = null, I = null;
            }
          }
        }
      };
    },
    async loadModel(m) {
      const s = O();
      if (ne(s, c), E(), n = await v.from(m.uri, {
        autoFocus: !1,
        ...t.modelOptions ?? {}
      }), t.defaultAnchor && n?.anchor?.set)
        try {
          n.anchor.set(t.defaultAnchor.x, t.defaultAnchor.y);
        } catch {
        }
      try {
        n.interactive = !0, n.on?.("pointertap", (f) => {
          const e = f?.data?.global;
          e && w?.("tap", { x: Number(e.x) || 0, y: Number(e.y) || 0 });
        });
      } catch {
      }
      s.stage.addChild(n), ie(n, s, c);
      try {
        F.getRuntime?.()?.parameters?.installOverrideLayer?.(I);
      } catch {
      }
    },
    async unloadModel() {
      E();
    },
    async playMotion(m) {
      if (!n) throw new Error("[live2d-service:web] playMotion: 模型未加载");
      if (!n.motion) throw new Error("[live2d-service:web] playMotion: 当前 Live2DModel 不支持 motion()");
      const s = m.group, u = typeof m.index == "number" ? m.index : void 0, f = typeof m.priority == "number" ? m.priority : void 0;
      try {
        u !== void 0 && f !== void 0 ? await n.motion(s, u, f) : u !== void 0 ? await n.motion(s, u) : await n.motion(s);
      } catch (e) {
        throw e;
      }
    },
    async setExpression(m) {
      if (!n) throw new Error("[live2d-service:web] setExpression: 模型未加载");
      if (!n.expression) throw new Error("[live2d-service:web] setExpression: 当前 Live2DModel 不支持 expression()");
      await n.expression(m.id);
    },
    setMouthValue(m) {
      if (P = X(m), !n) return;
      const s = D(n);
      ae(s, P);
    },
    async setTransform(m) {
      if (!n) throw new Error("[live2d-service:web] setTransform: 模型未加载");
      m.position && _(n, m.position), m.scale !== void 0 && Y(n, m.scale);
    },
    dispose() {
      try {
        g?.();
      } catch {
      }
      if (g = null, I = null, E(), r) {
        try {
          r.destroy?.(!0, { children: !0 });
        } catch {
        }
        r = null;
      }
      w = null;
    }
  };
  return F;
}
export {
  oe as createLive2DManager,
  K as createLive2DService,
  se as createPixiLive2DAdapter
};
