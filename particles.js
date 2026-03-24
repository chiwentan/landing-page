const canvas = document.getElementById('bg');
const ctx = canvas.getContext('2d');

let mouse = { x: -9999, y: -9999 };
let particles = [];
let ripples = [];
let lastIdleTime = Date.now();
const IDLE_PULSE_INTERVAL = 4000;
const CONNECTION_DIST = 120;
const ATTRACTION_DIST = 200;
const REPULSION_DIST = 150;

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
    if (nearMouse) { r = 180; g = 220; b = 255; }
    else if (midRange) {
      const t = 1 - distToMouse / ATTRACTION_DIST;
      g = Math.round(255 - t * 35);
      b = Math.round(255);
      r = Math.round(255 - t * 75);
    }

    ctx.beginPath();
    ctx.arc(this.x, this.y, radius, 0, Math.PI * 2);
    ctx.fillStyle = `rgb(${r},${g},${b})`;
    ctx.shadowColor = nearMouse ? 'rgba(180,220,255,0.8)' : 'rgba(255,255,255,0.4)';
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
    r.radius += 3;
    r.alpha -= 0.018;
    if (r.alpha <= 0) { ripples.splice(i, 1); continue; }
    ctx.beginPath();
    ctx.arc(r.x, r.y, r.radius, 0, Math.PI * 2);
    ctx.strokeStyle = `rgba(180,220,255,${r.alpha})`;
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }
}

function triggerIdlePulse() {
  const p = particles[Math.floor(Math.random() * particles.length)];
  ripples.push({ x: p.x, y: p.y, radius: 2, alpha: 0.25 });
}

function animate() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawConnections();
  for (const p of particles) { p.update(); p.draw(); }
  drawRipples();

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
  ripples.push({ x, y, radius: 2, alpha: 0.6 });
  lastIdleTime = Date.now(); // reset idle timer after interaction
}

// Events
window.addEventListener('resize', resize);

window.addEventListener('mousemove', (e) => {
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

// Init
resize();
for (let i = 0; i < particleCount(); i++) particles.push(new Particle());
animate();
