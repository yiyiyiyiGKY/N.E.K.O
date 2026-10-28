const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const ROOT = path.resolve(__dirname, '..', '..');
const manifest = JSON.parse(fs.readFileSync(
    path.join(ROOT, 'static/vrm/motion/manifest.json'),
    'utf8'
));
const packedSource = fs.readFileSync(path.join(ROOT, manifest.assets[0].src[0]));

global.window = global;
global.location = { hostname: 'localhost' };
global.document = { baseURI: 'http://localhost/' };
global.crypto = crypto.webcrypto;
global.CustomEvent = class CustomEvent {
    constructor(type, init) {
        this.type = type;
        this.detail = init && init.detail;
    }
};
global.dispatchEvent = function () {};
global.addEventListener = function () {};
global.removeEventListener = function () {};
global.DecompressionStream = require('node:stream/web').DecompressionStream;

let blobSequence = 0;
const revokedUrls = [];
global.URL.createObjectURL = function () {
    blobSequence += 1;
    return `blob:test-${blobSequence}`;
};
global.URL.revokeObjectURL = function (url) { revokedUrls.push(url); };

vm.runInThisContext(
    fs.readFileSync(path.join(ROOT, 'static/vrm/motion/player.js'), 'utf8'),
    { filename: 'static/vrm/motion/player.js' }
);
vm.runInThisContext(
    fs.readFileSync(path.join(ROOT, 'static/vrm/vrm-expression.js'), 'utf8'),
    { filename: 'static/vrm/vrm-expression.js' }
);

function exactArrayBuffer(value) {
    const bytes = Buffer.from(value);
    return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
}

function response(body, status = 200) {
    return {
        ok: status < 400,
        status,
        async json() { return JSON.parse(JSON.stringify(body)); },
        async arrayBuffer() { return body; }
    };
}

function deferred() {
    let resolve;
    let reject;
    const promise = new Promise((done, fail) => {
        resolve = done;
        reject = fail;
    });
    return { promise, resolve, reject };
}

test('motion catalog loads under the public distribution policy and exposes localized previews', async () => {
    global.fetch = async (url) => {
        assert.equal(String(url), '/static/vrm/motion/manifest.json');
        return response(manifest);
    };

    const player = await new global.NekoMotionPlayer().load();
    assert.equal(player.assets.length, manifest.counts.files);
    assert.equal(player.assets.every((asset) => asset.compression === 'gzip'), true);
    const catalog = player.catalog('en-US');
    assert.equal(catalog.length, 73);
    assert.equal(catalog[0].path, '/static/vrm/animation/liked.vrma.gz');
    assert.equal(catalog[0].systemMotion, true);

    let previewPlan = null;
    player.playPlan = async (plan) => {
        previewPlan = plan;
        return true;
    };
    assert.equal(await player.playAsset('official_liked', { scheduleNext: false }), true);
    assert.equal(previewPlan[0].evidence.assetId, 'official_liked');
    assert.equal(previewPlan[0].scheduleNextRest, false);

    const unlicensed = JSON.parse(JSON.stringify(manifest));
    unlicensed.assets[0].license = '?';
    global.fetch = async () => response(unlicensed);
    await assert.rejects(new global.NekoMotionPlayer().load(), /unapproved or unlicensed/);
});

test('motion asset transport verifies packed and decoded hashes before creating a Unity-readable blob URL', async () => {
    const player = new global.NekoMotionPlayer();
    const asset = manifest.assets[0];
    let requestedUrl = '';
    let requestedOptions = null;
    global.fetch = async (url, options) => {
        requestedUrl = String(url);
        requestedOptions = options;
        return response(exactArrayBuffer(packedSource));
    };

    const url = await player._assetUrl(asset);
    assert.match(url, /^blob:test-/);
    assert.equal(requestedUrl, `/static/vrm/${asset.f}.gz`);
    assert.equal(requestedOptions.cache, 'no-cache');
    assert.equal(requestedOptions.signal instanceof AbortSignal, true);
    assert.equal(player.metrics.loaded, 1);

    const corruptedPacked = Buffer.from(packedSource);
    corruptedPacked[Math.min(20, corruptedPacked.length - 1)] ^= 0xff;
    global.fetch = async () => response(exactArrayBuffer(corruptedPacked));
    await assert.rejects(player._assetUrl(asset), /SHA-256 mismatch|decompression/i);
    assert.ok(player.metrics.integrityFailures >= 1);

    const decodedSource = require('node:zlib').gunzipSync(packedSource);
    const proxyDecoded = Buffer.from(decodedSource);
    proxyDecoded[0] ^= 0xff;
    global.fetch = async () => response(exactArrayBuffer(proxyDecoded));
    await assert.rejects(player._assetUrl(asset), /decoded SHA-256 mismatch/);
});

