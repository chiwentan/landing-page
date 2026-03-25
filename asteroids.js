const canvas = document.getElementById('asteroidsCanvas');
const ctx = canvas.getContext('2d');

// ── State machine ──────────────────────────────────────────────────────────────
const STATE = { WAITING: 0, PLAYING: 1, DEAD: 2, WAVE_CLEAR: 3 };
let state = STATE.WAITING;

// ── Game objects ───────────────────────────────────────────────────────────────
let ship, bullets, asteroids, particles, floatingTexts;
let score, lives, wave, highScore;
let invincFrames = 0;        // ship invincibility after respawn
let waveDelayFrames = 0;     // pause between waves
let shakeFrames = 0;

// ── Input state ────────────────────────────────────────────────────────────────
const keys = {};

highScore = parseInt(localStorage.getItem('asteroidsHighScore') || '0');

// ── Canvas resize ──────────────────────────────────────────────────────────────
function resize() {
    canvas.width  = window.innerWidth;
    canvas.height = window.innerHeight;
}
window.addEventListener('resize', resize);
resize();

// ── Ship ───────────────────────────────────────────────────────────────────────
function createShip() {
    return {
        x: canvas.width  / 2,
        y: canvas.height / 2,
        angle: -Math.PI / 2,  // pointing up
        vx: 0,
        vy: 0,
        shootCooldown: 0,
    };
}

// ── Asteroids ──────────────────────────────────────────────────────────────────
const SIZES = { large: 52, medium: 28, small: 14 };
const POINTS = { large: 10, medium: 20, small: 40 };

function randomAsteroidVerts(r) {
    const n = 8 + Math.floor(Math.random() * 4);
    const verts = [];
    for (let i = 0; i < n; i++) {
        const angle = (i / n) * Math.PI * 2;
        const dist  = r * (0.7 + Math.random() * 0.45);
        verts.push({ x: Math.cos(angle) * dist, y: Math.sin(angle) * dist });
    }
    return verts;
}

function spawnAsteroid(x, y, size) {
    const r     = SIZES[size];
    const angle = Math.random() * Math.PI * 2;
    const speed = size === 'large' ? 0.6 + Math.random() * 0.5
                : size === 'medium' ? 1.0 + Math.random() * 0.8
                : 1.6 + Math.random() * 1.0;
    return {
        x, y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        size,
        r,
        verts: randomAsteroidVerts(r),
        spin: (Math.random() - 0.5) * 0.03,
        angle: 0,
    };
}

function spawnWaveAsteroids(waveNum) {
    const count = 3 + waveNum;
    for (let i = 0; i < count; i++) {
        // Spawn away from ship centre
        let x, y;
        do {
            x = Math.random() * canvas.width;
            y = Math.random() * canvas.height;
        } while (Math.hypot(x - canvas.width / 2, y - canvas.height / 2) < 180);
        asteroids.push(spawnAsteroid(x, y, 'large'));
    }
}

// ── Bullets ────────────────────────────────────────────────────────────────────
const BULLET_SPEED  = 7;
const BULLET_LIFE   = 62;
const MAX_BULLETS   = 6;

// ── Particles ─────────────────────────────────────────────────────────────────
function spawnExplosion(x, y, count, hue) {
    for (let i = 0; i < count; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = 1 + Math.random() * 3;
        particles.push({
            x, y,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed,
            life: 1,
            hue: hue + (Math.random() - 0.5) * 40,
            r: 1 + Math.random() * 2,
        });
    }
}

// ── Floating text ──────────────────────────────────────────────────────────────
function addFloat(text, x, y, big) {
    floatingTexts.push({ text, x, y, life: 1, big: !!big });
}

// ── Init ───────────────────────────────────────────────────────────────────────
function initGame() {
    ship         = createShip();
    bullets      = [];
    asteroids    = [];
    particles    = [];
    floatingTexts= [];
    score        = 0;
    lives        = 3;
    wave         = 0;
    invincFrames = 120;
    shakeFrames  = 0;
    waveDelayFrames = 0;
    startWave();
}

