const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const statusEl = document.getElementById('status');
const overlay = document.getElementById('overlay');
const houseButtons = document.querySelectorAll('.house-btn');

const W = 1600;
const H = 900;
const world = { width: 120, height: 120 };

const houseDefs = [
  { label: 'Cozy Cottage', x: 26, y: 28, w: 18, h: 18, color: '#d8a36b', roof: '#a55a34', door: '#5b3a29' },
  { label: 'Blue Bungalow', x: 54, y: 28, w: 18, h: 18, color: '#7bb7d7', roof: '#446d91', door: '#4c372d' },
  { label: 'Lilac Home', x: 82, y: 28, w: 18, h: 18, color: '#b06fd9', roof: '#6f3d9d', door: '#513b29' },
];

const npcNames = ['Mina', 'Tori', 'Jun', 'Pip', 'Lio', 'Sora', 'Nori'];
const npcLines = [
  'Nice day for a walk.',
  'I heard the shop has snacks today.',
  'This town is quiet, which I like.',
  'Your house looks neat.',
  'The square feels cozy, huh?',
];

let state = 'choose';
let selectedHouse = null;
let player = { x: 60, y: 74, speed: 0.16 };
let keys = {};
let npcTalk = '';
let keyLatch = {};
let npcs = [];
let pointerLocked = false;
let lookOffset = 0;
let pointerDown = false;
let lastTouchX = 0;
let lastTouchY = 0;
let zoom = 10;
let houseInterior = null;
let enteringFlash = 0;

function rand(min, max) { return Math.random() * (max - min) + min; }
function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }

function resize() {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.floor(canvas.clientWidth * dpr);
  canvas.height = Math.floor(canvas.clientHeight * dpr);
}

function resetTown() {
  selectedHouse = null;
  state = 'choose';
  houseInterior = null;
  npcTalk = '';
  player = { x: 60, y: 74, speed: 0.16 };
  npcs = Array.from({ length: 4 }, () => ({
    name: npcNames[Math.floor(Math.random() * npcNames.length)],
    x: rand(20, 100),
    y: rand(48, 100),
    dx: rand(-0.5, 0.5),
    dy: rand(-0.5, 0.5),
    talk: npcLines[Math.floor(Math.random() * npcLines.length)],
  }));
  overlay.classList.remove('hidden');
  statusEl.textContent = 'Choose a house in the square.';
  enteringFlash = 0;
}

function enterHouse(index) {
  selectedHouse = index;
  state = 'house';
  overlay.classList.add('hidden');
  houseInterior = { label: houseDefs[index].label, x: 56, y: 68 };
  player = { x: 60, y: 72, speed: 0.14 };
  statusEl.textContent = `Inside ${houseDefs[index].label}. E to leave.`;
}

function leaveHouse() {
  resetTown();
}

function chooseHouseFromOverlay(index) {
  enterHouse(index);
}

houseButtons.forEach((btn) => {
  btn.addEventListener('click', () => chooseHouseFromOverlay(Number(btn.dataset.house)));
});

function getNpcDialogue() {
  const npc = npcs[Math.floor(Math.random() * npcs.length)];
  return npc ? `${npc.name}: ${npc.talk}` : '...';
}

function drawRoundedRect(x, y, w, h, r, fill, stroke = null) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
  if (stroke) {
    ctx.strokeStyle = stroke;
    ctx.lineWidth = 3;
    ctx.stroke();
  }
}