test('saved rests and low-pose transitions remain renderer-neutral', async () => {
    const player = new global.NekoMotionPlayer();
    player.assets = [
        { id: 'sit', m: 'sit', in: 'stand', out: 'sit', i: 2, s: ['upright'], card: { styles: ['upright'] } },
        { id: 'lie-side', m: 'lie', in: 'stand', out: 'lie', i: 2, s: ['side'], card: { styles: ['side'] } },
        { id: 'lie-prone', m: 'lie', in: 'stand', out: 'lie', i: 2, s: ['prone'], card: { styles: ['prone'] } },
        { id: 'recover-prone', m: 'recover', in: 'lie', out: 'stand', i: 2, s: ['prone'], card: { styles: ['prone'] } }
    ];
    const played = [];
    player._playAsset = async (asset) => { played.push(asset.id); return true; };
    player._playTransient = async (asset) => { played.push(asset.id); return true; };

    await player._enterLowPose({
        intent: 'lie', style: 'side', intensity: 2, evidence: { canonicalZh: '侧身躺下' }
    }, player.queueGeneration, 'side');
    await player._enterLowPose({
        intent: 'lie', style: 'prone', intensity: 2, evidence: { canonicalZh: '俯身趴下' }
    }, player.queueGeneration, 'prone');
    assert.deepEqual(played.slice(0, 2), ['lie-side', 'lie-prone']);
    assert.equal(player.state.poseStyle, 'prone');

    await player._enterLowPose({
        intent: 'sit', style: 'upright', intensity: 2, evidence: { canonicalZh: '坐起来' }
    }, player.queueGeneration, 'sit-after-prone');
    assert.deepEqual(played.slice(-2), ['recover-prone', 'sit']);
    assert.equal(player.state.posture, 'sit');

    const restPlayer = new global.NekoMotionPlayer();
    assert.equal(restPlayer.setSavedRestAnimations([
        '/user_vrm/animation/custom-idle.vrma',
        '/static/vrm/animation/wait01.vrma'
    ]), 2);
    assert.equal(restPlayer.savedRestAssets[1].url, '/static/vrm/animation/wait01.vrma.gz');
    let restUrl = '';
    restPlayer._manager = () => ({
        currentModel: { vrm: {} },
        async playVRMAAnimation(nextUrl) { restUrl = nextUrl; return true; }
    });
    assert.equal(await restPlayer.enterRest({
        assetId: restPlayer.savedRestAssets[0].id,
        force: true,
        scheduleNext: false
    }), true);
    assert.equal(restUrl, '/user_vrm/animation/custom-idle.vrma');
});

test('external playback tokens, cancellation and late Unity loads cannot overwrite the current owner', async () => {
    const player = new global.NekoMotionPlayer();
    player.state.posture = 'lie';
    player.state.phase = 'pose';
    player.state.poseAsset = { id: 'held-pose', mode: 'loop' };
    player.state.poseStyle = 'side';
    const resumed = [];
    player._playAsset = async (asset) => { resumed.push(asset.id); return true; };

    assert.equal(player.holdExternalPlayback('jukebox', { token: 41 }), true);
    assert.equal(await player.releaseExternalPlayback('jukebox', { token: 40, resume: true }), false);
    assert.equal(player.externalPlaybackOwners.get('jukebox'), 41);
    player.cancel('assistant_speech_cancel', { resume: true });
    await Promise.resolve();
    assert.deepEqual(resumed, []);
    assert.equal(player.state.phase, 'external');
    assert.equal(await player.releaseExternalPlayback('jukebox', {
        token: 41,
        resume: true,
        scheduleNext: false
    }), true);
    assert.deepEqual(resumed, ['held-pose']);

    const stale = new global.NekoMotionPlayer();
    const playback = deferred();
    let shouldApply = null;
    stale._assetUrl = async () => 'blob:test-stale';
    global.vrmManager = {
        currentModel: { vrm: {} },
        playVRMAAnimation(_url, options) {
            shouldApply = options.shouldApply;
            return playback.promise;
        }
    };
    const request = stale._playAsset({ id: 'stale', m: 'wave', i: 2 }, stale.queueGeneration, {});
    await Promise.resolve();
    assert.equal(typeof shouldApply, 'function');
    stale.cancel('model-replaced', { resume: false });
    assert.equal(shouldApply(), false);
    playback.resolve(true);
    assert.equal(await request, false);
    assert.equal(stale.state.currentAsset, null);
    assert.equal(stale.metrics.played, 0);
    assert.ok(revokedUrls.includes('blob:test-stale'));
    global.vrmManager = null;
});

test('model-specific expression mapping remains latest-request-wins after the Unity migration', async () => {
    const expression = new global.VRMExpression({});
    assert.deepEqual(expression._resolveMoodWeights('shy', ['relaxed', 'happy']), {
        relaxed: 0.55,
        happy: 0.18
    });

    const first = deferred();
    const second = deferred();
    global.fetch = (url) => String(url).includes('first-model') ? first.promise : second.promise;
    const firstLoad = expression.loadMoodMap('first-model');
    const secondLoad = expression.loadMoodMap('second-model');
    second.resolve(response({ success: true, config: { happy: ['second_happy'] } }));
    await secondLoad;
    first.resolve(response({ success: true, config: { happy: ['first_happy'] } }));
    await firstLoad;

    assert.deepEqual(expression.getMoodMap().happy, ['second_happy']);
    assert.equal(expression.customMoodKeys.has('happy'), true);
    assert.deepEqual(expression._resolveMoodWeights('happy', ['happy', 'second_happy']), {
        second_happy: 1
    });
});
