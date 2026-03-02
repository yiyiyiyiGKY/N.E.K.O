class _ {
  constructor(e) {
    this.listeners = /* @__PURE__ */ new Map(), this.onError = e?.onError;
  }
  /**
   * 订阅事件
   * 
   * @param event - 事件名
   * @param handler - 事件处理器
   * @returns 取消订阅函数
   */
  on(e, t) {
    const i = this.listeners.get(e) || /* @__PURE__ */ new Set();
    return i.add(t), this.listeners.set(e, i), () => {
      const s = this.listeners.get(e);
      s && (s.delete(t), s.size === 0 && this.listeners.delete(e));
    };
  }
  /**
   * 发射事件
   * 
   * @param event - 事件名
   * @param payload - 事件 payload
   */
  emit(e, t) {
    const i = this.listeners.get(e);
    if (i)
      for (const s of i)
        try {
          s(t);
        } catch (o) {
          const l = this.onError;
          if (l)
            l(o, s, t);
          else {
            const c = typeof s == "function" && s.name ? String(s.name) : "<anonymous>";
            console.error(`[TinyEmitter] 事件处理器抛错 (event="${String(e)}", handler="${c}")`, {
              error: o,
              handler: s,
              payload: t
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
class C {
  constructor() {
    this.interruptedSpeechId = null, this.currentPlayingSpeechId = null, this.pendingDecoderReset = !1, this.skipNextBinary = !1;
  }
  getSkipNextBinary() {
    return this.skipNextBinary;
  }
  /**
   * user_activity: 清空播放队列但不重置解码器；等待新 speech_id 再重置。
   */
  onUserActivity(e) {
    return this.interruptedSpeechId = e || null, this.pendingDecoderReset = !0, this.skipNextBinary = !1, [{ kind: "noop" }];
  }
  /**
   * audio_chunk: 根据 speech_id 决定丢弃/允许二进制，以及是否重置解码器。
   */
  onAudioChunk(e) {
    const t = [], i = typeof e == "string" && e ? e : null;
    return i && this.interruptedSpeechId && i === this.interruptedSpeechId ? (this.skipNextBinary = !0, t.push({ kind: "drop_next_binary" }), t) : (i && i !== this.currentPlayingSpeechId && (this.pendingDecoderReset && (t.push({ kind: "reset_decoder" }), this.pendingDecoderReset = !1), this.currentPlayingSpeechId = i, this.interruptedSpeechId = null), this.skipNextBinary = !1, t.push({ kind: "allow_binary" }), t);
  }
  reset() {
    this.interruptedSpeechId = null, this.currentPlayingSpeechId = null, this.pendingDecoderReset = !1, this.skipNextBinary = !1;
  }
  static fromIncomingJson(e) {
    return !e || typeof e != "object" ? {} : e;
  }
}
function P(n) {
  if (n.byteLength < 4) return !1;
  const e = new Uint8Array(n, 0, 4);
  return e[0] === 79 && e[1] === 103 && e[2] === 103 && e[3] === 83;
}
function T(n) {
  return Math.max(0, Math.min(1, n));
}
class B {
  constructor(e, t = {}) {
    this.emitter = e, this.opts = t, this.audioContext = null, this.analyser = null, this.queue = [], this.scheduledSources = [], this.isPlaying = !1, this.nextChunkTime = 0, this.scheduleTimer = null, this.amplitudeRaf = null;
  }
  getPlaying() {
    return this.isPlaying;
  }
  ensureContext() {
    if (!this.audioContext) {
      const e = globalThis.AudioContext || globalThis.webkitAudioContext;
      this.audioContext = new e();
    }
    return this.audioContext;
  }
  ensureAnalyser() {
    const e = this.ensureContext();
    if (!this.analyser) {
      const t = e.createAnalyser();
      t.fftSize = this.opts.analyserFftSize ?? 2048, t.connect(e.destination), this.analyser = t;
    }
    return this.analyser;
  }
  startAmplitudeLoop() {
    if (this.amplitudeRaf !== null) return;
    const e = this.ensureAnalyser(), t = new Uint8Array(e.fftSize), i = () => {
      try {
        e.getByteTimeDomainData(t);
        let s = 0;
        for (let c = 0; c < t.length; c++) {
          const a = (t[c] - 128) / 128;
          s += a * a;
        }
        const o = Math.sqrt(s / t.length), l = T(o * 8);
        this.emitter.emit("outputAmplitude", { amplitude: l });
      } catch {
      }
      this.amplitudeRaf = requestAnimationFrame(i);
    };
    this.amplitudeRaf = requestAnimationFrame(i);
  }
  stopAmplitudeLoop() {
    this.amplitudeRaf !== null && (cancelAnimationFrame(this.amplitudeRaf), this.amplitudeRaf = null, this.emitter.emit("outputAmplitude", { amplitude: 0 }));
  }
  startScheduleLoop() {
    if (this.scheduleTimer) return;
    const e = this.opts.scheduleIntervalMs ?? 25, t = () => {
      this.scheduleTimer = setTimeout(t, e), this.schedule();
    };
    t();
  }
  stopScheduleLoop() {
    this.scheduleTimer && (clearTimeout(this.scheduleTimer), this.scheduleTimer = null);
  }
  schedule() {
    if (!this.audioContext) return;
    const e = this.audioContext, t = this.opts.scheduleAheadTimeSec ?? 5, i = this.ensureAnalyser();
    for (; this.nextChunkTime < e.currentTime + t && this.queue.length !== 0; ) {
      const s = this.queue.shift(), o = e.createBufferSource();
      o.buffer = s, o.connect(i);
      const l = this.nextChunkTime;
      o.start(l), o.onended = () => {
        const c = this.scheduledSources.indexOf(o);
        c >= 0 && this.scheduledSources.splice(c, 1), this.scheduledSources.length === 0 && this.queue.length === 0 && (this.isPlaying = !1, this.stopAmplitudeLoop(), this.emitter.emit("state", { state: "ready" }));
      }, this.scheduledSources.push(o), this.nextChunkTime += s.duration, this.isPlaying || (this.isPlaying = !0, this.startAmplitudeLoop(), this.emitter.emit("state", { state: "playing" }));
    }
  }
  async enqueueBinary(e) {
    const t = this.ensureContext();
    if (t.state === "suspended")
      try {
        await t.resume();
      } catch {
      }
    const s = await (async (a) => {
      if (typeof Blob < "u" && a instanceof Blob)
        return await a.arrayBuffer();
      if (a instanceof Uint8Array) {
        const d = new ArrayBuffer(a.byteLength);
        return new Uint8Array(d).set(a), d;
      }
      return a;
    })(e);
    if (!s || s.byteLength === 0) return;
    let o = null, l = 48e3;
    if (P(s)) {
      const a = this.opts.decoder;
      if (!a)
        throw new Error("OGG/OPUS audio received but no decoder is configured.");
      const d = await a.decode(new Uint8Array(s));
      if (!d) return;
      o = d.float32Data, l = d.sampleRate || 48e3;
    } else {
      const a = new Int16Array(s);
      if (a.length === 0) return;
      const d = new Float32Array(a.length);
      for (let u = 0; u < a.length; u++) d[u] = a[u] / 32768;
      o = d, l = 48e3;
    }
    if (!o || o.length === 0) return;
    const c = t.createBuffer(1, o.length, l);
    c.copyToChannel(o, 0), this.queue.push(c), this.isPlaying ? this.schedule() : (this.nextChunkTime = t.currentTime + 0.1, this.isPlaying = !0, this.startScheduleLoop(), this.startAmplitudeLoop(), this.emitter.emit("state", { state: "playing" }));
  }
  stopPlayback(e) {
    for (const t of this.scheduledSources)
      try {
        t.stop();
      } catch {
      }
    if (this.scheduledSources = [], this.queue = [], this.isPlaying = !1, this.nextChunkTime = 0, this.stopAmplitudeLoop(), this.stopScheduleLoop(), e?.resetDecoder)
      try {
        this.opts.decoder?.reset();
      } catch {
      }
    this.emitter.emit("state", { state: "ready" });
  }
  async close() {
    this.stopPlayback({ resetDecoder: !1 });
    const e = this.audioContext;
    if (this.audioContext = null, this.analyser = null, e && e.state !== "closed")
      try {
        await e.close();
      } catch {
      }
  }
}
let m = null;
function M() {
  if (m) return m;
  const n = `
class AudioProcessor extends AudioWorkletProcessor {
  constructor(options) {
    super();
    const processorOptions = (options && options.processorOptions) || {};
    this.originalSampleRate = processorOptions.originalSampleRate || 48000;
    this.targetSampleRate = processorOptions.targetSampleRate || 48000;
    this.resampleRatio = this.targetSampleRate / this.originalSampleRate;
    this.needsResampling = this.resampleRatio !== 1.0;
    this._hasReportedError = false;

    // 旧版约定：
    // - 48kHz: 480 samples (10ms)
    // - 16kHz: 512 samples (~32ms)
    this.bufferSize = this.targetSampleRate === 48000 ? 480 : 512;
    this.buffer = new Float32Array(this.bufferSize);
    this.bufferIndex = 0;
    this.tempBuffer = [];
  }

  process(inputs) {
    try {
      const input = inputs[0] && inputs[0][0];
      if (!input || input.length === 0) return true;

      if (this.needsResampling) {
        // concat Float32 -> Array
        for (let i = 0; i < input.length; i++) this.tempBuffer.push(input[i]);

        const requiredSamples = Math.ceil(this.bufferSize / this.resampleRatio);
        if (this.tempBuffer.length >= requiredSamples) {
          const samplesNeeded = Math.min(requiredSamples, this.tempBuffer.length);
          const samplesToProcess = this.tempBuffer.slice(0, samplesNeeded);
          this.tempBuffer = this.tempBuffer.slice(samplesNeeded);

          const resampledData = this.resampleAudio(samplesToProcess);
          const pcmData = this.floatToPcm16(resampledData);
          this.port.postMessage(pcmData);
        }
      } else {
        for (let i = 0; i < input.length; i++) {
          this.buffer[this.bufferIndex++] = input[i];
          if (this.bufferIndex >= this.bufferSize) {
            const pcmData = this.floatToPcm16(this.buffer);
            this.port.postMessage(pcmData);
            this.bufferIndex = 0;
          }
        }
      }
      return true;
    } catch (error) {
      // AudioWorklet 在独立线程中运行：异常若不处理可能导致音频链路中断且难以排查。
      // 这里捕获后通过 port 回传到主线程，保持 worklet 持续运行。
      if (!this._hasReportedError) {
        this._hasReportedError = true;
        let name = "";
        let message = "AudioWorklet process error";
        let stack = "";
        try {
          if (error && typeof error === "object") {
            name = (error && error.name) ? String(error.name) : "";
            message = (error && error.message) ? String(error.message) : String(error);
            stack = (error && error.stack) ? String(error.stack) : "";
          } else {
            message = String(error);
          }
        } catch (_e) {
          // ignore
        }
        try {
          this.port.postMessage({ type: "error", name, message, stack });
        } catch (_e) {
          // ignore
        }
      }
      return true;
    }
  }

  floatToPcm16(floatData) {
    const pcmData = new Int16Array(floatData.length);
    for (let i = 0; i < floatData.length; i++) {
      const v = Math.max(-1, Math.min(1, floatData[i]));
      pcmData[i] = v * 0x7FFF;
    }
    return pcmData;
  }

  // Linear interpolation: performance-first for AudioWorklet real-time thread (no heavy deps).
  // Downsampling (e.g. 48k→16k) may introduce aliasing/distortion; acceptable for voice calls.
  // For higher-quality resampling (sinc/filters), handle outside the worklet (e.g. server-side).
  resampleAudio(audioData) {
    const inputLength = audioData.length;
    const outputLength = Math.floor(inputLength * this.resampleRatio);
    const result = new Float32Array(outputLength);
    for (let i = 0; i < outputLength; i++) {
      const position = i / this.resampleRatio;
      const index = Math.floor(position);
      const fraction = position - index;
      if (index + 1 < inputLength) {
        result[i] = audioData[index] * (1 - fraction) + audioData[index + 1] * fraction;
      } else {
        result[i] = audioData[index];
      }
    }
    return result;
  }
}

registerProcessor('audio-processor', AudioProcessor);
`, e = new Blob([n], { type: "application/javascript" });
  return m = URL.createObjectURL(e), m;
}
const w = /* @__PURE__ */ new WeakMap();
async function L(n, e) {
  let t = w.get(n);
  if (t || (t = /* @__PURE__ */ new Set(), w.set(n, t)), !t.has(e))
    try {
      await n.audioWorklet.addModule(e), t.add(e);
    } catch (i) {
      const s = new Error(`AudioWorklet addModule failed for url: ${e}`);
      throw s.cause = i, s;
    }
}
function I(n) {
  return Math.max(0, Math.min(1, n));
}
class v {
  constructor(e, t, i = {}) {
    this.emitter = e, this.client = t, this.opts = i, this.audioContext = null, this.workletNode = null, this.stream = null, this.source = null, this.inputAnalyser = null, this.inputRaf = null, this.recording = !1;
  }
  getRecording() {
    return this.recording;
  }
  ensureContext() {
    if (!this.audioContext) {
      const e = globalThis.AudioContext || globalThis.webkitAudioContext;
      this.audioContext = new e({ sampleRate: 48e3 });
    }
    return this.audioContext;
  }
  startInputAmplitudeLoop() {
    if (this.inputRaf !== null) return;
    const e = this.inputAnalyser;
    if (!e) return;
    const t = new Uint8Array(e.fftSize), i = () => {
      try {
        e.getByteTimeDomainData(t);
        let s = 0;
        for (let c = 0; c < t.length; c++) {
          const a = (t[c] - 128) / 128;
          s += a * a;
        }
        const o = Math.sqrt(s / t.length), l = I(o * 8);
        this.emitter.emit("inputAmplitude", { amplitude: l });
      } catch {
      }
      this.inputRaf = requestAnimationFrame(i);
    };
    this.inputRaf = requestAnimationFrame(i);
  }
  stopInputAmplitudeLoop() {
    this.inputRaf !== null && (cancelAnimationFrame(this.inputRaf), this.inputRaf = null, this.emitter.emit("inputAmplitude", { amplitude: 0 }));
  }
  async start(e) {
    await this.stop();
    const t = this.ensureContext();
    if (t.state === "suspended")
      try {
        await t.resume();
      } catch {
      }
    const i = {
      noiseSuppression: !1,
      echoCancellation: !0,
      autoGainControl: !0,
      channelCount: 1
    }, s = {
      audio: e?.microphoneDeviceId ? { ...i, deviceId: { exact: e.microphoneDeviceId } } : i
    };
    this.stream = await navigator.mediaDevices.getUserMedia(s), this.source = t.createMediaStreamSource(this.stream), this.inputAnalyser = t.createAnalyser(), this.inputAnalyser.fftSize = 2048, this.inputAnalyser.smoothingTimeConstant = 0.8, this.source.connect(this.inputAnalyser), this.startInputAmplitudeLoop();
    const o = M();
    await L(t, o);
    const l = e?.targetSampleRate ?? 48e3;
    this.workletNode = new AudioWorkletNode(t, "audio-processor", {
      processorOptions: {
        originalSampleRate: t.sampleRate,
        targetSampleRate: l
      }
    }), this.workletNode.port.onmessage = (c) => {
      const a = c.data;
      if (!a) return;
      if (typeof a == "object" && a !== null && !(a instanceof Int16Array)) {
        const u = a;
        u && u.type === "error" && (console.error("[audio-service][worklet] process error", {
          name: u.name,
          message: u.message,
          stack: u.stack
        }), this.emitter.emit("state", { state: "error" }));
        return;
      }
      const d = a;
      if (!(this.opts.shouldSendFrame && !this.opts.shouldSendFrame()))
        try {
          this.client.sendJson({
            action: "stream_data",
            data: Array.from(d),
            input_type: "audio"
          });
        } catch {
        }
    }, this.source.connect(this.workletNode), this.recording = !0, this.emitter.emit("state", { state: "recording" });
  }
  async stop() {
    if (this.recording = !1, this.stopInputAmplitudeLoop(), this.source) {
      try {
        this.source.disconnect();
      } catch {
      }
      this.source = null;
    }
    if (this.inputAnalyser) {
      try {
        this.inputAnalyser.disconnect();
      } catch {
      }
      this.inputAnalyser = null;
    }
    if (this.workletNode)
      try {
        this.workletNode.disconnect();
      } catch {
      }
    if (this.stream) {
      try {
        this.stream.getTracks().forEach((e) => e.stop());
      } catch {
      }
      this.stream = null;
    }
    if (this.workletNode) {
      try {
        this.workletNode.port.onmessage = null;
      } catch {
      }
      this.workletNode = null;
    }
    if (this.audioContext) {
      const e = this.audioContext;
      if (this.audioContext = null, e.state !== "closed")
        try {
          await e.close();
        } catch {
        }
    }
    this.emitter.emit("state", { state: "ready" });
  }
}
const N = 48e3;
function q() {
  let n = null, e = null;
  const t = async () => n || e || (e = (async () => {
    const s = (typeof window < "u" ? window : void 0)?.["ogg-opus-decoder"];
    if (!s || !s.OggOpusDecoder)
      throw new Error('Global OGG/OPUS decoder not found: window["ogg-opus-decoder"]');
    const o = new s.OggOpusDecoder();
    return await o.ready, n = o, o;
  })(), e);
  return {
    decode: async (i) => {
      const s = await t(), { channelData: o, sampleRate: l } = await s.decode(i);
      return o && o.length > 0 && o[0] && o[0].length > 0 ? { float32Data: o[0], sampleRate: l || N } : null;
    },
    reset: () => {
      try {
        n?.free?.();
      } catch {
      }
      n = null, e = null;
    }
  };
}
function S() {
  return Date.now();
}
function b(n, e, t) {
  if (!e || e <= 0) return n;
  let i = null;
  const s = new Promise((o, l) => {
    i = setTimeout(() => l(new Error(t)), e);
  });
  return Promise.race([n, s]).finally(() => {
    i && clearTimeout(i);
  });
}
function U(n) {
  const e = new _(), t = new C();
  let i = "idle";
  const s = (r) => {
    i !== r && (i = r, e.emit("state", { state: r }));
  };
  let o = n.focusModeEnabled === !0;
  const l = n.decoder === "global" || n.decoder === void 0 ? q() : n.decoder || null, c = new B(e, { decoder: l }), a = new v(e, n.client, {
    shouldSendFrame: () => o ? !c.getPlaying() : !0
  });
  let d = [], u = null, y = 0;
  const k = (r) => {
    if (!(!r || typeof r != "object")) {
      if (r.type === "session_started") {
        if (u) {
          const h = u;
          u = null, h(r.input_mode);
        }
        return;
      }
      if (r.type === "user_activity") {
        t.onUserActivity(r.interrupted_speech_id), c.stopPlayback({ resetDecoder: !1 });
        return;
      }
      if (r.type === "audio_chunk") {
        const h = t.onAudioChunk(r.speech_id);
        for (const p of h)
          if (p.kind === "reset_decoder")
            try {
              l?.reset?.();
            } catch {
            }
        return;
      }
    }
  }, x = async (r) => {
    if (!t.getSkipNextBinary())
      try {
        if (typeof Blob < "u" && r instanceof Blob) {
          await c.enqueueBinary(r);
          return;
        }
        if (r instanceof ArrayBuffer) {
          await c.enqueueBinary(r);
          return;
        }
        if (r instanceof Uint8Array) {
          await c.enqueueBinary(r);
          return;
        }
        const h = r;
        h && h.buffer instanceof ArrayBuffer && typeof h.byteLength == "number" && await c.enqueueBinary(new Uint8Array(h.buffer, h.byteOffset || 0, h.byteLength));
      } catch {
      }
  }, g = () => {
    d.length || (s("ready"), d = [
      n.client.on("json", ({ json: r }) => k(r)),
      n.client.on("binary", ({ data: r }) => void x(r)),
      n.client.on("close", () => {
        if (u) {
          const r = u;
          u = null, r("closed");
        }
      })
    ]);
  }, R = () => {
    for (const r of d)
      try {
        r();
      } catch {
      }
    d = [], u = null, t.reset(), c.stopPlayback({ resetDecoder: !1 }), a.stop(), s("idle");
  }, D = (r) => u ? b(
    new Promise((h) => {
      const p = u;
      u = (f) => {
        try {
          p(f);
        } finally {
          h();
        }
      };
    }),
    r,
    "Session start timeout"
  ) : (y = S(), b(
    new Promise((h) => {
      u = () => h();
    }),
    r,
    `Session start timeout after ${r}ms`
  ).finally(() => {
    u && S() - y >= r && (u = null);
  }));
  return {
    attach: g,
    detach: R,
    startVoiceSession: async (r) => {
      g(), s("starting");
      const h = r?.timeoutMs ?? 1e4, p = r?.targetSampleRate ?? (n.isMobile ? 16e3 : 48e3), f = D(h);
      try {
        n.client.sendJson({ action: "start_session", input_type: "audio" });
      } catch {
      }
      try {
        await Promise.all([
          f,
          a.start({
            microphoneDeviceId: r?.microphoneDeviceId ?? null,
            targetSampleRate: p
          })
        ]), s("recording");
      } catch (A) {
        throw await a.stop(), s("error"), A;
      }
    },
    stopVoiceSession: async () => {
      s("stopping"), await a.stop();
      try {
        n.client.sendJson({ action: "pause_session" });
      } catch {
      }
      s("ready");
    },
    stopPlayback: () => {
      t.reset(), c.stopPlayback({ resetDecoder: !0 });
    },
    on: e.on.bind(e),
    getState: () => i,
    setFocusMode: (r) => {
      o = r;
    }
  };
}
export {
  q as createGlobalOggOpusDecoder,
  U as createWebAudioService
};
