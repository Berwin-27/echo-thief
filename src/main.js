import StartScene from './StartScene.js';

let player, walls, guards, wasd, keys, darkOverlay, revealGfx, exit;
let exitX, exitY;
let currentLevel     = 1;
let transitioning    = false;
let audioCtx;
let lastPulse        = 0;
let ambientNodes     = [];
let ambientTimer     = null;
let currentGlowRadius = 0;
let mapW, mapH;

const TILE = 64;

function generateLevel(lvl) {
    const cols = Math.min(18 + lvl * 2, 48);
    const rows = Math.min(14 + lvl * 2, 36);

    // Border walls, open interior
    const grid = Array.from({ length: rows }, (_, r) =>
        Array.from({ length: cols }, (_, c) =>
            (r === 0 || r === rows - 1 || c === 0 || c === cols - 1) ? 1 : 0
        )
    );

    grid[1][1] = 2; // player spawn, always top-left

    // Scatter wall segments (horizontal or vertical runs of 2–4 tiles)
    const segCount = 8 + lvl * 3;
    for (let i = 0; i < segCount; i++) {
        const r    = 1 + Math.floor(Math.random() * (rows - 2));
        const c    = 2 + Math.floor(Math.random() * (cols - 4));
        if (r <= 2 && c <= 3) continue; // protect spawn area
        const len  = 2 + Math.floor(Math.random() * 3);
        const horiz = Math.random() < 0.5;
        for (let j = 0; j < len; j++) {
            const wr = horiz ? r                         : Math.min(r + j, rows - 2);
            const wc = horiz ? Math.min(c + j, cols - 2) : c;
            if (grid[wr][wc] === 0) grid[wr][wc] = 1;
        }
    }

    // Exit: random cell in the far half of the map from the player
    let er, ec, t = 0;
    do {
        er = 1 + Math.floor(Math.random() * (rows - 2));
        ec = Math.floor(cols / 2) + 1 + Math.floor(Math.random() * (Math.floor(cols / 2) - 2));
        t++;
    } while (grid[er][ec] !== 0 && t < 300);
    grid[er][ec] = 3;

    // Guards: placed only in open horizontal corridors
    const numGuards = 1 + Math.floor(lvl / 2);
    let placed = 0; t = 0;
    while (placed < numGuards && t < 600) {
        t++;
        const r = 1 + Math.floor(Math.random() * (rows - 2));
        const c = 2 + Math.floor(Math.random() * (cols - 4));
        if (grid[r][c] === 0 && grid[r][c - 1] === 0 && grid[r][c + 1] === 0) {
            grid[r][c] = 4;
            placed++;
        }
    }

    return grid;
}

const SPEEDS      = { RUN: 250, WALK: 130, CROUCH: 70 };
const LIGHT_RADII = { RUN: 240, WALK: 130, CROUCH: 70 };
const SOUND_RADII = { RUN: 360, WALK: 190, CROUCH: 85 };

function getAudio() {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    return audioCtx;
}

function playTone(freq, dur, type = 'square', vol = 0.25) {
    const ctx  = getAudio();
    const osc  = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain); gain.connect(ctx.destination);
    osc.type = type;
    osc.frequency.setValueAtTime(freq, ctx.currentTime);
    gain.gain.setValueAtTime(vol, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
    osc.start(); osc.stop(ctx.currentTime + dur);
}

function playAlertSiren() {
    const ctx  = getAudio();
    const osc  = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain); gain.connect(ctx.destination);
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(880, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(110, ctx.currentTime + 0.9);
    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.9);
    osc.start(); osc.stop(ctx.currentTime + 0.9);
}

