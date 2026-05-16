const config = {
    type: Phaser.AUTO,
    width: 800,
    height: 600,
    backgroundColor: '#000000',
    physics: {
        default: 'arcade',
        arcade: { debug: false }
    },
    scene: { preload, create, update }
};

const game = new Phaser.Game(config);

let player;
let walls;
let guards;
let wasd;
let keys;
let darkness;
let exit;
let currentLevel  = 1;
let transitioning = false;
let audioCtx;
let lastPulse = 0;

const TILE = 64;
const OX   = 16;
const OY   = 12;

const LEVELS = [
  [ // 1 — open layout, 2 guards
    [1,1,1,1,1,1,1,1,1,1,1,1],
    [1,2,0,0,0,1,0,0,0,0,0,1],
    [1,0,0,0,0,1,0,4,0,0,0,1],
    [1,0,1,1,0,0,0,0,0,1,0,1],
    [1,0,1,0,0,0,0,0,0,1,0,1],
    [1,0,0,0,0,1,1,0,0,0,0,1],
    [1,0,4,0,0,1,0,0,0,0,0,1],
    [1,0,0,0,0,0,0,0,0,0,3,1],
    [1,1,1,1,1,1,1,1,1,1,1,1],
  ],
  [ // 2 — more walls, 2 guards
    [1,1,1,1,1,1,1,1,1,1,1,1],
    [1,2,0,0,0,0,1,0,0,0,0,1],
    [1,0,1,0,0,0,1,0,4,0,0,1],
    [1,0,1,0,1,0,0,0,0,0,0,1],
    [1,0,0,0,1,0,0,0,0,0,0,1],
    [1,0,0,0,1,0,1,1,0,0,4,1],
    [1,0,0,0,0,0,1,0,0,0,0,1],
    [1,0,0,0,0,0,0,0,0,0,3,1],
    [1,1,1,1,1,1,1,1,1,1,1,1],
  ],
  [ // 3 — corridors, 3 guards
    [1,1,1,1,1,1,1,1,1,1,1,1],
    [1,2,0,0,1,0,0,0,0,0,0,1],
    [1,0,0,0,1,0,4,0,0,0,0,1],
    [1,0,0,0,0,0,0,0,0,1,0,1],
    [1,1,1,0,0,1,0,0,0,1,0,1],
    [1,0,0,0,0,1,0,0,0,0,0,1],
    [1,0,4,0,0,0,0,1,0,0,4,1],
    [1,0,0,0,0,0,0,0,0,0,3,1],
    [1,1,1,1,1,1,1,1,1,1,1,1],
  ],
  [ // 4 — tight layout, 3 guards
    [1,1,1,1,1,1,1,1,1,1,1,1],
    [1,2,0,1,0,0,0,0,0,0,0,1],
    [1,0,0,1,0,4,0,0,0,0,0,1],
    [1,0,0,1,0,0,0,1,0,0,0,1],
    [1,0,0,0,0,0,0,1,0,1,0,1],
    [1,1,0,0,1,0,0,1,0,1,0,1],
    [1,0,0,0,1,0,4,0,0,0,4,1],
    [1,0,0,0,0,0,0,0,0,0,3,1],
    [1,1,1,1,1,1,1,1,1,1,1,1],
  ],
  [ // 5 — maze, 4 guards
    [1,1,1,1,1,1,1,1,1,1,1,1],
    [1,2,0,1,0,0,1,0,0,0,0,1],
    [1,0,0,1,0,4,0,0,0,4,0,1],
    [1,0,0,0,0,0,0,1,0,0,0,1],
    [1,0,1,0,1,1,0,1,0,0,0,1],
    [1,0,1,0,0,0,0,0,0,1,0,1],
    [1,0,0,0,0,0,4,0,0,1,4,1],
    [1,0,0,0,0,0,0,0,0,0,3,1],
    [1,1,1,1,1,1,1,1,1,1,1,1],
  ],
];

const SPEEDS      = { RUN: 250, WALK: 130, CROUCH: 70 };
const LIGHT_RADII = { RUN: 260, WALK: 140, CROUCH: 80 };

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

function preload() {}