function startWave() {
    wave++;
    waveDelayFrames = 0;
    spawnWaveAsteroids(wave);
    addFloat(`WAVE ${wave}`, canvas.width / 2, canvas.height / 2, true);
}

// ── Collision helpers ──────────────────────────────────────────────────────────
function circleHit(ax, ay, ar, bx, by, br) {
    return Math.hypot(ax - bx, ay - by) < ar + br;
}

function wrapPos(obj) {
    const m = 60;
    if (obj.x < -m) obj.x = canvas.width  + m;
    if (obj.x >  canvas.width  + m) obj.x = -m;
    if (obj.y < -m) obj.y = canvas.height + m;
    if (obj.y >  canvas.height + m) obj.y = -m;
}

// ── Update ─────────────────────────────────────────────────────────────────────
function update() {
    if (state !== STATE.PLAYING) return;

    // Wave clear check
    if (asteroids.length === 0 && waveDelayFrames === 0) {
        waveDelayFrames = 120; // 2s pause before next wave
    }
    if (waveDelayFrames > 0) {
        waveDelayFrames--;
        if (waveDelayFrames === 0) startWave();
        // Still allow movement during pause
    }

    // ── Ship ──────────────────────────────────────────────────────────────────
    const ROTATE_SPEED = 0.07;
    const THRUST       = 0.18;
    const DRAG         = 0.98;

    if (keys['ArrowLeft']  || keys['a'] || keys['A']) ship.angle -= ROTATE_SPEED;
    if (keys['ArrowRight'] || keys['d'] || keys['D']) ship.angle += ROTATE_SPEED;

    if (keys['ArrowUp'] || keys['w'] || keys['W']) {
        ship.vx += Math.cos(ship.angle) * THRUST;
        ship.vy += Math.sin(ship.angle) * THRUST;
        // Thrust trail particles
        if (Math.random() < 0.4) {
            const tx = ship.x - Math.cos(ship.angle) * 14;
            const ty = ship.y - Math.sin(ship.angle) * 14;
            particles.push({
                x: tx + (Math.random() - 0.5) * 6,
                y: ty + (Math.random() - 0.5) * 6,
                vx: -Math.cos(ship.angle) * (1 + Math.random()),
                vy: -Math.sin(ship.angle) * (1 + Math.random()),
                life: 0.5 + Math.random() * 0.3,
                hue: 30 + Math.random() * 30,
                r: 1.5,
            });
        }
    }

    const spd = Math.hypot(ship.vx, ship.vy);
    if (spd > 7) { ship.vx = ship.vx / spd * 7; ship.vy = ship.vy / spd * 7; }
    ship.vx *= DRAG;
    ship.vy *= DRAG;
    ship.x  += ship.vx;
    ship.y  += ship.vy;
    wrapPos(ship);

    if (ship.shootCooldown > 0) ship.shootCooldown--;
    if ((keys[' '] || keys['Space']) && ship.shootCooldown === 0 && bullets.length < MAX_BULLETS) {
        bullets.push({
            x: ship.x + Math.cos(ship.angle) * 16,
            y: ship.y + Math.sin(ship.angle) * 16,
            vx: Math.cos(ship.angle) * BULLET_SPEED + ship.vx * 0.4,
            vy: Math.sin(ship.angle) * BULLET_SPEED + ship.vy * 0.4,
            life: BULLET_LIFE,
        });
        ship.shootCooldown = 10;
    }

    if (invincFrames > 0) invincFrames--;
    if (shakeFrames  > 0) shakeFrames--;

    // ── Bullets ───────────────────────────────────────────────────────────────
    for (let i = bullets.length - 1; i >= 0; i--) {
        const b = bullets[i];
        b.x += b.vx; b.y += b.vy;
        b.life--;
        wrapPos(b);
        if (b.life <= 0) { bullets.splice(i, 1); continue; }

        // Bullet–asteroid collision
        let hit = false;
        for (let j = asteroids.length - 1; j >= 0; j--) {
            const a = asteroids[j];
            if (circleHit(b.x, b.y, 4, a.x, a.y, a.r * 0.8)) {
                const pts = POINTS[a.size];
                score += pts;
                addFloat(`+${pts}`, a.x, a.y, false);
                spawnExplosion(a.x, a.y, a.size === 'small' ? 12 : 7, 180);

                // Split
                if (a.size === 'large') {
                    asteroids.push(spawnAsteroid(a.x, a.y, 'medium'));
                    asteroids.push(spawnAsteroid(a.x, a.y, 'medium'));
                } else if (a.size === 'medium') {
                    asteroids.push(spawnAsteroid(a.x, a.y, 'small'));
                    asteroids.push(spawnAsteroid(a.x, a.y, 'small'));
                }

                asteroids.splice(j, 1);
                bullets.splice(i, 1);
                hit = true;
                break;
            }
        }
        if (hit) continue;
    }

    // ── Asteroids ─────────────────────────────────────────────────────────────
    for (const a of asteroids) {
        a.x += a.vx; a.y += a.vy;
        a.angle += a.spin;
        wrapPos(a);
    }

    // ── Ship–asteroid collision ────────────────────────────────────────────────
    if (invincFrames === 0) {
        for (const a of asteroids) {
            if (circleHit(ship.x, ship.y, 10, a.x, a.y, a.r * 0.75)) {
                lives--;
                shakeFrames = 18;
                spawnExplosion(ship.x, ship.y, 20, 210);
                if (lives <= 0) {
                    if (score > highScore) {
                        highScore = score;
                        localStorage.setItem('asteroidsHighScore', highScore);
                    }
                    state = STATE.DEAD;
                    return;
                }
                ship = createShip();
                invincFrames = 150;
                break;
            }
        }
    }

    // ── Particles ─────────────────────────────────────────────────────────────
    for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.x += p.vx; p.y += p.vy;
        p.vx *= 0.97; p.vy *= 0.97;
        p.life -= 0.022;
        if (p.life <= 0) particles.splice(i, 1);
    }

    // ── Floating texts ────────────────────────────────────────────────────────
    for (let i = floatingTexts.length - 1; i >= 0; i--) {
        const t = floatingTexts[i];
        t.y -= t.big ? 0.4 : 0.8;
        t.life -= t.big ? 0.008 : 0.016;
        if (t.life <= 0) floatingTexts.splice(i, 1);
    }
}