function playFootstep(state) {
    const ctx = getAudio();
    const vol  = state === 'RUN' ? 0.22 : state === 'CROUCH' ? 0.06 : 0.13;
    const freq = state === 'RUN' ? 110  : state === 'CROUCH' ? 55   : 75;

    // Low thud — pitch drops fast like a stone footfall
    const osc = ctx.createOscillator();
    const og  = ctx.createGain();
    osc.connect(og); og.connect(ctx.destination);
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(28, ctx.currentTime + 0.09);
    og.gain.setValueAtTime(vol, ctx.currentTime);
    og.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.11);
    osc.start(); osc.stop(ctx.currentTime + 0.11);

    // Surface texture — short filtered noise burst (gravel/stone click)
    const len = Math.floor(ctx.sampleRate * 0.04);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d   = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    const src  = ctx.createBufferSource();
    src.buffer = buf;
    const filt = ctx.createBiquadFilter();
    filt.type           = 'highpass';
    filt.frequency.value = 1400;
    const ng = ctx.createGain();
    src.connect(filt); filt.connect(ng); ng.connect(ctx.destination);
    ng.gain.setValueAtTime(vol * 0.28, ctx.currentTime);
    ng.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.04);
    src.start(); src.stop(ctx.currentTime + 0.04);
}

function playVictory() {
    const ctx = getAudio();
    [523, 659, 784, 1047].forEach((freq, i) => {
        const t    = ctx.currentTime + i * 0.15;
        const osc  = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain); gain.connect(ctx.destination);
        osc.type = 'square';
        osc.frequency.setValueAtTime(freq, t);
        gain.gain.setValueAtTime(0.25, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
        osc.start(t); osc.stop(t + 0.18);
    });
}

function stopAmbientMusic() {
    clearTimeout(ambientTimer);
    ambientTimer = null;
    ambientNodes.forEach(n => { try { n.stop(); } catch(e) {} });
    ambientNodes = [];
}

function startAmbientMusic() {
    stopAmbientMusic();
    const ctx = getAudio();

    // Feedback delay reverb — two taps, low-passed in feedback loop
    const d1 = ctx.createDelay(2); d1.delayTime.value = 0.31;
    const d2 = ctx.createDelay(2); d2.delayTime.value = 0.57;
    const fb  = ctx.createGain(); fb.gain.value = 0.36;
    const lp  = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 900;
    const wet = ctx.createGain(); wet.gain.value = 0.28;
    d1.connect(d2); d2.connect(fb); fb.connect(lp); lp.connect(d1);
    d1.connect(wet); d2.connect(wet); wet.connect(ctx.destination);

    // Drone layers — two detuned oscillators create natural beating at ~0.6 Hz
    [
        [55,   'sawtooth', 0.055, 0.04, 0.8],
        [55.6, 'sine',     0.045, 0.07, 0.6],
        [82.4, 'sine',     0.030, 0.11, 1.0],  // minor third-ish above base
        [110,  'sine',     0.018, 0.15, 0.4],  // octave, very subtle
    ].forEach(([f, type, vol, lfoHz, lfoDep]) => {
        const osc  = ctx.createOscillator();
        const gain = ctx.createGain();
        const lfo  = ctx.createOscillator();
        const lfog = ctx.createGain();
        osc.type = type; osc.frequency.value = f;
        lfo.type = 'sine'; lfo.frequency.value = lfoHz; lfog.gain.value = lfoDep;
        lfo.connect(lfog); lfog.connect(osc.frequency);
        gain.gain.setValueAtTime(0, ctx.currentTime);
        gain.gain.linearRampToValueAtTime(vol, ctx.currentTime + 4);
        osc.connect(gain);
        gain.connect(ctx.destination);
        gain.connect(d1);
        osc.start(); lfo.start();
        ambientNodes.push(osc, lfo);
    });

    // Whisper tones — slow sine swells from a Phrygian/diminished palette
    const palette = [110, 116.5, 138.6, 155.6, 174.6, 196, 207.7, 233, 261.6, 277.2, 311.1];
    function whisper() {
        const freq = palette[Math.floor(Math.random() * palette.length)] * (Math.random() < 0.4 ? 2 : 1);
        const dur  = 3 + Math.random() * 5;
        const osc  = ctx.createOscillator();
        const g    = ctx.createGain();
        osc.type = 'sine'; osc.frequency.value = freq;
        g.gain.setValueAtTime(0, ctx.currentTime);
        g.gain.linearRampToValueAtTime(0.03, ctx.currentTime + dur * 0.3);
        g.gain.linearRampToValueAtTime(0, ctx.currentTime + dur);
        osc.connect(g); g.connect(d1); g.connect(ctx.destination);
        osc.start(); osc.stop(ctx.currentTime + dur);
        ambientTimer = setTimeout(whisper, 3500 + Math.random() * 5000);
    }
    whisper();
}

