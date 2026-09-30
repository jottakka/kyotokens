/* Life worker: additive build/start/step/frame/bark/end hooks only; no A/UI wrappers.
   Existing hydrants are replaced at their world positions with one red instanced batch.
   Added skaters register in A.peds (board3) so main.js remains the board-theft authority. */
(function (K) {
'use strict';
const T = K.T, W = K.W, A = K.A, TAU = Math.PI * 2;
const life = K.life = { hydrants: [], skaters: [], carriers: [], animals: [], drops: [], marked: 0 };
const cards = life.cards = [
  { id: 'berlin', who: 'Herr & Frau Nihon', city: 'BERLIN', stamp: 'DE', color: '#ed7357', story: 'Frau Nihon became Chancellor; Herr Nihon still holds the treat portfolio.', aliases: ['parents', 'nihon'] },
  { id: 'osaka', who: 'Osaka', city: 'NEW YORK', stamp: 'US', color: '#e6ad35', story: 'Runs a hot-dog cart for dogs. The customers keep eating the business cards.' },
  { id: 'nara', who: 'Nara', city: 'PARIS', stamp: 'FR', color: '#7289c3', story: 'A world-famous mime, until someone rings an imaginary doorbell.' },
  { id: 'sapporo', who: 'Sapporo', city: 'ZERMATT', stamp: 'CH', color: '#68adae', story: 'Mountain rescue legend. The barrel holds apple juice; the moustache is foam.' },
  { id: 'kobe', who: 'Kobe', city: 'RIO', stamp: 'BR', color: '#e58fa7', story: 'Won the samba championship. The tail did all the work.' },
  { id: 'nagoya', who: 'Nagoya', city: 'BONDI', stamp: 'AU', color: '#45abc0', story: 'Lifeguard of the year: 400 tennis balls rescued, zero willing to leave the water.' },
  { id: 'yokohama', who: 'Yokohama', city: 'ICELAND', stamp: 'IS', color: '#8577bc', story: 'Howls at the northern lights. Still waiting for the sky to howl back.' },
  { id: 'munich', who: 'The whole pack', city: 'MUNICH · SECRET', stamp: 'DE', color: '#7eab6b', story: 'Everyone wore Tracht. Nobody could explain the sausages missing from the photo.', secret: true }
];
let group, stream, nearest, marking, leg, legRest, clock = 0, scanT = 0, keyF = false, secret;
let album, albumButton, albumOpen = false, resumeAlbum = false, previousFocus;
let imageFiles = null, imageScanAt = -1e6, imageScan;
const found = new Set();
try { for (const id of JSON.parse(localStorage.getItem('kyoto-family-v1') || '[]')) if (cards.some(c => c.id === id)) found.add(id); } catch (_) {}
const dummy = new T.Object3D(), mat4 = new T.Matrix4(), wp = new T.Vector3();
const up = new T.Vector3(0, 1, 0), direction = new T.Vector3();
const whiteMat = K.toon('#ffffff', { vertexColors: true });
const geoCache = new Map();
// Bake vertex colours: a complete toon body is one draw call, shared by every clone.
function bake(parts) {
  const pos = [], normal = [], colors = [];
  for (const p of parts) {
    let g = p[0] === 'box' ? new T.BoxGeometry(1, 1, 1) : p[0] === 'cyl' ? new T.CylinderGeometry(1, 1, 1, 8) : p[0] === 'cone' ? new T.ConeGeometry(1, 1, 5) : new T.SphereGeometry(1, 8, 6);
    if (g.index) { const old = g; g = g.toNonIndexed(); old.dispose(); }
    g.scale(p[5], p[6], p[7]); if (p[8]) g.rotateZ(p[8]); if (p[9]) g.rotateX(p[9]); g.translate(p[2], p[3], p[4]);
    const c = new T.Color(p[1]), a = g.attributes.position, n = g.attributes.normal;
    for (let i = 0; i < a.count; i++) { pos.push(a.getX(i), a.getY(i), a.getZ(i)); normal.push(n.getX(i), n.getY(i), n.getZ(i)); colors.push(c.r, c.g, c.b); }
    g.dispose();
  }
  const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); g.setAttribute('normal', new T.Float32BufferAttribute(normal, 3)); g.setAttribute('color', new T.Float32BufferAttribute(colors, 3)); g.computeBoundingSphere(); return g;
}
function mesh(key, parts) { if (!geoCache.has(key)) geoCache.set(key, bake(parts)); const m = new T.Mesh(geoCache.get(key), whiteMat); m.castShadow = true; return m; }
function clearSpot(x, z, r) { return W.free(x, z, r || .65); }
function walkable(x, z, r) { return W.inLand(x, z, r || .6) && !W.blockedAt(x, z, r || .6, W.terrainH(x, z) + .1); }
function visible(root, x, z, range) { root.visible = (x - A.player.x) ** 2 + (z - A.player.z) ** 2 < range * range; return root.visible; }
function countFound() { return found.size; }
function save() { try { localStorage.setItem('kyoto-family-v1', JSON.stringify(Array.from(found))); } catch (_) {} }
function sound(name) { if (K.sfx && K.sfx[name]) K.sfx[name](); }

function buildHydrants(scene) {
  const positions = [], seen = new Set(), originals = [];
  life.hydrantSources = { decorate: 0, dressing: 0 };
  scene.updateMatrixWorld(true);
  // decorate() emits unnamed meshes. Match baked kit geometry, never broad material names.
  const kit = W.kitParts(K.assets.props, 'hydrant') || W.kitParts(K.assets.props2, 'hydrant');
  const kitParts = kit ? kit.parts : [];
  function kitHydrant(o) {
    if (!o.isInstancedMesh || !o.geometry.attributes.position) return false;
    const a = o.geometry.attributes.position.array;
    return kitParts.some(p => { if (o.material !== p.mat) return false; const b = p.geo.attributes.position.array; if (a.length !== b.length) return false; for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false; return true; });
  }
  function put(x, y, z) { const key = Math.round(x * 2) + ':' + Math.round(z * 2); if (seen.has(key)) return; seen.add(key); positions.push([x, y, z]); }
  scene.traverse(o => {
    if ((!/hydrant/i.test(o.name || '') && !kitHydrant(o)) || (o.parent && /hydrant/i.test(o.parent.name || ''))) return;
    if (o.isInstancedMesh) { for (let i = 0; i < o.count; i++) { o.getMatrixAt(i, mat4); mat4.premultiply(o.matrixWorld); wp.setFromMatrixPosition(mat4); put(wp.x, wp.y, wp.z); } }
    else { o.getWorldPosition(wp); put(wp.x, wp.y, wp.z); }
    life.hydrantSources[/dressing/i.test(o.name) ? 'dressing' : 'decorate'] += o.isInstancedMesh ? o.count : 1;
    originals.push(o);
  });
  originals.forEach(o => { o.visible = false; if (o.isInstancedMesh) o.count = 0; });
  kitParts.forEach(p => p.geo.dispose());
  const S = W.HOME.start;
  for (const [x, z] of [[S.x - 4.8, S.z - 2], [S.x - 16, S.z - 8], [200, 146], [112, -20], [40, 30], [-150, 104], [-78, 150], [80, -195]]) {
    const q = clearSpot(x, z); put(q[0], W.terrainH(q[0], q[1]), q[1]);
  }
  const red = '#f12b39', ink = '#532437', cream = '#fff1d4';
  const g = bake([
    ['cyl', ink, 0, .09, 0, .49, .18, .49], ['cyl', red, 0, .21, 0, .44, .18, .44],
    ['cyl', red, 0, .79, 0, .30, 1.15, .30], ['cyl', cream, 0, 1.20, 0, .34, .10, .34],
    ['ball', red, 0, 1.37, 0, .38, .26, .38], ['cyl', ink, 0, 1.60, 0, .10, .12, .10],
    ['cyl', red, 0, .91, 0, .18, 1.12, .18, Math.PI / 2],
    ['cyl', cream, -.56, .91, 0, .20, .09, .20, Math.PI / 2], ['cyl', cream, .56, .91, 0, .20, .09, .20, Math.PI / 2],
    ['ball', ink, 0, .85, .30, .19, .19, .10], ['ball', cream, 0, .85, .38, .12, .12, .05]
  ]);
  const im = new T.InstancedMesh(g, K.toon('#ffffff', { vertexColors: true, emissive: '#e33c34', emissiveIntensity: .12 }), positions.length); im.name = 'life-red-hydrants'; im.castShadow = true; im.receiveShadow = true; im.frustumCulled = false;
  positions.forEach((p, i) => { dummy.position.set(...p); dummy.rotation.set(0, 0, 0); dummy.scale.setScalar(1); dummy.updateMatrix(); im.setMatrixAt(i, dummy.matrix); life.hydrants.push({ x: p[0], y: p[1], z: p[2], cooldown: 0, marked: false, flag: null }); });
  group.add(im); life.originalHydrants = positions.length - 8;
  const particles = new T.InstancedMesh(new T.SphereGeometry(1, 6, 4), K.toon('#ffe642', { emissive: '#a97300', emissiveIntensity: .22 }), 28);
  particles.instanceMatrix.setUsage(T.DynamicDrawUsage); particles.frustumCulled = false; particles.visible = false; group.add(particles); stream = particles;
  A.kyoto.root.traverse(o => { if (/(?:^bl_up[._]?L$|thigh.*[lr]|(?:back|rear|hind).*leg|leg.*(?:back|rear|hind))/i.test(o.name) && !leg) leg = o; });
}
function flagFor(h) {
  const r = new T.Group();
  r.add(mesh('flag', [['cyl', '#faf1c6', 0, .40, 0, .025, .8, .025], ['box', '#55d8c2', .28, .66, 0, .57, .40, .035], ['ball', '#173c48', .28, .62, .027, .095, .075, .015], ...[-1, 0, 1].map(i => ['ball', '#173c48', .28 + i * .083, .75 + (i === 0 ? .025 : 0), .028, .04, .045, .015])]));
  r.position.set(h.x + .4, h.y + 1.3, h.z); group.add(r); return r;
}
function finishMark(reward) {
  if (!marking) return;
  const h = marking.h;
  if (A.player.ext === holdPose) A.player.ext = null;
  if (leg && legRest) leg.quaternion.copy(legRest);
  stream.visible = false; marking = null;
  if (!reward) return;
  h.cooldown = 35; h.marked = true; if (!h.flag) h.flag = flagFor(h); h.flag.visible = true;
  life.marked++; K.game.hydrants = life.marked; A.addTokens(256, 'territory');
  A.sfxText(h.x, h.y + 2.5, h.z, '+PTS!', 'gold'); sound('coin'); K.fn.juice(.08, .1);
  let best = 14, ped;
  for (const p of A.peds) { const d = Math.hypot(p.x - h.x, p.z - h.z); if (d < best) { best = d; ped = p; } }
  if (ped) A.say(ped.tag, life.marked % 2 ? 'Ew! …Good boy?' : 'That is municipal property!', 2.5);
  updateAlbumButton();
}
function holdPose(dt) {
  const p = A.player, k = A.kyoto;
  p.speed = p.vx = p.vz = 0; k.play('idle', .1); k.mixer.update(dt); k.root.position.set(p.x, p.y, p.z); k.root.rotation.y = p.heading;
}
function mark() {
  const p = A.player, h = nearest;
  if (!h || Math.hypot(h.x - p.x, h.z - p.z) > 3.4 || Math.abs(h.y - p.y) > 1.5 || h.cooldown > 0 || marking || p.ext || p.mode !== 'walk' || !p.onGround || p.board > 0) return false;
  p.heading = Math.atan2(h.x - p.x, h.z - p.z) - Math.PI / 2;
  if (leg) legRest = leg.quaternion.clone();
  marking = { h, t: 0 }; p.ext = holdPose; p.inv = Math.max(p.inv, 2.1); sound('click'); return true;
}
life.mark = mark;
function tickHydrants(dt) {
  const p = A.player;
  for (const h of life.hydrants) if (h.cooldown > 0) h.cooldown = Math.max(0, h.cooldown - dt);
  scanT -= dt;
  if (scanT <= 0) {
    scanT = .16; nearest = null; let distance = 3.2;
    for (const h of life.hydrants) { const d = Math.hypot(h.x - p.x, h.z - p.z); if (d < distance && Math.abs(h.y - p.y) < 1.5) { nearest = h; distance = d; } if (h.flag) { visible(h.flag, h.x, h.z, 80); h.flag.visible = h.flag.visible && h.marked; } }
    const ready = nearest && p.mode === 'walk' && p.onGround && p.board <= 0;
    if (ready && !albumOpen) K.UI.prompt(marking ? 'A VERY IMPORTANT MESSAGE…' : nearest.cooldown > 0 ? '✓ MARKED · ' + Math.ceil(nearest.cooldown) + 's' : 'F · LEAVE A PEE-MAIL  +256', { source: 'hydrant', priority: 40, onActivate: mark });
    else K.UI.clearPrompt('hydrant');
  }
  const down = !!K.keys.KeyF;
  if ((K.pressed('KeyF') || (down && !keyF)) && !marking) mark(); keyF = down;
  if (!marking) return;
  if (p.mode !== 'walk' || p.ext !== holdPose) { finishMark(false); return; }
  marking.t += dt;
  if (marking.t >= 1.8) finishMark(true);
}

function board() {
  const r = new T.Group();
  r.add(mesh('deck', [['box', '#ff5b9b', 0, .15, 0, .79, .13, 2.10], ['ball', '#ffd84f', 0, .18, 1.03, .39, .08, .35], ['ball', '#ffd84f', 0, .18, -1.03, .39, .08, .35], ['box', '#392e58', 0, .224, 0, .62, .015, 1.5], ...[-1, 1].flatMap(x => [-1, 1].map(z => ['cyl', '#61ead4', x * .43, .03, z * .72, .16, .13, .16, Math.PI / 2]))]));
  return r;
}
let carrierTimer = 15, directorTick = 0, envelopeMaterial;
const carrierView = new T.Vector3();
function envelopeIcon() {
  if (!envelopeMaterial) {
    const map = K.canvasTex(128, 128, c => {
      c.fillStyle = '#153c6c'; c.beginPath(); c.arc(64, 64, 59, 0, TAU); c.fill();
      c.strokeStyle = '#faf4cd'; c.lineWidth = 5; c.stroke();
      c.fillStyle = '#fffbea'; c.fillRect(25, 40, 78, 51);
      c.strokeStyle = '#237dc7'; c.lineWidth = 5; c.beginPath(); c.moveTo(27, 43); c.lineTo(64, 69); c.lineTo(101, 43); c.stroke();
      c.fillStyle = '#ef5853'; c.fillRect(84, 48, 11, 12);
    });
    envelopeMaterial = new T.SpriteMaterial({ map, depthTest: true, depthWrite: false });
  }
  const icon = new T.Sprite(envelopeMaterial); icon.position.y = 4.15; icon.scale.set(1.05, 1.05, 1); return icon;
}
function carrierDirector(dt) {
  carrierTimer -= dt; directorTick -= dt;
  if (directorTick <= 0) {
    directorTick = .2;
    for (const p of life.carriers) if (p.mailIcon) { p.mailIcon.visible = Math.hypot(p.x - A.player.x, p.z - A.player.z) < 50; p.mailIcon.position.y = 4.15 + Math.sin(clock * 2.8 + p.lifeIndex) * .13; }
  }
  if (carrierTimer > 0) return;
  carrierTimer = 35 + Math.random() * 15;
  const P = A.player;
  if (cards.every(c => c.secret || found.has(c.id))) return;   // every postcard found: no more deliveries
  if (life.carriers.some(p => p.seekT > 0 || Math.hypot(p.x - P.x, p.z - P.z) < 25)) return;
  K.camera.updateMatrixWorld(true);
  for (let i = 0; i < 32; i++) {
    const angle = P.heading + (i % 2 ? 1 : -1) * (.4 + (i % 16) * .055), distance = 38 + (i % 5) * 4;
    const q = W.freeWalk(P.x + Math.sin(angle) * distance, P.z + Math.cos(angle) * distance, .8);
    const dist = Math.hypot(q[0] - P.x, q[1] - P.z);
    if (dist < 35 || dist > 60 || !walkable(q[0], q[1], .8)) continue;
    carrierView.set(q[0], W.terrainH(q[0], q[1]) + 2, q[1]).project(K.camera);
    if (carrierView.z > -1 && carrierView.z < 1 && Math.abs(carrierView.x) < 1.15 && Math.abs(carrierView.y) < 1.2) continue;
    // A clear approach segment prevents a carrier being assigned a wall as a route.
    const approach = W.freeWalk(P.x + Math.sin(P.heading) * 5, P.z + Math.cos(P.heading) * 5, .8);
    let clear = true;
    for (let t = 0; t <= 1; t += .08) if (!walkable(q[0] + (approach[0] - q[0]) * t, q[1] + (approach[1] - q[1]) * t, .6)) { clear = false; break; }
    if (!clear) continue;
    const p = life.carriers.reduce((a, b) => Math.hypot(a.x - P.x, a.z - P.z) > Math.hypot(b.x - P.x, b.z - P.z) ? a : b);
    Object.assign(p, { x: q[0], z: q[1], goalX: approach[0], goalZ: approach[1], blockT: 0, heading: Math.atan2(approach[0] - q[0], approach[1] - q[1]) });
    p.seekT = 50; p.waitT = 0; p.greeted = false;   // actively walks up to Kyoto, rings, and waits for a bark
    p.y = W.terrainH(p.x, p.z); p.place(); p.play('walk'); p.root.visible = true; A.pedGroup.add(p.root);
    life.lastDispatch = { x: p.x, z: p.z, distance: dist, time: clock, outsideView: true }; return;
  }
  carrierTimer = 4; // Retry only when there was no valid, unseen sidewalk approach.
}
life.carrierDirector = carrierDirector;

function person(x, z, kind, index) {
  const q = clearSpot(x, z, .8), sk = kind === 'skater';
  const p = A.person({ n: sk ? 'skater' : 'local', model: sk ? 'skateboarder' : 'casual_character', acc: ['acc_cap', 'acc_hair_short', ...(sk ? [] : ['acc_bag'])], shirt: sk ? ['#ec4b95', '#25bcb3', '#ffbd39'][index % 3] : kind === 'owner' ? ['#e99b56', '#bc8ede', '#73b393'][index % 3] : '#4baee8', pants: '#243755', hat: sk ? '#ffe354' : '#214873', shoes: '#faf3dc', bag: '#254d78' });
  Object.assign(p, { x: q[0], z: q[1], y: W.terrainH(q[0], q[1]), heading: 0, arch: sk ? 'skater' : 'mailman', still: true, scared: 0, hiT: 1e6, sp: sk ? 5.5 : 1.6, lifeDriven: true, lifeIndex: index, ox: q[0], oz: q[1], goalX: q[0], goalZ: q[1] + 12, dir: 1, cooldown: 0, chase: 0, trick: 3 + index % 5 });
  p.tag = A.tag(p.root, '', null, 3.9, 42); A.peds.push(p); A.pedGroup.add(p.root); p.place(); p.play(sk ? 'skate' : 'walk');
  if (sk) { p.board3 = board(); p.board3.position.y = .12; p.root.add(p.board3); life.skaters.push(p); }
  else if (kind === 'mailman') {
    p.mailIcon = envelopeIcon(); p.root.add(p.mailIcon);
    const cap = mesh('postal-cap', [['ball', '#237bc2', 0, 3.20, 0, .31, .17, .29], ['box', '#194a81', 0, 3.12, .25, .59, .055, .32], ['box', '#fff8dd', 0, 3.22, .286, .19, .09, .025]]);
    p.root.add(cap); p.root.updateMatrixWorld(true);
    const head = p.model && (p.model.getObjectByName('Head') || p.model.getObjectByName('head')); if (head) head.attach(cap);
    p.mailBag = mesh('mailbag', [['box', '#203e65', .58, 1.35, 0, .58, .77, .46], ['box', '#fff2d3', .58, 1.71, .07, .41, .29, .30], ['box', '#f05456', .58, 1.38, .24, .39, .065, .025], ['box', '#f7f5e4', .58, 1.5, .24, .39, .12, .025], ['box', '#294f77', -.1, 2.05, .27, .11, 1.05, .065, -.38]]); p.root.add(p.mailBag);
    life.carriers.push(p);
  }
  return p;
}
life.spawnSkater = function (x, z) {
  if (!group || !Number.isFinite(x) || !Number.isFinite(z)) return null;
  let p;
  if (life.skaters.length >= 24) { p = life.skaters.reduce((a, b) => Math.hypot(a.x - A.player.x, a.z - A.player.z) > Math.hypot(b.x - A.player.x, b.z - A.player.z) ? a : b); const q = clearSpot(x, z); p.x = q[0]; p.z = q[1]; p.ox = p.x; p.oz = p.z; }
  else p = person(x, z, 'skater', life.skaters.length);
  p.chase = 18; p.noBoard = 0; p.board3.visible = true; p.sp = 5.5; p.root.visible = true; p.y = W.terrainH(p.x, p.z); p.place(); return p;
};
function tickPerson(p, dt, sk) {
  if (p.cooldown > 0) p.cooldown -= dt;
  if (!visible(p.root, p.x, p.z, 125)) return;
  if (!p.root.parent) A.pedGroup.add(p.root);
  if (sk && p.noBoard > 0) { p.noBoard -= dt; if (p.noBoard <= 0) { p.board3.visible = true; p.sp = 5.5; p.play('skate'); } }
  if (Math.hypot(p.x - A.player.x, p.z - A.player.z) < 65) p.mixer.update(dt);
  if (p.startle > 0) { p.startle -= dt; return; }
  p.scared = Math.max(0, p.scared - dt);
  let gx, gz;
  if (p.scared > 0) { gx = p.x + (p.x - A.player.x); gz = p.z + (p.z - A.player.z); }
  else if (sk && p.chase > 0 && p.board3.visible) { p.chase -= dt; gx = A.player.x; gz = A.player.z; }
  else if (p.seekT > 0) {   // delivery: head for Kyoto, stop a few metres away, ring the bell and wait for a bark
    p.seekT -= dt; const P = A.player, kd = Math.hypot(P.x - p.x, P.z - p.z);
    if (kd < 6.5 || p.waitT > 0) { if (!p.greeted) { p.greeted = true; p.waitT = 12; K.A.say(p.tag || (p.tag = K.A.tag(p.root, '', null, 2.6, 60)), U.pick(['📬 Mail for Kyoto?', '📬 Special delivery!', '📬 Postcard! …from Kobe?']), 3, 'speech');
        if (K.sfx.coin) K.sfx.coin(); if (!life.toldMail) { life.toldMail = true; K.UI.banner('MAIL CARRIER!', 'bark (B / ↓) to shake a postcard loose', 'mail'); } }
      p.waitT -= dt; p.heading = U.lerpAng(p.heading, Math.atan2(P.x - p.x, P.z - p.z), 1 - Math.exp(-dt * 5)); p.place(); if (p.curName !== 'idle') p.play('idle');
      if (p.waitT <= 0) { p.seekT = 0; p.ox = p.x; p.oz = p.z; p.play('walk'); } return; }
    const ax = P.x - Math.sin(P.heading) * 1.5, az = P.z - Math.cos(P.heading) * 1.5; gx = ax; gz = az; p.goalX = gx; p.goalZ = gz; p.blockT = 0;
  }
  else { gx = p.goalX; gz = p.goalZ; }
  let dx = gx - p.x, dz = gz - p.z, d = Math.hypot(dx, dz);
  if (d < 1.5 || p.blockT > 1) {
    p.dir *= -1; p.blockT = 0;
    const a = p.lifeIndex * 2.4 + (p.dir > 0 ? 0 : Math.PI);
    const q = clearSpot(p.ox + Math.sin(a) * 13, p.oz + Math.cos(a) * 13);
    p.goalX = q[0]; p.goalZ = q[1]; dx = p.goalX - p.x; dz = p.goalZ - p.z; d = Math.hypot(dx, dz);
  }
  if (d > .05) {
    const oldX = p.x, oldZ = p.z, speed = p.scared > 0 ? 5.8 : sk && p.board3.visible ? 5.5 : p.seekT > 0 ? 3.6 : 1.8;
    W.move(p, dx / d * speed * dt, dz / d * speed * dt, .55, p.y, { grounded: true });
    p.blockT = Math.hypot(p.x - oldX, p.z - oldZ) < .1 * dt ? (p.blockT || 0) + dt : 0;
    p.heading = Math.atan2(dx, dz); p.y = W.terrainH(p.x, p.z); p.place();
  }
  p.play(p.scared > 0 ? 'panic' : sk && p.board3.visible ? 'skate' : 'walk', .2);
  if (sk && p.board3.visible) {
    p.trick -= dt;
    if (p.trick < 0) {
      const t = Math.min(1, -p.trick / .72), lift = Math.sin(t * Math.PI);
      p.root.position.y += lift * .85; p.board3.rotation.z = t * TAU; p.board3.position.y = .12 + lift * .25;
      if (t >= 1) { p.trick = 5 + (p.lifeIndex % 4) * 1.2; p.board3.rotation.z = 0; p.board3.position.y = .12; }
    }
  } else if (sk) { p.board3.rotation.z = 0; p.board3.position.y = .12; }
}

function animal(kind, x, z, index) {
  const r = new T.Group(), bird = kind === 'pigeon' || kind === 'gull', raccoon = kind === 'raccoon', squirrel = kind === 'squirrel', dog = kind === 'dog';
  const color = bird ? (kind === 'gull' ? '#f8f4df' : '#8293af') : raccoon ? '#929696' : squirrel ? '#bc713c' : dog ? '#eac589' : '#dc9563';
  let body;
  if (bird) {
    body = mesh(kind + '-body', [['ball', color, 0, .40, 0, .26, .33, .40], ['ball', color, 0, .73, .18, .20, .21, .20], ['ball', kind === 'pigeon' ? '#45afa9' : '#f8f4df', 0, .58, .15, .17, .15, .17], ['cone', '#f3bb42', 0, .70, .43, .095, .25, .095, 0, Math.PI / 2], ...[-1, 1].flatMap(s => [['ball', '#1b2b3a', s * .15, .78, .29, .045, .045, .035], ['cyl', '#e88267', s * .12, .09, 0, .024, .18, .024], ['box', '#e88267', s * .12, .015, .07, .08, .028, .19]])]);
    r.add(body);
    for (const s of [-1, 1]) { const wing = mesh(kind + '-wing', [['ball', kind === 'gull' ? '#d8e4e5' : '#53678c', .22, 0, -.07, .28, .075, .39]]); wing.position.set(s * .12, .46, 0); wing.scale.x = s; r.add(wing); }
  } else {
    const legs = [-1, 1].flatMap(s => [-1, 1].map(t => ['ball', '#f7e4bd', s * .23, .15, t * .32, .12, .18, .13]));
    body = mesh(kind + '-body', [['ball', color, 0, .46, 0, .34, .31, .55], ['ball', color, 0, .81, .40, .33, .30, .29], ['ball', '#fff0ce', 0, .71, .62, .22, .14, .16], ['ball', '#273039', 0, .76, .76, .09, .067, .06], ...legs,
      ...[-1, 1].flatMap(s => [['cone', color, s * .24, 1.04, .35, .15, .30, .13], ['cone', '#e7a49e', s * .24, 1.05, .42, .07, .17, .035], ...(raccoon ? [['ball', '#34404c', s * .18, .84, .61, .17, .12, .055]] : []), ['ball', '#222b36', s * .17, .88, .65, .038, .046, .025], ['ball', '#ffffff', s * .17 - .012, .90, .668, .013, .014, .009]]),
      ...(dog ? [['box', '#f35f98', 0, .60, .42, .58, .12, .26], ['ball', color, -.30, .79, .35, .13, .27, .14], ['ball', color, .30, .79, .35, .13, .27, .14]] : [])]);
    r.add(body);
    const tail = mesh(kind + '-tail', [['ball', color, 0, squirrel ? .37 : .1, -.28, squirrel ? .24 : .13, squirrel ? .53 : .14, squirrel ? .30 : .44], ...(raccoon ? [0, 1, 2].map(i => ['ball', '#36404a', 0, .1, -.1 - i * .2, .135, .145, .07]) : [])]);
    tail.position.set(0, .49, -.4); r.add(tail);
  }
  const q = clearSpot(x, z, .3); r.position.set(q[0], W.terrainH(q[0], q[1]), q[1]); r.rotation.y = index * 1.7;
  if (kind === 'gull') r.scale.setScalar(1.35); if (squirrel) r.scale.setScalar(.75);
  group.add(r);
  if (kind === 'cat') {
    const stoop = mesh('cat-stoop', [['box', '#d4b2a0', 0, .10, 0, 1.8, .20, 1.4], ['box', '#eed4b5', 0, .28, -.23, 1.8, .18, .95]]);
    stoop.position.copy(r.position); group.add(stoop); r.position.y += .37;
  }
  if (raccoon) {
    const bin = mesh('raccoon-alley', [['box', '#334d60', -1, .55, -.65, 1.35, 1.1, 1.05], ['box', '#203745', -1, 1.17, -.65, 1.48, .14, 1.15, -.08], ['box', '#e5d2a4', -1, .65, -.10, .48, .22, .025], ['ball', '#8b91a3', -.1, .27, -.85, .36, .29, .39]]);
    bin.position.copy(r.position); group.add(bin);
  }
  const a = { kind, root: r, x: q[0], z: q[1], ox: q[0], oz: q[1], y: r.position.y, index, flee: 0, cooldown: 0, owner: null, leash: null };
  life.animals.push(a); return a;
}
function tickAnimals(dt) {
  const p = A.player;
  for (const a of life.animals) {
    const r = a.root;
    if (!visible(r, a.x, a.z, 90)) { if (a.leash) a.leash.visible = false; continue; }
    const d = Math.hypot(a.x - p.x, a.z - p.z), t = clock + a.index;
    if (a.externalMixer) a.externalMixer.update(dt);
    a.cooldown = Math.max(0, a.cooldown - dt); a.flee = Math.max(0, a.flee - dt);
    if (a.kind === 'pigeon' || a.kind === 'gull') {
      if (d < 3.8) a.flee = Math.max(a.flee, 1.5);
      const flight = a.flee > 0 ? Math.min(1, a.flee) : 0;
      const angle = t * (flight ? 1.2 : .20);
      const nx = a.ox + Math.sin(angle) * (flight ? 4 : 1.1), nz = a.oz + Math.cos(angle) * (flight ? 4 : 1.1);
      if (walkable(nx, nz, .2)) { a.x = nx; a.z = nz; }
      r.position.set(a.x, W.terrainH(a.x, a.z) + flight * (1.8 + .5 * Math.sin(t * 2)) + (flight ? 0 : Math.max(0, Math.sin(t * 5)) * .07), a.z);
      r.rotation.y = angle + Math.PI / 2;
      r.children[1].rotation.z = flight ? Math.sin(t * 23) * .95 : .12; r.children[2].rotation.z = -r.children[1].rotation.z;
      r.children[0].rotation.x = flight ? -.15 : Math.max(0, Math.sin(t * 2.1)) * .17;
    } else if (a.owner) {
      const o = a.owner, nx = o.x + Math.cos(o.heading) * 1.45, nz = o.z - Math.sin(o.heading) * 1.45;
      if (walkable(nx, nz, .3)) { a.x = nx; a.z = nz; }
      r.position.set(a.x, W.terrainH(a.x, a.z), a.z); r.rotation.y = d < 6 ? Math.atan2(p.x - a.x, p.z - a.z) : o.heading;
      r.children[1].rotation.y = Math.sin(t * (d < 6 ? 18 : 7)) * (d < 6 ? .8 : .25);
      o.root.updateMatrixWorld(true);
      if (o.leashHand) o.leashHand.getWorldPosition(wp); else wp.set(o.x + .4, o.y + 1.35, o.z);
      const ar = a.leash.geometry.attributes.position.array; ar[0] = wp.x; ar[1] = wp.y; ar[2] = wp.z; ar[3] = (wp.x + a.x) * .5; ar[4] = (wp.y + r.position.y + .7) * .5 - .16; ar[5] = (wp.z + a.z) * .5; ar[6] = a.x; ar[7] = r.position.y + .7; ar[8] = a.z; a.leash.geometry.attributes.position.needsUpdate = true; a.leash.visible = true;
      if (d < 5 && a.cooldown <= 0) { a.cooldown = 12; A.sfxText(a.x, r.position.y + 1.5, a.z, '♥', 'pink'); }
    } else {
      r.children[1].rotation.y = Math.sin(t * (d < 5 ? 7 : 2)) * .35;
      r.rotation.y += Math.sin(t * .4) * dt * .18;
      if (a.kind === 'squirrel') { const nx = a.ox + Math.sin(t * .8) * 2, nz = a.oz + Math.cos(t * .8) * 2; if (walkable(nx, nz, .25)) { a.x = nx; a.z = nz; } r.position.set(a.x, W.terrainH(a.x, a.z) + Math.max(0, Math.sin(t * 9)) * .14, a.z); }
      if (d < 4 && a.cooldown <= 0) { a.cooldown = 16; A.sfxText(a.x, r.position.y + 1.6, a.z, a.kind === 'cat' ? 'mrrp.' : a.kind === 'raccoon' ? 'TRASH CONCIERGE' : '!', ''); }
    }
  }
}
function postcardModel() {
  return mesh('postcard', [['box', '#16394c', 0, 0, 0, 1.10, .78, .07], ['box', '#fff2cc', 0, 0, .045, 1.02, .69, .03], ['box', '#ef758e', .34, .19, .065, .18, .20, .02], ['box', '#7bbfc2', -.26, .02, .065, .39, .48, .02], ['box', '#789091', .22, -.07, .065, .36, .025, .025], ['box', '#789091', .22, -.17, .065, .36, .025, .025]]);
}
function dropCard(p) {
  const missing = cards.filter(c => !c.secret && !found.has(c.id) && !life.drops.some(d => d.card === c));
  if (!missing.length) { A.say(p.tag, 'All your pee-mail has been delivered!', 2.6); return; }
  const card = missing[(p.lifeIndex + life.drops.length) % missing.length], root = postcardModel();
  const dx = A.player.x - p.x, dz = A.player.z - p.z, distance = Math.hypot(dx, dz) || 1;
  const q = clearSpot(p.x + dx / distance * 1.6, p.z + dz / distance * 1.6, .3);
  const glint = mesh('mail-glint', [['box', '#ffe77e', 0, .64, 0, .075, .44, .045], ['box', '#ffe77e', 0, .64, 0, .36, .075, .045]]); root.add(glint);
  const d = { card, root, x: q[0], z: q[1], y: W.terrainH(q[0], q[1]), age: 0 };
  root.position.set(d.x, d.y + 2, d.z); group.add(root); life.drops.push(d);
  A.say(p.tag, ['Special de-LICK-ery!', 'A letter from your litter!', 'You had me at WOOF.'][p.lifeIndex % 3], 3, 'shout');
  A.sfxText(p.x, p.y + 3.5, p.z, 'AIR MAIL!', 'pink'); sound('boing');
}
function collect(d) {
  if (found.has(d.card.id)) { d.root.visible = false; return; }
  found.add(d.card.id); save(); d.root.visible = false; updateAlbumButton();
  A.addTokens(d.card.secret ? 4096 : 1024, 'family mail'); sound('coin');
  K.UI.banner(d.card.secret ? 'THE WHOLE PACK!' : 'POSTCARD FROM ' + d.card.city, d.card.who + ' · J to read', 'photo');
  A.sfxText(d.x, d.y + 2, d.z, '♥', 'pink');
  if (found.size === cards.length) { A.addTokens(8192, 'family reunion'); K.UI.banner('SIGNED, SEALED, RETRIEVED', 'The whole family · +8,192 tokens', 'photo'); }
}
function tickCards(dt) {
  const p = A.player;
  for (let i = life.drops.length - 1; i >= 0; i--) {
    const d = life.drops[i]; d.age += dt;
    d.root.position.y = d.y + .95 + Math.abs(Math.sin(d.age * 2)) * .28 + Math.max(0, 1 - d.age) * 1.1; d.root.rotation.y = Math.atan2(K.camera.position.x - d.x, K.camera.position.z - d.z) + Math.sin(d.age * 2) * .12; d.root.rotation.z = Math.sin(d.age * 3) * .07;
    if (d.age > .8 && p.mode === 'walk' && Math.hypot(p.x - d.x, p.z - d.z) < 2.3 && Math.abs(p.y - d.y) < 2) { collect(d); group.remove(d.root); life.drops.splice(i, 1); }
  }
  if (secret && !found.has('munich')) {
    secret.root.visible = visible(secret.root, secret.x, secret.z, 65); secret.root.rotation.y = clock * .7; secret.root.position.y = secret.y + .85 + Math.sin(clock * 2) * .12;
    secret.spark.rotation.z = clock; secret.spark.scale.setScalar(.8 + Math.sin(clock * 3) * .2);
    if (p.mode === 'walk' && Math.hypot(p.x - secret.x, p.z - secret.z) < 1.9 && Math.abs(p.y - secret.y) < 2) collect(secret);
  }
}

function updateAlbumButton() { if (albumButton) albumButton.textContent = '✉ FAMILY (J)  ' + countFound() + '/8'; }
async function discoverArt() {
  // The art worker may still be generating. Discover actual files before requesting images.
  // Missing images never break collecting; each later opening retries the local directory.
  if (imageScan || performance.now() - imageScanAt < 15000) return imageScan;
  imageScanAt = performance.now();
  imageScan = Promise.resolve().then(() => {   // static list: hosted builds have no directory listings
    imageFiles = ["family_munich.png", "pc_kobe_rio.png", "pc_nagoya_sydney.png", "pc_nara_paris.png", "pc_osaka_newyork.png", "pc_parents_berlin.png", "pc_sapporo_alps.png", "pc_yokohama_reykjavik.png"];
    if (albumOpen) renderCards();
  }).catch(() => {}).finally(() => { imageScan = null; }); return imageScan;
}
function artFor(c) {
  if (!imageFiles) return '';
  const names = c.secret ? ['family_munich.png'] : [c.id, ...(c.aliases || [])].map(n => 'pc_' + n + '.png');
  const f = imageFiles.find(f => names.includes(f.toLowerCase()) || (!c.secret && [c.id, ...(c.aliases || [])].some(id => f.toLowerCase().startsWith('pc_' + id + '_')))); return f ? 'art/family/' + encodeURIComponent(f) : '';
}
function renderCards() {
  const grid = album.querySelector('.lf-grid'); grid.replaceChildren();
  album.querySelector('.lf-progress').textContent = countFound() + ' / 8 LETTERS FROM HOME';
  for (const c of cards) {
    const owned = found.has(c.id), tile = document.createElement('button'); tile.type = 'button'; tile.className = 'lf-card' + (owned ? ' lf-found' : ''); tile.style.setProperty('--paper', c.color);
    tile.setAttribute('aria-label', owned ? c.who + ', ' + c.city + '. Flip postcard.' : (c.secret ? 'Secret family photograph' : c.city + ', undiscovered')); tile.setAttribute('aria-pressed', 'false');
    const inner = document.createElement('span'); inner.className = 'lf-card-inner';
    const front = document.createElement('span'); front.className = 'lf-front';
    const picture = document.createElement('span'); picture.className = 'lf-picture';
    const crest = document.createElement('span'); crest.className = 'lf-crest'; crest.textContent = owned ? '♥' : '?'; picture.append(crest);
    const postmark = document.createElement('span'); postmark.className = 'lf-postmark'; postmark.textContent = c.stamp + '\nAIR MAIL'; picture.append(postmark);
    const path = owned && artFor(c);
    if (path) { const img = document.createElement('img'); img.alt = c.who + ' in ' + c.city; img.loading = 'lazy'; img.src = path; img.onerror = () => { img.remove(); }; picture.prepend(img); }
    const name = document.createElement('strong'); name.textContent = owned ? c.who : 'NOT YET DELIVERED';
    const city = document.createElement('small'); city.textContent = c.city;
    front.append(picture, name, city);
    const back = document.createElement('span'); back.className = 'lf-back';
    const heading = document.createElement('small'); heading.textContent = 'DEAR KYOTO,';
    const story = document.createElement('span'); story.textContent = owned ? c.story : c.secret ? 'A little piece of home is tucked beside the Mission Rock steps.' : 'Bark near a blue-uniformed mail carrier. Collect the postcard they drop.';
    const signature = document.createElement('em'); signature.textContent = owned ? 'Love, ' + c.who : 'Sniff you soon.';
    back.append(heading, story, signature); inner.append(front, back); tile.append(inner);
    tile.onclick = () => { const flip = tile.classList.toggle('lf-flipped'); tile.setAttribute('aria-pressed', String(flip)); sound('click'); }; grid.append(tile);
  }
}
function setAlbum(open) {
  if (open === albumOpen || !K.game) return;
  if (open && K.game.state !== 'play') return;
  albumOpen = open; album.hidden = !open;
  if (open) { previousFocus = document.activeElement; resumeAlbum = true; K.game.pause(true); K.UI.showPause(false); K.UI.clearPrompt('hydrant'); renderCards(); discoverArt(); album.querySelector('.lf-close').focus(); }
  else { if (resumeAlbum && K.game.state === 'paused') K.game.pause(false); resumeAlbum = false; if (previousFocus && previousFocus.isConnected) previousFocus.focus(); }
}
life.openAlbum = () => setAlbum(true);
life.closeAlbum = () => setAlbum(false);
K.on('pause', on => { if (!on && albumOpen) setAlbum(false); K.UI.clearPrompt('hydrant'); });
K.on('ui', g => { if (!albumButton) return; const playing = g.state === 'play' && !(K.agent && K.agent.open); albumButton.hidden = !playing; if (!playing) K.UI.clearPrompt('hydrant'); });
function buildUI() {
  const css = document.createElement('style'); css.textContent = `
  #lf-family-button{font:800 12px/1.2 system-ui,sans-serif;letter-spacing:.07em;position:fixed;z-index:34;left:18px;bottom:155px;cursor:pointer;min-height:44px;color:#173b4a;background:#fff3d4;border:2px solid #193d4c;box-shadow:0 3px 0 #193d4c;border-radius:13px;padding:12px 16px}
  #lf-album[hidden],#lf-family-button[hidden]{display:none!important}
  #lf-album{position:fixed;inset:0;z-index:3000;display:flex;align-items:center;justify-content:center;padding:26px;background:rgba(13,34,44,.78);backdrop-filter:blur(9px);font-family:system-ui,sans-serif;color:#193c4b;overscroll-behavior:contain}
  .lf-book{width:min(1010px,100%);max-height:92dvh;overflow:auto;background:#f8efd8;border:4px solid var(--ink);border-radius:22px;padding:25px;box-shadow:8px 10px 0 var(--ink);background-image:repeating-linear-gradient(0deg,transparent 0 27px,#d9ceb729 28px 29px)}
  .lf-head{display:flex;align-items:center;justify-content:space-between;gap:12px}.lf-eyebrow{font-size:10px;font-weight:900;letter-spacing:.20em;color:#ac554f}.lf-book h2{font-family:var(--round);font-size:37px;line-height:1.05;margin:5px 0 9px}.lf-book p{font-size:12px;margin:0 0 18px;color:#5c7278}.lf-progress{font-size:10px;font-weight:900;letter-spacing:.13em;margin-bottom:15px;color:#3e817b}.lf-close{border:2px solid #254551;border-radius:50%;width:44px;height:44px;background:#ffe3b5;color:#193c4b;font-size:22px;cursor:pointer;flex-shrink:0}
  .lf-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:17px}.lf-card{display:block;width:100%;height:220px;padding:0;border:0;background:transparent;perspective:800px;cursor:pointer;color:#254551;text-align:left;font:inherit}.lf-card-inner{display:block;position:relative;width:100%;height:100%;transition:transform .55s cubic-bezier(.2,.75,.2,1);transform-style:preserve-3d}.lf-flipped .lf-card-inner{transform:rotateY(180deg)}
  .lf-front,.lf-back{box-sizing:border-box;position:absolute;inset:0;border:1px solid #d3c9b0;border-radius:4px;background:#fffaf0;box-shadow:2px 4px 0 #203b4b25;backface-visibility:hidden;overflow:hidden}.lf-front{padding:9px;transform:rotate(-1deg)}.lf-card:nth-child(even) .lf-front{transform:rotate(1.5deg)}.lf-picture{height:145px;display:flex;position:relative;align-items:center;justify-content:center;overflow:hidden;background:var(--paper);background-image:linear-gradient(145deg,#ffffff2e 25%,transparent 25% 75%,#ffffff22 75%)}.lf-picture img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;z-index:1}.lf-picture:has(img) .lf-crest{display:none}.lf-crest{font-size:65px;color:#fff5dc99;font-family:Georgia,serif}.lf-postmark{position:absolute;right:7px;top:8px;width:43px;height:43px;display:flex;align-items:center;justify-content:center;white-space:pre-line;text-align:center;border:2px dashed #fff0cb;border-radius:50%;font-size:8px;font-weight:900;transform:rotate(13deg);color:#fff4d4;z-index:2}.lf-front strong{display:block;margin-top:9px;font-family:Georgia,serif;font-size:16px}.lf-front small{font-size:9px;letter-spacing:.13em;font-weight:900;color:#6c8589}.lf-card:not(.lf-found) .lf-picture{filter:saturate(.18);opacity:.65}.lf-card:not(.lf-found) strong{font:800 10px system-ui;margin-top:13px}.lf-back{transform:rotateY(180deg);padding:20px;display:flex;flex-direction:column;justify-content:space-between;background:repeating-linear-gradient(0deg,#fff7e5 0 24px,#dad1ba 25px)}.lf-back small{font-size:9px;letter-spacing:.14em;font-weight:900;color:#a25255}.lf-back span{font:italic 17px/1.4 Georgia,serif}.lf-back em{font:italic 12px Georgia,serif;color:#56817f}
  #lf-album button:focus-visible,#lf-family-button:focus-visible{outline:4px solid #f35d92;outline-offset:4px}
  @media(max-width:650px){#lf-album{padding:10px}.lf-book{padding:16px;max-height:94dvh}.lf-book h2{font-size:29px}.lf-grid{grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}.lf-card{height:214px}.lf-picture{height:140px}.lf-back{padding:12px}.lf-back span{font-size:16px}#lf-family-button{left:10px;bottom:190px;font-size:10px;padding:10px}}
  @media(prefers-reduced-motion:reduce){.lf-card-inner{transition:none}}
  `; document.head.append(css);
  albumButton = document.createElement('button'); albumButton.id = 'lf-family-button'; albumButton.type = 'button'; albumButton.title = 'Family postcards (J)'; albumButton.setAttribute('aria-keyshortcuts', 'J'); albumButton.hidden = true; albumButton.onclick = () => setAlbum(true); document.body.append(albumButton);
  album = document.createElement('div'); album.id = 'lf-album'; album.hidden = true; album.setAttribute('role', 'dialog'); album.setAttribute('aria-modal', 'true'); album.setAttribute('aria-labelledby', 'lf-title');
  album.innerHTML = '<div class="lf-book"><div class="lf-head"><div><div class="lf-eyebrow">THE NIHON FAMILY · AIR MAIL</div><h2 id="lf-title">Wish you were here.</h2></div><button type="button" class="lf-close" aria-label="Close family album">×</button></div><p>A big world. One very good family. Tap a postcard to turn it over.</p><div class="lf-progress"></div><div class="lf-grid"></div></div>';
  album.querySelector('.lf-close').onclick = () => setAlbum(false); album.addEventListener('click', e => { if (e.target === album) setAlbum(false); }); document.body.append(album); updateAlbumButton();
  addEventListener('keydown', e => {
    if (albumOpen) {
      if (['KeyJ', 'Escape', 'KeyP'].includes(e.code)) { e.preventDefault(); e.stopImmediatePropagation(); if (!e.repeat) setAlbum(false); return; }
      if (e.code === 'Tab') { e.preventDefault(); e.stopImmediatePropagation(); const buttons = album.querySelectorAll('button'); const i = Array.prototype.indexOf.call(buttons, document.activeElement); buttons[(i + (e.shiftKey ? -1 : 1) + buttons.length) % buttons.length].focus(); return; }
      e.stopImmediatePropagation();
    } else if (e.code === 'KeyJ' && !e.repeat && K.game && K.game.state === 'play') { e.preventDefault(); e.stopImmediatePropagation(); setAlbum(true); }
  }, true);
}

function loadLocalAnimals() {
  // Optional local CC0 assets from the art worker; procedural bodies remain the fallback.
  if (!T.GLTFLoader || !T.SkeletonUtils) return;
  fetch('assets/ext/manifest.json').then(r => r.ok ? r.json() : []).then(manifest => {
    for (const kind of ['cat', 'raccoon', 'dog']) {
      const entry = manifest.find(m => m.name === kind && m.license === 'CC0 1.0'); if (!entry) continue;
      new T.GLTFLoader().load(kind === 'dog' ? 'assets/npc/dog.json' : entry.file, gltf => {
        K.toonify(gltf.scene);
        for (const a of life.animals) if (a.kind === kind) {
          const model = T.SkeletonUtils.clone(gltf.scene), box = new T.Box3().setFromObject(model), size = new T.Vector3(); box.getSize(size);
          const scale = (kind === 'cat' ? 1.05 : 1.1) / Math.max(.01, size.y); model.scale.setScalar(scale); model.position.y = -box.min.y * scale;
          for (const child of a.root.children) child.visible = false;
          a.root.add(model); a.external = model;
          const clip = gltf.animations.find(c => (kind === 'dog' ? /Walk$/i : /Idle$/i).test(c.name));
          if (clip) { a.externalMixer = new T.AnimationMixer(model); a.externalMixer.clipAction(clip).play(); }
        }
      }, undefined, () => {});
    }
  }).catch(() => {});
}
K.on('build', scene => {
  group = new T.Group(); group.name = 'life-city'; scene.add(group); buildUI(); buildHydrants(scene);
  const S = W.HOME.start;
  const spots = [[S.x - 10, S.z - 5], [S.x - 23, S.z - 9], [210, 142], [112, -18], [40, 31], [-145, 109], [-70, 143], [32, -147], [85, -195], [-130, -192], [-230, 100], [-420, 224], [-615, 104], [-702, 296]];
  spots.forEach(([x, z], i) => person(x, z, 'skater', i));
  [[S.x - 5, S.z + 4], [110, -26], [-142, 100], [-78, 148], [38, -145]].forEach(([x, z], i) => person(x, z, 'mailman', i));
  for (const p of A.peds) if (p.arch === 'skater' && p.board3 && !life.skaters.includes(p)) { p.board3.scale.set(1.15, 1, 1.15); }
  [[S.x - 4, S.z - 10], [40, 30], [-140, 110], [80, -196]].forEach(([x, z], i) => { for (let j = 0; j < 5; j++) animal('pigeon', x + Math.sin(j * 2.4) * 2.6, z + Math.cos(j * 2.4) * 2.6, i * 5 + j); });
  [[S.x + 3, S.z - 12], [245, 145], [90, -204]].forEach(([x, z], i) => { for (let j = 0; j < 3; j++) animal('gull', x + j * 1.7, z + j, i * 3 + j); });
  [[W.HOME.x - 10, W.HOME.z - 8], [-148, 108], [-78, 148], [108, -24]].forEach(([x, z], i) => animal('cat', x, z, i));
  [[-143, 98], [-149, 112], [-77, 148], [39, -163]].forEach(([x, z], i) => animal('squirrel', x, z, i));
  animal('raccoon', W.HOME.x - 13, W.HOME.z - 4, 0); animal('raccoon', -149, 115, 1);
  for (let i = 0; i < 3; i++) {
    const x = spots[i * 3][0] - 4, z = spots[i * 3][1] - 3, owner = person(x, z, 'owner', i + 8);
    owner.arch = 'owner'; (owner.model || owner.root).traverse(b => { if (b.isBone && /wrist.?r$/i.test(b.name)) owner.leashHand = b; });
    const a = animal('dog', x + 1.4, z, i); a.owner = owner;
    const geometry = new T.BufferGeometry(); geometry.setAttribute('position', new T.BufferAttribute(new Float32Array(9), 3));
    a.leash = new T.Line(geometry, new T.LineBasicMaterial({ color: '#e95892' })); a.leash.frustumCulled = false; group.add(a.leash);
  }
  const q = clearSpot(W.HOME.x - 10, W.HOME.z - 5, .4), root = postcardModel();
  secret = { card: cards[7], root, x: q[0], z: q[1], y: W.terrainH(q[0], q[1]) }; root.position.set(secret.x, secret.y + .85, secret.z); root.visible = !found.has('munich');
  secret.spark = mesh('sparkle', [['box', '#ffe67a', 0, 0, .12, .10, .85, .06], ['box', '#ffe67a', 0, 0, .12, .65, .10, .06]]); secret.spark.position.y = .85; root.add(secret.spark); group.add(root); life.secret = secret; loadLocalAnimals();
});
K.on('start', () => {
  finishMark(false); clock = 0; keyF = false; nearest = null; life.marked = 0; K.game.hydrants = 0;
  for (const h of life.hydrants) { h.cooldown = 0; h.marked = false; if (h.flag) h.flag.visible = false; }
  for (const d of life.drops) group.remove(d.root); life.drops.length = 0;
  carrierTimer = 15; directorTick = 0; life.lastDispatch = null; for (const c of life.carriers) { c.seekT = 0; c.waitT = 0; c.greeted = false; }
  const resetPeds = new Set([...life.skaters, ...life.carriers, ...life.animals.flatMap(a => a.owner ? [a.owner] : [])]);
  for (const p of resetPeds) { p.x = p.ox; p.z = p.oz; p.y = W.terrainH(p.x, p.z); p.heading = 0; p.goalX = p.ox; p.goalZ = p.oz + 12; p.dir = 1; p.chase = 0; p.blockT = 0; p.scared = 0; p.startle = 0; p.cooldown = 0; p.noBoard = 0; p.sp = p.arch === 'skater' ? 5.5 : 1.6; p.play(p.arch === 'skater' ? 'skate' : 'walk'); p.trick = 3 + (p.lifeIndex || 0) % 5; if (p.board3) p.board3.visible = true; p.place(); }
  for (const a of life.animals) { a.x = a.ox; a.z = a.oz; a.y = W.terrainH(a.x, a.z); a.flee = 0; a.cooldown = 0; a.root.rotation.y = a.index * 1.7; a.root.position.set(a.x, a.y, a.z); }
  if (albumOpen) { albumOpen = false; resumeAlbum = false; album.hidden = true; }
  albumButton.hidden = false; K.UI.clearPrompt('hydrant'); updateAlbumButton(); if (secret) secret.root.visible = !found.has('munich');
});
K.on('step', dt => {
  clock += dt; tickHydrants(dt); carrierDirector(dt);
  for (const p of life.skaters) tickPerson(p, dt, true);
  for (const p of life.carriers) tickPerson(p, dt, false);
  for (const a of life.animals) if (a.owner) tickPerson(a.owner, dt, false);
  tickAnimals(dt); tickCards(dt);
});
K.on('frame', () => {
  if (!marking) return;
  const p = A.player, h = marking.h, t = marking.t, lift = Math.min(1, t * 4, (1.8 - t) * 5);
  if (leg && legRest) { leg.quaternion.copy(legRest); leg.rotateY(-1.0 * lift); leg.rotateZ(.8 * lift); }
  stream.visible = t > .22 && t < 1.65;
  if (!stream.visible) return;
  const sx = p.x - Math.sin(p.heading) * .55, sz = p.z - Math.cos(p.heading) * .55;
  for (let i = 0; i < 28; i++) {
    const u = (i / 28 + t * 1.5) % 1;
    dummy.position.set(sx + (h.x - sx) * u, p.y + .68 * (1 - u) + (h.y - p.y + .25) * u + Math.sin(u * Math.PI) * .75, sz + (h.z - sz) * u + Math.sin(i * 13 + t * 19) * .035);
    dummy.rotation.set(0, 0, 0); dummy.scale.setScalar(.04 + .025 * u); dummy.updateMatrix(); stream.setMatrixAt(i, dummy.matrix);
  }
  stream.instanceMatrix.needsUpdate = true;
});
K.on('bark', (p, radius) => {
  for (const m of life.carriers) if (Math.hypot(m.x - p.x, m.z - p.z) < radius && m.cooldown <= 0) { m.cooldown = 14; m.startle = 1.3; m.play('panic', .08); dropCard(m); }
  for (const a of life.animals) if (Math.hypot(a.x - p.x, a.z - p.z) < radius) a.flee = 3;
});
K.on('beforeEnd', () => finishMark(false));
K.on('end', () => { finishMark(false); K.UI.clearPrompt('hydrant'); albumButton.hidden = true; if (albumOpen) setAlbum(false); });
K.scenes = K.scenes || {};
function reviewCamera(x, y, z) {
  const look = new T.Vector3(x, y + 1.25, z); let best = -1, pos;
  for (let i = 0; i < 16; i++) {
    const angle = -2.4 + i * TAU / 16, candidate = new T.Vector3(x + Math.sin(angle) * 9, y + 4.2, z + Math.cos(angle) * 9);
    const clear = W.clipCamera(look, candidate, .35);
    if (clear > best) { best = clear; pos = candidate; }
  }
  K.sceneCam = { pos, look };
}
K.scenes.hydrant = h => {
  h.play(); const s = W.HOME.start, hydrant = life.hydrants.reduce((a, b) => Math.hypot(a.x - s.x, a.z - s.z) < Math.hypot(b.x - s.x, b.z - s.z) ? a : b);
  h.go(hydrant.x + 1.8, hydrant.z + .2); h.pz.x = h.P.x - 15; h.pz.z = h.P.z + 5; h.pz.y = W.terrainH(h.pz.x, h.pz.z); h.pz.place(); h.P.board = 0; h.st(2); nearest = hydrant; mark(); h.st(24);
  reviewCamera(hydrant.x + .8, hydrant.y, hydrant.z); h.st(1);
};
K.scenes.mailman = h => {
  h.play(); h.pz.wait = 1e6; const m = life.carriers[0];
  m.x = 38; m.z = 4; m.y = W.terrainH(m.x, m.z); m.heading = .25; m.startle = 5; m.place(); m.play('wave', 0);
  h.go(43, 9); h.P.board = 0;
  K.sceneCam = { noClip: true, pos: new T.Vector3(43, m.y + 5, 16), look: new T.Vector3(40, m.y + 1.7, 4) }; h.st(20);
};
K.scenes.skaters = h => {
  h.play(); h.pz.wait = 1e6; const p = life.skaters[0];
  p.x = 38; p.z = 4; p.y = W.terrainH(p.x, p.z); p.goalX = 44; p.goalZ = 4; p.chase = 0; p.trick = 8; p.board3.visible = true; p.place();
  h.go(43, 10); K.sceneCam = { noClip: true, pos: new T.Vector3(44, p.y + 4.7, 15), look: new T.Vector3(40, p.y + 1.2, 4) }; h.st(20);
};
K.scenes.family = h => { h.play(); for (const c of cards) found.add(c.id); setAlbum(true); };
// Production-path review: assertions run in the real WebGL build through the shared /shot runner.
K.scenes.lifecheck = h => {
  h.play(); const results = [], originalFound = Array.from(found);
  const check = (ok, message) => { if (!ok) throw new Error('life check: ' + message); results.push(message); };
  try {
    check(life.hydrantSources.decorate > 0 && life.hydrantSources.dressing > 0, 'existing hydrants: ' + life.hydrantSources.decorate + ' decorate / ' + life.hydrantSources.dressing + ' dressing');
    check(!!leg, 'Kyoto hind-leg bone found');
    const s = W.HOME.start, hydrant = life.hydrants.reduce((a, b) => Math.hypot(a.x - s.x, a.z - s.z) < Math.hypot(b.x - s.x, b.z - s.z) ? a : b);
    h.go(hydrant.x + 1.8, hydrant.z + .2); h.P.board = 0; h.st(1); nearest = hydrant;
    check(mark(), 'hydrant interaction starts ' + JSON.stringify({distance: Math.hypot(hydrant.x - h.P.x, hydrant.z - h.P.z), dy: h.P.y - hydrant.y, ground: h.P.onGround, mode: h.P.mode, ext: !!h.P.ext, board: h.P.board, cooldown: hydrant.cooldown, marking: !!marking})); h.st(60);
    check(life.marked === 1 && hydrant.marked && hydrant.cooldown > 30 && h.P.ext === null, 'reward, cooldown, paw flag and movement release');
    check(!mark(), 'cooldown prevents duplicate reward');
    const sk = life.spawnSkater(h.P.x + 10, h.P.z); check(sk && A.peds.includes(sk) && sk.board3.visible, 'spawnSkater registers a stealable board');
    sk.x = h.P.x + 1; sk.z = h.P.z; sk.chase = 0; sk.place(); h.P.board = 0; h.st(1);
    check(h.P.board > 0 && !sk.board3.visible, 'existing main.js theft awards Kyoto the board'); h.P.board = 0;
    found.clear(); for (const d of life.drops) group.remove(d.root); life.drops.length = 0;
    const carrier = life.carriers[0]; h.go(carrier.x + 4, carrier.z); carrier.cooldown = 0; h.st(65); h.go(carrier.x + 4, carrier.z); K.fn.bark();
    check(life.drops.length > 0 && carrier.cooldown > 0, 'bark startles carrier and drops family postcard');
    const drop = life.drops[0]; h.go(drop.x, drop.z); h.P.board = 0; h.st(36);
    check(found.has(drop.card.id), 'walking to postcard collects it');
    h.go(secret.x, secret.z); h.st(2); check(found.has('munich'), 'secret family photograph is reachable');
    setAlbum(true); check(albumOpen && h.g.state === 'paused' && album.querySelectorAll('.lf-card').length === 8, 'family album pauses and renders eight cards');
    const tile = album.querySelector('.lf-card'); tile.click(); check(tile.classList.contains('lf-flipped'), 'postcard flips'); setAlbum(false);
    check(h.g.state === 'play', 'closing family album resumes play');
    check(life.animals.length >= 40 && life.skaters.length >= 14 && life.carriers.length >= 5, 'city population created');
    const resetSk = life.spawnSkater(h.P.x + 10, h.P.z), resetAnimal = life.animals[0]; resetSk.x += 30; resetSk.z += 30; resetSk.goalX += 20; resetSk.chase = 9; resetAnimal.x += 20; resetAnimal.z += 20; resetAnimal.flee = 4; h.g.start(true); h.g.start(true);
    check(Math.hypot(resetSk.x - resetSk.ox, resetSk.z - resetSk.oz) < .01 && resetSk.chase === 0 && Math.hypot(resetSk.goalX - resetSk.ox, resetSk.goalZ - (resetSk.oz + 12)) < .01, 'API skater resets position and goals twice');
    check(Math.hypot(resetAnimal.x - resetAnimal.ox, resetAnimal.z - resetAnimal.oz) < .01 && resetAnimal.flee === 0, 'animal resets position and flee state twice');
    life.checkResults = results;
    const panel = document.createElement('div'); panel.id = 'life-check-results'; panel.style.cssText = 'position:fixed;inset:50px auto auto 30px;z-index:5000;padding:24px;border:3px solid #153e4b;border-radius:16px;background:#ecffe9;color:#153e4b;font:16px/1.6 monospace;max-width:85vw'; panel.textContent = 'PASS ' + results.length + ' LIFE CHECKS';
    for (const result of results) { const row = document.createElement('div'); row.textContent = '✓ ' + result; panel.append(row); } document.body.append(panel);
  } finally { found.clear(); for (const id of originalFound) found.add(id); save(); updateAlbumButton(); }
};
K.scenes.carrier_check = h => {
  h.play(); h.pz.wait = 1e6; const checks = [], check = (ok, name) => { if (!ok) throw new Error('CARRIER CHECK: ' + name); checks.push(name); };
  for (const p of life.carriers) { p.x = -700; p.z = 300; p.place(); }
  for (const [x, z] of [[40, 4], [110, -26], [-142, 100], [38, -145]]) {
    h.go(x, z); h.P.heading = Math.PI / 2; h.st(1); carrierTimer = 0; carrierDirector(.1); if (life.lastDispatch) break;
  }
  check(!!life.lastDispatch, 'director finds an unseen clear sidewalk approach');
  check(life.lastDispatch.distance >= 35 && life.lastDispatch.distance <= 60 && life.lastDispatch.outsideView, 'placement 35–60 m away outside camera');
  const p = life.carriers.reduce((a, b) => Math.hypot(a.x - h.P.x, a.z - h.P.z) < Math.hypot(b.x - h.P.x, b.z - h.P.z) ? a : b);
  const oldDistance = Math.hypot(p.x - h.P.x, p.z - h.P.z); h.st(90);
  check(Math.hypot(p.x - h.P.x, p.z - h.P.z) < oldDistance - 1, 'carrier walks toward Kyoto');
  const dispatch = life.lastDispatch; carrierTimer = 0; carrierDirector(.1); check(life.lastDispatch === dispatch, 'near carrier prevents another dispatch');
  h.go(p.x + 3, p.z); directorTick = 0; carrierDirector(.1); check(p.mailIcon.visible, 'envelope visible inside 50 m');
  p.cooldown = 0; const before = life.drops.length; K.emit('bark', h.P, 10); check(life.drops.length > before && p.cooldown > 0, 'directed carrier drops postcard on bark');
  life.directorChecks = checks; console.warn('CARRIER_CHECK ' + JSON.stringify({ checks, dispatch }));
  reviewCamera(p.x, p.y, p.z); h.st(1);
};
K.scenes.dogwalkers = h => {
  h.play(); h.pz.wait = 1e6; const a = life.animals.find(a => a.owner), p = a.owner;
  p.x = 40; p.z = 4; p.y = W.terrainH(p.x, p.z); p.goalX = 44; p.goalZ = 4; p.heading = Math.PI / 2; p.place(); a.x = 40; a.z = 5.4;
  h.go(43, 9); K.sceneCam = { noClip: true, pos: new T.Vector3(48, p.y + 5.2, 14), look: new T.Vector3(41, p.y + 1.5, 5) }; h.st(20);
};

})(window.K);
