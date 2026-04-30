const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const statusEl = document.getElementById('status');
const debugPanel = document.getElementById('debugPanel');
const dialogue = document.getElementById('dialogue');
const dialogueText = document.getElementById('dialogueText');
const dialogueOptions = document.getElementById('dialogueOptions');

const WORLD_W = 120;
const WORLD_H = 120;

const houseDefs = [
  { label: 'Cozy Cottage', x: 24, y: 26, w: 20, h: 20, color: '#d8a36b', roof: '#a55a34', door: '#5b3a29' },
  { label: 'Blue Bungalow', x: 52, y: 26, w: 20, h: 20, color: '#7bb7d7', roof: '#446d91', door: '#4c372d' },
  { label: 'Lilac Home', x: 80, y: 26, w: 20, h: 20, color: '#b06fd9', roof: '#6f3d9d', door: '#513b29' },
];

const npcTemplates = [
  { name: 'Mina', talk: 'Nice day for a walk.', reply: ['Yep!', 'It is.'] },
  { name: 'Tori', talk: 'I heard the shop has snacks today.', reply: ['Good to know.', 'Nice.'] },
  { name: 'Jun', talk: 'This town is quiet, which I like.', reply: ['Same.', 'Me too.'] },
];

let state = 'town';
let player = { x: 60, y: 86, speed: 0.14, size: 3.6 };
let keys = {};
let keyLatch = {};
let npc = null;
let npcTalk = '';
let worldView = { w: WORLD_W, h: WORLD_H };
let pointerDown = false;
let dragging = false;
let lastTouchX = 0;
let lastTouchY = 0;
let dragYaw = 0;
let dragPitch = 0;
let debugForceVisible = true;
let enteringFlash = 0;
let conversationOpen = false;
let currentHouse = null;
let clickedNpc = false;

function rand(min, max) { return Math.random() * (max - min) + min; }
function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }

function resize() {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.floor(canvas.clientWidth * dpr);
  canvas.height = Math.floor(canvas.clientHeight * dpr);
}

function resetTown() {
  state = 'town';
  currentHouse = null;
  conversationOpen = false;
  dialogue.classList.add('hidden');
  player = { x: 60, y: 86, speed: 0.14, size: 3.6 };
  npc = {
    ...npcTemplates[Math.floor(Math.random() * npcTemplates.length)],
    x: 68,
    y: 83,
    dx: 0.018,
    dy: 0.012,
  };
  statusEl.textContent = 'Walk up to a house door to enter.';
  debugPanel.style.display = 'block';
  enteringFlash = 0;
}

function enterHouse(index) {
  state = 'house';
  currentHouse = index;
  conversationOpen = false;
  dialogue.classList.add('hidden');
  player = { x: 16, y: 84, speed: 0.11, size: 3.6 };
  statusEl.textContent = `Inside ${houseDefs[index].label}. Walk back out to leave.`;
}

