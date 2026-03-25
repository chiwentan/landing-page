const canvas = document.getElementById('bg');
const ctx = canvas.getContext('2d');

let mouse = { x: -9999, y: -9999 };
let particles = [];
let ripples = [];
let trailParticles = []; // L1: comet trail
let lastIdleTime = Date.now();
const IDLE_PULSE_INTERVAL = 4000;
const CONNECTION_DIST = 120;
const ATTRACTION_DIST = 200;
const REPULSION_DIST = 150;

// L5: cache text element for proximity glow
const textEl = document.querySelector('.animated-text');

function particleCount() {
  const w = window.innerWidth;
  if (w < 600) return 35;
  if (w < 900) return 55;
  return 80;
}

class Particle {
  constructor() {
    this.reset(true);
  }

  reset(randomPos) {
    this.x = randomPos ? Math.random() * canvas.width : this.x;
    this.y = randomPos ? Math.random() * canvas.height : this.y;
    const angle = Math.random() * Math.PI * 2;
    const speed = 0.3 + Math.random() * 0.4;
    this.vx = Math.cos(angle) * speed;
    this.vy = Math.sin(angle) * speed;
  }

  update() {
    // Mouse attraction
    const dx = mouse.x - this.x;
    const dy = mouse.y - this.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < ATTRACTION_DIST && dist > 0) {
      const force = 0.003 * (1 - dist / ATTRACTION_DIST);
      this.vx += dx / dist * force * dist;
      this.vy += dy / dist * force * dist;
    }

    // Speed cap
    const speed = Math.sqrt(this.vx * this.vx + this.vy * this.vy);
    if (speed > 2.5) {
      this.vx = (this.vx / speed) * 2.5;
      this.vy = (this.vy / speed) * 2.5;
    }

    this.x += this.vx;
    this.y += this.vy;

    // Bounce off edges
    if (this.x < 0) { this.x = 0; this.vx *= -1; }
    if (this.x > canvas.width) { this.x = canvas.width; this.vx *= -1; }
    if (this.y < 0) { this.y = 0; this.vy *= -1; }
    if (this.y > canvas.height) { this.y = canvas.height; this.vy *= -1; }
  }

  draw() {
    const dx = mouse.x - this.x;
    const dy = mouse.y - this.y;
    const distToMouse = Math.sqrt(dx * dx + dy * dy);
    const nearMouse = distToMouse < 50;
    const midRange = distToMouse < ATTRACTION_DIST;

    const radius = nearMouse ? 3 : 2;
    let r = 255, g = 255, b = 255;

    // L3: slowly cycle hue for near-mouse particles
    const accentHue = (Date.now() / 200) % 360;

    if (!nearMouse && midRange) {
      const t = 1 - distToMouse / ATTRACTION_DIST;
      g = Math.round(255 - t * 35);
      b = Math.round(255);
      r = Math.round(255 - t * 75);
    }

    ctx.beginPath();
    ctx.arc(this.x, this.y, radius, 0, Math.PI * 2);
    if (nearMouse) {
      ctx.fillStyle = `hsl(${accentHue}, 65%, 85%)`;
      ctx.shadowColor = `hsla(${accentHue}, 70%, 80%, 0.8)`;
    } else {
      ctx.fillStyle = `rgb(${r},${g},${b})`;
      ctx.shadowColor = 'rgba(255,255,255,0.4)';
    }
    ctx.shadowBlur = nearMouse ? 10 : 6;
    ctx.fill();
    ctx.shadowBlur = 0;
  }
}

function drawConnections() {
  for (let i = 0; i < particles.length; i++) {
    for (let j = i + 1; j < particles.length; j++) {
      const dx = particles[i].x - particles[j].x;
      const dy = particles[i].y - particles[j].y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < CONNECTION_DIST) {
        const alpha = (1 - dist / CONNECTION_DIST) * 0.3;
        ctx.beginPath();
        ctx.moveTo(particles[i].x, particles[i].y);
        ctx.lineTo(particles[j].x, particles[j].y);
        ctx.strokeStyle = `rgba(255,255,255,${alpha})`;
        ctx.lineWidth = 1;
        ctx.stroke();
      }
    }
  }
}

function drawRipples() {
  for (let i = ripples.length - 1; i >= 0; i--) {
    const r = ripples[i];
    r.radius += r.grow || 3; // L2: per-ripple grow rate
    r.alpha -= 0.018;
    if (r.alpha <= 0) { ripples.splice(i, 1); continue; }
    ctx.beginPath();
    ctx.arc(r.x, r.y, r.radius, 0, Math.PI * 2);
    ctx.strokeStyle = `rgba(180,220,255,${r.alpha})`;
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }
}