function create() {
    const gfx = this.add.graphics();

    // Player: white circle texture
    gfx.fillStyle(0xffffff, 1);
    gfx.fillCircle(12, 12, 12);
    gfx.generateTexture('player', 24, 24);
    gfx.destroy();

    // Guard texture
    const guardGfx = this.add.graphics();
    guardGfx.fillStyle(0xff3333, 1);
    guardGfx.fillCircle(12, 12, 12);
    guardGfx.generateTexture('guard', 24, 24);
    guardGfx.destroy();

    walls  = this.physics.add.staticGroup();
    guards = this.physics.add.group();

    LEVELS[currentLevel - 1].forEach((row, r) => {
        row.forEach((cell, c) => {
            const x = OX + c * TILE + TILE / 2;
            const y = OY + r * TILE + TILE / 2;
            if (cell === 1) {
                const w = this.add.rectangle(x, y, TILE, TILE, 0x555555);
                this.physics.add.existing(w, true);
                walls.add(w);
            } else if (cell === 2) {
                player = this.physics.add.image(x, y, 'player');
                player.setCollideWorldBounds(true);
            } else if (cell === 4) {
                const g = guards.create(x, y, 'guard');
                g.setCollideWorldBounds(true);
                g.patrolMin = x - TILE * 2;
                g.patrolMax = x + TILE * 2;
                g.setVelocityX(90);
                g.state = 'PATROL';
            } else if (cell === 3) {
                exit = this.add.rectangle(x, y, TILE, TILE, 0x00aa44);
                this.physics.add.existing(exit, true);
            }
        });
    });

    this.physics.add.collider(player, walls);
    this.physics.add.collider(guards, walls);

    this.physics.add.overlap(player, guards, () => {
        console.log('GAME OVER');
        this.scene.restart();
    });

    transitioning = false;

    this.physics.add.overlap(player, exit, () => {
        if (transitioning) return;
        transitioning = true;
        playVictory();
        this.cameras.main.flash(500);
        if (currentLevel < 5) {
            currentLevel++;
            this.time.delayedCall(500, () => this.scene.restart());
        } else {
            this.time.delayedCall(500, () => {
                this.physics.world.pause();
                this.add.text(400, 300, 'YOU ESCAPED\nTHE DARKNESS!', {
                    fontSize: '38px',
                    fontFamily: 'monospace',
                    color: '#ffffff',
                    align: 'center'
                }).setOrigin(0.5).setDepth(20);
            });
        }
    });

    wasd = this.input.keyboard.addKeys({
        up:    Phaser.Input.Keyboard.KeyCodes.W,
        down:  Phaser.Input.Keyboard.KeyCodes.S,
        left:  Phaser.Input.Keyboard.KeyCodes.A,
        right: Phaser.Input.Keyboard.KeyCodes.D
    });

    keys = this.input.keyboard.addKeys({
        shift: Phaser.Input.Keyboard.KeyCodes.SHIFT,
        crouch: Phaser.Input.Keyboard.KeyCodes.C
    });

    player.moveState = 'WALK';

    // Pre-generate a white circle brush texture for each light radius
    Object.entries(LIGHT_RADII).forEach(([state, r]) => {
        const g = this.add.graphics();
        g.fillStyle(0xffffff, 1);
        g.fillCircle(r, r, r);
        g.generateTexture(`light_${state}`, r * 2, r * 2);
        g.destroy();
    });

    // Darkness overlay — sits above all world objects
    darkness = this.add.renderTexture(0, 0, 800, 600);
    darkness.fill(0x000000, 1);
    darkness.setDepth(10);

    this.add.text(400, 30, 'ECHO THIEF', {
        fontSize: '28px',
        fontFamily: 'monospace',
        color: '#ffffff',
        alpha: 0.3
    }).setOrigin(0.5).setDepth(11);

    this.add.text(400, 570, 'WASD  |  Shift: Run  |  C: Crouch', {
        fontSize: '12px',
        fontFamily: 'monospace',
        color: '#444444'
    }).setOrigin(0.5).setDepth(11);
}

function update() {
    player.moveState = keys.shift.isDown  ? 'RUN'
                     : keys.crouch.isDown ? 'CROUCH'
                     : 'WALK';

    const speed = SPEEDS[player.moveState];

    player.setVelocity(0);
    if (wasd.left.isDown)  player.setVelocityX(-speed);
    if (wasd.right.isDown) player.setVelocityX(speed);
    if (wasd.up.isDown)    player.setVelocityY(-speed);
    if (wasd.down.isDown)  player.setVelocityY(speed);

    const isMoving    = wasd.left.isDown || wasd.right.isDown ||
                        wasd.up.isDown   || wasd.down.isDown;
    const pulseRadius = LIGHT_RADII[player.moveState];
    const now         = this.time.now;

    guards.getChildren().forEach(g => {
        if (g.state === 'PATROL') {
            if (g.x <= g.patrolMin) g.setVelocityX(90);
            if (g.x >= g.patrolMax) g.setVelocityX(-90);
            if (isMoving) {
                const d = Phaser.Math.Distance.Between(player.x, player.y, g.x, g.y);
                if (d <= pulseRadius) {
                    if (g.state !== 'ALERT') playAlertSiren();
                    g.state  = 'ALERT';
                    g.heardX = player.x;
                    g.heardY = player.y;
                }
            }
        } else if (g.state === 'ALERT') {
            const d = Phaser.Math.Distance.Between(g.x, g.y, g.heardX, g.heardY);
            if (d < 12) {
                g.setVelocity(0);
                g.state     = 'WAIT';
                g.waitUntil = now + 2000;
            } else {
                this.physics.moveTo(g, g.heardX, g.heardY, 120);
            }
        } else if (g.state === 'WAIT') {
            if (now >= g.waitUntil) {
                g.state = 'PATROL';
                g.setVelocityX(90);
            }
        }
    });

    // Gradually restore darkness every frame (~2s to fully close)
    darkness.fill(0x000000, 0.04);

    if (isMoving) {
        darkness.erase(`light_${player.moveState}`, player.x - pulseRadius, player.y - pulseRadius);
        const cd = player.moveState === 'RUN' ? 110 : player.moveState === 'CROUCH' ? 380 : 210;
        const pf = player.moveState === 'RUN' ? 300 : player.moveState === 'CROUCH' ?  80 : 150;
        if (Date.now() - lastPulse > cd) { lastPulse = Date.now(); playTone(pf, 0.08, 'square', 0.15); }
    }
}