function drawGuardSprite(gfx, x, y) {
    // Red Mario cap
    gfx.fillStyle(0xcc2200, 1);
    gfx.fillRect(x - 6, y - 12, 12, 5);
    gfx.fillRect(x - 8, y - 8,  16, 2);  // brim
    // Gold badge on cap
    gfx.fillStyle(0xffcc00, 1);
    gfx.fillRect(x - 1, y - 11, 3, 3);
    // Face
    gfx.fillStyle(0xffcc88, 1);
    gfx.fillRect(x - 4, y - 7,  8, 5);
    // Eyes
    gfx.fillStyle(0x111111, 1);
    gfx.fillRect(x - 3, y - 6,  2, 2);
    gfx.fillRect(x + 1, y - 6,  2, 2);
    // Mustache
    gfx.fillStyle(0x663300, 1);
    gfx.fillRect(x - 3, y - 3,  6, 2);
    // Blue guard uniform + arms
    gfx.fillStyle(0x2244aa, 1);
    gfx.fillRect(x - 5, y - 1, 10, 6);
    gfx.fillRect(x - 8, y - 1,  3, 4);  // left arm
    gfx.fillRect(x + 5, y - 1,  3, 4);  // right arm
    // Gold badge on chest
    gfx.fillStyle(0xffcc00, 1);
    gfx.fillRect(x - 1, y,      3, 3);
    // Legs
    gfx.fillStyle(0x2244aa, 1);
    gfx.fillRect(x - 5, y + 5,  4, 5);
    gfx.fillRect(x + 1, y + 5,  4, 5);
    // Brown boots
    gfx.fillStyle(0x8b4513, 1);
    gfx.fillRect(x - 6, y + 10, 5, 2);
    gfx.fillRect(x + 1, y + 10, 5, 2);
}

function drawPlayerSprite(gfx, x, y) {
    // Hood (narrow peak tapering up)
    gfx.fillStyle(0x0a0a1a, 1);
    gfx.fillRect(x - 3, y - 12, 6, 3);
    gfx.fillRect(x - 5, y - 10, 10, 3);
    gfx.fillRect(x - 6, y - 8,  12, 3);
    // Face shadow under hood
    gfx.fillStyle(0x111133, 1);
    gfx.fillRect(x - 5, y - 6,  10, 5);
    // Glowing cyan eyes
    gfx.fillStyle(0x00ffcc, 1);
    gfx.fillRect(x - 4, y - 5,  2, 2);
    gfx.fillRect(x + 2, y - 5,  2, 2);
    // Lower mask
    gfx.fillStyle(0x0a0a1a, 1);
    gfx.fillRect(x - 4, y - 3,  8, 2);
    // Dark jacket / cloak body
    gfx.fillStyle(0x12122a, 1);
    gfx.fillRect(x - 6, y - 1, 12, 7);
    // Utility belt
    gfx.fillStyle(0x3a3a66, 1);
    gfx.fillRect(x - 6, y + 4,  12, 2);
    // Legs
    gfx.fillStyle(0x0d0d22, 1);
    gfx.fillRect(x - 5, y + 6,  4, 5);
    gfx.fillRect(x + 1, y + 6,  4, 5);
    // Boots
    gfx.fillStyle(0x1e1e3a, 1);
    gfx.fillRect(x - 6, y + 11, 5, 2);
    gfx.fillRect(x + 1, y + 11, 5, 2);
}

class GameScene extends Phaser.Scene {
    constructor() {
        super({ key: 'GameScene' });
    }

    preload() {}

