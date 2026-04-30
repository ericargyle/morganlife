const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const statusEl = document.getElementById('status');
const debugEl = document.getElementById('debug');
const dialogue = document.getElementById('dialogue');
const dialogueText = document.getElementById('dialogueText');
const dialogueOptions = document.getElementById('dialogueOptions');

const houses = [
  { x: 180, y: 220, w: 120, h: 100, body: '#d98a5f', roof: '#9f4f2e', door: '#4d2c1f', label: 'House A' },
  { x: 420, y: 220, w: 120, h: 100, body: '#6bb6d8', roof: '#3e6f92', door: '#2d3c4a', label: 'House B' },
  { x: 660, y: 220, w: 120, h: 100, body: '#b26bdd', roof: '#6e3e99', door: '#4b2c61', label: 'House C' },
];

const npc = { x: 360, y: 430, w: 34, h: 52, name: 'Mina', talk: 'Hey, want a tour?' };
const world = { w: 960, h: 540 };
let player = { x: 120, y: 420, r: 16, speed: 2.2 };
let keys = {};
let last = performance.now();
let state = 'town';
let currentHouse = null;
let conversationOpen = false;
let clicking = false;
let dpr = 1;

function resize() {
  dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.floor(innerWidth * dpr);
  canvas.height = Math.floor(innerHeight * dpr);
}

function rect(x,y,w,h,c){ctx.fillStyle=c;ctx.fillRect(x,y,w,h)}
function circle(x,y,r,c){ctx.fillStyle=c;ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);ctx.fill()}
function line(x1,y1,x2,y2,c,w=4){ctx.strokeStyle=c;ctx.lineWidth=w;ctx.beginPath();ctx.moveTo(x1,y1);ctx.lineTo(x2,y2);ctx.stroke()}

function screenToWorld(mx,my){ return { x: mx * (world.w / canvas.width), y: my * (world.h / canvas.height) }; }
function worldToScreen(wx,wy){ return { x: wx * (canvas.width / world.w), y: wy * (canvas.height / world.h) }; }

function resetTown(){
  state='town';
  currentHouse=null;
  player={ x:120, y:420, r:16, speed:2.2 };
  statusEl.textContent='Walk to a door to enter. Click the NPC to talk.';
  dialogue.classList.add('hidden');
  conversationOpen=false;
}

function enterHouse(i){
  state='house';
  currentHouse=i;
  player={ x: 220, y: 420, r:16, speed:2.1 };
  statusEl.textContent=`Inside ${houses[i].label}. Walk to the door to leave.`;
  dialogue.classList.add('hidden');
}

function drawBackground(){
  rect(0,0,canvas.width,canvas.height,'#87c7ff');
  rect(0,canvas.height*0.45,canvas.width,canvas.height*0.55,'#88c26b');
  rect(0,canvas.height*0.40,canvas.width,8*dpr,'#d9c39b');
}

function drawTown(){
  drawBackground();
  houses.forEach((h)=>{
    const s = worldToScreen(h.x,h.y);
    const sw = h.w * (canvas.width/world.w);
    const sh = h.h * (canvas.height/world.h);
    const sx = s.x, sy = s.y;
    rect(sx,sy,sw,sh,h.body);
    ctx.fillStyle = h.roof;
    ctx.beginPath();
    ctx.moveTo(sx-10*dpr, sy+4*dpr);
    ctx.lineTo(sx+sw/2, sy-28*dpr);
    ctx.lineTo(sx+sw+10*dpr, sy+4*dpr);
    ctx.closePath();
    ctx.fill();
    rect(sx+sw/2-10*dpr, sy+sh-28*dpr, 20*dpr, 28*dpr, h.door);
    rect(sx+16*dpr, sy+18*dpr, 18*dpr, 18*dpr, '#f5f0d8');
    rect(sx+sw-34*dpr, sy+18*dpr, 18*dpr, 18*dpr, '#f5f0d8');
    ctx.fillStyle='#000'; ctx.font=`${14*dpr}px sans-serif`; ctx.fillText(h.label, sx+10*dpr, sy-6*dpr);
  });

  const ns = worldToScreen(npc.x, npc.y);
  circle(ns.x, ns.y-14*dpr, 14*dpr, '#f0c48a');
  rect(ns.x-12*dpr, ns.y-4*dpr, 24*dpr, 30*dpr, '#7f5a44');
  rect(ns.x-8*dpr, ns.y+26*dpr, 6*dpr, 16*dpr, '#3b2a20');
  rect(ns.x+2*dpr, ns.y+26*dpr, 6*dpr, 16*dpr, '#3b2a20');
  circle(ns.x, ns.y+8*dpr, 6*dpr, '#fff');
  ctx.strokeStyle='#000'; ctx.lineWidth=2*dpr; ctx.strokeRect(ns.x-14*dpr, ns.y-18*dpr, 28*dpr, 48*dpr);

  const ps = worldToScreen(player.x, player.y);
  circle(ps.x, ps.y-16*dpr, 16*dpr, '#ffd2a1');
  rect(ps.x-14*dpr, ps.y-2*dpr, 28*dpr, 34*dpr, '#2f66ff');
  rect(ps.x-10*dpr, ps.y+32*dpr, 8*dpr, 18*dpr, '#2a2a2a');
  rect(ps.x+2*dpr, ps.y+32*dpr, 8*dpr, 18*dpr, '#2a2a2a');
}

