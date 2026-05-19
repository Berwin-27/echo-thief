import StartScene from './StartScene.js';

let player, walls, guards, wasd, darkOverlay, revealGfx, exit;
let exitX, exitY;
let currentLevel     = 1;
let transitioning    = false;
let audioCtx;
let lastPulse         = 0;
let lastHeartbeat     = 0;
let ambientNodes      = [];
let ambientTimer      = null;
let currentGlowRadius = 0;
let tensionOverlay;
let mapW, mapH;
let playerHP         = 100;
let lastDamageTime   = 0;
let attackCooldown   = 0;
let attackFlashUntil = 0;
let lastMoveX = 1,  lastMoveY = 0;
let alarmTime        = 0;
let alarmFired       = false;
let hpBarGfx, weaponLabel, alarmLabel, spaceKey;
let shiftKey;
let score = 0;
let levelStartTime = 0;
let scoreLabel;
let keycardCollected = false;
let keycardGrp, medkitGrp, grenadeGrp;
let playerGrenades = 0;
let grenadeKey;
let grenadeCountLabel;
let activeGrenades = [];
let guardKOs      = 0;
let anyAlerted    = false;
let lastKOTime    = 0;
let comboCount    = 1;
let guardRipples  = [];
let worldParticles = [];
let playerDead    = false;
let playerDeadAt  = 0;
let musicReactiveGain = null;
let alertDroneGain    = null;
let lastGuardSound    = 0;
let totalGuards    = 0;
let guardCountLabel;
let activePerks = [];
let furthestFloor = parseInt(localStorage.getItem('echoThiefFurthest') || '0');
let highScore = parseInt(localStorage.getItem('echoThiefHigh') || '0');
let switchGrp;
let switchTriggered = false;
let switchUntil = 0;
let levelGrid;
let koRings = [];
let stamina = 100;
let staminaExhausted = false;
let staminaBarGfx;
let hpNumLabel;
let minimapGfx;
let smokeGfx;
let prisonProps = [];
let lastDetectionTone = 0;
let footprints = [];
let lastFootprint = 0;
let radioWaves = [];
let levelLayout = { corrTop: 5, corrBot: 6, openTop: 7 };
let levelModifier  = null;
let noiseKey;
let playerNoisemakers = 0;
let activeNoisemakers = [];
let noisemakerGrp;
let noisemakerCountLabel;
let dragHintLabel;
let securityCameras = [];
let cameraGfx;
let fpMode = false, fpGfx, tabKey;
let crouchKey, crouching = false, crouchLabel;
let tripwires = [];

const LEVEL_MODIFIERS = [
    null, null, null, // weight toward no modifier
    { id: 'BLACKOUT',   name: 'BLACKOUT',   desc: 'reduced visibility' },
    { id: 'CROWDED',    name: 'CROWDED',     desc: '+2 extra guards' },
    { id: 'RIOT_DRILL', name: 'RIOT DRILL',  desc: 'guards start on alert' },
    { id: 'INSPECTION', name: 'INSPECTION',  desc: 'no medkits  ·  +2000 bonus' },
];

const TILE = 64;

function generateLevel(lvl) {
    // === CELL-BLOCK TOPOLOGY ===
    // Top zone: row of prison cells facing a central corridor
    // Mid zone: wide corridor (guard patrol lane)
    // Bottom zone: open area with scatter walls (far side of prison)

    const cellsInRow = Math.min(3 + Math.floor(lvl / 3), 7);
    const iW = 2;  // cell interior width (tiles)
    const iH = 2;  // cell interior height (tiles)
    const corrH = 2; // corridor height (tiles)

    // Column budget: border + cell-block (1 left wall + n*(iW+1) cols) + scatter + border
    const cellBlockW = 1 + cellsInRow * (iW + 1);
    const scatterW   = Math.max(8, Math.min(10 + lvl, 22));
    const cols = Math.min(1 + cellBlockW + scatterW + 1, 48);

    // Row budget: border + top cell block + corridor + scatter + border
    const topCellH = 1 + iH + 1; // top-wall + interior + door-wall = 4
    const scatterH = Math.max(8, Math.min(8 + Math.floor(lvl * 1.4), 26));
    const rows = Math.min(1 + topCellH + corrH + scatterH + 1, 36);

    // Derived row indices
    const cellTopWall = 1;
    const cellBotWall = cellTopWall + iH + 1; // = 4
    const corrTop     = cellBotWall + 1;       // = 5
    const corrBot     = corrTop + corrH - 1;   // = 6
    const openTop     = corrBot + 1;           // = 7
    const openBot     = rows - 2;

    // All walls to start
    const grid = Array.from({ length: rows }, () => Array(cols).fill(1));

    const carve = (r1, c1, r2, c2) => {
        for (let r = r1; r <= r2; r++)
            for (let c = c1; c <= c2; c++)
                if (r > 0 && c > 0 && r < rows - 1 && c < cols - 1) grid[r][c] = 0;
    };

    // --- TOP CELL BLOCK ---
    // Each cell: interior cols [cStart..cStart+iW-1], rows [cellTopWall+1..cellTopWall+iH]
    // Door: 1-tile opening at cellBotWall, center of cell
    let cStart = 2;
    for (let ci = 0; ci < cellsInRow && cStart + iW - 1 < cols - 1; ci++) {
        carve(cellTopWall + 1, cStart, cellTopWall + iH, cStart + iW - 1);
        const doorC = cStart + Math.floor(iW / 2);
        if (cellBotWall < rows - 1) grid[cellBotWall][doorC] = 0;
        cStart += iW + 1;
    }

    // --- MAIN CORRIDOR ---
    carve(corrTop, 1, corrBot, cols - 2);

    // --- OPEN SCATTER AREA ---
    if (openTop <= openBot) {
        carve(openTop, 1, openBot, cols - 2);

        // Scatter walls (avoids leftmost 2 cols to keep a clear run from corridor)
        const segCount = Math.min(3 + lvl * 2, 26);
        for (let i = 0; i < segCount; i++) {
            const sr = openTop + 1 + Math.floor(Math.random() * Math.max(1, openBot - openTop - 1));
            const sc = 4 + Math.floor(Math.random() * Math.max(1, cols - 6));
            if (sr <= 0 || sc <= 0 || sr >= rows - 1 || sc >= cols - 1) continue;
            const len = 2 + Math.floor(Math.random() * 4);
            const horiz = Math.random() < 0.55;
            for (let j = 0; j < len; j++) {
                const wr = horiz ? sr : Math.min(sr + j, openBot);
                const wc = horiz ? Math.min(sc + j, cols - 2) : sc;
                if (wr > openTop && wc > 1 && wr < rows - 1 && wc < cols - 1) grid[wr][wc] = 1;
            }
        }

        // Guarantee navigability: vertical spine + horizontal mid-row
        const vSpine = Math.max(2, Math.floor(cols * 0.28));
        for (let r = openTop; r <= openBot; r++) grid[r][vSpine] = 0;
        const hMid = Math.floor((openTop + openBot) / 2);
        for (let c = 1; c < cols - 1; c++) grid[hMid][c] = 0;

        // Optional second room (higher levels)
        if (lvl > 6) {
            const rr = openTop + 1 + Math.floor(Math.random() * Math.max(1, openBot - openTop - 3));
            const rc = Math.floor(cols * 0.5) + Math.floor(Math.random() * Math.max(1, Math.floor(cols * 0.3)));
            carve(rr, rc, Math.min(rr + 2, openBot), Math.min(rc + 3, cols - 2));
        }
    }

    // --- SPAWN: left side of the main corridor (easy exit, can see cells above) ---
    grid[corrTop][1] = 2;
    // Ensure 2-tile clear area around spawn
    grid[corrTop][2] = 0;
    if (corrTop + 1 <= corrBot) grid[corrTop + 1][1] = 0;

    // --- LIGHT SWITCH ---
    let ls = 0, lt = 0;
    while (ls < 1 && lt < 300) {
        lt++;
        const sr = openTop + Math.floor(Math.random() * Math.max(1, Math.floor((openBot - openTop) / 2)));
        const sc = 2 + Math.floor(Math.random() * Math.max(1, Math.floor(cols / 2) - 2));
        if (sr > 0 && sc > 0 && sr < rows - 1 && sc < cols - 1 && grid[sr][sc] === 0) {
            grid[sr][sc] = 9; ls++;
        }
    }

    // --- BFS: find all cells reachable from spawn (corrTop,1) ---
    const reachable = new Set();
    {
        const bfsQ = [[corrTop, 1]];
        reachable.add(`${corrTop},1`);
        while (bfsQ.length) {
            const [br, bc] = bfsQ.shift();
            for (const [dr, dc] of [[-1,0],[1,0],[0,-1],[0,1]]) {
                const nr = br + dr, nc = bc + dc;
                const key = `${nr},${nc}`;
                if (nr < 0 || nr >= rows || nc < 0 || nc >= cols) continue;
                if (reachable.has(key) || grid[nr][nc] === 1) continue;
                reachable.add(key);
                bfsQ.push([nr, nc]);
            }
        }
    }

    // --- EXIT: far half of scatter area, must be reachable from spawn ---
    let er, ec, t = 0;
    do {
        er = openTop + Math.floor(Math.random() * Math.max(1, openBot - openTop + 1));
        ec = Math.floor(cols / 2) + 1 + Math.floor(Math.random() * Math.max(1, Math.floor(cols / 2) - 2));
        t++;
    } while (t < 300 && (er <= 0 || ec <= 0 || er >= rows - 1 || ec >= cols - 1 || grid[er][ec] !== 0 || !reachable.has(`${er},${ec}`)));
    // Fallback: pick any reachable floor cell if far-half search fails
    if (t >= 300) {
        for (const key of reachable) {
            const [pr, pc] = key.split(',').map(Number);
            if (pc >= Math.floor(cols / 2) && grid[pr][pc] === 0) { er = pr; ec = pc; t = 0; break; }
        }
    }
    if (t < 300) grid[er][ec] = 3;

    // --- GUARDS: majority patrol corridor, rest scatter area ---
    const isBossFloor = lvl % 5 === 0;
    const numGuards   = isBossFloor ? 1 + Math.floor(lvl / 4) : 3 + Math.floor(lvl / 2);
    let placed = 0; t = 0;
    while (placed < numGuards && t < 600) {
        t++;
        const useCorr = placed < Math.ceil(numGuards * 0.55) && t < 250;
        const r = useCorr
            ? corrTop + Math.floor(Math.random() * corrH)
            : openTop + 1 + Math.floor(Math.random() * Math.max(1, openBot - openTop - 1));
        const c = 2 + Math.floor(Math.random() * (cols - 4));
        if (r <= 0 || c <= 0 || r >= rows - 1 || c >= cols - 1) continue;
        if (r <= cellBotWall + 1 && c <= 4) continue; // protect spawn cell
        if (grid[r][c] !== 0) continue;
        const lO = c > 1 && grid[r][c - 1] === 0;
        const rO = c < cols - 2 && grid[r][c + 1] === 0;
        if (useCorr && !(lO && rO)) continue;
        grid[r][c] = 4;
        placed++;
    }

    if (isBossFloor) {
        let bt = 0;
        while (bt < 600) {
            bt++;
            const br = corrTop + Math.floor(Math.random() * corrH);
            const bc = Math.floor(cols * 0.5) + Math.floor(Math.random() * Math.max(1, Math.floor(cols * 0.38)));
            if (bc > 0 && bc < cols - 1 && br > 0 && br < rows - 1 && grid[br] && grid[br][bc] === 0) {
                grid[br][bc] = 8; break;
            }
        }
    }

    // --- KEYCARD: far half scatter area, must be reachable from spawn ---
    let kr, kc, kt = 0;
    do {
        kr = openTop + Math.floor(Math.random() * Math.max(1, openBot - openTop + 1));
        kc = Math.floor(cols * 0.48) + Math.floor(Math.random() * Math.max(1, Math.floor(cols * 0.44)));
        kt++;
    } while (kt < 300 && (kr <= 0 || kc <= 0 || kr >= rows - 1 || kc >= cols - 1 || grid[kr][kc] !== 0 || !reachable.has(`${kr},${kc}`)));
    // Fallback: pick any reachable floor cell (not exit) if far-half search fails
    if (kt >= 300) {
        for (const key of reachable) {
            const [pr, pc] = key.split(',').map(Number);
            if (pc >= Math.floor(cols * 0.4) && grid[pr][pc] === 0) { kr = pr; kc = pc; kt = 0; break; }
        }
    }
    if (kt < 300) grid[kr][kc] = 5;

    // --- MEDKITS ---
    const numMeds = 1 + (lvl % 3 === 0 ? 1 : 0);
    let pm = 0, tm = 0;
    while (pm < numMeds && tm < 300) {
        tm++;
        const mr = 1 + Math.floor(Math.random() * (rows - 2));
        const mc = 2 + Math.floor(Math.random() * (cols - 4));
        if (mr > 0 && mc > 0 && mr < rows - 1 && mc < cols - 1 && grid[mr][mc] === 0) {
            grid[mr][mc] = 6; pm++;
        }
    }

    // --- GRENADES ---
    let pg = 0, tg = 0;
    while (pg < 1 && tg < 300) {
        tg++;
        const gr = 1 + Math.floor(Math.random() * (rows - 2));
        const gc = 2 + Math.floor(Math.random() * (cols - 4));
        if (gr > 0 && gc > 0 && gr < rows - 1 && gc < cols - 1 && grid[gr][gc] === 0) {
            grid[gr][gc] = 7; pg++;
        }
    }

    // --- NOISE-MAKERS (pebbles) ---
    let pnm = 0, tnm = 0;
    while (pnm < 2 && tnm < 300) {
        tnm++;
        const nnr = 1 + Math.floor(Math.random() * (rows - 2));
        const nnc = 2 + Math.floor(Math.random() * (cols - 4));
        if (nnr > 0 && nnc > 0 && nnr < rows - 1 && nnc < cols - 1 && grid[nnr][nnc] === 0) {
            grid[nnr][nnc] = 10; pnm++;
        }
    }

    levelLayout = { corrTop, corrBot, openTop };
    return grid;
}

const SPEED       = 250;
const LIGHT_RADIUS = 180;
const SOUND_RADIUS = 360;
const WALK_SPEED  = 105;
const WALK_LIGHT  = 105;
const WALK_SOUND  = 155;

const ALL_PERKS = [
    { id: 'WIDE_SWING',   name: 'WIDE SWING',   desc: 'attack range  +20%' },
    { id: 'SOFT_STEP',    name: 'SOFT STEP',    desc: 'walk speed  +10%' },
    { id: 'GRENADIER',    name: 'GRENADIER',    desc: 'start each floor with +1 grenade' },
    { id: 'RESILIENT',    name: 'RESILIENT',    desc: 'max HP → 110  ·  heal +10 on floor start' },
    { id: 'SHADOW',       name: 'SHADOW',       desc: 'walk sound radius  -15%' },
    { id: 'COMBO_MASTER', name: 'COMBO MASTER', desc: 'combo window  → 4 seconds' },
    { id: 'QUICK_HANDS',  name: 'QUICK HANDS',  desc: 'attack cooldown  -15%' },
    { id: 'SCAVENGER',    name: 'SCAVENGER',    desc: 'medkits restore 40 HP instead of 30' },
    { id: 'PHANTOM',      name: 'PHANTOM',      desc: '2s no-detection window after each KO' },
    { id: 'OPPORTUNIST',  name: 'OPPORTUNIST',  desc: 'backstabs always one-shot any guard' },
    { id: 'TRACKER',      name: 'TRACKER',      desc: 'guard footsteps visible at  2× range' },
    { id: 'NIGHT_VISION', name: 'NIGHT VISION', desc: 'sneak light radius  +30%' },
];

function showPerkPick(scene, onDone) {
    const available = ALL_PERKS.filter(p => !activePerks.includes(p.id));
    if (available.length === 0) { onDone(); return; }
    available.sort(() => Math.random() - 0.5);
    const choices = available.slice(0, Math.min(3, available.length));
    let picked = false;

    const bg = scene.add.graphics().setDepth(28).setScrollFactor(0);
    bg.fillStyle(0x000000, 0.96);
    bg.fillRect(0, 0, 800, 600);
    bg.fillStyle(0x050a08, 1);
    bg.fillRect(130, 100, 540, 400);
    bg.lineStyle(2, 0x1a3322, 1);
    bg.strokeRect(130, 100, 540, 400);
    bg.lineStyle(1, 0x0d1a10, 1);
    bg.strokeRect(135, 105, 530, 390);

    scene.add.text(400, 128, 'CHOOSE  AN  UPGRADE', {
        fontSize: '14px', fontFamily: 'monospace', color: '#88ffbb',
    }).setOrigin(0.5).setDepth(29).setScrollFactor(0);
    scene.add.text(400, 150, `floor ${currentLevel}  ·  score ${score}`, {
        fontSize: '10px', fontFamily: 'monospace', color: '#225533',
    }).setOrigin(0.5).setDepth(29).setScrollFactor(0);

    const cardGfxArr = [];
    choices.forEach((perk, i) => {
        const cy = 210 + i * 98;
        const cardBg = scene.add.graphics().setDepth(29).setScrollFactor(0);
        cardBg.fillStyle(0x0a1410, 1);
        cardBg.fillRect(155, cy - 38, 490, 82);
        cardBg.lineStyle(1, 0x1e3828, 1);
        cardBg.strokeRect(155, cy - 38, 490, 82);
        cardGfxArr.push(cardBg);

        scene.add.text(172, cy - 22, `[ ${i + 1} ]`, {
            fontSize: '12px', fontFamily: 'monospace', color: '#335544',
        }).setDepth(30).setScrollFactor(0);
        scene.add.text(218, cy - 22, perk.name, {
            fontSize: '15px', fontFamily: 'monospace', color: '#aaffcc',
        }).setDepth(30).setScrollFactor(0);
        scene.add.text(218, cy + 8, perk.desc, {
            fontSize: '11px', fontFamily: 'monospace', color: '#446655',
        }).setDepth(30).setScrollFactor(0);
        scene.add.text(620, cy - 9, `${i + 1}`, {
            fontSize: '28px', fontFamily: 'monospace', color: '#0f2018',
        }).setOrigin(0.5).setDepth(30).setScrollFactor(0);
    });

    if (activePerks.length > 0) {
        scene.add.text(400, 470, 'equipped: ' + activePerks.map(id => ALL_PERKS.find(p => p.id === id).name).join('  ·  '), {
            fontSize: '9px', fontFamily: 'monospace', color: '#1e3322',
        }).setOrigin(0.5).setDepth(29).setScrollFactor(0);
    }

    const handler = (event) => {
        if (picked) return;
        const idx = ['1', '2', '3'].indexOf(event.key);
        if (idx === -1 || idx >= choices.length) return;
        picked = true;
        // Flash selected card
        const selCard = cardGfxArr[idx];
        selCard.clear();
        selCard.fillStyle(0x1a3a28, 1);
        selCard.fillRect(155, 210 + idx * 98 - 38, 490, 82);
        activePerks.push(choices[idx].id);
        scene.time.delayedCall(160, () => {
            scene.input.keyboard.off('keydown', handler);
            onDone();
        });
    };
    scene.input.keyboard.on('keydown', handler);
}

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
    const ctx = getAudio();
    [0, 0.32].forEach(offset => {
        const osc = ctx.createOscillator(); const g = ctx.createGain();
        osc.connect(g); g.connect(ctx.destination);
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(330, ctx.currentTime + offset);
        osc.frequency.exponentialRampToValueAtTime(1100, ctx.currentTime + offset + 0.22);
        osc.frequency.exponentialRampToValueAtTime(130, ctx.currentTime + offset + 0.7);
        g.gain.setValueAtTime(0, ctx.currentTime + offset);
        g.gain.linearRampToValueAtTime(0.24, ctx.currentTime + offset + 0.03);
        g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + offset + 0.72);
        osc.start(ctx.currentTime + offset); osc.stop(ctx.currentTime + offset + 0.72);
    });
}