// L1: draw and update comet trail particles
function drawTrail() {
  const hue = (Date.now() / 200) % 360;
  for (let i = trailParticles.length - 1; i >= 0; i--) {
    const p = trailParticles[i];
    p.x += p.vx;
    p.y += p.vy;
    p.life -= 0.045;
    if (p.life <= 0) { trailParticles.splice(i, 1); continue; }
    ctx.globalAlpha = p.life * 0.65;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.r * p.life, 0, Math.PI * 2);
    ctx.fillStyle = `hsl(${hue}, 70%, 85%)`;
    ctx.shadowColor = `hsl(${hue}, 70%, 80%)`;
    ctx.shadowBlur = 4;
    ctx.fill();
    ctx.shadowBlur = 0;
  }
  ctx.globalAlpha = 1;
}

// L5: brighten email text when cursor approaches
function updateTextProximity() {
  if (!textEl) return;
  const rect = textEl.getBoundingClientRect();
  const cx = rect.left + rect.width / 2;
  const cy = rect.top + rect.height / 2;
  const dist = Math.sqrt((mouse.x - cx) ** 2 + (mouse.y - cy) ** 2);
  const t = Math.max(0, 1 - dist / 280);
  const glowBlur = t * 20;
  const glowAlpha = t * 0.28;
  textEl.style.textShadow = `0 0 12px rgba(0,0,0,0.95), 0 0 6px #000` +
    (glowAlpha > 0.01 ? `, 0 0 ${glowBlur.toFixed(1)}px rgba(232,232,232,${glowAlpha.toFixed(2)})` : '');
}

function triggerIdlePulse() {
  const p = particles[Math.floor(Math.random() * particles.length)];
  ripples.push({ x: p.x, y: p.y, radius: 2, alpha: 0.25, grow: 3 });
}

function animate() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawConnections();
  drawTrail(); // L1: trail under particles
  for (const p of particles) { p.update(); p.draw(); }
  drawRipples();
  updateTextProximity(); // L5

  if (Date.now() - lastIdleTime > IDLE_PULSE_INTERVAL) {
    triggerIdlePulse();
    lastIdleTime = Date.now();
  }

  requestAnimationFrame(animate);
}

function resize() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;

  // Adjust particle count if needed
  const target = particleCount();
  while (particles.length < target) particles.push(new Particle());
  while (particles.length > target) particles.pop();

  // Clamp positions to new bounds
  for (const p of particles) {
    p.x = Math.min(p.x, canvas.width);
    p.y = Math.min(p.y, canvas.height);
  }
}

function handleRepulsion(x, y) {
  for (const p of particles) {
    const dx = p.x - x;
    const dy = p.y - y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < REPULSION_DIST && dist > 0) {
      const force = (1 - dist / REPULSION_DIST) * 5;
      p.vx += (dx / dist) * force;
      p.vy += (dy / dist) * force;
    }
  }
  // L2: double-ring shockwave — primary ring + faster outer ring
  ripples.push({ x, y, radius: 2, alpha: 0.6, grow: 3 });
  ripples.push({ x, y, radius: 2, alpha: 0.35, grow: 5.5 });
  lastIdleTime = Date.now();
}

// Events
window.addEventListener('resize', resize);

window.addEventListener('mousemove', (e) => {
  // L1: compute velocity before updating mouse position, spawn trail if moving fast
  const vx = e.clientX - mouse.x;
  const vy = e.clientY - mouse.y;
  const spd = Math.sqrt(vx * vx + vy * vy);
  if (mouse.x > -9000 && spd > 5) {
    const count = Math.min(Math.floor(spd / 6), 4);
    for (let i = 0; i < count; i++) {
      trailParticles.push({
        x: mouse.x + (Math.random() - 0.5) * 6,
        y: mouse.y + (Math.random() - 0.5) * 6,
        vx: (Math.random() - 0.5) * 0.8,
        vy: (Math.random() - 0.5) * 0.8,
        life: 0.5 + Math.random() * 0.3,
        r: 1 + Math.random(),
      });
    }
  }
  mouse.x = e.clientX;
  mouse.y = e.clientY;
  lastIdleTime = Date.now();
});

window.addEventListener('click', (e) => {
  handleRepulsion(e.clientX, e.clientY);
});

