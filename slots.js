const canvas = document.getElementById('slotsCanvas');
const ctx = canvas.getContext('2d');

// ── Symbols ────────────────────────────────────────────────────────────────────
const SYMBOLS = [
    { char: '7',  color: '#ffd700', shadow: 'rgba(255,215,0,0.8)',   weight: 1, payout3: 500, name: 'seven'   },
    { char: '★',  color: '#00e5ff', shadow: 'rgba(0,229,255,0.8)',   weight: 2, payout3: 200, name: 'star'    },
    { char: '♦',  color: '#e040fb', shadow: 'rgba(224,64,251,0.8)',  weight: 3, payout3: 100, name: 'diamond' },
    { char: '●',  color: '#ff5252', shadow: 'rgba(255,82,82,0.8)',   weight: 5, payout3:  50, name: 'cherry'  },
    { char: '▲',  color: '#69ff47', shadow: 'rgba(105,255,71,0.8)',  weight: 6, payout3:  30, name: 'bar'     },
    { char: '■',  color: '#ffea00', shadow: 'rgba(255,234,0,0.8)',   weight: 7, payout3:  20, name: 'square'  },
];
const PAIR_PAYOUT = 5;
const BET         = 10;
const START_CR    = 100;
const REEL_COUNT  = 3;
const STRIP_LEN   = 24;   // symbols per reel strip
const CELL_H      = 80;   // px per symbol cell in the reel
const VISIBLE     = 3;    // rows shown per reel

// ── Build weighted reel strips ─────────────────────────────────────────────────
function buildStrip() {
    const pool = [];
    for (const sym of SYMBOLS) {
        for (let i = 0; i < sym.weight; i++) pool.push(SYMBOLS.indexOf(sym));
    }
    // Shuffle pool into STRIP_LEN entries
    const strip = [];
    for (let i = 0; i < STRIP_LEN; i++) {
        strip.push(pool[Math.floor(Math.random() * pool.length)]);
    }
    return strip;
}

// ── State ──────────────────────────────────────────────────────────────────────
const STATE = { IDLE: 0, SPINNING: 1, RESULT: 2 };
let state = STATE.IDLE;

let strips, reelPos, reelSpeed, reelTarget, reelStopped;
let credits, highCredits;
let particles;
let resultMsg, resultLife;
let rainbowFrames = 0;
let newBestShown   = false;
let spinBtn; // virtual button bounds

function initSlots() {
    strips       = Array.from({ length: REEL_COUNT }, buildStrip);
    reelPos      = Array.from({ length: REEL_COUNT }, () => Math.random() * STRIP_LEN);
    reelSpeed    = [0, 0, 0];
    reelTarget   = [0, 0, 0];
    reelStopped  = [true, true, true];
    particles    = [];
    resultMsg    = '';
    resultLife   = 0;
    rainbowFrames= 0;
}

credits      = parseInt(localStorage.getItem('slotsCredits') || String(START_CR));
highCredits  = parseInt(localStorage.getItem('slotsHighCredits') || String(START_CR));

initSlots();

// ── Layout constants ───────────────────────────────────────────────────────────
const CW = canvas.width;   // 520
const CH = canvas.height;  // 420

const REEL_W    = 100;
const REEL_GAP  = 18;
const REELS_X   = (CW - (REEL_COUNT * REEL_W + (REEL_COUNT - 1) * REEL_GAP)) / 2;  // left edge of first reel
const REELS_Y   = 60;      // top of reel window
const REEL_VH   = VISIBLE * CELL_H;  // total visible reel height (240)
const WIN_ROW   = REELS_Y + CELL_H;  // y top of middle (win) row

// Spin button
const BTN_W = 100, BTN_H = 36;
const BTN_X = CW / 2 - BTN_W / 2;
const BTN_Y = CH - 60;
spinBtn = { x: BTN_X, y: BTN_Y, w: BTN_W, h: BTN_H };

// ── Spin logic ─────────────────────────────────────────────────────────────────
function spin() {
    if (state !== STATE.IDLE) return;
    if (credits < BET) { resultMsg = 'INSERT COIN'; resultLife = 2; return; }

    credits -= BET;
    saveCredits();
    state = STATE.SPINNING;
    resultMsg = '';

    // Rebuild strips each spin for freshness
    strips = Array.from({ length: REEL_COUNT }, buildStrip);

    for (let i = 0; i < REEL_COUNT; i++) {
        reelSpeed[i]   = 0.45 + Math.random() * 0.1;
        reelTarget[i]  = Math.floor(Math.random() * STRIP_LEN);
        reelStopped[i] = false;
    }
}

