import assert from 'node:assert/strict';
import fs from 'node:fs';

const calls = [];
const nodes = new Map();
class Canvas {
  constructor() { this.id = ''; this.style = {}; this.removed = false; }
  getBoundingClientRect() { return { left: 10, top: 20, width: 200, height: 300 }; }
  remove() { this.removed = true; }
}
const container = {
  id: 'avatar', clientWidth: 180, clientHeight: 260, children: [],
  append(node) { this.children.push(node); nodes.set(node.id, node); },
};
nodes.set(container.id, container);
globalThis.document = {
  createElement(tag) { assert.equal(tag, 'canvas'); return new Canvas(); },
  getElementById(id) { return nodes.get(id) || null; },
};
class UnityVRMManagerMock {
  constructor() {
    this._cursorFollow = { _onPointerMove: event => calls.push(['focus', event.clientX, event.clientY]) };
  }
  async initRenderer(canvasId, containerId) {
    calls.push(['init', canvasId, containerId]);
    this.canvas = nodes.get(canvasId);
  }
  resizeSurface(width, height, updateStyle) { calls.push(['size', width, height, updateStyle]); }
  getSurfaceCanvas() { return this.canvas; }
  async loadModel(path, options) {
    calls.push(['model', path, options.embed, options.restorePreferences, options.autoPlay]);
    this.currentModel = { vrm: { expressionManager: {
      resetValues: () => calls.push(['reset-expression']),
      setValue: (name, value) => calls.push(['expression', name, value]),
    } } };
  }
  fitModel(viewport, fit) { calls.push(['fit', viewport.width, viewport.height, fit.mode, fit.align]); }
  pauseRendering() { calls.push(['pause']); }
  resumeRendering() { calls.push(['resume']); }
  async dispose() { calls.push(['dispose']); this.currentModel = null; }
}
globalThis.window = {
  UnityVRMManager: UnityVRMManagerMock,
  NekoUnityVRMLoader: { ensure: async () => UnityVRMManagerMock },
};

const { create } = await import('../../static/game/games/watch-together/vrm-host.mjs');
const avatar = create(container);
avatar.resize({ width: 200, height: 300 });
await avatar.setModel({ path: '/static/vrm/avatar.vrm' });
assert.deepEqual(calls.find(call => call[0] === 'model'),
  ['model', '/static/vrm/avatar.vrm', true, false, false]);
assert.deepEqual(calls.filter(call => call[0] === 'fit').at(-1), ['fit', 200, 300, 'contain', 'bottom-center']);
assert.equal(avatar.getState().ready, true);
assert.equal(avatar.focus({ x: 0, y: 0 }), true);
assert.deepEqual(calls.filter(call => call[0] === 'focus').at(-1), ['focus', 110, 170]);
assert.equal(avatar.setEmotion('happy'), true);
assert.deepEqual(calls.filter(call => call[0] === 'expression').at(-1), ['expression', 'happy', 0.6]);
avatar.mouth(2);
assert.deepEqual(calls.filter(call => call[0] === 'expression').at(-1), ['expression', 'aa', 1]);
avatar.pause(); avatar.resume();
await avatar.dispose();
assert.equal(container.children[0].removed, true);
assert(calls.some(call => call[0] === 'dispose'));

const template = fs.readFileSync(new URL('../../templates/watch_together.html', import.meta.url), 'utf8');
const host = fs.readFileSync(new URL('../../static/game/games/watch-together/vrm-host.mjs', import.meta.url), 'utf8');
assert(template.includes('/static/unity/unity-vrm-loader.js'));
assert(!template.includes('/static/unity/unity-avatar-manager.js'));
assert(!template.includes('@pixiv/three-vrm'));
assert(!host.includes('GLTFLoader') && !host.includes('VRMLoaderPlugin'));
console.log('watch-together Unity VRM host contract passed');