function playFootstep(walking) {
    const ctx = getAudio();
    if (walking) {
        const len = Math.floor(ctx.sampleRate * 0.035);
        const buf = ctx.createBuffer(1, len, ctx.sampleRate);
        const d = buf.getChannelData(0);
        for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len) * 0.35;
        const src = ctx.createBufferSource(); src.buffer = buf;
        const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 900;
        const g = ctx.createGain(); g.gain.value = 0.035;
        src.connect(hp); hp.connect(g); g.connect(ctx.destination); src.start();
    } else {
        const osc = ctx.createOscillator(); const og = ctx.createGain();
        osc.connect(og); og.connect(ctx.destination);
        osc.type = 'sine';
        osc.frequency.setValueAtTime(110, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(28, ctx.currentTime + 0.09);
        og.gain.setValueAtTime(0.12, ctx.currentTime);
        og.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.11);
        osc.start(); osc.stop(ctx.currentTime + 0.11);
        const len = Math.floor(ctx.sampleRate * 0.01);
        const buf = ctx.createBuffer(1, len, ctx.sampleRate);
        const d = buf.getChannelData(0);
        for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
        const src = ctx.createBufferSource(); src.buffer = buf;
        const f = ctx.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 2200;
        const g2 = ctx.createGain(); g2.gain.value = 0.06;
        src.connect(f); f.connect(g2); g2.connect(ctx.destination); src.start();
    }
}

function playVictory() {
    const ctx = getAudio();
    const delay = ctx.createDelay(1.5); delay.delayTime.value = 0.22;
    const fb = ctx.createGain(); fb.gain.value = 0.22;
    const wet = ctx.createGain(); wet.gain.value = 0.18;
    delay.connect(fb); fb.connect(delay); delay.connect(wet); wet.connect(ctx.destination);
    [523, 659, 784, 1047, 1319].forEach((freq, i) => {
        const t = ctx.currentTime + i * 0.14;
        const osc = ctx.createOscillator(); const gain = ctx.createGain();
        osc.connect(gain); gain.connect(ctx.destination); gain.connect(delay);
        osc.type = 'square';
        osc.frequency.setValueAtTime(freq, t);
        gain.gain.setValueAtTime(0.22, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.28);
        osc.start(t); osc.stop(t + 0.28);
    });
}

function playHeartbeat() {
    const ctx = getAudio();
    [0, 0.18].forEach(t => {
        const osc  = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain); gain.connect(ctx.destination);
        osc.type = 'sine';
        osc.frequency.setValueAtTime(65, ctx.currentTime + t);
        osc.frequency.exponentialRampToValueAtTime(18, ctx.currentTime + t + 0.15);
        gain.gain.setValueAtTime(0.45, ctx.currentTime + t);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + t + 0.2);
        osc.start(ctx.currentTime + t);
        osc.stop(ctx.currentTime + t + 0.22);
    });
}

function stopAmbientMusic() {
    clearTimeout(ambientTimer);
    ambientTimer = null;
    ambientNodes.forEach(n => { try { n.stop(); } catch(e) {} });
    ambientNodes = [];
    musicReactiveGain = null;
    alertDroneGain    = null;
}

function startAmbientMusic() {
    stopAmbientMusic();
    const ctx = getAudio();

    // Master lowpass → destination
    const masterLP = ctx.createBiquadFilter();
    masterLP.type = 'lowpass'; masterLP.frequency.value = 700;
    masterLP.connect(ctx.destination);

    // Reactive gain — smoothly adjusted during gameplay based on alert state
    const reactGain = ctx.createGain();
    reactGain.gain.value = 1.0;
    reactGain.connect(masterLP);
    musicReactiveGain = reactGain;

    // Feedback delay reverb
    const d1 = ctx.createDelay(2); d1.delayTime.value = 0.31;
    const d2 = ctx.createDelay(2); d2.delayTime.value = 0.57;
    const fb  = ctx.createGain(); fb.gain.value = 0.26;
    const lp  = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 500;
    const wet = ctx.createGain(); wet.gain.value = 0.20;
    d1.connect(d2); d2.connect(fb); fb.connect(lp); lp.connect(d1);
    d1.connect(wet); d2.connect(wet); wet.connect(reactGain);

    // Drone layers — all route through reactGain for reactive volume
    [
        [55,   'triangle', 0.055, 0.04, 0.25],
        [55.6, 'sine',     0.042, 0.06, 0.18],
        [82.4, 'sine',     0.026, 0.09, 0.40],
        [110,  'sine',     0.015, 0.13, 0.15],
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
        gain.connect(reactGain);
        gain.connect(d1);
        osc.start(); lfo.start();
        ambientNodes.push(osc, lfo);
    });

    // Alert tension drone — trembling tone, silent until guards spot you
    const aOsc  = ctx.createOscillator();
    const aLFO  = ctx.createOscillator();
    const aLFOG = ctx.createGain();
    const aGain = ctx.createGain();
    aOsc.type = 'sine'; aOsc.frequency.value = 185;
    aLFO.type = 'sine'; aLFO.frequency.value = 5.5; aLFOG.gain.value = 7;
    aLFO.connect(aLFOG); aLFOG.connect(aOsc.frequency);
    aGain.gain.setValueAtTime(0, ctx.currentTime);
    aOsc.connect(aGain); aGain.connect(reactGain);
    aOsc.start(); aLFO.start();
    alertDroneGain = aGain;
    ambientNodes.push(aOsc, aLFO);

    // Whisper tones — Phrygian palette, quieter so they don't spike
    const palette = [110, 116.5, 138.6, 155.6, 174.6, 196, 207.7, 233, 261.6, 277.2, 311.1];
    function whisper() {
        const freq = palette[Math.floor(Math.random() * palette.length)] * (Math.random() < 0.4 ? 2 : 1);
        const dur  = 3 + Math.random() * 5;
        const osc  = ctx.createOscillator();
        const g    = ctx.createGain();
        osc.type = 'sine'; osc.frequency.value = freq;
        g.gain.setValueAtTime(0, ctx.currentTime);
        g.gain.linearRampToValueAtTime(0.018, ctx.currentTime + dur * 0.3);
        g.gain.linearRampToValueAtTime(0, ctx.currentTime + dur);
        osc.connect(g); g.connect(d1);
        osc.start(); osc.stop(ctx.currentTime + dur);
        ambientTimer = setTimeout(whisper, 3500 + Math.random() * 5000);
    }
    whisper();

    // Dripping water — occasional cold plop
    function drip() {
        if (ambientNodes.length === 0) return; // music stopped
        const dOsc  = ctx.createOscillator();
        const dFilt = ctx.createBiquadFilter();
        const dGain = ctx.createGain();
        dFilt.type = 'bandpass'; dFilt.frequency.value = 1000 + Math.random() * 700; dFilt.Q.value = 11;
        dOsc.type = 'sine'; dOsc.frequency.value = 850 + Math.random() * 450;
        dOsc.connect(dFilt); dFilt.connect(dGain); dGain.connect(ctx.destination);
        dGain.gain.setValueAtTime(0, ctx.currentTime);
        dGain.gain.linearRampToValueAtTime(0.020 + Math.random() * 0.014, ctx.currentTime + 0.005);
        dGain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.13);
        dOsc.start(); dOsc.stop(ctx.currentTime + 0.14);
        setTimeout(drip, 3500 + Math.random() * 7000);
    }
    setTimeout(drip, 2000 + Math.random() * 4000);
}

function playGuardNearby(vol, pan) {
    const ctx    = getAudio();
    const len    = Math.floor(ctx.sampleRate * 0.06);
    const buf    = ctx.createBuffer(1, len, ctx.sampleRate);
    const data   = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src    = ctx.createBufferSource(); src.buffer = buf;
    const filt   = ctx.createBiquadFilter(); filt.type = 'lowpass'; filt.frequency.value = 200;
    const gain   = ctx.createGain(); gain.gain.value = vol;
    const panner = ctx.createStereoPanner(); panner.pan.value = Math.max(-1, Math.min(1, pan));
    src.connect(filt); filt.connect(gain); gain.connect(panner); panner.connect(ctx.destination);
    src.start();
}

function getWeapon(lvl) {
    if (lvl <= 5)  return { name: 'FIST',   range: 48,  cooldown: 650  };
    if (lvl <= 10) return { name: 'KNIFE',  range: 72,  cooldown: 520  };
    if (lvl <= 15) return { name: 'TASER',  range: 130, cooldown: 1100 };
    return              { name: 'PISTOL', range: 270, cooldown: 900  };
}
function patrolSpd(lvl) { return lvl >= 11 ? 150 : 113; }
function alertSpd(lvl)  { return lvl >= 11 ? 250 : 188; }
function koMs(lvl)      { return lvl >= 16 ? 4000 : 8000; }

function playAttackSound(name) {
    const ctx = getAudio();
    if (name === 'FIST') {
        const len = Math.floor(ctx.sampleRate * 0.06);
        const buf = ctx.createBuffer(1, len, ctx.sampleRate);
        const d   = buf.getChannelData(0);
        for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
        const src = ctx.createBufferSource(); src.buffer = buf;
        const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 220;
        const g = ctx.createGain(); g.gain.value = 0.75;
        src.connect(f); f.connect(g); g.connect(ctx.destination); src.start();
    } else if (name === 'KNIFE') {
        const osc = ctx.createOscillator(); const g = ctx.createGain();
        osc.connect(g); g.connect(ctx.destination);
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(900, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(90, ctx.currentTime + 0.09);
        g.gain.setValueAtTime(0.28, ctx.currentTime);
        g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.11);
        osc.start(); osc.stop(ctx.currentTime + 0.11);
    } else if (name === 'TASER') {
        const osc = ctx.createOscillator(); const g = ctx.createGain();
        osc.connect(g); g.connect(ctx.destination);
        osc.type = 'square';
        [0, 0.04, 0.08, 0.12, 0.16].forEach((t, i) =>
            osc.frequency.setValueAtTime(i % 2 ? 600 : 220, ctx.currentTime + t)
        );
        g.gain.setValueAtTime(0.22, ctx.currentTime);
        g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.22);
        osc.start(); osc.stop(ctx.currentTime + 0.22);
    } else {
        const osc = ctx.createOscillator(); const g = ctx.createGain();
        osc.connect(g); g.connect(ctx.destination);
        osc.type = 'sine';
        osc.frequency.setValueAtTime(180, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(40, ctx.currentTime + 0.07);
        g.gain.setValueAtTime(0.18, ctx.currentTime);
        g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.09);
        osc.start(); osc.stop(ctx.currentTime + 0.09);
    }
}

function playDamageSound() {
    const ctx = getAudio();
    const len = Math.floor(ctx.sampleRate * 0.14);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d   = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 1.5);
    const src  = ctx.createBufferSource(); src.buffer = buf;
    const filt = ctx.createBiquadFilter(); filt.type = 'bandpass'; filt.frequency.value = 280; filt.Q.value = 2;
    const gain = ctx.createGain(); gain.gain.value = 0.7;
    src.connect(filt); filt.connect(gain); gain.connect(ctx.destination); src.start();
    // High sting on top
    const osc = ctx.createOscillator(); const og = ctx.createGain();
    osc.connect(og); og.connect(ctx.destination);
    osc.type = 'sine';
    osc.frequency.setValueAtTime(440, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(110, ctx.currentTime + 0.1);
    og.gain.setValueAtTime(0.18, ctx.currentTime);
    og.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.12);
    osc.start(); osc.stop(ctx.currentTime + 0.12);
}

function playKOImpact() {
    const ctx = getAudio();
    const osc = ctx.createOscillator(); const og = ctx.createGain();
    osc.connect(og); og.connect(ctx.destination);
    osc.type = 'sine';
    osc.frequency.setValueAtTime(200, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(38, ctx.currentTime + 0.13);
    og.gain.setValueAtTime(0.52, ctx.currentTime);
    og.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);
    osc.start(); osc.stop(ctx.currentTime + 0.15);
    const len = Math.floor(ctx.sampleRate * 0.07);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.2);
    const src = ctx.createBufferSource(); src.buffer = buf;
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 1100; bp.Q.value = 0.9;
    const g2 = ctx.createGain(); g2.gain.value = 0.55;
    src.connect(bp); bp.connect(g2); g2.connect(ctx.destination); src.start();
}

function playSilentKO() {
    const ctx = getAudio();
    const len = Math.floor(ctx.sampleRate * 0.2);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.sin(Math.PI * i / len) * 0.45;
    const src = ctx.createBufferSource(); src.buffer = buf;
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 480;
    const g = ctx.createGain(); g.gain.value = 0.14;
    src.connect(lp); lp.connect(g); g.connect(ctx.destination); src.start();
}

function playSmokeGrenade() {
    const ctx = getAudio();
    const len = Math.floor(ctx.sampleRate * 0.35);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.sin(Math.PI * i / len) * 0.28;
    const src = ctx.createBufferSource(); src.buffer = buf;
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 550;
    const g = ctx.createGain(); g.gain.value = 0.22;
    src.connect(lp); lp.connect(g); g.connect(ctx.destination); src.start();
}

function spawnParticles(x, y, color, count = 6) {
    const born = Date.now();
    for (let i = 0; i < count; i++) {
        const ang = (Math.PI * 2 * i / count) + Math.random() * 0.9;
        const spd = 1.8 + Math.random() * 2.2;
        worldParticles.push({ x, y, vx: Math.cos(ang) * spd, vy: Math.sin(ang) * spd, color, born, life: 280 + Math.random() * 180 });
    }
}

function getLevelTheme(lvl) {
    if (lvl <= 5)  return { wall: 0xaaaaaa, glow: 0x999988, exit: 0x00aa44, tension: 0xcc0000, floor: 0x0e0e0e, floorLine: 0x161616, wallFill: 0x131313, wallLine: 0x1c1c1c };
    if (lvl <= 10) return { wall: 0x44aaff, glow: 0x2266bb, exit: 0x00ccff, tension: 0x0055cc, floor: 0x0c0c14, floorLine: 0x141420, wallFill: 0x101018, wallLine: 0x18182a };
    if (lvl <= 15) return { wall: 0x44cc77, glow: 0x22aa55, exit: 0x88ff44, tension: 0x009933, floor: 0x0a100c, floorLine: 0x121a14, wallFill: 0x0e140f, wallLine: 0x16201a };
    return              { wall: 0xff5522, glow: 0xcc2200, exit: 0xff8800, tension: 0xff3300, floor: 0x140c0c, floorLine: 0x1c1010, wallFill: 0x160e0e, wallLine: 0x221414 };
}

function getLevelLocation(lvl) {
    if (lvl <= 5)  return { area: 'CELL BLOCK D',  detail: `LEVEL B${lvl}` };
    if (lvl <= 10) return { area: 'SECURITY WING', detail: `SECTOR ${String.fromCharCode(64 + lvl - 5)}` };
    if (lvl <= 15) return { area: 'MEDICAL WARD',  detail: `UNIT ${lvl - 10}` };
    return              { area: 'MAX. SECURITY',  detail: `SUBLEVEL ${lvl - 15}` };
}

function generateProps(grid) {
    const props = [];
    const rows = grid.length, cols = grid[0].length;
    // Locate spawn tile dynamically
    let spawnX = TILE * 1.5, spawnY = TILE * 1.5;
    outer:
    for (let r = 0; r < rows; r++)
        for (let c = 0; c < cols; c++)
            if (grid[r][c] === 2) { spawnX = c * TILE + TILE / 2; spawnY = r * TILE + TILE / 2; break outer; }

    for (let r = 1; r < rows - 1; r++) {
        for (let c = 1; c < cols - 1; c++) {
            const wx = c * TILE + TILE / 2, wy = r * TILE + TILE / 2;
            if (grid[r][c] === 0) {
                if (Phaser.Math.Distance.Between(wx, wy, spawnX, spawnY) < TILE * 2.5) continue;
                const roll = Math.random();
                if      (roll < 0.038) props.push({ type: 'BED',    x: wx, y: wy });
                else if (roll < 0.058) props.push({ type: 'TOILET', x: wx, y: wy });
                else if (roll < 0.076) props.push({ type: 'CHAIR',  x: wx, y: wy });
                else if (roll < 0.091) props.push({ type: 'GRATE',  x: wx, y: wy });
                else if (roll < 0.106) props.push({ type: 'BUCKET', x: wx, y: wy });
                else if (roll < 0.120) props.push({ type: 'BLOOD',  x: wx, y: wy, ang: Math.random() * Math.PI * 2 });
            } else if (grid[r][c] === 1) {
                const wr = Math.random();
                if      (wr < 0.09) props.push({ type: 'CRACK', x: wx, y: wy, ang: Math.random() * Math.PI, len: 6 + Math.random() * 10 });
                else if (wr < 0.14) props.push({ type: 'PIPE',  x: wx, y: wy, horiz: Math.random() < 0.5 });
            }
        }
    }
    return props;
}

