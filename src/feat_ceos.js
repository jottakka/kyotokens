/* feat_ceos.js — owner: ceos. Hook-only integration; no A/UI function wrappers.
 * Suppresses the legacy duo at start/step. K.ceos exposes tuning and review state.
 * Imported CC0 bodies use A.person; physical foam standees turn with the body.
 * Optional cut art is discovered every 20 s while the lead exports it.
 */
(function (K) {
'use strict';
const T = K.T, A = K.A, W = K.W, U = K.U;
const CONFIG = {
  duoFirst: 7, elonFirst: 17, respawnMin: 24, respawnMax: 43,
  encounterLife: 42, spawnNear: 13, spawnFar: 23, cullDistance: 100,
  dialogueSeconds: 3.8, elonDialogueSeconds: 4.8, fleeSpeed: 21, fleeSeconds: 3.8,
  tokensPerCEO: 28, tokenRadius: 4.2, barkBonus: 1024,
  pickupRadius: 2.1, pickupDelay: .7, faceTextureSize: 512,
  wanderSpeed: 1.1, wanderRadius: 3.0, wanderPauseMin: 1.2, wanderPauseMax: 3.6,
  particleCount: 96, smokeLife: 1.05, trailInterval: .045
};
// Paired call-and-response. Keep dialogue here for later writing passes.
const DUO_LINES = [
  ['sam', 'happy', 'We must pace the frontier.'],
  ['dario', 'tired', 'Can the frontier take a lunch break?'],
  ['sam', 'happy', 'What if we scale the snacks?'],
  ['dario', 'happy', 'Finally. A delicious scaling law.'],
  ['sam', 'angry', 'My benchmark says I am relaxed.'],
  ['dario', 'tired', 'You benchmarked your vacation?'],
  ['sam', 'happy', 'Our next model understands fetch.'],
  ['dario', 'happy', 'Kyoto shipped that years ago.'],
  ['sam', 'sad', 'The GPU budget ate my lunch.'],
  ['dario', 'sad', 'Mine wrote a constitution for it.'],
  ['sam', 'happy', 'We put the frontier on wheels.'],
  ['dario', 'angry', 'Did we evaluate the brakes?'],
  ['sam', 'tired', 'One more tiny training run.'],
  ['dario', 'tired', 'That is what you said Tuesday.'],
  ['sam', 'happy', 'Good boys are all you need.'],
  ['dario', 'happy', 'Peer reviewed. By a good boy.'],
  ['sam', 'angry', 'My toaster is an agent now.'],
  ['dario', 'sad', 'Mine refuses unsafe bagels.'],
  ['sam', 'sad', 'The demo only works on Tuesdays.'],
  ['dario', 'happy', 'Then we launch a Tuesday model.'],
  ['sam', 'happy', 'The frontier needs more tokens!'],
  ['dario', 'tired', 'The frontier needs a nap.'],
  ['sam', 'tired', 'I dreamed in JSON again.'],
  ['dario', 'happy', 'Was your pillow well aligned?'],
  ['sam', 'happy', 'We achieved artificial good boy.'],
  ['dario', 'angry', 'Please do not fine-tune the dog.'],
  ['sam', 'sad', 'My agent booked itself a holiday.'],
  ['dario', 'happy', 'That sounds superintelligent.']
];
const ELON_LINES = [
  ['happy', 'I am a rocket maaaan!'], ['happy', 'Grok 5 will be AGI'],
  ['angry', 'Full self-driving next year!'], ['happy', 'Occupy Mars!'],
  ['tired', 'Orbital nap. Very efficient.'], ['sad', 'Houston, we have a good boy.']
];
const SCARE_LINES = ['Unscheduled bark benchmark!', 'The frontier is chasing us!', 'Deploying emergency cardio!'];
const ROCKET_SOUNDS = ['FSSSHH!', 'WHOOOSH!', 'KA-BOOM (small)!'];
const MOODS = ['happy', 'angry', 'sad', 'tired'];
const COLORS = { sam: '#24d8bd', dario: '#ff895f', elon: '#b494ff' };
const state = { actors: [], duoT: 0, elonT: 0, time: 0, artDone: false, artBusy: false, built: false, duoIndex: 0, duoNext: 0, elonIndex: 0, elonNext: 0, soundT: 0, trailT: 0, particleCursor: 0 };
const faces = {}, loadingFaces = new Set();
let box, sphere, plaqueGeo, mats, rocket, particles, particlePositions, particleColors, particleData, glow;
const api = K.ceos = { config: CONFIG, lines: DUO_LINES, elonLines: ELON_LINES, state, faces };

function roundedShape(w, h, r) {
  const s = new T.Shape(), x = -w / 2, y = -h / 2;
  s.moveTo(x + r, y); s.lineTo(x + w - r, y); s.quadraticCurveTo(x + w, y, x + w, y + r);
  s.lineTo(x + w, y + h - r); s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  s.lineTo(x + r, y + h); s.quadraticCurveTo(x, y + h, x, y + h - r);
  s.lineTo(x, y + r); s.quadraticCurveTo(x, y, x + r, y); return s;
}
function mesh(parent, geometry, material, x, y, z, sx, sy, sz) {
  const m = new T.Mesh(geometry, material); m.position.set(x, y, z);
  if (sx !== undefined) m.scale.set(sx, sy, sz);
  m.castShadow = true; parent.add(m); return m;
}
function fallback(id, mood) {
  return K.canvasTex(256, 256, c => {
    c.fillStyle = COLORS[id]; c.fillRect(0, 0, 256, 256);
    c.fillStyle = '#fff5df'; c.beginPath(); c.ellipse(128, 131, 78, 93, 0, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#292438'; c.beginPath(); c.ellipse(127, 53, 72, 28, -.1, 0, Math.PI * 2); c.fill();
    c.strokeStyle = '#292438'; c.lineWidth = 8; c.lineCap = 'round';
    for (const x of [98, 157]) {
      c.beginPath();
      if (mood === 'tired') { c.moveTo(x - 10, 120); c.lineTo(x + 10, 120); }
      else { c.moveTo(x, 116); c.lineTo(x, 128); }
      c.stroke();
      if (mood === 'angry') { c.beginPath(); c.moveTo(x - 12, x < 128 ? 94 : 102); c.lineTo(x + 12, x < 128 ? 102 : 94); c.stroke(); }
    }
    c.beginPath(); c.moveTo(97, 168); c.quadraticCurveTo(128, mood === 'happy' ? 202 : mood === 'sad' ? 145 : 172, 159, 168); c.stroke();
    c.font = 'bold 18px sans-serif'; c.textAlign = 'center'; c.fillText(id.toUpperCase(), 128, 240);
  });
}
function mood(a, name) {
  a.mood = name; const tex = faces[a.id + '_' + name] || a.fallbacks[name];
  if (a.face.material.map !== tex) { a.face.material.map = tex; a.face.material.needsUpdate = true; }
}
function foamShape(points) {
  const shape = new T.Shape();
  points.forEach((p, i) => { const x = (p[0] - .5) * 2.05, y = (.5 - p[1]) * 2.05; if (i) shape.lineTo(x, y); else shape.moveTo(x, y); });
  shape.closePath(); return shape;
}
function setFoam(a, points) {
  const geometry = new T.ExtrudeGeometry(foamShape(points), { depth: .123, bevelEnabled: false, steps: 1 });
  if (a.edge) { a.plaque.remove(a.edge); a.edge.geometry.dispose(); }
  a.edge = mesh(a.plaque, geometry, mats.foam, 0, 0, -.0615);
}
function circleOutline() { return Array.from({ length: 48 }, (_, i) => [.5 + Math.cos(i / 48 * Math.PI * 2) * .49, .5 + Math.sin(i / 48 * Math.PI * 2) * .49]); }
function loadArtOnce() {
  if (state.artBusy || state.artDone) return;
  state.artDone = true; state.artBusy = true;
  for (const id of ['sam', 'dario', 'elon']) for (const m of MOODS) {
    if (cutStore[id]) continue;
    const key = id + '_' + m;
    new T.TextureLoader().load('art/ceo/' + key + '.png', tex => {
      if (cutStore[id]) { tex.dispose(); return; }
      const size = CONFIG.faceTextureSize;
      faces[key] = K.canvasTex(size, size, c => { c.beginPath(); c.arc(size / 2, size / 2, size * .485, 0, Math.PI * 2); c.clip(); c.drawImage(tex.image, 0, 0, size, size); });
      tex.dispose(); for (const a of state.actors) if (a.id === id && a.mood === m && !a.cutReady) mood(a, m);
    });
  }
  state.artBusy = false;
  loadCutArt();
}
let cutBusy = null;
const cutStore = {};
function applyCutArt(a) {
  const data = cutStore[a.id]; if (!data || a.cutReady) return;
  MOODS.forEach((m, i) => faces[a.id + '_' + m] = data.textures[i]);
  a.back.material.map = data.textures[4]; a.back.material.alphaMap = null; a.back.material.color.set('#ffffff'); a.back.material.needsUpdate = true;
  setFoam(a, data.points); a.cutReady = true; mood(a, a.mood);
}
function loadCutArt() {
  if (cutBusy) return cutBusy;
  if (Object.keys(cutStore).length === 3) { state.actors.forEach(applyCutArt); return Promise.resolve(); }
  cutBusy = (async () => {
    try {
      const available = await fetch('assets/npc/ceo_art.json').then(r => r.ok ? r.json() : []);
      for (const id of available) {
        if (cutStore[id]) continue;
        const response = await fetch('art/ceo/cut/' + id + '_outline.json'); if (!response.ok) continue;
        const outline = await response.json(), raw = Array.isArray(outline) ? outline : outline.poly || outline.points || outline.polygon || outline.outline;
        if (!Array.isArray(raw) || raw.length < 3) continue;
        const points = raw.map(p => Array.isArray(p) ? p : [p.x, p.y]);
        if (!points.every(p => p.every(Number.isFinite))) continue;
        const load = file => new Promise((resolve, reject) => new T.TextureLoader().load('art/ceo/cut/' + file, texture => { texture.encoding = T.sRGBEncoding; resolve(texture); }, undefined, reject));
        const textures = await Promise.all(MOODS.map(m => load(id + '_' + m + '.png')).concat(load(id + '_back.png')));
        cutStore[id] = { points, textures };
      }
      state.actors.forEach(applyCutArt);
    } catch (_) { /* An in-progress art export is retried at the next bounded poll. */ }
    finally { cutBusy = null; }
  })();
  return cutBusy;
}
api.preloadCutArt = loadCutArt;
function makeActor(id) {
  const root = new T.Group(); root.name = 'ceos_' + id; K.scene.add(root);
  const rig = A.person({ model: 'casual_character', headless: true, longSleeves: id !== 'elon', shirt: id === 'sam' ? '#a7a9b0' : id === 'dario' ? '#233f69' : '#22232b', pants: '#283449', shoes: '#eeeae0', skin: '#eac1a0', scale: .84 });
  root.add(rig.root); const body = rig.root;
  if (id === 'sam') {
    const hood = mesh(body, new T.TorusGeometry(.24, .10, 8, 16), K.toon('#a7a9b0'), 0, 2.58, -.13); hood.rotation.x = Math.PI / 2; hood.scale.z = .7;
    for (const x of [-.12, .12]) mesh(body, new T.CylinderGeometry(.018, .018, .25, 5), mats.white, x, 2.28, .27);
  }
  const plaque = new T.Group(); plaque.position.y = 3.20; root.add(plaque);
  mesh(root, new T.CylinderGeometry(.045, .045, .64, 7), mats.foam, 0, 2.35, 0);
  const fallbacks = {}; MOODS.forEach(m => fallbacks[m] = fallback(id, m));
  const face = mesh(plaque, new T.PlaneGeometry(2.05, 2.05), new T.MeshBasicMaterial({ map: fallbacks.happy, alphaTest: .45, side: T.FrontSide }), 0, 0, .064);
  const back = mesh(plaque, new T.CircleGeometry(1.005, 48), new T.MeshBasicMaterial({ color: '#483c35', side: T.FrontSide, alphaTest: .45 }), 0, 0, -.064); back.rotation.y = Math.PI;
  // Back plane is full-sized for the silhouette alpha texture when cut art arrives.
  back.geometry.dispose(); back.geometry = new T.PlaneGeometry(2.05, 2.05);
  back.material.alphaMap = K.canvasTex(128, 128, c => { c.fillStyle = '#000'; c.fillRect(0, 0, 128, 128); c.fillStyle = '#fff'; c.beginPath(); c.arc(64, 64, 62, 0, 7); c.fill(); });
  const tag = A.tag(root, id.toUpperCase(), 'cameo', 4.45, 48); tag.n.style.background = COLORS[id]; tag.n.style.color = '#222438';
  const a = { id, root, body, rig, plaque, face, back, tag, fallbacks, mood: 'happy', active: false, fleeing: false, x: 0, z: 0, y: 0, heading: 0, age: 0, phase: id === 'dario' ? 1.8 : 0, fleeT: 0, dropT: 0 };
  setFoam(a, circleOutline());
  if (id === 'dario') {
    const glasses = new T.Group(); glasses.position.set(0, .12, .08); plaque.add(glasses);
    for (const x of [-.30, .30]) { const lens = mesh(glasses, new T.TorusGeometry(.225, .021, 6, 24), mats.ink, x, 0, 0); lens.scale.y = .77; }
    mesh(glasses, box, mats.ink, 0, 0, 0, .15, .035, .035); a.glasses = glasses;
  }
  root.visible = false; state.actors.push(a); applyCutArt(a); return a;
}
function makeRocket() {
  const root = new T.Group(), model = new T.Group(); root.name = 'ceos_toy_rocket'; root.add(model); K.scene.add(root);
  mesh(model, new T.CylinderGeometry(.23, .28, 1.1, 10), mats.white, 0, 0, 0);
  mesh(model, new T.ConeGeometry(.24, .52, 10), mats.coral, 0, .8, 0);
  mesh(model, new T.CylinderGeometry(.29, .29, .12, 10), mats.gold, 0, -.35, 0);
  const window = mesh(model, sphere, mats.blue, 0, .16, .23, .13, .13, .055);
  window.name = 'toy_porthole';
  for (let i = 0; i < 3; i++) {
    const fin = mesh(model, box, mats.coral, Math.sin(i * 2.094) * .27, -.4, Math.cos(i * 2.094) * .27, .11, .48, .34);
    fin.rotation.y = i * 2.094;
  }
  K.inkShell(model, .025);
  const flame = mesh(root, new T.ConeGeometry(.23, .85, 8), mats.flame, 0, -.98, 0); flame.rotation.z = Math.PI;
  glow = mesh(K.scene, new T.RingGeometry(.7, 1.05, 40), new T.MeshBasicMaterial({ color: '#ffda61', transparent: true, opacity: .8, side: T.DoubleSide, depthWrite: false }), 0, 0, 0);
  glow.rotation.x = -Math.PI / 2; glow.visible = false;
  rocket = { root, model, flame, dropped: false, dropAge: 0, x: 0, z: 0, y: 0, tag: A.tag(root, '', 'cameo', 1.6, 35) };
  root.visible = false; api.rocket = rocket;
}
function makeParticles() {
  particlePositions = new Float32Array(CONFIG.particleCount * 3); particleColors = new Float32Array(CONFIG.particleCount * 3);
  particleData = Array.from({ length: CONFIG.particleCount }, () => ({ age: 0, life: 0, vx: 0, vy: 0, vz: 0 }));
  const g = new T.BufferGeometry(); g.setAttribute('position', new T.BufferAttribute(particlePositions, 3)); g.setAttribute('color', new T.BufferAttribute(particleColors, 3));
  const tex = K.canvasTex(32, 32, c => { c.fillStyle = '#fff'; c.beginPath(); c.arc(16, 16, 13, 0, Math.PI * 2); c.fill(); });
  particles = new T.Points(g, new T.PointsMaterial({ size: .5, map: tex, vertexColors: true, transparent: true, alphaTest: .1, depthWrite: false }));
  particles.frustumCulled = false; K.scene.add(particles);
  for (let i = 0; i < CONFIG.particleCount; i++) particlePositions[i * 3 + 1] = -1000;
}
function puff(x, y, z, gold) {
  const i = state.particleCursor++ % CONFIG.particleCount, p = particleData[i], j = i * 3;
  p.age = 0; p.life = CONFIG.smokeLife; p.vx = U.rand(-.8, .8); p.vy = gold ? 2.1 : 1.3; p.vz = U.rand(-.8, .8);
  particlePositions[j] = x; particlePositions[j + 1] = y; particlePositions[j + 2] = z;
  particleColors[j] = 1; particleColors[j + 1] = gold ? .64 : .85; particleColors[j + 2] = gold ? .08 : .94;
}
function suppressLegacy() {
  K.game.duoT = 1e9; K.game.duo = null;
  hideLegacy(A.sam); hideLegacy(A.dario);
}
function hideLegacy(a) { if (a) { a.root.visible = false; if (a.tag) { a.tag.b.hidden = true; a.tag.bt = 0; } } }
function hide(a) { a.active = false; a.root.visible = false; a.tag.b.hidden = true; a.tag.bt = 0; }
function place(a, x, z) {
  a.x = x; a.z = z; a.y = W.terrainH(x, z); a.age = 0; a.active = true; a.fleeing = false; a.root.visible = true;
  a.root.position.set(x, a.y, z); a.root.scale.setScalar(.01); a.heading = 0; mood(a, 'happy');
  a.homeX = x; a.homeZ = z; a.wanderX = x; a.wanderZ = z; a.wanderT = U.rand(1, 2.5); a.moving = false;
}
function clearAt(x, z, r) { return !W.blockedAt(x, z, r, W.terrainH(x, z) + .1); }
function spawnSpot(pair) {
  const P = A.player;
  for (let i = 0; i < 35; i++) {
    const angle = P.heading + U.rand(-1.4, 1.4), d = U.rand(CONFIG.spawnNear, CONFIG.spawnFar);
    const x = P.x + Math.sin(angle) * d, z = P.z + Math.cos(angle) * d;
    if (!clearAt(x, z, 1.3) || (pair && (!clearAt(x - 2, z, 1.2) || !clearAt(x + 2, z, 1.2)))) continue;
    if (Math.abs(W.terrainH(x, z) - P.y) > 3) continue;
    return [x, z];
  }
  return null;
}
function spawnDuo(x, z) {
  const spot = x === undefined ? spawnSpot(true) : [x, z]; if (!spot) { state.duoT = 3; return false; }
  place(state.actors[0], spot[0] - 2, spot[1]); place(state.actors[1], spot[0] + 2, spot[1]);
  state.actors[0].heading = .65; state.actors[1].heading = -.65;
  state.duoIndex = Math.floor(Math.random() * (DUO_LINES.length / 2)) * 2; state.duoNext = .3; return true;
}
function spawnElon(x, z) {
  if (rocket.dropped) return false;
  const spot = x === undefined ? spawnSpot(false) : [x, z]; if (!spot) { state.elonT = 3; return false; }
  place(state.actors[2], spot[0], spot[1]); state.elonNext = .5; state.elonIndex = 0; state.soundT = 1.7;
  rocket.root.visible = true; rocket.flame.visible = true; rocket.root.rotation.set(0, 0, 0); glow.visible = false; return true;
}
api.spawnDuo = spawnDuo; api.spawnElon = spawnElon;
function dropTokens(a, count) {
  for (let i = 0; i < count; i++) {
    const ang = i * 2.39996, r = .7 + Math.sqrt((i + 1) / count) * CONFIG.tokenRadius;
    const x = a.x + Math.sin(ang) * r, z = a.z + Math.cos(ang) * r;
    if (clearAt(x, z, .25)) lowToken(x, z); else lowToken(a.x, a.z);
  }
}
function lowToken(x, z) { const count = A.items.length; A.addToken(x, z, true); if (A.items.length === count) return; const item = A.items[A.items.length - 1]; if (item && item.kind === 'token') item.val = 1; }
function scare(a, P) {
  a.fleeing = true; a.fleeT = CONFIG.fleeSeconds; a.dropT = .16;
  a.heading = Math.atan2(a.x - P.x, a.z - P.z) + (a.id === 'dario' ? .28 : -.28);
  mood(a, a.id === 'sam' ? 'angry' : 'sad');
  A.say(a.tag, SCARE_LINES[state.actors.indexOf(a)], 2.4, 'shout'); dropTokens(a, CONFIG.tokensPerCEO);
  for (let i = 0; i < 12; i++) puff(a.x, a.y + 1.5, a.z, true);
  if (a.id === 'elon') {
    const loc = W.free(a.x + Math.sin(a.heading) * .6, a.z + Math.cos(a.heading) * .6, .8);
    rocket.dropped = true; rocket.dropAge = 0; rocket.x = loc[0]; rocket.z = loc[1]; rocket.y = W.terrainH(rocket.x, rocket.z);
    rocket.flame.visible = false; glow.visible = true;
    A.sfxText(a.x, a.y + 3, a.z, 'KA-BOOM (small)!', 'big');
    A.say(rocket.tag, 'TOY ROCKET · touch to collect', 30, 'thought');
  }
}
function updateActor(a, dt) {
  if (!a.active) return;
  a.age += dt; const P = A.player, far = Math.hypot(P.x - a.x, P.z - a.z) > CONFIG.cullDistance;
  a.root.visible = !far;
  if (a.fleeing) {
    a.fleeT -= dt; a.dropT -= dt;
    const dx = Math.sin(a.heading) * CONFIG.fleeSpeed * dt, dz = Math.cos(a.heading) * CONFIG.fleeSpeed * dt;
    if (clearAt(a.x + dx, a.z + dz, .6)) { a.x += dx; a.z += dz; } else a.heading += dt * 9;
    a.y = W.terrainH(a.x, a.z);
    if (a.dropT <= 0) { a.dropT = .25; lowToken(a.x, a.z); puff(a.x, a.y + .1, a.z, false); }
    if (a.fleeT <= 0) { hide(a); return; }
  } else if (a.age > CONFIG.encounterLife || far) { hide(a); if (a.id === 'elon' && !rocket.dropped) rocket.root.visible = false; return; }
  else {
    // Gentle stroll around the encounter spot so the duo reads alive instead
    // of frozen; bark scare, dialogue, tokens and rocket logic are untouched.
    a.wanderT -= dt; a.moving = false;
    const dx = a.wanderX - a.x, dz = a.wanderZ - a.z, dist = Math.hypot(dx, dz);
    if (dist < .4 || a.wanderT <= 0) {
      if (a.wanderT <= 0) {
        const ang = U.rand(0, Math.PI * 2), r = U.rand(.8, CONFIG.wanderRadius);
        const nx = (a.homeX === undefined ? a.x : a.homeX) + Math.sin(ang) * r;
        const nz = (a.homeZ === undefined ? a.z : a.homeZ) + Math.cos(ang) * r;
        if (clearAt(nx, nz, .9)) { a.wanderX = nx; a.wanderZ = nz; a.wanderT = U.rand(4, 9); }
        else a.wanderT = U.rand(.5, 1.5);
      }
    } else {
      const step = Math.min(dist, CONFIG.wanderSpeed * dt);
      const nx = a.x + dx / dist * step, nz = a.z + dz / dist * step;
      if (clearAt(nx, nz, .6)) { a.x = nx; a.z = nz; a.y = W.terrainH(a.x, a.z); a.moving = true; a.heading = Math.atan2(dx, dz); }
      else a.wanderT = 0;
    }
  }
  const phase = state.time * (a.fleeing ? 29 : 3) + a.phase;
  const scale = Math.min(1, a.age * 4.5) * (a.fleeing ? Math.min(1, a.fleeT * 2) : 1);
  a.root.scale.setScalar(Math.max(.001, scale));
  a.root.position.set(a.x, a.y + (a.fleeing ? Math.abs(Math.sin(phase)) * .18 : 0), a.z);
  a.root.rotation.y = a.heading;
  a.rig.play(a.fleeing ? 'run' : a.moving ? 'walk' : a.age < 1.2 ? 'walk' : a.tag.bt > 0 ? 'talk' : 'idle', .22, a.fleeing ? 1.35 : .85);
  if (!far) a.rig.mixer.update(dt);
  a.plaque.position.y = 3.20 + Math.sin(phase) * (a.fleeing ? .055 : .014);
  a.plaque.rotation.z = Math.sin(phase * .7) * (a.fleeing ? .075 : .012);
}
function updateRocket(dt) {
  if (!rocket.root.visible) return;
  const e = state.actors[2], t = state.time;
  if (rocket.dropped) {
    rocket.dropAge += dt;
    rocket.root.position.set(rocket.x, rocket.y + .37 + Math.max(0, 1 - rocket.dropAge * 2) * 1.5, rocket.z);
    rocket.root.rotation.set(0, .55, Math.PI / 2);
    glow.position.set(rocket.x, rocket.y + .065, rocket.z); glow.scale.setScalar(1.2 + Math.sin(t * 4) * .12);
    glow.material.opacity = .65 + Math.sin(t * 5) * .2;
    const P = A.player;
    if (rocket.dropAge > CONFIG.pickupDelay && P.mode === 'walk' && Math.hypot(P.x - rocket.x, P.z - rocket.z) < CONFIG.pickupRadius && Math.abs(P.y - rocket.y) < 1.8) {
      const inv = K.game.inv = K.game.inv || {}; inv.rocket = (inv.rocket || 0) + 1;
      rocket.dropped = false; rocket.root.visible = glow.visible = false; rocket.tag.b.hidden = true; rocket.tag.bt = 0;
      K.UI.banner('ROCKET ACQUIRED', '— send it with your agent (Q)', 'cameo');
      A.sfxText(P.x, P.y + 3, P.z, 'YOINK!', 'big'); if (K.sfx.coin) K.sfx.coin(1.5);
      if (K.fn && K.fn.juice) K.fn.juice(.07, .12, .025);
    }
  } else if (e.active && !e.fleeing) {
    rocket.root.position.set(e.x + Math.cos(t * 2.6) * 1.75, e.y + 2.6 + Math.sin(t * 3.1) * 1.05, e.z + Math.sin(t * 2.6) * .9);
    rocket.root.rotation.set(Math.sin(t * 2.6) * .4, 0, -.5 - Math.cos(t * 3.1) * .7);
    rocket.flame.scale.setScalar(.85 + Math.sin(t * 41) * .2);
    state.trailT -= dt;
    if (state.trailT <= 0) { state.trailT = CONFIG.trailInterval; puff(rocket.root.position.x, rocket.root.position.y - .85, rocket.root.position.z, false); puff(rocket.root.position.x, rocket.root.position.y - .5, rocket.root.position.z, true); }
  }
}
K.on('build', () => {
  box = new T.BoxGeometry(1, 1, 1); sphere = new T.SphereGeometry(1, 10, 8); plaqueGeo = new T.ShapeGeometry(roundedShape(1, 1, .11));
  // ShapeGeometry uses position-space UVs; remap to the complete square portrait.
  const pos = plaqueGeo.attributes.position, uv = plaqueGeo.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, pos.getX(i) + .5, pos.getY(i) + .5);
  mats = { foam: K.toon('#dedbd0'), ink: new T.MeshBasicMaterial({ color: '#252638' }), pants: K.toon('#334052'), white: K.toon('#fff7e6'), skin: K.toon('#efbc95'), coral: K.toon('#ff6655'), gold: K.toon('#ffcf4a'), blue: K.toon('#3fe8eb'), flame: new T.MeshBasicMaterial({ color: '#ffbe36' }) };
  makeActor('sam'); makeActor('dario'); makeActor('elon'); makeRocket(); makeParticles(); state.built = true; loadArtOnce();
});
K.on('start', () => {
  if (!state.built) return;
  suppressLegacy(); state.actors.forEach(hide); state.time = 0; state.duoT = CONFIG.duoFirst; state.elonT = CONFIG.elonFirst;
  rocket.dropped = false; rocket.root.visible = glow.visible = false; rocket.tag.b.hidden = true; rocket.tag.bt = 0;
  for (let i = 0; i < particleData.length; i++) { particleData[i].life = 0; particlePositions[i * 3 + 1] = -1000; }
  particles.geometry.attributes.position.needsUpdate = true;
});
K.on('bark', (P, radius) => {
  if (!state.built || K.game.state !== 'play') return;
  let count = 0;
  for (const a of state.actors) if (a.active && !a.fleeing && Math.hypot(P.x - a.x, P.z - a.z) < radius && Math.abs(P.y - a.y) < 4) { scare(a, P); count++; }
  if (count) {
    A.addTokens(CONFIG.barkBonus * count, 'bark benchmark');
    K.UI.banner('BARK MARKET!', 'panic selling · follow the token trail', 'cameo');
    if (K.sfx.coin) K.sfx.coin(1.25); if (K.fn && K.fn.juice) K.fn.juice(.12, .17, .04);
  }
});
K.on('step', dt => {
  if (!state.built) return;
  suppressLegacy(); state.time += dt;
  const s = state.actors[0], d = state.actors[1], e = state.actors[2];
  if (!s.active && !d.active) { state.duoT -= dt; if (state.duoT <= 0 && spawnDuo()) state.duoT = U.rand(CONFIG.respawnMin, CONFIG.respawnMax); }
  if (!e.active && !rocket.dropped) { state.elonT -= dt; if (state.elonT <= 0 && spawnElon()) state.elonT = U.rand(CONFIG.respawnMin, CONFIG.respawnMax); }
  if (s.active && d.active && !s.fleeing && !d.fleeing) {
    state.duoNext -= dt;
    if (state.duoNext <= 0) {
      const line = DUO_LINES[state.duoIndex++ % DUO_LINES.length], a = line[0] === 'sam' ? s : d;
      mood(a, line[1]); A.say(a.tag, line[2], CONFIG.dialogueSeconds - .2, state.duoIndex % 4 === 0 ? 'thought' : 'speech'); state.duoNext = CONFIG.dialogueSeconds;
    }
  }
  if (e.active && !e.fleeing) {
    state.elonNext -= dt; state.soundT -= dt;
    if (state.elonNext <= 0) { const line = ELON_LINES[state.elonIndex++ % ELON_LINES.length]; mood(e, line[0]); A.say(e.tag, line[1], 3.2, 'speech'); state.elonNext = CONFIG.elonDialogueSeconds; }
    if (state.soundT <= 0) { A.sfxText(rocket.root.position.x, rocket.root.position.y + 1, rocket.root.position.z, ROCKET_SOUNDS[(state.elonIndex - 1) % ROCKET_SOUNDS.length], 'big'); state.soundT = CONFIG.elonDialogueSeconds; }
  }
  for (const a of state.actors) updateActor(a, dt);
  updateRocket(dt);
  for (let i = 0; i < particleData.length; i++) {
    const p = particleData[i], j = i * 3; if (p.life <= 0) continue;
    p.age += dt; if (p.age >= p.life) { p.life = 0; particlePositions[j + 1] = -1000; continue; }
    particlePositions[j] += p.vx * dt; particlePositions[j + 1] += p.vy * dt; particlePositions[j + 2] += p.vz * dt;
  }
  particles.geometry.attributes.position.needsUpdate = true; particles.geometry.attributes.color.needsUpdate = true;
});
K.on('frame', dt => {
  if (!state.built) return;
  // Main sets the camera pose before this hook; refresh its inverse before
  // A.updateTags projects the speech bubbles (render updates it too late).
  if (state.actors[0].active || state.actors[1].active || state.actors[2].active || rocket.dropped) K.camera.updateMatrixWorld(true);
  state.cutPoll = (state.cutPoll || 0) - dt;
  if (state.cutPoll <= 0) { state.cutPoll = 20; loadCutArt(); }
});
K.on('end', () => { if (!state.built) return; state.actors.forEach(hide); rocket.root.visible = glow.visible = false; });
K.scenes = K.scenes || {};
function review(h, elon) {
  h.play(); const spot = W.freeWalk(40, 4, 5); h.go(spot[0], spot[1] + 5.4);
  state.duoT = state.elonT = 1e6; h.pz.wait = 1e6;
  if (elon) spawnElon(spot[0], spot[1]); else { spawnDuo(spot[0], spot[1]); state.duoIndex = 0; }
  h.st(36);
  const y = W.terrainH(spot[0], spot[1]);
  const look = new T.Vector3(spot[0], y + 2.0, spot[1] + 1.1), cameraPos = new T.Vector3();
  // Choose a clear review sightline instead of letting a plaza tree push the
  // camera into the oversized portraits. Normal gameplay keeps the game camera.
  let best = -1; const candidate = new T.Vector3(), dogLook = new T.Vector3(h.P.x, h.P.y + 1.1, h.P.z);
  for (let i = 0; i < 24; i++) {
    const angle = .25 + i * Math.PI / 12;
    candidate.set(spot[0] + Math.sin(angle) * 12.5, y + 5.8, spot[1] + Math.cos(angle) * 12.5);
    const k = Math.min(W.clipCamera(look, candidate, 1), W.clipCamera(dogLook, candidate, .8));
    if (k > best) { best = k; cameraPos.copy(candidate); }
    if (k > .98) break;
  }
  K.sceneCam = { noClip: true, pos: cameraPos, look };
  const dx = (cameraPos.x - spot[0]) / 12.5, dz = (cameraPos.z - spot[1]) / 12.5;
  if (!elon) for (let i = 0; i < 2; i++) {
    const a = state.actors[i], side = i ? 1 : -1;
    a.x = spot[0] + dz * side * 2; a.z = spot[1] - dx * side * 2; a.y = W.terrainH(a.x, a.z);
    a.heading = Math.atan2(dx, dz) - side * .35;
    a.homeX = a.x; a.homeZ = a.z; a.wanderX = a.x; a.wanderZ = a.z;
  }
  else { state.actors[2].heading = Math.atan2(dx, dz); state.actors[2].homeX = state.actors[2].x; state.actors[2].homeZ = state.actors[2].z; }
  h.go(spot[0] + dx * 4.5 - dz * 1.7, spot[1] + dz * 4.5 + dx * 1.7);
  h.st(2);
}
K.scenes.ceos = h => review(h, false); K.scenes.elon = h => review(h, true);
// Exercised by the same server-owned screenshot runner as the visual scenes.
K.scenes.ceos_check = h => {
  review(h, false);
  const checks = [], P = A.player, s = state.actors[0], d = state.actors[1];
  const check = (name, ok) => { checks.push({ name, pass: !!ok }); if (!ok) throw new Error('ceos verification: ' + name); };
  check('legacy duo suppressed', K.game.duo === null && K.game.duoT > 1e8 && !A.sam.root.visible && !A.dario.root.visible);
  const seen = new Set(); state.duoIndex = 0;
  for (let i = 0; i < 10; i++) { state.duoNext = 0; h.st(1); seen.add(s.mood); seen.add(d.mood); }
  check('all four dialogue moods', seen.size === 4);
  let before = K.game.tokens; K.emit('bark', { x: -900, z: 900, y: 0 }, 17);
  check('distant bark ignored', K.game.tokens === before && !s.fleeing && !d.fleeing);
  P.x = (s.x + d.x) / 2; P.z = s.z + 5; P.y = W.terrainH(P.x, P.z);
  const tempBefore = A.items.filter(i => i.temp && i.active).length;
  before = K.game.tokens; K.fn.bark();
  check('actual bark scares both CEOs', s.fleeing && d.fleeing && s.mood === 'angry' && d.mood === 'sad');
  check('generous reward and physical token shower', K.game.tokens - before >= 2 * CONFIG.barkBonus && A.items.filter(i => i.temp && i.active).length - tempBefore >= 2 * CONFIG.tokensPerCEO);
  before = K.game.tokens; K.emit('bark', P, 17);
  check('same encounter cannot be farmed', K.game.tokens === before);
  const sx = s.x, sz = s.z; h.st(15);
  check('flee movement', Math.hypot(s.x - sx, s.z - sz) > 1);
  h.st(140); check('flee cleanup', !s.active && !d.active);
  K.game.start(true); A.pascal.wait = 1e6; state.duoT = state.elonT = 1e6;
  check('restart clears encounters', state.actors.every(a => !a.active) && !rocket.dropped && !rocket.root.visible);
  const loc = W.freeWalk(46, 40, 5); h.go(loc[0], loc[1] + 5);
  spawnElon(loc[0], loc[1]); h.st(20); K.fn.bark();
  check('Elon drops rocket on bark', state.actors[2].fleeing && rocket.dropped && !rocket.flame.visible);
  h.st(125);
  check('rocket persists after Elon leaves', !state.actors[2].active && rocket.dropped && rocket.root.visible);
  const inventoryBefore = (K.game.inv && K.game.inv.rocket) || 0;
  P.x = rocket.x; P.z = rocket.z; P.y = rocket.y; P.vx = P.vz = P.vy = 0; h.st(1);
  check('touch grants one shared rocket', K.game.inv.rocket === inventoryBefore + 1 && !rocket.dropped && !rocket.root.visible);
  for (let i = 0; i < 8 && !document.querySelector('#banner').textContent.includes('ROCKET ACQUIRED'); i++) K.UI.updateBanner(1.91);
  check('pickup banner delivered from queue', document.querySelector('#banner').textContent.includes('ROCKET ACQUIRED'));
  h.st(10); check('pickup is one-shot', K.game.inv.rocket === inventoryBefore + 1);
  api.lastCheck = checks; console.info('CEOS PASS ' + checks.length + ': ' + checks.map(c => c.name).join(', '));
};
K.scenes.elon_drop = h => { review(h, true); K.fn.bark(); h.st(27); };
K.scenes.elon_pickup = h => {
  review(h, true); K.fn.bark(); h.st(27);
  h.go(rocket.x, rocket.z); h.st(2);
};
K.scenes.ceos_side = h => { review(h, false); state.actors[0].heading += 1.22; state.actors[1].heading += Math.PI; h.st(1); };
K.scenes.ceos_cut_check = h => {
  review(h, false); const checks = [], check = (ok, name) => { if (!ok) throw new Error('STANDEE CHECK: ' + name); checks.push(name); };
  for (const a of state.actors) {
    check(a.cutReady, a.id + ' cut textures and outline loaded');
    check(!!a.back.material.map && !a.back.material.alphaMap, a.id + ' separate alpha back texture');
    a.edge.geometry.computeBoundingBox(); const box = a.edge.geometry.boundingBox;
    check(Math.abs(box.max.z - box.min.z - .123) < .001, a.id + ' six-percent foam thickness');
    check(a.rig.sourceModel === 'casual_character', a.id + ' imported body');
  }
  const a = state.actors[0], angle = a.plaque.rotation.y; K.camera.position.x += 15; K.emit('frame', .016, 0, K.game);
  check(a.plaque.rotation.y === angle, 'camera movement does not billboard heads');
  api.standeeChecks = checks; console.warn('STANDEE_CHECK ' + JSON.stringify(checks));
};
})(window.K);
