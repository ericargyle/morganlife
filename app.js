const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const statusEl = document.getElementById('status');
const overlay = document.getElementById('overlay');
const houseButtons = document.querySelectorAll('.house-btn');

let renderer, scene, camera;
let world = null;
let state = 'choose';
let player = null;
let selectedHouse = null;
let npcs = [];
let keys = {};
let pointerLocked = false;
let yaw = 0;
let pitch = -0.15;
let pointerDown = false;
let lastTouchX = 0;
let lastTouchY = 0;
let townMap = null;

const HOUSE_LAYOUTS = [
  { color: 0xd8a36b, roof: 0xa55a34, door: 0x5b3a29, label: 'Cozy Cottage' },
  { color: 0x7bb7d7, roof: 0x446d91, door: 0x4c372d, label: 'Blue Bungalow' },
  { color: 0xb06fd9, roof: 0x6f3d9d, door: 0x513b29, label: 'Lilac Home' },
];

const NPC_NAMES = ['Mina', 'Tori', 'Jun', 'Pip', 'Lio', 'Sora', 'Nori'];
const NPC_RESPONSES = [
  'Nice day for a walk.',
  'I heard the shop has snacks today.',
  'This town is quiet, which I like.',
  'Your house looks neat.',
  'The square feels cozy, huh?',
];

const rooms = {
  living: { furniture: ['couch', 'table', 'plant'] },
  kitchen: { furniture: ['counter', 'fridge', 'stool'] },
};

function resize() {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.floor(canvas.clientWidth * dpr);
  canvas.height = Math.floor(canvas.clientHeight * dpr);
}

function rand(min, max) { return Math.random() * (max - min) + min; }
function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }
function lerp(a, b, t) { return a + (b - a) * t; }

function createHouse(index, x, z) {
  const def = HOUSE_LAYOUTS[index];
  return {
    index,
    x,
    z,
    label: def.label,
    color: def.color,
    roof: def.roof,
    door: def.door,
    doorOpen: false,
    scale: 1,
  };
}

function resetTown() {
  selectedHouse = null;
  npcs = Array.from({ length: 4 }, () => ({
    name: NPC_NAMES[Math.floor(Math.random() * NPC_NAMES.length)],
    x: rand(-10, 10),
    z: rand(-10, 10),
    dir: rand(0, Math.PI * 2),
    speed: rand(0.01, 0.03),
    talk: NPC_RESPONSES[Math.floor(Math.random() * NPC_RESPONSES.length)],
  }));
  player = { x: 0, y: 0, z: 7, speed: 0.12 };
  townMap = {
    houses: [
      createHouse(0, -8, -6),
      createHouse(1, 0, -6),
      createHouse(2, 8, -6),
    ],
    square: true,
  };
  state = 'choose';
  overlay.classList.remove('hidden');
  statusEl.textContent = 'Choose a house in the square.';
}

function init3D() {
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.shadowMap.enabled = true;

  scene = new THREE.Scene();
  scene.background = new THREE.Color(0xa8d8ff);
  scene.fog = new THREE.Fog(0xa8d8ff, 18, 80);

  camera = new THREE.PerspectiveCamera(60, 1, 0.1, 200);
  camera.position.set(0, 3, 10);

  const hemi = new THREE.HemisphereLight(0xffffff, 0x446644, 1.35);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xffffff, 1.2);
  sun.position.set(10, 18, 8);
  sun.castShadow = true;
  scene.add(sun);

  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(200, 200),
    new THREE.MeshStandardMaterial({ color: 0x7bb86d }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);

  const square = new THREE.Mesh(
    new THREE.PlaneGeometry(24, 24),
    new THREE.MeshStandardMaterial({ color: 0xc8c3b0 }),
  );
  square.rotation.x = -Math.PI / 2;
  square.position.y = 0.01;
  square.receiveShadow = true;
  scene.add(square);

  const grid = new THREE.GridHelper(24, 12, 0x999988, 0xc8c3b0);
  grid.position.y = 0.02;
  scene.add(grid);

  const ambient = new THREE.Mesh(
    new THREE.RingGeometry(4.5, 5.4, 32),
    new THREE.MeshBasicMaterial({ color: 0xf7e3a1, transparent: true, opacity: 0.18 }),
  );
  ambient.rotation.x = -Math.PI / 2;
  ambient.position.y = 0.03;
  scene.add(ambient);
}

