const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const ROOT = path.resolve(__dirname, '../..');
const SOURCE = fs.readFileSync(path.join(ROOT, 'static/model-profiler.js'), 'utf8');

test('model profiler reads Unity-owned VRM statistics without traversing the Three facade', () => {
    const window = {
        THREE: {
            get Vector2() { throw new Error('Unity profile must not read Three.js'); }
        }
    };
    vm.runInNewContext(SOURCE, {
        window,
        performance: { now: () => 0 },
        requestAnimationFrame: () => 1,
        cancelAnimationFrame() {},
        Date,
        Set,
        Object,
        Math,
    }, { filename: 'model-profiler.js' });

    const profile = {
        type: 'vrm', loaded: true, name: 'unity-avatar.vrm',
        geometry: { meshCount: 3, vertices: 12000, faces: 8000, morphTargetCount: 24 },
        materials: { count: 5, textureCount: 7 },
        skeleton: { boneCount: 78, humanBoneCount: 54 },
        springBones: { springCount: 4, jointCount: 18, colliderGroupCount: 2, colliderCount: 6 },
        renderer: {
            rendererCount: 3, materialSlotCount: 5, drawCalls: 8,
            drawCallsEstimated: true,
            drawCallEstimateMethod: 'sum_renderer_material_shader_passes',
            triangles: 8000, textures: 7, geometries: 3,
            size: { width: 1280, height: 720 }
        }
    };
    const canvas = { width: 1800, height: 2400, clientWidth: 600, clientHeight: 800 };
    const manager = {
        constructor: { name: 'UnityVRMManager' },
        currentModel: {
            url: '/static/vrm/unity-avatar.vrm',
            transform: {},
            vrm: {}
        },
        expression: { getExpressionList: () => ['neutral', 'happy', 'aa'] },
        getModelProfile: () => profile,
        getSurfaceCanvas: () => canvas,
        getSurfacePixelRatio: () => 3,
    };

    const profiler = new window.ModelProfiler();
    const snapshot = profiler.snapshot(manager);
    assert.equal(snapshot.loaded, true);
    assert.equal(snapshot.geometry.vertices, 12000);
    assert.equal(snapshot.materials.textureCount, 7);
    assert.equal(snapshot.skeleton.humanBoneCount, 54);
    assert.equal(snapshot.springBones.jointCount, 18);
    assert.equal(snapshot.renderer.drawCalls, 8);
    assert.equal(snapshot.renderer.drawCallsEstimated, true);
    assert.equal(snapshot.renderer.pixelRatio, 3);
    assert.deepEqual({ ...snapshot.renderer.size }, { width: 1800, height: 2400 });
    assert.equal(snapshot.expressions.count, 3);
    assert.equal(snapshot.gpu, undefined);
    assert.equal(manager.renderer, undefined);
    const assessment = profiler.assess(snapshot);
    assert.equal(assessment.overall, 'medium');
    assert.equal(assessment.details.vertices.value, 12000);
});