// ── Draw helpers ───────────────────────────────────────────────────────────────
function drawShip() {
    if (invincFrames > 0 && Math.floor(invincFrames / 6) % 2 === 0) return; // flash

    ctx.save();
    ctx.translate(ship.x, ship.y);
    ctx.rotate(ship.angle);

    const thrustOn = keys['ArrowUp'] || keys['w'] || keys['W'];

    // Thrust flame
    if (thrustOn) {
        ctx.beginPath();
        ctx.moveTo(-10, -5);
        ctx.lineTo(-18 - Math.random() * 8, 0);
        ctx.lineTo(-10,  5);
        ctx.strokeStyle = `hsl(${30 + Math.random() * 40}, 100%, 65%)`;
        ctx.lineWidth = 2;
        ctx.shadowColor = 'rgba(255,150,0,0.8)';
        ctx.shadowBlur = 10;
        ctx.stroke();
        ctx.shadowBlur = 0;
    }

    // Ship body
    ctx.beginPath();
    ctx.moveTo(14, 0);
    ctx.lineTo(-10, -9);
    ctx.lineTo(-5, 0);
    ctx.lineTo(-10, 9);
    ctx.closePath();
    ctx.strokeStyle = 'rgba(140,220,255,0.95)';
    ctx.lineWidth = 1.5;
    ctx.shadowColor = 'rgba(140,220,255,0.6)';
    ctx.shadowBlur = 8;
    ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.restore();
}

function drawAsteroid(a) {
    ctx.save();
    ctx.translate(a.x, a.y);
    ctx.rotate(a.angle);
    ctx.beginPath();
    ctx.moveTo(a.verts[0].x, a.verts[0].y);
    for (let i = 1; i < a.verts.length; i++) ctx.lineTo(a.verts[i].x, a.verts[i].y);
    ctx.closePath();
    ctx.strokeStyle = 'rgba(180,160,140,0.9)';
    ctx.lineWidth = 1.5;
    ctx.shadowColor = 'rgba(200,180,160,0.3)';
    ctx.shadowBlur = 6;
    ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.restore();
}