    create(data) {
        if (data && data.newGame) { currentLevel = 1; startAmbientMusic(); }
        transitioning = false;

        const gfx = this.add.graphics();
        gfx.fillStyle(0xffffff, 1);
        gfx.fillCircle(12, 12, 12);
        gfx.generateTexture('player', 24, 24);
        gfx.destroy();

        const guardGfx = this.add.graphics();
        guardGfx.fillStyle(0xff3333, 1);
        guardGfx.fillCircle(12, 12, 12);
        guardGfx.generateTexture('guard', 24, 24);
        guardGfx.destroy();

        const level = generateLevel(currentLevel);
        const cols  = level[0].length;
        const rows  = level.length;
        mapW = cols * TILE;
        mapH = rows * TILE;

        this.physics.world.setBounds(0, 0, mapW, mapH);

        walls  = this.physics.add.staticGroup();
        guards = this.physics.add.group();

        level.forEach((row, r) => {
            row.forEach((cell, c) => {
                const x = c * TILE + TILE / 2;
                const y = r * TILE + TILE / 2;
                if (cell === 1) {
                    const w = this.add.rectangle(x, y, TILE, TILE, 0x000000, 0);
                    this.physics.add.existing(w, true);
                    walls.add(w);
                } else if (cell === 2) {
                    player = this.physics.add.image(x, y, 'player');
                    player.setCollideWorldBounds(true);
                    player.setAlpha(0);
                } else if (cell === 4) {
                    const g = guards.create(x, y, 'guard');
                    g.setCollideWorldBounds(true);
                    g.setVelocityX(90);
                    g.state = 'PATROL';
                    g.setAlpha(0);
                } else if (cell === 3) {
                    exit = this.add.rectangle(x, y, TILE, TILE, 0x00aa44, 0);
                    this.physics.add.existing(exit, true);
                    exitX = x; exitY = y;
                }
            });
        });

        this.physics.add.collider(player, walls);
        this.physics.add.collider(guards, walls);

        this.physics.add.overlap(player, guards, () => {
            if (transitioning) return;
            transitioning = true;
            this.cameras.main.flash(300, 255, 0, 0);
            this.time.delayedCall(300, () => this.scene.restart({}));
        });

        this.physics.add.overlap(player, exit, () => {
            if (transitioning) return;
            transitioning = true;
            playVictory();
            this.cameras.main.flash(500);
            if (currentLevel < 20) {
                currentLevel++;
                this.time.delayedCall(500, () => this.scene.restart({}));
            } else {
                this.time.delayedCall(500, () => {
                    this.physics.world.pause();
                    this.add.text(400, 300, 'YOU ESCAPED\nTHE DARKNESS!', {
                        fontSize: '38px', fontFamily: 'monospace',
                        color: '#ffffff', align: 'center',
                    }).setOrigin(0.5).setDepth(20).setScrollFactor(0);
                    this.add.text(400, 420, 'PRESS ANY KEY TO PLAY AGAIN', {
                        fontSize: '15px', fontFamily: 'monospace', color: '#888888',
                    }).setOrigin(0.5).setDepth(20).setScrollFactor(0);
                    this.input.keyboard.once('keydown', () => {
                        stopAmbientMusic();
                        this.scene.start('StartScene');
                    });
                });
            }
        });

        wasd = this.input.keyboard.addKeys({
            up:    Phaser.Input.Keyboard.KeyCodes.W,
            down:  Phaser.Input.Keyboard.KeyCodes.S,
            left:  Phaser.Input.Keyboard.KeyCodes.A,
            right: Phaser.Input.Keyboard.KeyCodes.D,
        });

        keys = this.input.keyboard.addKeys({
            shift:  Phaser.Input.Keyboard.KeyCodes.SHIFT,
            crouch: Phaser.Input.Keyboard.KeyCodes.C,
        });

        player.moveState = 'WALK';

        currentGlowRadius = 0;

        // Full-world black overlay — no mask needed
        darkOverlay = this.add.graphics();
        darkOverlay.setDepth(10);

        // Draws wall outlines, guards, player, exit above darkness, only within light radius
        revealGfx = this.add.graphics();
        revealGfx.setDepth(11);

        // Camera follows player, bounded to the world
        this.cameras.main.startFollow(player, true);
        this.cameras.main.setBounds(0, 0, mapW, mapH);

        this.add.text(400, 8, `LEVEL  ${currentLevel} / 20`, {
            fontSize: '13px', fontFamily: 'monospace', color: '#ffffff', alpha: 0.35,
        }).setOrigin(0.5).setDepth(12).setScrollFactor(0);

        this.add.text(400, 592, 'WASD · SHIFT run · C crouch', {
            fontSize: '11px', fontFamily: 'monospace', color: '#333333',
        }).setOrigin(0.5).setDepth(12).setScrollFactor(0);
    }