const STOP_DELAYS = [90, 150, 215]; // frames after spin start when each reel stops
let spinFrame = 0;

function updateReels() {
    if (state !== STATE.SPINNING) return;
    spinFrame++;

    let allStopped = true;
    for (let i = 0; i < REEL_COUNT; i++) {
        if (reelStopped[i]) continue;
        allStopped = false;

        if (spinFrame >= STOP_DELAYS[i]) {
            // Decelerate toward target
            const target = reelTarget[i];
            let diff = ((target - reelPos[i]) % STRIP_LEN + STRIP_LEN) % STRIP_LEN;
            if (diff > STRIP_LEN / 2) diff -= STRIP_LEN;  // take shorter path

            if (Math.abs(diff) < 0.08 && reelSpeed[i] < 0.06) {
                reelPos[i]      = ((target % STRIP_LEN) + STRIP_LEN) % STRIP_LEN;
                reelSpeed[i]    = 0;
                reelStopped[i]  = true;
            } else {
                reelSpeed[i] *= 0.91;
                if (reelSpeed[i] < 0.05) reelSpeed[i] = 0.05;
            }
        }

        reelPos[i] = (reelPos[i] + reelSpeed[i] + STRIP_LEN) % STRIP_LEN;
    }

    if (allStopped) {
        state = STATE.RESULT;
        spinFrame = 0;
        evaluateResult();
    }
}

// ── Evaluate win ───────────────────────────────────────────────────────────────
function getMiddleSymbol(i) {
    const idx = Math.round(reelPos[i]) % STRIP_LEN;
    return strips[i][idx];
}

function evaluateResult() {
    const syms = [getMiddleSymbol(0), getMiddleSymbol(1), getMiddleSymbol(2)];
    let payout = 0;

    if (syms[0] === syms[1] && syms[1] === syms[2]) {
        // 3 of a kind
        payout = SYMBOLS[syms[0]].payout3;
        if (syms[0] === 0) {
            // JACKPOT (seven)
            rainbowFrames = 50;
            resultMsg = '★ JACKPOT ★';
            spawnParticles(30);
        } else {
            resultMsg = `${SYMBOLS[syms[0]].char} ${SYMBOLS[syms[0]].char} ${SYMBOLS[syms[0]].char}  +${payout}`;
            spawnParticles(14);
        }
    } else if (syms[0] === syms[1] || syms[1] === syms[2] || syms[0] === syms[2]) {
        payout = PAIR_PAYOUT;
        resultMsg = `PAIR  +${payout}`;
        spawnParticles(6);
    } else {
        resultMsg = 'NO MATCH';
    }

    credits += payout;
    if (credits > highCredits) {
        highCredits = credits;
        newBestShown = true;
        canvas.classList.add('new-best');
    } else {
        newBestShown = false;
        canvas.classList.remove('new-best');
    }
    saveCredits();
    resultLife = 1.5;

    if (credits <= 0) {
        credits = START_CR;
        saveCredits();
        resultMsg = 'GAME OVER  — reset to 100';
        resultLife = 2.5;
        canvas.classList.remove('new-best');
    }

    // Brief pause then back to IDLE
    setTimeout(() => { state = STATE.IDLE; }, 1200);
}

function saveCredits() {
    localStorage.setItem('slotsCredits',     String(credits));
    localStorage.setItem('slotsHighCredits', String(highCredits));
}

// ── Particles ──────────────────────────────────────────────────────────────────
function spawnParticles(count) {
    const cx = CW / 2, cy = CH / 2;
    for (let i = 0; i < count; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = 2 + Math.random() * 4;
        particles.push({
            x: cx, y: cy,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed,
            life: 1,
            hue: Math.random() * 360,
        });
    }
}

function updateParticles() {
    for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.x  += p.vx; p.y  += p.vy;
        p.vx *= 0.96; p.vy *= 0.96;
        p.life -= 0.025;
        if (p.life <= 0) particles.splice(i, 1);
    }
}