function drawBullet(b) {
    ctx.beginPath();
    ctx.arc(b.x, b.y, 3, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255,230,120,0.95)';
    ctx.shadowColor = 'rgba(255,220,80,0.8)';
    ctx.shadowBlur = 8;
    ctx.fill();
    ctx.shadowBlur = 0;
}

function drawParticles() {
    for (const p of particles) {
        ctx.globalAlpha = p.life * 0.85;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r * p.life, 0, Math.PI * 2);
        ctx.fillStyle = `hsl(${p.hue}, 80%, 65%)`;
        ctx.shadowColor = `hsl(${p.hue}, 80%, 60%)`;
        ctx.shadowBlur = 6;
        ctx.fill();
        ctx.shadowBlur = 0;
    }
    ctx.globalAlpha = 1;
}

function drawHUD() {
    ctx.font = '14px "Space Mono", monospace';
    ctx.shadowBlur = 0;

    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    ctx.textAlign = 'left';
    ctx.fillText(`Score: ${score}`, 20, 28);

    ctx.textAlign = 'right';
    ctx.fillText(`Best: ${highScore}`, canvas.width - 20, 28);

    // Lives as dots
    ctx.textAlign = 'center';
    const livesStr = '● '.repeat(lives).trim();
    ctx.fillStyle = 'rgba(140,220,255,0.7)';
    ctx.fillText(livesStr, canvas.width / 2, 28);
}

// ── Mobile touch controls ──────────────────────────────────────────────────────
const isMobile = navigator.maxTouchPoints > 0 && window.innerWidth <= 1024;
const BTNS = [
    { key: 'ArrowLeft',  label: '◁', cx: () => 60,               cy: () => canvas.height - 64  },
    { key: 'ArrowRight', label: '▷', cx: () => 160,              cy: () => canvas.height - 64  },
    { key: 'ArrowUp',    label: '△', cx: () => canvas.width - 70, cy: () => canvas.height - 150 },
    { key: ' ',          label: '●', cx: () => canvas.width - 70, cy: () => canvas.height - 58  },
];
const BTN_R = 44;
const activePointers = {};

function btnAt(x, y) {
    return BTNS.find(b => Math.hypot(x - b.cx(), y - b.cy()) <= BTN_R);
}

function drawTouchControls() {
    if (!isMobile || state !== STATE.PLAYING) return;
    for (const b of BTNS) {
        const active = keys[b.key];
        ctx.beginPath();
        ctx.arc(b.cx(), b.cy(), BTN_R, 0, Math.PI * 2);
        ctx.fillStyle   = active ? 'rgba(140,220,255,0.25)' : 'rgba(255,255,255,0.07)';
        ctx.fill();
        ctx.strokeStyle = active ? 'rgba(140,220,255,0.6)'  : 'rgba(255,255,255,0.2)';
        ctx.lineWidth   = 1.5;
        ctx.stroke();
        ctx.font         = '22px "Space Mono", monospace';
        ctx.textAlign    = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle    = active ? 'rgba(140,220,255,0.9)' : 'rgba(255,255,255,0.4)';
        ctx.fillText(b.label, b.cx(), b.cy());
    }
    ctx.textBaseline = 'alphabetic';
}

function drawFloatingTexts() {
    for (const t of floatingTexts) {
        ctx.globalAlpha = t.life;
        ctx.textAlign = 'center';
        if (t.big) {
            ctx.font = 'bold 32px "Space Mono", monospace';
            ctx.fillStyle = 'rgba(140,220,255,0.9)';
            ctx.shadowColor = 'rgba(140,220,255,0.5)';
            ctx.shadowBlur = 20;
        } else {
            ctx.font = '13px "Space Mono", monospace';
            ctx.fillStyle = 'rgba(255,230,120,0.9)';
            ctx.shadowBlur = 0;
        }
        ctx.fillText(t.text, t.x, t.y);
        ctx.shadowBlur = 0;
    }
    ctx.globalAlpha = 1;
}

