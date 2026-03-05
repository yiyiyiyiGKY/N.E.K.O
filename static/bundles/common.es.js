function l(...o) {
}
class h {
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
  on(t, e) {
    const s = this.listeners.get(t) || /* @__PURE__ */ new Set();
    return s.add(e), this.listeners.set(t, s), () => {
      const r = this.listeners.get(t);
      r && (r.delete(e), r.size === 0 && this.listeners.delete(t));
    };
  }
  /**
   * 发射事件
   * 
   * @param event - 事件名
   * @param payload - 事件 payload
   */
  emit(t, e) {
    const s = this.listeners.get(t);
    if (s)
      for (const r of s)
        try {
          r(e);
        } catch (n) {
          const i = this.onError;
          if (i)
            i(n, r, e);
          else {
            const c = typeof r == "function" && r.name ? String(r.name) : "<anonymous>";
            console.error(`[TinyEmitter] 事件处理器抛错 (event="${String(t)}", handler="${c}")`, {
              error: n,
              handler: r,
              payload: e
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
export {
  h as TinyEmitter,
  l as noop
};
