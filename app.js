const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const statusEl = document.getElementById('status');
const overlay = document.getElementById('overlay');
const houseButtons = document.querySelectorAll('.house-btn');

const WORLD_W = 120;
const WORLD_H = 120;

const houseDefs = [
  { label: 'Cozy Cottage', x: 24, y: 30, w: 20, h: 18, color: '#d8a36b', roof: '#a55a34', door: '#5b3a29' },
  { label: 'Blue Bungalow', x: 52, y: 30, w: 20, h: 18, color: '#7bb7d7', roof: '#446d91', door: '#4c372d' },
  { label: 'Lilac Home', x: 80, y: 30, w: 20, h: 18, color: '#b06fd9', roof: '#6f3d9d', door: '#513b29' },
];

const npcNames = ['Mina', 'Tori', 'Jun', 'Pip', 'Lio', 'Sora', 'Nori'];
const npcLines = [
  'Nice day for a walk.',
  'I heard the shop has snacks today.',
  'This town is quiet, which I like.',
  'Your house looks neat.',
  'The square feels cozy, huh?',
];

let state = 'town';
let selectedHouse = null;
let player = { x: 60, y: 86, speed: 0.12, size: 2.2 };
let keys = {};
let keyLatch = {};
let npcs = [];
let npcTalk = '';
let worldView = { w: WORLD_W, h: WORLD_H };
let insideHouse = null;
let pointerDown = false;
let lastTouchX = 0;
let lastTouchY = 0;
let dragYaw = 0;
let dragPitch = 0;
let enteringFlash = 0;

function rand(min, max) { return Math.random() * (max - min) + min; }
function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }

function resize() {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.floor(canvas.clientWidth * dpr);
  canvas.height = Math.floor(canvas.clientHeight * dpr);
}

function resetTown() {
  state = 'town';
  selectedHouse = null;
  insideHouse = null;
  npcTalk = '';
  player = { x: 60, y: 86, speed: 0.12, size: 2.2 };
  npcs = [{
    name: npcNames[Math.floor(Math.random() * npcNames.length)],
    x: 68,
    y: 84,
    dx: 0,
    dy: 0,
    talk: npcLines[Math.floor(Math.random() * npcLines.length)],
  }];
  overlay.classList.remove('hidden');
  statusEl.textContent = 'Choose a house in the square.';
  enteringFlash = 0;
}