// ── Draw ───────────────────────────────────────────────────────────────────────
function drawReels() {
    for (let i = 0; i < REEL_COUNT; i++) {
        const rx = REELS_X + i * (REEL_W + REEL_GAP);
        const ry = REELS_Y;

        // Clip to reel window
        ctx.save();
        ctx.beginPath();
        ctx.rect(rx, ry, REEL_W, REEL_VH);
        ctx.clip();

        // Draw 5 visible symbols centred in the window
        for (let row = -1; row <= VISIBLE + 1; row++) {
            const stripIdx = ((Math.round(reelPos[i]) + row - 1) % STRIP_LEN + STRIP_LEN) % STRIP_LEN;
            const sym = SYMBOLS[strips[i][stripIdx]];

            // Fractional offset for smooth scroll
            const frac = reelPos[i] - Math.floor(reelPos[i]);
            const cellY = ry + (row - frac) * CELL_H + CELL_H / 2;

            const rowIndex = row; // 0=top, 1=mid, 2=bot (among visible)
            const isMidRow = (rowIndex === 1);
            const alpha    = isMidRow ? 1 : 0.38;

            ctx.globalAlpha = alpha;
            ctx.font = `bold ${isMidRow ? 36 : 28}px "Space Mono", monospace`;
            ctx.textAlign    = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillStyle    = sym.color;
            ctx.shadowColor  = sym.shadow;
            ctx.shadowBlur   = isMidRow ? 18 : 4;
            ctx.fillText(sym.char, rx + REEL_W / 2, cellY);
            ctx.shadowBlur = 0;
        }

        ctx.globalAlpha = 1;
        ctx.restore();

        // Reel border
        ctx.strokeStyle = 'rgba(140,200,255,0.15)';
        ctx.lineWidth   = 1;
        ctx.strokeRect(rx, ry, REEL_W, REEL_VH);
    }

    // Win line highlight
    ctx.beginPath();
    ctx.moveTo(REELS_X - 8, WIN_ROW + CELL_H / 2);
    ctx.lineTo(REELS_X + REEL_COUNT * (REEL_W + REEL_GAP) - REEL_GAP + 8, WIN_ROW + CELL_H / 2);
    const lineAlpha = 0.15 + 0.08 * Math.sin(Date.now() / 400);
    ctx.strokeStyle = `rgba(255,220,80,${lineAlpha})`;
    ctx.lineWidth   = 2;
    ctx.stroke();
}

function drawHUD() {
    ctx.shadowBlur  = 0;
    ctx.globalAlpha = 1;
    ctx.textBaseline = 'alphabetic';

    // Title
    ctx.font      = '13px "Space Mono", monospace';
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(255,255,255,0.25)';
    ctx.fillText('SLOT  MACHINE', CW / 2, 30);

    // Credits
    ctx.font      = '14px "Space Mono", monospace';
    ctx.textAlign = 'left';
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    ctx.fillText(`Credits: ${credits}`, 24, CH - 38);

    // High
    ctx.textAlign = 'right';
    ctx.fillStyle = 'rgba(255,215,0,0.45)';
    ctx.fillText(`Best: ${highCredits}`, CW - 24, CH - 38);

    // Spin button
    const idle = state === STATE.IDLE;
    ctx.beginPath();
    roundRect(BTN_X, BTN_Y, BTN_W, BTN_H, 6);
    ctx.fillStyle   = idle ? 'rgba(140,220,255,0.12)' : 'rgba(100,100,100,0.1)';
    ctx.fill();
    ctx.strokeStyle = idle ? 'rgba(140,220,255,0.45)' : 'rgba(100,100,100,0.3)';
    ctx.lineWidth   = 1;
    ctx.stroke();

    ctx.font      = '13px "Space Mono", monospace';
    ctx.textAlign = 'center';
    ctx.fillStyle = idle ? 'rgba(140,220,255,0.9)' : 'rgba(150,150,150,0.5)';
    ctx.fillText('SPIN', CW / 2, BTN_Y + BTN_H / 2 + 5);

    // Bet hint
    ctx.font      = '11px "Space Mono", monospace';
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(255,255,255,0.2)';
    ctx.fillText(`bet: ${BET}  ·  space / tap`, CW / 2, CH - 14);
}

function drawResult() {
    if (resultLife <= 0 || !resultMsg) return;
    const alpha = Math.min(1, resultLife);
    ctx.globalAlpha  = alpha;
    ctx.font         = 'bold 18px "Space Mono", monospace';
    ctx.textAlign    = 'center';
    ctx.textBaseline = 'middle';

    const isJackpot  = resultMsg.includes('JACKPOT');
    const isWin      = resultMsg.includes('+') || isJackpot;
    ctx.fillStyle    = isJackpot ? `hsl(${Date.now() / 8 % 360},100%,65%)` :
                       isWin ? '#ffd700' : 'rgba(255,255,255,0.6)';
    ctx.shadowColor  = isJackpot ? `hsl(${Date.now() / 8 % 360},100%,50%)` : 'transparent';
    ctx.shadowBlur   = isJackpot ? 24 : 0;
    ctx.fillText(resultMsg, CW / 2, REELS_Y + REEL_VH + 26);
    ctx.shadowBlur   = 0;
    ctx.globalAlpha  = 1;
    ctx.textBaseline = 'alphabetic';
}