function makeNpcMesh(color) {
  const body = new THREE.Mesh(
    new THREE.CylinderGeometry(0.35, 0.45, 1.15, 8),
    new THREE.MeshStandardMaterial({ color }),
  );
  body.castShadow = true;
  const head = new THREE.Mesh(
    new THREE.SphereGeometry(0.28, 10, 10),
    new THREE.MeshStandardMaterial({ color: 0xffe0c8 }),
  );
  head.position.y = 0.9;
  const group = new THREE.Group();
  group.add(body);
  group.add(head);
  return group;
}

function makePlayerMesh() {
  const mesh = new THREE.Group();
  const body = new THREE.Mesh(
    new THREE.CapsuleGeometry(0.35, 0.6, 4, 8),
    new THREE.MeshStandardMaterial({ color: 0x5c8cff }),
  );
  body.castShadow = true;
  const head = new THREE.Mesh(
    new THREE.SphereGeometry(0.3, 12, 12),
    new THREE.MeshStandardMaterial({ color: 0xffdfc2 }),
  );
  head.position.y = 1;
  mesh.add(body, head);
  return mesh;
}

function buildTown() {
  scene = scene || new THREE.Scene();
  if (world) scene.remove(world);
  world = new THREE.Group();

  const houseData = townMap.houses;
  houseData.forEach((house) => {
    const base = new THREE.Mesh(
      new THREE.BoxGeometry(3.6, 2.4, 3.2),
      new THREE.MeshStandardMaterial({ color: house.color }),
    );
    base.position.set(house.x, 1.2, house.z);
    base.castShadow = true;
    base.receiveShadow = true;
    world.add(base);

    const roof = new THREE.Mesh(
      new THREE.ConeGeometry(2.7, 1.4, 4),
      new THREE.MeshStandardMaterial({ color: house.roof }),
    );
    roof.position.set(house.x, 2.85, house.z);
    roof.rotation.y = Math.PI / 4;
    roof.castShadow = true;
    world.add(roof);

    const door = new THREE.Mesh(
      new THREE.BoxGeometry(0.6, 1.0, 0.08),
      new THREE.MeshStandardMaterial({ color: house.door }),
    );
    door.position.set(house.x, 0.5, house.z + 1.61);
    world.add(door);

    const sign = new THREE.Mesh(
      new THREE.PlaneGeometry(2.3, 0.5),
      new THREE.MeshStandardMaterial({ color: 0xfff3cf, transparent: true, opacity: 0.95 }),
    );
    sign.position.set(house.x, 3.7, house.z + 1.65);
    sign.rotation.y = Math.PI;
    world.add(sign);
  });

  scene.add(world);
}

function enterHouse(index) {
  selectedHouse = index;
  state = 'house';
  overlay.classList.add('hidden');
  statusEl.textContent = `Inside ${townMap.houses[index].label}. E to leave.`;
  scene.background = new THREE.Color(0xcfe2ff);
  scene.fog = new THREE.Fog(0xcfe2ff, 8, 24);
  if (world) scene.remove(world);
  world = new THREE.Group();
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(14, 14),
    new THREE.MeshStandardMaterial({ color: 0xd8c7a4 }),
  );
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  world.add(floor);

  const couch = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.8, 1.1), new THREE.MeshStandardMaterial({ color: 0x9a6c5e }));
  couch.position.set(-2, 0.4, -2);
  world.add(couch);
  const kitchen = new THREE.Mesh(new THREE.BoxGeometry(2.4, 1.0, 0.8), new THREE.MeshStandardMaterial({ color: 0xe8d5b8 }));
  kitchen.position.set(2.5, 0.5, -2.5);
  world.add(kitchen);
  const table = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.7, 0.08, 8), new THREE.MeshStandardMaterial({ color: 0x8d664e }));
  table.position.set(0, 0.45, 1.4);
  world.add(table);
  scene.add(world);
}

function leaveHouse() {
  state = 'town';
  statusEl.textContent = 'Walk to a house and press E to enter.';
  scene.background = new THREE.Color(0xa8d8ff);
  scene.fog = new THREE.Fog(0xa8d8ff, 18, 80);
  if (world) scene.remove(world);
  buildTown();
}

function setupOverlay() {
  houseButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      const index = Number(btn.dataset.house);
      selectedHouse = index;
      overlay.classList.add('hidden');
      enterHouse(index);
    });
  });
}