function enterHouse(index) {
  selectedHouse = index;
  state = 'house';
  overlay.classList.add('hidden');
  insideHouse = { label: houseDefs[index].label };
  player = { x: 16, y: 84, speed: 0.11, size: 2.2 };
  npcTalk = '';
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
  const npc = npcs[0];
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

function drawSprite(x, y, size, color, skin = '#ffd8ba') {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(x, y + size * 1.1, size * 1.6, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = skin;
  ctx.beginPath();
  ctx.arc(x, y, size * 1.2, 0, Math.PI * 2);
  ctx.fill();
}

function drawTown() {
  const cw = canvas.width;
  const ch = canvas.height;
  const scaleX = cw / worldView.w;
  const scaleY = ch / worldView.h;
  const scale = Math.min(scaleX, scaleY) * 0.95;
  const ox = (cw - worldView.w * scale) / 2;
  const oy = (ch - worldView.h * scale) / 2;

  ctx.fillStyle = '#9ad0ff';
  ctx.fillRect(0, 0, cw, ch);
  ctx.fillStyle = '#eaf6ff';
  ctx.fillRect(0, 0, cw, ch * 0.35);
  ctx.fillStyle = '#83bf67';
  ctx.fillRect(0, ch * 0.35, cw, ch * 0.65);

  ctx.save();
  ctx.translate(ox, oy);
  ctx.scale(scale, scale);

  // paths
  ctx.fillStyle = '#d5c9af';
  ctx.fillRect(42, 52, 56, 32);
  ctx.fillRect(54, 52, 8, 34);

  // houses
  houseDefs.forEach((house) => {
    drawRoundedRect(house.x, house.y, house.w, house.h, 1.4, house.color, 'rgba(0,0,0,0.18)');
    ctx.fillStyle = house.roof;
    ctx.beginPath();
    ctx.moveTo(house.x - 1, house.y + 2);
    ctx.lineTo(house.x + house.w / 2, house.y - 6);
    ctx.lineTo(house.x + house.w + 1, house.y + 2);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = house.door;
    ctx.fillRect(house.x + house.w / 2 - 1.5, house.y + house.h - 7, 3, 7);
    ctx.fillStyle = '#dff7ff';
    ctx.fillRect(house.x + 3, house.y + 5, 4, 4);
    ctx.fillRect(house.x + house.w - 7, house.y + 5, 4, 4);
  });

  npcs.forEach((npc) => {
    drawSprite(npc.x, npc.y, 1.8, '#6c4a39');
  });

  drawSprite(player.x, player.y, player.size, '#315dff');

  ctx.restore();
}

function drawHouseInterior() {
  const cw = canvas.width;
  const ch = canvas.height;
  const t = (dragYaw * 40) % cw;
  const wobble = Math.sin(dragPitch * 8) * 6;

  ctx.fillStyle = '#d9edf9';
  ctx.fillRect(0, 0, cw, ch);
  ctx.fillStyle = '#f5ddb8';
  ctx.fillRect(0, ch * 0.6, cw, ch * 0.4);
  ctx.fillStyle = '#caa36c';
  for (let y = ch * 0.6; y < ch; y += 46) ctx.fillRect(0, y, cw, 3);
  drawRoundedRect(cw * 0.08, ch * 0.12, cw * 0.84, ch * 0.52, 16, 'rgba(255,255,255,0.5)', 'rgba(0,0,0,0.12)');

  // whacky furniture shapes
  drawRoundedRect(cw * 0.16 + wobble, ch * 0.54, cw * 0.28, ch * 0.12, 20, '#9c6a5d', '#6c443a');
  drawRoundedRect(cw * 0.19 + wobble, ch * 0.48, cw * 0.08, ch * 0.14, 10, '#b78773', '#6c443a');
  drawRoundedRect(cw * 0.56, ch * 0.38, cw * 0.20, ch * 0.18, 12, '#eadfc7', '#b8a68a');
  drawRoundedRect(cw * 0.60, ch * 0.56, cw * 0.16, ch * 0.08, 8, '#8f664f', '#5c4230');
  drawRoundedRect(cw * 0.34, ch * 0.46, cw * 0.10, ch * 0.11, 8, '#6fa86c', '#4f764d');
  ctx.fillStyle = '#5c74d6';
  ctx.fillRect(cw * 0.72, ch * 0.26, 16, 54);
  ctx.fillStyle = '#f0f7ff';
  ctx.fillRect(cw * 0.63, ch * 0.26, 60, 42);
  ctx.fillStyle = '#f1c16f';
  ctx.beginPath();
  ctx.arc(cw * 0.72, ch * 0.28, 20, 0, Math.PI * 2);
  ctx.fill();

  const px = player.x / worldView.w * cw;
  const py = player.y / worldView.h * ch;
  drawSprite(px, py, 12, '#315dff');
}

function drawFlash() {
  if (enteringFlash <= 0) return;
  ctx.fillStyle = `rgba(255,255,255,${enteringFlash})`;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  enteringFlash = Math.max(0, enteringFlash - 0.02);
}

function updateTown() {
  const move = { x: 0, y: 0 };
  if (keys.KeyW) move.y -= 1;
  if (keys.KeyS) move.y += 1;
  if (keys.KeyA) move.x -= 1;
  if (keys.KeyD) move.x += 1;
  const mag = Math.hypot(move.x, move.y) || 1;
  player.x = clamp(player.x + (move.x / mag) * player.speed * 1.8, 16, 104);
  player.y = clamp(player.y + (move.y / mag) * player.speed * 1.8, 44, 104);

  npcs[0].x += Math.sin(Date.now() / 500) * 0.02;
  npcs[0].y += Math.cos(Date.now() / 700) * 0.02;
  npcs[0].x = clamp(npcs[0].x, 24, 96);
  npcs[0].y = clamp(npcs[0].y, 58, 100);

  if (keys.KeyE && !keyLatch.KeyE) {
    keyLatch.KeyE = true;
    const hit = houseDefs.findIndex((h) => Math.hypot(player.x - (h.x + h.w / 2), player.y - (h.y + h.h / 2)) < 8);
    if (hit >= 0) enterHouse(hit);
  }

  const nearby = npcs[0] && Math.hypot(player.x - npcs[0].x, player.y - npcs[0].y) < 8;
  if (nearby && keys.KeyN && !keyLatch.KeyN) {
    keyLatch.KeyN = true;
    npcTalk = `${npcs[0].name}: ${npcs[0].talk}`;
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

canvas.addEventListener('click', () => { pointerDown = true; });
canvas.addEventListener('pointerdown', (event) => {
  pointerDown = true;
  lastTouchX = event.clientX;
  lastTouchY = event.clientY;
});
canvas.addEventListener('pointermove', (event) => {
  if (!pointerDown) return;
  const dx = event.clientX - lastTouchX;
  const dy = event.clientY - lastTouchY;
  if (state === 'town') dragYaw += dx * 0.003;
  if (state === 'house') dragPitch += dy * 0.003;
  lastTouchX = event.clientX;
  lastTouchY = event.clientY;
});
canvas.addEventListener('pointerup', () => { pointerDown = false; });

document.addEventListener('keydown', (event) => { keys[event.code] = true; });
document.addEventListener('keyup', (event) => { keys[event.code] = false; keyLatch[event.code] = false; });

document.addEventListener('mousemove', (event) => {
  if (!pointerDown) return;
  if (state === 'town') dragYaw += event.movementX * 0.002;
  if (state === 'house') dragPitch += event.movementY * 0.002;
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