function drawParticles() {
    for (const p of particles) {
        ctx.globalAlpha = p.life * 0.9;
        ctx.beginPath();
        ctx.arc(p.x, p.y, 3 * p.life, 0, Math.PI * 2);
        ctx.fillStyle  = `hsl(${p.hue},80%,65%)`;
        ctx.shadowColor = `hsl(${p.hue},80%,55%)`;
        ctx.shadowBlur  = 8;
        ctx.fill();
        ctx.shadowBlur  = 0;
    }
    ctx.globalAlpha = 1;
}

function drawRainbow() {
    if (rainbowFrames <= 0) return;
    const hue = (Date.now() / 6) % 360;
    ctx.fillStyle   = `hsla(${hue},100%,50%,0.12)`;
    ctx.fillRect(0, 0, CW, CH);
    rainbowFrames--;
}

function roundRect(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.arcTo(x + w, y, x + w, y + r, r);
    ctx.lineTo(x + w, y + h - r);
    ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
    ctx.lineTo(x + r, y + h);
    ctx.arcTo(x, y + h, x, y + h - r, r);
    ctx.lineTo(x, y + r);
    ctx.arcTo(x, y, x + r, y, r);
    ctx.closePath();
}

// ── Payout table overlay (shown on IDLE hover area, via '?' key or h key) ─────
let showHelp = false;
function drawHelp() {
    if (!showHelp) return;
    ctx.fillStyle = 'rgba(0,0,0,0.82)';
    ctx.fillRect(0, 0, CW, CH);

    ctx.textAlign    = 'center';
    ctx.textBaseline = 'top';
    ctx.font         = 'bold 14px "Space Mono", monospace';
    ctx.fillStyle    = 'rgba(140,220,255,0.9)';
    ctx.fillText('PAYTABLE', CW / 2, 28);

    ctx.font      = '12px "Space Mono", monospace';
    let y = 64;
    for (const sym of SYMBOLS) {
        ctx.fillStyle = sym.color;
        ctx.fillText(`${sym.char} ${sym.char} ${sym.char}`, CW / 2 - 60, y);
        ctx.fillStyle = 'rgba(255,255,255,0.7)';
        ctx.fillText(`${sym.payout3} cr`, CW / 2 + 40, y);
        y += 28;
    }
    ctx.fillStyle = 'rgba(255,255,255,0.4)';
    ctx.fillText('any pair', CW / 2 - 60, y);
    ctx.fillText(`${PAIR_PAYOUT} cr`, CW / 2 + 40, y);

    ctx.font      = '11px "Space Mono", monospace';
    ctx.fillStyle = 'rgba(255,255,255,0.25)';
    ctx.fillText('press H to close', CW / 2, CH - 30);
    ctx.textBaseline = 'alphabetic';
}

// ── Main loop ──────────────────────────────────────────────────────────────────
function loop() {
    ctx.clearRect(0, 0, CW, CH);

    updateReels();
    updateParticles();
    if (resultLife > 0) resultLife -= 0.008;

    drawRainbow();
    drawReels();
    drawParticles();
    drawResult();
    drawHUD();
    drawHelp();

    requestAnimationFrame(loop);
}

// ── Input ──────────────────────────────────────────────────────────────────────
document.addEventListener('keydown', (e) => {
    if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault();
        spin();
    }
    if (e.key === 'h' || e.key === 'H' || e.key === '?') {
        showHelp = !showHelp;
    }
});

canvas.addEventListener('click', (e) => {
    const rect = canvas.getBoundingClientRect();
    const scaleX = CW / rect.width;
    const scaleY = CH / rect.height;
    const cx = (e.clientX - rect.left) * scaleX;
    const cy = (e.clientY - rect.top)  * scaleY;
    if (cx >= BTN_X && cx <= BTN_X + BTN_W && cy >= BTN_Y && cy <= BTN_Y + BTN_H) {
        spin();
    }
});

// Touch tap on button
canvas.addEventListener('touchend', (e) => {
    e.preventDefault();
    const rect = canvas.getBoundingClientRect();
    const t    = e.changedTouches[0];
    const scaleX = CW / rect.width;
    const scaleY = CH / rect.height;
    const cx = (t.clientX - rect.left) * scaleX;
    const cy = (t.clientY - rect.top)  * scaleY;
    if (cx >= BTN_X && cx <= BTN_X + BTN_W && cy >= BTN_Y && cy <= BTN_Y + BTN_H) {
        spin();
    }
}, { passive: false });

// ── Start ──────────────────────────────────────────────────────────────────────
loop();