function leaveHouse() {
  resetTown();
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
  ctx.arc(x, y + size * 1.2, size * 1.8, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = skin;
  ctx.beginPath();
  ctx.arc(x, y, size * 1.15, 0, Math.PI * 2);
  ctx.fill();
}

function drawTown() {
  const cw = canvas.width;
  const ch = canvas.height;
  const scaleX = cw / worldView.w;
  const scaleY = ch / worldView.h;
  const scale = Math.min(scaleX, scaleY) * 1.2;
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

  ctx.fillStyle = '#d5c9af';
  ctx.fillRect(42, 52, 56, 32);
  ctx.fillRect(54, 52, 8, 34);
  ctx.fillStyle = '#a08b6a';
  ctx.fillRect(42, 84, 56, 2);

  houseDefs.forEach((house) => {
    drawRoundedRect(house.x, house.y, house.w, house.h, 1.4, house.color, 'rgba(0,0,0,0.18)');
    ctx.fillStyle = house.roof;
    ctx.beginPath();
    ctx.moveTo(house.x - 1, house.y + 3);
    ctx.lineTo(house.x + house.w / 2, house.y - 6);
    ctx.lineTo(house.x + house.w + 1, house.y + 3);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = house.door;
    ctx.fillRect(house.x + house.w / 2 - 2.5, house.y + house.h - 10, 5, 10);
    ctx.fillStyle = '#dff7ff';
    ctx.fillRect(house.x + 3, house.y + 5, 4, 4);
    ctx.fillRect(house.x + house.w - 7, house.y + 5, 4, 4);
  });

  if (npc) {
    drawSprite(npc.x, npc.y, 4.5, '#6c4a39');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(npc.x - 1, npc.y - 10, 2, 2);
  }
  drawSprite(player.x, player.y, 8, '#315dff');
  ctx.restore();

  // fallback overlay markers so something is always visible
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.fillRect(12, canvas.height - 72, 220, 60);
  ctx.fillStyle = '#fff';
  ctx.font = '16px sans-serif';
  ctx.fillText(`player ${player.x.toFixed(1)},${player.y.toFixed(1)}`, 20, canvas.height - 46);
  if (npc) ctx.fillText(`npc ${npc.name} ${npc.x.toFixed(1)},${npc.y.toFixed(1)}`, 20, canvas.height - 24);
}

function drawHouseInterior() {
  const cw = canvas.width;
  const ch = canvas.height;
  const wobble = Math.sin(dragPitch * 8) * 6;

  ctx.fillStyle = '#d9edf9';
  ctx.fillRect(0, 0, cw, ch);
  ctx.fillStyle = '#f5ddb8';
  ctx.fillRect(0, ch * 0.6, cw, ch * 0.4);
  ctx.fillStyle = '#caa36c';
  for (let y = ch * 0.6; y < ch; y += 46) ctx.fillRect(0, y, cw, 3);
  drawRoundedRect(cw * 0.08, ch * 0.12, cw * 0.84, ch * 0.52, 16, 'rgba(255,255,255,0.5)', 'rgba(0,0,0,0.12)');

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

function openDialogue() {
  if (!npc) return;
  conversationOpen = true;
  dialogueText.textContent = `${npc.name}: ${npc.talk}`;
  dialogueOptions.innerHTML = '';
  const options = [
    ['Hi!', 'Nice to meet you.'],
    ['Bye', 'See you around.'],
    ['What do you do?', 'Mostly walk around and chat.'],
  ];
  options.forEach(([label, response]) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = label;
    button.addEventListener('click', () => {
      dialogueText.textContent = `${npc.name}: ${response}`;
      setTimeout(() => dialogue.classList.add('hidden'), 700);
    });
    dialogueOptions.appendChild(button);
  });
  dialogue.classList.remove('hidden');
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

  if (npc) {
    npc.x = clamp(npc.x + npc.dx, 22, 98);
    npc.y = clamp(npc.y + npc.dy, 58, 102);
    if (npc.x <= 22 || npc.x >= 98) npc.dx *= -1;
    if (npc.y <= 58 || npc.y >= 102) npc.dy *= -1;
  }

  const hit = houseDefs.findIndex((h) => {
    const doorX = h.x + h.w / 2;
    const doorY = h.y + h.h - 6;
    return Math.abs(player.x - doorX) < 5 && Math.abs(player.y - doorY) < 7;
  });
  if (hit >= 0) {
    statusEl.textContent = `Step into ${houseDefs[hit].label} to enter.`;
    enterHouse(hit);
  } else {
    statusEl.textContent = npcTalk || 'Walk up to a house door to enter.';
  }

  if (npc && Math.hypot(player.x - npc.x, player.y - npc.y) < 8) {
    statusEl.textContent = `Click ${npc.name} to chat.`;
    if (keys.KeyN && !keyLatch.KeyN) {
      keyLatch.KeyN = true;
      npcTalk = `${npc.name}: ${npc.talk}`;
      statusEl.textContent = npcTalk;
      openDialogue();
    }
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

function townPointerToWorld(clientX, clientY) {
  const cw = canvas.width;
  const ch = canvas.height;
  const scaleX = cw / worldView.w;
  const scaleY = ch / worldView.h;
  const scale = Math.min(scaleX, scaleY) * 1.2;
  const ox = (cw - worldView.w * scale) / 2;
  const oy = (ch - worldView.h * scale) / 2;
  const x = (clientX * (cw / canvas.clientWidth) - ox) / scale;
  const y = (clientY * (ch / canvas.clientHeight) - oy) / scale;
  return { x, y };
}

function handleTownClick(clientX, clientY) {
  if (state !== 'town') return;
  const p = townPointerToWorld(clientX, clientY);
  if (npc && Math.hypot(p.x - npc.x, p.y - npc.y) < 10) {
    openDialogue();
    return;
  }
  const hit = houseDefs.findIndex((h) => Math.hypot(p.x - (h.x + h.w / 2), p.y - (h.y + h.h / 2)) < 3.5);
  if (hit >= 0) enterHouse(hit);
}

function loop() {
  resize();
  if (state === 'town') updateTown();
  else updateHouse();
  if (state === 'town') drawTown();
  else drawHouseInterior();
  drawFlash();
  debugPanel.textContent = `state=${state} | player=(${player.x.toFixed(1)}, ${player.y.toFixed(1)}) | npc=${npc ? `${npc.name} @ (${npc.x.toFixed(1)}, ${npc.y.toFixed(1)})` : 'none'} | dialogue=${conversationOpen ? 'open' : 'closed'}`;
  requestAnimationFrame(loop);
}

canvas.addEventListener('click', (event) => {
  pointerDown = true;
  handleTownClick(event.clientX, event.clientY);
});
canvas.addEventListener('pointerdown', (event) => {
  pointerDown = true;
  dragging = true;
  lastTouchX = event.clientX;
  lastTouchY = event.clientY;
  handleTownClick(event.clientX, event.clientY);
});
canvas.addEventListener('pointermove', (event) => {
  if (!dragging) return;
  const dx = event.clientX - lastTouchX;
  const dy = event.clientY - lastTouchY;
  if (state === 'town') dragYaw += dx * 0.003;
  if (state === 'house') dragPitch += dy * 0.003;
  lastTouchX = event.clientX;
  lastTouchY = event.clientY;
});
canvas.addEventListener('pointerup', () => { pointerDown = false; dragging = false; });

document.addEventListener('keydown', (event) => { keys[event.code] = true; });
document.addEventListener('keyup', (event) => { keys[event.code] = false; keyLatch[event.code] = false; });

document.addEventListener('mousemove', (event) => {
  if (!pointerDown) return;
  if (state === 'town') dragYaw += event.movementX * 0.002;
  if (state === 'house') dragPitch += event.movementY * 0.002;
});

document.addEventListener('click', (event) => {
  if (conversationOpen && event.target.closest('#dialogue')) return;
});

window.addEventListener('resize', resize);
resetTown();
loop();
