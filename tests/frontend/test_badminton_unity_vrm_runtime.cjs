const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const ROOT = path.resolve(__dirname, '..', '..');
const template = fs.readFileSync(path.join(ROOT, 'templates', 'badminton_demo.html'), 'utf8');

function plain(value) {
  return JSON.parse(JSON.stringify(value));
}

function extractFunction(name) {
  const plain = template.indexOf(`function ${name}(`);
  const asyncStart = template.indexOf(`async function ${name}(`);
  const start = plain >= 0 && (asyncStart < 0 || plain < asyncStart) ? plain : asyncStart;
  assert.notEqual(start, -1, `missing function ${name}`);
  const open = template.indexOf('{', start);
  let quote = '';
  let escaped = false;
  let lineComment = false;
  let blockComment = false;
  let depth = 0;
  for (let index = open; index < template.length; index += 1) {
    const char = template[index];
    const next = template[index + 1];
    if (lineComment) {
      if (char === '\n') lineComment = false;
      continue;
    }
    if (blockComment) {
      if (char === '*' && next === '/') { blockComment = false; index += 1; }
      continue;
    }
    if (quote) {
      if (escaped) escaped = false;
      else if (char === '\\') escaped = true;
      else if (char === quote) quote = '';
      continue;
    }
    if (char === '/' && next === '/') { lineComment = true; index += 1; continue; }
    if (char === '/' && next === '*') { blockComment = true; index += 1; continue; }
    if (char === '"' || char === "'" || char === '`') { quote = char; continue; }
    if (char === '{') depth += 1;
    if (char === '}') {
      depth -= 1;
      if (depth === 0) return template.slice(start, index + 1);
    }
  }
  throw new Error(`unterminated function ${name}`);
}

function createHarness() {
  const calls = [];
  const anchors = new Map([
    ['badminton-player-racket-sweet-spot', { name: 'racket', x: 450, y: 250, visible: true }],
    ['badminton-player-held-shuttle', { name: 'shuttle', x: 470, y: 270, visible: true }],
    ['badminton-player-left-hand', { name: 'leftHand', x: 430, y: 220, visible: true }],
  ]);
  const manager = {
    currentModel: {},
    resizeSurface: (...args) => calls.push(['resizeSurface', ...args]),
    fitModel: (...args) => calls.push(['fitModel', ...args]),
    attachAccessory: async (config) => { calls.push(['attachAccessory', config]); return true; },
    setAccessoryVisible: async (id, visible) => { calls.push(['setAccessoryVisible', id, visible]); return true; },
    setPose: (config) => { calls.push(['setPose', config]); return true; },
    resetPose: (id) => { calls.push(['resetPose', id]); return true; },
    getScreenAnchor: (name) => anchors.get(name) || null,
  };
  const playerContainer = {
    hidden: false,
    dataset: { racket3d: 'ready', heldShuttle3d: 'ready' },
    clientWidth: 292,
    clientHeight: 396,
    getBoundingClientRect: () => ({ left: 100, top: 40, width: 292, height: 396 }),
  };
  const yuiContainer = { dataset: {}, clientWidth: 180, clientHeight: 270 };
  const context = {
    Math,
    Number,
    Promise,
    console: { warn: (...args) => calls.push(['warn', ...args]) },
    window: {
      badmintonPlayerVrmManager: manager,
      innerWidth: 900,
      innerHeight: 500,
    },
    playerSenseiContainer: playerContainer,
    nekoVrmContainer: yuiContainer,
    playerSenseiReady: true,
    playerHeldShuttleAccessoryVisible: null,
    PLAYER_VRM_POSE_ID: 'badminton-player-pose',
    PLAYER_RACKET_ACCESSORY_ID: 'badminton-player-racket',
    PLAYER_SHUTTLE_ACCESSORY_ID: 'badminton-player-held-shuttle',
    YUI_RACKET_ACCESSORY_ID: 'badminton-yui-racket',
    PLAYER_RACKET_ANCHOR: 'badminton-player-racket-sweet-spot',
    PLAYER_SHUTTLE_ANCHOR: 'badminton-player-held-shuttle',
    PLAYER_LEFT_HAND_ANCHOR: 'badminton-player-left-hand',
    BASE_W: 900,
    BASE_H: 500,
    shouldDrawHeldShuttle: () => true,
    clamp: (value, min, max) => Math.max(min, Math.min(max, value)),
  };
  vm.createContext(context);
  [
    'settleBadmintonUnityCommand',
    'syncPlayerHeldShuttleVisibility',
    'attachPlayerRacketToHand',
    'attachPlayerHeldShuttleToHand',
    'attachYuiRacketToHand',
    'resetPlayerVrmPose',
    'applyPlayerVrmPoseFrame',
    'fitVRMToContainer',
    'getPlayerVrmRacketContactPoint',
    'getPlayerVrmHeldShuttleCanvasPoint',
    'getPlayerHeldShuttleServeHandCanvasPoint',
    'focusAvatarManagerAtScreenPoint',
  ].forEach((name) => vm.runInContext(extractFunction(name), context));
  return { calls, context, manager, playerContainer, yuiContainer };
}