function drawOverlay(lines, sublines) {
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const cy = canvas.height / 2;
    ctx.textAlign = 'center';
    ctx.shadowBlur = 0;

    lines.forEach((line, i) => {
        const pulse = 0.75 + 0.25 * Math.sin(Date.now() / 600 + i);
        ctx.globalAlpha = pulse;
        ctx.font = i === 0 ? 'bold 28px "Space Mono", monospace' : '14px "Space Mono", monospace';
        ctx.fillStyle = i === 0 ? 'rgba(140,220,255,1)' : 'rgba(255,255,255,0.7)';
        ctx.fillText(line, canvas.width / 2, cy - 20 + i * 38);
    });

    if (sublines) {
        ctx.globalAlpha = 0.5;
        ctx.font = '12px "Space Mono", monospace';
        ctx.fillStyle = 'rgba(200,200,200,0.7)';
        sublines.forEach((line, i) => {
            ctx.fillText(line, canvas.width / 2, cy + 80 + i * 22);
        });
    }

    ctx.globalAlpha = 1;
}

// ── Render ─────────────────────────────────────────────────────────────────────
function render() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (shakeFrames > 0) {
        const dx = (Math.random() - 0.5) * 8;
        const dy = (Math.random() - 0.5) * 8;
        ctx.save();
        ctx.translate(dx, dy);
    }

    if (state === STATE.WAITING) {
        const sublines = isMobile
            ? ['Tap to start', 'Hold landing page to open terminal']
            : ['← → / A D   Rotate', '↑ / W   Thrust', 'Space   Fire', `Best: ${highScore}`];
        drawOverlay(['ASTEROIDS', isMobile ? 'Tap to start' : 'Press any key to start'], sublines);
        return;
    }

    // Draw game objects
    for (const a of asteroids) drawAsteroid(a);
    drawParticles();
    for (const b of bullets) drawBullet(b);
    if (state === STATE.PLAYING) drawShip();
    drawFloatingTexts();
    drawHUD();
    drawTouchControls();

    if (state === STATE.DEAD) {
        drawOverlay(
            ['GAME OVER', `Score: ${score}`, `Best: ${highScore}`],
            [isMobile ? 'Tap to restart' : 'Press any key to restart']
        );
    }

    if (shakeFrames > 0) ctx.restore();
}

// ── Game loop ──────────────────────────────────────────────────────────────────
function loop() {
    update();
    render();
    requestAnimationFrame(loop);
}

// ── Input ──────────────────────────────────────────────────────────────────────
document.addEventListener('keydown', (e) => {
    keys[e.key] = true;

    if (state === STATE.WAITING || state === STATE.DEAD) {
        // Ignore modifier-only keys
        if (['Shift','Control','Alt','Meta','Tab'].includes(e.key)) return;
        if (state === STATE.WAITING) { state = STATE.PLAYING; initGame(); }
        else                         { state = STATE.PLAYING; initGame(); }
    }
});

document.addEventListener('keyup', (e) => {
    keys[e.key] = false;
});

// Touch / pointer controls (replaces old touchstart/touchend)
canvas.addEventListener('pointerdown', (e) => {
    if (isMobile) {
        const btn = btnAt(e.clientX, e.clientY);
        if (btn) {
            keys[btn.key] = true;
            activePointers[e.pointerId] = btn.key;
            return;
        }
    }
    if (state !== STATE.PLAYING) {
        state = STATE.PLAYING;
        initGame();
    }
});

canvas.addEventListener('pointerup', (e) => {
    const k = activePointers[e.pointerId];
    if (k) { keys[k] = false; delete activePointers[e.pointerId]; }
});

canvas.addEventListener('pointercancel', (e) => {
    const k = activePointers[e.pointerId];
    if (k) { keys[k] = false; delete activePointers[e.pointerId]; }
});

// ── Start ──────────────────────────────────────────────────────────────────────
loop();
