const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const ROOT = path.resolve(__dirname, '../..');
const SOURCE = fs.readFileSync(path.join(ROOT, 'static/avatar/avatar-portrait.js'), 'utf8');

const VRM_ADAPTER_SOURCE = SOURCE.slice(
    SOURCE.indexOf('function getVrmAdapter()'),
    SOURCE.indexOf('function findMmdHeadAnchor('),
);

class FakeCanvas {
    constructor(width = 1, height = 1, rect = null) {
        this.width = width;
        this.height = height;
        this.clientWidth = rect?.width || width;
        this.clientHeight = rect?.height || height;
        this._rect = rect;
        this.drawCalls = [];
    }
    getBoundingClientRect() {
        return this._rect || { left: 0, top: 0, width: this.clientWidth, height: this.clientHeight };
    }
    getContext() {
        return {
            save() {}, restore() {}, beginPath() {}, rect() {}, clip() {}, arc() {}, arcTo() {},
            moveTo() {}, closePath() {}, fillRect() {},
            drawImage: (...args) => this.drawCalls.push(args),
        };
    }
}

test('Unity VRM portrait uses manager screen geometry and never projects the facade with Three', async () => {
    assert.doesNotMatch(VRM_ADAPTER_SOURCE, /global\.THREE|computeProjectedBoxCss/);
    const sourceCanvas = new FakeCanvas(1600, 1200, {
        left: 100, top: 50, width: 800, height: 600,
    });
    let waitedForFrame = false;

    class UnityVRMManagerMock {
        constructor() {
            this.currentModel = { transform: {}, vrm: {} };
            this._isModelReadyForInteraction = true;
        }
        getCurrentModel() { return this.currentModel; }
        getSurfaceCanvas() { return sourceCanvas; }
        getModelScreenBounds() {
            return { left: 300, top: 100, right: 700, bottom: 550, width: 400, height: 450,
                centerX: 500, centerY: 325 };
        }
        getHeadDetectionGeometryInfo() {
            return {
                bounds: this.getModelScreenBounds(),
                headRect: { left: 430, top: 110, right: 570, bottom: 250, width: 140, height: 140 },
                headAnchor: { x: 500, y: 170 },
            };
        }
        async waitForRenderedFrame() { waitedForFrame = true; }
    }

    const document = {
        getElementById() { return null; },
        createElement(tag) {
            assert.equal(tag, 'canvas');
            return new FakeCanvas();
        },
    };
    const window = {
        document,
        UnityVRMManager: UnityVRMManagerMock,
        vrmManager: new UnityVRMManagerMock(),
        lanlan_config: { model_type: 'vrm' },
        location: { href: 'http://127.0.0.1:48911/' },
        setTimeout,
        clearTimeout,
    };
    Object.defineProperty(window, 'THREE', {
        get() { throw new Error('Unity portrait must not read Three.js'); },
    });
    const sandbox = { window, document, console, URL, Promise, Array, setTimeout, clearTimeout };
    vm.runInNewContext(SOURCE, sandbox, { filename: 'avatar-portrait.js' });

    const result = await window.avatarPortrait.capture({
        modelType: 'vrm', width: 512, height: 512, cropMode: 'headshot',
    });
    assert.equal(waitedForFrame, true);
    assert.equal(result.modelType, 'vrm');
    assert.equal(result.sourceCanvas, sourceCanvas);
    assert.ok(result.cropRectCss.width > 0 && result.cropRectCss.height > 0);
    assert.ok(result.cropRectCss.x >= 0 && result.cropRectCss.y >= 0);
    assert.equal(result.canvas.drawCalls.length, 1);
});