window.addEventListener('touchmove', (e) => {
  e.preventDefault();
  const t = e.touches[0];
  mouse.x = t.clientX;
  mouse.y = t.clientY;
  lastIdleTime = Date.now();
}, { passive: false });

window.addEventListener('touchstart', (e) => {
  const t = e.touches[0];
  handleRepulsion(t.clientX, t.clientY);
  lastIdleTime = Date.now();
});

window.addEventListener('touchend', () => {
  mouse.x = -9999;
  mouse.y = -9999;
});

// Long-press (500ms) anywhere on landing page → open terminal
let longPressTimer = null;
window.addEventListener('pointerdown', () => {
  longPressTimer = setTimeout(() => {
    window.dispatchEvent(new Event('open-terminal'));
  }, 500);
});
window.addEventListener('pointerup',     () => clearTimeout(longPressTimer));
window.addEventListener('pointermove',   () => clearTimeout(longPressTimer));
window.addEventListener('pointercancel', () => clearTimeout(longPressTimer));

// ── Matrix rain ────────────────────────────────────────────────────────────────
const MATRIX_CHARS = 'アイウエオカキクケコサシスセソタチツテトナニヌネノハヒフヘホマミムメモヤユヨラリルレロワヲン0123456789ABCDEF';
let matrixActive = false;
let matrixRafId  = null;
let mainRafId    = null;
let matrixCols   = [];

function triggerMatrix() {
    if (matrixActive) return;
    matrixActive = true;

    // pause main particle loop — cancel the next scheduled frame
    // (animate() already scheduled itself; we let it run once more then take over)
    const colW = 16;
    const cols  = Math.floor(canvas.width / colW);
    matrixCols  = Array.from({ length: cols }, () => Math.random() * canvas.height);

    let endTimer = null;

    function matrixFrame() {
        if (!matrixActive) return;

        // Dim previous frame
        ctx.fillStyle = 'rgba(0,0,0,0.08)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        ctx.font = `14px "Space Mono", monospace`;

        for (let i = 0; i < matrixCols.length; i++) {
            const char = MATRIX_CHARS[Math.floor(Math.random() * MATRIX_CHARS.length)];
            const x    = i * colW;
            const y    = matrixCols[i];

            // Bright leading character
            ctx.fillStyle  = 'rgba(200,255,200,0.95)';
            ctx.shadowColor = 'rgba(0,255,80,0.9)';
            ctx.shadowBlur  = 8;
            ctx.fillText(char, x, y);
            ctx.shadowBlur  = 0;

            // Advance column; reset randomly
            matrixCols[i] += 18;
            if (matrixCols[i] > canvas.height && Math.random() > 0.975) {
                matrixCols[i] = 0;
            }
        }

        matrixRafId = requestAnimationFrame(matrixFrame);
    }

    // Hijack: cancel the pending particle animate frame and start matrix
    // We track the raf id via a wrapper
    matrixFrame();

    // After 6s fade out and restore
    endTimer = setTimeout(() => {
        matrixActive = false;
        if (matrixRafId) cancelAnimationFrame(matrixRafId);
        // Fade out over ~0.8s then resume particles
        let fadeAlpha = 0;
        function fadeOut() {
            fadeAlpha += 0.06;
            ctx.fillStyle = `rgba(0,0,0,${Math.min(fadeAlpha, 1)})`;
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            if (fadeAlpha < 1) {
                requestAnimationFrame(fadeOut);
            } else {
                ctx.clearRect(0, 0, canvas.width, canvas.height);
                animate(); // resume particles
            }
        }
        fadeOut();
    }, 6000);
}

// ── Konami code ────────────────────────────────────────────────────────────────
const KONAMI_SEQ = ['ArrowUp','ArrowUp','ArrowDown','ArrowDown',
                    'ArrowLeft','ArrowRight','ArrowLeft','ArrowRight','b','a'];
let konamiIdx = 0;

document.addEventListener('keydown', (e) => {
    // Backtick → open terminal
    if (e.key === '`') {
        window.dispatchEvent(new Event('open-terminal'));
        return;
    }

    // Konami sequence tracking
    if (e.key === KONAMI_SEQ[konamiIdx]) {
        konamiIdx++;
        if (konamiIdx === KONAMI_SEQ.length) {
            konamiIdx = 0;
            triggerMatrix();
        }
    } else {
        konamiIdx = (e.key === KONAMI_SEQ[0]) ? 1 : 0;
    }
});

// Init
resize();
for (let i = 0; i < particleCount(); i++) particles.push(new Particle());
animate();