function updatePlayer() {
  const move = new THREE.Vector3();
  const forward = new THREE.Vector3(Math.sin(yaw), 0, Math.cos(yaw)).normalize();
  const right = new THREE.Vector3(forward.z, 0, -forward.x);
  if (keys.KeyW) move.add(forward);
  if (keys.KeyS) move.sub(forward);
  if (keys.KeyA) move.sub(right);
  if (keys.KeyD) move.add(right);
  if (move.lengthSq() > 0) move.normalize();
  player.x += move.x * player.speed;
  player.z += move.z * player.speed;
  player.x = clamp(player.x, -20, 20);
  player.z = clamp(player.z, -20, 20);
  const px = player.x;
  const pz = player.z;

  if (state === 'town') {
    townMap.houses.forEach((house, index) => {
      const dx = px - house.x;
      const dz = pz - (house.z + 1.8);
      const dist = Math.hypot(dx, dz);
      if (dist < 1.1) {
        statusEl.textContent = `Press E to enter ${house.label}.`;
        if (keys.KeyE) enterHouse(index);
      }
    });
  } else if (state === 'house' && keys.KeyE) {
    leaveHouse();
  }
}

function updateNpcs() {
  if (state !== 'town') return;
  npcs.forEach((npc) => {
    npc.dir += rand(-0.02, 0.02);
    npc.x += Math.cos(npc.dir) * npc.speed;
    npc.z += Math.sin(npc.dir) * npc.speed;
    npc.x = clamp(npc.x, -14, 14);
    npc.z = clamp(npc.z, -14, 14);
  });
}

function getNpcDialogue() {
  const npc = npcs[Math.floor(Math.random() * npcs.length)];
  if (!npc) return '...';
  return `${npc.name}: ${npc.talk}`;
}

function updateCamera() {
  if (state === 'town') {
    camera.position.set(player.x - Math.sin(yaw) * 4, 3, player.z - Math.cos(yaw) * 4);
    camera.lookAt(player.x, 1.2, player.z);
  } else {
    camera.position.set(0, 3, 5.5);
    camera.lookAt(0, 1.3, 0);
  }
}

function updateScene() {
  if (state === 'town') {
    buildTown();
    const playerMesh = makePlayerMesh();
    playerMesh.position.set(player.x, 0, player.z);
    world.add(playerMesh);
    npcs.forEach((npc) => {
      const mesh = makeNpcMesh(0xf2b56b);
      mesh.position.set(npc.x, 0, npc.z);
      world.add(mesh);
    });
  }
}

function animate() {
  updatePlayer();
  updateNpcs();
  updateCamera();
  updateScene();
  renderer.render(scene, camera);
  requestAnimationFrame(animate);
}

function syncMouseLook(event) {
  if (!pointerLocked || state !== 'town') return;
  yaw -= event.movementX * 0.0025;
  pitch -= event.movementY * 0.0025;
  pitch = clamp(pitch, -0.5, 0.25);
}

canvas.addEventListener('click', () => {
  if (!pointerLocked) {
    canvas.requestPointerLock?.();
  }
});

document.addEventListener('pointerlockchange', () => {
  pointerLocked = document.pointerLockElement === canvas;
});
document.addEventListener('mousemove', syncMouseLook);
document.addEventListener('keydown', (event) => {
  keys[event.code] = true;
  if (event.code === 'KeyN' && state === 'town') {
    statusEl.textContent = getNpcDialogue();
  }
});
document.addEventListener('keyup', (event) => {
  keys[event.code] = false;
});

canvas.addEventListener('touchstart', (event) => {
  const touch = event.touches[0];
  pointerDown = true;
  lastTouchX = touch.clientX;
  lastTouchY = touch.clientY;
}, { passive: true });
canvas.addEventListener('touchmove', (event) => {
  const touch = event.touches[0];
  const dx = touch.clientX - lastTouchX;
  const dy = touch.clientY - lastTouchY;
  lastTouchX = touch.clientX;
  lastTouchY = touch.clientY;
  if (pointerDown && state === 'town') {
    yaw -= dx * 0.004;
    pitch = clamp(pitch - dy * 0.004, -0.5, 0.25);
  }
}, { passive: true });
canvas.addEventListener('touchend', () => { pointerDown = false; }, { passive: true });

function start() {
  resize();
  init3D();
  setupOverlay();
  resetTown();
  animate();
}

window.addEventListener('resize', () => {
  resize();
  if (renderer && camera) {
    camera.aspect = canvas.width / canvas.height;
    camera.updateProjectionMatrix();
    renderer.setSize(canvas.clientWidth, canvas.clientHeight, false);
  }
});

start();