function drawPrisonProp(gfx, prop) {
    const { type, x, y } = prop;
    if (type === 'BED') {
        gfx.fillStyle(0x2a180a, 0.88);
        gfx.fillRect(x - 20, y - 13, 40, 26);
        gfx.fillStyle(0x2a3840, 0.8);
        gfx.fillRect(x - 15, y - 9, 30, 18);
        gfx.fillStyle(0x383838, 0.85);
        gfx.fillRect(x - 14, y - 11, 11, 9);
        gfx.lineStyle(1, 0x1a100a, 0.6);
        gfx.strokeRect(x - 20, y - 13, 40, 26);
    } else if (type === 'GRATE') {
        gfx.lineStyle(1, 0x161616, 0.75);
        gfx.strokeCircle(x, y, 11);
        for (let i = -1; i <= 1; i++) {
            gfx.lineBetween(x + i * 4, y - 11, x + i * 4, y + 11);
            gfx.lineBetween(x - 11, y + i * 4, x + 11, y + i * 4);
        }
    } else if (type === 'BUCKET') {
        gfx.fillStyle(0x1e2820, 0.85);
        gfx.fillRect(x - 7, y - 5, 14, 11);
        gfx.lineStyle(1, 0x2a3a2a, 0.7);
        gfx.strokeRect(x - 7, y - 5, 14, 11);
        gfx.lineStyle(1, 0x2a3a2a, 0.5);
        gfx.lineBetween(x - 7, y, x + 7, y);
    } else if (type === 'CRACK') {
        const ang = prop.ang || 0, len = prop.len || 8;
        gfx.lineStyle(1, 0x080808, 0.55);
        gfx.lineBetween(x + Math.cos(ang) * len, y + Math.sin(ang) * len,
                         x - Math.cos(ang) * len, y - Math.sin(ang) * len);
        gfx.lineBetween(x + Math.cos(ang + 0.45) * len * 0.55, y + Math.sin(ang + 0.45) * len * 0.55,
                         x + Math.cos(ang + 0.9)  * len * 0.85, y + Math.sin(ang + 0.9)  * len * 0.85);
    } else if (type === 'TOILET') {
        // Stainless steel prison toilet
        gfx.fillStyle(0x1e2222, 0.88);
        gfx.fillRect(x - 7, y - 4, 14, 11);
        gfx.fillStyle(0x252c2c, 0.7);
        gfx.fillRect(x - 5, y - 7, 10, 5);
        gfx.lineStyle(1, 0x2a3434, 0.5);
        gfx.strokeRect(x - 7, y - 4, 14, 11);
        gfx.fillStyle(0x0e1414, 0.65);
        gfx.fillCircle(x, y + 2, 4);
    } else if (type === 'CHAIR') {
        // Metal folding chair
        gfx.fillStyle(0x141414, 0.9);
        gfx.fillRect(x - 8, y - 2, 16, 6);
        gfx.fillStyle(0x101010, 0.85);
        gfx.fillRect(x - 7, y - 10, 14, 9);
        gfx.lineStyle(1, 0x1c1c1c, 0.45);
        gfx.strokeRect(x - 7, y - 10, 14, 9);
        gfx.lineStyle(1, 0x111111, 0.6);
        gfx.lineBetween(x - 7, y + 4, x - 7, y + 9);
        gfx.lineBetween(x + 7, y + 4, x + 7, y + 9);
    } else if (type === 'BLOOD') {
        const ang2 = prop.ang || 0;
        gfx.fillStyle(0x1e0000, 0.68);
        gfx.fillCircle(x, y, 7);
        gfx.fillStyle(0x160000, 0.5);
        gfx.fillCircle(x + Math.cos(ang2) * 6, y + Math.sin(ang2) * 6, 4);
        gfx.fillCircle(x + Math.cos(ang2 + 2.1) * 4, y + Math.sin(ang2 + 2.1) * 4, 3);
        gfx.fillStyle(0x240000, 0.3);
        gfx.fillCircle(x - Math.cos(ang2) * 8, y - Math.sin(ang2) * 8, 3);
    } else if (type === 'PIPE') {
        const isH = prop.horiz;
        gfx.lineStyle(3, 0x181818, 0.72);
        if (isH) {
            gfx.lineBetween(x - TILE / 2, y, x + TILE / 2, y);
            gfx.fillStyle(0x222222, 0.7);
            gfx.fillCircle(x, y, 4);
        } else {
            gfx.lineBetween(x, y - TILE / 2, x, y + TILE / 2);
            gfx.fillStyle(0x222222, 0.7);
            gfx.fillCircle(x, y, 4);
        }
        gfx.lineStyle(1, 0x242424, 0.4);
        if (isH) gfx.lineBetween(x - TILE / 2, y - 1, x + TILE / 2, y - 1);
        else     gfx.lineBetween(x - 1, y - TILE / 2, x - 1, y + TILE / 2);
    }
}

function playDetectionTone(suspicion) {
    if (!audioCtx) return;
    const ctx = audioCtx;
    const freq = 180 + suspicion * 640;
    const vol  = 0.018 + suspicion * 0.025;
    const osc  = ctx.createOscillator();
    const gain = ctx.createGain();
    const filt = ctx.createBiquadFilter();
    filt.type = 'bandpass'; filt.frequency.value = freq * 1.2;
    osc.connect(filt); filt.connect(gain); gain.connect(ctx.destination);
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, ctx.currentTime);
    gain.gain.setValueAtTime(vol, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.08);
    osc.start(); osc.stop(ctx.currentTime + 0.09);
}

function drawBossSprite(gfx, x, y, isAlert) {
    // Warden — white uniform, commanding build, peaked cap with gold trim
    // Boots — heavy, polished
    gfx.fillStyle(0x0c0c0c, 1);
    gfx.fillRect(x - 7, y + 10, 6, 4);
    gfx.fillRect(x + 1, y + 10, 6, 4);
    gfx.fillStyle(0x1a1a1a, 1);
    gfx.fillRect(x - 7, y + 13, 6, 1);
    gfx.fillRect(x + 1, y + 13, 6, 1);
    // Trousers — dark navy with stripe
    gfx.fillStyle(0x111128, 1);
    gfx.fillRect(x - 6, y + 4, 5, 7);
    gfx.fillRect(x + 1, y + 4, 5, 7);
    gfx.fillStyle(0xaa8800, 1);
    gfx.fillRect(x - 4, y + 4, 1, 7);
    gfx.fillRect(x + 3, y + 4, 1, 7);
    // Belt + gold buckle
    gfx.fillStyle(0x0c0c0c, 1);
    gfx.fillRect(x - 6, y + 3, 12, 2);
    gfx.fillStyle(0xcc9900, 1);
    gfx.fillRect(x - 1, y + 3, 3, 2);
    // Shirt body — cream/white (warden rank)
    gfx.fillStyle(0xddddcc, 1);
    gfx.fillRect(x - 6, y - 2, 12, 6);
    // Arms — big shoulders
    gfx.fillStyle(0xddddcc, 1);
    gfx.fillRect(x - 9, y - 2, 3, 5);
    gfx.fillRect(x + 6, y - 2, 3, 5);
    // Epaulettes — gold
    gfx.fillStyle(0xcc9900, 1);
    gfx.fillRect(x - 9, y - 2, 3, 2);
    gfx.fillRect(x + 6, y - 2, 3, 2);
    // Chest ribbon / medals
    gfx.fillStyle(0xcc2200, 1);
    gfx.fillRect(x - 4, y - 1, 3, 2);
    gfx.fillStyle(0x0044cc, 1);
    gfx.fillRect(x - 1, y - 1, 2, 2);
    gfx.fillStyle(0xcc9900, 1);
    gfx.fillRect(x + 1, y - 1, 3, 2);
    // Gold badge (large, authority)
    gfx.fillStyle(0xcc9900, 1);
    gfx.fillRect(x - 3, y + 1, 6, 4);
    gfx.fillStyle(0x111111, 1);
    gfx.fillRect(x - 2, y + 2, 4, 2);
    // Neck
    gfx.fillStyle(0xc8a080, 1);
    gfx.fillRect(x - 2, y - 3, 4, 2);
    // Tie
    gfx.fillStyle(0x330000, 1);
    gfx.fillRect(x - 1, y - 2, 2, 4);
    // Face — older, stern, heavy brow
    gfx.fillStyle(0xbf9070, 1);
    gfx.fillRect(x - 5, y - 9, 10, 7);
    // Heavy brow
    gfx.fillStyle(0x666040, 1);
    gfx.fillRect(x - 4, y - 9, 9, 2);
    // Eyes — glaring
    gfx.fillStyle(isAlert ? 0xff2200 : 0x222222, 1);
    gfx.fillRect(x - 4, y - 8, 3, 2);
    gfx.fillRect(x + 1, y - 8, 3, 2);
    // Frown / stern mouth
    gfx.fillStyle(0x8a6040, 1);
    gfx.fillRect(x - 3, y - 4, 6, 1);
    gfx.fillRect(x - 2, y - 3, 1, 1);
    gfx.fillRect(x + 1, y - 3, 1, 1);
    // Warden peaked cap — authoritative, large
    gfx.fillStyle(0x0f1128, 1);
    gfx.fillRect(x - 6, y - 16, 12, 7);
    // Cap band — gold
    gfx.fillStyle(0xcc9900, 1);
    gfx.fillRect(x - 6, y - 10, 12, 1);
    // Wide brim
    gfx.fillStyle(0x0f1128, 1);
    gfx.fillRect(x - 9, y - 10, 18, 2);
    gfx.fillStyle(0xcc9900, 1);
    gfx.fillRect(x - 9, y - 10, 18, 1);
    // Cap badge
    gfx.fillStyle(0xdd9900, 1);
    gfx.fillRect(x - 2, y - 15, 4, 3);
    gfx.fillStyle(0x111111, 1);
    gfx.fillRect(x - 1, y - 14, 2, 2);
}

function drawKOGuard(gfx, x, y) {
    // Fallen guard — lying horizontal
    gfx.fillStyle(0x1a1e35, 0.85);
    gfx.fillRect(x - 14, y - 4, 28, 7);
    // Cap
    gfx.fillStyle(0x0f1128, 0.9);
    gfx.fillRect(x - 14, y - 7, 11, 6);
    // Face
    gfx.fillStyle(0xbbaa99, 0.8);
    gfx.fillRect(x - 4, y - 5, 7, 4);
    // Belt
    gfx.fillStyle(0x0c0c0c, 0.7);
    gfx.fillRect(x - 14, y + 2, 28, 2);
    // ZZZ floats
    gfx.fillStyle(0xaaaaaa, 0.4);
    gfx.fillRect(x + 6, y - 13, 5, 2);
    gfx.fillRect(x + 9, y - 17, 5, 2);
    gfx.fillRect(x + 12, y - 21, 5, 2);
}

function drawGuardSprite(gfx, x, y, type, elite, isAlert) {
    const gType = type || 'STANDARD';

    // Boots
    gfx.fillStyle(0x111111, 1);
    gfx.fillRect(x - 6, y + 9, 5, 4);
    gfx.fillRect(x + 1, y + 9, 5, 4);
    gfx.fillStyle(0x1a1a1a, 1); // toe shine
    gfx.fillRect(x - 6, y + 9, 5, 1);
    gfx.fillRect(x + 1, y + 9, 5, 1);

    // Legs — uniform trousers
    const legCol = gType === 'RUNNER' ? 0x1e1e28 : gType === 'WATCHER' ? 0x131322 : 0x16182e;
    gfx.fillStyle(legCol, 1);
    gfx.fillRect(x - 5, y + 3, 4, 7);
    gfx.fillRect(x + 1, y + 3, 4, 7);

    // Belt
    gfx.fillStyle(0x0c0c0c, 1);
    gfx.fillRect(x - 5, y + 2, 10, 2);
    gfx.fillStyle(0x555555, 1);
    gfx.fillRect(x - 1, y + 2, 3, 2); // buckle

    // Hanging keys (standard + watcher)
    if (gType !== 'RUNNER') {
        gfx.fillStyle(0x887722, 0.9);
        gfx.fillRect(x + 4, y + 4, 1, 4);
        gfx.fillCircle(x + 4, y + 8, 1.5);
        gfx.fillRect(x + 3, y + 7, 3, 1);
    }

    // Body — uniform jacket
    const bodyCol = gType === 'WATCHER' ? 0x10121e : gType === 'RUNNER' ? 0x1c1c26 : 0x141628;
    gfx.fillStyle(bodyCol, 1);
    gfx.fillRect(x - 5, y - 2, 10, 5);

    // Arms
    if (gType === 'RUNNER') {
        gfx.fillStyle(bodyCol, 1);
        gfx.fillRect(x - 7, y - 1, 2, 4);
        gfx.fillRect(x + 5, y - 1, 2, 4);
    } else {
        gfx.fillStyle(bodyCol, 1);
        gfx.fillRect(x - 8, y - 2, 3, 5);
        gfx.fillRect(x + 5, y - 2, 3, 5);
    }

    // Baton (standard + watcher, on right hip)
    if (gType !== 'RUNNER') {
        gfx.fillStyle(0x160e06, 1);
        gfx.fillRect(x + 6, y, 2, 7);
        gfx.fillStyle(0x2a1a0c, 1);
        gfx.fillRect(x + 6, y, 2, 2);
    }

    // WATCHER: flashlight on left arm
    if (gType === 'WATCHER') {
        gfx.fillStyle(0x555566, 1);
        gfx.fillRect(x - 10, y, 3, 2);
        gfx.fillStyle(0xffffaa, 0.8);
        gfx.fillRect(x - 11, y, 2, 2);
    }

    // RUNNER: holstered radio on hip
    if (gType === 'RUNNER') {
        gfx.fillStyle(0x222222, 1);
        gfx.fillRect(x - 6, y + 2, 2, 4);
        gfx.fillStyle(0x444444, 1);
        gfx.fillRect(x - 6, y + 2, 2, 1);
    }

    // Tactical vest panel (dark center)
    gfx.fillStyle(0x0a0a12, 1);
    gfx.fillRect(x - 3, y - 1, 6, 4);

    // Badge — gold on chest
    gfx.fillStyle(0x998822, 1);
    gfx.fillRect(x - 2, y, 4, 2);

    // Neck
    gfx.fillStyle(0xcc9977, 1);
    gfx.fillRect(x - 2, y - 3, 4, 2);

    // Face
    gfx.fillStyle(0xcc9977, 1);
    gfx.fillRect(x - 4, y - 9, 8, 6);
    // Jaw shadow
    gfx.fillStyle(0xaa8060, 1);
    gfx.fillRect(x - 3, y - 4, 6, 1);

    // Eyes — small, alert or normal
    gfx.fillStyle(isAlert ? 0xff3300 : 0x222222, 1);
    gfx.fillRect(x - 3, y - 8, 2, 2);
    gfx.fillRect(x + 1, y - 8, 2, 2);

    // Cap — type-specific
    if (gType === 'WATCHER') {
        // Wide-brim flat-top ranger cap
        gfx.fillStyle(0x0c0e1c, 1);
        gfx.fillRect(x - 5, y - 14, 10, 5);
        gfx.fillRect(x - 8, y - 10, 16, 2);
        gfx.fillStyle(0x181828, 1);
        gfx.fillRect(x - 5, y - 14, 10, 1); // top seam
    } else if (gType === 'RUNNER') {
        // Simple skull cap / headband, no heavy gear
        gfx.fillStyle(0x181820, 1);
        gfx.fillRect(x - 4, y - 14, 8, 5);
        // Headband stripe
        gfx.fillStyle(0x333344, 1);
        gfx.fillRect(x - 4, y - 10, 8, 2);
    } else {
        // Standard prison officer peaked cap
        gfx.fillStyle(0x0e1020, 1);
        gfx.fillRect(x - 5, y - 14, 10, 5);
        gfx.fillRect(x - 7, y - 10, 14, 2); // brim
        gfx.fillStyle(0x181a2a, 1);
        gfx.fillRect(x - 5, y - 14, 10, 1); // top
    }

    // Badge on cap
    if (gType !== 'RUNNER') {
        gfx.fillStyle(0x887722, 1);
        gfx.fillRect(x - 1, y - 13, 3, 2);
    }

    // Elite overlay — riot visor + gold stripe
    if (elite) {
        gfx.fillStyle(0x22334a, 0.82);
        gfx.fillRect(x - 4, y - 10, 8, 4);
        gfx.fillStyle(0xcc9900, 1);
        gfx.fillRect(x - 5, y - 14, 10, 1);
    }
}

function drawPlayerSprite(gfx, x, y) {
    // Prisoner in makeshift stealth gear — orange jumpsuit base, dark tactical overlay

    // Boots — dark worn
    gfx.fillStyle(0x111111, 1);
    gfx.fillRect(x - 6, y + 10, 5, 3);
    gfx.fillRect(x + 1, y + 10, 5, 3);
    gfx.fillStyle(0x1c1c1c, 1);
    gfx.fillRect(x - 6, y + 10, 5, 1);
    gfx.fillRect(x + 1, y + 10, 5, 1);

    // Legs — orange prison jumpsuit, slightly torn
    gfx.fillStyle(0x994411, 1);
    gfx.fillRect(x - 5, y + 5, 4, 6);
    gfx.fillRect(x + 1, y + 5, 4, 6);
    // Tear mark on left leg
    gfx.fillStyle(0x772200, 1);
    gfx.fillRect(x - 4, y + 7, 2, 1);

    // Utility belt — scavenged
    gfx.fillStyle(0x2a2240, 1);
    gfx.fillRect(x - 5, y + 4, 10, 2);
    // Small pouch on belt
    gfx.fillStyle(0x1a1a30, 1);
    gfx.fillRect(x + 2, y + 4, 3, 2);

    // Body — orange jumpsuit covered by dark stealth vest
    gfx.fillStyle(0x993311, 1);       // jumpsuit showing on sides
    gfx.fillRect(x - 5, y - 2, 10, 7);
    gfx.fillStyle(0x12122a, 1);       // dark tactical overlay
    gfx.fillRect(x - 4, y - 2, 8, 7);

    // Arms — orange jumpsuit sleeves, rolled to forearms
    gfx.fillStyle(0x993311, 1);
    gfx.fillRect(x - 7, y - 1, 3, 4);
    gfx.fillRect(x + 4, y - 1, 3, 4);
    // Dark gloves
    gfx.fillStyle(0x111122, 1);
    gfx.fillRect(x - 7, y + 2, 3, 2);
    gfx.fillRect(x + 4, y + 2, 3, 2);

    // Chest straps on vest
    gfx.fillStyle(0x1e1e3a, 1);
    gfx.fillRect(x - 3, y - 1, 6, 1);
    gfx.fillRect(x - 3, y + 2, 6, 1);

    // Neck / lower face wrap
    gfx.fillStyle(0x0e0e22, 1);
    gfx.fillRect(x - 3, y - 3, 6, 2);

    // Face — wrapped in dark cloth, only eyes visible
    gfx.fillStyle(0x0c0c1e, 1);
    gfx.fillRect(x - 5, y - 9, 10, 7);

    // Hood — layered dark fabric
    gfx.fillStyle(0x0a0a18, 1);
    gfx.fillRect(x - 5, y - 12, 10, 4);
    gfx.fillStyle(0x080814, 1);
    gfx.fillRect(x - 4, y - 14, 8, 3);
    gfx.fillRect(x - 3, y - 16, 6, 3);

    // Glowing cyan eyes — the only visible feature
    gfx.fillStyle(0x00ffcc, 1);
    gfx.fillRect(x - 4, y - 7, 2, 2);
    gfx.fillRect(x + 2, y - 7, 2, 2);
    // Eye glow halo (subtle)
    gfx.fillStyle(0x00ddaa, 0.3);
    gfx.fillRect(x - 5, y - 8, 4, 4);
    gfx.fillRect(x + 1, y - 8, 4, 4);
}

// ── DDA raycaster ──────────────────────────────────────────────────────────────
function castRayDDA(grid, px, py, rdx, rdy) {
    const rows = grid.length, cols = grid[0]?.length || 0;
    let mapX = Math.floor(px / TILE), mapY = Math.floor(py / TILE);
    const ddx = Math.abs(rdx) < 1e-10 ? 1e30 : Math.abs(1 / rdx);
    const ddy = Math.abs(rdy) < 1e-10 ? 1e30 : Math.abs(1 / rdy);
    let stepX, sideX, stepY, sideY, side = 0;
    if (rdx < 0) { stepX = -1; sideX = (px / TILE - mapX) * ddx; }
    else         { stepX =  1; sideX = (mapX + 1 - px / TILE) * ddx; }
    if (rdy < 0) { stepY = -1; sideY = (py / TILE - mapY) * ddy; }
    else         { stepY =  1; sideY = (mapY + 1 - py / TILE) * ddy; }
    for (let i = 0; i < 80; i++) {
        if (sideX < sideY) { sideX += ddx; mapX += stepX; side = 0; }
        else               { sideY += ddy; mapY += stepY; side = 1; }
        if (mapX < 0 || mapY < 0 || mapX >= cols || mapY >= rows) break;
        if (grid[mapY][mapX] === 1) {
            const perp = side === 0
                ? (mapX - px / TILE + (1 - stepX) / 2) / rdx
                : (mapY - py / TILE + (1 - stepY) / 2) / rdy;
            return { dist: perp * TILE, side };
        }
    }
    return { dist: 9999, side: 0 };
}

