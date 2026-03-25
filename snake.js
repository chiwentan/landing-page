const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const CELL = 10;
const COLS = canvas.width / CELL;
const ROWS = canvas.height / CELL;

const STATE = { WAITING: 'waiting', PLAYING: 'playing', DEAD: 'dead' };
let state = STATE.WAITING;

let snake, dx, dy, nextDx, nextDy, foodX, foodY;
let score, gameSpeed, obstacles;
let particles = [], floatingTexts = [];
let lastTick = 0;
let newBest = false;
let shakeFrames = 0;      // S1: screen shake counter
let headHistory = [];     // S4: ghost trail positions
let currentLevel = 1;     // S3: track level for level-up flash

let highScore = parseInt(localStorage.getItem('snakeHighScore') || '0');

// ---- INIT ----

function startGame() {
  const mid = Math.floor(COLS / 2) * CELL;
  snake = [{ x: mid, y: mid }];
  dx = CELL; dy = 0;
  nextDx = CELL; nextDy = 0;
  score = 0;
  gameSpeed = 100;
  obstacles = [];
  particles = [];
  floatingTexts = [];
  headHistory = [];   // S4
  currentLevel = 1;  // S3
  newBest = false;
  canvas.classList.remove('new-best'); // S6
  createFood();
  state = STATE.PLAYING;
  lastTick = performance.now();
}

// ---- GAME LOOP ----

function gameLoop(ts) {
  if (state === STATE.PLAYING && ts - lastTick >= gameSpeed) {
    dx = nextDx;
    dy = nextDy;
    tick();
    lastTick = ts;
  }
  render(ts);
  requestAnimationFrame(gameLoop);
}

// ---- TICK ----

function tick() {
  // S4: record head position before moving for ghost trail
  headHistory.unshift({ x: snake[0].x, y: snake[0].y });
  if (headHistory.length > 6) headHistory.pop();

  const head = { x: snake[0].x + dx, y: snake[0].y + dy };
  snake.unshift(head);

  if (snake[0].x === foodX && snake[0].y === foodY) {
    score += 10;
    if (score > highScore) {
      highScore = score;
      newBest = true;
      localStorage.setItem('snakeHighScore', highScore);
      canvas.classList.add('new-best'); // S6
    }
    spawnParticles(foodX + CELL / 2, foodY + CELL / 2);
    floatingTexts.push({ x: foodX + CELL / 2, y: foodY, text: '+10', alpha: 1, vy: -1.2 });
    createFood();
    createObstacle();
    if (gameSpeed > 50) gameSpeed -= 5;

    // S3: detect level-up and show flash
    const newLevel = Math.round((100 - gameSpeed) / 5) + 1;
    if (newLevel > currentLevel) {
      currentLevel = newLevel;
      floatingTexts.push({
        x: canvas.width / 2,
        y: canvas.height / 2 + 10,
        text: `LV ${newLevel}`,
        alpha: 1,
        vy: -0.4,
        big: true,
      });
    }
  } else {
    snake.pop();
  }

  if (didGameEnd()) {
    state = STATE.DEAD;
    shakeFrames = 9; // S1: trigger shake on death
  }
}

// ---- COLLISION ----

function didGameEnd() {
  if (snake[0].x < 0 || snake[0].x >= canvas.width ||
      snake[0].y < 0 || snake[0].y >= canvas.height) return true;
  for (let i = 4; i < snake.length; i++) {
    if (snake[i].x === snake[0].x && snake[i].y === snake[0].y) return true;
  }
  return obstacles.some(o =>
    snake[0].x >= o.x && snake[0].x < o.x + o.w &&
    snake[0].y >= o.y && snake[0].y < o.y + o.h
  );
}

// ---- FOOD & OBSTACLES ----

function isOccupied(x, y) {
  if (snake.some(s => s.x === x && s.y === y)) return true;
  if (obstacles.some(o =>
    x >= o.x && x < o.x + o.w && y >= o.y && y < o.y + o.h
  )) return true;
  return false;
}

function createFood() {
  let x, y;
  do {
    x = Math.floor(Math.random() * COLS) * CELL;
    y = Math.floor(Math.random() * ROWS) * CELL;
  } while (isOccupied(x, y));
  foodX = x;
  foodY = y;
}

