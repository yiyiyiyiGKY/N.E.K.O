function Vn(e, n) {
  return function() {
    return e.apply(n, arguments);
  };
}
const { toString: xs } = Object.prototype, { getPrototypeOf: qt } = Object, { iterator: dt, toStringTag: Xn } = Symbol, ht = /* @__PURE__ */ ((e) => (n) => {
  const s = xs.call(n);
  return e[s] || (e[s] = s.slice(8, -1).toLowerCase());
})(/* @__PURE__ */ Object.create(null)), ie = (e) => (e = e.toLowerCase(), (n) => ht(n) === e), pt = (e) => (n) => typeof n === e, { isArray: Ne } = Array, Pe = pt("undefined");
function qe(e) {
  return e !== null && !Pe(e) && e.constructor !== null && !Pe(e.constructor) && Y(e.constructor.isBuffer) && e.constructor.isBuffer(e);
}
const Qn = ie("ArrayBuffer");
function Ps(e) {
  let n;
  return typeof ArrayBuffer < "u" && ArrayBuffer.isView ? n = ArrayBuffer.isView(e) : n = e && e.buffer && Qn(e.buffer), n;
}
const Ns = pt("string"), Y = pt("function"), Gn = pt("number"), He = (e) => e !== null && typeof e == "object", _s = (e) => e === !0 || e === !1, at = (e) => {
  if (ht(e) !== "object")
    return !1;
  const n = qt(e);
  return (n === null || n === Object.prototype || Object.getPrototypeOf(n) === null) && !(Xn in e) && !(dt in e);
}, Fs = (e) => {
  if (!He(e) || qe(e))
    return !1;
  try {
    return Object.keys(e).length === 0 && Object.getPrototypeOf(e) === Object.prototype;
  } catch {
    return !1;
  }
}, ks = ie("Date"), Us = ie("File"), Ls = ie("Blob"), Bs = ie("FileList"), Ds = (e) => He(e) && Y(e.pipe), Is = (e) => {
  let n;
  return e && (typeof FormData == "function" && e instanceof FormData || Y(e.append) && ((n = ht(e)) === "formdata" || // detect form-data instance
  n === "object" && Y(e.toString) && e.toString() === "[object FormData]"));
}, js = ie("URLSearchParams"), [qs, Hs, $s, vs] = ["ReadableStream", "Request", "Response", "Headers"].map(ie), Ms = (e) => e.trim ? e.trim() : e.replace(/^[\s\uFEFF\xA0]+|[\s\uFEFF\xA0]+$/g, "");
function $e(e, n, { allOwnKeys: s = !1 } = {}) {
  if (e === null || typeof e > "u")
    return;
  let i, c;
  if (typeof e != "object" && (e = [e]), Ne(e))
    for (i = 0, c = e.length; i < c; i++)
      n.call(null, e[i], i, e);
  else {
    if (qe(e))
      return;
    const f = s ? Object.getOwnPropertyNames(e) : Object.keys(e), l = f.length;
    let y;
    for (i = 0; i < l; i++)
      y = f[i], n.call(null, e[y], y, e);
  }
}
function Zn(e, n) {
  if (qe(e))
    return null;
  n = n.toLowerCase();
  const s = Object.keys(e);
  let i = s.length, c;
  for (; i-- > 0; )
    if (c = s[i], n === c.toLowerCase())
      return c;
  return null;
}
const ge = typeof globalThis < "u" ? globalThis : typeof self < "u" ? self : typeof window < "u" ? window : global, Yn = (e) => !Pe(e) && e !== ge;
function Bt() {
  const { caseless: e, skipUndefined: n } = Yn(this) && this || {}, s = {}, i = (c, f) => {
    const l = e && Zn(s, f) || f;
    at(s[l]) && at(c) ? s[l] = Bt(s[l], c) : at(c) ? s[l] = Bt({}, c) : Ne(c) ? s[l] = c.slice() : (!n || !Pe(c)) && (s[l] = c);
  };
  for (let c = 0, f = arguments.length; c < f; c++)
    arguments[c] && $e(arguments[c], i);
  return s;
}
const zs = (e, n, s, { allOwnKeys: i } = {}) => ($e(n, (c, f) => {
  s && Y(c) ? e[f] = Vn(c, s) : e[f] = c;
}, { allOwnKeys: i }), e), Js = (e) => (e.charCodeAt(0) === 65279 && (e = e.slice(1)), e), Ws = (e, n, s, i) => {
  e.prototype = Object.create(n.prototype, i), e.prototype.constructor = e, Object.defineProperty(e, "super", {
    value: n.prototype
  }), s && Object.assign(e.prototype, s);
}, Ks = (e, n, s, i) => {
  let c, f, l;
  const y = {};
  if (n = n || {}, e == null) return n;
  do {
    for (c = Object.getOwnPropertyNames(e), f = c.length; f-- > 0; )
      l = c[f], (!i || i(l, e, n)) && !y[l] && (n[l] = e[l], y[l] = !0);
    e = s !== !1 && qt(e);
  } while (e && (!s || s(e, n)) && e !== Object.prototype);
  return n;
}, Vs = (e, n, s) => {
  e = String(e), (s === void 0 || s > e.length) && (s = e.length), s -= n.length;
  const i = e.indexOf(n, s);
  return i !== -1 && i === s;
}, Xs = (e) => {
  if (!e) return null;
  if (Ne(e)) return e;
  let n = e.length;
  if (!Gn(n)) return null;
  const s = new Array(n);
  for (; n-- > 0; )
    s[n] = e[n];
  return s;
}, Qs = /* @__PURE__ */ ((e) => (n) => e && n instanceof e)(typeof Uint8Array < "u" && qt(Uint8Array)), Gs = (e, n) => {
  const i = (e && e[dt]).call(e);
  let c;
  for (; (c = i.next()) && !c.done; ) {
    const f = c.value;
    n.call(e, f[0], f[1]);
  }
}, Zs = (e, n) => {
  let s;
  const i = [];
  for (; (s = e.exec(n)) !== null; )
    i.push(s);
  return i;
}, Ys = ie("HTMLFormElement"), eo = (e) => e.toLowerCase().replace(
  /[-_\s]([a-z\d])(\w*)/g,
  function(s, i, c) {
    return i.toUpperCase() + c;
  }
), Nn = (({ hasOwnProperty: e }) => (n, s) => e.call(n, s))(Object.prototype), to = ie("RegExp"), er = (e, n) => {
  const s = Object.getOwnPropertyDescriptors(e), i = {};
  $e(s, (c, f) => {
    let l;
    (l = n(c, f, e)) !== !1 && (i[f] = l || c);
  }), Object.defineProperties(e, i);
}, no = (e) => {
  er(e, (n, s) => {
    if (Y(e) && ["arguments", "caller", "callee"].indexOf(s) !== -1)
      return !1;
    const i = e[s];
    if (Y(i)) {
      if (n.enumerable = !1, "writable" in n) {
        n.writable = !1;
        return;
      }
      n.set || (n.set = () => {
        throw Error("Can not rewrite read-only method '" + s + "'");
      });
    }
  });
}, ro = (e, n) => {
  const s = {}, i = (c) => {
    c.forEach((f) => {
      s[f] = !0;
    });
  };
  return Ne(e) ? i(e) : i(String(e).split(n)), s;
}, so = () => {
}, oo = (e, n) => e != null && Number.isFinite(e = +e) ? e : n;
function io(e) {
  return !!(e && Y(e.append) && e[Xn] === "FormData" && e[dt]);
}
const ao = (e) => {
  const n = new Array(10), s = (i, c) => {
    if (He(i)) {
      if (n.indexOf(i) >= 0)
        return;
      if (qe(i))
        return i;
      if (!("toJSON" in i)) {
        n[c] = i;
        const f = Ne(i) ? [] : {};
        return $e(i, (l, y) => {
          const R = s(l, c + 1);
          !Pe(R) && (f[y] = R);
        }), n[c] = void 0, f;
      }
    }
    return i;
  };
  return s(e, 0);
}, co = ie("AsyncFunction"), uo = (e) => e && (He(e) || Y(e)) && Y(e.then) && Y(e.catch), tr = ((e, n) => e ? setImmediate : n ? ((s, i) => (ge.addEventListener("message", ({ source: c, data: f }) => {
  c === ge && f === s && i.length && i.shift()();
}, !1), (c) => {
  i.push(c), ge.postMessage(s, "*");
}))(`axios@${Math.random()}`, []) : (s) => setTimeout(s))(
  typeof setImmediate == "function",
  Y(ge.postMessage)
), lo = typeof queueMicrotask < "u" ? queueMicrotask.bind(ge) : typeof process < "u" && process.nextTick || tr, fo = (e) => e != null && Y(e[dt]), m = {
  isArray: Ne,
  isArrayBuffer: Qn,
  isBuffer: qe,
  isFormData: Is,
  isArrayBufferView: Ps,
  isString: Ns,
  isNumber: Gn,
  isBoolean: _s,
  isObject: He,
  isPlainObject: at,
  isEmptyObject: Fs,
  isReadableStream: qs,
  isRequest: Hs,
  isResponse: $s,
  isHeaders: vs,
  isUndefined: Pe,
  isDate: ks,
  isFile: Us,
  isBlob: Ls,
  isRegExp: to,
  isFunction: Y,
  isStream: Ds,
  isURLSearchParams: js,
  isTypedArray: Qs,
  isFileList: Bs,
  forEach: $e,
  merge: Bt,
  extend: zs,
  trim: Ms,
  stripBOM: Js,
  inherits: Ws,
  toFlatObject: Ks,
  kindOf: ht,
  kindOfTest: ie,
  endsWith: Vs,
  toArray: Xs,
  forEachEntry: Gs,
  matchAll: Zs,
  isHTMLForm: Ys,
  hasOwnProperty: Nn,
  hasOwnProp: Nn,
  // an alias to avoid ESLint no-prototype-builtins detection
  reduceDescriptors: er,
  freezeMethods: no,
  toObjectSet: ro,
  toCamelCase: eo,
  noop: so,
  toFiniteNumber: oo,
  findKey: Zn,
  global: ge,
  isContextDefined: Yn,
  isSpecCompliantForm: io,
  toJSONObject: ao,
  isAsyncFn: co,
  isThenable: uo,
  setImmediate: tr,
  asap: lo,
  isIterable: fo
};
function B(e, n, s, i, c) {
  Error.call(this), Error.captureStackTrace ? Error.captureStackTrace(this, this.constructor) : this.stack = new Error().stack, this.message = e, this.name = "AxiosError", n && (this.code = n), s && (this.config = s), i && (this.request = i), c && (this.response = c, this.status = c.status ? c.status : null);
}
m.inherits(B, Error, {
  toJSON: function() {
    return {
      // Standard
      message: this.message,
      name: this.name,
      // Microsoft
      description: this.description,
      number: this.number,
      // Mozilla
      fileName: this.fileName,
      lineNumber: this.lineNumber,
      columnNumber: this.columnNumber,
      stack: this.stack,
      // Axios
      config: m.toJSONObject(this.config),
      code: this.code,
      status: this.status
    };
  }
});
const nr = B.prototype, rr = {};
[
  "ERR_BAD_OPTION_VALUE",
  "ERR_BAD_OPTION",
  "ECONNABORTED",
  "ETIMEDOUT",
  "ERR_NETWORK",
  "ERR_FR_TOO_MANY_REDIRECTS",
  "ERR_DEPRECATED",
  "ERR_BAD_RESPONSE",
  "ERR_BAD_REQUEST",
  "ERR_CANCELED",
  "ERR_NOT_SUPPORT",
  "ERR_INVALID_URL"
  // eslint-disable-next-line func-names
].forEach((e) => {
  rr[e] = { value: e };
});
Object.defineProperties(B, rr);
Object.defineProperty(nr, "isAxiosError", { value: !0 });
B.from = (e, n, s, i, c, f) => {
  const l = Object.create(nr);
  m.toFlatObject(e, l, function(E) {
    return E !== Error.prototype;
  }, (g) => g !== "isAxiosError");
  const y = e && e.message ? e.message : "Error", R = n == null && e ? e.code : n;
  return B.call(l, y, R, s, i, c), e && l.cause == null && Object.defineProperty(l, "cause", { value: e, configurable: !0 }), l.name = e && e.name || "Error", f && Object.assign(l, f), l;
};
const ho = null;
function Dt(e) {
  return m.isPlainObject(e) || m.isArray(e);
}
function sr(e) {
  return m.endsWith(e, "[]") ? e.slice(0, -2) : e;
}
function _n(e, n, s) {
  return e ? e.concat(n).map(function(c, f) {
    return c = sr(c), !s && f ? "[" + c + "]" : c;
  }).join(s ? "." : "") : n;
}
function po(e) {
  return m.isArray(e) && !e.some(Dt);
}
const mo = m.toFlatObject(m, {}, null, function(n) {
  return /^is[A-Z]/.test(n);
});
function mt(e, n, s) {
  if (!m.isObject(e))
    throw new TypeError("target must be an object");
  n = n || new FormData(), s = m.toFlatObject(s, {
    metaTokens: !0,
    dots: !1,
    indexes: !1
  }, !1, function(N, T) {
    return !m.isUndefined(T[N]);
  });
  const i = s.metaTokens, c = s.visitor || E, f = s.dots, l = s.indexes, R = (s.Blob || typeof Blob < "u" && Blob) && m.isSpecCompliantForm(n);
  if (!m.isFunction(c))
    throw new TypeError("visitor must be a function");
  function g(w) {
    if (w === null) return "";
    if (m.isDate(w))
      return w.toISOString();
    if (m.isBoolean(w))
      return w.toString();
    if (!R && m.isBlob(w))
      throw new B("Blob is not supported. Use a Buffer instead.");
    return m.isArrayBuffer(w) || m.isTypedArray(w) ? R && typeof Blob == "function" ? new Blob([w]) : Buffer.from(w) : w;
  }
  function E(w, N, T) {
    let D = w;
    if (w && !T && typeof w == "object") {
      if (m.endsWith(N, "{}"))
        N = i ? N : N.slice(0, -2), w = JSON.stringify(w);
      else if (m.isArray(w) && po(w) || (m.isFileList(w) || m.endsWith(N, "[]")) && (D = m.toArray(w)))
        return N = sr(N), D.forEach(function(I, H) {
          !(m.isUndefined(I) || I === null) && n.append(
            // eslint-disable-next-line no-nested-ternary
            l === !0 ? _n([N], H, f) : l === null ? N : N + "[]",
            g(I)
          );
        }), !1;
    }
    return Dt(w) ? !0 : (n.append(_n(T, N, f), g(w)), !1);
  }
  const S = [], P = Object.assign(mo, {
    defaultVisitor: E,
    convertValue: g,
    isVisitable: Dt
  });
  function O(w, N) {
    if (!m.isUndefined(w)) {
      if (S.indexOf(w) !== -1)
        throw Error("Circular reference detected in " + N.join("."));
      S.push(w), m.forEach(w, function(D, j) {
        (!(m.isUndefined(D) || D === null) && c.call(
          n,
          D,
          m.isString(j) ? j.trim() : j,
          N,
          P
        )) === !0 && O(D, N ? N.concat(j) : [j]);
      }), S.pop();
    }
  }
  if (!m.isObject(e))
    throw new TypeError("data must be an object");
  return O(e), n;
}
function Fn(e) {
  const n = {
    "!": "%21",
    "'": "%27",
    "(": "%28",
    ")": "%29",
    "~": "%7E",
    "%20": "+",
    "%00": "\0"
  };
  return encodeURIComponent(e).replace(/[!'()~]|%20|%00/g, function(i) {
    return n[i];
  });
}
function Ht(e, n) {
  this._pairs = [], e && mt(e, this, n);
}
const or = Ht.prototype;
or.append = function(n, s) {
  this._pairs.push([n, s]);
};
or.toString = function(n) {
  const s = n ? function(i) {
    return n.call(this, i, Fn);
  } : Fn;
  return this._pairs.map(function(c) {
    return s(c[0]) + "=" + s(c[1]);
  }, "").join("&");
};
function yo(e) {
  return encodeURIComponent(e).replace(/%3A/gi, ":").replace(/%24/g, "$").replace(/%2C/gi, ",").replace(/%20/g, "+");
}
function ir(e, n, s) {
  if (!n)
    return e;
  const i = s && s.encode || yo;
  m.isFunction(s) && (s = {
    serialize: s
  });
  const c = s && s.serialize;
  let f;
  if (c ? f = c(n, s) : f = m.isURLSearchParams(n) ? n.toString() : new Ht(n, s).toString(i), f) {
    const l = e.indexOf("#");
    l !== -1 && (e = e.slice(0, l)), e += (e.indexOf("?") === -1 ? "?" : "&") + f;
  }
  return e;
}
class kn {
  constructor() {
    this.handlers = [];
  }
  /**
   * Add a new interceptor to the stack
   *
   * @param {Function} fulfilled The function to handle `then` for a `Promise`
   * @param {Function} rejected The function to handle `reject` for a `Promise`
   *
   * @return {Number} An ID used to remove interceptor later
   */
  use(n, s, i) {
    return this.handlers.push({
      fulfilled: n,
      rejected: s,
      synchronous: i ? i.synchronous : !1,
      runWhen: i ? i.runWhen : null
    }), this.handlers.length - 1;
  }
  /**
   * Remove an interceptor from the stack
   *
   * @param {Number} id The ID that was returned by `use`
   *
   * @returns {void}
   */
  eject(n) {
    this.handlers[n] && (this.handlers[n] = null);
  }
  /**
   * Clear all interceptors from the stack
   *
   * @returns {void}
   */
  clear() {
    this.handlers && (this.handlers = []);
  }
  /**
   * Iterate over all the registered interceptors
   *
   * This method is particularly useful for skipping over any
   * interceptors that may have become `null` calling `eject`.
   *
   * @param {Function} fn The function to call for each interceptor
   *
   * @returns {void}
   */
  forEach(n) {
    m.forEach(this.handlers, function(i) {
      i !== null && n(i);
    });
  }
}
const ar = {
  silentJSONParsing: !0,
  forcedJSONParsing: !0,
  clarifyTimeoutError: !1
}, wo = typeof URLSearchParams < "u" ? URLSearchParams : Ht, bo = typeof FormData < "u" ? FormData : null, go = typeof Blob < "u" ? Blob : null, Eo = {
  isBrowser: !0,
  classes: {
    URLSearchParams: wo,
    FormData: bo,
    Blob: go
  },
  protocols: ["http", "https", "file", "blob", "url", "data"]
}, $t = typeof window < "u" && typeof document < "u", It = typeof navigator == "object" && navigator || void 0, Ro = $t && (!It || ["ReactNative", "NativeScript", "NS"].indexOf(It.product) < 0), So = typeof WorkerGlobalScope < "u" && // eslint-disable-next-line no-undef
self instanceof WorkerGlobalScope && typeof self.importScripts == "function", Oo = $t && window.location.href || "http://localhost", To = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  hasBrowserEnv: $t,
  hasStandardBrowserEnv: Ro,
  hasStandardBrowserWebWorkerEnv: So,
  navigator: It,
  origin: Oo
}, Symbol.toStringTag, { value: "Module" })), Q = {
  ...To,
  ...Eo
};
function Ao(e, n) {
  return mt(e, new Q.classes.URLSearchParams(), {
    visitor: function(s, i, c, f) {
      return Q.isNode && m.isBuffer(s) ? (this.append(i, s.toString("base64")), !1) : f.defaultVisitor.apply(this, arguments);
    },
    ...n
  });
}
function Co(e) {
  return m.matchAll(/\w+|\[(\w*)]/g, e).map((n) => n[0] === "[]" ? "" : n[1] || n[0]);
}
function xo(e) {
  const n = {}, s = Object.keys(e);
  let i;
  const c = s.length;
  let f;
  for (i = 0; i < c; i++)
    f = s[i], n[f] = e[f];
  return n;
}
function cr(e) {
  function n(s, i, c, f) {
    let l = s[f++];
    if (l === "__proto__") return !0;
    const y = Number.isFinite(+l), R = f >= s.length;
    return l = !l && m.isArray(c) ? c.length : l, R ? (m.hasOwnProp(c, l) ? c[l] = [c[l], i] : c[l] = i, !y) : ((!c[l] || !m.isObject(c[l])) && (c[l] = []), n(s, i, c[l], f) && m.isArray(c[l]) && (c[l] = xo(c[l])), !y);
  }
  if (m.isFormData(e) && m.isFunction(e.entries)) {
    const s = {};
    return m.forEachEntry(e, (i, c) => {
      n(Co(i), c, s, 0);
    }), s;
  }
  return null;
}
function Po(e, n, s) {
  if (m.isString(e))
    try {
      return (n || JSON.parse)(e), m.trim(e);
    } catch (i) {
      if (i.name !== "SyntaxError")
        throw i;
    }
  return (s || JSON.stringify)(e);
}
const ve = {
  transitional: ar,
  adapter: ["xhr", "http", "fetch"],
  transformRequest: [function(n, s) {
    const i = s.getContentType() || "", c = i.indexOf("application/json") > -1, f = m.isObject(n);
    if (f && m.isHTMLForm(n) && (n = new FormData(n)), m.isFormData(n))
      return c ? JSON.stringify(cr(n)) : n;
    if (m.isArrayBuffer(n) || m.isBuffer(n) || m.isStream(n) || m.isFile(n) || m.isBlob(n) || m.isReadableStream(n))
      return n;
    if (m.isArrayBufferView(n))
      return n.buffer;
    if (m.isURLSearchParams(n))
      return s.setContentType("application/x-www-form-urlencoded;charset=utf-8", !1), n.toString();
    let y;
    if (f) {
      if (i.indexOf("application/x-www-form-urlencoded") > -1)
        return Ao(n, this.formSerializer).toString();
      if ((y = m.isFileList(n)) || i.indexOf("multipart/form-data") > -1) {
        const R = this.env && this.env.FormData;
        return mt(
          y ? { "files[]": n } : n,
          R && new R(),
          this.formSerializer
        );
      }
    }
    return f || c ? (s.setContentType("application/json", !1), Po(n)) : n;
  }],
  transformResponse: [function(n) {
    const s = this.transitional || ve.transitional, i = s && s.forcedJSONParsing, c = this.responseType === "json";
    if (m.isResponse(n) || m.isReadableStream(n))
      return n;
    if (n && m.isString(n) && (i && !this.responseType || c)) {
      const l = !(s && s.silentJSONParsing) && c;
      try {
        return JSON.parse(n, this.parseReviver);
      } catch (y) {
        if (l)
          throw y.name === "SyntaxError" ? B.from(y, B.ERR_BAD_RESPONSE, this, null, this.response) : y;
      }
    }
    return n;
  }],
  /**
   * A timeout in milliseconds to abort a request. If set to 0 (default) a
   * timeout is not created.
   */
  timeout: 0,
  xsrfCookieName: "XSRF-TOKEN",
  xsrfHeaderName: "X-XSRF-TOKEN",
  maxContentLength: -1,
  maxBodyLength: -1,
  env: {
    FormData: Q.classes.FormData,
    Blob: Q.classes.Blob
  },
  validateStatus: function(n) {
    return n >= 200 && n < 300;
  },
  headers: {
    common: {
      Accept: "application/json, text/plain, */*",
      "Content-Type": void 0
    }
  }
};
m.forEach(["delete", "get", "head", "post", "put", "patch"], (e) => {
  ve.headers[e] = {};
});
const No = m.toObjectSet([
  "age",
  "authorization",
  "content-length",
  "content-type",
  "etag",
  "expires",
  "from",
  "host",
  "if-modified-since",
  "if-unmodified-since",
  "last-modified",
  "location",
  "max-forwards",
  "proxy-authorization",
  "referer",
  "retry-after",
  "user-agent"
]), _o = (e) => {
  const n = {};
  let s, i, c;
  return e && e.split(`
`).forEach(function(l) {
    c = l.indexOf(":"), s = l.substring(0, c).trim().toLowerCase(), i = l.substring(c + 1).trim(), !(!s || n[s] && No[s]) && (s === "set-cookie" ? n[s] ? n[s].push(i) : n[s] = [i] : n[s] = n[s] ? n[s] + ", " + i : i);
  }), n;
}, Un = Symbol("internals");
function je(e) {
  return e && String(e).trim().toLowerCase();
}
function ct(e) {
  return e === !1 || e == null ? e : m.isArray(e) ? e.map(ct) : String(e);
}
function Fo(e) {
  const n = /* @__PURE__ */ Object.create(null), s = /([^\s,;=]+)\s*(?:=\s*([^,;]+))?/g;
  let i;
  for (; i = s.exec(e); )
    n[i[1]] = i[2];
  return n;
}
const ko = (e) => /^[-_a-zA-Z0-9^`|~,!#$%&'*+.]+$/.test(e.trim());
function Ft(e, n, s, i, c) {
  if (m.isFunction(i))
    return i.call(this, n, s);
  if (c && (n = s), !!m.isString(n)) {
    if (m.isString(i))
      return n.indexOf(i) !== -1;
    if (m.isRegExp(i))
      return i.test(n);
  }
}
function Uo(e) {
  return e.trim().toLowerCase().replace(/([a-z\d])(\w*)/g, (n, s, i) => s.toUpperCase() + i);
}
function Lo(e, n) {
  const s = m.toCamelCase(" " + n);
  ["get", "set", "has"].forEach((i) => {
    Object.defineProperty(e, i + s, {
      value: function(c, f, l) {
        return this[i].call(this, n, c, f, l);
      },
      configurable: !0
    });
  });
}
let ee = class {
  constructor(n) {
    n && this.set(n);
  }
  set(n, s, i) {
    const c = this;
    function f(y, R, g) {
      const E = je(R);
      if (!E)
        throw new Error("header name must be a non-empty string");
      const S = m.findKey(c, E);
      (!S || c[S] === void 0 || g === !0 || g === void 0 && c[S] !== !1) && (c[S || R] = ct(y));
    }
    const l = (y, R) => m.forEach(y, (g, E) => f(g, E, R));
    if (m.isPlainObject(n) || n instanceof this.constructor)
      l(n, s);
    else if (m.isString(n) && (n = n.trim()) && !ko(n))
      l(_o(n), s);
    else if (m.isObject(n) && m.isIterable(n)) {
      let y = {}, R, g;
      for (const E of n) {
        if (!m.isArray(E))
          throw TypeError("Object iterator must return a key-value pair");
        y[g = E[0]] = (R = y[g]) ? m.isArray(R) ? [...R, E[1]] : [R, E[1]] : E[1];
      }
      l(y, s);
    } else
      n != null && f(s, n, i);
    return this;
  }
  get(n, s) {
    if (n = je(n), n) {
      const i = m.findKey(this, n);
      if (i) {
        const c = this[i];
        if (!s)
          return c;
        if (s === !0)
          return Fo(c);
        if (m.isFunction(s))
          return s.call(this, c, i);
        if (m.isRegExp(s))
          return s.exec(c);
        throw new TypeError("parser must be boolean|regexp|function");
      }
    }
  }
  has(n, s) {
    if (n = je(n), n) {
      const i = m.findKey(this, n);
      return !!(i && this[i] !== void 0 && (!s || Ft(this, this[i], i, s)));
    }
    return !1;
  }
  delete(n, s) {
    const i = this;
    let c = !1;
    function f(l) {
      if (l = je(l), l) {
        const y = m.findKey(i, l);
        y && (!s || Ft(i, i[y], y, s)) && (delete i[y], c = !0);
      }
    }
    return m.isArray(n) ? n.forEach(f) : f(n), c;
  }
  clear(n) {
    const s = Object.keys(this);
    let i = s.length, c = !1;
    for (; i--; ) {
      const f = s[i];
      (!n || Ft(this, this[f], f, n, !0)) && (delete this[f], c = !0);
    }
    return c;
  }
  normalize(n) {
    const s = this, i = {};
    return m.forEach(this, (c, f) => {
      const l = m.findKey(i, f);
      if (l) {
        s[l] = ct(c), delete s[f];
        return;
      }
      const y = n ? Uo(f) : String(f).trim();
      y !== f && delete s[f], s[y] = ct(c), i[y] = !0;
    }), this;
  }
  concat(...n) {
    return this.constructor.concat(this, ...n);
  }
  toJSON(n) {
    const s = /* @__PURE__ */ Object.create(null);
    return m.forEach(this, (i, c) => {
      i != null && i !== !1 && (s[c] = n && m.isArray(i) ? i.join(", ") : i);
    }), s;
  }
  [Symbol.iterator]() {
    return Object.entries(this.toJSON())[Symbol.iterator]();
  }
  toString() {
    return Object.entries(this.toJSON()).map(([n, s]) => n + ": " + s).join(`
`);
  }
  getSetCookie() {
    return this.get("set-cookie") || [];
  }
  get [Symbol.toStringTag]() {
    return "AxiosHeaders";
  }
  static from(n) {
    return n instanceof this ? n : new this(n);
  }
  static concat(n, ...s) {
    const i = new this(n);
    return s.forEach((c) => i.set(c)), i;
  }
  static accessor(n) {
    const i = (this[Un] = this[Un] = {
      accessors: {}
    }).accessors, c = this.prototype;
    function f(l) {
      const y = je(l);
      i[y] || (Lo(c, l), i[y] = !0);
    }
    return m.isArray(n) ? n.forEach(f) : f(n), this;
  }
};
ee.accessor(["Content-Type", "Content-Length", "Accept", "Accept-Encoding", "User-Agent", "Authorization"]);
m.reduceDescriptors(ee.prototype, ({ value: e }, n) => {
  let s = n[0].toUpperCase() + n.slice(1);
  return {
    get: () => e,
    set(i) {
      this[s] = i;
    }
  };
});
m.freezeMethods(ee);
function kt(e, n) {
  const s = this || ve, i = n || s, c = ee.from(i.headers);
  let f = i.data;
  return m.forEach(e, function(y) {
    f = y.call(s, f, c.normalize(), n ? n.status : void 0);
  }), c.normalize(), f;
}
function ur(e) {
  return !!(e && e.__CANCEL__);
}
function _e(e, n, s) {
  B.call(this, e ?? "canceled", B.ERR_CANCELED, n, s), this.name = "CanceledError";
}
m.inherits(_e, B, {
  __CANCEL__: !0
});
function lr(e, n, s) {
  const i = s.config.validateStatus;
  !s.status || !i || i(s.status) ? e(s) : n(new B(
    "Request failed with status code " + s.status,
    [B.ERR_BAD_REQUEST, B.ERR_BAD_RESPONSE][Math.floor(s.status / 100) - 4],
    s.config,
    s.request,
    s
  ));
}
function Bo(e) {
  const n = /^([-+\w]{1,25})(:?\/\/|:)/.exec(e);
  return n && n[1] || "";
}
function Do(e, n) {
  e = e || 10;
  const s = new Array(e), i = new Array(e);
  let c = 0, f = 0, l;
  return n = n !== void 0 ? n : 1e3, function(R) {
    const g = Date.now(), E = i[f];
    l || (l = g), s[c] = R, i[c] = g;
    let S = f, P = 0;
    for (; S !== c; )
      P += s[S++], S = S % e;
    if (c = (c + 1) % e, c === f && (f = (f + 1) % e), g - l < n)
      return;
    const O = E && g - E;
    return O ? Math.round(P * 1e3 / O) : void 0;
  };
}
function Io(e, n) {
  let s = 0, i = 1e3 / n, c, f;
  const l = (g, E = Date.now()) => {
    s = E, c = null, f && (clearTimeout(f), f = null), e(...g);
  };
  return [(...g) => {
    const E = Date.now(), S = E - s;
    S >= i ? l(g, E) : (c = g, f || (f = setTimeout(() => {
      f = null, l(c);
    }, i - S)));
  }, () => c && l(c)];
}
const ft = (e, n, s = 3) => {
  let i = 0;
  const c = Do(50, 250);
  return Io((f) => {
    const l = f.loaded, y = f.lengthComputable ? f.total : void 0, R = l - i, g = c(R), E = l <= y;
    i = l;
    const S = {
      loaded: l,
      total: y,
      progress: y ? l / y : void 0,
      bytes: R,
      rate: g || void 0,
      estimated: g && y && E ? (y - l) / g : void 0,
      event: f,
      lengthComputable: y != null,
      [n ? "download" : "upload"]: !0
    };
    e(S);
  }, s);
}, Ln = (e, n) => {
  const s = e != null;
  return [(i) => n[0]({
    lengthComputable: s,
    total: e,
    loaded: i
  }), n[1]];
}, Bn = (e) => (...n) => m.asap(() => e(...n)), jo = Q.hasStandardBrowserEnv ? /* @__PURE__ */ ((e, n) => (s) => (s = new URL(s, Q.origin), e.protocol === s.protocol && e.host === s.host && (n || e.port === s.port)))(
  new URL(Q.origin),
  Q.navigator && /(msie|trident)/i.test(Q.navigator.userAgent)
) : () => !0, qo = Q.hasStandardBrowserEnv ? (
  // Standard browser envs support document.cookie
  {
    write(e, n, s, i, c, f, l) {
      if (typeof document > "u") return;
      const y = [`${e}=${encodeURIComponent(n)}`];
      m.isNumber(s) && y.push(`expires=${new Date(s).toUTCString()}`), m.isString(i) && y.push(`path=${i}`), m.isString(c) && y.push(`domain=${c}`), f === !0 && y.push("secure"), m.isString(l) && y.push(`SameSite=${l}`), document.cookie = y.join("; ");
    },
    read(e) {
      if (typeof document > "u") return null;
      const n = document.cookie.match(new RegExp("(?:^|; )" + e + "=([^;]*)"));
      return n ? decodeURIComponent(n[1]) : null;
    },
    remove(e) {
      this.write(e, "", Date.now() - 864e5, "/");
    }
  }
) : (
  // Non-standard browser env (web workers, react-native) lack needed support.
  {
    write() {
    },
    read() {
      return null;
    },
    remove() {
    }
  }
);
function Ho(e) {
  return /^([a-z][a-z\d+\-.]*:)?\/\//i.test(e);
}
function $o(e, n) {
  return n ? e.replace(/\/?\/$/, "") + "/" + n.replace(/^\/+/, "") : e;
}
function fr(e, n, s) {
  let i = !Ho(n);
  return e && (i || s == !1) ? $o(e, n) : n;
}
const Dn = (e) => e instanceof ee ? { ...e } : e;
function Re(e, n) {
  n = n || {};
  const s = {};
  function i(g, E, S, P) {
    return m.isPlainObject(g) && m.isPlainObject(E) ? m.merge.call({ caseless: P }, g, E) : m.isPlainObject(E) ? m.merge({}, E) : m.isArray(E) ? E.slice() : E;
  }
  function c(g, E, S, P) {
    if (m.isUndefined(E)) {
      if (!m.isUndefined(g))
        return i(void 0, g, S, P);
    } else return i(g, E, S, P);
  }
  function f(g, E) {
    if (!m.isUndefined(E))
      return i(void 0, E);
  }
  function l(g, E) {
    if (m.isUndefined(E)) {
      if (!m.isUndefined(g))
        return i(void 0, g);
    } else return i(void 0, E);
  }
  function y(g, E, S) {
    if (S in n)
      return i(g, E);
    if (S in e)
      return i(void 0, g);
  }
  const R = {
    url: f,
    method: f,
    data: f,
    baseURL: l,
    transformRequest: l,
    transformResponse: l,
    paramsSerializer: l,
    timeout: l,
    timeoutMessage: l,
    withCredentials: l,
    withXSRFToken: l,
    adapter: l,
    responseType: l,
    xsrfCookieName: l,
    xsrfHeaderName: l,
    onUploadProgress: l,
    onDownloadProgress: l,
    decompress: l,
    maxContentLength: l,
    maxBodyLength: l,
    beforeRedirect: l,
    transport: l,
    httpAgent: l,
    httpsAgent: l,
    cancelToken: l,
    socketPath: l,
    responseEncoding: l,
    validateStatus: y,
    headers: (g, E, S) => c(Dn(g), Dn(E), S, !0)
  };
  return m.forEach(Object.keys({ ...e, ...n }), function(E) {
    const S = R[E] || c, P = S(e[E], n[E], E);
    m.isUndefined(P) && S !== y || (s[E] = P);
  }), s;
}
const dr = (e) => {
  const n = Re({}, e);
  let { data: s, withXSRFToken: i, xsrfHeaderName: c, xsrfCookieName: f, headers: l, auth: y } = n;
  if (n.headers = l = ee.from(l), n.url = ir(fr(n.baseURL, n.url, n.allowAbsoluteUrls), e.params, e.paramsSerializer), y && l.set(
    "Authorization",
    "Basic " + btoa((y.username || "") + ":" + (y.password ? unescape(encodeURIComponent(y.password)) : ""))
  ), m.isFormData(s)) {
    if (Q.hasStandardBrowserEnv || Q.hasStandardBrowserWebWorkerEnv)
      l.setContentType(void 0);
    else if (m.isFunction(s.getHeaders)) {
      const R = s.getHeaders(), g = ["content-type", "content-length"];
      Object.entries(R).forEach(([E, S]) => {
        g.includes(E.toLowerCase()) && l.set(E, S);
      });
    }
  }
  if (Q.hasStandardBrowserEnv && (i && m.isFunction(i) && (i = i(n)), i || i !== !1 && jo(n.url))) {
    const R = c && f && qo.read(f);
    R && l.set(c, R);
  }
  return n;
}, vo = typeof XMLHttpRequest < "u", Mo = vo && function(e) {
  return new Promise(function(s, i) {
    const c = dr(e);
    let f = c.data;
    const l = ee.from(c.headers).normalize();
    let { responseType: y, onUploadProgress: R, onDownloadProgress: g } = c, E, S, P, O, w;
    function N() {
      O && O(), w && w(), c.cancelToken && c.cancelToken.unsubscribe(E), c.signal && c.signal.removeEventListener("abort", E);
    }
    let T = new XMLHttpRequest();
    T.open(c.method.toUpperCase(), c.url, !0), T.timeout = c.timeout;
    function D() {
      if (!T)
        return;
      const I = ee.from(
        "getAllResponseHeaders" in T && T.getAllResponseHeaders()
      ), M = {
        data: !y || y === "text" || y === "json" ? T.responseText : T.response,
        status: T.status,
        statusText: T.statusText,
        headers: I,
        config: e,
        request: T
      };
      lr(function(G) {
        s(G), N();
      }, function(G) {
        i(G), N();
      }, M), T = null;
    }
    "onloadend" in T ? T.onloadend = D : T.onreadystatechange = function() {
      !T || T.readyState !== 4 || T.status === 0 && !(T.responseURL && T.responseURL.indexOf("file:") === 0) || setTimeout(D);
    }, T.onabort = function() {
      T && (i(new B("Request aborted", B.ECONNABORTED, e, T)), T = null);
    }, T.onerror = function(H) {
      const M = H && H.message ? H.message : "Network Error", te = new B(M, B.ERR_NETWORK, e, T);
      te.event = H || null, i(te), T = null;
    }, T.ontimeout = function() {
      let H = c.timeout ? "timeout of " + c.timeout + "ms exceeded" : "timeout exceeded";
      const M = c.transitional || ar;
      c.timeoutErrorMessage && (H = c.timeoutErrorMessage), i(new B(
        H,
        M.clarifyTimeoutError ? B.ETIMEDOUT : B.ECONNABORTED,
        e,
        T
      )), T = null;
    }, f === void 0 && l.setContentType(null), "setRequestHeader" in T && m.forEach(l.toJSON(), function(H, M) {
      T.setRequestHeader(M, H);
    }), m.isUndefined(c.withCredentials) || (T.withCredentials = !!c.withCredentials), y && y !== "json" && (T.responseType = c.responseType), g && ([P, w] = ft(g, !0), T.addEventListener("progress", P)), R && T.upload && ([S, O] = ft(R), T.upload.addEventListener("progress", S), T.upload.addEventListener("loadend", O)), (c.cancelToken || c.signal) && (E = (I) => {
      T && (i(!I || I.type ? new _e(null, e, T) : I), T.abort(), T = null);
    }, c.cancelToken && c.cancelToken.subscribe(E), c.signal && (c.signal.aborted ? E() : c.signal.addEventListener("abort", E)));
    const j = Bo(c.url);
    if (j && Q.protocols.indexOf(j) === -1) {
      i(new B("Unsupported protocol " + j + ":", B.ERR_BAD_REQUEST, e));
      return;
    }
    T.send(f || null);
  });
}, zo = (e, n) => {
  const { length: s } = e = e ? e.filter(Boolean) : [];
  if (n || s) {
    let i = new AbortController(), c;
    const f = function(g) {
      if (!c) {
        c = !0, y();
        const E = g instanceof Error ? g : this.reason;
        i.abort(E instanceof B ? E : new _e(E instanceof Error ? E.message : E));
      }
    };
    let l = n && setTimeout(() => {
      l = null, f(new B(`timeout ${n} of ms exceeded`, B.ETIMEDOUT));
    }, n);
    const y = () => {
      e && (l && clearTimeout(l), l = null, e.forEach((g) => {
        g.unsubscribe ? g.unsubscribe(f) : g.removeEventListener("abort", f);
      }), e = null);
    };
    e.forEach((g) => g.addEventListener("abort", f));
    const { signal: R } = i;
    return R.unsubscribe = () => m.asap(y), R;
  }
}, Jo = function* (e, n) {
  let s = e.byteLength;
  if (s < n) {
    yield e;
    return;
  }
  let i = 0, c;
  for (; i < s; )
    c = i + n, yield e.slice(i, c), i = c;
}, Wo = async function* (e, n) {
  for await (const s of Ko(e))
    yield* Jo(s, n);
}, Ko = async function* (e) {
  if (e[Symbol.asyncIterator]) {
    yield* e;
    return;
  }
  const n = e.getReader();
  try {
    for (; ; ) {
      const { done: s, value: i } = await n.read();
      if (s)
        break;
      yield i;
    }
  } finally {
    await n.cancel();
  }
}, In = (e, n, s, i) => {
  const c = Wo(e, n);
  let f = 0, l, y = (R) => {
    l || (l = !0, i && i(R));
  };
  return new ReadableStream({
    async pull(R) {
      try {
        const { done: g, value: E } = await c.next();
        if (g) {
          y(), R.close();
          return;
        }
        let S = E.byteLength;
        if (s) {
          let P = f += S;
          s(P);
        }
        R.enqueue(new Uint8Array(E));
      } catch (g) {
        throw y(g), g;
      }
    },
    cancel(R) {
      return y(R), c.return();
    }
  }, {
    highWaterMark: 2
  });
}, jn = 64 * 1024, { isFunction: ot } = m, Vo = (({ Request: e, Response: n }) => ({
  Request: e,
  Response: n
}))(m.global), {
  ReadableStream: qn,
  TextEncoder: Hn
} = m.global, $n = (e, ...n) => {
  try {
    return !!e(...n);
  } catch {
    return !1;
  }
}, Xo = (e) => {
  e = m.merge.call({
    skipUndefined: !0
  }, Vo, e);
  const { fetch: n, Request: s, Response: i } = e, c = n ? ot(n) : typeof fetch == "function", f = ot(s), l = ot(i);
  if (!c)
    return !1;
  const y = c && ot(qn), R = c && (typeof Hn == "function" ? /* @__PURE__ */ ((w) => (N) => w.encode(N))(new Hn()) : async (w) => new Uint8Array(await new s(w).arrayBuffer())), g = f && y && $n(() => {
    let w = !1;
    const N = new s(Q.origin, {
      body: new qn(),
      method: "POST",
      get duplex() {
        return w = !0, "half";
      }
    }).headers.has("Content-Type");
    return w && !N;
  }), E = l && y && $n(() => m.isReadableStream(new i("").body)), S = {
    stream: E && ((w) => w.body)
  };
  c && ["text", "arrayBuffer", "blob", "formData", "stream"].forEach((w) => {
    !S[w] && (S[w] = (N, T) => {
      let D = N && N[w];
      if (D)
        return D.call(N);
      throw new B(`Response type '${w}' is not supported`, B.ERR_NOT_SUPPORT, T);
    });
  });
  const P = async (w) => {
    if (w == null)
      return 0;
    if (m.isBlob(w))
      return w.size;
    if (m.isSpecCompliantForm(w))
      return (await new s(Q.origin, {
        method: "POST",
        body: w
      }).arrayBuffer()).byteLength;
    if (m.isArrayBufferView(w) || m.isArrayBuffer(w))
      return w.byteLength;
    if (m.isURLSearchParams(w) && (w = w + ""), m.isString(w))
      return (await R(w)).byteLength;
  }, O = async (w, N) => {
    const T = m.toFiniteNumber(w.getContentLength());
    return T ?? P(N);
  };
  return async (w) => {
    let {
      url: N,
      method: T,
      data: D,
      signal: j,
      cancelToken: I,
      timeout: H,
      onDownloadProgress: M,
      onUploadProgress: te,
      responseType: G,
      headers: Fe,
      withCredentials: Se = "same-origin",
      fetchOptions: Me
    } = dr(w), ze = n || fetch;
    G = G ? (G + "").toLowerCase() : "text";
    let Oe = zo([j, I && I.toAbortSignal()], H), me = null;
    const fe = Oe && Oe.unsubscribe && (() => {
      Oe.unsubscribe();
    });
    let Je;
    try {
      if (te && g && T !== "get" && T !== "head" && (Je = await O(Fe, D)) !== 0) {
        let ae = new s(N, {
          method: "POST",
          body: D,
          duplex: "half"
        }), de;
        if (m.isFormData(D) && (de = ae.headers.get("content-type")) && Fe.setContentType(de), ae.body) {
          const [Be, Te] = Ln(
            Je,
            ft(Bn(te))
          );
          D = In(ae.body, jn, Be, Te);
        }
      }
      m.isString(Se) || (Se = Se ? "include" : "omit");
      const W = f && "credentials" in s.prototype, ke = {
        ...Me,
        signal: Oe,
        method: T.toUpperCase(),
        headers: Fe.normalize().toJSON(),
        body: D,
        duplex: "half",
        credentials: W ? Se : void 0
      };
      me = f && new s(N, ke);
      let K = await (f ? ze(me, Me) : ze(N, ke));
      const Ue = E && (G === "stream" || G === "response");
      if (E && (M || Ue && fe)) {
        const ae = {};
        ["status", "statusText", "headers"].forEach((We) => {
          ae[We] = K[We];
        });
        const de = m.toFiniteNumber(K.headers.get("content-length")), [Be, Te] = M && Ln(
          de,
          ft(Bn(M), !0)
        ) || [];
        K = new i(
          In(K.body, jn, Be, () => {
            Te && Te(), fe && fe();
          }),
          ae
        );
      }
      G = G || "text";
      let Le = await S[m.findKey(S, G) || "text"](K, w);
      return !Ue && fe && fe(), await new Promise((ae, de) => {
        lr(ae, de, {
          data: Le,
          headers: ee.from(K.headers),
          status: K.status,
          statusText: K.statusText,
          config: w,
          request: me
        });
      });
    } catch (W) {
      throw fe && fe(), W && W.name === "TypeError" && /Load failed|fetch/i.test(W.message) ? Object.assign(
        new B("Network Error", B.ERR_NETWORK, w, me),
        {
          cause: W.cause || W
        }
      ) : B.from(W, W && W.code, w, me);
    }
  };
}, Qo = /* @__PURE__ */ new Map(), hr = (e) => {
  let n = e && e.env || {};
  const { fetch: s, Request: i, Response: c } = n, f = [
    i,
    c,
    s
  ];
  let l = f.length, y = l, R, g, E = Qo;
  for (; y--; )
    R = f[y], g = E.get(R), g === void 0 && E.set(R, g = y ? /* @__PURE__ */ new Map() : Xo(n)), E = g;
  return g;
};
hr();
const vt = {
  http: ho,
  xhr: Mo,
  fetch: {
    get: hr
  }
};
m.forEach(vt, (e, n) => {
  if (e) {
    try {
      Object.defineProperty(e, "name", { value: n });
    } catch {
    }
    Object.defineProperty(e, "adapterName", { value: n });
  }
});
const vn = (e) => `- ${e}`, Go = (e) => m.isFunction(e) || e === null || e === !1;
function Zo(e, n) {
  e = m.isArray(e) ? e : [e];
  const { length: s } = e;
  let i, c;
  const f = {};
  for (let l = 0; l < s; l++) {
    i = e[l];
    let y;
    if (c = i, !Go(i) && (c = vt[(y = String(i)).toLowerCase()], c === void 0))
      throw new B(`Unknown adapter '${y}'`);
    if (c && (m.isFunction(c) || (c = c.get(n))))
      break;
    f[y || "#" + l] = c;
  }
  if (!c) {
    const l = Object.entries(f).map(
      ([R, g]) => `adapter ${R} ` + (g === !1 ? "is not supported by the environment" : "is not available in the build")
    );
    let y = s ? l.length > 1 ? `since :
` + l.map(vn).join(`
`) : " " + vn(l[0]) : "as no adapter specified";
    throw new B(
      "There is no suitable adapter to dispatch the request " + y,
      "ERR_NOT_SUPPORT"
    );
  }
  return c;
}
const pr = {
  /**
   * Resolve an adapter from a list of adapter names or functions.
   * @type {Function}
   */
  getAdapter: Zo,
  /**
   * Exposes all known adapters
   * @type {Object<string, Function|Object>}
   */
  adapters: vt
};
function Ut(e) {
  if (e.cancelToken && e.cancelToken.throwIfRequested(), e.signal && e.signal.aborted)
    throw new _e(null, e);
}
function Mn(e) {
  return Ut(e), e.headers = ee.from(e.headers), e.data = kt.call(
    e,
    e.transformRequest
  ), ["post", "put", "patch"].indexOf(e.method) !== -1 && e.headers.setContentType("application/x-www-form-urlencoded", !1), pr.getAdapter(e.adapter || ve.adapter, e)(e).then(function(i) {
    return Ut(e), i.data = kt.call(
      e,
      e.transformResponse,
      i
    ), i.headers = ee.from(i.headers), i;
  }, function(i) {
    return ur(i) || (Ut(e), i && i.response && (i.response.data = kt.call(
      e,
      e.transformResponse,
      i.response
    ), i.response.headers = ee.from(i.response.headers))), Promise.reject(i);
  });
}
const mr = "1.13.2", yt = {};
["object", "boolean", "number", "function", "string", "symbol"].forEach((e, n) => {
  yt[e] = function(i) {
    return typeof i === e || "a" + (n < 1 ? "n " : " ") + e;
  };
});
const zn = {};
yt.transitional = function(n, s, i) {
  function c(f, l) {
    return "[Axios v" + mr + "] Transitional option '" + f + "'" + l + (i ? ". " + i : "");
  }
  return (f, l, y) => {
    if (n === !1)
      throw new B(
        c(l, " has been removed" + (s ? " in " + s : "")),
        B.ERR_DEPRECATED
      );
    return s && !zn[l] && (zn[l] = !0, console.warn(
      c(
        l,
        " has been deprecated since v" + s + " and will be removed in the near future"
      )
    )), n ? n(f, l, y) : !0;
  };
};
yt.spelling = function(n) {
  return (s, i) => (console.warn(`${i} is likely a misspelling of ${n}`), !0);
};
function Yo(e, n, s) {
  if (typeof e != "object")
    throw new B("options must be an object", B.ERR_BAD_OPTION_VALUE);
  const i = Object.keys(e);
  let c = i.length;
  for (; c-- > 0; ) {
    const f = i[c], l = n[f];
    if (l) {
      const y = e[f], R = y === void 0 || l(y, f, e);
      if (R !== !0)
        throw new B("option " + f + " must be " + R, B.ERR_BAD_OPTION_VALUE);
      continue;
    }
    if (s !== !0)
      throw new B("Unknown option " + f, B.ERR_BAD_OPTION);
  }
}
const ut = {
  assertOptions: Yo,
  validators: yt
}, le = ut.validators;
let Ee = class {
  constructor(n) {
    this.defaults = n || {}, this.interceptors = {
      request: new kn(),
      response: new kn()
    };
  }
  /**
   * Dispatch a request
   *
   * @param {String|Object} configOrUrl The config specific for this request (merged with this.defaults)
   * @param {?Object} config
   *
   * @returns {Promise} The Promise to be fulfilled
   */
  async request(n, s) {
    try {
      return await this._request(n, s);
    } catch (i) {
      if (i instanceof Error) {
        let c = {};
        Error.captureStackTrace ? Error.captureStackTrace(c) : c = new Error();
        const f = c.stack ? c.stack.replace(/^.+\n/, "") : "";
        try {
          i.stack ? f && !String(i.stack).endsWith(f.replace(/^.+\n.+\n/, "")) && (i.stack += `
` + f) : i.stack = f;
        } catch {
        }
      }
      throw i;
    }
  }
  _request(n, s) {
    typeof n == "string" ? (s = s || {}, s.url = n) : s = n || {}, s = Re(this.defaults, s);
    const { transitional: i, paramsSerializer: c, headers: f } = s;
    i !== void 0 && ut.assertOptions(i, {
      silentJSONParsing: le.transitional(le.boolean),
      forcedJSONParsing: le.transitional(le.boolean),
      clarifyTimeoutError: le.transitional(le.boolean)
    }, !1), c != null && (m.isFunction(c) ? s.paramsSerializer = {
      serialize: c
    } : ut.assertOptions(c, {
      encode: le.function,
      serialize: le.function
    }, !0)), s.allowAbsoluteUrls !== void 0 || (this.defaults.allowAbsoluteUrls !== void 0 ? s.allowAbsoluteUrls = this.defaults.allowAbsoluteUrls : s.allowAbsoluteUrls = !0), ut.assertOptions(s, {
      baseUrl: le.spelling("baseURL"),
      withXsrfToken: le.spelling("withXSRFToken")
    }, !0), s.method = (s.method || this.defaults.method || "get").toLowerCase();
    let l = f && m.merge(
      f.common,
      f[s.method]
    );
    f && m.forEach(
      ["delete", "get", "head", "post", "put", "patch", "common"],
      (w) => {
        delete f[w];
      }
    ), s.headers = ee.concat(l, f);
    const y = [];
    let R = !0;
    this.interceptors.request.forEach(function(N) {
      typeof N.runWhen == "function" && N.runWhen(s) === !1 || (R = R && N.synchronous, y.unshift(N.fulfilled, N.rejected));
    });
    const g = [];
    this.interceptors.response.forEach(function(N) {
      g.push(N.fulfilled, N.rejected);
    });
    let E, S = 0, P;
    if (!R) {
      const w = [Mn.bind(this), void 0];
      for (w.unshift(...y), w.push(...g), P = w.length, E = Promise.resolve(s); S < P; )
        E = E.then(w[S++], w[S++]);
      return E;
    }
    P = y.length;
    let O = s;
    for (; S < P; ) {
      const w = y[S++], N = y[S++];
      try {
        O = w(O);
      } catch (T) {
        N.call(this, T);
        break;
      }
    }
    try {
      E = Mn.call(this, O);
    } catch (w) {
      return Promise.reject(w);
    }
    for (S = 0, P = g.length; S < P; )
      E = E.then(g[S++], g[S++]);
    return E;
  }
  getUri(n) {
    n = Re(this.defaults, n);
    const s = fr(n.baseURL, n.url, n.allowAbsoluteUrls);
    return ir(s, n.params, n.paramsSerializer);
  }
};
m.forEach(["delete", "get", "head", "options"], function(n) {
  Ee.prototype[n] = function(s, i) {
    return this.request(Re(i || {}, {
      method: n,
      url: s,
      data: (i || {}).data
    }));
  };
});
m.forEach(["post", "put", "patch"], function(n) {
  function s(i) {
    return function(f, l, y) {
      return this.request(Re(y || {}, {
        method: n,
        headers: i ? {
          "Content-Type": "multipart/form-data"
        } : {},
        url: f,
        data: l
      }));
    };
  }
  Ee.prototype[n] = s(), Ee.prototype[n + "Form"] = s(!0);
});
let ei = class yr {
  constructor(n) {
    if (typeof n != "function")
      throw new TypeError("executor must be a function.");
    let s;
    this.promise = new Promise(function(f) {
      s = f;
    });
    const i = this;
    this.promise.then((c) => {
      if (!i._listeners) return;
      let f = i._listeners.length;
      for (; f-- > 0; )
        i._listeners[f](c);
      i._listeners = null;
    }), this.promise.then = (c) => {
      let f;
      const l = new Promise((y) => {
        i.subscribe(y), f = y;
      }).then(c);
      return l.cancel = function() {
        i.unsubscribe(f);
      }, l;
    }, n(function(f, l, y) {
      i.reason || (i.reason = new _e(f, l, y), s(i.reason));
    });
  }
  /**
   * Throws a `CanceledError` if cancellation has been requested.
   */
  throwIfRequested() {
    if (this.reason)
      throw this.reason;
  }
  /**
   * Subscribe to the cancel signal
   */
  subscribe(n) {
    if (this.reason) {
      n(this.reason);
      return;
    }
    this._listeners ? this._listeners.push(n) : this._listeners = [n];
  }
  /**
   * Unsubscribe from the cancel signal
   */
  unsubscribe(n) {
    if (!this._listeners)
      return;
    const s = this._listeners.indexOf(n);
    s !== -1 && this._listeners.splice(s, 1);
  }
  toAbortSignal() {
    const n = new AbortController(), s = (i) => {
      n.abort(i);
    };
    return this.subscribe(s), n.signal.unsubscribe = () => this.unsubscribe(s), n.signal;
  }
  /**
   * Returns an object that contains a new `CancelToken` and a function that, when called,
   * cancels the `CancelToken`.
   */
  static source() {
    let n;
    return {
      token: new yr(function(c) {
        n = c;
      }),
      cancel: n
    };
  }
};
function ti(e) {
  return function(s) {
    return e.apply(null, s);
  };
}
function ni(e) {
  return m.isObject(e) && e.isAxiosError === !0;
}
const jt = {
  Continue: 100,
  SwitchingProtocols: 101,
  Processing: 102,
  EarlyHints: 103,
  Ok: 200,
  Created: 201,
  Accepted: 202,
  NonAuthoritativeInformation: 203,
  NoContent: 204,
  ResetContent: 205,
  PartialContent: 206,
  MultiStatus: 207,
  AlreadyReported: 208,
  ImUsed: 226,
  MultipleChoices: 300,
  MovedPermanently: 301,
  Found: 302,
  SeeOther: 303,
  NotModified: 304,
  UseProxy: 305,
  Unused: 306,
  TemporaryRedirect: 307,
  PermanentRedirect: 308,
  BadRequest: 400,
  Unauthorized: 401,
  PaymentRequired: 402,
  Forbidden: 403,
  NotFound: 404,
  MethodNotAllowed: 405,
  NotAcceptable: 406,
  ProxyAuthenticationRequired: 407,
  RequestTimeout: 408,
  Conflict: 409,
  Gone: 410,
  LengthRequired: 411,
  PreconditionFailed: 412,
  PayloadTooLarge: 413,
  UriTooLong: 414,
  UnsupportedMediaType: 415,
  RangeNotSatisfiable: 416,
  ExpectationFailed: 417,
  ImATeapot: 418,
  MisdirectedRequest: 421,
  UnprocessableEntity: 422,
  Locked: 423,
  FailedDependency: 424,
  TooEarly: 425,
  UpgradeRequired: 426,
  PreconditionRequired: 428,
  TooManyRequests: 429,
  RequestHeaderFieldsTooLarge: 431,
  UnavailableForLegalReasons: 451,
  InternalServerError: 500,
  NotImplemented: 501,
  BadGateway: 502,
  ServiceUnavailable: 503,
  GatewayTimeout: 504,
  HttpVersionNotSupported: 505,
  VariantAlsoNegotiates: 506,
  InsufficientStorage: 507,
  LoopDetected: 508,
  NotExtended: 510,
  NetworkAuthenticationRequired: 511,
  WebServerIsDown: 521,
  ConnectionTimedOut: 522,
  OriginIsUnreachable: 523,
  TimeoutOccurred: 524,
  SslHandshakeFailed: 525,
  InvalidSslCertificate: 526
};
Object.entries(jt).forEach(([e, n]) => {
  jt[n] = e;
});
function wr(e) {
  const n = new Ee(e), s = Vn(Ee.prototype.request, n);
  return m.extend(s, Ee.prototype, n, { allOwnKeys: !0 }), m.extend(s, n, null, { allOwnKeys: !0 }), s.create = function(c) {
    return wr(Re(e, c));
  }, s;
}
const $ = wr(ve);
$.Axios = Ee;
$.CanceledError = _e;
$.CancelToken = ei;
$.isCancel = ur;
$.VERSION = mr;
$.toFormData = mt;
$.AxiosError = B;
$.Cancel = $.CanceledError;
$.all = function(n) {
  return Promise.all(n);
};
$.spread = ti;
$.isAxiosError = ni;
$.mergeConfig = Re;
$.AxiosHeaders = ee;
$.formToJSON = (e) => cr(m.isHTMLForm(e) ? new FormData(e) : e);
$.getAdapter = pr.getAdapter;
$.HttpStatusCode = jt;
$.default = $;
const {
  Axios: Ri,
  AxiosError: Si,
  CanceledError: Oi,
  isCancel: Ti,
  CancelToken: Ai,
  VERSION: Ci,
  all: xi,
  Cancel: Pi,
  isAxiosError: Ni,
  spread: _i,
  toFormData: Fi,
  AxiosHeaders: ki,
  HttpStatusCode: Ui,
  formToJSON: Li,
  getAdapter: Bi,
  mergeConfig: Di
} = $;
var ri = typeof globalThis < "u" ? globalThis : typeof window < "u" ? window : typeof global < "u" ? global : typeof self < "u" ? self : {};
function si(e) {
  return e && e.__esModule && Object.prototype.hasOwnProperty.call(e, "default") ? e.default : e;
}
var lt = { exports: {} };
var Lt, Jn;
function oi() {
  if (Jn) return Lt;
  Jn = 1;
  function e(t, r) {
    return function() {
      return t.apply(r, arguments);
    };
  }
  const { toString: n } = Object.prototype, { getPrototypeOf: s } = Object, { iterator: i, toStringTag: c } = Symbol, f = /* @__PURE__ */ ((t) => (r) => {
    const o = n.call(r);
    return t[o] || (t[o] = o.slice(8, -1).toLowerCase());
  })(/* @__PURE__ */ Object.create(null)), l = (t) => (t = t.toLowerCase(), (r) => f(r) === t), y = (t) => (r) => typeof r === t, { isArray: R } = Array, g = y("undefined");
  function E(t) {
    return t !== null && !g(t) && t.constructor !== null && !g(t.constructor) && w(t.constructor.isBuffer) && t.constructor.isBuffer(t);
  }
  const S = l("ArrayBuffer");
  function P(t) {
    let r;
    return typeof ArrayBuffer < "u" && ArrayBuffer.isView ? r = ArrayBuffer.isView(t) : r = t && t.buffer && S(t.buffer), r;
  }
  const O = y("string"), w = y("function"), N = y("number"), T = (t) => t !== null && typeof t == "object", D = (t) => t === !0 || t === !1, j = (t) => {
    if (f(t) !== "object")
      return !1;
    const r = s(t);
    return (r === null || r === Object.prototype || Object.getPrototypeOf(r) === null) && !(c in t) && !(i in t);
  }, I = (t) => {
    if (!T(t) || E(t))
      return !1;
    try {
      return Object.keys(t).length === 0 && Object.getPrototypeOf(t) === Object.prototype;
    } catch {
      return !1;
    }
  }, H = l("Date"), M = l("File"), te = l("Blob"), G = l("FileList"), Fe = (t) => T(t) && w(t.pipe), Se = (t) => {
    let r;
    return t && (typeof FormData == "function" && t instanceof FormData || w(t.append) && ((r = f(t)) === "formdata" || // detect form-data instance
    r === "object" && w(t.toString) && t.toString() === "[object FormData]"));
  }, Me = l("URLSearchParams"), [ze, Oe, me, fe] = ["ReadableStream", "Request", "Response", "Headers"].map(l), Je = (t) => t.trim ? t.trim() : t.replace(/^[\s\uFEFF\xA0]+|[\s\uFEFF\xA0]+$/g, "");
  function W(t, r, { allOwnKeys: o = !1 } = {}) {
    if (t === null || typeof t > "u")
      return;
    let a, u;
    if (typeof t != "object" && (t = [t]), R(t))
      for (a = 0, u = t.length; a < u; a++)
        r.call(null, t[a], a, t);
    else {
      if (E(t))
        return;
      const h = o ? Object.getOwnPropertyNames(t) : Object.keys(t), d = h.length;
      let b;
      for (a = 0; a < d; a++)
        b = h[a], r.call(null, t[b], b, t);
    }
  }
  function ke(t, r) {
    if (E(t))
      return null;
    r = r.toLowerCase();
    const o = Object.keys(t);
    let a = o.length, u;
    for (; a-- > 0; )
      if (u = o[a], r === u.toLowerCase())
        return u;
    return null;
  }
  const K = typeof globalThis < "u" ? globalThis : typeof self < "u" ? self : typeof window < "u" ? window : ri, Ue = (t) => !g(t) && t !== K;
  function Le() {
    const { caseless: t, skipUndefined: r } = Ue(this) && this || {}, o = {}, a = (u, h) => {
      const d = t && ke(o, h) || h;
      j(o[d]) && j(u) ? o[d] = Le(o[d], u) : j(u) ? o[d] = Le({}, u) : R(u) ? o[d] = u.slice() : (!r || !g(u)) && (o[d] = u);
    };
    for (let u = 0, h = arguments.length; u < h; u++)
      arguments[u] && W(arguments[u], a);
    return o;
  }
  const ae = (t, r, o, { allOwnKeys: a } = {}) => (W(r, (u, h) => {
    o && w(u) ? t[h] = e(u, o) : t[h] = u;
  }, { allOwnKeys: a }), t), de = (t) => (t.charCodeAt(0) === 65279 && (t = t.slice(1)), t), Be = (t, r, o, a) => {
    t.prototype = Object.create(r.prototype, a), t.prototype.constructor = t, Object.defineProperty(t, "super", {
      value: r.prototype
    }), o && Object.assign(t.prototype, o);
  }, Te = (t, r, o, a) => {
    let u, h, d;
    const b = {};
    if (r = r || {}, t == null) return r;
    do {
      for (u = Object.getOwnPropertyNames(t), h = u.length; h-- > 0; )
        d = u[h], (!a || a(d, t, r)) && !b[d] && (r[d] = t[d], b[d] = !0);
      t = o !== !1 && s(t);
    } while (t && (!o || o(t, r)) && t !== Object.prototype);
    return r;
  }, We = (t, r, o) => {
    t = String(t), (o === void 0 || o > t.length) && (o = t.length), o -= r.length;
    const a = t.indexOf(r, o);
    return a !== -1 && a === o;
  }, gr = (t) => {
    if (!t) return null;
    if (R(t)) return t;
    let r = t.length;
    if (!N(r)) return null;
    const o = new Array(r);
    for (; r-- > 0; )
      o[r] = t[r];
    return o;
  }, Er = /* @__PURE__ */ ((t) => (r) => t && r instanceof t)(typeof Uint8Array < "u" && s(Uint8Array)), Rr = (t, r) => {
    const a = (t && t[i]).call(t);
    let u;
    for (; (u = a.next()) && !u.done; ) {
      const h = u.value;
      r.call(t, h[0], h[1]);
    }
  }, Sr = (t, r) => {
    let o;
    const a = [];
    for (; (o = t.exec(r)) !== null; )
      a.push(o);
    return a;
  }, Or = l("HTMLFormElement"), Tr = (t) => t.toLowerCase().replace(
    /[-_\s]([a-z\d])(\w*)/g,
    function(o, a, u) {
      return a.toUpperCase() + u;
    }
  ), Mt = (({ hasOwnProperty: t }) => (r, o) => t.call(r, o))(Object.prototype), Ar = l("RegExp"), zt = (t, r) => {
    const o = Object.getOwnPropertyDescriptors(t), a = {};
    W(o, (u, h) => {
      let d;
      (d = r(u, h, t)) !== !1 && (a[h] = d || u);
    }), Object.defineProperties(t, a);
  }, Cr = (t) => {
    zt(t, (r, o) => {
      if (w(t) && ["arguments", "caller", "callee"].indexOf(o) !== -1)
        return !1;
      const a = t[o];
      if (w(a)) {
        if (r.enumerable = !1, "writable" in r) {
          r.writable = !1;
          return;
        }
        r.set || (r.set = () => {
          throw Error("Can not rewrite read-only method '" + o + "'");
        });
      }
    });
  }, xr = (t, r) => {
    const o = {}, a = (u) => {
      u.forEach((h) => {
        o[h] = !0;
      });
    };
    return R(t) ? a(t) : a(String(t).split(r)), o;
  }, Pr = () => {
  }, Nr = (t, r) => t != null && Number.isFinite(t = +t) ? t : r;
  function _r(t) {
    return !!(t && w(t.append) && t[c] === "FormData" && t[i]);
  }
  const Fr = (t) => {
    const r = new Array(10), o = (a, u) => {
      if (T(a)) {
        if (r.indexOf(a) >= 0)
          return;
        if (E(a))
          return a;
        if (!("toJSON" in a)) {
          r[u] = a;
          const h = R(a) ? [] : {};
          return W(a, (d, b) => {
            const _ = o(d, u + 1);
            !g(_) && (h[b] = _);
          }), r[u] = void 0, h;
        }
      }
      return a;
    };
    return o(t, 0);
  }, kr = l("AsyncFunction"), Ur = (t) => t && (T(t) || w(t)) && w(t.then) && w(t.catch), Jt = ((t, r) => t ? setImmediate : r ? ((o, a) => (K.addEventListener("message", ({ source: u, data: h }) => {
    u === K && h === o && a.length && a.shift()();
  }, !1), (u) => {
    a.push(u), K.postMessage(o, "*");
  }))(`axios@${Math.random()}`, []) : (o) => setTimeout(o))(
    typeof setImmediate == "function",
    w(K.postMessage)
  ), Lr = typeof queueMicrotask < "u" ? queueMicrotask.bind(K) : typeof process < "u" && process.nextTick || Jt;
  var p = {
    isArray: R,
    isArrayBuffer: S,
    isBuffer: E,
    isFormData: Se,
    isArrayBufferView: P,
    isString: O,
    isNumber: N,
    isBoolean: D,
    isObject: T,
    isPlainObject: j,
    isEmptyObject: I,
    isReadableStream: ze,
    isRequest: Oe,
    isResponse: me,
    isHeaders: fe,
    isUndefined: g,
    isDate: H,
    isFile: M,
    isBlob: te,
    isRegExp: Ar,
    isFunction: w,
    isStream: Fe,
    isURLSearchParams: Me,
    isTypedArray: Er,
    isFileList: G,
    forEach: W,
    merge: Le,
    extend: ae,
    trim: Je,
    stripBOM: de,
    inherits: Be,
    toFlatObject: Te,
    kindOf: f,
    kindOfTest: l,
    endsWith: We,
    toArray: gr,
    forEachEntry: Rr,
    matchAll: Sr,
    isHTMLForm: Or,
    hasOwnProperty: Mt,
    hasOwnProp: Mt,
    // an alias to avoid ESLint no-prototype-builtins detection
    reduceDescriptors: zt,
    freezeMethods: Cr,
    toObjectSet: xr,
    toCamelCase: Tr,
    noop: Pr,
    toFiniteNumber: Nr,
    findKey: ke,
    global: K,
    isContextDefined: Ue,
    isSpecCompliantForm: _r,
    toJSONObject: Fr,
    isAsyncFn: kr,
    isThenable: Ur,
    setImmediate: Jt,
    asap: Lr,
    isIterable: (t) => t != null && w(t[i])
  };
  function L(t, r, o, a, u) {
    Error.call(this), Error.captureStackTrace ? Error.captureStackTrace(this, this.constructor) : this.stack = new Error().stack, this.message = t, this.name = "AxiosError", r && (this.code = r), o && (this.config = o), a && (this.request = a), u && (this.response = u, this.status = u.status ? u.status : null);
  }
  p.inherits(L, Error, {
    toJSON: function() {
      return {
        // Standard
        message: this.message,
        name: this.name,
        // Microsoft
        description: this.description,
        number: this.number,
        // Mozilla
        fileName: this.fileName,
        lineNumber: this.lineNumber,
        columnNumber: this.columnNumber,
        stack: this.stack,
        // Axios
        config: p.toJSONObject(this.config),
        code: this.code,
        status: this.status
      };
    }
  });
  const Wt = L.prototype, Kt = {};
  [
    "ERR_BAD_OPTION_VALUE",
    "ERR_BAD_OPTION",
    "ECONNABORTED",
    "ETIMEDOUT",
    "ERR_NETWORK",
    "ERR_FR_TOO_MANY_REDIRECTS",
    "ERR_DEPRECATED",
    "ERR_BAD_RESPONSE",
    "ERR_BAD_REQUEST",
    "ERR_CANCELED",
    "ERR_NOT_SUPPORT",
    "ERR_INVALID_URL"
    // eslint-disable-next-line func-names
  ].forEach((t) => {
    Kt[t] = { value: t };
  }), Object.defineProperties(L, Kt), Object.defineProperty(Wt, "isAxiosError", { value: !0 }), L.from = (t, r, o, a, u, h) => {
    const d = Object.create(Wt);
    p.toFlatObject(t, d, function(A) {
      return A !== Error.prototype;
    }, (x) => x !== "isAxiosError");
    const b = t && t.message ? t.message : "Error", _ = r == null && t ? t.code : r;
    return L.call(d, b, _, o, a, u), t && d.cause == null && Object.defineProperty(d, "cause", { value: t, configurable: !0 }), d.name = t && t.name || "Error", h && Object.assign(d, h), d;
  };
  var Br = null;
  function wt(t) {
    return p.isPlainObject(t) || p.isArray(t);
  }
  function Vt(t) {
    return p.endsWith(t, "[]") ? t.slice(0, -2) : t;
  }
  function Xt(t, r, o) {
    return t ? t.concat(r).map(function(u, h) {
      return u = Vt(u), !o && h ? "[" + u + "]" : u;
    }).join(o ? "." : "") : r;
  }
  function Dr(t) {
    return p.isArray(t) && !t.some(wt);
  }
  const Ir = p.toFlatObject(p, {}, null, function(r) {
    return /^is[A-Z]/.test(r);
  });
  function Ke(t, r, o) {
    if (!p.isObject(t))
      throw new TypeError("target must be an object");
    r = r || new FormData(), o = p.toFlatObject(o, {
      metaTokens: !0,
      dots: !1,
      indexes: !1
    }, !1, function(U, F) {
      return !p.isUndefined(F[U]);
    });
    const a = o.metaTokens, u = o.visitor || A, h = o.dots, d = o.indexes, _ = (o.Blob || typeof Blob < "u" && Blob) && p.isSpecCompliantForm(r);
    if (!p.isFunction(u))
      throw new TypeError("visitor must be a function");
    function x(C) {
      if (C === null) return "";
      if (p.isDate(C))
        return C.toISOString();
      if (p.isBoolean(C))
        return C.toString();
      if (!_ && p.isBlob(C))
        throw new L("Blob is not supported. Use a Buffer instead.");
      return p.isArrayBuffer(C) || p.isTypedArray(C) ? _ && typeof Blob == "function" ? new Blob([C]) : Buffer.from(C) : C;
    }
    function A(C, U, F) {
      let z = C;
      if (C && !F && typeof C == "object") {
        if (p.endsWith(U, "{}"))
          U = a ? U : U.slice(0, -2), C = JSON.stringify(C);
        else if (p.isArray(C) && Dr(C) || (p.isFileList(C) || p.endsWith(U, "[]")) && (z = p.toArray(C)))
          return U = Vt(U), z.forEach(function(J, Z) {
            !(p.isUndefined(J) || J === null) && r.append(
              // eslint-disable-next-line no-nested-ternary
              d === !0 ? Xt([U], Z, h) : d === null ? U : U + "[]",
              x(J)
            );
          }), !1;
      }
      return wt(C) ? !0 : (r.append(Xt(F, U, h), x(C)), !1);
    }
    const k = [], q = Object.assign(Ir, {
      defaultVisitor: A,
      convertValue: x,
      isVisitable: wt
    });
    function X(C, U) {
      if (!p.isUndefined(C)) {
        if (k.indexOf(C) !== -1)
          throw Error("Circular reference detected in " + U.join("."));
        k.push(C), p.forEach(C, function(z, ne) {
          (!(p.isUndefined(z) || z === null) && u.call(
            r,
            z,
            p.isString(ne) ? ne.trim() : ne,
            U,
            q
          )) === !0 && X(z, U ? U.concat(ne) : [ne]);
        }), k.pop();
      }
    }
    if (!p.isObject(t))
      throw new TypeError("data must be an object");
    return X(t), r;
  }
  function Qt(t) {
    const r = {
      "!": "%21",
      "'": "%27",
      "(": "%28",
      ")": "%29",
      "~": "%7E",
      "%20": "+",
      "%00": "\0"
    };
    return encodeURIComponent(t).replace(/[!'()~]|%20|%00/g, function(a) {
      return r[a];
    });
  }
  function bt(t, r) {
    this._pairs = [], t && Ke(t, this, r);
  }
  const Gt = bt.prototype;
  Gt.append = function(r, o) {
    this._pairs.push([r, o]);
  }, Gt.toString = function(r) {
    const o = r ? function(a) {
      return r.call(this, a, Qt);
    } : Qt;
    return this._pairs.map(function(u) {
      return o(u[0]) + "=" + o(u[1]);
    }, "").join("&");
  };
  function jr(t) {
    return encodeURIComponent(t).replace(/%3A/gi, ":").replace(/%24/g, "$").replace(/%2C/gi, ",").replace(/%20/g, "+");
  }
  function Zt(t, r, o) {
    if (!r)
      return t;
    const a = o && o.encode || jr;
    p.isFunction(o) && (o = {
      serialize: o
    });
    const u = o && o.serialize;
    let h;
    if (u ? h = u(r, o) : h = p.isURLSearchParams(r) ? r.toString() : new bt(r, o).toString(a), h) {
      const d = t.indexOf("#");
      d !== -1 && (t = t.slice(0, d)), t += (t.indexOf("?") === -1 ? "?" : "&") + h;
    }
    return t;
  }
  class qr {
    constructor() {
      this.handlers = [];
    }
    /**
     * Add a new interceptor to the stack
     *
     * @param {Function} fulfilled The function to handle `then` for a `Promise`
     * @param {Function} rejected The function to handle `reject` for a `Promise`
     *
     * @return {Number} An ID used to remove interceptor later
     */
    use(r, o, a) {
      return this.handlers.push({
        fulfilled: r,
        rejected: o,
        synchronous: a ? a.synchronous : !1,
        runWhen: a ? a.runWhen : null
      }), this.handlers.length - 1;
    }
    /**
     * Remove an interceptor from the stack
     *
     * @param {Number} id The ID that was returned by `use`
     *
     * @returns {void}
     */
    eject(r) {
      this.handlers[r] && (this.handlers[r] = null);
    }
    /**
     * Clear all interceptors from the stack
     *
     * @returns {void}
     */
    clear() {
      this.handlers && (this.handlers = []);
    }
    /**
     * Iterate over all the registered interceptors
     *
     * This method is particularly useful for skipping over any
     * interceptors that may have become `null` calling `eject`.
     *
     * @param {Function} fn The function to call for each interceptor
     *
     * @returns {void}
     */
    forEach(r) {
      p.forEach(this.handlers, function(a) {
        a !== null && r(a);
      });
    }
  }
  var Yt = qr, en = {
    silentJSONParsing: !0,
    forcedJSONParsing: !0,
    clarifyTimeoutError: !1
  }, Hr = typeof URLSearchParams < "u" ? URLSearchParams : bt, $r = typeof FormData < "u" ? FormData : null, vr = typeof Blob < "u" ? Blob : null, Mr = {
    isBrowser: !0,
    classes: {
      URLSearchParams: Hr,
      FormData: $r,
      Blob: vr
    },
    protocols: ["http", "https", "file", "blob", "url", "data"]
  };
  const gt = typeof window < "u" && typeof document < "u", Et = typeof navigator == "object" && navigator || void 0, zr = gt && (!Et || ["ReactNative", "NativeScript", "NS"].indexOf(Et.product) < 0), Jr = typeof WorkerGlobalScope < "u" && // eslint-disable-next-line no-undef
  self instanceof WorkerGlobalScope && typeof self.importScripts == "function", Wr = gt && window.location.href || "http://localhost";
  var Kr = /* @__PURE__ */ Object.freeze({
    __proto__: null,
    hasBrowserEnv: gt,
    hasStandardBrowserWebWorkerEnv: Jr,
    hasStandardBrowserEnv: zr,
    navigator: Et,
    origin: Wr
  }), V = {
    ...Kr,
    ...Mr
  };
  function Vr(t, r) {
    return Ke(t, new V.classes.URLSearchParams(), {
      visitor: function(o, a, u, h) {
        return V.isNode && p.isBuffer(o) ? (this.append(a, o.toString("base64")), !1) : h.defaultVisitor.apply(this, arguments);
      },
      ...r
    });
  }
  function Xr(t) {
    return p.matchAll(/\w+|\[(\w*)]/g, t).map((r) => r[0] === "[]" ? "" : r[1] || r[0]);
  }
  function Qr(t) {
    const r = {}, o = Object.keys(t);
    let a;
    const u = o.length;
    let h;
    for (a = 0; a < u; a++)
      h = o[a], r[h] = t[h];
    return r;
  }
  function tn(t) {
    function r(o, a, u, h) {
      let d = o[h++];
      if (d === "__proto__") return !0;
      const b = Number.isFinite(+d), _ = h >= o.length;
      return d = !d && p.isArray(u) ? u.length : d, _ ? (p.hasOwnProp(u, d) ? u[d] = [u[d], a] : u[d] = a, !b) : ((!u[d] || !p.isObject(u[d])) && (u[d] = []), r(o, a, u[d], h) && p.isArray(u[d]) && (u[d] = Qr(u[d])), !b);
    }
    if (p.isFormData(t) && p.isFunction(t.entries)) {
      const o = {};
      return p.forEachEntry(t, (a, u) => {
        r(Xr(a), u, o, 0);
      }), o;
    }
    return null;
  }
  function Gr(t, r, o) {
    if (p.isString(t))
      try {
        return (r || JSON.parse)(t), p.trim(t);
      } catch (a) {
        if (a.name !== "SyntaxError")
          throw a;
      }
    return (o || JSON.stringify)(t);
  }
  const Rt = {
    transitional: en,
    adapter: ["xhr", "http", "fetch"],
    transformRequest: [function(r, o) {
      const a = o.getContentType() || "", u = a.indexOf("application/json") > -1, h = p.isObject(r);
      if (h && p.isHTMLForm(r) && (r = new FormData(r)), p.isFormData(r))
        return u ? JSON.stringify(tn(r)) : r;
      if (p.isArrayBuffer(r) || p.isBuffer(r) || p.isStream(r) || p.isFile(r) || p.isBlob(r) || p.isReadableStream(r))
        return r;
      if (p.isArrayBufferView(r))
        return r.buffer;
      if (p.isURLSearchParams(r))
        return o.setContentType("application/x-www-form-urlencoded;charset=utf-8", !1), r.toString();
      let b;
      if (h) {
        if (a.indexOf("application/x-www-form-urlencoded") > -1)
          return Vr(r, this.formSerializer).toString();
        if ((b = p.isFileList(r)) || a.indexOf("multipart/form-data") > -1) {
          const _ = this.env && this.env.FormData;
          return Ke(
            b ? { "files[]": r } : r,
            _ && new _(),
            this.formSerializer
          );
        }
      }
      return h || u ? (o.setContentType("application/json", !1), Gr(r)) : r;
    }],
    transformResponse: [function(r) {
      const o = this.transitional || Rt.transitional, a = o && o.forcedJSONParsing, u = this.responseType === "json";
      if (p.isResponse(r) || p.isReadableStream(r))
        return r;
      if (r && p.isString(r) && (a && !this.responseType || u)) {
        const d = !(o && o.silentJSONParsing) && u;
        try {
          return JSON.parse(r, this.parseReviver);
        } catch (b) {
          if (d)
            throw b.name === "SyntaxError" ? L.from(b, L.ERR_BAD_RESPONSE, this, null, this.response) : b;
        }
      }
      return r;
    }],
    /**
     * A timeout in milliseconds to abort a request. If set to 0 (default) a
     * timeout is not created.
     */
    timeout: 0,
    xsrfCookieName: "XSRF-TOKEN",
    xsrfHeaderName: "X-XSRF-TOKEN",
    maxContentLength: -1,
    maxBodyLength: -1,
    env: {
      FormData: V.classes.FormData,
      Blob: V.classes.Blob
    },
    validateStatus: function(r) {
      return r >= 200 && r < 300;
    },
    headers: {
      common: {
        Accept: "application/json, text/plain, */*",
        "Content-Type": void 0
      }
    }
  };
  p.forEach(["delete", "get", "head", "post", "put", "patch"], (t) => {
    Rt.headers[t] = {};
  });
  var St = Rt;
  const Zr = p.toObjectSet([
    "age",
    "authorization",
    "content-length",
    "content-type",
    "etag",
    "expires",
    "from",
    "host",
    "if-modified-since",
    "if-unmodified-since",
    "last-modified",
    "location",
    "max-forwards",
    "proxy-authorization",
    "referer",
    "retry-after",
    "user-agent"
  ]);
  var Yr = (t) => {
    const r = {};
    let o, a, u;
    return t && t.split(`
`).forEach(function(d) {
      u = d.indexOf(":"), o = d.substring(0, u).trim().toLowerCase(), a = d.substring(u + 1).trim(), !(!o || r[o] && Zr[o]) && (o === "set-cookie" ? r[o] ? r[o].push(a) : r[o] = [a] : r[o] = r[o] ? r[o] + ", " + a : a);
    }), r;
  };
  const nn = Symbol("internals");
  function De(t) {
    return t && String(t).trim().toLowerCase();
  }
  function Ve(t) {
    return t === !1 || t == null ? t : p.isArray(t) ? t.map(Ve) : String(t);
  }
  function es(t) {
    const r = /* @__PURE__ */ Object.create(null), o = /([^\s,;=]+)\s*(?:=\s*([^,;]+))?/g;
    let a;
    for (; a = o.exec(t); )
      r[a[1]] = a[2];
    return r;
  }
  const ts = (t) => /^[-_a-zA-Z0-9^`|~,!#$%&'*+.]+$/.test(t.trim());
  function Ot(t, r, o, a, u) {
    if (p.isFunction(a))
      return a.call(this, r, o);
    if (u && (r = o), !!p.isString(r)) {
      if (p.isString(a))
        return r.indexOf(a) !== -1;
      if (p.isRegExp(a))
        return a.test(r);
    }
  }
  function ns(t) {
    return t.trim().toLowerCase().replace(/([a-z\d])(\w*)/g, (r, o, a) => o.toUpperCase() + a);
  }
  function rs(t, r) {
    const o = p.toCamelCase(" " + r);
    ["get", "set", "has"].forEach((a) => {
      Object.defineProperty(t, a + o, {
        value: function(u, h, d) {
          return this[a].call(this, r, u, h, d);
        },
        configurable: !0
      });
    });
  }
  class Xe {
    constructor(r) {
      r && this.set(r);
    }
    set(r, o, a) {
      const u = this;
      function h(b, _, x) {
        const A = De(_);
        if (!A)
          throw new Error("header name must be a non-empty string");
        const k = p.findKey(u, A);
        (!k || u[k] === void 0 || x === !0 || x === void 0 && u[k] !== !1) && (u[k || _] = Ve(b));
      }
      const d = (b, _) => p.forEach(b, (x, A) => h(x, A, _));
      if (p.isPlainObject(r) || r instanceof this.constructor)
        d(r, o);
      else if (p.isString(r) && (r = r.trim()) && !ts(r))
        d(Yr(r), o);
      else if (p.isObject(r) && p.isIterable(r)) {
        let b = {}, _, x;
        for (const A of r) {
          if (!p.isArray(A))
            throw TypeError("Object iterator must return a key-value pair");
          b[x = A[0]] = (_ = b[x]) ? p.isArray(_) ? [..._, A[1]] : [_, A[1]] : A[1];
        }
        d(b, o);
      } else
        r != null && h(o, r, a);
      return this;
    }
    get(r, o) {
      if (r = De(r), r) {
        const a = p.findKey(this, r);
        if (a) {
          const u = this[a];
          if (!o)
            return u;
          if (o === !0)
            return es(u);
          if (p.isFunction(o))
            return o.call(this, u, a);
          if (p.isRegExp(o))
            return o.exec(u);
          throw new TypeError("parser must be boolean|regexp|function");
        }
      }
    }
    has(r, o) {
      if (r = De(r), r) {
        const a = p.findKey(this, r);
        return !!(a && this[a] !== void 0 && (!o || Ot(this, this[a], a, o)));
      }
      return !1;
    }
    delete(r, o) {
      const a = this;
      let u = !1;
      function h(d) {
        if (d = De(d), d) {
          const b = p.findKey(a, d);
          b && (!o || Ot(a, a[b], b, o)) && (delete a[b], u = !0);
        }
      }
      return p.isArray(r) ? r.forEach(h) : h(r), u;
    }
    clear(r) {
      const o = Object.keys(this);
      let a = o.length, u = !1;
      for (; a--; ) {
        const h = o[a];
        (!r || Ot(this, this[h], h, r, !0)) && (delete this[h], u = !0);
      }
      return u;
    }
    normalize(r) {
      const o = this, a = {};
      return p.forEach(this, (u, h) => {
        const d = p.findKey(a, h);
        if (d) {
          o[d] = Ve(u), delete o[h];
          return;
        }
        const b = r ? ns(h) : String(h).trim();
        b !== h && delete o[h], o[b] = Ve(u), a[b] = !0;
      }), this;
    }
    concat(...r) {
      return this.constructor.concat(this, ...r);
    }
    toJSON(r) {
      const o = /* @__PURE__ */ Object.create(null);
      return p.forEach(this, (a, u) => {
        a != null && a !== !1 && (o[u] = r && p.isArray(a) ? a.join(", ") : a);
      }), o;
    }
    [Symbol.iterator]() {
      return Object.entries(this.toJSON())[Symbol.iterator]();
    }
    toString() {
      return Object.entries(this.toJSON()).map(([r, o]) => r + ": " + o).join(`
`);
    }
    getSetCookie() {
      return this.get("set-cookie") || [];
    }
    get [Symbol.toStringTag]() {
      return "AxiosHeaders";
    }
    static from(r) {
      return r instanceof this ? r : new this(r);
    }
    static concat(r, ...o) {
      const a = new this(r);
      return o.forEach((u) => a.set(u)), a;
    }
    static accessor(r) {
      const a = (this[nn] = this[nn] = {
        accessors: {}
      }).accessors, u = this.prototype;
      function h(d) {
        const b = De(d);
        a[b] || (rs(u, d), a[b] = !0);
      }
      return p.isArray(r) ? r.forEach(h) : h(r), this;
    }
  }
  Xe.accessor(["Content-Type", "Content-Length", "Accept", "Accept-Encoding", "User-Agent", "Authorization"]), p.reduceDescriptors(Xe.prototype, ({ value: t }, r) => {
    let o = r[0].toUpperCase() + r.slice(1);
    return {
      get: () => t,
      set(a) {
        this[o] = a;
      }
    };
  }), p.freezeMethods(Xe);
  var se = Xe;
  function Tt(t, r) {
    const o = this || St, a = r || o, u = se.from(a.headers);
    let h = a.data;
    return p.forEach(t, function(b) {
      h = b.call(o, h, u.normalize(), r ? r.status : void 0);
    }), u.normalize(), h;
  }
  function rn(t) {
    return !!(t && t.__CANCEL__);
  }
  function Ae(t, r, o) {
    L.call(this, t ?? "canceled", L.ERR_CANCELED, r, o), this.name = "CanceledError";
  }
  p.inherits(Ae, L, {
    __CANCEL__: !0
  });
  function sn(t, r, o) {
    const a = o.config.validateStatus;
    !o.status || !a || a(o.status) ? t(o) : r(new L(
      "Request failed with status code " + o.status,
      [L.ERR_BAD_REQUEST, L.ERR_BAD_RESPONSE][Math.floor(o.status / 100) - 4],
      o.config,
      o.request,
      o
    ));
  }
  function ss(t) {
    const r = /^([-+\w]{1,25})(:?\/\/|:)/.exec(t);
    return r && r[1] || "";
  }
  function os(t, r) {
    t = t || 10;
    const o = new Array(t), a = new Array(t);
    let u = 0, h = 0, d;
    return r = r !== void 0 ? r : 1e3, function(_) {
      const x = Date.now(), A = a[h];
      d || (d = x), o[u] = _, a[u] = x;
      let k = h, q = 0;
      for (; k !== u; )
        q += o[k++], k = k % t;
      if (u = (u + 1) % t, u === h && (h = (h + 1) % t), x - d < r)
        return;
      const X = A && x - A;
      return X ? Math.round(q * 1e3 / X) : void 0;
    };
  }
  function is(t, r) {
    let o = 0, a = 1e3 / r, u, h;
    const d = (x, A = Date.now()) => {
      o = A, u = null, h && (clearTimeout(h), h = null), t(...x);
    };
    return [(...x) => {
      const A = Date.now(), k = A - o;
      k >= a ? d(x, A) : (u = x, h || (h = setTimeout(() => {
        h = null, d(u);
      }, a - k)));
    }, () => u && d(u)];
  }
  const Qe = (t, r, o = 3) => {
    let a = 0;
    const u = os(50, 250);
    return is((h) => {
      const d = h.loaded, b = h.lengthComputable ? h.total : void 0, _ = d - a, x = u(_), A = d <= b;
      a = d;
      const k = {
        loaded: d,
        total: b,
        progress: b ? d / b : void 0,
        bytes: _,
        rate: x || void 0,
        estimated: x && b && A ? (b - d) / x : void 0,
        event: h,
        lengthComputable: b != null,
        [r ? "download" : "upload"]: !0
      };
      t(k);
    }, o);
  }, on = (t, r) => {
    const o = t != null;
    return [(a) => r[0]({
      lengthComputable: o,
      total: t,
      loaded: a
    }), r[1]];
  }, an = (t) => (...r) => p.asap(() => t(...r));
  var as = V.hasStandardBrowserEnv ? /* @__PURE__ */ ((t, r) => (o) => (o = new URL(o, V.origin), t.protocol === o.protocol && t.host === o.host && (r || t.port === o.port)))(
    new URL(V.origin),
    V.navigator && /(msie|trident)/i.test(V.navigator.userAgent)
  ) : () => !0, cs = V.hasStandardBrowserEnv ? (
    // Standard browser envs support document.cookie
    {
      write(t, r, o, a, u, h, d) {
        if (typeof document > "u") return;
        const b = [`${t}=${encodeURIComponent(r)}`];
        p.isNumber(o) && b.push(`expires=${new Date(o).toUTCString()}`), p.isString(a) && b.push(`path=${a}`), p.isString(u) && b.push(`domain=${u}`), h === !0 && b.push("secure"), p.isString(d) && b.push(`SameSite=${d}`), document.cookie = b.join("; ");
      },
      read(t) {
        if (typeof document > "u") return null;
        const r = document.cookie.match(new RegExp("(?:^|; )" + t + "=([^;]*)"));
        return r ? decodeURIComponent(r[1]) : null;
      },
      remove(t) {
        this.write(t, "", Date.now() - 864e5, "/");
      }
    }
  ) : (
    // Non-standard browser env (web workers, react-native) lack needed support.
    {
      write() {
      },
      read() {
        return null;
      },
      remove() {
      }
    }
  );
  function us(t) {
    return /^([a-z][a-z\d+\-.]*:)?\/\//i.test(t);
  }
  function ls(t, r) {
    return r ? t.replace(/\/?\/$/, "") + "/" + r.replace(/^\/+/, "") : t;
  }
  function cn(t, r, o) {
    let a = !us(r);
    return t && (a || o == !1) ? ls(t, r) : r;
  }
  const un = (t) => t instanceof se ? { ...t } : t;
  function ye(t, r) {
    r = r || {};
    const o = {};
    function a(x, A, k, q) {
      return p.isPlainObject(x) && p.isPlainObject(A) ? p.merge.call({ caseless: q }, x, A) : p.isPlainObject(A) ? p.merge({}, A) : p.isArray(A) ? A.slice() : A;
    }
    function u(x, A, k, q) {
      if (p.isUndefined(A)) {
        if (!p.isUndefined(x))
          return a(void 0, x, k, q);
      } else return a(x, A, k, q);
    }
    function h(x, A) {
      if (!p.isUndefined(A))
        return a(void 0, A);
    }
    function d(x, A) {
      if (p.isUndefined(A)) {
        if (!p.isUndefined(x))
          return a(void 0, x);
      } else return a(void 0, A);
    }
    function b(x, A, k) {
      if (k in r)
        return a(x, A);
      if (k in t)
        return a(void 0, x);
    }
    const _ = {
      url: h,
      method: h,
      data: h,
      baseURL: d,
      transformRequest: d,
      transformResponse: d,
      paramsSerializer: d,
      timeout: d,
      timeoutMessage: d,
      withCredentials: d,
      withXSRFToken: d,
      adapter: d,
      responseType: d,
      xsrfCookieName: d,
      xsrfHeaderName: d,
      onUploadProgress: d,
      onDownloadProgress: d,
      decompress: d,
      maxContentLength: d,
      maxBodyLength: d,
      beforeRedirect: d,
      transport: d,
      httpAgent: d,
      httpsAgent: d,
      cancelToken: d,
      socketPath: d,
      responseEncoding: d,
      validateStatus: b,
      headers: (x, A, k) => u(un(x), un(A), k, !0)
    };
    return p.forEach(Object.keys({ ...t, ...r }), function(A) {
      const k = _[A] || u, q = k(t[A], r[A], A);
      p.isUndefined(q) && k !== b || (o[A] = q);
    }), o;
  }
  var ln = (t) => {
    const r = ye({}, t);
    let { data: o, withXSRFToken: a, xsrfHeaderName: u, xsrfCookieName: h, headers: d, auth: b } = r;
    if (r.headers = d = se.from(d), r.url = Zt(cn(r.baseURL, r.url, r.allowAbsoluteUrls), t.params, t.paramsSerializer), b && d.set(
      "Authorization",
      "Basic " + btoa((b.username || "") + ":" + (b.password ? unescape(encodeURIComponent(b.password)) : ""))
    ), p.isFormData(o)) {
      if (V.hasStandardBrowserEnv || V.hasStandardBrowserWebWorkerEnv)
        d.setContentType(void 0);
      else if (p.isFunction(o.getHeaders)) {
        const _ = o.getHeaders(), x = ["content-type", "content-length"];
        Object.entries(_).forEach(([A, k]) => {
          x.includes(A.toLowerCase()) && d.set(A, k);
        });
      }
    }
    if (V.hasStandardBrowserEnv && (a && p.isFunction(a) && (a = a(r)), a || a !== !1 && as(r.url))) {
      const _ = u && h && cs.read(h);
      _ && d.set(u, _);
    }
    return r;
  }, fs = typeof XMLHttpRequest < "u" && function(t) {
    return new Promise(function(o, a) {
      const u = ln(t);
      let h = u.data;
      const d = se.from(u.headers).normalize();
      let { responseType: b, onUploadProgress: _, onDownloadProgress: x } = u, A, k, q, X, C;
      function U() {
        X && X(), C && C(), u.cancelToken && u.cancelToken.unsubscribe(A), u.signal && u.signal.removeEventListener("abort", A);
      }
      let F = new XMLHttpRequest();
      F.open(u.method.toUpperCase(), u.url, !0), F.timeout = u.timeout;
      function z() {
        if (!F)
          return;
        const J = se.from(
          "getAllResponseHeaders" in F && F.getAllResponseHeaders()
        ), oe = {
          data: !b || b === "text" || b === "json" ? F.responseText : F.response,
          status: F.status,
          statusText: F.statusText,
          headers: J,
          config: t,
          request: F
        };
        sn(function(re) {
          o(re), U();
        }, function(re) {
          a(re), U();
        }, oe), F = null;
      }
      "onloadend" in F ? F.onloadend = z : F.onreadystatechange = function() {
        !F || F.readyState !== 4 || F.status === 0 && !(F.responseURL && F.responseURL.indexOf("file:") === 0) || setTimeout(z);
      }, F.onabort = function() {
        F && (a(new L("Request aborted", L.ECONNABORTED, t, F)), F = null);
      }, F.onerror = function(Z) {
        const oe = Z && Z.message ? Z.message : "Network Error", we = new L(oe, L.ERR_NETWORK, t, F);
        we.event = Z || null, a(we), F = null;
      }, F.ontimeout = function() {
        let Z = u.timeout ? "timeout of " + u.timeout + "ms exceeded" : "timeout exceeded";
        const oe = u.transitional || en;
        u.timeoutErrorMessage && (Z = u.timeoutErrorMessage), a(new L(
          Z,
          oe.clarifyTimeoutError ? L.ETIMEDOUT : L.ECONNABORTED,
          t,
          F
        )), F = null;
      }, h === void 0 && d.setContentType(null), "setRequestHeader" in F && p.forEach(d.toJSON(), function(Z, oe) {
        F.setRequestHeader(oe, Z);
      }), p.isUndefined(u.withCredentials) || (F.withCredentials = !!u.withCredentials), b && b !== "json" && (F.responseType = u.responseType), x && ([q, C] = Qe(x, !0), F.addEventListener("progress", q)), _ && F.upload && ([k, X] = Qe(_), F.upload.addEventListener("progress", k), F.upload.addEventListener("loadend", X)), (u.cancelToken || u.signal) && (A = (J) => {
        F && (a(!J || J.type ? new Ae(null, t, F) : J), F.abort(), F = null);
      }, u.cancelToken && u.cancelToken.subscribe(A), u.signal && (u.signal.aborted ? A() : u.signal.addEventListener("abort", A)));
      const ne = ss(u.url);
      if (ne && V.protocols.indexOf(ne) === -1) {
        a(new L("Unsupported protocol " + ne + ":", L.ERR_BAD_REQUEST, t));
        return;
      }
      F.send(h || null);
    });
  }, ds = (t, r) => {
    const { length: o } = t = t ? t.filter(Boolean) : [];
    if (r || o) {
      let a = new AbortController(), u;
      const h = function(x) {
        if (!u) {
          u = !0, b();
          const A = x instanceof Error ? x : this.reason;
          a.abort(A instanceof L ? A : new Ae(A instanceof Error ? A.message : A));
        }
      };
      let d = r && setTimeout(() => {
        d = null, h(new L(`timeout ${r} of ms exceeded`, L.ETIMEDOUT));
      }, r);
      const b = () => {
        t && (d && clearTimeout(d), d = null, t.forEach((x) => {
          x.unsubscribe ? x.unsubscribe(h) : x.removeEventListener("abort", h);
        }), t = null);
      };
      t.forEach((x) => x.addEventListener("abort", h));
      const { signal: _ } = a;
      return _.unsubscribe = () => p.asap(b), _;
    }
  };
  const hs = function* (t, r) {
    let o = t.byteLength;
    if (o < r) {
      yield t;
      return;
    }
    let a = 0, u;
    for (; a < o; )
      u = a + r, yield t.slice(a, u), a = u;
  }, ps = async function* (t, r) {
    for await (const o of ms(t))
      yield* hs(o, r);
  }, ms = async function* (t) {
    if (t[Symbol.asyncIterator]) {
      yield* t;
      return;
    }
    const r = t.getReader();
    try {
      for (; ; ) {
        const { done: o, value: a } = await r.read();
        if (o)
          break;
        yield a;
      }
    } finally {
      await r.cancel();
    }
  }, fn = (t, r, o, a) => {
    const u = ps(t, r);
    let h = 0, d, b = (_) => {
      d || (d = !0, a && a(_));
    };
    return new ReadableStream({
      async pull(_) {
        try {
          const { done: x, value: A } = await u.next();
          if (x) {
            b(), _.close();
            return;
          }
          let k = A.byteLength;
          if (o) {
            let q = h += k;
            o(q);
          }
          _.enqueue(new Uint8Array(A));
        } catch (x) {
          throw b(x), x;
        }
      },
      cancel(_) {
        return b(_), u.return();
      }
    }, {
      highWaterMark: 2
    });
  }, dn = 64 * 1024, { isFunction: Ge } = p, ys = (({ Request: t, Response: r }) => ({
    Request: t,
    Response: r
  }))(p.global), {
    ReadableStream: hn,
    TextEncoder: pn
  } = p.global, mn = (t, ...r) => {
    try {
      return !!t(...r);
    } catch {
      return !1;
    }
  }, ws = (t) => {
    t = p.merge.call({
      skipUndefined: !0
    }, ys, t);
    const { fetch: r, Request: o, Response: a } = t, u = r ? Ge(r) : typeof fetch == "function", h = Ge(o), d = Ge(a);
    if (!u)
      return !1;
    const b = u && Ge(hn), _ = u && (typeof pn == "function" ? /* @__PURE__ */ ((C) => (U) => C.encode(U))(new pn()) : async (C) => new Uint8Array(await new o(C).arrayBuffer())), x = h && b && mn(() => {
      let C = !1;
      const U = new o(V.origin, {
        body: new hn(),
        method: "POST",
        get duplex() {
          return C = !0, "half";
        }
      }).headers.has("Content-Type");
      return C && !U;
    }), A = d && b && mn(() => p.isReadableStream(new a("").body)), k = {
      stream: A && ((C) => C.body)
    };
    u && ["text", "arrayBuffer", "blob", "formData", "stream"].forEach((C) => {
      !k[C] && (k[C] = (U, F) => {
        let z = U && U[C];
        if (z)
          return z.call(U);
        throw new L(`Response type '${C}' is not supported`, L.ERR_NOT_SUPPORT, F);
      });
    });
    const q = async (C) => {
      if (C == null)
        return 0;
      if (p.isBlob(C))
        return C.size;
      if (p.isSpecCompliantForm(C))
        return (await new o(V.origin, {
          method: "POST",
          body: C
        }).arrayBuffer()).byteLength;
      if (p.isArrayBufferView(C) || p.isArrayBuffer(C))
        return C.byteLength;
      if (p.isURLSearchParams(C) && (C = C + ""), p.isString(C))
        return (await _(C)).byteLength;
    }, X = async (C, U) => {
      const F = p.toFiniteNumber(C.getContentLength());
      return F ?? q(U);
    };
    return async (C) => {
      let {
        url: U,
        method: F,
        data: z,
        signal: ne,
        cancelToken: J,
        timeout: Z,
        onDownloadProgress: oe,
        onUploadProgress: we,
        responseType: re,
        headers: Nt,
        withCredentials: nt = "same-origin",
        fetchOptions: On
      } = ln(C), Tn = r || fetch;
      re = re ? (re + "").toLowerCase() : "text";
      let rt = ds([ne, J && J.toAbortSignal()], Z), Ie = null;
      const be = rt && rt.unsubscribe && (() => {
        rt.unsubscribe();
      });
      let An;
      try {
        if (we && x && F !== "get" && F !== "head" && (An = await X(Nt, z)) !== 0) {
          let pe = new o(U, {
            method: "POST",
            body: z,
            duplex: "half"
          }), Ce;
          if (p.isFormData(z) && (Ce = pe.headers.get("content-type")) && Nt.setContentType(Ce), pe.body) {
            const [_t, st] = on(
              An,
              Qe(an(we))
            );
            z = fn(pe.body, dn, _t, st);
          }
        }
        p.isString(nt) || (nt = nt ? "include" : "omit");
        const ue = h && "credentials" in o.prototype, Cn = {
          ...On,
          signal: rt,
          method: F.toUpperCase(),
          headers: Nt.normalize().toJSON(),
          body: z,
          duplex: "half",
          credentials: ue ? nt : void 0
        };
        Ie = h && new o(U, Cn);
        let he = await (h ? Tn(Ie, On) : Tn(U, Cn));
        const xn = A && (re === "stream" || re === "response");
        if (A && (oe || xn && be)) {
          const pe = {};
          ["status", "statusText", "headers"].forEach((Pn) => {
            pe[Pn] = he[Pn];
          });
          const Ce = p.toFiniteNumber(he.headers.get("content-length")), [_t, st] = oe && on(
            Ce,
            Qe(an(oe), !0)
          ) || [];
          he = new a(
            fn(he.body, dn, _t, () => {
              st && st(), be && be();
            }),
            pe
          );
        }
        re = re || "text";
        let Cs = await k[p.findKey(k, re) || "text"](he, C);
        return !xn && be && be(), await new Promise((pe, Ce) => {
          sn(pe, Ce, {
            data: Cs,
            headers: se.from(he.headers),
            status: he.status,
            statusText: he.statusText,
            config: C,
            request: Ie
          });
        });
      } catch (ue) {
        throw be && be(), ue && ue.name === "TypeError" && /Load failed|fetch/i.test(ue.message) ? Object.assign(
          new L("Network Error", L.ERR_NETWORK, C, Ie),
          {
            cause: ue.cause || ue
          }
        ) : L.from(ue, ue && ue.code, C, Ie);
      }
    };
  }, bs = /* @__PURE__ */ new Map(), yn = (t) => {
    let r = t && t.env || {};
    const { fetch: o, Request: a, Response: u } = r, h = [
      a,
      u,
      o
    ];
    let d = h.length, b = d, _, x, A = bs;
    for (; b--; )
      _ = h[b], x = A.get(_), x === void 0 && A.set(_, x = b ? /* @__PURE__ */ new Map() : ws(r)), A = x;
    return x;
  };
  yn();
  const At = {
    http: Br,
    xhr: fs,
    fetch: {
      get: yn
    }
  };
  p.forEach(At, (t, r) => {
    if (t) {
      try {
        Object.defineProperty(t, "name", { value: r });
      } catch {
      }
      Object.defineProperty(t, "adapterName", { value: r });
    }
  });
  const wn = (t) => `- ${t}`, gs = (t) => p.isFunction(t) || t === null || t === !1;
  function Es(t, r) {
    t = p.isArray(t) ? t : [t];
    const { length: o } = t;
    let a, u;
    const h = {};
    for (let d = 0; d < o; d++) {
      a = t[d];
      let b;
      if (u = a, !gs(a) && (u = At[(b = String(a)).toLowerCase()], u === void 0))
        throw new L(`Unknown adapter '${b}'`);
      if (u && (p.isFunction(u) || (u = u.get(r))))
        break;
      h[b || "#" + d] = u;
    }
    if (!u) {
      const d = Object.entries(h).map(
        ([_, x]) => `adapter ${_} ` + (x === !1 ? "is not supported by the environment" : "is not available in the build")
      );
      let b = o ? d.length > 1 ? `since :
` + d.map(wn).join(`
`) : " " + wn(d[0]) : "as no adapter specified";
      throw new L(
        "There is no suitable adapter to dispatch the request " + b,
        "ERR_NOT_SUPPORT"
      );
    }
    return u;
  }
  var bn = {
    /**
     * Resolve an adapter from a list of adapter names or functions.
     * @type {Function}
     */
    getAdapter: Es,
    /**
     * Exposes all known adapters
     * @type {Object<string, Function|Object>}
     */
    adapters: At
  };
  function Ct(t) {
    if (t.cancelToken && t.cancelToken.throwIfRequested(), t.signal && t.signal.aborted)
      throw new Ae(null, t);
  }
  function gn(t) {
    return Ct(t), t.headers = se.from(t.headers), t.data = Tt.call(
      t,
      t.transformRequest
    ), ["post", "put", "patch"].indexOf(t.method) !== -1 && t.headers.setContentType("application/x-www-form-urlencoded", !1), bn.getAdapter(t.adapter || St.adapter, t)(t).then(function(a) {
      return Ct(t), a.data = Tt.call(
        t,
        t.transformResponse,
        a
      ), a.headers = se.from(a.headers), a;
    }, function(a) {
      return rn(a) || (Ct(t), a && a.response && (a.response.data = Tt.call(
        t,
        t.transformResponse,
        a.response
      ), a.response.headers = se.from(a.response.headers))), Promise.reject(a);
    });
  }
  const En = "1.13.2", Ze = {};
  ["object", "boolean", "number", "function", "string", "symbol"].forEach((t, r) => {
    Ze[t] = function(a) {
      return typeof a === t || "a" + (r < 1 ? "n " : " ") + t;
    };
  });
  const Rn = {};
  Ze.transitional = function(r, o, a) {
    function u(h, d) {
      return "[Axios v" + En + "] Transitional option '" + h + "'" + d + (a ? ". " + a : "");
    }
    return (h, d, b) => {
      if (r === !1)
        throw new L(
          u(d, " has been removed" + (o ? " in " + o : "")),
          L.ERR_DEPRECATED
        );
      return o && !Rn[d] && (Rn[d] = !0, console.warn(
        u(
          d,
          " has been deprecated since v" + o + " and will be removed in the near future"
        )
      )), r ? r(h, d, b) : !0;
    };
  }, Ze.spelling = function(r) {
    return (o, a) => (console.warn(`${a} is likely a misspelling of ${r}`), !0);
  };
  function Rs(t, r, o) {
    if (typeof t != "object")
      throw new L("options must be an object", L.ERR_BAD_OPTION_VALUE);
    const a = Object.keys(t);
    let u = a.length;
    for (; u-- > 0; ) {
      const h = a[u], d = r[h];
      if (d) {
        const b = t[h], _ = b === void 0 || d(b, h, t);
        if (_ !== !0)
          throw new L("option " + h + " must be " + _, L.ERR_BAD_OPTION_VALUE);
        continue;
      }
      if (o !== !0)
        throw new L("Unknown option " + h, L.ERR_BAD_OPTION);
    }
  }
  var Ye = {
    assertOptions: Rs,
    validators: Ze
  };
  const ce = Ye.validators;
  class et {
    constructor(r) {
      this.defaults = r || {}, this.interceptors = {
        request: new Yt(),
        response: new Yt()
      };
    }
    /**
     * Dispatch a request
     *
     * @param {String|Object} configOrUrl The config specific for this request (merged with this.defaults)
     * @param {?Object} config
     *
     * @returns {Promise} The Promise to be fulfilled
     */
    async request(r, o) {
      try {
        return await this._request(r, o);
      } catch (a) {
        if (a instanceof Error) {
          let u = {};
          Error.captureStackTrace ? Error.captureStackTrace(u) : u = new Error();
          const h = u.stack ? u.stack.replace(/^.+\n/, "") : "";
          try {
            a.stack ? h && !String(a.stack).endsWith(h.replace(/^.+\n.+\n/, "")) && (a.stack += `
` + h) : a.stack = h;
          } catch {
          }
        }
        throw a;
      }
    }
    _request(r, o) {
      typeof r == "string" ? (o = o || {}, o.url = r) : o = r || {}, o = ye(this.defaults, o);
      const { transitional: a, paramsSerializer: u, headers: h } = o;
      a !== void 0 && Ye.assertOptions(a, {
        silentJSONParsing: ce.transitional(ce.boolean),
        forcedJSONParsing: ce.transitional(ce.boolean),
        clarifyTimeoutError: ce.transitional(ce.boolean)
      }, !1), u != null && (p.isFunction(u) ? o.paramsSerializer = {
        serialize: u
      } : Ye.assertOptions(u, {
        encode: ce.function,
        serialize: ce.function
      }, !0)), o.allowAbsoluteUrls !== void 0 || (this.defaults.allowAbsoluteUrls !== void 0 ? o.allowAbsoluteUrls = this.defaults.allowAbsoluteUrls : o.allowAbsoluteUrls = !0), Ye.assertOptions(o, {
        baseUrl: ce.spelling("baseURL"),
        withXsrfToken: ce.spelling("withXSRFToken")
      }, !0), o.method = (o.method || this.defaults.method || "get").toLowerCase();
      let d = h && p.merge(
        h.common,
        h[o.method]
      );
      h && p.forEach(
        ["delete", "get", "head", "post", "put", "patch", "common"],
        (C) => {
          delete h[C];
        }
      ), o.headers = se.concat(d, h);
      const b = [];
      let _ = !0;
      this.interceptors.request.forEach(function(U) {
        typeof U.runWhen == "function" && U.runWhen(o) === !1 || (_ = _ && U.synchronous, b.unshift(U.fulfilled, U.rejected));
      });
      const x = [];
      this.interceptors.response.forEach(function(U) {
        x.push(U.fulfilled, U.rejected);
      });
      let A, k = 0, q;
      if (!_) {
        const C = [gn.bind(this), void 0];
        for (C.unshift(...b), C.push(...x), q = C.length, A = Promise.resolve(o); k < q; )
          A = A.then(C[k++], C[k++]);
        return A;
      }
      q = b.length;
      let X = o;
      for (; k < q; ) {
        const C = b[k++], U = b[k++];
        try {
          X = C(X);
        } catch (F) {
          U.call(this, F);
          break;
        }
      }
      try {
        A = gn.call(this, X);
      } catch (C) {
        return Promise.reject(C);
      }
      for (k = 0, q = x.length; k < q; )
        A = A.then(x[k++], x[k++]);
      return A;
    }
    getUri(r) {
      r = ye(this.defaults, r);
      const o = cn(r.baseURL, r.url, r.allowAbsoluteUrls);
      return Zt(o, r.params, r.paramsSerializer);
    }
  }
  p.forEach(["delete", "get", "head", "options"], function(r) {
    et.prototype[r] = function(o, a) {
      return this.request(ye(a || {}, {
        method: r,
        url: o,
        data: (a || {}).data
      }));
    };
  }), p.forEach(["post", "put", "patch"], function(r) {
    function o(a) {
      return function(h, d, b) {
        return this.request(ye(b || {}, {
          method: r,
          headers: a ? {
            "Content-Type": "multipart/form-data"
          } : {},
          url: h,
          data: d
        }));
      };
    }
    et.prototype[r] = o(), et.prototype[r + "Form"] = o(!0);
  });
  var tt = et;
  class xt {
    constructor(r) {
      if (typeof r != "function")
        throw new TypeError("executor must be a function.");
      let o;
      this.promise = new Promise(function(h) {
        o = h;
      });
      const a = this;
      this.promise.then((u) => {
        if (!a._listeners) return;
        let h = a._listeners.length;
        for (; h-- > 0; )
          a._listeners[h](u);
        a._listeners = null;
      }), this.promise.then = (u) => {
        let h;
        const d = new Promise((b) => {
          a.subscribe(b), h = b;
        }).then(u);
        return d.cancel = function() {
          a.unsubscribe(h);
        }, d;
      }, r(function(h, d, b) {
        a.reason || (a.reason = new Ae(h, d, b), o(a.reason));
      });
    }
    /**
     * Throws a `CanceledError` if cancellation has been requested.
     */
    throwIfRequested() {
      if (this.reason)
        throw this.reason;
    }
    /**
     * Subscribe to the cancel signal
     */
    subscribe(r) {
      if (this.reason) {
        r(this.reason);
        return;
      }
      this._listeners ? this._listeners.push(r) : this._listeners = [r];
    }
    /**
     * Unsubscribe from the cancel signal
     */
    unsubscribe(r) {
      if (!this._listeners)
        return;
      const o = this._listeners.indexOf(r);
      o !== -1 && this._listeners.splice(o, 1);
    }
    toAbortSignal() {
      const r = new AbortController(), o = (a) => {
        r.abort(a);
      };
      return this.subscribe(o), r.signal.unsubscribe = () => this.unsubscribe(o), r.signal;
    }
    /**
     * Returns an object that contains a new `CancelToken` and a function that, when called,
     * cancels the `CancelToken`.
     */
    static source() {
      let r;
      return {
        token: new xt(function(u) {
          r = u;
        }),
        cancel: r
      };
    }
  }
  var Ss = xt;
  function Os(t) {
    return function(o) {
      return t.apply(null, o);
    };
  }
  function Ts(t) {
    return p.isObject(t) && t.isAxiosError === !0;
  }
  const Pt = {
    Continue: 100,
    SwitchingProtocols: 101,
    Processing: 102,
    EarlyHints: 103,
    Ok: 200,
    Created: 201,
    Accepted: 202,
    NonAuthoritativeInformation: 203,
    NoContent: 204,
    ResetContent: 205,
    PartialContent: 206,
    MultiStatus: 207,
    AlreadyReported: 208,
    ImUsed: 226,
    MultipleChoices: 300,
    MovedPermanently: 301,
    Found: 302,
    SeeOther: 303,
    NotModified: 304,
    UseProxy: 305,
    Unused: 306,
    TemporaryRedirect: 307,
    PermanentRedirect: 308,
    BadRequest: 400,
    Unauthorized: 401,
    PaymentRequired: 402,
    Forbidden: 403,
    NotFound: 404,
    MethodNotAllowed: 405,
    NotAcceptable: 406,
    ProxyAuthenticationRequired: 407,
    RequestTimeout: 408,
    Conflict: 409,
    Gone: 410,
    LengthRequired: 411,
    PreconditionFailed: 412,
    PayloadTooLarge: 413,
    UriTooLong: 414,
    UnsupportedMediaType: 415,
    RangeNotSatisfiable: 416,
    ExpectationFailed: 417,
    ImATeapot: 418,
    MisdirectedRequest: 421,
    UnprocessableEntity: 422,
    Locked: 423,
    FailedDependency: 424,
    TooEarly: 425,
    UpgradeRequired: 426,
    PreconditionRequired: 428,
    TooManyRequests: 429,
    RequestHeaderFieldsTooLarge: 431,
    UnavailableForLegalReasons: 451,
    InternalServerError: 500,
    NotImplemented: 501,
    BadGateway: 502,
    ServiceUnavailable: 503,
    GatewayTimeout: 504,
    HttpVersionNotSupported: 505,
    VariantAlsoNegotiates: 506,
    InsufficientStorage: 507,
    LoopDetected: 508,
    NotExtended: 510,
    NetworkAuthenticationRequired: 511,
    WebServerIsDown: 521,
    ConnectionTimedOut: 522,
    OriginIsUnreachable: 523,
    TimeoutOccurred: 524,
    SslHandshakeFailed: 525,
    InvalidSslCertificate: 526
  };
  Object.entries(Pt).forEach(([t, r]) => {
    Pt[r] = t;
  });
  var As = Pt;
  function Sn(t) {
    const r = new tt(t), o = e(tt.prototype.request, r);
    return p.extend(o, tt.prototype, r, { allOwnKeys: !0 }), p.extend(o, r, null, { allOwnKeys: !0 }), o.create = function(u) {
      return Sn(ye(t, u));
    }, o;
  }
  const v = Sn(St);
  return v.Axios = tt, v.CanceledError = Ae, v.CancelToken = Ss, v.isCancel = rn, v.VERSION = En, v.toFormData = Ke, v.AxiosError = L, v.Cancel = v.CanceledError, v.all = function(r) {
    return Promise.all(r);
  }, v.spread = Os, v.isAxiosError = Ts, v.mergeConfig = ye, v.AxiosHeaders = se, v.formToJSON = (t) => tn(p.isHTMLForm(t) ? new FormData(t) : t), v.getAdapter = bn.getAdapter, v.HttpStatusCode = As, v.default = v, Lt = v, Lt;
}
var ii = lt.exports, Wn;
function ai() {
  return Wn || (Wn = 1, (function(e, n) {
    (function(s, i) {
      e.exports = i(/* @__PURE__ */ oi());
    })(ii, (function(s) {
      return (function() {
        var i = { 593: function(y, R, g) {
          Object.defineProperty(R, "__esModule", { value: !0 }), R.resendFailedRequest = R.getRetryInstance = R.unsetCache = R.createRequestQueueInterceptor = R.createRefreshCall = R.shouldInterceptError = R.mergeOptions = R.defaultOptions = void 0;
          const E = g(300);
          R.defaultOptions = { statusCodes: [401], pauseInstanceWhileRefreshing: !1 }, R.mergeOptions = function(S, P) {
            return Object.assign(Object.assign(Object.assign({}, S), { pauseInstanceWhileRefreshing: P.skipWhileRefreshing }), P);
          }, R.shouldInterceptError = function(S, P, O, w) {
            var N, T;
            return !!S && !(!((N = S.config) === null || N === void 0) && N.skipAuthRefresh) && !!(P.interceptNetworkError && !S.response && S.request.status === 0 || S.response && (P?.shouldRefresh ? P.shouldRefresh(S) : !((T = P.statusCodes) === null || T === void 0) && T.includes(parseInt(S.response.status)))) && (S.response || (S.response = { config: S.config }), !P.pauseInstanceWhileRefreshing || !w.skipInstances.includes(O));
          }, R.createRefreshCall = function(S, P, O) {
            return O.refreshCall || (O.refreshCall = P(S), typeof O.refreshCall.then == "function") ? O.refreshCall : (console.warn("axios-auth-refresh requires `refreshTokenCall` to return a promise."), Promise.reject());
          }, R.createRequestQueueInterceptor = function(S, P, O) {
            return P.requestQueueInterceptorId === void 0 && (P.requestQueueInterceptorId = S.interceptors.request.use(((w) => P.refreshCall.catch((() => {
              throw new E.default.Cancel("Request call failed");
            })).then((() => O.onRetry ? O.onRetry(w) : w))))), P.requestQueueInterceptorId;
          }, R.unsetCache = function(S, P) {
            S.interceptors.request.eject(P.requestQueueInterceptorId), P.requestQueueInterceptorId = void 0, P.refreshCall = void 0, P.skipInstances = P.skipInstances.filter(((O) => O !== S));
          }, R.getRetryInstance = function(S, P) {
            return P.retryInstance || S;
          }, R.resendFailedRequest = function(S, P) {
            return S.config.skipAuthRefresh = !0, P(S.response.config);
          };
        }, 300: function(y) {
          y.exports = s;
        } }, c = {};
        function f(y) {
          var R = c[y];
          if (R !== void 0) return R.exports;
          var g = c[y] = { exports: {} };
          return i[y](g, g.exports, f), g.exports;
        }
        var l = {};
        return (function() {
          var y = l;
          Object.defineProperty(y, "__esModule", { value: !0 });
          const R = f(593);
          y.default = function(g, E, S = {}) {
            if (typeof E != "function") throw new Error("axios-auth-refresh requires `refreshAuthCall` to be a function that returns a promise.");
            const P = { skipInstances: [], refreshCall: void 0, requestQueueInterceptorId: void 0 };
            return g.interceptors.response.use(((O) => O), ((O) => {
              if (S = (0, R.mergeOptions)(R.defaultOptions, S), !(0, R.shouldInterceptError)(O, S, g, P)) return Promise.reject(O);
              S.pauseInstanceWhileRefreshing && P.skipInstances.push(g);
              const w = (0, R.createRefreshCall)(O, E, P);
              return (0, R.createRequestQueueInterceptor)(g, P, S), w.catch(((N) => Promise.reject(N))).then((() => (0, R.resendFailedRequest)(O, (0, R.getRetryInstance)(g, S)))).finally((() => (0, R.unsetCache)(g, P)));
            }));
          };
        })(), l;
      })();
    }));
  })(lt)), lt.exports;
}
var ci = ai();
const ui = /* @__PURE__ */ si(ci);
class li {
  constructor() {
    this.queue = [], this.isRefreshing = !1, this.refreshPromise = null;
  }
  /**
   * 添加请求到队列
   */
  enqueue(n) {
    this.queue.push(n);
  }
  /**
   * 处理队列中的所有请求
   */
  async processQueue(n = null) {
    const s = [...this.queue];
    this.queue = [], s.forEach(({ resolve: i, reject: c, config: f }) => {
      if (n) {
        c(n);
        return;
      }
      Promise.resolve(i(f)).catch(c);
    });
  }
  /**
   * 开始刷新 token
   */
  startRefresh() {
    return this.isRefreshing && this.refreshPromise ? this.refreshPromise : (this.isRefreshing = !0, this.refreshPromise = new Promise((n, s) => {
      this.resolveRefresh = n, this.rejectRefresh = s;
    }), this.refreshPromise.catch(() => {
    }), this.refreshPromise);
  }
  /**
   * 完成刷新（成功）
   */
  async finishRefresh() {
    this.isRefreshing = !1, this.refreshPromise = null, this.resolveRefresh && (this.resolveRefresh(), this.resolveRefresh = void 0), await this.processQueue();
  }
  /**
   * 完成刷新（失败）
   */
  async finishRefreshWithError(n) {
    this.isRefreshing = !1, this.refreshPromise = null, this.rejectRefresh && (this.rejectRefresh(n), this.rejectRefresh = void 0), await this.processQueue(n);
  }
  /**
   * 检查是否正在刷新
   */
  getIsRefreshing() {
    return this.isRefreshing;
  }
  /**
   * 清空队列
   */
  clear() {
    this.rejectRefresh && (this.rejectRefresh(new Error("Request queue cleared")), this.rejectRefresh = void 0), this.resolveRefresh = void 0, this.queue = [], this.isRefreshing = !1, this.refreshPromise = null;
  }
}
const it = (e) => {
  try {
    return JSON.stringify(e);
  } catch {
    try {
      return String(e);
    } catch {
      return "[Unserializable]";
    }
  }
}, fi = (e) => {
  if (typeof e == "boolean") return e;
  const n = globalThis?.NEKO_REQUEST_LOG_ENABLED;
  return typeof n == "boolean" ? n : "production" === "development";
};
function di(e) {
  const {
    baseURL: n,
    storage: s,
    refreshApi: i,
    timeout: c = 15e3,
    requestInterceptor: f,
    responseInterceptor: l,
    returnDataOnly: y = !0,
    errorHandler: R,
    logEnabled: g
  } = e, E = fi(g), S = $.create({
    baseURL: n,
    timeout: c,
    headers: {
      "Content-Type": "application/json"
    }
  }), P = new li();
  return S.interceptors.request.use(
    async (O) => {
      if (E) {
        const N = O.method?.toUpperCase() || "GET", T = O.url || "", D = O.baseURL ? `${O.baseURL}${T}` : T, j = {};
        if (O.params) {
          const I = it(O.params);
          j.params = I.length > 200 ? I.substring(0, 200) + "..." : I;
        }
        if (O.data) {
          const I = typeof O.data == "string" ? O.data : it(O.data);
          j.data = I.length > 200 ? I.substring(0, 200) + "..." : I;
        }
        console.log(`[Request] ${N} ${D}`, Object.keys(j).length > 0 ? j : "");
      }
      if (P.getIsRefreshing())
        return new Promise((N, T) => {
          P.enqueue({
            resolve: async (D) => {
              const j = await s.getAccessToken();
              j && D.headers && (D.headers.Authorization = `Bearer ${j}`), N(f ? await f(D) : D);
            },
            reject: T,
            config: O
          });
        });
      const w = await s.getAccessToken();
      return w && O.headers && (O.headers.Authorization = `Bearer ${w}`), f ? await f(O) : O;
    },
    (O) => (E && console.error("[Request] 请求拦截器错误:", O), Promise.reject(O))
  ), ui(
    S,
    async (O) => {
      const w = P.getIsRefreshing(), N = P.startRefresh();
      if (w)
        try {
          await N;
          const T = await s.getAccessToken();
          return T && O.config?.headers && (O.config.headers.Authorization = `Bearer ${T}`), Promise.resolve();
        } catch (T) {
          return Promise.reject(T);
        }
      try {
        const T = await s.getRefreshToken();
        if (!T)
          throw new Error("No refresh token available");
        const D = await i(T);
        return await s.setAccessToken(D.accessToken), await s.setRefreshToken(D.refreshToken), O.config?.headers && (O.config.headers.Authorization = `Bearer ${D.accessToken}`), await P.finishRefresh(), Promise.resolve();
      } catch (T) {
        return await s.clearTokens(), await P.finishRefreshWithError(T), Promise.reject(T);
      }
    },
    {
      statusCodes: [401],
      // 只在 401 时触发刷新
      // axios-auth-refresh v3 推荐使用 pauseInstanceWhileRefreshing：
      // - axios-auth-refresh 负责暂停/排队当前实例内的失败请求（如并发 401 时避免重复刷新）
      // - RequestQueue 负责请求拦截器阶段的新请求排队（isRefreshing=true 时挂起新请求）
      // 两层机制分工清晰，避免旧的 skipWhileRefreshing 失效导致行为不确定
      pauseInstanceWhileRefreshing: !0
    }
  ), S.interceptors.response.use(
    (O) => {
      if (E) {
        const w = O.config.method?.toUpperCase() || "GET", N = O.config.url || "", T = O.config.baseURL ? `${O.config.baseURL}${N}` : N, D = O.status;
        let j = "";
        if (O.data !== void 0 && O.data !== null) {
          const I = typeof O.data == "string" ? O.data : it(O.data);
          j = I.length > 200 ? I.substring(0, 200) + "..." : I;
        }
        console.log(`[Request] ${w} ${T} 响应 ${D}`, j || "");
      }
      return l?.onFulfilled ? l.onFulfilled(O) : y ? O.data : O;
    },
    async (O) => {
      if (E) {
        const T = O.config?.method?.toUpperCase() || "GET", D = O.config?.url || "", j = O.config?.baseURL ? `${O.config.baseURL}${D}` : D, H = {
          status: O.response?.status || "N/A",
          message: O.message || "Unknown error"
        };
        if (O.response?.data) {
          const M = typeof O.response.data == "string" ? O.response.data : it(O.response.data), te = M.length > 200 ? M.substring(0, 200) + "..." : M;
          H.data = te;
        }
        console.error(`[Request] ${T} ${j} 失败:`, H);
      }
      if (l?.onRejected)
        return l.onRejected(O);
      R && await R(O);
      const w = (() => {
        if (!O.config) return;
        const {
          url: T,
          method: D,
          baseURL: j,
          timeout: I,
          responseType: H,
          withCredentials: M,
          paramsSerializer: te
        } = O.config;
        return {
          url: T,
          method: D,
          baseURL: j,
          timeout: I,
          responseType: H,
          withCredentials: M,
          // paramsSerializer 可能影响调试，但不包含敏感值
          paramsSerializer: te
        };
      })(), N = {
        message: O.message || "Request failed",
        status: O.response?.status,
        data: O.response?.data,
        config: w
      };
      return Promise.reject(N);
    }
  ), S;
}
const hi = {
  getItem(e) {
    return Promise.resolve(localStorage.getItem(e));
  },
  setItem(e, n) {
    return Promise.resolve(localStorage.setItem(e, n));
  },
  removeItem(e) {
    return Promise.resolve(localStorage.removeItem(e));
  }
}, xe = {
  ACCESS_TOKEN: "access_token",
  REFRESH_TOKEN: "refresh_token"
};
class pi {
  constructor() {
    this.storage = hi;
  }
  async getAccessToken() {
    return await this.storage.getItem(xe.ACCESS_TOKEN);
  }
  async setAccessToken(n) {
    await this.storage.setItem(xe.ACCESS_TOKEN, n);
  }
  async getRefreshToken() {
    return await this.storage.getItem(xe.REFRESH_TOKEN);
  }
  async setRefreshToken(n) {
    await this.storage.setItem(xe.REFRESH_TOKEN, n);
  }
  async clearTokens() {
    await Promise.all([
      this.storage.removeItem(xe.ACCESS_TOKEN),
      this.storage.removeItem(xe.REFRESH_TOKEN)
    ]);
  }
}
const Kn = 1e4;
function br(e) {
  return typeof e == "object" && e !== null;
}
function mi(e) {
  return !(!br(e) || typeof e.access_token != "string" || typeof e.refresh_token != "string" || e.expires_in !== void 0 && typeof e.expires_in != "number" || e.token_type !== void 0 && typeof e.token_type != "string");
}
const Ii = di({
  baseURL: "/api",
  storage: new pi(),
  refreshApi: async (e) => {
    try {
      const n = new AbortController(), s = setTimeout(() => n.abort(), Kn);
      let i;
      try {
        i = await fetch("/api/auth/refresh", {
          method: "POST",
          body: JSON.stringify({ refreshToken: e }),
          headers: { "Content-Type": "application/json" },
          signal: n.signal
        });
      } catch (f) {
        if (f instanceof Error && (f.name === "AbortError" || String(f.message).includes("aborted"))) {
          const y = new Error(
            `Refresh token request timed out after ${Kn}ms`
          );
          throw y.code = "ETIMEDOUT", y;
        }
        throw f;
      } finally {
        clearTimeout(s);
      }
      let c;
      try {
        c = await i.json();
      } catch (f) {
        throw new Error(`Failed to parse refresh token response: ${String(f)}`);
      }
      if (!i.ok) {
        const f = br(c) ? c : void 0, l = f && (f.message || f.error) || `Refresh token request failed with status ${i.status} ${i.statusText}`, y = new Error(l);
        throw y.status = i.status, y.data = c, y;
      }
      if (!mi(c))
        throw new Error("Invalid refresh token response: missing or invalid access_token/refresh_token");
      return {
        accessToken: c.access_token,
        refreshToken: c.refresh_token
      };
    } catch (n) {
      throw n;
    }
  }
});
export {
  pi as WebTokenStorage,
  di as createRequestClient,
  Ii as request
};