function renderFP(gfx, now, theme) {
    const W = 800, H = 600, numCols = 160;
    const colW = W / numCols;
    if (!levelGrid) return;
    const px = player.x, py = player.y;
    const dLen = Math.hypot(lastMoveX, lastMoveY) || 1;
    const dirX = lastMoveX / dLen, dirY = lastMoveY / dLen;
    const planeX = -dirY * 0.66, planeY = dirX * 0.66;

    // Sky / floor
    gfx.fillStyle(0x080812, 1); gfx.fillRect(0, 0, W, H / 2);
    gfx.fillStyle(0x05050c, 1); gfx.fillRect(0, H / 2, W, H / 2);

    const zBuf = new Array(numCols).fill(9999);

    for (let col = 0; col < numCols; col++) {
        const cameraX = 2 * col / numCols - 1;
        const rdx = dirX + planeX * cameraX;
        const rdy = dirY + planeY * cameraX;
        const { dist, side } = castRayDDA(levelGrid, px, py, rdx, rdy);
        zBuf[col] = dist;
        const lineH = Math.min(H * 5, Math.floor(H * TILE / Math.max(1, dist)));
        const wallTop = Math.max(0, Math.floor((H - lineH) / 2));
        const fog = Math.max(0, 1 - dist / (TILE * 14));
        const shade = side === 1 ? fog * 0.55 : fog;
        const base = theme.wallFill || 0x223344;
        const wr = ((base >> 16) & 0xff) * shade;
        const wg = ((base >> 8) & 0xff) * shade;
        const wb = (base & 0xff) * shade;
        gfx.fillStyle(((Math.round(wr) << 16) | (Math.round(wg) << 8) | Math.round(wb)) || 0x08101e, 1);
        gfx.fillRect(col * colW, wallTop, colW, Math.min(H, wallTop + lineH) - wallTop);
    }

    // Guard sprites (billboard — far-to-near)
    const sprList = [];
    guards.getChildren().forEach(g => {
        const dx = g.x - px, dy = g.y - py;
        sprList.push({ dx, dy, dist2: dx * dx + dy * dy, g });
    });
    sprList.sort((a, b) => b.dist2 - a.dist2);
    const invDet = 1 / (planeX * dirY - dirX * planeY);
    sprList.forEach(({ dx, dy, g }) => {
        const tx = invDet * (dirY * dx - dirX * dy);
        const ty = invDet * (-planeY * dx + planeX * dy);
        if (ty <= 0.15) return;
        const perpPx = ty * TILE;
        const screenX = Math.floor(W / 2 * (1 + tx / ty));
        const sprH = Math.min(H * 4, Math.floor(H * TILE / Math.max(1, perpPx)));
        const sprW = Math.round(sprH * 0.55);
        const drawTop = Math.max(0, Math.floor((H - sprH) / 2));
        const drawBot = Math.min(H, drawTop + sprH);
        const drawLeft = screenX - Math.floor(sprW / 2);
        const startCol = Math.max(0, Math.floor(drawLeft / colW));
        const endCol   = Math.min(numCols - 1, Math.floor((drawLeft + sprW) / colW));
        const isKO    = g.koUntil > now;
        const isAlert = g.state === 'ALERT';
        const base = isKO ? 0x223311 : isAlert ? 0xcc2200 : g.boss ? 0x882200 : 0x1a4422;
        const fog = Math.max(0, 1 - perpPx / (TILE * 12));
        const sr = ((base >> 16) & 0xff) * fog;
        const sg = ((base >> 8) & 0xff) * fog;
        const sb = (base & 0xff) * fog;
        gfx.fillStyle(((Math.round(sr) << 16) | (Math.round(sg) << 8) | Math.round(sb)) || 0x0a100a, 1);
        for (let col = startCol; col <= endCol; col++) {
            if (perpPx < zBuf[col])
                gfx.fillRect(col * colW, drawTop, colW, drawBot - drawTop);
        }
        if (!isKO && perpPx < TILE * 8) {
            const eyeY = drawTop + Math.floor(sprH * 0.28);
            const esz  = Math.max(1, Math.round(sprH * 0.06));
            gfx.fillStyle(isAlert ? 0xff4400 : 0x00ffcc, Math.min(1, fog * 2));
            gfx.fillRect(screenX - esz * 2, eyeY, esz, esz);
            gfx.fillRect(screenX + esz,     eyeY, esz, esz);
        }
    });

    // Crosshair
    gfx.lineStyle(1, 0xffffff, 0.42);
    gfx.lineBetween(W / 2 - 10, H / 2, W / 2 - 4, H / 2);
    gfx.lineBetween(W / 2 + 4,  H / 2, W / 2 + 10, H / 2);
    gfx.lineBetween(W / 2, H / 2 - 10, W / 2, H / 2 - 4);
    gfx.lineBetween(W / 2, H / 2 + 4,  W / 2, H / 2 + 10);
    gfx.fillStyle(0xffffff, 0.22);
    gfx.fillRect(W / 2 - 1, H / 2 - 1, 2, 2);

    // Mode badge
    gfx.fillStyle(0x000000, 0.55);
    gfx.fillRect(W - 108, H - 23, 104, 19);
    gfx.lineStyle(1, 0x334455, 0.8);
    gfx.strokeRect(W - 108, H - 23, 104, 19);
}
// ──────────────────────────────────────────────────────────────────────────────

class GameScene extends Phaser.Scene {
    constructor() {
        super({ key: 'GameScene' });
    }

    preload() {}