test('badminton routes VRM accessories, poses, fitting, and screen anchors through Unity', async () => {
  const { calls, context, manager, playerContainer, yuiContainer } = createHarness();

  assert.equal(await context.attachPlayerRacketToHand(manager), true);
  assert.equal(await context.attachPlayerHeldShuttleToHand(manager), true);
  assert.equal(await context.attachYuiRacketToHand(manager), true);

  const attachments = calls.filter((entry) => entry[0] === 'attachAccessory').map((entry) => entry[1]);
  assert.deepEqual(plain(attachments.map((entry) => entry.preset)), [
    'badmintonRacket', 'badmintonShuttle', 'badmintonRacket',
  ]);
  assert.equal(attachments[0].bone, 'rightHand');
  assert.deepEqual(plain(attachments[0].scale), { x: 1.26, y: 1.26, z: 1.26 });
  assert.equal(attachments[1].bone, 'leftHand');
  assert.deepEqual(plain(attachments[1].position), { x: 0.04, y: 0, z: 0.135 });
  assert.equal(playerContainer.dataset.racket3d, 'ready');
  assert.equal(playerContainer.dataset.heldShuttle3d, 'ready');
  assert.equal(yuiContainer.dataset.racket3d, 'ready');

  context.applyPlayerVrmPoseFrame('shooting', 0.5);
  const pose = calls.findLast((entry) => entry[0] === 'setPose')[1];
  assert.equal(pose.poseId, 'badminton-player-pose');
  assert.deepEqual(plain(pose.bones.map((bone) => bone.name)), ['hips', 'spine', 'chest']);
  assert.equal(pose.rootOffset.y, 0.014);
  context.resetPlayerVrmPose();
  assert.deepEqual(calls.findLast((entry) => entry[0] === 'resetPose'), [
    'resetPose', 'badminton-player-pose',
  ]);

  context.fitVRMToContainer(manager, playerContainer);
  assert.deepEqual(calls.findLast((entry) => entry[0] === 'resizeSurface'), ['resizeSurface', 292, 396, false]);
  const fit = calls.findLast((entry) => entry[0] === 'fitModel');
  assert.deepEqual(plain(fit[1]), { width: 292, height: 396 });
  assert.deepEqual(plain(fit[2]), { mode: 'height', align: 'bottom-center', padding: 0 });
  assert.deepEqual(plain(fit[3]), { scale: 78.125, x: 0, y: 0 });

  assert.deepEqual(plain(context.getPlayerVrmRacketContactPoint()), {
    x: 450,
    y: 250,
    source: 'player-vrm-racket',
  });
  const held = context.getPlayerVrmHeldShuttleCanvasPoint();
  assert.ok(Math.abs(held.x - 470) < 1e-9);
  assert.ok(Math.abs(held.y - 270) < 1e-9);
  const hand = context.getPlayerHeldShuttleServeHandCanvasPoint();
  assert.equal(hand.source, 'player-vrm-held-shuttle-left-hand');

  await new Promise((resolve) => setImmediate(resolve));
  const visibilityCalls = calls.filter((entry) => entry[0] === 'setAccessoryVisible');
  assert.equal(visibilityCalls.length, 1);
  assert.deepEqual(visibilityCalls[0], ['setAccessoryVisible', 'badminton-player-held-shuttle', true]);
});
test('badminton routes avatar focus through the Unity pointer bridge', () => {
  const { context } = createHarness();
  const events = [];
  const follower = {
    _rawMouseX: null,
    _rawMouseY: null,
    _onPointerMove: (event) => events.push(plain(event)),
  };

  context.focusAvatarManagerAtScreenPoint({ _cursorFollow: follower }, 321, 123);

  assert.deepEqual(events, [{ clientX: 321, clientY: 123 }]);
  assert.equal(follower._rawMouseX, null);
  assert.equal(follower._rawMouseY, null);
});