function drawHouse(){
  drawBackground();
  const h = houses[currentHouse];
  const s = worldToScreen(h.x,h.y);
  const sw = h.w * (canvas.width/world.w);
  const sh = h.h * (canvas.height/world.h);
  rect(s.x, s.y, sw, sh, h.body);
  ctx.fillStyle = h.roof;
  ctx.beginPath();
  ctx.moveTo(s.x-10*dpr, s.y+4*dpr);
  ctx.lineTo(s.x+sw/2, s.y-28*dpr);
  ctx.lineTo(s.x+sw+10*dpr, s.y+4*dpr);
  ctx.closePath();
  ctx.fill();
  rect(s.x+sw/2-10*dpr, s.y+sh-28*dpr, 20*dpr, 28*dpr, h.door);

  rect(canvas.width*0.15, canvas.height*0.58, canvas.width*0.25, canvas.height*0.12, '#b07b6a');
  rect(canvas.width*0.44, canvas.height*0.50, canvas.width*0.22, canvas.height*0.18, '#f0e1c1');
  rect(canvas.width*0.52, canvas.height*0.68, canvas.width*0.13, canvas.height*0.06, '#6a4b3a');
  rect(canvas.width*0.72, canvas.height*0.30, canvas.width*0.11, canvas.height*0.11, '#5b73d4');
  circle(canvas.width*0.78, canvas.height*0.26, 30*dpr, '#ffe07b');

  const ps = worldToScreen(player.x, player.y);
  circle(ps.x, ps.y-16*dpr, 16*dpr, '#ffd2a1');
  rect(ps.x-14*dpr, ps.y-2*dpr, 28*dpr, 34*dpr, '#2f66ff');
  rect(ps.x-10*dpr, ps.y+32*dpr, 8*dpr, 18*dpr, '#2a2a2a');
  rect(ps.x+2*dpr, ps.y+32*dpr, 8*dpr, 18*dpr, '#2a2a2a');
}

function openDialogue(){
  conversationOpen = true;
  dialogueText.textContent = `${npc.name}: ${npc.talk}`;
  dialogueOptions.innerHTML = '';
  [['Hi','Hi!'],['Tell me more','Sure.'],['Bye','Later.']].forEach(([label,reply])=>{
    const b=document.createElement('button');
    b.textContent=label;
    b.onclick=()=>{ dialogueText.textContent = `You: ${reply}`; setTimeout(()=>dialogue.classList.add('hidden'),700); };
    dialogueOptions.appendChild(b);
  });
  dialogue.classList.remove('hidden');
}

function move(dt){
  let dx=0, dy=0;
  if (keys.ArrowLeft || keys.KeyA) dx -= 1;
  if (keys.ArrowRight || keys.KeyD) dx += 1;
  if (keys.ArrowUp || keys.KeyW) dy -= 1;
  if (keys.ArrowDown || keys.KeyS) dy += 1;
  const len = Math.hypot(dx,dy) || 1;
  dx /= len; dy /= len;
  player.x += dx * player.speed * dt;
  player.y += dy * player.speed * dt;
}

function updateTown(dt){
  move(dt);
  player.x = Math.max(60, Math.min(world.w-40, player.x));
  player.y = Math.max(360, Math.min(470, player.y));
  const nps = worldToScreen(npc.x, npc.y);
  const ps = worldToScreen(player.x, player.y);
  if (Math.hypot(ps.x-nps.x, ps.y-nps.y) < 60 && !conversationOpen) statusEl.textContent = 'Click the NPC to talk.';
  let entered = false;
  houses.forEach((h,i)=>{
    const door = { x:h.x+h.w/2-6, y:h.y+h.h-14, w:12, h:14 };
    if (player.x > door.x && player.x < door.x+door.w && player.y > door.y && player.y < door.y+door.h) entered = i;
  });
  if (entered !== false) enterHouse(entered);
}

function updateHouse(dt){
  move(dt);
  player.x = Math.max(60, Math.min(world.w-40, player.x));
  player.y = Math.max(180, Math.min(world.h-40, player.y));
  const h = houses[currentHouse];
  const door = { x:h.x+h.w/2-6, y:h.y+h.h-14, w:12, h:14 };
  if (player.x > door.x && player.x < door.x+door.w && player.y > door.y && player.y < door.y+door.h) resetTown();
}

function loop(ts){
  const dt = Math.min(32, ts - last || 16);
  last = ts;
  if (state === 'town') updateTown(dt);
  else updateHouse(dt);
  if (state === 'town') drawTown(); else drawHouse();
  const ps = worldToScreen(player.x, player.y);
  const ns = worldToScreen(npc.x, npc.y);
  debugEl.textContent = `state:${state} player:${player.x.toFixed(0)},${player.y.toFixed(0)} npc:${npc.x.toFixed(0)},${npc.y.toFixed(0)} pScreen:${ps.x.toFixed(0)},${ps.y.toFixed(0)} nScreen:${ns.x.toFixed(0)},${ns.y.toFixed(0)}`;
  requestAnimationFrame(loop);
}

canvas.addEventListener('click', (e)=>{
  const p = screenToWorld(e.clientX*dpr, e.clientY*dpr);
  const ps = worldToScreen(player.x, player.y);
  const ns = worldToScreen(npc.x, npc.y);
  if (state === 'town' && Math.hypot(e.clientX*dpr-ns.x, e.clientY*dpr-ns.y) < 60*dpr) openDialogue();
});

document.addEventListener('keydown', (e)=>{ keys[e.code] = true; if (e.code === 'Escape') dialogue.classList.add('hidden'); });
document.addEventListener('keyup', (e)=>{ keys[e.code] = false; });

resize();
resetTown();
requestAnimationFrame(loop);