    create(data) {
        if (data && data.newGame) { currentLevel = 1; score = 0; activePerks = []; playerHP = 100; startAmbientMusic(); }
        transitioning = false;
        const maxHP = activePerks.includes('RESILIENT') ? 110 : 100;
        if (!(data && data.newGame)) playerHP = Math.min(maxHP, playerHP + (activePerks.includes('RESILIENT') ? 60 : 50));
        attackCooldown = 0; attackFlashUntil = 0; alarmTime = 0; alarmFired = false;
        levelStartTime = Date.now();
        keycardCollected = false; playerGrenades = activePerks.includes('GRENADIER') ? 2 : 1; activeGrenades = [];
        guardKOs = 0; anyAlerted = false; lastKOTime = 0; comboCount = 1;
        guardRipples = []; worldParticles = []; playerDead = false; playerDeadAt = 0;
        totalGuards = 0; switchTriggered = false; switchUntil = 0; koRings = [];
        stamina = 100; staminaExhausted = false;
        footprints = []; radioWaves = [];
        playerNoisemakers = 1; activeNoisemakers = []; securityCameras = [];
        levelModifier = currentLevel <= 3 ? null :
            LEVEL_MODIFIERS[Math.floor(Math.random() * LEVEL_MODIFIERS.length)];

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
        levelGrid = level;
        prisonProps = generateProps(level);
        const cols  = level[0].length;
        const rows  = level.length;
        mapW = cols * TILE;
        mapH = rows * TILE;

        this.physics.world.setBounds(0, 0, mapW, mapH);

        walls          = this.physics.add.staticGroup();
        guards         = this.physics.add.group();
        keycardGrp     = this.physics.add.staticGroup();
        medkitGrp      = this.physics.add.staticGroup();
        grenadeGrp     = this.physics.add.staticGroup();
        switchGrp      = this.physics.add.staticGroup();
        noisemakerGrp  = this.physics.add.staticGroup();

        let elitePlaced = false;
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
                    player.setAlpha(0);
                } else if (cell === 4) {
                    const g = guards.create(x, y, 'guard');
                    g.state      = 'PATROL';
                    g.koUntil    = 0;
                    g.faceAngle  = 0;
                    g.hitsLeft   = 2;
                    g.suspicion  = 0;
                    g.setAlpha(0);
                    totalGuards++;
                    if (currentLevel >= 11 && !elitePlaced) {
                        g.elite    = true;
                        g.hitsLeft = 3;
                        elitePlaced = true;
                    }
                    // Guard variety
                    const roll = Math.random();
                    if (currentLevel >= 8 && roll < 0.22)       g.guardType = 'RUNNER';
                    else if (currentLevel >= 5 && roll < 0.40)  g.guardType = 'WATCHER';
                    else                                          g.guardType = 'STANDARD';
                    // Patrol waypoints along the same row
                    const wps = [];
                    for (let dc = -8; dc <= 8; dc += 2) {
                        const wc = c + dc;
                        if (wc > 0 && wc < cols - 1 && level[r][wc] === 0)
                            wps.push({ x: wc * TILE + TILE / 2, y });
                    }
                    g.waypoints    = wps.length >= 2 ? wps : null;
                    g.waypointIdx  = 0;
                    g.setVelocityX(patrolSpd(currentLevel));
                } else if (cell === 8) {
                    const g = guards.create(x, y, 'guard');
                    g.setVelocityX(Math.round(patrolSpd(currentLevel) * 1.45));
                    g.state     = 'PATROL';
                    g.koUntil   = 0;
                    g.faceAngle = 0;
                    g.hitsLeft  = 3;
                    g.boss      = true;
                    g.suspicion = 0;
                    g.setAlpha(0);
                    totalGuards++;
                    // Boss gets full-width corridor waypoints so it sweeps the whole floor
                    const bossWPs = [];
                    for (let dc = -(cols - 2); dc <= cols - 2; dc += 2) {
                        const wc = c + dc;
                        if (wc > 0 && wc < cols - 1 && level[r] && (level[r][wc] === 0 || level[r][wc] === 8))
                            bossWPs.push({ x: wc * TILE + TILE / 2, y: r * TILE + TILE / 2 });
                    }
                    if (bossWPs.length >= 2) { g.waypoints = bossWPs; g.waypointIdx = 0; }
                } else if (cell === 3) {
                    exit = this.add.rectangle(x, y, TILE, TILE, 0x00aa44, 0);
                    this.physics.add.existing(exit, true);
                    exitX = x; exitY = y;
                } else if (cell === 5) {
                    const kc = this.add.rectangle(x, y, TILE, TILE, 0x000000, 0);
                    this.physics.add.existing(kc, true);
                    keycardGrp.add(kc);
                } else if (cell === 6) {
                    const mc = this.add.rectangle(x, y, TILE, TILE, 0x000000, 0);
                    this.physics.add.existing(mc, true);
                    medkitGrp.add(mc);
                } else if (cell === 7) {
                    const gc = this.add.rectangle(x, y, TILE, TILE, 0x000000, 0);
                    this.physics.add.existing(gc, true);
                    grenadeGrp.add(gc);
                } else if (cell === 9) {
                    const sw = this.add.rectangle(x, y, TILE, TILE, 0x000000, 0);
                    this.physics.add.existing(sw, true);
                    switchGrp.add(sw);
                } else if (cell === 10) {
                    const nmPick = this.add.rectangle(x, y, TILE, TILE, 0x000000, 0);
                    this.physics.add.existing(nmPick, true);
                    noisemakerGrp.add(nmPick);
                }
            });
        });

        // --- POST-GRID MODIFIER EFFECTS ---
        if (levelModifier?.id === 'CROWDED') {
            const openCells = [];
            level.forEach((row, r) => row.forEach((cell, c) => {
                if (cell === 0 && r >= levelLayout.openTop) openCells.push({ r, c });
            }));
            for (let i = 0; i < 2 && openCells.length; i++) {
                const idx = Math.floor(Math.random() * openCells.length);
                const { r, c } = openCells.splice(idx, 1)[0];
                const xg = c * TILE + TILE / 2, yg = r * TILE + TILE / 2;
                const eg = guards.create(xg, yg, 'guard');
                eg.state = 'PATROL'; eg.koUntil = 0; eg.faceAngle = 0;
                eg.hitsLeft = 2; eg.suspicion = 0; eg.setAlpha(0);
                eg.setVelocityX(patrolSpd(currentLevel));
                totalGuards++;
            }
        }
        if (levelModifier?.id === 'RIOT_DRILL') {
            guards.getChildren().forEach(g => {
                g.state = 'ALERT'; g.heardX = player.x; g.heardY = player.y; g.wallSlip = null;
            });
            anyAlerted = true;
        }
        if (levelModifier?.id === 'INSPECTION') {
            medkitGrp.clear(true, true);
        }

        // --- SECURITY CAMERAS (corridor ceiling) ---
        const corrCeilRow = levelLayout.corrTop - 1;
        if (corrCeilRow > 0) {
            const cols2 = level[0].length;
            for (let sc = 5; sc < cols2 - 5; sc += 7 + Math.floor(Math.random() * 5)) {
                if (level[corrCeilRow] && level[corrCeilRow][sc] === 1) {
                    securityCameras.push({
                        x: sc * TILE + TILE / 2,
                        y: corrCeilRow * TILE + TILE / 2,
                        baseAngle: Math.PI / 2,
                        faceAngle: Math.PI / 2,
                        rotateSpeed: 0.38 + Math.random() * 0.28,
                        rotatePhase: Math.random() * Math.PI * 2,
                        fovRange: 170,
                        fovHalf: Math.PI / 4.5,
                        suspicion: 0,
                    });
                }
            }
        }

        // --- LASER TRIPWIRES (floors 7+) ---
        tripwires = [];
        if (currentLevel >= 7) {
            const numWires = Math.min(3, Math.floor((currentLevel - 5) / 2));
            const corrY1 = levelLayout.corrTop * TILE;
            const corrY2 = (levelLayout.corrBot + 1) * TILE;
            const gCols  = level[0].length;
            const placed = [];
            let attempts = 0;
            while (placed.length < numWires && attempts < 60) {
                attempts++;
                const wc = 5 + Math.floor(Math.random() * (gCols - 10));
                const wx = wc * TILE + TILE / 2;
                if (placed.some(px => Math.abs(px - wx) < TILE * 5)) continue;
                if (level[levelLayout.corrTop]?.[wc] === 1) continue;
                placed.push(wx);
                tripwires.push({ x: wx, y1: corrY1, y2: corrY2, triggered: false });
            }
        }

        this.physics.add.collider(player, walls);
        this.physics.add.collider(guards, walls);

        this.physics.add.overlap(player, guards, (pl, g) => {
            if (transitioning || g.koUntil > this.time.now) return;
            const t = Date.now();
            if (t - lastDamageTime < 1500) return;
            lastDamageTime = t;
            playerHP = Math.max(0, playerHP - 15);
            this.cameras.main.shake(200, 0.014);
            this.cameras.main.flash(100, 255, 40, 40);
            playDamageSound();
            spawnParticles(player.x, player.y, 0xff2222, 8);
            const dmgTxt = this.add.text(player.x, player.y - 10, '-15', {
                fontSize: '15px', fontFamily: 'monospace', color: '#ff4444',
            }).setDepth(20).setOrigin(0.5);
            this.tweens.add({ targets: dmgTxt, y: player.y - 55, alpha: 0, duration: 750, onComplete: () => dmgTxt.destroy() });
            if (playerHP <= 0 && !transitioning) {
                transitioning = true;
                playerDead = true; playerDeadAt = Date.now();
                this.cameras.main.shake(420, 0.026);
                this.cameras.main.flash(280, 255, 0, 0);
                this.time.delayedCall(900, () => {
                    if (currentLevel > furthestFloor) {
                        furthestFloor = currentLevel;
                        localStorage.setItem('echoThiefFurthest', furthestFloor);
                    }
                    if (score > highScore) { highScore = score; localStorage.setItem('echoThiefHigh', score); }
                    const _hist = JSON.parse(localStorage.getItem('echoThiefHistory') || '[]');
                    _hist.unshift({ floor: currentLevel, score, stealth: !anyAlerted ? 'GHOST' : 'SPOTTED' });
                    localStorage.setItem('echoThiefHistory', JSON.stringify(_hist.slice(0, 3)));

                    const dBg = this.add.graphics().setDepth(25).setScrollFactor(0);
                    dBg.fillStyle(0x000000, 0.95);
                    dBg.fillRect(0, 0, 800, 600);
                    dBg.fillStyle(0x0e0000, 1);
                    dBg.fillRect(145, 128, 510, 344);
                    dBg.lineStyle(2, 0x550000, 1);
                    dBg.strokeRect(145, 128, 510, 344);
                    dBg.lineStyle(1, 0x220000, 1);
                    dBg.strokeRect(150, 133, 500, 334);

                    this.add.text(400, 158, 'C A P T U R E D', {
                        fontSize: '24px', fontFamily: 'monospace', color: '#cc1111',
                    }).setOrigin(0.5).setDepth(26).setScrollFactor(0);
                    this.add.text(400, 190, '─────────────────────────────', {
                        fontSize: '10px', fontFamily: 'monospace', color: '#330000',
                    }).setOrigin(0.5).setDepth(26).setScrollFactor(0);

                    const stealthRating = !anyAlerted ? 'GHOST    ★ ★ ★' : guardKOs >= Math.ceil(totalGuards * 0.5) ? 'BRAWLER  ★ ★ ☆' : 'SPOTTED  ★ ☆ ☆';
                    this.add.text(400, 215, [
                        `floor reached    ${currentLevel}  /  20`,
                        `guards KO'd      ${guardKOs}  /  ${totalGuards}`,
                        `final score      ${score}`,
                        `stealth          ${stealthRating}`,
                        '',
                        `best score       ${highScore}`,
                        `furthest floor   ${furthestFloor}`,
                    ].join('\n'), {
                        fontSize: '12px', fontFamily: 'monospace', color: '#885555', lineSpacing: 9,
                    }).setOrigin(0.5, 0).setDepth(26).setScrollFactor(0);

                    this.add.text(400, 398, '─────────────────────────────', {
                        fontSize: '10px', fontFamily: 'monospace', color: '#330000',
                    }).setOrigin(0.5).setDepth(26).setScrollFactor(0);

                    const retryTxt = this.add.text(400, 420, 'PRESS  ANY  KEY  TO  TRY  AGAIN', {
                        fontSize: '12px', fontFamily: 'monospace', color: '#553333',
                    }).setOrigin(0.5).setDepth(26).setScrollFactor(0);
                    this.tweens.add({ targets: retryTxt, alpha: 0.25, yoyo: true, repeat: -1, duration: 750 });

                    this.input.keyboard.once('keydown', () => {
                        activePerks = []; currentLevel = 1; score = 0;
                        stopAmbientMusic();
                        this.scene.start('StartScene');
                    });
                });
            }
        });

        this.physics.add.overlap(player, keycardGrp, (pl, kc) => {
            if (keycardCollected || !kc.active) return;
            keycardCollected = true;
            kc.destroy();
            this.cameras.main.flash(200, 255, 220, 0);
            const txt = this.add.text(400, 300, 'KEYCARD  ACQUIRED', {
                fontSize: '18px', fontFamily: 'monospace', color: '#ffcc00',
            }).setOrigin(0.5).setDepth(20).setScrollFactor(0);
            this.tweens.add({ targets: txt, alpha: 0, duration: 1500, onComplete: () => txt.destroy() });
        });

        this.physics.add.overlap(player, medkitGrp, (pl, mc) => {
            if (!mc.active) return;
            mc.destroy();
            const mxHP = activePerks.includes('RESILIENT') ? 110 : 100;
            playerHP = Math.min(mxHP, playerHP + (activePerks.includes('SCAVENGER') ? 40 : 30));
            playTone(660, 0.18, 'sine', 0.14);
        });

        this.physics.add.overlap(player, grenadeGrp, (pl, gc) => {
            if (!gc.active) return;
            gc.destroy();
            playerGrenades++;
            playTone(280, 0.04, 'triangle', 0.07);
            playTone(420, 0.03, 'triangle', 0.05);
        });

        this.physics.add.overlap(player, noisemakerGrp, (pl, nm) => {
            if (!nm.active) return;
            nm.destroy();
            playerNoisemakers++;
            playTone(520, 0.05, 'sine', 0.06);
        });

        this.physics.add.overlap(player, switchGrp, (pl, sw) => {
            if (!sw.active || switchTriggered) return;
            const swX = sw.x, swY = sw.y;
            sw.destroy();
            switchTriggered = true;
            switchUntil = Date.now() + 5000;
            this.cameras.main.flash(180, 0, 0, 0);
            const swTxt = this.add.text(400, 300, 'LIGHTS  OUT', {
                fontSize: '20px', fontFamily: 'monospace', color: '#ffffff',
            }).setOrigin(0.5).setDepth(20).setScrollFactor(0);
            this.tweens.add({ targets: swTxt, alpha: 0, duration: 1400, onComplete: () => swTxt.destroy() });
            // Guards hear the click — those nearby rush to investigate the switch position
            this.time.delayedCall(450, () => {
                guards.getChildren().forEach(g => {
                    if (g.koUntil > this.time.now) return;
                    if (Phaser.Math.Distance.Between(swX, swY, g.x, g.y) < 340) {
                        g.state = 'ALERT'; g.heardX = swX; g.heardY = swY; g.wallSlip = null;
                        anyAlerted = true;
                    }
                });
            });
        });

        this.physics.add.overlap(player, exit, () => {
            if (transitioning) return;
            if (!keycardCollected) {
                if (Date.now() - lastDamageTime > 2000) {
                    lastDamageTime = Date.now();
                    playTone(220, 0.3, 'square', 0.1);
                    const lkTxt = this.add.text(400, 300, 'FIND  THE  KEYCARD', {
                        fontSize: '18px', fontFamily: 'monospace', color: '#ffcc00',
                    }).setOrigin(0.5).setDepth(20).setScrollFactor(0);
                    this.tweens.add({ targets: lkTxt, alpha: 0, duration: 1200, onComplete: () => lkTxt.destroy() });
                }
                return;
            }
            transitioning = true;
            this.physics.world.pause();

            const elapsed        = (Date.now() - levelStartTime) / 1000;
            const timeBonus      = Math.max(0, Math.round(3000 * (1 - elapsed / 60)));
            const stealthBonus   = anyAlerted ? 0 : 1000;
            const inspBonus      = levelModifier?.id === 'INSPECTION' ? 2000 : 0;
            const lvScore        = 500 + timeBonus + stealthBonus + inspBonus;
            score += lvScore;

            // Floor summary card
            const starsStr = stealthBonus > 0 ? '★ ★ ★  GHOST RUN' : anyAlerted ? '★ ☆ ☆  DETECTED' : '★ ★ ☆  CLEAN';
            const starsCol = stealthBonus > 0 ? '#44cc88' : anyAlerted ? '#cc4444' : '#ccaa44';
            const bg = this.add.graphics().setDepth(19).setScrollFactor(0);
            bg.fillStyle(0x000000, 0.92);
            bg.fillRect(0, 0, 800, 600);
            bg.fillStyle(0x080c08, 1);
            bg.fillRect(155, 138, 490, 324);
            bg.lineStyle(2, 0x224422, 1);
            bg.strokeRect(155, 138, 490, 324);
            bg.lineStyle(1, 0x112211, 1);
            bg.strokeRect(160, 143, 480, 314);

            this.add.text(400, 168, `FLOOR  ${currentLevel}  CLEARED`, {
                fontSize: '18px', fontFamily: 'monospace', color: '#aaffaa',
            }).setOrigin(0.5).setDepth(20).setScrollFactor(0);
            this.add.text(400, 196, starsStr, {
                fontSize: '13px', fontFamily: 'monospace', color: starsCol,
            }).setOrigin(0.5).setDepth(20).setScrollFactor(0);
            this.add.text(400, 218, '─────────────────────────────', {
                fontSize: '10px', fontFamily: 'monospace', color: '#1a2a1a',
            }).setOrigin(0.5).setDepth(20).setScrollFactor(0);

            const bodyLines = [
                `time           ${Math.round(elapsed)}s`,
                `guards KO'd    ${guardKOs}  /  ${totalGuards}`,
                levelModifier ? `modifier       ${levelModifier.name}` : null,
                '',
                `time bonus     +${timeBonus}`,
                stealthBonus > 0 ? `ghost bonus    +${stealthBonus}` : null,
                inspBonus > 0 ? `insp. bonus    +${inspBonus}` : null,
                `base           +500`,
                '',
                `floor total    +${lvScore}`,
            ].filter(l => l !== null).join('\n');

            this.add.text(400, 242, bodyLines, {
                fontSize: '12px', fontFamily: 'monospace', color: '#558855', lineSpacing: 9,
            }).setOrigin(0.5, 0).setDepth(20).setScrollFactor(0);

            this.time.delayedCall(3500, () => {
                playVictory();
                this.cameras.main.flash(500);
                if (currentLevel < 20) {
                    currentLevel++;
                    if (currentLevel % 3 === 0) {
                        showPerkPick(this, () => {
                            this.time.delayedCall(400, () => this.scene.restart({}));
                        });
                    } else {
                        this.time.delayedCall(400, () => this.scene.restart({}));
                    }
                } else {
                    this.time.delayedCall(500, () => {
                        if (score > highScore) { highScore = score; localStorage.setItem('echoThiefHigh', score); }
                        const _histW = JSON.parse(localStorage.getItem('echoThiefHistory') || '[]');
                        _histW.unshift({ floor: 20, score, stealth: !anyAlerted ? 'GHOST' : 'SPOTTED', escaped: true });
                        localStorage.setItem('echoThiefHistory', JSON.stringify(_histW.slice(0, 3)));
                        const wBg = this.add.graphics().setDepth(20).setScrollFactor(0);
                        wBg.fillStyle(0x000000, 1);
                        wBg.fillRect(0, 0, 800, 600);
                        wBg.fillStyle(0x020808, 1);
                        wBg.fillRect(100, 100, 600, 400);
                        wBg.lineStyle(2, 0x226622, 1);
                        wBg.strokeRect(100, 100, 600, 400);

                        this.add.text(400, 148, 'E S C A P E D', {
                            fontSize: '32px', fontFamily: 'monospace', color: '#44ff88',
                        }).setOrigin(0.5).setDepth(21).setScrollFactor(0);
                        this.add.text(400, 192, 'You made it out alive.', {
                            fontSize: '13px', fontFamily: 'monospace', color: '#336644',
                        }).setOrigin(0.5).setDepth(21).setScrollFactor(0);
                        this.add.text(400, 218, '─────────────────────────────────', {
                            fontSize: '10px', fontFamily: 'monospace', color: '#1a3320',
                        }).setOrigin(0.5).setDepth(21).setScrollFactor(0);
                        this.add.text(400, 268, `FINAL SCORE`, {
                            fontSize: '11px', fontFamily: 'monospace', color: '#335533',
                        }).setOrigin(0.5).setDepth(21).setScrollFactor(0);
                        this.add.text(400, 288, `${score}`, {
                            fontSize: '40px', fontFamily: 'monospace', color: '#ffdd44',
                        }).setOrigin(0.5).setDepth(21).setScrollFactor(0);
                        const isNewBest = score >= highScore;
                        this.add.text(400, 342, isNewBest ? `NEW BEST !` : `best  ${highScore}`, {
                            fontSize: '13px', fontFamily: 'monospace', color: isNewBest ? '#ffaa00' : '#2a4422',
                        }).setOrigin(0.5).setDepth(21).setScrollFactor(0);
                        this.add.text(400, 400, '─────────────────────────────────', {
                            fontSize: '10px', fontFamily: 'monospace', color: '#1a3320',
                        }).setOrigin(0.5).setDepth(21).setScrollFactor(0);
                        const playAgainTxt = this.add.text(400, 428, 'PRESS  ANY  KEY  TO  PLAY  AGAIN', {
                            fontSize: '12px', fontFamily: 'monospace', color: '#335533',
                        }).setOrigin(0.5).setDepth(21).setScrollFactor(0);
                        this.tweens.add({ targets: playAgainTxt, alpha: 0.25, yoyo: true, repeat: -1, duration: 800 });
                        this.input.keyboard.once('keydown', () => {
                            stopAmbientMusic();
                            this.scene.start('StartScene');
                        });
                    });
                }
            });
        });

        wasd = this.input.keyboard.addKeys({
            up:    Phaser.Input.Keyboard.KeyCodes.W,
            down:  Phaser.Input.Keyboard.KeyCodes.S,
            left:  Phaser.Input.Keyboard.KeyCodes.A,
            right: Phaser.Input.Keyboard.KeyCodes.D,
        });
        spaceKey   = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
        shiftKey   = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SHIFT);
        grenadeKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.E);
        noiseKey   = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.Q);
        crouchKey  = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.C);

        currentGlowRadius = 0;

        // Full-world black overlay — no mask needed
        darkOverlay = this.add.graphics();
        darkOverlay.setDepth(10);

        // Draws wall outlines, guards, player, exit above darkness, only within light radius
        revealGfx = this.add.graphics();
        revealGfx.setDepth(11);

        // Static HUD backing — dark gradient strips at top and bottom
        const hudBg = this.add.graphics().setDepth(14).setScrollFactor(0);
        hudBg.fillGradientStyle(0x000000, 0x000000, 0x000000, 0x000000, 0.82, 0.82, 0, 0);
        hudBg.fillRect(0, 0, 800, 58);
        hudBg.fillGradientStyle(0x000000, 0x000000, 0x000000, 0x000000, 0, 0, 0.72, 0.72);
        hudBg.fillRect(0, 542, 800, 58);

        tensionOverlay = this.add.graphics().setDepth(15).setScrollFactor(0);
        smokeGfx       = this.add.graphics().setDepth(13);
        cameraGfx      = this.add.graphics().setDepth(12); // world-space, cameras drawn below reveal layer
        fpGfx          = this.add.graphics().setDepth(13.5).setScrollFactor(0);
        tabKey         = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.TAB);
        this.input.keyboard.addCapture(Phaser.Input.Keyboard.KeyCodes.TAB);
        hpBarGfx       = this.add.graphics().setDepth(16).setScrollFactor(0);
        staminaBarGfx  = this.add.graphics().setDepth(16).setScrollFactor(0);
        minimapGfx     = this.add.graphics().setDepth(16).setScrollFactor(0);
        this.add.text(9, 4, 'HP', { fontSize: '9px', fontFamily: 'monospace', color: '#666666' })
            .setDepth(17).setScrollFactor(0);
        hpNumLabel = this.add.text(134, 4, '', { fontSize: '9px', fontFamily: 'monospace', color: '#999999' })
            .setOrigin(1, 0).setDepth(17).setScrollFactor(0);
        this.add.text(9, 18, 'SP', { fontSize: '9px', fontFamily: 'monospace', color: '#334466' })
            .setDepth(17).setScrollFactor(0);
        weaponLabel = this.add.text(786, 590, '', { fontSize: '11px', fontFamily: 'monospace', color: '#666666' })
            .setOrigin(1, 0.5).setDepth(16).setScrollFactor(0);
        scoreLabel = this.add.text(786, 8, 'SCORE  0', { fontSize: '11px', fontFamily: 'monospace', color: '#cccccc' })
            .setOrigin(1, 0).setDepth(16).setScrollFactor(0);
        alarmLabel = this.add.text(400, 26, '', { fontSize: '13px', fontFamily: 'monospace', color: '#ff4444' })
            .setOrigin(0.5).setDepth(16).setScrollFactor(0).setVisible(false);
        this.add.text(9, 27, 'TM', { fontSize: '9px', fontFamily: 'monospace', color: '#2a2a1a' })
            .setDepth(17).setScrollFactor(0);
        grenadeCountLabel  = this.add.text(14, 36, '', { fontSize: '9px', fontFamily: 'monospace', color: '#888888' })
            .setDepth(16).setScrollFactor(0);
        noisemakerCountLabel = this.add.text(14, 46, '', { fontSize: '9px', fontFamily: 'monospace', color: '#778866' })
            .setDepth(16).setScrollFactor(0);
        guardCountLabel = this.add.text(14, 590, '', { fontSize: '9px', fontFamily: 'monospace', color: '#666666' })
            .setDepth(16).setScrollFactor(0);
        this.add.text(692, 590, 'TAB: 3D VIEW', { fontSize: '9px', fontFamily: 'monospace', color: '#334455' })
            .setDepth(17).setScrollFactor(0);
        crouchLabel = this.add.text(400, 570, 'CROUCHING', {
            fontSize: '10px', fontFamily: 'monospace', color: '#44ff88',
        }).setOrigin(0.5).setDepth(16).setScrollFactor(0).setAlpha(0);
        dragHintLabel = this.add.text(400, 547, 'HOLD  E  TO  DRAG  BODY', {
            fontSize: '10px', fontFamily: 'monospace', color: '#556655',
        }).setOrigin(0.5).setDepth(16).setScrollFactor(0).setAlpha(0);
        if (levelModifier) {
            this.add.text(400, 42, `[ ${levelModifier.name} ]`, {
                fontSize: '10px', fontFamily: 'monospace', color: '#884400',
            }).setOrigin(0.5).setDepth(16).setScrollFactor(0);
        }

        // Camera follows player, bounded to the world
        this.cameras.main.startFollow(player, true);
        this.cameras.main.setBounds(0, 0, mapW, mapH);

        const loc = getLevelLocation(currentLevel);
        this.add.text(400, 6, loc.area, {
            fontSize: '11px', fontFamily: 'monospace', color: '#aaaaaa', alpha: 0.5,
        }).setOrigin(0.5).setDepth(12).setScrollFactor(0);
        this.add.text(400, 19, loc.detail, {
            fontSize: '9px', fontFamily: 'monospace', color: '#555555',
        }).setOrigin(0.5).setDepth(12).setScrollFactor(0);
        if (furthestFloor > currentLevel) {
            this.add.text(400, 30, `BEST  FLOOR  ${furthestFloor}`, {
                fontSize: '9px', fontFamily: 'monospace', color: '#2a2a2a',
            }).setOrigin(0.5).setDepth(12).setScrollFactor(0);
        }

        this.add.text(400, 592, 'SHIFT  sprint  ·  E  smoke  ·  Q  noise  ·  SPACE  attack / backstab', {
            fontSize: '10px', fontFamily: 'monospace', color: '#333333',
        }).setOrigin(0.5).setDepth(12).setScrollFactor(0);

        // Floor start flash (brief camera fade-in for dramatic effect)
        this.cameras.main.fadeIn(600, 0, 0, 0);

        // Floor 1 intro — player is locked in a cell
        if (currentLevel === 1) {
            this.physics.world.pause();
            const introBg = this.add.graphics().setDepth(25).setScrollFactor(0);
            introBg.fillStyle(0x000000, 0.9);
            introBg.fillRect(0, 0, 800, 600);
            const introTxt = this.add.text(400, 270, 'YOU ARE LOCKED DEEP\nINSIDE A PRISON.', {
                fontSize: '18px', fontFamily: 'monospace', color: '#cc3333',
                align: 'center', lineSpacing: 8,
            }).setOrigin(0.5).setDepth(26).setScrollFactor(0);
            const introSub = this.add.text(400, 340, 'FIND THE KEYCARD.  FIND THE EXIT.\nDO NOT GET CAUGHT.', {
                fontSize: '11px', fontFamily: 'monospace', color: '#444444',
                align: 'center', lineSpacing: 5,
            }).setOrigin(0.5).setDepth(26).setScrollFactor(0);
            this.time.delayedCall(2600, () => {
                this.tweens.add({
                    targets: [introBg, introTxt, introSub], alpha: 0, duration: 500,
                    onComplete: () => { introBg.destroy(); introTxt.destroy(); introSub.destroy(); this.physics.world.resume(); },
                });
            });
        }

        // Tier transition card on floors 6, 11, 16
        const tierNames = { 6: 'SECURITY WING', 11: 'THE LAB', 16: 'THE CORE' };
        if (tierNames[currentLevel]) {
            this.physics.world.pause();
            const tcBg = this.add.graphics().setDepth(25).setScrollFactor(0);
            tcBg.fillStyle(0x000000, 1);
            tcBg.fillRect(0, 0, 800, 600);
            const tcTitle = this.add.text(400, 252, tierNames[currentLevel], {
                fontSize: '46px', fontFamily: 'monospace', color: '#ffffff',
            }).setOrigin(0.5).setDepth(25).setScrollFactor(0);
            const tcSub = this.add.text(400, 320, `FLOORS  ${currentLevel} — ${currentLevel + 4}`, {
                fontSize: '15px', fontFamily: 'monospace', color: '#444444',
            }).setOrigin(0.5).setDepth(25).setScrollFactor(0);
            this.time.delayedCall(2200, () => {
                this.tweens.add({ targets: [tcBg, tcTitle, tcSub], alpha: 0, duration: 500,
                    onComplete: () => { tcBg.destroy(); tcTitle.destroy(); tcSub.destroy(); this.physics.world.resume(); }
                });
            });
        }

        // Modifier flash card (skipped on floors that already show a tier card)
        if (levelModifier && !tierNames[currentLevel] && currentLevel !== 1) {
            this.physics.world.pause();
            const mBg = this.add.graphics().setDepth(27).setScrollFactor(0);
            mBg.fillStyle(0x000000, 0.9);
            mBg.fillRect(0, 0, 800, 600);
            const mTitle = this.add.text(400, 256, levelModifier.name, {
                fontSize: '38px', fontFamily: 'monospace', color: '#ff8800',
            }).setOrigin(0.5).setDepth(28).setScrollFactor(0);
            const mDesc = this.add.text(400, 318, levelModifier.desc, {
                fontSize: '13px', fontFamily: 'monospace', color: '#554422',
            }).setOrigin(0.5).setDepth(28).setScrollFactor(0);
            this.time.delayedCall(1700, () => {
                this.tweens.add({ targets: [mBg, mTitle, mDesc], alpha: 0, duration: 400,
                    onComplete: () => { mBg.destroy(); mTitle.destroy(); mDesc.destroy(); this.physics.world.resume(); }
                });
            });
        }
    }

    update(time, delta) {
        player.setVelocity(0);
        const shiftHeld = shiftKey && shiftKey.isDown;
        const walkSpd = activePerks.includes('SOFT_STEP') ? Math.round(WALK_SPEED * 1.10) : WALK_SPEED;
        const walkSnd = activePerks.includes('SHADOW')    ? Math.round(WALK_SOUND * 0.85) : WALK_SOUND;
        const baseWalkLight = activePerks.includes('NIGHT_VISION') ? Math.round(WALK_LIGHT * 1.30) : WALK_LIGHT;

        // WASD = walk (quiet, no stamina drain); SHIFT = sprint (loud, drains stamina)
        const keyMoving = wasd.left.isDown || wasd.right.isDown || wasd.up.isDown || wasd.down.isDown;
        const dt = (delta || 16) / 1000;
        const sprinting = shiftHeld && keyMoving && !staminaExhausted;
        crouching = !!(crouchKey && crouchKey.isDown && !sprinting);
        const walking   = !shiftHeld; // walking = not holding shift
        if (sprinting) {
            stamina = Math.max(0, stamina - 38 * dt);
            if (stamina <= 0) staminaExhausted = true;
        } else {
            stamina = Math.min(100, stamina + 22 * dt);
            if (staminaExhausted && stamina >= 25) staminaExhausted = false;
        }

        const lightMult = levelModifier?.id === 'BLACKOUT' ? 0.52 : 1;
        const curSpeed = sprinting ? SPEED : crouching ? Math.round(walkSpd * 0.5) : walkSpd;
        const curLight = (sprinting ? LIGHT_RADIUS : crouching ? Math.round(baseWalkLight * 0.75) : baseWalkLight) * lightMult;
        const curSound = sprinting ? SOUND_RADIUS  : crouching ? Math.round(walkSnd * 0.28) : walkSnd;
        let dirX = 0, dirY = 0;
        if (wasd.left.isDown)  { player.setVelocityX(-curSpeed); dirX -= 1; }
        if (wasd.right.isDown) { player.setVelocityX( curSpeed); dirX += 1; }
        if (wasd.up.isDown)    { player.setVelocityY(-curSpeed); dirY -= 1; }
        if (wasd.down.isDown)  { player.setVelocityY( curSpeed); dirY += 1; }
        if (dirX !== 0 || dirY !== 0) {
            const len = Math.sqrt(dirX * dirX + dirY * dirY);
            lastMoveX = dirX / len; lastMoveY = dirY / len;
        }

        const isMoving   = dirX !== 0 || dirY !== 0;
        const glowTarget = isMoving ? curLight : 0;
        const now        = this.time.now;
        currentGlowRadius += (glowTarget - currentGlowRadius) * 0.14;

        // Sprint footprints
        if (sprinting && isMoving && Date.now() - lastFootprint > 290) {
            lastFootprint = Date.now();
            footprints.push({ x: player.x, y: player.y, ang: Math.atan2(lastMoveY, lastMoveX), born: Date.now() });
        }
        footprints = footprints.filter(fp => Date.now() - fp.born < 3500);

        // Sprint dust trail particles
        if (sprinting && isMoving && Math.random() < 0.38) {
            worldParticles.push({
                x: player.x + (Math.random() - 0.5) * 8,
                y: player.y + 9,
                vx: (Math.random() - 0.5) * 0.6,
                vy: 0.3 + Math.random() * 0.55,
                color: 0x2a2a2a,
                born: Date.now(),
                life: 280 + Math.random() * 200,
            });
        }

        // Attack (SPACE) — hits guards in front within weapon range
        if (Phaser.Input.Keyboard.JustDown(spaceKey) && now >= attackCooldown) {
            const wp = getWeapon(currentLevel);
            const atkRange = activePerks.includes('WIDE_SWING') ? Math.round(wp.range * 1.20) : wp.range;
            const atkCd    = activePerks.includes('QUICK_HANDS') ? Math.round(wp.cooldown * 0.85) : wp.cooldown;
            const comboWin = activePerks.includes('COMBO_MASTER') ? 4000 : 3000;
            attackCooldown   = now + atkCd;
            attackFlashUntil = now + 140;
            playAttackSound(wp.name);
            guards.getChildren().forEach(g => {
                if (g.koUntil > now) return;
                if (Phaser.Math.Distance.Between(player.x, player.y, g.x, g.y) > atkRange) return;

                // Backstab: player approaches from guard's rear arc (±80° of guard's back)
                const toGuardAng = Math.atan2(g.y - player.y, g.x - player.x);
                const rearDiff   = Math.abs(Phaser.Math.Angle.Wrap(toGuardAng - (g.faceAngle || 0)));
                const isBackstab = rearDiff < Math.PI * 0.44; // within ~80° of guard's back

                if (isBackstab && !g.boss) {
                    // Silent one-shot from behind — no siren, no contagion
                    g.hitsLeft = 0;
                } else {
                    g.hitsLeft = (g.hitsLeft || 1) - 1;
                }

                g.koFlash = now + 280;
                if (g.hitsLeft <= 0 || (isBackstab && activePerks.includes('OPPORTUNIST'))) {
                    g.hitsLeft = 0;
                    const koDur = koMs(currentLevel);
                    g.koUntil    = now + koDur;
                    g.koDuration = koDur;
                    g.state      = 'KO';
                    g.discovered = false;
                    g.setVelocity(0);
                    if (activePerks.includes('PHANTOM')) g.phantomUntil = now + 2000;
                    const timeSince = now - lastKOTime;
                    comboCount = timeSince < comboWin ? comboCount + 1 : 1;
                    lastKOTime = now;
                    const baseScore = g.boss ? 600 : g.elite ? 400 : 200;
                    const backstabBonus = isBackstab ? 1.5 : 1;
                    const mult = 1 + (comboCount - 1) * 0.5;
                    const scoreGain = Math.round(baseScore * mult * backstabBonus);
                    score += scoreGain;
                    guardKOs++;
                    const sgColor = isBackstab ? '#66ccff' : comboCount > 1 ? '#ffee44' : '#aaffaa';
                    const sgTxt = this.add.text(g.x - 18, g.y - 14, `+${scoreGain}`, {
                        fontSize: '13px', fontFamily: 'monospace', color: sgColor,
                    }).setDepth(20).setOrigin(0.5);
                    this.tweens.add({ targets: sgTxt, y: g.y - 56, alpha: 0, duration: 900, ease: 'Cubic.Out', onComplete: () => sgTxt.destroy() });
                    if (isBackstab) {
                        playSilentKO();
                        spawnParticles(g.x, g.y, 0x44aaff, 6);
                        koRings.push({ x: g.x, y: g.y, startAt: now, color: 0x44aaff });
                        this.cameras.main.shake(55, 0.008);
                        const st = this.add.text(g.x, g.y - 28, 'SILENT', {
                            fontSize: '11px', fontFamily: 'monospace', color: '#44aaff',
                        }).setDepth(20).setOrigin(0.5);
                        this.tweens.add({ targets: st, y: g.y - 60, alpha: 0, duration: 700, onComplete: () => st.destroy() });
                    } else {
                        playKOImpact();
                        spawnParticles(g.x, g.y, 0xffffff, 8);
                        koRings.push({ x: g.x, y: g.y, startAt: now, color: 0xffffff });
                        this.cameras.main.shake(110, 0.016);
                        this.cameras.main.flash(55, 255, 255, 255, false);
                    }
                    if (comboCount > 1) {
                        const ct = this.add.text(g.x, g.y - (isBackstab ? 48 : 28), `x${comboCount}  COMBO`, {
                            fontSize: '13px', fontFamily: 'monospace', color: '#ffcc00',
                        }).setDepth(20).setOrigin(0.5);
                        this.tweens.add({ targets: ct, y: g.y - 75, alpha: 0, duration: 700, onComplete: () => ct.destroy() });
                    }
                } else {
                    g.koUntil    = now + 500;
                    g.koDuration = 500;
                    g.state      = 'KO';
                    g.setVelocity(0);
                    spawnParticles(g.x, g.y, 0xff8800, 4);
                }
            });
        }

        // Body drag (hold E near KO'd guard) or throw grenade (tap E with no drag target)
        const dragTarget = guards.getChildren().find(g =>
            g.koUntil > now && Phaser.Math.Distance.Between(player.x, player.y, g.x, g.y) < 68
        );
        if (grenadeKey.isDown && dragTarget) {
            const dAng = Phaser.Math.Angle.Between(dragTarget.x, dragTarget.y, player.x, player.y);
            dragTarget.x += Math.cos(dAng) * 1.8;
            dragTarget.y += Math.sin(dAng) * 1.8;
        } else if (Phaser.Input.Keyboard.JustDown(grenadeKey) && !dragTarget && playerGrenades > 0) {
            playerGrenades--;
            // Smoke grenade — deploys around player, blocks guard sight/hearing for duration
            activeGrenades.push({ x: player.x, y: player.y, expiresAt: now + 4000, radius: curLight + 40 });
            playSmokeGrenade();
        }
        activeGrenades = activeGrenades.filter(ag => ag.expiresAt > now);
        if (dragHintLabel) dragHintLabel.setAlpha(dragTarget ? 0.8 : 0);

        // Noise-maker throw (Q) — rock pebble that distracts nearby guards
        if (Phaser.Input.Keyboard.JustDown(noiseKey) && playerNoisemakers > 0 && !transitioning) {
            playerNoisemakers--;
            const throwDist = 230;
            const tx = player.x + lastMoveX * throwDist;
            const ty = player.y + lastMoveY * throwDist;
            activeNoisemakers.push({
                fromX: player.x, fromY: player.y, x: player.x, y: player.y,
                targetX: tx, targetY: ty, thrownAt: now, landAt: now + 320, triggered: false,
            });
            playTone(580, 0.06, 'sine', 0.05);
        }
        activeNoisemakers.forEach(nm => {
            if (!nm.triggered) {
                const t = Math.min(1, (now - nm.thrownAt) / (nm.landAt - nm.thrownAt));
                nm.x = nm.fromX + (nm.targetX - nm.fromX) * t;
                nm.y = nm.fromY + (nm.targetY - nm.fromY) * t;
                if (now >= nm.landAt) {
                    nm.triggered = true;
                    playTone(160, 0.14, 'triangle', 0.14);
                    koRings.push({ x: nm.targetX, y: nm.targetY, startAt: now, color: 0xffaa44 });
                    guards.getChildren().forEach(g => {
                        if (g.koUntil > now) return;
                        if (Phaser.Math.Distance.Between(nm.targetX, nm.targetY, g.x, g.y) < 400) {
                            g.state = 'ALERT'; g.heardX = nm.targetX; g.heardY = nm.targetY; g.wallSlip = null;
                        }
                    });
                }
            }
        });
        activeNoisemakers = activeNoisemakers.filter(nm => !nm.triggered || now < nm.landAt + 1800);

        // Tripwire collision
        if (!transitioning && !playerDead) {
            const camDisabled = switchTriggered && Date.now() < switchUntil;
            tripwires.forEach(tw => {
                if (tw.triggered || camDisabled) return;
                if (Math.abs(player.x - tw.x) < 10 && player.y > tw.y1 + 2 && player.y < tw.y2 - 2) {
                    tw.triggered = true;
                    anyAlerted = true;
                    if (!alarmFired && !alarmTime) alarmTime = now + 800;
                    this.cameras.main.shake(300, 0.025);
                    this.cameras.main.flash(220, 255, 60, 0, false);
                    playAlertSiren();
                    guards.getChildren().forEach(g => {
                        if (g.koUntil > now) return;
                        g.state = 'ALERT'; g.heardX = tw.x; g.heardY = (tw.y1 + tw.y2) / 2; g.wallSlip = null;
                    });
                    const twTxt = this.add.text(tw.x, (tw.y1 + tw.y2) / 2 - 20, '⚡ TRIPWIRE', {
                        fontSize: '13px', fontFamily: 'monospace', color: '#ff4400',
                    }).setDepth(22).setOrigin(0.5);
                    this.tweens.add({ targets: twTxt, y: tw.y1 - 30, alpha: 0, duration: 900, onComplete: () => twTxt.destroy() });
                }
            });
        }

        // Guard AI
        guards.getChildren().forEach(g => {
            if (g.koUntil > now) { g.setVelocity(0); return; }
            if (g.state === 'KO') { g.state = 'PATROL'; g.koUntil = 0; g.discovered = false; g.setVelocityX(patrolSpd(currentLevel)); }

            if (g.body.velocity.x !== 0 || g.body.velocity.y !== 0)
                g.faceAngle = Math.atan2(g.body.velocity.y, g.body.velocity.x);

            const dp    = Phaser.Math.Distance.Between(player.x, player.y, g.x, g.y);
            const phantomSilent = activePerks.includes('PHANTOM') && g.phantomUntil && now < g.phantomUntil;
            // Smoke check — player inside any active smoke cloud blocks sight AND hearing
            const inSmoke = activeGrenades.some(ag =>
                Phaser.Math.Distance.Between(ag.x, ag.y, player.x, player.y) <= ag.radius ||
                Phaser.Math.Distance.Between(ag.x, ag.y, g.x, g.y) <= ag.radius
            );
            const heard = !phantomSilent && !inSmoke && isMoving && dp <= curSound;

            // FOV sight cone
            const lightsOut = switchTriggered && Date.now() < switchUntil;
            const fovRange = lightsOut ? 20 :
                g.boss ? 300 : g.elite ? 220 :
                g.guardType === 'WATCHER' ? 265 : g.guardType === 'RUNNER' ? 95 : 150;
            const fovHalf = lightsOut ? 0.1 :
                g.boss ? Math.PI * 5 / 12 : g.elite ? Math.PI / 3 :
                g.guardType === 'WATCHER' ? Math.PI * 7 / 12 : g.guardType === 'RUNNER' ? Math.PI / 7 : Math.PI / 4;
            const toPlAng  = Math.atan2(player.y - g.y, player.x - g.x);
            const angDiff  = Math.abs(Phaser.Math.Angle.Wrap(toPlAng - (g.faceAngle || 0)));
            const phantomActive = activePerks.includes('PHANTOM') && g.phantomUntil && now < g.phantomUntil;
            const seen     = !transitioning && !phantomActive && !inSmoke && dp < (crouching ? fovRange * 0.45 : fovRange) && angDiff < fovHalf;

            if (g.state === 'PATROL') {
                const basePs = patrolSpd(currentLevel);
                const ps = g.guardType === 'WATCHER' ? Math.round(basePs * 0.65) : basePs;
                if (g.waypoints && g.waypoints.length >= 2) {
                    const wp = g.waypoints[g.waypointIdx % g.waypoints.length];
                    const dWP = Phaser.Math.Distance.Between(g.x, g.y, wp.x, wp.y);
                    if (dWP < 18 || g.body.blocked.left || g.body.blocked.right || g.body.blocked.up || g.body.blocked.down) {
                        g.waypointIdx = (g.waypointIdx + 1) % g.waypoints.length;
                    }
                    const wpAng = Phaser.Math.Angle.Between(g.x, g.y, wp.x, wp.y);
                    g.setVelocity(Math.cos(wpAng) * ps, Math.sin(wpAng) * ps);
                } else {
                    if (g.body.blocked.left)  { g.setVelocityX(ps);  g.setVelocityY(0); }
                    if (g.body.blocked.right) { g.setVelocityX(-ps); g.setVelocityY(0); }
                    if (g.body.blocked.up)    { g.setVelocityY(ps);  g.setVelocityX(0); }
                    if (g.body.blocked.down)  { g.setVelocityY(-ps); g.setVelocityX(0); }
                }
                if (heard || seen) {
                    g.suspicion = Math.min(1, (g.suspicion || 0) + dt * (g.boss ? 3.2 : 1.5));
                    // Play rising detection tone
                    if (g.suspicion > 0.05 && Date.now() - lastDetectionTone > 90) {
                        lastDetectionTone = Date.now();
                        playDetectionTone(g.suspicion);
                    }
                } else {
                    g.suspicion = Math.max(0, (g.suspicion || 0) - dt * 1.0);
                }
                if (g.suspicion >= 1) {
                    g.suspicion = 0;
                    playAlertSiren(); anyAlerted = true;
                    this.cameras.main.shake(200, 0.022);
                    this.cameras.main.flash(160, 200, 0, 0, false);
                    const excl = this.add.text(g.x, g.y - 30, '!', {
                        fontSize: '26px', fontFamily: 'monospace', color: '#ff3333',
                    }).setDepth(22).setOrigin(0.5);
                    this.tweens.add({ targets: excl, y: g.y - 60, alpha: 0, duration: 650, ease: 'Cubic.Out', onComplete: () => excl.destroy() });
                    g.state = 'ALERT'; g.heardX = player.x; g.heardY = player.y; g.wallSlip = null; g.alertFlash = now + 900;
                    radioWaves.push({ x: g.x, y: g.y, startAt: now });
                    guards.getChildren().forEach(o => {
                        if (o === g || o.state !== 'PATROL' || o.koUntil > now) return;
                        // Boss warden call: alerts every guard on the floor instantly
                        if (g.boss || Phaser.Math.Distance.Between(g.x, g.y, o.x, o.y) < 280) {
                            o.state = 'ALERT'; o.heardX = player.x; o.heardY = player.y; o.wallSlip = null;
                            radioWaves.push({ x: g.x, y: g.y, startAt: now + 80 });
                        }
                    });
                    if (g.boss && !alarmFired && !alarmTime) alarmTime = now + 200;
                    else if (currentLevel >= 11 && !alarmFired && !alarmTime) alarmTime = now + 14000;
                }

                // Body discovery — patrolling guard stumbles on a KO'd body
                guards.getChildren().forEach(other => {
                    if (other === g || other.koUntil <= now || other.discovered) return;
                    if (Phaser.Math.Distance.Between(g.x, g.y, other.x, other.y) < 42) {
                        other.discovered = true;
                        if (!alarmFired && !alarmTime) { alarmTime = now + 2000; anyAlerted = true; }
                        g.state = 'ALERT'; g.heardX = player.x; g.heardY = player.y;
                        g.wallSlip = null; g.alertFlash = now + 900;
                        radioWaves.push({ x: g.x, y: g.y, startAt: now });
                        playAlertSiren();
                        this.cameras.main.flash(120, 255, 80, 0, false);
                        const bfTxt = this.add.text(g.x, g.y - 28, '!! BODY', {
                            fontSize: '12px', fontFamily: 'monospace', color: '#ff6600',
                        }).setDepth(22).setOrigin(0.5);
                        this.tweens.add({ targets: bfTxt, y: g.y - 64, alpha: 0, duration: 800, onComplete: () => bfTxt.destroy() });
                    }
                });
            } else if (g.state === 'ALERT') {
                if (heard || seen) { g.heardX = player.x; g.heardY = player.y; }
                const distToTarget = Phaser.Math.Distance.Between(g.x, g.y, g.heardX, g.heardY);
                if (distToTarget < 12) {
                    g.setVelocity(0); g.state = 'WAIT'; g.waitUntil = now + (g.boss ? 5000 : 2000);
                } else {
                    const ang = Phaser.Math.Angle.Between(g.x, g.y, g.heardX, g.heardY);
                    const as  = g.guardType === 'RUNNER' ? Math.round(alertSpd(currentLevel) * 1.8) : alertSpd(currentLevel);
                    if (!g.body.blocked.none) {
                        if (!g.wallSlip) g.wallSlip = Math.random() < 0.5 ? 1 : -1;
                        const slip = ang + g.wallSlip * Math.PI / 2;
                        g.setVelocity(Math.cos(slip) * as, Math.sin(slip) * as);
                    } else {
                        g.wallSlip = null;
                        g.setVelocity(Math.cos(ang) * as, Math.sin(ang) * as);
                    }
                }
            } else if (g.state === 'WAIT') {
                if (heard || seen) {
                    anyAlerted = true;
                    g.state = 'ALERT'; g.heardX = player.x; g.heardY = player.y;
                } else if (now >= g.waitUntil) {
                    g.state = 'PATROL'; g.setVelocityX(patrolSpd(currentLevel));
                }
            }
        });

        // Security cameras — rotate and detect player
        const playerInSmoke = activeGrenades.some(ag =>
            Phaser.Math.Distance.Between(ag.x, ag.y, player.x, player.y) <= ag.radius
        );
        securityCameras.forEach(cam => {
            const camDisabled = switchTriggered && Date.now() < switchUntil;
            if (!camDisabled) {
                cam.faceAngle = cam.baseAngle + Math.sin(now * 0.001 * cam.rotateSpeed + cam.rotatePhase) * (Math.PI / 3);
                const dcam = Phaser.Math.Distance.Between(player.x, player.y, cam.x, cam.y);
                const toPlAng2 = Math.atan2(player.y - cam.y, player.x - cam.x);
                const angDiff2 = Math.abs(Phaser.Math.Angle.Wrap(toPlAng2 - cam.faceAngle));
                const camSeen = !transitioning && !playerInSmoke && dcam < cam.fovRange && angDiff2 < cam.fovHalf;
                if (camSeen) {
                    cam.suspicion = Math.min(1, (cam.suspicion || 0) + dt * 2.2);
                    if (cam.suspicion >= 1 && !anyAlerted) {
                        cam.suspicion = 0;
                        anyAlerted = true;
                        playAlertSiren();
                        this.cameras.main.shake(200, 0.022);
                        this.cameras.main.flash(160, 200, 0, 0, false);
                        radioWaves.push({ x: cam.x, y: cam.y, startAt: now });
                        guards.getChildren().forEach(g => {
                            if (g.koUntil > now) return;
                            g.state = 'ALERT'; g.heardX = player.x; g.heardY = player.y; g.wallSlip = null;
                        });
                    }
                } else {
                    cam.suspicion = Math.max(0, (cam.suspicion || 0) - dt * 0.9);
                }
            } else {
                cam.suspicion = 0;
            }
        });

        // Guard footstep ripples
        guards.getChildren().forEach(g => {
            if (g.koUntil > now) return;
            if (g.body.velocity.x !== 0 || g.body.velocity.y !== 0) {
                if (now - (g.lastRipple || 0) > 480) {
                    g.lastRipple = now;
                    guardRipples.push({ x: g.x, y: g.y, startAt: now });
                }
            }
        });
        guardRipples = guardRipples.filter(rp => now - rp.startAt < 800);

        // Update world particles
        worldParticles.forEach(p => { p.x += p.vx; p.y += p.vy; p.vx *= 0.88; p.vy *= 0.88; });
        worldParticles = worldParticles.filter(p => Date.now() - p.born < p.life);

        // Alarm fires (lvl 11+): all non-KO guards instantly rush player
        if (alarmTime && now >= alarmTime) {
            alarmTime = 0; alarmFired = true;
            this.cameras.main.shake(500, 0.022);
            this.cameras.main.flash(400, 255, 0, 0);
            playAlertSiren();
            guards.getChildren().forEach(g => {
                if (g.koUntil > now) return;
                g.state = 'ALERT'; g.heardX = player.x; g.heardY = player.y; g.wallSlip = null;
            });
        }

        const theme = getLevelTheme(currentLevel);

        if (Phaser.Input.Keyboard.JustDown(tabKey) && !transitioning && !playerDead) fpMode = !fpMode;
        if (fpMode) { fpGfx.clear(); renderFP(fpGfx, now, theme); }
        else fpGfx.clear();

        darkOverlay.clear();
        darkOverlay.fillStyle(0x000000, 1);
        darkOverlay.fillRect(0, 0, mapW, mapH);

        // Smoke grenades — own world-space layer, always visible regardless of player light
        smokeGfx.clear();
        activeGrenades.forEach(ag => {
            const timeLeft = (ag.expiresAt - now) / 4000;
            if (timeLeft <= 0) return;
            const fadeIn  = Math.min(1, (1 - timeLeft) / 0.08);
            const fadeOut = timeLeft < 0.18 ? timeLeft / 0.18 : 1;
            const alpha   = fadeIn * fadeOut;
            const expand  = 0.55 + fadeIn * 0.45;

            smokeGfx.fillStyle(0xaab8c0, alpha * 0.86);
            smokeGfx.fillCircle(ag.x, ag.y, ag.radius * expand);
            smokeGfx.fillStyle(0xd0dce0, alpha * 0.76);
            smokeGfx.fillCircle(ag.x, ag.y, ag.radius * expand * 0.68);
            smokeGfx.fillStyle(0xe8eff2, alpha * 0.6);
            smokeGfx.fillCircle(ag.x, ag.y, ag.radius * expand * 0.4);
            for (let si = 0; si < 10; si++) {
                const sa = now * 0.0005 + si * (Math.PI * 2 / 10);
                const sr = ag.radius * expand * (0.35 + 0.3 * Math.sin(now * 0.0009 + si * 1.5));
                smokeGfx.fillStyle(0xbccbd4, alpha * (0.4 + 0.2 * Math.sin(now * 0.0012 + si)));
                smokeGfx.fillCircle(ag.x + Math.cos(sa) * sr, ag.y + Math.sin(sa) * sr, 14 + si * 2.5);
            }
            smokeGfx.lineStyle(3, 0x8898a4, alpha * 0.5);
            smokeGfx.strokeCircle(ag.x, ag.y, ag.radius * expand);
        });

        revealGfx.clear();
        if (currentGlowRadius > 2) {
            const r = Math.round(currentGlowRadius);

            // Two-tier tile rendering: full detail in light, dim silhouette beyond
            const ambR = r * 2.8;
            if (levelGrid) {
                for (let tr = 0; tr < levelGrid.length; tr++) {
                    for (let tc = 0; tc < levelGrid[tr].length; tc++) {
                        const tx = tc * TILE + TILE / 2;
                        const ty = tr * TILE + TILE / 2;
                        const dist = Phaser.Math.Distance.Between(player.x, player.y, tx, ty);
                        if (dist > ambR + TILE) continue;
                        const inLight = dist <= r + TILE;
                        if (levelGrid[tr][tc] === 1) {
                            if (inLight) {
                                // Full-lit wall: stone block fill + horizontal mortar line + vertical bar
                                revealGfx.fillStyle(theme.wallFill, 1);
                                revealGfx.fillRect(tx - TILE / 2, ty - TILE / 2, TILE, TILE);
                                revealGfx.lineStyle(1, theme.wallLine, 0.9);
                                revealGfx.lineBetween(tx - TILE / 2, ty, tx + TILE / 2, ty);
                                const bOff = (tr % 2) * (TILE / 2);
                                revealGfx.lineBetween(tx - TILE / 2 + bOff, ty - TILE / 2, tx - TILE / 2 + bOff, ty + TILE / 2);
                                // Cell-block zone: dense bars (12px apart); scatter zone: wider bars (18px)
                                const inCellZone = tr < levelLayout.corrTop;
                                const barStep = inCellZone ? 12 : 18;
                                const barAlpha = inCellZone ? 0.35 : 0.22;
                                revealGfx.lineStyle(2, 0x000000, barAlpha);
                                for (let bx = tx - TILE / 2 + barStep; bx < tx + TILE / 2; bx += barStep)
                                    revealGfx.lineBetween(bx, ty - TILE / 2, bx, ty + TILE / 2);
                                // Stone cracks — seeded deterministically per tile
                                const crSeed = (tr * 7919 + tc * 1013) & 0xffff;
                                if (crSeed % 3 > 0) {
                                    const half = TILE / 2 - 3;
                                    const crX0 = tx - half + (crSeed % (TILE - 6));
                                    const crY0 = ty - half + ((crSeed >> 5) % (TILE - 6));
                                    const crAng = ((crSeed >> 9) & 7) * (Math.PI / 8);
                                    const crLen = 8 + ((crSeed >> 4) & 15);
                                    const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
                                    const crX1 = clamp(crX0 + Math.cos(crAng) * crLen, tx - half, tx + half);
                                    const crY1 = clamp(crY0 + Math.sin(crAng) * crLen, ty - half, ty + half);
                                    revealGfx.lineStyle(1, 0x000000, 0.42);
                                    revealGfx.lineBetween(crX0, crY0, crX1, crY1);
                                    if ((crSeed & 3) !== 0) {
                                        const brAng = crAng + 0.8 + ((crSeed >> 12) & 3) * 0.25;
                                        const brLen = 4 + ((crSeed >> 8) & 9);
                                        const brX1 = clamp(crX1 + Math.cos(brAng) * brLen, tx - half, tx + half);
                                        const brY1 = clamp(crY1 + Math.sin(brAng) * brLen, ty - half, ty + half);
                                        revealGfx.lineBetween(crX1, crY1, brX1, brY1);
                                    }
                                }
                            } else {
                                // Dim silhouette
                                const fade = Math.max(0, 1 - (dist - r - TILE) / (ambR - r)) * 0.22;
                                revealGfx.fillStyle(theme.wallFill, fade);
                                revealGfx.fillRect(tx - TILE / 2, ty - TILE / 2, TILE, TILE);
                            }
                        } else {
                            if (inLight) {
                                // Full-lit floor: concrete fill + grid seams
                                revealGfx.fillStyle(theme.floor, 0.95);
                                revealGfx.fillRect(tx - TILE / 2, ty - TILE / 2, TILE, TILE);
                                revealGfx.lineStyle(1, theme.floorLine, 0.35);
                                revealGfx.strokeRect(tx - TILE / 2, ty - TILE / 2, TILE, TILE);
                            } else {
                                // Dim floor silhouette
                                const fade = Math.max(0, 1 - (dist - r - TILE) / (ambR - r)) * 0.14;
                                revealGfx.fillStyle(theme.floor, fade);
                                revealGfx.fillRect(tx - TILE / 2, ty - TILE / 2, TILE, TILE);
                            }
                        }
                    }
                }
            }

            // Soft ambient glow rings layered over the dim silhouette
            revealGfx.fillStyle(theme.glow, 0.018);
            revealGfx.fillCircle(player.x, player.y, r * 1.5);

            // Multi-ring gradient light falloff
            [[1.0, 0.03], [0.75, 0.045], [0.5, 0.06], [0.3, 0.07], [0.15, 0.08]].forEach(([frac, a]) => {
                revealGfx.fillStyle(theme.glow, a);
                revealGfx.fillCircle(player.x, player.y, Math.round(r * frac));
            });

            // Directional light beam in movement direction
            if (isMoving) {
                const beamLen = r * 0.65;
                revealGfx.fillStyle(theme.glow, 0.07);
                revealGfx.fillTriangle(
                    player.x - lastMoveY * 14, player.y + lastMoveX * 14,
                    player.x + lastMoveY * 14, player.y - lastMoveX * 14,
                    player.x + lastMoveX * beamLen, player.y + lastMoveY * beamLen
                );
            }

            revealGfx.lineStyle(1.5, theme.wall, 0.85);
            walls.getChildren().forEach(w => {
                if (Phaser.Math.Distance.Between(player.x, player.y, w.x, w.y) < r + TILE * 0.75)
                    revealGfx.strokeRect(w.x - TILE / 2, w.y - TILE / 2, TILE, TILE);
            });

            // Pickups
            keycardGrp.getChildren().forEach(kc => {
                if (!kc.active) return;
                if (Phaser.Math.Distance.Between(player.x, player.y, kc.x, kc.y) < r + TILE) {
                    const kp = 0.7 + 0.3 * Math.sin(now * 0.006);
                    revealGfx.fillStyle(0xffcc00, kp);
                    revealGfx.fillRect(kc.x - 9, kc.y - 6, 18, 12);
                    revealGfx.fillStyle(0x000000, 0.5);
                    revealGfx.fillRect(kc.x - 5, kc.y - 3, 10, 6);
                }
            });
            medkitGrp.getChildren().forEach(mc => {
                if (!mc.active) return;
                if (Phaser.Math.Distance.Between(player.x, player.y, mc.x, mc.y) < r + TILE) {
                    revealGfx.fillStyle(0x00dd55, 0.9);
                    revealGfx.fillRect(mc.x - 10, mc.y - 3, 20, 6);
                    revealGfx.fillRect(mc.x - 3, mc.y - 10, 6, 20);
                }
            });
            grenadeGrp.getChildren().forEach(gc => {
                if (!gc.active) return;
                if (Phaser.Math.Distance.Between(player.x, player.y, gc.x, gc.y) < r + TILE) {
                    const sp = 0.7 + 0.3 * Math.sin(now * 0.006);
                    // Smoke canister body (grey)
                    revealGfx.fillStyle(0x778899, sp);
                    revealGfx.fillRect(gc.x - 5, gc.y - 8, 10, 14);
                    // Top cap
                    revealGfx.fillStyle(0x99aabb, sp);
                    revealGfx.fillRect(gc.x - 4, gc.y - 11, 8, 4);
                    // Blue ring (smoke type indicator)
                    revealGfx.fillStyle(0x44aacc, sp);
                    revealGfx.fillRect(gc.x - 5, gc.y - 2, 10, 3);
                    // Nozzle
                    revealGfx.fillStyle(0xbbccdd, sp);
                    revealGfx.fillCircle(gc.x, gc.y - 13, 2);
                    // Tiny puff hint
                    revealGfx.fillStyle(0xaaaaaa, sp * 0.4);
                    revealGfx.fillCircle(gc.x, gc.y - 18, 4);
                }
            });
            // Noise-maker pickups — small grey rock with gold glint
            noisemakerGrp.getChildren().forEach(nm => {
                if (!nm.active) return;
                if (Phaser.Math.Distance.Between(player.x, player.y, nm.x, nm.y) < r + TILE) {
                    const sp = 0.7 + 0.3 * Math.sin(now * 0.007);
                    revealGfx.fillStyle(0x777777, sp);
                    revealGfx.fillCircle(nm.x, nm.y, 6);
                    revealGfx.fillStyle(0xaaaaaa, sp * 0.65);
                    revealGfx.fillCircle(nm.x - 2, nm.y - 2, 3);
                    revealGfx.fillStyle(0xffcc44, sp * 0.7);
                    revealGfx.fillCircle(nm.x + 2, nm.y - 4, 2);
                }
            });
            // Active noisemakers in flight / landed
            activeNoisemakers.forEach(nm => {
                if (Phaser.Math.Distance.Between(player.x, player.y, nm.x, nm.y) > r + TILE * 2) return;
                if (!nm.triggered) {
                    revealGfx.fillStyle(0xffaa44, 0.9);
                    revealGfx.fillCircle(nm.x, nm.y, 4);
                } else {
                    const age = now - nm.landAt;
                    const fa = Math.max(0, 1 - age / 1800);
                    revealGfx.fillStyle(0xff8800, fa * 0.6);
                    revealGfx.fillCircle(nm.targetX, nm.targetY, 5 + (1 - fa) * 4);
                }
            });

            // Security cameras — draw on wall tiles, show FOV cone and suspicion bar
            securityCameras.forEach(cam => {
                const dcam = Phaser.Math.Distance.Between(player.x, player.y, cam.x, cam.y);
                if (dcam > r + TILE * 2) return;
                const camDisabled = switchTriggered && Date.now() < switchUntil;
                const camCol = camDisabled ? 0x333333 : cam.suspicion > 0.5 ? 0xff4400 : 0x446688;
                const coneAlpha = camDisabled ? 0 : 0.10 + cam.suspicion * 0.22;
                revealGfx.fillStyle(camCol, coneAlpha);
                revealGfx.slice(cam.x, cam.y, cam.fovRange, cam.faceAngle - cam.fovHalf, cam.faceAngle + cam.fovHalf, false);
                revealGfx.fillPath();
                // Camera body (small box on wall)
                revealGfx.fillStyle(camDisabled ? 0x222222 : 0x334455, 0.9);
                revealGfx.fillRect(cam.x - 7, cam.y - 5, 14, 10);
                revealGfx.fillStyle(camDisabled ? 0x111111 : camCol, 0.95);
                revealGfx.fillCircle(cam.x, cam.y, 3);
                // Suspicion bar
                if (cam.suspicion > 0.05 && !camDisabled) {
                    revealGfx.fillStyle(0x111111, 0.85);
                    revealGfx.fillRect(cam.x - 12, cam.y - 10, 24, 4);
                    revealGfx.fillStyle(cam.suspicion > 0.7 ? 0xff3300 : 0xffaa00, 0.95);
                    revealGfx.fillRect(cam.x - 12, cam.y - 10, Math.round(24 * cam.suspicion), 4);
                }
            });

            // Light switch — amber wall panel with pulse
            if (!switchTriggered) {
                switchGrp.getChildren().forEach(sw => {
                    if (!sw.active) return;
                    if (Phaser.Math.Distance.Between(player.x, player.y, sw.x, sw.y) < r + TILE * 1.2) {
                        const sp = 0.7 + 0.3 * Math.sin(now * 0.005);
                        revealGfx.fillStyle(0xffaa00, sp);
                        revealGfx.fillRect(sw.x - 8, sw.y - 10, 16, 20);
                        revealGfx.fillStyle(0x000000, 0.6);
                        revealGfx.fillRect(sw.x - 4, sw.y - 5, 8, 8);
                        revealGfx.fillStyle(0xffcc44, 0.9);
                        revealGfx.fillRect(sw.x - 2, sw.y - 3, 4, 4);
                    }
                });
            } else if (Date.now() < switchUntil) {
                // Lights-out timer bar (top of screen, red countdown)
                const rem = Math.max(0, (switchUntil - Date.now()) / 5000);
                revealGfx.fillStyle(0xffaa00, 0.18);
                revealGfx.fillRect(0, 596, Math.round(800 * rem), 4);
            }

            // Guard footstep ripples — positional tell; TRACKER doubles detection range
            const rippleRange = activePerks.includes('TRACKER') ? r * 2 + 24 : r + 24;
            guardRipples.forEach(rp => {
                const prog = (now - rp.startAt) / 800;
                const rr   = prog * 42;
                if (Phaser.Math.Distance.Between(player.x, player.y, rp.x, rp.y) < rippleRange + rr) {
                    revealGfx.lineStyle(1, activePerks.includes('TRACKER') ? 0xff6666 : 0xff3333, (1 - prog) * 0.38);
                    revealGfx.strokeCircle(rp.x, rp.y, rr);
                }
            });

            // World particles (KO impact, damage)
            const dnow = Date.now();
            worldParticles.forEach(p => {
                if (Phaser.Math.Distance.Between(player.x, player.y, p.x, p.y) > r + 20) return;
                const pa = Math.max(0, 1 - (dnow - p.born) / p.life);
                revealGfx.fillStyle(p.color, pa);
                revealGfx.fillRect(p.x - 2, p.y - 2, 5, 5);
            });

            // KO ring burst VFX
            koRings = koRings.filter(kr => now - kr.startAt < 650);
            koRings.forEach(kr => {
                const prog = (now - kr.startAt) / 650;
                revealGfx.lineStyle(2, kr.color, (1 - prog) * 0.88);
                revealGfx.strokeCircle(kr.x, kr.y, prog * 60);
                if (prog < 0.5) {
                    revealGfx.lineStyle(1.5, kr.color, (0.5 - prog) * 0.65);
                    revealGfx.strokeCircle(kr.x, kr.y, prog * 34);
                }
            });

            // Sprint footprints — fading lateral marks
            const fpNow = Date.now();
            footprints.forEach(fp => {
                const age = fpNow - fp.born;
                if (Phaser.Math.Distance.Between(player.x, player.y, fp.x, fp.y) > ambR + TILE) return;
                const alpha = Math.max(0, (1 - age / 3500) * 0.2);
                const perp = (fp.ang || 0) + Math.PI / 2;
                revealGfx.lineStyle(1, 0x334455, alpha);
                revealGfx.lineBetween(fp.x + Math.cos(perp) * 4, fp.y + Math.sin(perp) * 4,
                                       fp.x - Math.cos(perp) * 4, fp.y - Math.sin(perp) * 4);
            });

            // Laser tripwires — pulsing vertical beams
            tripwires.forEach(tw => {
                if (tw.triggered) return;
                const midY = (tw.y1 + tw.y2) / 2;
                if (Phaser.Math.Distance.Between(player.x, player.y, tw.x, midY) > r + TILE * 2) return;
                const camDisabled = switchTriggered && Date.now() < switchUntil;
                if (camDisabled) {
                    revealGfx.lineStyle(1, 0x333333, 0.2);
                    revealGfx.lineBetween(tw.x, tw.y1, tw.x, tw.y2);
                } else {
                    const pulse = 0.55 + 0.45 * Math.sin(now * 0.007);
                    revealGfx.lineStyle(2, 0xff2200, 0.5 + pulse * 0.4);
                    revealGfx.lineBetween(tw.x, tw.y1, tw.x, tw.y2);
                    // Emitter brackets at each end
                    revealGfx.fillStyle(0xff4400, 0.88);
                    revealGfx.fillRect(tw.x - 5, tw.y1 - 5, 10, 10);
                    revealGfx.fillRect(tw.x - 5, tw.y2 - 5, 10, 10);
                    // Glow along beam
                    revealGfx.fillStyle(0xff6600, pulse * 0.18);
                    revealGfx.fillRect(tw.x - 3, tw.y1, 6, tw.y2 - tw.y1);
                }
            });

            // Radio wave rings (guard alert contagion)
            radioWaves = radioWaves.filter(rw => now - rw.startAt < 1000);
            radioWaves.forEach(rw => {
                if (Phaser.Math.Distance.Between(player.x, player.y, rw.x, rw.y) > r + 160) return;
                const prog = Math.max(0, (now - rw.startAt) / 1000);
                revealGfx.lineStyle(2, 0xff4400, (1 - prog) * 0.55);
                revealGfx.strokeCircle(rw.x, rw.y, prog * 95);
                revealGfx.lineStyle(1, 0xff6600, (1 - prog) * 0.28);
                revealGfx.strokeCircle(rw.x, rw.y, prog * 55);
            });

            // Prison props — rendered within ambient reveal radius so always visible in dim zone
            prisonProps.forEach(prop => {
                if (Phaser.Math.Distance.Between(player.x, player.y, prop.x, prop.y) > ambR + TILE) return;
                drawPrisonProp(revealGfx, prop);
            });

            // (smoke grenades drawn on smokeGfx layer below — always visible)

            guards.getChildren().forEach(g => {
                const lightsOut = switchTriggered && Date.now() < switchUntil;
                if (Phaser.Math.Distance.Between(player.x, player.y, g.x, g.y) < r + 80) {
                    if (g.koUntil > now) {
                        drawKOGuard(revealGfx, g.x, g.y);
                        // Wake-up progress bar
                        const dur = g.koDuration || koMs(currentLevel);
                        const wakeP = Math.min(1, 1 - (g.koUntil - now) / dur);
                        revealGfx.fillStyle(0x1a1a1a, 0.85);
                        revealGfx.fillRect(g.x - 14, g.y + 18, 28, 4);
                        revealGfx.fillStyle(wakeP > 0.75 ? 0xff4400 : 0xff8800, 0.88);
                        revealGfx.fillRect(g.x - 14, g.y + 18, Math.round(28 * wakeP), 4);
                        if (g.koFlash && g.koFlash > now) {
                            const p = 1 - (g.koFlash - now) / 280;
                            revealGfx.lineStyle(3, 0xffffff, (1 - p) * 0.9);
                            revealGfx.strokeCircle(g.x, g.y, 14 + p * 22);
                        }
                    } else {
                        // Patrol route hint — faint line to next waypoint
                        if (g.state === 'PATROL' && g.waypoints && g.waypoints.length >= 2) {
                            const nextWP = g.waypoints[(g.waypointIdx + 1) % g.waypoints.length];
                            revealGfx.lineStyle(1, 0x223344, 0.22);
                            revealGfx.lineBetween(g.x, g.y, nextWP.x, nextWP.y);
                        }
                        // FOV cone (arc sector)
                        const fa   = g.faceAngle || 0;
                        const fovR = lightsOut ? 20 :
                            g.boss ? 300 : g.elite ? 220 :
                            g.guardType === 'WATCHER' ? 265 : g.guardType === 'RUNNER' ? 95 : 150;
                        const fovA = lightsOut ? 0.1 :
                            g.boss ? Math.PI * 5 / 12 : g.elite ? Math.PI / 3 :
                            g.guardType === 'WATCHER' ? Math.PI * 7 / 12 : g.guardType === 'RUNNER' ? Math.PI / 7 : Math.PI / 4;
                        const coneCol = g.boss ? 0xff6600 : g.elite ? 0xffaa00 :
                            g.guardType === 'WATCHER' ? 0xcc44ff : g.guardType === 'RUNNER' ? 0x00ccff : 0xff3333;
                        const coneAlpha = g.state === 'ALERT' ? 0.28 : 0.12 + (g.suspicion || 0) * 0.20;
                        revealGfx.fillStyle(coneCol, coneAlpha);
                        revealGfx.slice(g.x, g.y, fovR, fa - fovA, fa + fovA, false);
                        revealGfx.fillPath();
                        // Backstab arc — green sector at guard's rear, visible when in weapon range
                        if (!g.boss) {
                            const dpR = Phaser.Math.Distance.Between(player.x, player.y, g.x, g.y);
                            const wpR = getWeapon(currentLevel);
                            const atkRangeR = activePerks.includes('WIDE_SWING') ? Math.round(wpR.range * 1.20) : wpR.range;
                            if (dpR < atkRangeR + 55) {
                                const backAng = fa + Math.PI;
                                revealGfx.lineStyle(1.5, 0x44ff88, 0.38);
                                revealGfx.slice(g.x, g.y, 30, backAng - 0.44 * Math.PI, backAng + 0.44 * Math.PI, false);
                                revealGfx.strokePath();
                            }
                        }
                        if (g.boss) drawBossSprite(revealGfx, g.x, g.y, g.state === 'ALERT');
                        else drawGuardSprite(revealGfx, g.x, g.y, g.guardType || 'STANDARD', g.elite || false, g.state === 'ALERT');
                        // Suspicion detection meter
                        if (g.suspicion > 0.04 && g.state !== 'ALERT') {
                            const susCol = g.suspicion > 0.7 ? 0xff3300 : g.suspicion > 0.38 ? 0xffaa00 : 0xffee00;
                            revealGfx.fillStyle(0x080808, 0.9);
                            revealGfx.fillRect(g.x - 15, g.y - 36, 30, 5);
                            revealGfx.fillStyle(susCol, 0.95);
                            revealGfx.fillRect(g.x - 15, g.y - 36, Math.round(30 * g.suspicion), 5);
                            if (g.suspicion > 0.45) {
                                revealGfx.fillStyle(susCol, (g.suspicion - 0.45) * 1.5);
                                revealGfx.fillTriangle(g.x - 4, g.y - 44, g.x + 4, g.y - 44, g.x, g.y - 38);
                            }
                        }
                        if (g.boss && g.hitsLeft < 3) {
                            // HP pips below boss
                            for (let h = 0; h < g.hitsLeft; h++) {
                                revealGfx.fillStyle(0xff6600, 1);
                                revealGfx.fillRect(g.x - 8 + h * 8, g.y + 18, 6, 4);
                            }
                        }
                        if (g.alertFlash && g.alertFlash > now) {
                            const a = (g.alertFlash - now) / 900;
                            revealGfx.fillStyle(0xff3333, a);
                            revealGfx.fillRect(g.x - 3, g.y - 24, 6, 11);
                            revealGfx.fillRect(g.x - 3, g.y - 10, 6,  5);
                        }
                    }
                }
            });

            // "?" ghost markers for guards in WAIT — show where they heard noise
            guards.getChildren().forEach(g => {
                if (g.state !== 'WAIT' || !g.heardX) return;
                if (Phaser.Math.Distance.Between(player.x, player.y, g.heardX, g.heardY) < r + 32) {
                    const a = Math.min(1, (g.waitUntil - now) / 2000) * 0.8;
                    revealGfx.fillStyle(0xffff00, a);
                    revealGfx.fillRect(g.heardX - 4, g.heardY - 16, 8, 12);
                    revealGfx.fillRect(g.heardX - 3, g.heardY - 3, 6, 5);
                }
            });

            if (Phaser.Math.Distance.Between(player.x, player.y, exitX, exitY) < r + TILE * 0.75) {
                if (keycardCollected) {
                    const exitPulse = 0.72 + 0.22 * Math.sin(now * 0.004);
                    revealGfx.fillStyle(theme.exit, exitPulse);
                    revealGfx.fillRect(exitX - TILE / 2, exitY - TILE / 2, TILE, TILE);
                } else {
                    revealGfx.fillStyle(theme.exit, 0.22);
                    revealGfx.fillRect(exitX - TILE / 2, exitY - TILE / 2, TILE, TILE);
                    // Lock symbol
                    revealGfx.fillStyle(0xffcc00, 0.9);
                    revealGfx.fillRect(exitX - 7, exitY - 2, 14, 10);
                    revealGfx.lineStyle(3, 0xffcc00, 0.9);
                    revealGfx.strokeCircle(exitX, exitY - 7, 6);
                }
            }
            // Attack flash — thick glow + thin bright line that fades
            if (now < attackFlashUntil) {
                const t  = (attackFlashUntil - now) / 140;
                const wp = getWeapon(currentLevel);
                const ex = player.x + lastMoveX * wp.range;
                const ey = player.y + lastMoveY * wp.range;
                revealGfx.lineStyle(10, 0xffffff, t * 0.18);
                revealGfx.lineBetween(player.x, player.y, ex, ey);
                revealGfx.lineStyle(2,  0xffffff, t * 0.95);
                revealGfx.lineBetween(player.x, player.y, ex, ey);
                revealGfx.fillStyle(0xffffff, t * 0.6);
                revealGfx.fillCircle(ex, ey, 5);
            }
        }
        if (playerDead) {
            const dt = Math.max(0, 1 - (Date.now() - playerDeadAt) / 700);
            drawPlayerSprite(revealGfx, player.x, player.y + (1 - dt) * 14);
            revealGfx.fillStyle(0xcc0000, (1 - dt) * 0.55);
            revealGfx.fillRect(player.x - 8, player.y + (1 - dt) * 14 - 14, 16, 26);
        } else {
            const idleBob = isMoving ? 0 : Math.sin(now * 0.0028) * 1.5;
            drawPlayerSprite(revealGfx, player.x, player.y + idleBob);
        }
        // Crouch ring — shows reduced detection footprint
        if (crouching) {
            const crPulse = 0.25 + 0.15 * Math.sin(now * 0.005);
            revealGfx.lineStyle(1, 0x44ff88, crPulse);
            revealGfx.strokeCircle(player.x, player.y, 20);
        }
        if (isMoving && !anyAlerted) {
            const pulse = 0.12 + 0.06 * Math.sin(now * 0.008);
            revealGfx.lineStyle(1, 0xff8800, pulse * 0.5);
            revealGfx.strokeCircle(player.x, player.y, curSound);
        }

        if (isMoving && Date.now() - lastPulse > (walking ? 540 : 420)) { lastPulse = Date.now(); playFootstep(walking); }

        tensionOverlay.clear();
        const anyAlert = guards.getChildren().some(g => g.state === 'ALERT' && !(g.koUntil > now));
        // Vignette — soft edge darkening always, tightens to red on alert
        const vigAlpha = anyAlert ? 0.28 + 0.07 * Math.sin(now * 0.005) : 0.18;
        const vigCol   = anyAlert ? theme.tension : 0x000000;
        const vS = 140;
        tensionOverlay.fillGradientStyle(vigCol, vigCol, vigCol, vigCol, vigAlpha, 0, vigAlpha, 0);
        tensionOverlay.fillRect(0, 0, vS, 600);
        tensionOverlay.fillGradientStyle(vigCol, vigCol, vigCol, vigCol, 0, vigAlpha, 0, vigAlpha);
        tensionOverlay.fillRect(660, 0, vS, 600);
        tensionOverlay.fillGradientStyle(vigCol, vigCol, vigCol, vigCol, vigAlpha, vigAlpha, 0, 0);
        tensionOverlay.fillRect(0, 0, 800, vS);
        tensionOverlay.fillGradientStyle(vigCol, vigCol, vigCol, vigCol, 0, 0, vigAlpha, vigAlpha);
        tensionOverlay.fillRect(0, 460, 800, vS);
        if (anyAlert) {
            if (Date.now() - lastHeartbeat > 850) { lastHeartbeat = Date.now(); playHeartbeat(); }
        }

        // Reactive ambient music
        if (audioCtx && musicReactiveGain) {
            const targetVol = anyAlert ? (alarmFired ? 1.55 : 1.2) : 1.0;
            musicReactiveGain.gain.setTargetAtTime(targetVol, audioCtx.currentTime, 0.7);
        }
        if (audioCtx && alertDroneGain) {
            const targetDrone = anyAlert ? (alarmFired ? 0.048 : 0.026) : 0;
            alertDroneGain.gain.setTargetAtTime(targetDrone, audioCtx.currentTime, 0.55);
        }

        // Guard proximity audio — spatialized footstep shuffle
        if (Date.now() - lastGuardSound > 540) {
            lastGuardSound = Date.now();
            guards.getChildren().forEach(g => {
                if (g.koUntil > now) return;
                const dp = Phaser.Math.Distance.Between(player.x, player.y, g.x, g.y);
                if (dp < 320) {
                    const vol = (1 - dp / 320) * 0.072;
                    const pan = Math.sin(Math.atan2(g.y - player.y, g.x - player.x));
                    playGuardNearby(vol, pan);
                }
            });
        }

        // Segmented HP bar
        hpBarGfx.clear();
        const maxHP = activePerks.includes('RESILIENT') ? 110 : 100;
        const hpFrac = Math.max(0, playerHP / maxHP);
        const hpColor = playerHP > 60 ? 0x22cc55 : playerHP > 30 ? 0xffaa00 : 0xff2222;
        hpBarGfx.fillStyle(0x0d0d0d, 1);
        hpBarGfx.fillRect(7, 2, 126, 12);
        hpBarGfx.lineStyle(1, 0x2a2a2a, 1);
        hpBarGfx.strokeRect(7, 2, 126, 12);
        hpBarGfx.fillStyle(hpColor, 1);
        hpBarGfx.fillRect(8, 3, Math.round(124 * hpFrac), 10);
        for (let s = 1; s < 10; s++) {
            hpBarGfx.fillStyle(0x000000, 0.7);
            hpBarGfx.fillRect(8 + Math.round(s * 124 / 10), 3, 1, 10);
        }

        // Stamina bar — below HP bar
        staminaBarGfx.clear();
        const staminaFrac = stamina / 100;
        const staminaCol = staminaExhausted ? 0xff4400 : sprinting ? 0x00aaff : 0x2255aa;
        staminaBarGfx.fillStyle(0x0a0a0a, 1);
        staminaBarGfx.fillRect(7, 16, 126, 7);
        staminaBarGfx.lineStyle(1, 0x222222, 1);
        staminaBarGfx.strokeRect(7, 16, 126, 7);
        staminaBarGfx.fillStyle(staminaCol, 1);
        staminaBarGfx.fillRect(8, 17, Math.round(124 * staminaFrac), 5);
        // HP number
        hpNumLabel.setText(`${Math.ceil(playerHP)}`);

        // Time bonus decay bar — thin gold strip across the top
        const elapsed = (Date.now() - levelStartTime) / 1000;
        const bonusFrac = Math.max(0, 1 - elapsed / 60);
        hpBarGfx.fillStyle(0x0e0e0a, 1);
        hpBarGfx.fillRect(7, 25, 126, 4);
        if (bonusFrac > 0) {
            const bonusColor = bonusFrac > 0.5 ? 0xddaa00 : bonusFrac > 0.25 ? 0xdd6600 : 0xcc2200;
            hpBarGfx.fillStyle(bonusColor, 0.65);
            hpBarGfx.fillRect(8, 26, Math.round(124 * bonusFrac), 2);
        }

        weaponLabel.setText(`[ ${getWeapon(currentLevel).name} ]  SPACE`);
        scoreLabel.setText(`SCORE  ${score}`);
        guardCountLabel.setText(`KO  ${guardKOs} / ${totalGuards}`);

        grenadeCountLabel
            .setText(
                (keycardCollected ? 'KEYCARD  ✓' : 'KEYCARD  ·') +
                (playerGrenades > 0 ? `    SMK ×${playerGrenades}` : '')
            )
            .setColor(keycardCollected ? '#44cc77' : '#555555');
        if (noisemakerCountLabel) noisemakerCountLabel.setText(playerNoisemakers > 0 ? `ROCK ×${playerNoisemakers}` : '');
        if (crouchLabel) crouchLabel.setAlpha(crouching ? 0.75 : 0);
        if (alarmTime) {
            alarmLabel.setText(`! ALARM IN ${Math.ceil((alarmTime - now) / 1000)}s`).setVisible(true);
        } else {
            alarmLabel.setVisible(false);
        }

        // Minimap — bottom-right corner
        minimapGfx.clear();
        if (levelGrid && !playerDead && !transitioning) {
            const cols = levelGrid[0].length, rows = levelGrid.length;
            const tW = Math.max(1, Math.floor(90 / cols));
            const tH = Math.max(1, Math.floor(68 / rows));
            const mW = cols * tW, mH = rows * tH;
            const mX = 795 - mW, mY = 597 - mH;
            minimapGfx.fillStyle(0x000000, 0.78);
            minimapGfx.fillRect(mX - 3, mY - 3, mW + 6, mH + 6);
            minimapGfx.lineStyle(1, 0x2a2a2a, 0.9);
            minimapGfx.strokeRect(mX - 3, mY - 3, mW + 6, mH + 6);
            for (let mr = 0; mr < rows; mr++) {
                for (let mc = 0; mc < cols; mc++) {
                    minimapGfx.fillStyle(levelGrid[mr][mc] === 1 ? 0x1c1c1c : 0x080808, 1);
                    minimapGfx.fillRect(mX + mc * tW, mY + mr * tH, tW, tH);
                }
            }
            // Exit
            const exC = Math.floor(exitX / TILE), exR = Math.floor(exitY / TILE);
            const mTheme = getLevelTheme(currentLevel);
            minimapGfx.fillStyle(keycardCollected ? mTheme.exit : 0x445544, 0.9);
            minimapGfx.fillRect(mX + exC * tW, mY + exR * tH, Math.max(tW, 2), Math.max(tH, 2));
            // Keycard (yellow dot until collected)
            if (!keycardCollected) {
                keycardGrp.getChildren().forEach(kc => {
                    if (!kc.active) return;
                    const kcC = Math.floor(kc.x / TILE), kcR = Math.floor(kc.y / TILE);
                    minimapGfx.fillStyle(0xffcc00, 1);
                    minimapGfx.fillRect(mX + kcC * tW, mY + kcR * tH, Math.max(tW, 2), Math.max(tH, 2));
                });
            }
            // Active noisemakers (orange dot when triggered)
            activeNoisemakers.forEach(nm => {
                if (!nm.triggered) return;
                const nC = Math.floor(nm.targetX / TILE), nR = Math.floor(nm.targetY / TILE);
                minimapGfx.fillStyle(0xff8800, 0.85);
                minimapGfx.fillRect(mX + nC * tW, mY + nR * tH, Math.max(tW, 2), Math.max(tH, 2));
            });
            // Guards
            guards.getChildren().forEach(g => {
                if (g.koUntil > now) return;
                const gC = Math.floor(g.x / TILE), gR = Math.floor(g.y / TILE);
                minimapGfx.fillStyle(g.state === 'ALERT' ? 0xff2222 : 0xdd6600, 1);
                minimapGfx.fillRect(mX + gC * tW, mY + gR * tH, Math.max(tW, 2), Math.max(tH, 2));
            });
            // Player
            const pC = Math.floor(player.x / TILE), pR = Math.floor(player.y / TILE);
            minimapGfx.fillStyle(0xffffff, 1);
            minimapGfx.fillRect(mX + pC * tW - 1, mY + pR * tH - 1, Math.max(tW + 2, 3), Math.max(tH + 2, 3));
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

window._phaserGame = new Phaser.Game(config);