function createObstacle() {
  let x, y;
  let attempts = 0;
  do {
    x = Math.floor(Math.random() * COLS) * CELL;
    y = Math.floor(Math.random() * ROWS) * CELL;
    attempts++;
    if (attempts > 100) return;
  } while (isOccupied(x, y) || (x === foodX && y === foodY));
  const w = CELL * (Math.floor(Math.random() * 2) + 1);
  const h = CELL * (Math.floor(Math.random() * 2) + 1);
  obstacles.push({ x, y, w, h, alpha: 0 }); // S2: start transparent
}

// ---- PARTICLES ----

function spawnParticles(x, y) {
  for (let i = 0; i < 12; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = 1.5 + Math.random() * 3;
    particles.push({
      x, y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      life: 1,
      r: 1.5 + Math.random() * 2,
      hue: 100 + Math.random() * 60,
    });
  }
}

// ---- HELPERS ----

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

// ---- RENDER ----

function render(ts) {
  ctx.save();

  // S1: screen shake on death
  if (shakeFrames > 0) {
    const mag = shakeFrames * 0.55;
    ctx.translate((Math.random() * 2 - 1) * mag, (Math.random() * 2 - 1) * mag);
    shakeFrames--;
  }

  // Background
  ctx.fillStyle = '#080810';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Subtle grid
  ctx.strokeStyle = 'rgba(255,255,255,0.03)';
  ctx.lineWidth = 0.5;
  for (let x = 0; x <= canvas.width; x += CELL) {
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, canvas.height); ctx.stroke();
  }
  for (let y = 0; y <= canvas.height; y += CELL) {
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(canvas.width, y); ctx.stroke();
  }

  if (state !== STATE.WAITING) {
    drawObstacles();
    drawFood(ts);
    drawSnake(ts);
    updateAndDrawParticles();
    updateAndDrawFloatingTexts();
    drawHUD();
  }

  if (state === STATE.WAITING) drawWaitingScreen(ts);
  if (state === STATE.DEAD) drawGameOverScreen();

  ctx.restore();
}

