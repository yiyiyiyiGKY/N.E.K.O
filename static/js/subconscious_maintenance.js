(function () {
    'use strict';

    var SPRITE_SHEET_URL = '/static/icons/subconscious_maintenance_sprites.png';
    var VFX_SHEET_URL = '/static/icons/subconscious_maintenance_vfx.png';
    var GAME_TYPE = 'subconscious_maintenance';
    var ROUTE_BASE_URL = '/api/game/' + GAME_TYPE + '/route';
    var ROUTE_HEARTBEAT_INTERVAL_MS = 10000;
    var SPRITE_COLUMNS = 4;
    var SPRITE_ROWS = 2;
    var VFX_COLUMNS = 2;
    var VFX_ROWS = 1;
    var SPRITES = {
        player: { col: 0, row: 0, label: 'Player' },
        neko: { col: 1, row: 0, label: 'NEKO' },
        glitchWorm: { col: 2, row: 0, label: 'Glitch Worm', enemy: true },
        noiseSquid: { col: 3, row: 0, label: 'Noise Squid', enemy: true },
        logicBomb: { col: 0, row: 1, label: 'Logic Bomb', enemy: true },
        fragment: { col: 1, row: 1, label: 'Fragment' },
        specialItem: { col: 2, row: 1, label: 'Special Item' }
    };
    var ENEMY_SPRITES = ['glitchWorm', 'logicBomb', 'noiseSquid'];
    var FRAGMENTS_PER_BUFF = 10;
    var BUFFS = {
        speed_up: { label: '加速', ttl: 10 },
        range_up: { label: '扩距', ttl: 10 },
        magnet_up: { label: '吸附', ttl: 10 }
    };
    var NEKO_FOLLOW_SOFT_DISTANCE = 92;
    var NEKO_FOLLOW_MAX_DISTANCE = 126;
    var NEKO_FOLLOW_COLLECT_RADIUS = 128;
    var NEKO_EVADE_ENTER_DISTANCE = 76;
    var NEKO_EVADE_EXIT_DISTANCE = 112;
    var NEKO_EVADE_PRESSURE_ENTER = 0.88;
    var NEKO_EVADE_LOCK_SECONDS = 0.85;

    var body = document.body;
    var canvas = document.getElementById('subconscious-maintenance-canvas');
    var loadingLayer = document.getElementById('subconscious-maintenance-loading');
    var loadingStatus = document.getElementById('subconscious-maintenance-loading-status');
    var loadingExitBtn = document.getElementById('subconscious-maintenance-loading-exit-btn');
    var setupLayer = document.getElementById('subconscious-maintenance-setup');
    var pauseLayer = document.getElementById('subconscious-maintenance-pause-layer');
    var endLayer = document.getElementById('subconscious-maintenance-end-layer');
    var startBtn = document.getElementById('subconscious-maintenance-start-btn');
    var continueBtn = document.getElementById('subconscious-maintenance-continue-btn');
    var restartBtn = document.getElementById('subconscious-maintenance-restart-btn');
    var exitBtn = document.getElementById('subconscious-maintenance-exit-btn');
    var endRestartBtn = document.getElementById('subconscious-maintenance-end-restart-btn');
    var endExitBtn = document.getElementById('subconscious-maintenance-end-exit-btn');
    var resultTitle = document.getElementById('subconscious-maintenance-result-title');
    var resultDetail = document.getElementById('subconscious-maintenance-result-detail');
    var sessionLabel = document.getElementById('subconscious-maintenance-session-label');
    var difficultyButtons = Array.prototype.slice.call(document.querySelectorAll('.sm-difficulty-btn'));
    var nekoModeBtn = document.getElementById('subconscious-maintenance-neko-mode-btn');
    var nekoModeValue = document.getElementById('subconscious-maintenance-neko-mode');
    var buffValue = document.getElementById('subconscious-maintenance-buff');
    var stabilityValue = document.getElementById('subconscious-maintenance-stability');
    var fragmentsValue = document.getElementById('subconscious-maintenance-fragments');
    var wormsValue = document.getElementById('subconscious-maintenance-worms');
    var comboValue = document.getElementById('subconscious-maintenance-combo');
    var context = canvas ? canvas.getContext('2d') : null;
    var resizeRaf = 0;
    var frameRaf = 0;
    var heartbeatTimer = 0;
    var lastFrameTime = 0;
    var spriteSheet = null;
    var spriteCell = { width: 0, height: 0 };
    var vfxSheet = null;
    var vfxCell = { width: 0, height: 0 };
    var field = { width: 1, height: 1, dpr: 1 };
    var scene = {
        player: { x: 0, y: 0, facingX: 1, facingY: 0 },
        neko: { x: 0, y: 0, facingX: 1, facingY: 0 },
        target: { x: 0, y: 0 }
    };
    var difficultyConfig = {
        easy: {
            spawnInterval: 1.6,
            maxEnemies: 4,
            enemySpeed: 41,
            stability: 110,
            playerSpeed: 180,
            nekoSpeed: 75,
            playerAttackCooldown: 0.22,
            nekoAttackCooldown: 2.2,
            contactDamage: 8
        },
        normal: {
            spawnInterval: 1.1,
            maxEnemies: 6,
            enemySpeed: 49,
            stability: 100,
            playerSpeed: 192,
            nekoSpeed: 84,
            playerAttackCooldown: 0.2,
            nekoAttackCooldown: 2,
            contactDamage: 10
        },
        hard: {
            spawnInterval: 0.84,
            maxEnemies: 8,
            enemySpeed: 59,
            stability: 95,
            playerSpeed: 205,
            nekoSpeed: 93,
            playerAttackCooldown: 0.18,
            nekoAttackCooldown: 1.8,
            contactDamage: 12
        }
    };
    var enemyConfig = {
        glitchWorm: {
            spriteKey: 'glitchWorm',
            radius: 28,
            speedFactor: 1,
            damage: 8,
            loot: 1,
            specialChance: 0.008,
            color: 'rgba(255, 76, 108, 0.88)'
        },
        logicBomb: {
            spriteKey: 'logicBomb',
            radius: 32,
            speedFactor: 0.84,
            damage: 10,
            loot: 2,
            specialChance: 0.014,
            color: 'rgba(197, 90, 255, 0.88)'
        },
        noiseSquid: {
            spriteKey: 'noiseSquid',
            radius: 30,
            speedFactor: 1.06,
            damage: 9,
            loot: 1,
            specialChance: 0.011,
            color: 'rgba(71, 197, 255, 0.88)'
        }
    };
    var battle = {
        enemies: [],
        fragments: [],
        specialItems: [],
        effects: [],
        hotZones: [],
        spawnTimer: 0,
        playerAttackCooldown: 0,
        nekoAttackCooldown: 0,
        comboDecayTimer: 0,
        buffTimer: 0,
        buffType: '',
        buffEndedTimer: 0,
        fragmentBuffProgress: 0,
        nekoEvadeTimer: 0,
        nekoEvadeTarget: null,
        attackQueued: false,
        resultLocked: false,
        maxStability: 100
    };

    var state = {
        phase: 'loading',
        difficulty: 'easy',
        stability: 100,
        fragments: 0,
        specialItems: 0,
        worms: 0,
        combo: 0,
        attackFlashTimer: 0,
        attackFlashX: 0,
        attackFlashY: 0,
        attackFlashOriginX: 0,
        attackFlashOriginY: 0,
        attackFlashAngle: 0,
        attackFlashRange: 0,
        attackFlashWidth: 0,
        attackFlashHit: false,
        nekoMode: 'free',
        nekoIntent: 'follow',
        nekoFollowSettled: true,
        nekoHint: '',
        nekoHintTimer: 0,
        buffLabel: '无',
        pointer: null,
        spriteReady: false,
        loadError: ''
    };

    var routeState = {
        started: false,
        ended: false,
        startInFlight: false,
        startPromise: null,
        pendingEndReason: '',
        pendingEndUseBeacon: false,
        generation: 0
    };

    function readQuery() {
        var params = null;
        try {
            params = new URLSearchParams(window.location.search);
        } catch (_) {
            params = null;
        }
        return {
            lanlanName: params ? String(params.get('lanlan_name') || '') : '',
            sessionId: params ? String(params.get('session_id') || '') : ''
        };
    }

    var query = readQuery();
    window.__nekoSubconsciousMaintenanceQuery = query;

    function withAssetVersion(url) {
        try {
            var scriptUrl = document.currentScript && document.currentScript.src
                ? new URL(document.currentScript.src, window.location.href)
                : null;
            var version = scriptUrl ? scriptUrl.searchParams.get('v') : '';
            return version ? url + '?v=' + encodeURIComponent(version) : url;
        } catch (_) {
            return url;
        }
    }

    function ensureSessionId() {
        if (query.sessionId) return query.sessionId;
        query.sessionId = 'subconscious-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8);
        return query.sessionId;
    }

    function setText(el, value) {
        if (el) {
            el.textContent = String(value);
        }
    }

    function setLayerVisible(layer, visible) {
        if (!layer) return;
        layer.hidden = !visible;
    }

    function setButtonDisabled(button, disabled) {
        if (button) {
            button.disabled = !!disabled;
        }
    }

    function clamp(value, min, max) {
        return Math.max(min, Math.min(max, value));
    }

    function clampPoint(point) {
        if (!point) return { x: 0, y: 0 };
        return {
            x: clamp(point.x, 0, field.width),
            y: clamp(point.y, 0, field.height)
        };
    }

    function randomRange(min, max) {
        return min + Math.random() * (max - min);
    }

    function distanceSquared(a, b) {
        var dx = (a.x || 0) - (b.x || 0);
        var dy = (a.y || 0) - (b.y || 0);
        return dx * dx + dy * dy;
    }

    function distance(a, b) {
        return Math.sqrt(distanceSquared(a, b));
    }

    function normalizeVector(dx, dy) {
        var len = Math.sqrt(dx * dx + dy * dy) || 1;
        return { x: dx / len, y: dy / len };
    }

    function updatePlayerFacing(target) {
        var dx = (target.x || 0) - scene.player.x;
        var dy = (target.y || 0) - scene.player.y;
        if (Math.abs(dx) + Math.abs(dy) < 3) return;
        var dir = normalizeVector(dx, dy);
        scene.player.facingX = dir.x;
        scene.player.facingY = dir.y;
    }

    function moveTowardPoint(source, target, maxDistance) {
        var dx = (target.x || 0) - (source.x || 0);
        var dy = (target.y || 0) - (source.y || 0);
        var len = Math.sqrt(dx * dx + dy * dy);
        if (!len || len <= maxDistance) {
            source.x = target.x;
            source.y = target.y;
            return source;
        }
        var ratio = maxDistance / len;
        source.x += dx * ratio;
        source.y += dy * ratio;
        return source;
    }

    function updateEntityFacing(entity, vx, vy) {
        if (!entity) return;
        if (Math.abs(vx) + Math.abs(vy) < 0.2) return;
        var dir = normalizeVector(vx, vy);
        entity.facingX = dir.x;
        entity.facingY = dir.y;
    }

    function getDifficultyState() {
        return difficultyConfig[state.difficulty] || difficultyConfig.easy;
    }

    function addEffect(effect) {
        battle.effects.push(effect);
    }

    function addHotZone(x, y, weight) {
        battle.hotZones.push({
            x: x,
            y: y,
            weight: weight || 1,
            ttl: 4.8
        });
        if (battle.hotZones.length > 16) {
            battle.hotZones.shift();
        }
    }

    function getHotZoneCenter() {
        var total = 0;
        var x = 0;
        var y = 0;
        for (var i = 0; i < battle.hotZones.length; i++) {
            var zone = battle.hotZones[i];
            if (zone.ttl <= 0) continue;
            var weight = zone.weight * (zone.ttl / 4.8);
            total += weight;
            x += zone.x * weight;
            y += zone.y * weight;
        }
        if (total <= 0) return null;
        return { x: x / total, y: y / total };
    }

    function updateHotZones(dt) {
        for (var i = battle.hotZones.length - 1; i >= 0; i--) {
            battle.hotZones[i].ttl -= dt;
            if (battle.hotZones[i].ttl <= 0) {
                battle.hotZones.splice(i, 1);
            }
        }
    }

    function makeEffect(x, y, options) {
        var opts = options || {};
        return {
            kind: opts.kind || 'burst',
            x: x,
            y: y,
            radius: opts.radius || 12,
            maxRadius: opts.maxRadius || 28,
            ttl: opts.ttl || 0.35,
            total: opts.total || opts.ttl || 0.35,
            color: opts.color || 'rgba(70, 176, 255, 0.88)',
            stroke: opts.stroke || false,
            x2: opts.x2 || x,
            y2: opts.y2 || y,
            lineWidth: opts.lineWidth || 2,
            driftX: opts.driftX || 0,
            driftY: opts.driftY || 0
        };
    }

    function spawnDropFragment(x, y, velocityX, velocityY) {
        battle.fragments.push({
            x: x,
            y: y,
            vx: velocityX,
            vy: velocityY,
            radius: 10,
            ttl: 6,
            kind: 'fragment'
        });
    }

    function spawnSpecialItem(x, y) {
        battle.specialItems.push({
            x: x,
            y: y,
            vx: randomRange(-16, 16),
            vy: randomRange(-16, 16),
            radius: 12,
            ttl: 10,
            kind: 'special'
        });
    }

    function spawnEnemy(typeKey) {
        var cfg = enemyConfig[typeKey] || enemyConfig.glitchWorm;
        var side = Math.floor(Math.random() * 4);
        var spawnPoint = { x: 0, y: 0 };
        if (side === 0) {
            spawnPoint.x = -24;
            spawnPoint.y = randomRange(0, field.height);
        } else if (side === 1) {
            spawnPoint.x = field.width + 24;
            spawnPoint.y = randomRange(0, field.height);
        } else if (side === 2) {
            spawnPoint.x = randomRange(0, field.width);
            spawnPoint.y = -24;
        } else {
            spawnPoint.x = randomRange(0, field.width);
            spawnPoint.y = field.height + 24;
        }
        var enemy = {
            type: typeKey,
            spriteKey: cfg.spriteKey,
            x: spawnPoint.x,
            y: spawnPoint.y,
            vx: 0,
            vy: 0,
            facingX: spawnPoint.x < field.width / 2 ? 1 : -1,
            facingY: 0,
            radius: cfg.radius,
            hp: 1,
            speedFactor: cfg.speedFactor,
            damage: cfg.damage,
            loot: cfg.loot,
            specialChance: cfg.specialChance,
            hidden: false,
            phaseTimer: typeKey === 'noiseSquid' ? randomRange(0.55, 1.35) : 0,
            invulnerable: false,
            drift: randomRange(0, Math.PI * 2)
        };
        battle.enemies.push(enemy);
        return enemy;
    }

    function spawnLogicBombShards(entity) {
        var baseAngle = Math.random() * Math.PI * 2;
        for (var i = 0; i < 3; i++) {
            var angle = baseAngle + i * (Math.PI * 2 / 3);
            var shard = {
                type: 'glitchWorm',
                spriteKey: 'glitchWorm',
                x: entity.x + Math.cos(angle) * 18,
                y: entity.y + Math.sin(angle) * 18,
                vx: Math.cos(angle) * 34,
                vy: Math.sin(angle) * 34,
                facingX: Math.cos(angle),
                facingY: Math.sin(angle),
                radius: 17,
                hp: 1,
                speedFactor: 1.2,
                damage: 4,
                loot: 0,
                specialChance: 0,
                hidden: false,
                phaseTimer: 0,
                invulnerable: false,
                drift: randomRange(0, Math.PI * 2),
                splitShard: true
            };
            battle.enemies.push(shard);
        }
    }

    function pickEnemyType() {
        var roll = Math.random();
        if (state.difficulty === 'easy') {
            if (roll < 0.56) return 'glitchWorm';
            if (roll < 0.84) return 'logicBomb';
            return 'noiseSquid';
        }
        if (state.difficulty === 'hard') {
            if (roll < 0.34) return 'glitchWorm';
            if (roll < 0.69) return 'logicBomb';
            return 'noiseSquid';
        }
        if (roll < 0.45) return 'glitchWorm';
        if (roll < 0.79) return 'logicBomb';
        return 'noiseSquid';
    }

    function resetBattleState() {
        var difficulty = getDifficultyState();
        battle.enemies.length = 0;
        battle.fragments.length = 0;
        battle.specialItems.length = 0;
        battle.effects.length = 0;
        battle.hotZones.length = 0;
        battle.spawnTimer = randomRange(0.35, 0.9);
        battle.playerAttackCooldown = 0;
        battle.nekoAttackCooldown = 0;
        battle.comboDecayTimer = 1.2;
        battle.buffTimer = 0;
        battle.buffType = '';
        battle.buffEndedTimer = 0;
        battle.fragmentBuffProgress = 0;
        battle.nekoEvadeTimer = 0;
        battle.nekoEvadeTarget = null;
        battle.attackQueued = false;
        battle.resultLocked = false;
        battle.maxStability = difficulty.stability;
        state.stability = difficulty.stability;
        state.fragments = 0;
        state.specialItems = 0;
        state.worms = 0;
        state.combo = 0;
        state.attackFlashTimer = 0;
        state.attackFlashX = 0;
        state.attackFlashY = 0;
        state.attackFlashOriginX = 0;
        state.attackFlashOriginY = 0;
        state.attackFlashRange = 0;
        state.attackFlashWidth = 0;
        state.attackFlashHit = false;
        state.nekoIntent = state.nekoMode === 'follow' ? 'follow' : 'collect';
        state.nekoFollowSettled = true;
        state.nekoHint = '';
        state.nekoHintTimer = 0;
        state.buffLabel = '无';
        state.pointer = null;
        setSceneDefaults();
        syncHud();
        renderScene();
    }

    function queuePrimaryAttack(event) {
        if (state.phase !== 'playing') return;
        if (event && event.pointerId !== undefined && event.target && event.target.setPointerCapture) {
            try {
                event.target.setPointerCapture(event.pointerId);
            } catch (_) {}
        }
        updatePointerFromEvent(event, true);
        battle.attackQueued = true;
        renderScene();
    }

    function removeEnemyAt(index) {
        if (index < 0 || index >= battle.enemies.length) return null;
        return battle.enemies.splice(index, 1)[0];
    }

    function collectDrops(entity, cause) {
        var lootCount = entity.loot || 1;
        var baseAngle = Math.random() * Math.PI * 2;
        for (var i = 0; i < lootCount; i++) {
            var angle = baseAngle + (Math.PI * 2 * i / lootCount);
            var speed = randomRange(40, 96);
            spawnDropFragment(entity.x, entity.y, Math.cos(angle) * speed, Math.sin(angle) * speed);
        }
        if (Math.random() < (entity.specialChance || 0)) {
            spawnSpecialItem(entity.x, entity.y);
        }
        if (entity.type === 'logicBomb' && cause === 'player') {
            for (var j = 0; j < 3; j++) {
                addEffect(makeEffect(entity.x, entity.y, {
                    kind: 'shard',
                    radius: 8,
                    maxRadius: 20,
                    ttl: 0.25,
                    color: 'rgba(199, 91, 255, 0.85)',
                    driftX: Math.cos(baseAngle + j * 2.1) * randomRange(32, 60),
                    driftY: Math.sin(baseAngle + j * 2.1) * randomRange(32, 60)
                }));
            }
        }
    }

    function applyEnemyDeath(enemy, cause) {
        var idx = battle.enemies.indexOf(enemy);
        if (idx === -1) return;
        removeEnemyAt(idx);
        var fullClear = cause === 'full_clear';
        if (cause === 'contact') {
            battle.comboDecayTimer = 0.5;
            state.combo = Math.max(0, state.combo - 1);
        } else {
            battle.comboDecayTimer = 2.2;
            state.worms += 1;
            state.combo = Math.min(state.combo + 1, 99);
            addHotZone(enemy.x, enemy.y, cause === 'player' ? 1.6 : 0.9);
            collectDrops(enemy, cause);
            if (enemy.type === 'logicBomb' && cause !== 'contact' && !fullClear) {
                spawnLogicBombShards(enemy);
                addEffect(makeEffect(enemy.x, enemy.y, {
                    kind: 'split',
                    radius: enemy.radius * 0.9,
                    maxRadius: enemy.radius * 3,
                    ttl: 0.26,
                    color: 'rgba(197, 90, 255, 0.9)',
                    stroke: true
                }));
            }
        }
        addEffect(makeEffect(enemy.x, enemy.y, {
            kind: 'burst',
            radius: enemy.radius * 0.8,
            maxRadius: enemy.radius * 2.4,
            ttl: 0.32,
            color: cause === 'neko' || fullClear ? 'rgba(97, 202, 255, 0.9)' : 'rgba(255, 96, 128, 0.9)',
            stroke: true
        }));
        syncHud();
    }

    function getPlayerAttackStats() {
        var config = getDifficultyState();
        var range = 90;
        var width = 42;
        if (battle.buffType === 'range_up') {
            range += 22;
            width += 10;
        }
        var comboBoost = getComboBoostLevel();
        range += comboBoost * 6;
        width += comboBoost * 4;
        return {
            range: range,
            width: width,
            cooldown: config.playerAttackCooldown
        };
    }

    function getComboBoostLevel() {
        if (state.combo >= 20) return 3;
        if (state.combo >= 10) return 2;
        if (state.combo >= 5) return 1;
        return 0;
    }

    function attackEnemiesInFront(origin, direction, range, width) {
        var dir = normalizeVector(direction.x, direction.y);
        var cosLimit = Math.cos(Math.PI / 5.5);
        var best = null;
        var bestScore = Infinity;
        for (var i = 0; i < battle.enemies.length; i++) {
            var enemy = battle.enemies[i];
            if (enemy.hidden) continue;
            var dx = enemy.x - origin.x;
            var dy = enemy.y - origin.y;
            var d = Math.sqrt(dx * dx + dy * dy);
            if (d > range + enemy.radius) continue;
            var vec = normalizeVector(dx, dy);
            var facingDot = vec.x * dir.x + vec.y * dir.y;
            if (facingDot < cosLimit) continue;
            var lateral = Math.abs(-dir.y * dx + dir.x * dy);
            if (lateral > width) continue;
            var score = d + lateral * 0.45;
            if (score < bestScore) {
                best = enemy;
                bestScore = score;
            }
        }
        if (best) {
            applyEnemyDeath(best, 'player');
            return best;
        }
        return null;
    }

    function processPlayerAttack(dt) {
        var config = getDifficultyState();
        battle.playerAttackCooldown = Math.max(0, battle.playerAttackCooldown - dt);
        if (battle.attackQueued) {
            if (battle.playerAttackCooldown <= 0) {
                var attackStats = getPlayerAttackStats();
                var attackPoint = state.pointer && state.pointer.active ? state.pointer : scene.target;
                var direction = normalizeVector(attackPoint.x - scene.player.x, attackPoint.y - scene.player.y);
                scene.player.facingX = direction.x;
                scene.player.facingY = direction.y;
                var hit = attackEnemiesInFront(scene.player, direction, attackStats.range, attackStats.width);
                var centerX = scene.player.x + direction.x * (attackStats.range * 0.46);
                var centerY = scene.player.y + direction.y * (attackStats.range * 0.46);
                state.attackFlashTimer = 0.16;
                state.attackFlashX = centerX;
                state.attackFlashY = centerY;
                state.attackFlashOriginX = scene.player.x;
                state.attackFlashOriginY = scene.player.y;
                state.attackFlashAngle = Math.atan2(direction.y, direction.x);
                state.attackFlashRange = attackStats.range;
                state.attackFlashWidth = attackStats.width;
                state.attackFlashHit = !!hit;
                addEffect(makeEffect(centerX + direction.x * 10, centerY + direction.y * 10, {
                    kind: 'spark',
                    radius: 6,
                    maxRadius: 16,
                    ttl: 0.14,
                    color: 'rgba(255, 255, 255, 0.88)',
                    stroke: false
                }));
                battle.playerAttackCooldown = config.playerAttackCooldown;
                battle.attackQueued = false;
                if (!hit) {
                    battle.comboDecayTimer = 0.7;
                    state.combo = Math.max(0, state.combo - 1);
                    syncHud();
                }
            } else {
                battle.attackQueued = false;
            }
        }
    }

    function updatePlayer(dt) {
        var config = getDifficultyState();
        var target = state.pointer && state.pointer.active ? clampPoint(state.pointer) : scene.target;
        scene.target.x = target.x;
        scene.target.y = target.y;
        updatePlayerFacing(target);
        var comboBoost = getComboBoostLevel();
        var speed = config.playerSpeed + Math.min(state.combo * 1, 18) + comboBoost * 10;
        if (battle.buffType === 'speed_up') {
            speed *= 1.35;
        }
        moveTowardPoint(scene.player, target, speed * dt);
        scene.player.x = clamp(scene.player.x, 20, field.width - 20);
        scene.player.y = clamp(scene.player.y, 20, field.height - 20);
    }

    function findClosestEntity(list, origin, maxDistance) {
        var best = null;
        var limit = maxDistance ? maxDistance * maxDistance : Infinity;
        for (var i = 0; i < list.length; i++) {
            var entity = list[i];
            var d = distanceSquared(entity, origin);
            if (d <= limit) {
                best = entity;
                limit = d;
            }
        }
        return best;
    }

    function getNekoDanger() {
        var danger = { x: 0, y: 0, nearest: null, nearestDistance: Infinity, pressure: 0 };
        for (var i = 0; i < battle.enemies.length; i++) {
            var enemy = battle.enemies[i];
            if (enemy.hidden && distance(scene.neko, enemy) > 85) {
                continue;
            }
            var d = Math.max(distance(scene.neko, enemy), 1);
            if (d < danger.nearestDistance) {
                danger.nearestDistance = d;
                danger.nearest = enemy;
            }
            if (d < 190) {
                var away = normalizeVector(scene.neko.x - enemy.x, scene.neko.y - enemy.y);
                var weight = (190 - d) / 190;
                danger.x += away.x * weight;
                danger.y += away.y * weight;
                danger.pressure += weight;
            }
        }
        return danger;
    }

    function getCoreItemThreat(item) {
        var threat = { count: 0, nearestDistance: Infinity };
        for (var i = 0; i < battle.enemies.length; i++) {
            var d = distance(item, battle.enemies[i]);
            if (d < threat.nearestDistance) {
                threat.nearestDistance = d;
            }
            if (d < 150) {
                threat.count += 1;
            }
        }
        return threat;
    }

    function setNekoHint(text, ttl) {
        if (!text) return;
        if (state.nekoHint !== text || state.nekoHintTimer <= 0) {
            state.nekoHint = text;
            state.nekoHintTimer = ttl || 1.8;
        }
    }

    function setBuff(kind, ttl, label) {
        var buff = BUFFS[kind] || {};
        battle.buffTimer = ttl || buff.ttl || 0;
        battle.buffType = kind || '';
        battle.buffEndedTimer = 0;
        state.buffLabel = label || buff.label || '无';
        if (kind) {
            addEffect(makeEffect(scene.neko.x, scene.neko.y, {
                kind: 'buff',
                radius: 18,
                maxRadius: 52,
                ttl: 0.32,
                color: 'rgba(92, 194, 255, 0.9)',
                stroke: true
            }));
        }
    }

    function updateBuffState(dt) {
        if (battle.buffTimer <= 0) {
            if (battle.buffType) {
                battle.buffType = '';
                state.buffLabel = '无';
                battle.buffEndedTimer = 0.75;
                setNekoHint('增益结束', 0.85);
                syncHud();
            } else if (battle.buffEndedTimer > 0) {
                battle.buffEndedTimer = Math.max(0, battle.buffEndedTimer - dt);
                if (battle.buffEndedTimer <= 0) {
                    syncHud();
                }
            }
            return;
        }
        battle.buffTimer = Math.max(0, battle.buffTimer - dt);
        if (battle.buffTimer <= 0) {
            battle.buffType = '';
            state.buffLabel = '无';
            battle.buffEndedTimer = 0.75;
            setNekoHint('增益结束', 0.85);
            syncHud();
        }
    }

    function chooseFragmentBuff() {
        var roll = Math.random();
        if (roll < 0.38) return 'speed_up';
        if (roll < 0.72) return 'range_up';
        return 'magnet_up';
    }

    function grantFragmentBuff() {
        var kind = chooseFragmentBuff();
        var buff = BUFFS[kind];
        battle.fragmentBuffProgress = 0;
        setBuff(kind, buff.ttl, buff.label);
        setNekoHint(buff.label + ' 10 秒', 1.35);
    }

    function triggerSpecialFullScreenAttack(origin) {
        var source = origin || scene.neko;
        addEffect(makeEffect(source.x, source.y, {
            kind: 'full-shockwave',
            radius: 22,
            maxRadius: Math.sqrt(field.width * field.width + field.height * field.height) * 1.08,
            ttl: 0.62,
            color: 'rgba(255, 221, 108, 0.92)',
            stroke: true,
            lineWidth: 4
        }));
        addEffect(makeEffect(source.x, source.y, {
            kind: 'full-shockwave-core',
            radius: 18,
            maxRadius: 92,
            ttl: 0.28,
            color: 'rgba(255, 255, 255, 0.92)',
            stroke: true,
            lineWidth: 3
        }));
        var targets = battle.enemies.slice();
        for (var i = 0; i < targets.length; i++) {
            applyEnemyDeath(targets[i], 'full_clear');
        }
        battle.nekoAttackCooldown = Math.min(battle.nekoAttackCooldown, 0.25);
    }

    function updateAttackFlash(dt) {
        if (state.attackFlashTimer > 0) {
            state.attackFlashTimer = Math.max(0, state.attackFlashTimer - dt);
        }
    }

    function getNekoFollowAnchor() {
        var facing = scene.player.facingX < 0 ? -1 : 1;
        return {
            x: clamp(scene.player.x - facing * 34, 24, field.width - 24),
            y: clamp(scene.player.y + 18, 24, field.height - 24)
        };
    }

    function clampTargetNearPlayer(target, maxDistance) {
        if (!target) return getNekoFollowAnchor();
        var dx = target.x - scene.player.x;
        var dy = target.y - scene.player.y;
        var d = Math.sqrt(dx * dx + dy * dy);
        if (!d || d <= maxDistance) {
            return {
                x: clamp(target.x, 24, field.width - 24),
                y: clamp(target.y, 24, field.height - 24)
            };
        }
        var ratio = maxDistance / d;
        return {
            x: clamp(scene.player.x + dx * ratio, 24, field.width - 24),
            y: clamp(scene.player.y + dy * ratio, 24, field.height - 24)
        };
    }

    function applyNekoFollowLeash(dt) {
        if (state.nekoMode !== 'follow') return;
        var dx = scene.neko.x - scene.player.x;
        var dy = scene.neko.y - scene.player.y;
        var d = Math.sqrt(dx * dx + dy * dy);
        if (d <= NEKO_FOLLOW_MAX_DISTANCE) {
            state.nekoFollowSettled = true;
            return;
        }
        if (!state.nekoFollowSettled) {
            return;
        }
        var pull = Math.min(d - NEKO_FOLLOW_MAX_DISTANCE, (180 + getDifficultyState().nekoSpeed) * dt);
        var towardPlayer = normalizeVector(scene.player.x - scene.neko.x, scene.player.y - scene.neko.y);
        scene.neko.x = clamp(scene.neko.x + towardPlayer.x * pull, 20, field.width - 20);
        scene.neko.y = clamp(scene.neko.y + towardPlayer.y * pull, 20, field.height - 20);
    }

    function getNekoAttackRadius() {
        return 126 + Math.min(24, state.combo * 0.9) + getComboBoostLevel() * 10;
    }

    function canNekoTargetEnemy(enemy, enemyDistance) {
        if (!enemy) return false;
        if (enemy.hidden && enemyDistance > 64 * 64) {
            return false;
        }
        return true;
    }

    function findNekoAssistTarget(danger) {
        var attackRadius = getNekoAttackRadius();
        var best = null;
        var bestDistance = attackRadius * attackRadius;
        if (danger && danger.nearest && danger.nearestDistance <= Math.max(NEKO_EVADE_EXIT_DISTANCE, attackRadius)) {
            var nearestDistance = distanceSquared(danger.nearest, scene.neko);
            if (canNekoTargetEnemy(danger.nearest, nearestDistance)) {
                return {
                    enemy: danger.nearest,
                    radius: attackRadius
                };
            }
        }
        for (var e = 0; e < battle.enemies.length; e++) {
            var enemy = battle.enemies[e];
            var enemyDistance = distanceSquared(enemy, scene.neko);
            if (!canNekoTargetEnemy(enemy, enemyDistance)) {
                continue;
            }
            if (enemyDistance <= bestDistance) {
                bestDistance = enemyDistance;
                best = enemy;
            }
        }
        return {
            enemy: best,
            radius: attackRadius
        };
    }

    function processNekoAssistAttack(danger, dt) {
        var config = getDifficultyState();
        battle.nekoAttackCooldown = Math.max(0, battle.nekoAttackCooldown - dt);
        if (battle.nekoAttackCooldown > 0 || !battle.enemies.length) {
            return false;
        }
        var target = findNekoAssistTarget(danger);
        var targetEnemy = target.enemy;
        if (!targetEnemy) {
            return false;
        }
        addEffect(makeEffect(scene.neko.x, scene.neko.y, {
            kind: 'neko-shot',
            x2: targetEnemy.x,
            y2: targetEnemy.y,
            radius: 2,
            maxRadius: 2,
            ttl: 0.42,
            color: 'rgba(115, 235, 255, 0.96)',
            lineWidth: 4
        }));
        addEffect(makeEffect(scene.neko.x, scene.neko.y, {
            kind: 'assist-ring',
            radius: 12,
            maxRadius: target.radius,
            ttl: 0.32,
            color: 'rgba(115, 235, 255, 0.58)',
            stroke: true
        }));
        addEffect(makeEffect(targetEnemy.x, targetEnemy.y, {
            kind: 'shockwave',
            radius: 12,
            maxRadius: 26,
            ttl: 0.22,
            color: 'rgba(115, 235, 255, 0.92)',
            stroke: true
        }));
        applyEnemyDeath(targetEnemy, 'neko');
        battle.nekoAttackCooldown = config.nekoAttackCooldown;
        return true;
    }

    function getLockedNekoEvadeTarget(danger, dt) {
        if (battle.nekoEvadeTimer > 0) {
            battle.nekoEvadeTimer = Math.max(0, battle.nekoEvadeTimer - dt);
        }
        if (
            battle.nekoEvadeTarget &&
            battle.nekoEvadeTimer > 0 &&
            danger.nearestDistance < NEKO_EVADE_EXIT_DISTANCE
        ) {
            return clampTargetNearPlayer(
                battle.nekoEvadeTarget,
                state.nekoMode === 'follow' ? NEKO_FOLLOW_MAX_DISTANCE : Infinity
            );
        }
        if (!danger.nearest || (danger.nearestDistance > NEKO_EVADE_ENTER_DISTANCE && danger.pressure < NEKO_EVADE_PRESSURE_ENTER)) {
            battle.nekoEvadeTarget = null;
            battle.nekoEvadeTimer = 0;
            return null;
        }
        var away = normalizeVector(danger.x, danger.y);
        if (Math.abs(away.x) + Math.abs(away.y) < 0.05) {
            away = normalizeVector(scene.neko.x - danger.nearest.x, scene.neko.y - danger.nearest.y);
        }
        if (Math.abs(away.x) + Math.abs(away.y) < 0.05) {
            away = normalizeVector(scene.neko.x - scene.player.x, scene.neko.y - scene.player.y);
        }
        if (Math.abs(away.x) + Math.abs(away.y) < 0.05) {
            away = { x: 1, y: 0 };
        }
        battle.nekoEvadeTarget = {
            x: clamp(scene.neko.x + away.x * 150, 24, field.width - 24),
            y: clamp(scene.neko.y + away.y * 150, 24, field.height - 24)
        };
        battle.nekoEvadeTimer = NEKO_EVADE_LOCK_SECONDS;
        return clampTargetNearPlayer(
            battle.nekoEvadeTarget,
            state.nekoMode === 'follow' ? NEKO_FOLLOW_MAX_DISTANCE : Infinity
        );
    }

    function chooseNekoTarget(danger, dt) {
        var evadeTarget = getLockedNekoEvadeTarget(danger, dt);
        if (evadeTarget) {
            state.nekoIntent = 'evade';
            return evadeTarget;
        }

        var nearestSpecial = findClosestEntity(battle.specialItems, scene.neko, Infinity);
        if (nearestSpecial) {
            var threat = getCoreItemThreat(nearestSpecial);
            if (threat.count > 0 || threat.nearestDistance < 145) {
                state.nekoIntent = 'request';
                setNekoHint('帮我开路');
                if (state.nekoMode === 'follow' && distance(scene.neko, scene.player) > 170) {
                    return getNekoFollowAnchor();
                }
            } else {
                state.nekoIntent = 'core';
                setNekoHint('我要拿那个大的', 1.55);
            }
            return state.nekoMode === 'follow'
                ? clampTargetNearPlayer(nearestSpecial, NEKO_FOLLOW_MAX_DISTANCE)
                : nearestSpecial;
        }

        var nearestFragment = null;
        if (battle.fragments.length) {
            var freeCollectRadius = state.nekoMode === 'free' ? Infinity : NEKO_FOLLOW_COLLECT_RADIUS;
            nearestFragment = findClosestEntity(battle.fragments, scene.neko, freeCollectRadius);
        }
        if (nearestFragment) {
            state.nekoIntent = 'collect';
            return state.nekoMode === 'follow'
                ? clampTargetNearPlayer(nearestFragment, NEKO_FOLLOW_SOFT_DISTANCE)
                : nearestFragment;
        }

        var hotZone = getHotZoneCenter();
        if (state.nekoMode === 'free' && hotZone) {
            state.nekoIntent = 'anticipate';
            return hotZone;
        }

        state.nekoIntent = 'follow';
        if (state.nekoMode === 'follow') {
            return getNekoFollowAnchor();
        }
        return {
            x: scene.player.x + 78,
            y: scene.player.y + 18
        };
    }

    function updateNeko(dt) {
        var config = getDifficultyState();
        var danger = getNekoDanger();
        if (processNekoAssistAttack(danger, dt)) {
            danger = getNekoDanger();
        }
        var target = chooseNekoTarget(danger, dt);
        var speed = config.nekoSpeed + Math.min(18, state.combo * 1);
        if (state.nekoIntent === 'evade') {
            speed += 28;
        } else if (state.nekoIntent === 'core') {
            speed += 14;
        } else if (state.nekoIntent === 'anticipate') {
            speed += 6;
        }
        speed += getComboBoostLevel() * 5;
        var previousNekoX = scene.neko.x;
        var previousNekoY = scene.neko.y;
        moveTowardPoint(scene.neko, target, speed * dt);
        scene.neko.x = clamp(scene.neko.x, 20, field.width - 20);
        scene.neko.y = clamp(scene.neko.y, 20, field.height - 20);
        applyNekoFollowLeash(dt);
        updateEntityFacing(scene.neko, scene.neko.x - previousNekoX, scene.neko.y - previousNekoY);
        state.nekoHintTimer = Math.max(0, state.nekoHintTimer - dt);
        var nearestItem = null;
        var nearestItemDistance = Infinity;
        var magnetRadius = 26 + Math.min(18, state.combo * 0.8) + getComboBoostLevel() * 5;
        if (battle.buffType === 'magnet_up') {
            magnetRadius += 18;
        }
        for (var i = 0; i < battle.fragments.length; i++) {
            var fragment = battle.fragments[i];
            var fragmentD = distanceSquared(fragment, scene.neko);
            if (fragmentD <= magnetRadius * magnetRadius) {
                var pull = normalizeVector(scene.neko.x - fragment.x, scene.neko.y - fragment.y);
                fragment.vx += pull.x * 160 * dt;
                fragment.vy += pull.y * 160 * dt;
            }
            if (fragmentD < nearestItemDistance) {
                nearestItemDistance = fragmentD;
                nearestItem = fragment;
            }
        }
        if (nearestItem && nearestItemDistance < 30 * 30) {
            var fragmentIndex = battle.fragments.indexOf(nearestItem);
            if (fragmentIndex !== -1) {
                battle.fragments.splice(fragmentIndex, 1);
                state.fragments = Math.min(state.fragments + 1, 999);
                state.combo = Math.min(state.combo + 1, 99);
                if (battle.buffType) {
                    state.stability = Math.min(battle.maxStability, state.stability + 1);
                    setNekoHint('稳定 +1', 0.95);
                } else {
                    battle.fragmentBuffProgress = Math.min(FRAGMENTS_PER_BUFF, battle.fragmentBuffProgress + 1);
                    if (battle.fragmentBuffProgress >= FRAGMENTS_PER_BUFF) {
                        grantFragmentBuff();
                    } else {
                        setNekoHint('碎片 ' + battle.fragmentBuffProgress + '/' + FRAGMENTS_PER_BUFF, 1.0);
                    }
                }
                addEffect(makeEffect(nearestItem.x, nearestItem.y, {
                    kind: 'pickup',
                    radius: 10,
                    maxRadius: 24,
                    ttl: 0.26,
                    color: battle.buffType ? 'rgba(105, 245, 185, 0.94)' : 'rgba(70, 180, 255, 0.94)',
                    stroke: true
                }));
                syncHud();
            }
        }
        for (var s = 0; s < battle.specialItems.length; s++) {
            var specialItem = battle.specialItems[s];
            var specialDistance = distanceSquared(specialItem, scene.neko);
            var specialPull = normalizeVector(scene.neko.x - specialItem.x, scene.neko.y - specialItem.y);
            if (specialDistance < 120 * 120) {
                specialItem.vx += specialPull.x * 90 * dt;
                specialItem.vy += specialPull.y * 90 * dt;
            }
            if (specialDistance < 28 * 28) {
                battle.specialItems.splice(s, 1);
                s -= 1;
                state.specialItems += 1;
                state.combo = Math.min(state.combo + 2, 99);
                triggerSpecialFullScreenAttack(specialItem);
                setNekoHint('全域清理', 1.6);
                addEffect(makeEffect(specialItem.x, specialItem.y, {
                    kind: 'burst',
                    radius: 12,
                    maxRadius: 82,
                    ttl: 0.38,
                    color: 'rgba(255, 208, 95, 0.98)',
                    stroke: true
                }));
                addEffect(makeEffect(specialItem.x, specialItem.y, {
                    kind: 'special',
                    radius: 10,
                    maxRadius: 26,
                    ttl: 0.18,
                    color: 'rgba(255, 244, 170, 0.72)',
                    stroke: true
                }));
                syncHud();
            }
        }
    }

    function updateEnemies(dt) {
        var config = getDifficultyState();
        battle.spawnTimer -= dt;
        while (battle.spawnTimer <= 0 && battle.enemies.length < config.maxEnemies) {
            spawnEnemy(pickEnemyType());
            battle.spawnTimer += randomRange(config.spawnInterval * 0.75, config.spawnInterval * 1.25);
        }
        if (battle.spawnTimer <= 0) {
            battle.spawnTimer = 0.25;
        }
        var contactRadius = 30;
        for (var i = battle.enemies.length - 1; i >= 0; i--) {
            var enemy = battle.enemies[i];
            enemy.phaseTimer -= dt;
            if (enemy.type === 'noiseSquid' && enemy.phaseTimer <= 0) {
                enemy.hidden = !enemy.hidden;
                enemy.phaseTimer = enemy.hidden ? randomRange(0.42, 0.78) : randomRange(0.95, 1.5);
            }
            var target = scene.neko;
            var deltaX = target.x - enemy.x;
            var deltaY = target.y - enemy.y;
            var motion = normalizeVector(deltaX, deltaY);
            var wiggle = Math.sin((enemy.drift + enemy.x + enemy.y) * 0.015) * 0.18;
            var speed = config.enemySpeed * enemy.speedFactor;
            enemy.vx = motion.x * speed + Math.cos(enemy.drift + battle.spawnTimer) * 22 * wiggle;
            enemy.vy = motion.y * speed + Math.sin(enemy.drift - battle.spawnTimer) * 22 * wiggle;
            updateEntityFacing(enemy, enemy.vx, enemy.vy);
            enemy.x += enemy.vx * dt;
            enemy.y += enemy.vy * dt;
            if (enemy.x < -80 || enemy.y < -80 || enemy.x > field.width + 80 || enemy.y > field.height + 80) {
                battle.enemies.splice(i, 1);
                continue;
            }
            var contactDistance = distanceSquared(enemy, scene.neko);
            if (contactDistance <= (enemy.radius + contactRadius) * (enemy.radius + contactRadius)) {
                state.stability -= enemy.damage || config.contactDamage;
                addEffect(makeEffect(scene.neko.x, scene.neko.y, {
                    kind: 'impact',
                    radius: 14,
                    maxRadius: 44,
                    ttl: 0.22,
                    color: 'rgba(255, 97, 126, 0.92)',
                    stroke: true
                }));
                applyEnemyDeath(enemy, 'contact');
                syncHud();
                if (state.stability <= 0) {
                    state.stability = 0;
                    syncHud();
                    if (!battle.resultLocked) {
                        battle.resultLocked = true;
                        showResult('failed');
                    }
                    return;
                }
            }
        }
    }

    function updateDrops(dt) {
        for (var i = battle.fragments.length - 1; i >= 0; i--) {
            var fragment = battle.fragments[i];
            fragment.ttl -= dt;
            fragment.vx *= Math.max(0.82, 1 - dt * 0.22);
            fragment.vy *= Math.max(0.82, 1 - dt * 0.22);
            fragment.x += fragment.vx * dt;
            fragment.y += fragment.vy * dt;
            if (fragment.ttl <= 0) {
                battle.fragments.splice(i, 1);
                continue;
            }
        }
        for (var j = battle.specialItems.length - 1; j >= 0; j--) {
            var specialItem = battle.specialItems[j];
            specialItem.ttl -= dt;
            specialItem.vx *= Math.max(0.88, 1 - dt * 0.15);
            specialItem.vy *= Math.max(0.88, 1 - dt * 0.15);
            specialItem.x += specialItem.vx * dt;
            specialItem.y += specialItem.vy * dt;
            if (specialItem.ttl <= 0) {
                battle.specialItems.splice(j, 1);
            }
        }
    }

    function updateEffects(dt) {
        for (var i = battle.effects.length - 1; i >= 0; i--) {
            var effect = battle.effects[i];
            effect.ttl -= dt;
            effect.radius += (effect.maxRadius - effect.radius) * Math.min(1, dt * 6);
            effect.x += effect.driftX * dt;
            effect.y += effect.driftY * dt;
            if (effect.ttl <= 0) {
                battle.effects.splice(i, 1);
            }
        }
    }

    function updateComboDecay(dt) {
        battle.comboDecayTimer -= dt;
        if (battle.comboDecayTimer <= 0) {
            if (state.combo > 0) {
                state.combo = Math.max(0, state.combo - 1);
                battle.comboDecayTimer = state.combo > 0 ? 1.5 : 0;
                syncHud();
            } else {
                battle.comboDecayTimer = 0;
            }
        }
    }

    function maybeFinishBattle() {
        if (battle.resultLocked) return;
        if (state.specialItems >= 5) {
            battle.resultLocked = true;
            showResult('success');
        }
    }

    function updateBattle(dt) {
        if (state.phase !== 'playing' || document.hidden || state.loadError) return;
        updatePlayer(dt);
        updateEnemies(dt);
        if (state.phase !== 'playing') return;
        processPlayerAttack(dt);
        updateNeko(dt);
        updateDrops(dt);
        updateEffects(dt);
        updateHotZones(dt);
        updateBuffState(dt);
        updateAttackFlash(dt);
        updateComboDecay(dt);
        maybeFinishBattle();
        syncHud();
    }

    function getBattleSnapshot() {
        return {
            difficulty: state.difficulty,
            phase: state.phase,
            stability: state.stability,
            specialItems: state.specialItems,
            wormsCleared: state.worms,
            fragmentsCollected: state.fragments,
            combo: state.combo,
            activeBuff: battle.buffType,
            buffSecondsRemaining: battle.buffTimer,
            fragmentBuffProgress: battle.fragmentBuffProgress,
            nekoMode: state.nekoMode,
            nekoIntent: state.nekoIntent,
            enemies: battle.enemies.length,
            fragments: battle.fragments.length,
            droppedSpecialItems: battle.specialItems.length
        };
    }

    function buildRoutePayload(reason) {
        return {
            lanlan_name: query.lanlanName || '',
            session_id: ensureSessionId(),
            pageVisible: !document.hidden,
            visibilityState: document.visibilityState || (document.hidden ? 'hidden' : 'visible'),
            currentState: getBattleSnapshot(),
            reason: reason || '',
            postgameProactive: false,
            gameMemoryEnabled: false
        };
    }

    function postRouteEvent(kind, reason, keepalive) {
        return fetch(ROUTE_BASE_URL + '/' + kind, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'same-origin',
            keepalive: !!keepalive,
            body: JSON.stringify(buildRoutePayload(reason))
        }).catch(function (error) {
            console.warn('[SubconsciousMaintenance] route ' + kind + ' failed:', error);
            return null;
        });
    }

    function stopRouteHeartbeat() {
        if (heartbeatTimer) {
            window.clearInterval(heartbeatTimer);
            heartbeatTimer = 0;
        }
    }

    function startRouteHeartbeat() {
        if (heartbeatTimer) return;
        heartbeatTimer = window.setInterval(function () {
            if (!routeState.started || routeState.ended) return;
            postRouteEvent('heartbeat', '', true);
        }, ROUTE_HEARTBEAT_INTERVAL_MS);
    }

    function startRouteSession() {
        if (routeState.started || routeState.startInFlight || routeState.ended || !state.spriteReady || state.loadError) {
            return;
        }
        routeState.startInFlight = true;
        var generation = routeState.generation;
        ensureSessionId();
        routeState.startPromise = postRouteEvent('start', 'ready', false).then(function () {
            if (generation !== routeState.generation || routeState.ended) {
                return;
            }
            routeState.started = true;
        }).finally(function () {
            if (generation === routeState.generation) {
                routeState.startInFlight = false;
                routeState.startPromise = null;
                if (routeState.pendingEndReason) {
                    var pendingReason = routeState.pendingEndReason;
                    var pendingUseBeacon = routeState.pendingEndUseBeacon;
                    routeState.pendingEndReason = '';
                    routeState.pendingEndUseBeacon = false;
                    endRouteSession(pendingReason, pendingUseBeacon);
                } else if (routeState.started && !routeState.ended) {
                    startRouteHeartbeat();
                }
            }
        });
    }

    function endRouteSession(reason, useBeacon) {
        if (routeState.startInFlight && routeState.startPromise) {
            routeState.pendingEndReason = reason || 'exit';
            routeState.pendingEndUseBeacon = !!useBeacon;
            if (useBeacon) {
                return Promise.resolve();
            }
            return routeState.startPromise.finally(function () {
                return endRouteSession(reason, useBeacon);
            });
        }
        if (!routeState.started || routeState.ended) {
            stopRouteHeartbeat();
            return Promise.resolve();
        }
        routeState.ended = true;
        stopRouteHeartbeat();
        var payload = JSON.stringify(buildRoutePayload(reason || 'exit'));
        var url = ROUTE_BASE_URL + '/end';
        if (useBeacon && navigator.sendBeacon) {
            try {
                var ok = navigator.sendBeacon(url, new Blob([payload], { type: 'application/json' }));
                if (ok) return Promise.resolve();
            } catch (error) {
                console.warn('[SubconsciousMaintenance] route end beacon failed:', error);
            }
        }
        return fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'same-origin',
            keepalive: !!useBeacon,
            body: payload
        }).catch(function (error) {
            console.warn('[SubconsciousMaintenance] route end failed:', error);
            return null;
        });
    }

    function resetRouteSessionForRestart() {
        routeState.started = false;
        routeState.ended = false;
        routeState.startInFlight = false;
        routeState.startPromise = null;
        routeState.pendingEndReason = '';
        routeState.pendingEndUseBeacon = false;
        routeState.generation += 1;
        stopRouteHeartbeat();
        ensureSessionId();
    }

    function getCanvasPointFromEvent(event) {
        if (!canvas || !event) {
            return { x: 0, y: 0 };
        }
        var rect = canvas.getBoundingClientRect();
        var clientX = 0;
        var clientY = 0;
        if (event.touches && event.touches.length) {
            clientX = event.touches[0].clientX;
            clientY = event.touches[0].clientY;
        } else if (event.changedTouches && event.changedTouches.length) {
            clientX = event.changedTouches[0].clientX;
            clientY = event.changedTouches[0].clientY;
        } else {
            clientX = event.clientX;
            clientY = event.clientY;
        }
        var width = rect.width || 1;
        var height = rect.height || 1;
        return {
            x: clamp((clientX - rect.left) * (field.width / width), 0, field.width),
            y: clamp((clientY - rect.top) * (field.height / height), 0, field.height)
        };
    }

    function updatePointerFromEvent(event, isDown) {
        var point = getCanvasPointFromEvent(event);
        scene.target.x = point.x;
        scene.target.y = point.y;
        state.pointer = {
            x: point.x,
            y: point.y,
            active: true,
            down: !!isDown,
            kind: event && event.pointerType ? event.pointerType : (event && event.touches ? 'touch' : 'mouse')
        };
        if (state.phase === 'playing') {
            renderScene();
        }
    }

    function setSceneDefaults() {
        scene.player.x = field.width * 0.28;
        scene.player.y = field.height * 0.58;
        scene.neko.x = field.width * 0.52;
        scene.neko.y = field.height * 0.58;
        if (!state.pointer) {
            scene.target.x = field.width * 0.52;
            scene.target.y = field.height * 0.58;
        } else {
            scene.target.x = clamp(scene.target.x, 0, field.width);
            scene.target.y = clamp(scene.target.y, 0, field.height);
        }
    }

    function rescaleScene(oldWidth, oldHeight) {
        if (!oldWidth || !oldHeight || oldWidth <= 1 || oldHeight <= 1) {
            setSceneDefaults();
            return;
        }
        var scaleX = field.width / oldWidth;
        var scaleY = field.height / oldHeight;
        scene.player.x = clamp(scene.player.x * scaleX, 0, field.width);
        scene.player.y = clamp(scene.player.y * scaleY, 0, field.height);
        scene.neko.x = clamp(scene.neko.x * scaleX, 0, field.width);
        scene.neko.y = clamp(scene.neko.y * scaleY, 0, field.height);
        scene.target.x = clamp(scene.target.x * scaleX, 0, field.width);
        scene.target.y = clamp(scene.target.y * scaleY, 0, field.height);
    }

    function syncDifficultyButtons() {
        for (var i = 0; i < difficultyButtons.length; i++) {
            var button = difficultyButtons[i];
            var active = button.getAttribute('data-difficulty') === state.difficulty;
            button.classList.toggle('is-active', active);
            button.setAttribute('aria-checked', active ? 'true' : 'false');
        }
    }

    function getBuffDisplayText() {
        if (battle.buffType && battle.buffTimer > 0) {
            return state.buffLabel + ' ' + battle.buffTimer.toFixed(1) + 's';
        }
        if (battle.buffEndedTimer > 0) {
            return '结束 · 碎片 ' + battle.fragmentBuffProgress + '/' + FRAGMENTS_PER_BUFF;
        }
        return '碎片 ' + battle.fragmentBuffProgress + '/' + FRAGMENTS_PER_BUFF;
    }

    function syncHud() {
        setText(stabilityValue, state.stability);
        setText(fragmentsValue, state.specialItems + '/5');
        setText(wormsValue, state.worms);
        setText(comboValue, state.combo);
        setText(buffValue, getBuffDisplayText());
        setText(nekoModeValue, state.nekoMode === 'follow' ? '跟随玩家' : '自由行动');
        if (nekoModeBtn) {
            nekoModeBtn.setAttribute('aria-pressed', state.nekoMode === 'follow' ? 'true' : 'false');
        }
        if (sessionLabel) {
            var parts = [];
            if (query.lanlanName) parts.push(query.lanlanName);
            if (query.sessionId) parts.push(query.sessionId);
            setText(sessionLabel, parts.length ? parts.join(' · ') : '待命');
        }
    }

    function syncPhase() {
        body.setAttribute('data-phase', state.phase);
        setLayerVisible(loadingLayer, state.phase === 'loading');
        setLayerVisible(setupLayer, state.phase === 'ready');
        setLayerVisible(pauseLayer, state.phase === 'paused');
        setLayerVisible(endLayer, state.phase === 'success' || state.phase === 'failed');
        setButtonDisabled(startBtn, state.phase !== 'ready' || !state.spriteReady);
        syncHud();
    }

    function toggleNekoMode() {
        state.nekoMode = state.nekoMode === 'follow' ? 'free' : 'follow';
        state.nekoIntent = state.nekoMode === 'follow' ? 'follow' : 'collect';
        if (state.nekoMode === 'follow') {
            state.nekoFollowSettled = distance(scene.neko, scene.player) <= NEKO_FOLLOW_MAX_DISTANCE;
        } else {
            state.nekoFollowSettled = true;
        }
        state.nekoHint = state.nekoMode === 'follow' ? '我跟紧你' : '我去捡东西';
        state.nekoHintTimer = 1.25;
        syncHud();
        renderScene();
    }

    function resetFrameClock() {
        lastFrameTime = 0;
    }

    function stopFrameLoop() {
        if (frameRaf) {
            window.cancelAnimationFrame(frameRaf);
            frameRaf = 0;
        }
        resetFrameClock();
    }

    function shouldRunFrameLoop() {
        return state.phase === 'playing' && !document.hidden;
    }

    function setPhase(nextPhase) {
        if (state.phase === 'exiting') return;
        if (nextPhase === 'ready' && !state.spriteReady) {
            nextPhase = 'loading';
        }
        if (state.phase === nextPhase) {
            syncPhase();
            return;
        }
        var leavingPlaying = state.phase === 'playing' && nextPhase !== 'playing';
        state.phase = nextPhase;
        if (leavingPlaying) {
            battle.attackQueued = false;
            if (state.pointer) {
                state.pointer.down = false;
            }
        }
        syncPhase();
        if (state.phase === 'ready') {
            startRouteSession();
        }
        if (shouldRunFrameLoop()) {
            startFrameLoop();
        } else {
            stopFrameLoop();
            renderScene();
        }
    }

    function setDifficulty(nextDifficulty) {
        if (!/^(easy|normal|hard)$/.test(nextDifficulty)) {
            nextDifficulty = 'easy';
        }
        state.difficulty = nextDifficulty;
        if (state.phase === 'ready') {
            state.stability = getDifficultyState().stability;
        }
        syncDifficultyButtons();
        syncHud();
    }

    function resizeCanvas() {
        if (!canvas || !context) return;
        var oldWidth = field.width;
        var oldHeight = field.height;
        var dpr = Math.max(window.devicePixelRatio || 1, 1);
        var rect = canvas.getBoundingClientRect();
        var width = Math.max(Math.round(rect.width), 1);
        var height = Math.max(Math.round(rect.height), 1);
        var targetWidth = Math.max(Math.round(width * dpr), 1);
        var targetHeight = Math.max(Math.round(height * dpr), 1);
        if (canvas.width !== targetWidth) {
            canvas.width = targetWidth;
        }
        if (canvas.height !== targetHeight) {
            canvas.height = targetHeight;
        }
        field.width = width;
        field.height = height;
        field.dpr = dpr;
        context.setTransform(dpr, 0, 0, dpr, 0, 0);
        rescaleScene(oldWidth, oldHeight);
        renderScene();
    }

    function scheduleResize() {
        if (resizeRaf) return;
        resizeRaf = window.requestAnimationFrame(function () {
            resizeRaf = 0;
            resizeCanvas();
            resetFrameClock();
        });
    }

    function spriteRect(spriteKey) {
        var sprite = SPRITES[spriteKey];
        if (!sprite) return null;
        return {
            x: sprite.col * spriteCell.width,
            y: sprite.row * spriteCell.height,
            width: spriteCell.width,
            height: spriteCell.height
        };
    }

    function drawSpriteFacing(spriteKey, x, y, size, facingX) {
        if (!context || !spriteSheet || !state.spriteReady) return;
        var rect = spriteRect(spriteKey);
        if (!rect) return;
        var flipX = facingX < 0;
        context.save();
        context.translate(x, y);
        if (flipX) {
            context.scale(-1, 1);
        }
        context.drawImage(
            spriteSheet,
            rect.x,
            rect.y,
            rect.width,
            rect.height,
            -size / 2,
            -size / 2,
            size,
            size
        );
        context.restore();
    }

    function drawSprite(spriteKey, x, y, size) {
        drawSpriteFacing(spriteKey, x, y, size, 1);
    }

    function vfxRect(kind) {
        var col = kind === 'neko-shot' ? 1 : 0;
        return {
            x: col * vfxCell.width,
            y: 0,
            width: vfxCell.width,
            height: vfxCell.height
        };
    }

    function drawVfxSprite(kind, x, y, width, height, angle, alpha) {
        if (!context || !vfxSheet || !state.spriteReady) return;
        var rect = vfxRect(kind);
        if (!rect || !rect.width || !rect.height) return;
        context.save();
        context.translate(x, y);
        context.rotate(angle || 0);
        context.globalAlpha = alpha;
        context.drawImage(
            vfxSheet,
            rect.x,
            rect.y,
            rect.width,
            rect.height,
            -width / 2,
            -height / 2,
            width,
            height
        );
        context.restore();
    }

    function drawSlashEffectImage(x, y, angle, alpha, hit) {
        var range = state.attackFlashRange || 90;
        var width = state.attackFlashWidth || 42;
        drawVfxSprite('slash', x, y, range * 1.08, width * 2.15, angle + Math.PI, hit ? alpha : alpha * 0.72);
    }

    function drawNekoAssistEffectImage(effect, alpha) {
        var dx = effect.x2 - effect.x;
        var dy = effect.y2 - effect.y;
        var length = Math.sqrt(dx * dx + dy * dy) || 1;
        var angle = Math.atan2(dy, dx);
        drawVfxSprite('neko-shot', effect.x + dx * 0.5, effect.y + dy * 0.5, Math.max(54, length), 52, angle, alpha);
    }

    function renderScene() {
        if (!context) return;
        context.clearRect(0, 0, field.width, field.height);
        if (!state.spriteReady) return;
        context.save();
        context.fillStyle = 'rgba(255, 255, 255, 0.01)';
        context.fillRect(0, 0, field.width, field.height);
        context.restore();

        var magnetRadius = 26 + Math.min(18, state.combo * 0.8) + getComboBoostLevel() * 5;
        if (battle.buffType === 'magnet_up') {
            magnetRadius += 18;
        }
        context.save();
        context.strokeStyle = 'rgba(97, 202, 255, 0.2)';
        context.lineWidth = 1.5;
        context.beginPath();
        context.arc(scene.neko.x, scene.neko.y, magnetRadius, 0, Math.PI * 2);
        context.stroke();
        context.restore();

        for (var i = 0; i < battle.effects.length; i++) {
            var effect = battle.effects[i];
            var alpha = clamp(effect.ttl / effect.total, 0, 1);
            context.save();
            context.globalAlpha = alpha;
            if (effect.kind === 'neko-shot') {
                drawNekoAssistEffectImage(effect, alpha);
            } else if (effect.stroke) {
                context.strokeStyle = effect.color;
                context.lineWidth = effect.lineWidth || 2;
                context.beginPath();
                context.arc(effect.x, effect.y, effect.radius, 0, Math.PI * 2);
                context.stroke();
            } else {
                context.fillStyle = effect.color;
                context.beginPath();
                context.arc(effect.x, effect.y, effect.radius, 0, Math.PI * 2);
                context.fill();
            }
            context.restore();
        }

        for (var f = 0; f < battle.fragments.length; f++) {
            var fragment = battle.fragments[f];
            drawSprite('fragment', fragment.x, fragment.y, 22);
        }
        for (var s = 0; s < battle.specialItems.length; s++) {
            var specialItem = battle.specialItems[s];
            drawSprite('specialItem', specialItem.x, specialItem.y, 26);
        }

        drawSpriteFacing('player', scene.player.x, scene.player.y, 74, scene.player.facingX || 1);
        var comboBoostLevel = getComboBoostLevel();
        if (comboBoostLevel > 0) {
            context.save();
            context.strokeStyle = comboBoostLevel >= 3 ? 'rgba(255, 221, 108, 0.72)' : 'rgba(92, 194, 255, 0.55)';
            context.lineWidth = 1.5 + comboBoostLevel * 0.6;
            context.beginPath();
            context.arc(scene.player.x, scene.player.y, 38 + comboBoostLevel * 7, 0, Math.PI * 2);
            context.stroke();
            context.restore();
        }
        drawSpriteFacing('neko', scene.neko.x, scene.neko.y, 74, scene.neko.facingX || 1);
        if (state.nekoIntent === 'evade') {
            context.save();
            context.strokeStyle = 'rgba(255, 96, 128, 0.52)';
            context.lineWidth = 2;
            context.beginPath();
            context.arc(scene.neko.x, scene.neko.y, 48, 0, Math.PI * 2);
            context.stroke();
            context.restore();
        }
        if (state.nekoHint && state.nekoHintTimer > 0) {
            context.save();
            context.font = '12px "Segoe UI", "PingFang SC", sans-serif';
            var bubbleText = state.nekoHint;
            var bubbleWidth = Math.min(132, Math.max(76, context.measureText(bubbleText).width + 22));
            var bubbleX = clamp(scene.neko.x + 18, 8, field.width - bubbleWidth - 8);
            var bubbleY = clamp(scene.neko.y - 62, 8, field.height - 32);
            context.globalAlpha = clamp(state.nekoHintTimer / 0.35, 0, 1);
            context.fillStyle = 'rgba(248, 253, 255, 0.9)';
            context.strokeStyle = 'rgba(89, 187, 255, 0.42)';
            context.lineWidth = 1;
            context.fillRect(bubbleX, bubbleY, bubbleWidth, 28);
            context.strokeRect(bubbleX, bubbleY, bubbleWidth, 28);
            context.fillStyle = '#1979b7';
            context.fillText(bubbleText, bubbleX + 11, bubbleY + 18);
            context.restore();
        }
        if (state.buffLabel !== '无') {
            context.save();
            context.strokeStyle = 'rgba(92, 194, 255, 0.58)';
            context.lineWidth = 1.5;
            context.beginPath();
            context.arc(scene.neko.x, scene.neko.y, 36 + Math.min(10, state.combo), 0, Math.PI * 2);
            context.stroke();
            context.restore();
        }
        if (state.attackFlashTimer > 0) {
            var flashAlpha = clamp(state.attackFlashTimer / 0.16, 0, 1);
            drawSlashEffectImage(state.attackFlashX, state.attackFlashY, state.attackFlashAngle, flashAlpha, state.attackFlashHit);
        }

        for (var e = 0; e < battle.enemies.length; e++) {
            var enemy = battle.enemies[e];
            context.save();
            if (enemy.hidden) {
                context.globalAlpha = 0.08;
                context.strokeStyle = 'rgba(255, 255, 255, 0.24)';
                context.lineWidth = 1;
                context.beginPath();
                context.arc(enemy.x, enemy.y, enemy.radius * 0.72, 0, Math.PI * 2);
                context.stroke();
                context.globalAlpha = 0.05;
                context.fillStyle = 'rgba(255, 255, 255, 0.32)';
                context.beginPath();
                context.arc(enemy.x, enemy.y, 4, 0, Math.PI * 2);
                context.fill();
            } else {
                context.globalAlpha = 1;
                drawSpriteFacing(enemy.spriteKey, enemy.x, enemy.y, enemy.radius * 2.15, enemy.facingX || 1);
            }
            context.restore();
        }

        if (state.pointer && state.pointer.active) {
            context.save();
            context.strokeStyle = 'rgba(44, 156, 229, 0.92)';
            context.lineWidth = 2;
            context.beginPath();
            context.arc(state.pointer.x, state.pointer.y, 10, 0, Math.PI * 2);
            context.stroke();
            context.beginPath();
            context.moveTo(state.pointer.x - 14, state.pointer.y);
            context.lineTo(state.pointer.x - 6, state.pointer.y);
            context.moveTo(state.pointer.x + 6, state.pointer.y);
            context.lineTo(state.pointer.x + 14, state.pointer.y);
            context.moveTo(state.pointer.x, state.pointer.y - 14);
            context.lineTo(state.pointer.x, state.pointer.y - 6);
            context.moveTo(state.pointer.x, state.pointer.y + 6);
            context.lineTo(state.pointer.x, state.pointer.y + 14);
            context.stroke();
            context.restore();
        }
    }

    function frameLoop(timestamp) {
        frameRaf = 0;
        if (!shouldRunFrameLoop()) {
            resetFrameClock();
            return;
        }
        if (!lastFrameTime) {
            lastFrameTime = timestamp;
        }
        var dt = Math.min((timestamp - lastFrameTime) / 1000, 0.05);
        lastFrameTime = timestamp;
        updateBattle(dt);
        renderScene();
        if (shouldRunFrameLoop()) {
            frameRaf = window.requestAnimationFrame(frameLoop);
        }
    }

    function startFrameLoop() {
        if (frameRaf || !shouldRunFrameLoop()) return;
        resetFrameClock();
        frameRaf = window.requestAnimationFrame(frameLoop);
    }

    function showResult(result) {
        var success = result === 'success';
        if (resultTitle) {
            setText(resultTitle, success ? '成功' : '失败');
        }
        if (resultDetail) {
            setText(resultDetail, success ? '特殊物品已集齐 5 个' : 'NEKO 稳定值已归零');
        }
        setPhase(success ? 'success' : 'failed');
        endRouteSession(success ? 'success' : 'failed', false);
    }

    function restartToReady() {
        stopFrameLoop();
        endRouteSession('restart', false).finally(function () {
            resetRouteSessionForRestart();
            resetBattleState();
            setPhase(state.spriteReady ? 'ready' : 'loading');
        });
    }

    function exitToMemoryBrowser() {
        state.phase = 'exiting';
        syncPhase();
        stopFrameLoop();
        endRouteSession('manual_exit', false).finally(function () {
            try {
                window.close();
            } catch (_) {}
            if (!window.closed) {
                window.location.assign('/memory_browser');
            }
        });
    }

    function enterPlaying() {
        if (!state.spriteReady || state.phase !== 'ready') return;
        resetBattleState();
        setPhase('playing');
    }

    function togglePauseFromKeyboard() {
        if (state.phase === 'playing') {
            setPhase('paused');
        } else if (state.phase === 'paused') {
            setPhase('playing');
        }
    }

    function handleVisibilityChange() {
        if (document.hidden) {
            stopFrameLoop();
            return;
        }
        resetFrameClock();
        if (state.phase === 'playing') {
            startFrameLoop();
        } else {
            renderScene();
        }
    }

    function markSpriteSheetReady(image) {
        spriteSheet = image;
        spriteCell.width = Math.floor(image.naturalWidth / SPRITE_COLUMNS);
        spriteCell.height = Math.floor(image.naturalHeight / SPRITE_ROWS);
        preloadVfxSheet();
    }

    function markVfxSheetReady(image) {
        vfxSheet = image;
        vfxCell.width = Math.floor(image.naturalWidth / VFX_COLUMNS);
        vfxCell.height = Math.floor(image.naturalHeight / VFX_ROWS);
        state.spriteReady = true;
        state.loadError = '';
        state.stability = getDifficultyState().stability;
        setText(loadingStatus, '维护素材已就绪');
        setPhase('ready');
    }

    function markSpriteSheetFailed() {
        state.spriteReady = false;
        state.loadError = 'sprite_load_failed';
        setText(loadingStatus, '素材加载失败，可以返回记忆界面后重试');
        setButtonDisabled(startBtn, true);
        setPhase('loading');
    }

    function preloadVfxSheet() {
        setText(loadingStatus, '正在准备特效素材');
        var image = new Image();
        image.onload = function () {
            if (image.naturalWidth < VFX_COLUMNS || image.naturalHeight < VFX_ROWS) {
                markSpriteSheetFailed();
                return;
            }
            markVfxSheetReady(image);
        };
        image.onerror = markSpriteSheetFailed;
        image.src = withAssetVersion(VFX_SHEET_URL);
    }

    function preloadSpriteSheet() {
        setPhase('loading');
        setText(loadingStatus, '正在准备维护素材');
        state.spriteReady = false;
        var image = new Image();
        image.onload = function () {
            if (image.naturalWidth < SPRITE_COLUMNS || image.naturalHeight < SPRITE_ROWS) {
                markSpriteSheetFailed();
                return;
            }
            markSpriteSheetReady(image);
        };
        image.onerror = markSpriteSheetFailed;
        image.src = withAssetVersion(SPRITE_SHEET_URL);
    }

    function handlePointerMove(event) {
        if (state.phase === 'exiting') return;
        updatePointerFromEvent(event, state.pointer && state.pointer.down);
    }

    function handlePointerDown(event) {
        if (state.phase === 'exiting') return;
        if (state.phase === 'playing') {
            queuePrimaryAttack(event);
            return;
        }
        updatePointerFromEvent(event, true);
    }

    function handlePointerUp(event) {
        if (state.phase === 'exiting') return;
        updatePointerFromEvent(event, false);
        if (state.pointer) {
            state.pointer.down = false;
        }
    }

    function handlePointerLeave() {
        if (state.pointer) {
            state.pointer.active = false;
            state.pointer.down = false;
        }
        if (state.phase === 'playing') {
            renderScene();
        }
    }

    function handleTouchEvent(event) {
        if (state.phase === 'exiting') return;
        if (event && event.cancelable) {
            event.preventDefault();
        }
        if (event.type === 'touchend' || event.type === 'touchcancel') {
            handlePointerUp(event);
            return;
        }
        if (event.type === 'touchstart' && state.phase === 'playing') {
            queuePrimaryAttack(event);
            return;
        }
        updatePointerFromEvent(event, event.type === 'touchstart');
    }

    for (var i = 0; i < difficultyButtons.length; i++) {
        (function (button) {
            button.setAttribute('role', 'radio');
            button.addEventListener('click', function () {
                if (state.phase !== 'ready') return;
                setDifficulty(button.getAttribute('data-difficulty') || 'easy');
                syncHud();
            });
        })(difficultyButtons[i]);
    }

    if (startBtn) {
        startBtn.addEventListener('click', enterPlaying);
    }
    if (nekoModeBtn) {
        nekoModeBtn.addEventListener('click', toggleNekoMode);
    }
    if (continueBtn) {
        continueBtn.addEventListener('click', function () {
            if (state.phase === 'paused') {
                setPhase('playing');
            }
        });
    }
    if (restartBtn) {
        restartBtn.addEventListener('click', restartToReady);
    }
    if (exitBtn) {
        exitBtn.addEventListener('click', exitToMemoryBrowser);
    }
    if (loadingExitBtn) {
        loadingExitBtn.addEventListener('click', exitToMemoryBrowser);
    }
    if (endRestartBtn) {
        endRestartBtn.addEventListener('click', restartToReady);
    }
    if (endExitBtn) {
        endExitBtn.addEventListener('click', exitToMemoryBrowser);
    }

    document.addEventListener('keydown', function (event) {
        if (event.key === 'Escape') {
            togglePauseFromKeyboard();
        }
    });

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('pagehide', function () {
        endRouteSession('pagehide', true);
    });
    window.addEventListener('beforeunload', function () {
        endRouteSession('beforeunload', true);
    });
    window.addEventListener('resize', scheduleResize);
    if (canvas) {
        canvas.addEventListener('pointermove', handlePointerMove);
        canvas.addEventListener('pointerdown', handlePointerDown);
        canvas.addEventListener('pointerup', handlePointerUp);
        canvas.addEventListener('pointerleave', handlePointerLeave);
        canvas.addEventListener('pointercancel', handlePointerLeave);
        canvas.addEventListener('touchstart', handleTouchEvent, { passive: false });
        canvas.addEventListener('touchmove', handleTouchEvent, { passive: false });
        canvas.addEventListener('touchend', handleTouchEvent, { passive: false });
        canvas.addEventListener('touchcancel', handleTouchEvent, { passive: false });
    }

    window.appSubconsciousMaintenance = {
        getState: function () {
            return Object.assign({}, state);
        },
        getPointerState: function () {
            return state.pointer ? Object.assign({}, state.pointer) : null;
        },
        getBattleSnapshot: getBattleSnapshot,
        getCanvasPointFromEvent: getCanvasPointFromEvent,
        toggleNekoMode: toggleNekoMode,
        getSpriteManifest: function () {
            return Object.assign({}, SPRITES);
        },
        getEnemySprites: function () {
            return ENEMY_SPRITES.slice();
        },
        setDifficulty: setDifficulty,
        setPhase: setPhase,
        showResult: showResult,
        syncHud: syncHud,
        resizeCanvas: resizeCanvas,
        preloadSpriteSheet: preloadSpriteSheet
    };

    syncDifficultyButtons();
    syncHud();
    syncPhase();
    resizeCanvas();
    preloadSpriteSheet();
})();