function drawTown() {
  const cw = canvas.width;
  const ch = canvas.height;
  const scaleX = cw / world.width;
  const scaleY = ch / world.height;
  const scale = Math.min(scaleX, scaleY);
  const ox = (cw - world.width * scale) / 2;
  const oy = (ch - world.height * scale) / 2;

  ctx.fillStyle = '#9ad0ff';
  ctx.fillRect(0, 0, cw, ch);
  ctx.fillStyle = '#e9f4ff';
  ctx.fillRect(0, 0, cw, ch * 0.36);
  ctx.fillStyle = '#86bd67';
  ctx.fillRect(0, ch * 0.36, cw, ch * 0.64);

  ctx.save();
  ctx.translate(ox, oy);
  ctx.scale(scale, scale);

  // town square
  drawRoundedRect(42, 46, 56, 42, 4, '#d5c9af', '#a79774');

  // houses
  houseDefs.forEach((house) => {
    drawRoundedRect(house.x, house.y, house.w, house.h, 1.4, house.color, 'rgba(0,0,0,0.16)');
    ctx.fillStyle = house.roof;
    ctx.beginPath();
    ctx.moveTo(house.x - 1, house.y + 2);
    ctx.lineTo(house.x + house.w / 2, house.y - 5);
    ctx.lineTo(house.x + house.w + 1, house.y + 2);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = house.door;
    ctx.fillRect(house.x + house.w / 2 - 1.4, house.y + house.h - 6, 2.8, 6);
    ctx.fillStyle = '#dff7ff';
    ctx.fillRect(house.x + 3, house.y + 5, 4, 4);
    ctx.fillRect(house.x + house.w - 7, house.y + 5, 4, 4);
  });

  // NPCs
  npcs.forEach((npc) => {
    ctx.fillStyle = '#6c4a39';
    ctx.beginPath();
    ctx.arc(npc.x, npc.y + 4, 3.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#f4c7a8';
    ctx.beginPath();
    ctx.arc(npc.x, npc.y, 2.5, 0, Math.PI * 2);
    ctx.fill();
  });

  // Player
  ctx.fillStyle = '#315dff';
  ctx.beginPath();
  ctx.arc(player.x, player.y + 4, 3.6, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#ffd8ba';
  ctx.beginPath();
  ctx.arc(player.x, player.y, 2.8, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

function drawHouseInterior() {
  const cw = canvas.width;
  const ch = canvas.height;
  ctx.fillStyle = '#d9edf9';
  ctx.fillRect(0, 0, cw, ch);
  ctx.fillStyle = '#f5ddb8';
  ctx.fillRect(0, ch * 0.62, cw, ch * 0.38);

  // floor boards
  ctx.fillStyle = '#caa36c';
  for (let y = ch * 0.62; y < ch; y += 46) {
    ctx.fillRect(0, y, cw, 3);
  }

  // walls
  drawRoundedRect(cw * 0.08, ch * 0.12, cw * 0.84, ch * 0.52, 16, 'rgba(255,255,255,0.5)', 'rgba(0,0,0,0.12)');

  // furniture
  drawRoundedRect(cw * 0.18, ch * 0.54, cw * 0.24, ch * 0.13, 18, '#9c6a5d', '#6c443a');
  drawRoundedRect(cw * 0.56, ch * 0.38, cw * 0.22, ch * 0.18, 12, '#eadfc7', '#b8a68a');
  drawRoundedRect(cw * 0.60, ch * 0.56, cw * 0.16, ch * 0.08, 8, '#8f664f', '#5c4230');
  drawRoundedRect(cw * 0.34, ch * 0.48, cw * 0.09, ch * 0.09, 8, '#6fa86c', '#4f764d');

  // player
  const px = player.x / world.width * cw;
  const py = player.y / world.height * ch;
  ctx.fillStyle = '#315dff';
  ctx.beginPath();
  ctx.arc(px, py + 14, 12, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#ffd8ba';
  ctx.beginPath();
  ctx.arc(px, py, 10, 0, Math.PI * 2);
  ctx.fill();
}

function drawFlash() {
  if (enteringFlash <= 0) return;
  ctx.fillStyle = `rgba(255,255,255,${enteringFlash})`;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  enteringFlash = Math.max(0, enteringFlash - 0.02);
}

function updateTown() {
  npcs.forEach((npc) => {
    npc.x = clamp(npc.x + npc.dx, 18, 102);
    npc.y = clamp(npc.y + npc.dy, 50, 102);
    if (npc.x <= 18 || npc.x >= 102) npc.dx *= -1;
    if (npc.y <= 50 || npc.y >= 102) npc.dy *= -1;
  });
  const move = { x: 0, y: 0 };
  if (keys.KeyW) move.y -= 1;
  if (keys.KeyS) move.y += 1;
  if (keys.KeyA) move.x -= 1;
  if (keys.KeyD) move.x += 1;
  const mag = Math.hypot(move.x, move.y) || 1;
  player.x = clamp(player.x + (move.x / mag) * player.speed * 1.8, 16, 104);
  player.y = clamp(player.y + (move.y / mag) * player.speed * 1.8, 44, 104);

  if (keys.KeyE && !keyLatch.KeyE) {
    keyLatch.KeyE = true;
    const hit = houseDefs.findIndex((h) => Math.hypot(player.x - (h.x + h.w / 2), player.y - (h.y + h.h / 2)) < 8);
    if (hit >= 0) enterHouse(hit);
  }

  const nearby = npcs.find((npc) => Math.hypot(player.x - npc.x, player.y - npc.y) < 8);
  if (nearby && keys.KeyN && !keyLatch.KeyN) {
    keyLatch.KeyN = true;
    npcTalk = `${nearby.name}: ${nearby.talk}`;
    statusEl.textContent = npcTalk;
  } else if (!nearby && !npcTalk) {
    statusEl.textContent = 'Choose a house in the square.';
  }
}

function updateHouse() {
  const move = { x: 0, y: 0 };
  if (keys.KeyW) move.y -= 1;
  if (keys.KeyS) move.y += 1;
  if (keys.KeyA) move.x -= 1;
  if (keys.KeyD) move.x += 1;
  const mag = Math.hypot(move.x, move.y) || 1;
  player.x = clamp(player.x + (move.x / mag) * player.speed * 1.6, 12, 108);
  player.y = clamp(player.y + (move.y / mag) * player.speed * 1.6, 18, 108);
  if (keys.KeyE && !keyLatch.KeyE) {
    keyLatch.KeyE = true;
    leaveHouse();
  }
}

function loop() {
  resize();
  if (state === 'town') updateTown();
  else updateHouse();
  if (state === 'town') drawTown();
  else drawHouseInterior();
  drawFlash();
  requestAnimationFrame(loop);
}

canvas.addEventListener('click', () => {
  pointerLocked = true;
});

canvas.addEventListener('pointerdown', (event) => {
  pointerDown = true;
  lastTouchX = event.clientX;
  lastTouchY = event.clientY;
});
canvas.addEventListener('pointermove', (event) => {
  if (!pointerDown) return;
  const dx = event.clientX - lastTouchX;
  if (state === 'town') lookOffset += dx * 0.002;
  lastTouchX = event.clientX;
  lastTouchY = event.clientY;
});
canvas.addEventListener('pointerup', () => { pointerDown = false; });

document.addEventListener('keydown', (event) => {
  keys[event.code] = true;
  if (event.code === 'Escape') pointerLocked = false;
  if (event.code === 'KeyN' && state === 'town') {
    npcTalk = getNpcDialogue();
    statusEl.textContent = npcTalk;
  }
});
document.addEventListener('keyup', (event) => {
  keys[event.code] = false;
  keyLatch[event.code] = false;
});

document.addEventListener('mousemove', (event) => {
  if (!pointerLocked || state !== 'town') return;
  lookOffset += event.movementX * 0.002;
});

function setupOverlay() {
  houseButtons.forEach((btn) => btn.addEventListener('click', () => {
    selectedHouse = Number(btn.dataset.house);
    overlay.classList.add('hidden');
    enterHouse(selectedHouse);
  }));
}

function start() {
  setupOverlay();
  resetTown();
  loop();
}

window.addEventListener('resize', resize);
start();