function drawSnake(ts) {
  const level = Math.round((100 - gameSpeed) / 5) + 1;
  const isRainbow = level >= 8; // S5: rainbow mode at Lv 8+
  const len = snake.length;

  // S4: ghost trail — render previous head positions at low alpha
  for (let i = 0; i < headHistory.length; i++) {
    const g = headHistory[i];
    const a = (1 - (i + 1) / (headHistory.length + 1)) * 0.14;
    ctx.globalAlpha = a;
    ctx.fillStyle = isRainbow
      ? `hsl(${((ts * 0.06) % 360)}, 85%, 65%)`
      : 'rgba(80, 255, 100, 1)';
    roundRect(g.x + 1, g.y + 1, CELL - 2, CELL - 2, 3);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  // Main snake segments
  for (let i = len - 1; i >= 0; i--) {
    const seg = snake[i];
    const t = i / Math.max(len - 1, 1);
    const lightness = 65 - t * 32;
    const alpha = 1 - t * 0.25;

    if (isRainbow) {
      const hue = (i * 14 + ts * 0.06) % 360;
      ctx.fillStyle = `hsla(${hue}, 85%, ${lightness}%, ${alpha})`;
      if (i === 0) {
        ctx.shadowColor = `hsla(${(ts * 0.06) % 360}, 85%, 65%, 0.7)`;
        ctx.shadowBlur = 14;
      } else {
        ctx.shadowBlur = 0;
      }
    } else {
      ctx.fillStyle = `hsla(128, 75%, ${lightness}%, ${alpha})`;
      if (i === 0) {
        ctx.shadowColor = 'rgba(80, 255, 100, 0.7)';
        ctx.shadowBlur = 14;
      } else {
        ctx.shadowBlur = 0;
      }
    }
    roundRect(seg.x + 1, seg.y + 1, CELL - 2, CELL - 2, 3);
    ctx.fill();
  }
  ctx.shadowBlur = 0;

  // Eyes on head
  const head = snake[0];
  ctx.fillStyle = '#000';
  let eyes;
  if (dx === CELL)       eyes = [7, 2, 7, 6];
  else if (dx === -CELL) eyes = [1, 2, 1, 6];
  else if (dy === -CELL) eyes = [2, 1, 6, 1];
  else                   eyes = [2, 7, 6, 7];
  ctx.beginPath(); ctx.arc(head.x + eyes[0], head.y + eyes[1], 1.5, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(head.x + eyes[2], head.y + eyes[3], 1.5, 0, Math.PI * 2); ctx.fill();
}

function drawFood(ts) {
  const pulse = Math.sin(ts / 280) * 0.5 + 0.5;
  ctx.shadowColor = 'rgba(255, 70, 70, 0.9)';
  ctx.shadowBlur = 8 + pulse * 14;
  ctx.fillStyle = `hsl(0, 100%, ${50 + pulse * 18}%)`;
  roundRect(foodX + 1, foodY + 1, CELL - 2, CELL - 2, 3);
  ctx.fill();
  ctx.shadowBlur = 0;
}

function drawObstacles() {
  obstacles.forEach(o => {
    // S2: fade in from alpha 0
    if (o.alpha < 1) o.alpha = Math.min(1, o.alpha + 0.1);
    ctx.shadowColor = `rgba(160, 80, 255, ${0.5 * o.alpha})`;
    ctx.shadowBlur = 8;
    ctx.fillStyle = `rgba(110, 50, 200, ${0.85 * o.alpha})`;
    roundRect(o.x + 1, o.y + 1, o.w - 2, o.h - 2, 2);
    ctx.fill();
    ctx.strokeStyle = `rgba(180, 120, 255, ${0.8 * o.alpha})`;
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.shadowBlur = 0;
  });
}

function updateAndDrawParticles() {
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.x += p.vx;
    p.y += p.vy;
    p.life -= 0.03;
    p.vx *= 0.95;
    p.vy *= 0.95;
    if (p.life <= 0) { particles.splice(i, 1); continue; }
    ctx.globalAlpha = p.life;
    ctx.fillStyle = `hsl(${p.hue}, 100%, 65%)`;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.r * p.life, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

function updateAndDrawFloatingTexts() {
  for (let i = floatingTexts.length - 1; i >= 0; i--) {
    const t = floatingTexts[i];
    t.y += t.vy;
    t.alpha -= t.big ? 0.008 : 0.022; // S3: big level-up texts fade slower
    if (t.alpha <= 0) { floatingTexts.splice(i, 1); continue; }
    ctx.globalAlpha = t.alpha;
    if (t.big) {
      // S3: large centered level-up flash
      ctx.font = 'bold 26px "Space Mono", monospace';
      ctx.fillStyle = 'rgba(100, 255, 120, 1)';
      ctx.shadowColor = 'rgba(80, 255, 100, 0.8)';
      ctx.shadowBlur = 14;
    } else {
      ctx.font = 'bold 11px "Space Mono", monospace';
      ctx.fillStyle = '#7fff7f';
      ctx.shadowBlur = 0;
    }
    ctx.textAlign = 'center';
    ctx.fillText(t.text, t.x, t.y);
    ctx.shadowBlur = 0;
  }
  ctx.globalAlpha = 1;
}

function drawHUD() {
  const level = Math.round((100 - gameSpeed) / 5) + 1;
  ctx.font = '12px "Space Mono", monospace';
  ctx.textAlign = 'left';
  ctx.fillStyle = 'rgba(255,255,255,0.65)';
  ctx.fillText(`Score: ${score}`, 8, 16);
  ctx.textAlign = 'right';
  ctx.fillText(`Best: ${highScore}`, canvas.width - 8, 16);
  ctx.textAlign = 'center';
  ctx.fillStyle = 'rgba(255,255,255,0.3)';
  ctx.font = '10px "Space Mono", monospace';
  ctx.fillText(`Lv ${level}`, canvas.width / 2, 16);
}

function drawWaitingScreen(ts) {
  ctx.fillStyle = 'rgba(0,0,0,0.65)';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const pulse = Math.sin(ts / 600) * 0.15 + 0.85;
  ctx.textAlign = 'center';
  ctx.font = 'bold 38px "Space Mono", monospace';
  ctx.fillStyle = `rgba(100, 255, 120, ${pulse})`;
  ctx.shadowColor = 'rgba(80, 255, 100, 0.7)';
  ctx.shadowBlur = 20;
  ctx.fillText('SNAKE', canvas.width / 2, canvas.height / 2 - 28);
  ctx.shadowBlur = 0;

  ctx.fillStyle = 'rgba(255,255,255,0.7)';
  ctx.font = '13px "Space Mono", monospace';
  ctx.fillText('Press any key or tap to start', canvas.width / 2, canvas.height / 2 + 12);

  ctx.fillStyle = 'rgba(255,255,255,0.35)';
  ctx.font = '11px "Space Mono", monospace';
  ctx.fillText('Swipe  or  Arrow keys / WASD', canvas.width / 2, canvas.height / 2 + 32);

  if (highScore > 0) {
    ctx.fillStyle = 'rgba(255, 210, 80, 0.75)';
    ctx.font = '12px "Space Mono", monospace';
    ctx.fillText(`Best: ${highScore}`, canvas.width / 2, canvas.height / 2 + 58);
  }
}

function drawGameOverScreen() {
  ctx.fillStyle = 'rgba(0,0,0,0.72)';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.textAlign = 'center';
  ctx.font = 'bold 30px "Space Mono", monospace';
  ctx.fillStyle = '#ff5555';
  ctx.shadowColor = 'rgba(255, 80, 80, 0.6)';
  ctx.shadowBlur = 16;
  ctx.fillText('GAME OVER', canvas.width / 2, canvas.height / 2 - 38);
  ctx.shadowBlur = 0;

  ctx.font = '15px "Space Mono", monospace';
  ctx.fillStyle = 'rgba(255,255,255,0.9)';
  ctx.fillText(`Score: ${score}`, canvas.width / 2, canvas.height / 2 + 2);

  if (newBest && score > 0) {
    ctx.font = 'bold 14px "Space Mono", monospace';
    ctx.fillStyle = '#ffd700';
    ctx.shadowColor = 'rgba(255, 215, 0, 0.5)';
    ctx.shadowBlur = 10;
    ctx.fillText(`✦ New Best: ${highScore}! ✦`, canvas.width / 2, canvas.height / 2 + 24);
    ctx.shadowBlur = 0;
  } else if (highScore > 0) {
    ctx.font = '13px "Space Mono", monospace';
    ctx.fillStyle = 'rgba(255, 210, 80, 0.65)';
    ctx.fillText(`Best: ${highScore}`, canvas.width / 2, canvas.height / 2 + 24);
  }

  ctx.font = '12px "Space Mono", monospace';
  ctx.fillStyle = 'rgba(255,255,255,0.45)';
  ctx.fillText('Press any key or tap to restart', canvas.width / 2, canvas.height / 2 + 52);
}

// ---- INPUT ----

document.addEventListener('keydown', (e) => {
  if (state === STATE.WAITING || state === STATE.DEAD) {
    startGame();
    return;
  }
  const goingRight = dx === CELL, goingLeft = dx === -CELL;
  const goingUp = dy === -CELL, goingDown = dy === CELL;

  if ((e.key === 'ArrowLeft'  || e.key === 'a') && !goingRight) { nextDx = -CELL; nextDy = 0; }
  if ((e.key === 'ArrowRight' || e.key === 'd') && !goingLeft)  { nextDx = CELL;  nextDy = 0; }
  if ((e.key === 'ArrowUp'    || e.key === 'w') && !goingDown)  { nextDx = 0; nextDy = -CELL; }
  if ((e.key === 'ArrowDown'  || e.key === 's') && !goingUp)    { nextDx = 0; nextDy = CELL;  }
});

// Touch / swipe
let touchStartX = 0, touchStartY = 0;
canvas.addEventListener('touchstart', (e) => {
  touchStartX = e.touches[0].clientX;
  touchStartY = e.touches[0].clientY;
  if (state !== STATE.PLAYING) startGame();
  e.preventDefault();
}, { passive: false });

canvas.addEventListener('touchend', (e) => {
  if (state !== STATE.PLAYING) return;
  const ddx = e.changedTouches[0].clientX - touchStartX;
  const ddy = e.changedTouches[0].clientY - touchStartY;
  const goingRight = dx === CELL, goingLeft = dx === -CELL;
  const goingUp = dy === -CELL, goingDown = dy === CELL;
  if (Math.abs(ddx) > Math.abs(ddy)) {
    if (ddx > 20 && !goingLeft)  { nextDx = CELL;  nextDy = 0; }
    if (ddx < -20 && !goingRight) { nextDx = -CELL; nextDy = 0; }
  } else {
    if (ddy > 20 && !goingUp)    { nextDx = 0; nextDy = CELL;  }
    if (ddy < -20 && !goingDown)  { nextDx = 0; nextDy = -CELL; }
  }
  e.preventDefault();
}, { passive: false });

// ---- START ----
requestAnimationFrame(gameLoop);