    update() {
        player.moveState = keys.shift.isDown  ? 'RUN'
                         : keys.crouch.isDown ? 'CROUCH'
                         : 'WALK';

        const speed = SPEEDS[player.moveState];
        player.setVelocity(0);
        if (wasd.left.isDown)  player.setVelocityX(-speed);
        if (wasd.right.isDown) player.setVelocityX(speed);
        if (wasd.up.isDown)    player.setVelocityY(-speed);
        if (wasd.down.isDown)  player.setVelocityY(speed);

        const isMoving   = wasd.left.isDown || wasd.right.isDown ||
                           wasd.up.isDown   || wasd.down.isDown;
        const glowTarget  = isMoving ? LIGHT_RADII[player.moveState] : 0;
        const soundRadius = SOUND_RADII[player.moveState];
        const now         = this.time.now;

        currentGlowRadius += (glowTarget - currentGlowRadius) * 0.14;

        guards.getChildren().forEach(g => {
            const dp    = Phaser.Math.Distance.Between(player.x, player.y, g.x, g.y);
            const heard = isMoving && dp <= soundRadius;

            if (g.state === 'PATROL') {
                // Reverse off walls so guards never stare into them
                if (g.body.blocked.left)  g.setVelocityX(90);
                if (g.body.blocked.right) g.setVelocityX(-90);
                if (heard) {
                    playAlertSiren();
                    g.state  = 'ALERT';
                    g.heardX = player.x;
                    g.heardY = player.y;
                }
            } else if (g.state === 'ALERT') {
                // Continuously update target while player is audible
                if (heard) { g.heardX = player.x; g.heardY = player.y; }
                const dt = Phaser.Math.Distance.Between(g.x, g.y, g.heardX, g.heardY);
                if (dt < 12) {
                    g.setVelocity(0);
                    g.state     = 'WAIT';
                    g.waitUntil = now + 2000;
                } else {
                    this.physics.moveTo(g, g.heardX, g.heardY, 140);
                }
            } else if (g.state === 'WAIT') {
                if (heard) {
                    g.state  = 'ALERT';
                    g.heardX = player.x;
                    g.heardY = player.y;
                } else if (now >= g.waitUntil) {
                    g.state = 'PATROL';
                    g.setVelocityX(90);
                }
            }
        });

        darkOverlay.clear();
        darkOverlay.fillStyle(0x000000, 1);
        darkOverlay.fillRect(0, 0, mapW, mapH);

        revealGfx.clear();
        if (currentGlowRadius > 2) {
            const r = Math.round(currentGlowRadius);
            // Subtle floor glow so the light circle is perceptible
            revealGfx.fillStyle(0xffffff, 0.04);
            revealGfx.fillCircle(player.x, player.y, r);
            // Wall outlines within radius
            revealGfx.lineStyle(1.5, 0xffffff, 0.85);
            walls.getChildren().forEach(w => {
                if (Phaser.Math.Distance.Between(player.x, player.y, w.x, w.y) < r + TILE * 0.75)
                    revealGfx.strokeRect(w.x - TILE / 2, w.y - TILE / 2, TILE, TILE);
            });
            // Guards within radius
            guards.getChildren().forEach(g => {
                if (Phaser.Math.Distance.Between(player.x, player.y, g.x, g.y) < r + 14) {
                    drawGuardSprite(revealGfx, g.x, g.y);
                }
            });
            // Exit within radius
            if (Phaser.Math.Distance.Between(player.x, player.y, exitX, exitY) < r + TILE * 0.75) {
                revealGfx.fillStyle(0x00aa44, 0.9);
                revealGfx.fillRect(exitX - TILE / 2, exitY - TILE / 2, TILE, TILE);
            }
        }
        // Player always visible at light centre
        drawPlayerSprite(revealGfx, player.x, player.y);

        if (isMoving) {
            const cd = player.moveState === 'RUN' ? 190 : player.moveState === 'CROUCH' ? 480 : 330;
            if (Date.now() - lastPulse > cd) { lastPulse = Date.now(); playFootstep(player.moveState); }
        }
    }
}

const config = {
    type: Phaser.AUTO,
    width: 800,
    height: 600,
    backgroundColor: '#000000',
    physics: {
        default: 'arcade',
        arcade: { debug: false },
    },
    scene: [StartScene, GameScene],
};

new Phaser.Game(config);
