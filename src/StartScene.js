export default class StartScene extends Phaser.Scene {
    constructor() { super({ key: 'StartScene' }); }

    create() {
        const W = 800, H = 600, cx = W / 2;

        // === STONE WALL BACKGROUND ===
        const bg = this.add.graphics();
        bg.fillStyle(0x1c1c1c, 1);
        bg.fillRect(0, 0, W, H);

        // Stone blocks — staggered rows
        const bW = 88, bH = 38;
        const stoneShades = [0x2a2a2a, 0x272727, 0x2e2e2e, 0x252525, 0x2c2c2c];
        for (let r = 0; r * bH < H + bH; r++) {
            const off = (r % 2) * Math.round(bW / 2);
            for (let c = -1; c * bW < W + bW; c++) {
                const shade = stoneShades[(r * 7 + c * 3 + 17) % stoneShades.length];
                bg.fillStyle(shade, 1);
                bg.fillRect(c * bW + off + 1, r * bH + 1, bW - 2, bH - 2);
            }
        }

        // Mortar lines
        const mortar = this.add.graphics();
        mortar.lineStyle(1, 0x131313, 1);
        for (let r = 1; r * bH < H; r++) mortar.lineBetween(0, r * bH, W, r * bH);
        for (let r = 0; r * bH < H; r++) {
            const off = (r % 2) * Math.round(bW / 2);
            for (let c = 0; c * bW < W + bW; c++) mortar.lineBetween(c * bW + off, r * bH, c * bW + off, (r + 1) * bH);
        }

        // Stone cracks
        const cracks = this.add.graphics();
        cracks.lineStyle(1, 0x161616, 1);
        [[118, 78], [670, 220], [210, 390], [590, 330], [420, 520], [300, 180], [550, 490]].forEach(([cx2, cy2]) => {
            cracks.lineBetween(cx2, cy2, cx2 + 14, cy2 + 22);
            cracks.lineBetween(cx2 + 14, cy2 + 22, cx2 + 7, cy2 + 36);
            cracks.lineBetween(cx2, cy2, cx2 - 9, cy2 + 14);
            cracks.lineBetween(cx2 + 14, cy2 + 22, cx2 + 22, cy2 + 30);
        });

        // Moisture drip streaks
        const drips = this.add.graphics();
        [[88, 0, 95], [340, 0, 75], [715, 0, 85]].forEach(([dx, , dlen]) => {
            drips.lineStyle(1, 0x1c281c, 0.55);
            drips.lineBetween(dx, 0, dx + 1, dlen);
            drips.lineBetween(dx, 0, dx - 1, dlen * 0.6);
            drips.fillStyle(0x1c281c, 0.4);
            drips.fillCircle(dx + 1, dlen, 2);
        });

        // === CONCRETE FLOOR STRIP ===
        const floor = this.add.graphics();
        floor.fillStyle(0x181818, 1);
        floor.fillRect(0, H - 40, W, 40);
        floor.lineStyle(1, 0x222222, 1);
        for (let fx = 0; fx < W; fx += 60) floor.lineBetween(fx, H - 40, fx, H);
        floor.lineBetween(0, H - 40, W, H - 40);

        // === FLUORESCENT LIGHT FIXTURE (top center) ===
        const light = this.add.graphics();
        light.fillStyle(0x303030, 1);
        light.fillRect(cx - 110, 0, 220, 10);
        light.fillStyle(0xeeeedd, 1);
        light.fillRect(cx - 105, 2, 210, 5);
        // Light cone gradient — noticeably brighter
        light.fillGradientStyle(0xffffcc, 0xffffcc, 0x000000, 0x000000, 0.48, 0.48, 0, 0);
        light.fillRect(cx - 130, 10, 260, 120);
        // Hanging chain
        light.fillStyle(0x383838, 1);
        [[cx - 80, 0, 2, 10], [cx + 78, 0, 2, 10]].forEach(([lx, ly, lw, lh]) => light.fillRect(lx, ly, lw, lh));

        // === PRISON BARS — left door frame ===
        const bars = this.add.graphics();
        const barCol = 0x222222, barHi = 0x363636, rustCol = 0x3a1a08;
        // Left bars (cell door)
        [44, 80, 116, 152].forEach(bx => {
            bars.fillStyle(barCol, 1);
            bars.fillRect(bx - 6, 0, 12, H);
            bars.fillStyle(barHi, 1);
            bars.fillRect(bx - 6, 0, 3, H); // light edge
            bars.fillStyle(rustCol, 0.35);
            bars.fillRect(bx - 2, H * 0.25, 4, 55);
            bars.fillRect(bx - 1, H * 0.7, 3, 30);
        });
        // Horizontal cross-bars (left)
        [H * 0.28, H * 0.56, H * 0.82].forEach(by => {
            bars.fillStyle(barCol, 1);
            bars.fillRect(38, by - 5, 120, 10);
            bars.fillStyle(barHi, 1);
            bars.fillRect(38, by - 5, 120, 3);
        });
        // Bar bolts
        [44, 80, 116, 152].forEach(bx => {
            [H * 0.28, H * 0.56, H * 0.82].forEach(by => {
                bars.fillStyle(0x3a3a3a, 1);
                bars.fillCircle(bx, by, 5);
                bars.fillStyle(0x4a4a4a, 1);
                bars.fillCircle(bx - 1, by - 1, 2);
            });
        });

        // Right bars (wall bars / decorative)
        [W - 44, W - 80, W - 116].forEach(bx => {
            bars.fillStyle(barCol, 1);
            bars.fillRect(bx - 6, 0, 12, H - 40);
            bars.fillStyle(barHi, 1);
            bars.fillRect(bx - 6, 0, 3, H - 40);
            bars.fillStyle(rustCol, 0.3);
            bars.fillRect(bx - 2, H * 0.4, 4, 45);
        });
        [H * 0.33, H * 0.66].forEach(by => {
            bars.fillStyle(barCol, 1);
            bars.fillRect(W - 122, by - 5, 84, 10);
            bars.fillStyle(barHi, 1);
            bars.fillRect(W - 122, by - 5, 84, 3);
        });

        // === COBWEBS ===
        const webs = this.add.graphics();

        const drawCobweb = (wx, wy, dirAng, size, alpha) => {
            const rays = 8, rings = 5, spread = Math.PI / 2.1;
            webs.lineStyle(1, 0x363636, alpha);
            for (let i = 0; i < rays; i++) {
                const a = dirAng - spread / 2 + (i / (rays - 1)) * spread;
                webs.lineBetween(wx, wy, wx + Math.cos(a) * size, wy + Math.sin(a) * size);
            }
            for (let ring = 1; ring <= rings; ring++) {
                const rr = size * ring / rings;
                for (let i = 0; i < rays - 1; i++) {
                    const a1 = dirAng - spread / 2 + (i / (rays - 1)) * spread;
                    const a2 = dirAng - spread / 2 + ((i + 1) / (rays - 1)) * spread;
                    webs.lineBetween(wx + Math.cos(a1) * rr, wy + Math.sin(a1) * rr,
                                     wx + Math.cos(a2) * rr, wy + Math.sin(a2) * rr);
                }
            }
        };

        drawCobweb(158, 2, Math.PI * 0.25, 68, 0.65);
        drawCobweb(W - 120, 2, Math.PI * 0.75, 55, 0.5);
        drawCobweb(158, H - 42, -Math.PI * 0.25, 48, 0.45);

        // Spiders
        const spiders = this.add.graphics();
        [[175, 32], [W - 135, 28]].forEach(([sx, sy]) => {
            spiders.fillStyle(0x252525, 1);
            spiders.fillCircle(sx, sy, 3);
            spiders.fillCircle(sx, sy - 2, 2);
            spiders.lineStyle(1, 0x222222, 0.9);
            [[-5,-2],[-5,0],[-4,2],[-3,4],[3,-2],[5,0],[4,2],[3,4]].forEach(([lx, ly]) =>
                spiders.lineBetween(sx, sy, sx + lx * 1.6, sy + ly * 1.6)
            );
        });

        // === TALLY MARKS — scratched into right wall ===
        const tally = this.add.graphics();
        tally.lineStyle(1, 0x2a2a22, 0.9);
        const tx = W - 108, ty2 = H - 90;
        for (let g2 = 0; g2 < 3; g2++) {
            for (let t = 0; t < 4; t++) tally.lineBetween(tx + g2 * 26 + t * 5, ty2, tx + g2 * 26 + t * 5, ty2 + 16);
            tally.lineBetween(tx + g2 * 26 - 2, ty2 + 4, tx + g2 * 26 + 19, ty2 + 12);
        }
        [0, 1, 2].forEach(t => tally.lineBetween(tx + 78 + t * 5, ty2, tx + 78 + t * 5, ty2 + 16));

        // Scratch "DAYS" label above tally
        this.add.text(tx, ty2 - 12, 'DAYS', { fontSize: '8px', fontFamily: 'monospace', color: '#2a2a22' });

        // === SCANLINES overlay ===
        const scan = this.add.graphics();
        scan.lineStyle(1, 0x000000, 0.06);
        for (let y = 0; y < H; y += 3) scan.lineBetween(0, y, W, y);

        // === FLICKER GROUP (all content that dims with the light) ===
        const flickerGroup = [];

        // === TITLE ===
        this.add.text(cx + 2, 62, 'ECHO  THIEF', {
            fontSize: '50px', fontFamily: 'monospace', color: '#000000',
        }).setOrigin(0.5).setAlpha(0.7);

        const title = this.add.text(cx, 60, 'ECHO  THIEF', {
            fontSize: '50px', fontFamily: 'monospace', color: '#dddddd',
        }).setOrigin(0.5);

        // Subtitle
        const LOCATIONS = ['CELLBLOCK  D', 'SOLITARY  WING', 'INTAKE  LEVEL', 'PROCESSING  UNIT'];
        const loc = LOCATIONS[Math.floor(Math.random() * LOCATIONS.length)];
        const locLabel = this.add.text(cx, 116, `${loc}  ·  20 FLOORS DOWN`, {
            fontSize: '10px', fontFamily: 'monospace', color: '#686868',
        }).setOrigin(0.5);
        flickerGroup.push(locLabel);

        const FLAVORS = [
            'MINIMUM SECURITY', 'MAXIMUM LOCKDOWN', 'SILENT PROTOCOL',
            'CODE RED', 'LIGHTS OUT', 'DEAD OF NIGHT', 'BLACKOUT CONDITIONS',
            'ZERO WITNESSES', 'NO ALARM RUN', 'GHOST MODE', 'ONE SHOT',
        ];
        const flavor = this.add.text(cx, 131, `[ ${FLAVORS[Math.floor(Math.random() * FLAVORS.length)]} ]`, {
            fontSize: '10px', fontFamily: 'monospace', color: '#545454',
        }).setOrigin(0.5);
        flickerGroup.push(flavor);

        // === NOTICE BOARD ===
        const board = this.add.graphics();
        board.fillStyle(0x121a12, 1);
        board.fillRect(162, 152, W - 324, 324);
        board.lineStyle(1, 0x2e422e, 1);
        board.strokeRect(162, 152, W - 324, 324);
        board.lineStyle(1, 0x1e2e1e, 1);
        board.strokeRect(165, 155, W - 330, 318);

        [[162, 152], [W - 162, 152], [162, 476], [W - 162, 476]].forEach(([bx2, by2]) => {
            board.fillStyle(0x343434, 1);
            board.fillCircle(bx2, by2, 5);
            board.fillStyle(0x484848, 1);
            board.fillCircle(bx2 - 1, by2 - 1, 2);
        });
        flickerGroup.push(board);

        const rule1 = this.add.graphics().lineStyle(1, 0x2e422e, 1);
        rule1.lineBetween(178, 207, W - 178, 207);
        rule1.lineBetween(178, 210, W - 178, 210);
        flickerGroup.push(rule1);

        const story = this.add.text(cx, 168, [
            'TWENTY FLOORS UNDERGROUND.  ONE WAY OUT.',
            'GUARDS PATROL EVERY LEVEL.  MAKE NO SOUND.',
        ].join('\n'), {
            fontSize: '11px', fontFamily: 'monospace', color: '#7aaa7a',
            align: 'center', lineSpacing: 5,
        }).setOrigin(0.5, 0);
        flickerGroup.push(story);

        const ctrlHead = this.add.text(cx, 220, '— HOW TO ESCAPE —', {
            fontSize: '10px', fontFamily: 'monospace', color: '#6a8a6a',
        }).setOrigin(0.5);
        flickerGroup.push(ctrlHead);

        const controls = this.add.text(178, 240, [
            'WASD       walk silently  ·  no stamina drain  ·  quiet',
            'SHIFT      sprint  ·  fast but loud  ·  drains stamina',
            'C          crouch  ·  half speed  ·  guards spot you 70% less far',
            'SPACE      KO guard  ·  sneak BEHIND for silent 1-hit KO',
            'E          smoke grenade (4 sec)  ·  hold E near body to drag it',
            'Q          throw rock  ·  lures guards to target point',
            'TAB        toggle first-person 3D view',
        ].join('\n'), {
            fontSize: '11px', fontFamily: 'monospace', color: '#587858',
            lineSpacing: 5,
        });
        flickerGroup.push(controls);

        const rule2 = this.add.graphics().lineStyle(1, 0x253825, 1);
        rule2.lineBetween(178, 358, W - 178, 358);
        flickerGroup.push(rule2);

        const tipsHead = this.add.text(cx, 366, '— FIELD NOTES —', {
            fontSize: '10px', fontFamily: 'monospace', color: '#5a7a5a',
        }).setOrigin(0.5);
        flickerGroup.push(tipsHead);

        const tips = this.add.text(cx, 380, [
            'Find the KEYCARD first  ·  then reach the stairwell exit on each floor',
            'Standard guards take 2 hits  ·  elite 3  ·  boss 3  ·  backstab = silent 1-hit KO',
            'Guards who find a KO\'d body raise the alarm  ·  drag bodies to hide them',
            'Cameras sweep corridors  ·  SWITCH panel blinds them  ·  tripwires from floor 7',
            'KO\'ing guards back-to-back builds a combo multiplier  ·  perk upgrade every 3rd floor',
        ].join('\n'), {
            fontSize: '10px', fontFamily: 'monospace', color: '#4e6a4e',
            align: 'center', lineSpacing: 5,
        }).setOrigin(0.5, 0);
        flickerGroup.push(tips);

        const rule3 = this.add.graphics().lineStyle(1, 0x1e2e1e, 1);
        rule3.lineBetween(178, 454, W - 178, 454);
        flickerGroup.push(rule3);

        // Score records + run history
        const hs = parseInt(localStorage.getItem('echoThiefHigh') || '0');
        const ff = parseInt(localStorage.getItem('echoThiefFurthest') || '0');
        if (hs > 0 || ff > 0) {
            const recLines = [];
            if (hs > 0) recLines.push(`BEST SCORE  ${hs}`);
            if (ff > 0) recLines.push(`DEEPEST FLOOR  ${ff}  /  20`);
            const rec = this.add.text(cx, 461, recLines.join('     '), {
                fontSize: '10px', fontFamily: 'monospace', color: '#4e6e4e',
            }).setOrigin(0.5);
            flickerGroup.push(rec);
        }
        const history = JSON.parse(localStorage.getItem('echoThiefHistory') || '[]');
        if (history.length > 0) {
            const histLines = history.map((r, i) => {
                const prefix = i === 0 ? 'LAST' : `  -${i} `;
                return `${prefix}  FL ${r.floor}/20  ${String(r.score).padStart(6)}  ${r.stealth}`;
            });
            const histTxt = this.add.text(cx, 473, histLines.join('\n'), {
                fontSize: '9px', fontFamily: 'monospace', color: '#4a624a',
                align: 'center', lineSpacing: 4,
            }).setOrigin(0.5);
            flickerGroup.push(histTxt);
        }

        // === PRESS ANY KEY ===
        const prompt = this.add.text(cx, 524, 'PRESS  ANY  KEY  TO  BEGIN  YOUR  ESCAPE', {
            fontSize: '13px', fontFamily: 'monospace', color: '#bbbbbb',
        }).setOrigin(0.5);
        this.tweens.add({ targets: prompt, alpha: 0.08, duration: 750, yoyo: true, repeat: -1 });

        // === FLUORESCENT FLICKER ===
        const roomFlicker = () => {
            const count = Phaser.Math.Between(1, 4);
            let chain = Promise.resolve();
            for (let i = 0; i < count; i++) {
                const drop = Phaser.Math.FloatBetween(0.04, 0.5);
                const downMs = Phaser.Math.Between(20, 100);
                const holdMs = Phaser.Math.Between(0, 50);
                chain = chain.then(() => new Promise(resolve => {
                    this.tweens.add({
                        targets: flickerGroup, alpha: drop, duration: downMs,
                        yoyo: true, hold: holdMs, ease: 'Stepped',
                        onComplete: () => this.time.delayedCall(Phaser.Math.Between(15, 55), resolve),
                    });
                }));
            }
            chain.then(() => this.time.delayedCall(Phaser.Math.Between(900, 5000), roomFlicker));
        };
        this.time.delayedCall(700, roomFlicker);

        const titleFlicker = () => {
            this.tweens.add({
                targets: title,
                alpha: Phaser.Math.FloatBetween(0.25, 0.65),
                duration: Phaser.Math.Between(35, 85),
                yoyo: true, repeat: Phaser.Math.Between(0, 3),
                onComplete: () => this.time.delayedCall(Phaser.Math.Between(2000, 7000), titleFlicker),
            });
        };
        this.time.delayedCall(1500, titleFlicker);

        this.input.keyboard.once('keydown', () =>
            this.scene.start('GameScene', { newGame: true })
        );
    }
}
