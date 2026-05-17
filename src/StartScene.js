export default class StartScene extends Phaser.Scene {
    constructor() { super({ key: 'StartScene' }); }

    create() {
        const W = 800, H = 600, cx = W / 2;

        // Prison bars — left and right sides
        const bars = this.add.graphics();
        bars.fillStyle(0x181818, 1);
        [52, 88, 124].forEach(x => {
            bars.fillRect(x, 0, 13, H);
            bars.fillRect(W - x - 13, 0, 13, H);
        });

        // Scanlines
        const scan = this.add.graphics();
        scan.lineStyle(1, 0x000000, 0.18);
        for (let y = 0; y < H; y += 4) scan.lineBetween(0, y, W, y);

        // Title
        const title = this.add.text(cx, 72, 'ECHO  THIEF', {
            fontSize: '54px', fontFamily: 'monospace', color: '#ffffff',
        }).setOrigin(0.5);

        // Random flicker on title
        const flicker = () => {
            this.tweens.add({
                targets: title, alpha: 0.6, duration: 60,
                yoyo: true, repeat: Phaser.Math.Between(1, 3),
                onComplete: () => this.time.delayedCall(Phaser.Math.Between(1800, 5000), flicker),
            });
        };
        this.time.delayedCall(1200, flicker);

        // Double-rule dividers
        const rule = this.add.graphics();
        rule.lineStyle(1, 0x282828, 1);
        [[155, 116], [155, 122], [155, 464], [155, 470]].forEach(([x, y]) =>
            rule.lineBetween(x, y, W - x, y)
        );

        this.add.text(cx, 142, 'escape the prison  ·  be the silence', {
            fontSize: '12px', fontFamily: 'monospace', color: '#333333',
        }).setOrigin(0.5);

        // Info box
        this.add.graphics().lineStyle(1, 0x1f1f1f, 1).strokeRect(158, 178, W - 316, 278);

        // Corner ticks
        const tick = this.add.graphics();
        tick.lineStyle(2, 0x2a4a2a, 1);
        [[158,178],[W-158,178],[158,456],[W-158,456]].forEach(([x, y], i) => {
            const sx = i % 2 === 0 ? 1 : -1;
            const sy = i < 2 ? 1 : -1;
            tick.lineBetween(x, y, x + sx * 12, y);
            tick.lineBetween(x, y, x, y + sy * 12);
        });

        this.add.text(cx, 318, [
            'HOW  TO  PLAY',
            '',
            '  WASD   move  ·  moving makes noise  ·  noise alerts guards',
            '',
            'Guards are blind — but they hear every step.',
            'Reach the GREEN EXIT to escape each floor.',
            '',
            '20 floors  ·  each harder than the last',
        ].join('\n'), {
            fontSize: '13px', fontFamily: 'monospace',
            color: '#555555', align: 'center', lineSpacing: 7,
        }).setOrigin(0.5);

        // Exit key legend
        this.add.rectangle(cx - 38, 502, 14, 14, 0x00aa44).setOrigin(0.5);
        this.add.text(cx - 28, 502, '= exit zone', {
            fontSize: '12px', fontFamily: 'monospace', color: '#1a6633',
        }).setOrigin(0, 0.5);

        // Blinking prompt
        const prompt = this.add.text(cx, 546, 'PRESS  ANY  KEY  TO  START', {
            fontSize: '15px', fontFamily: 'monospace', color: '#777777',
        }).setOrigin(0.5);

        this.tweens.add({
            targets: prompt, alpha: 0.08,
            duration: 700, yoyo: true, repeat: -1,
        });

        this.input.keyboard.once('keydown', () =>
            this.scene.start('GameScene', { newGame: true })
        );
    }
}
