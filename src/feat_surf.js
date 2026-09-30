/* Water gameplay — owner: surf.
 * Runtime integration: wraps A.buildPhotos (calls the original, then clones one spot
 * for Alcatraz without requesting a nonexistent web JPG) and A.photoSrc (delegates all other ids to the original). No movement/world wrappers.
 * Registers the existing Alcatraz rock as a walk surface using W.addSurface and
 * narrow W.RECTS strips. Ordinary W.move / W.inLand water collision stays intact.
 */
(function (K) {
'use strict';
const T = K.T, U = K.U, A = K.A, W = K.W, P = A.player;
const SEA = -1.6, LIMIT = { west: -925, east: 790, north: -650, south: 690 };
const S = K.surf = { active: false, paddling: false, distance: 0, jumps: 0, landings: 0 };
let pascalTag = null;
let board, plank, oar, outfit = [], poses = [], skates = [], spray, wake, timer = 0, emitT = 0, wakeT = 0;
let air = 0, airV = 0, bank = 0, pop = 0, cool = 0, shout = 0, line = 0, entryX = 0, entryZ = 0;
let splashCursor = 0, wakeCursor = 0, shoreDelay = 0, pascalWet = false, routeT = 0, routeX = 0, routeZ = 0, stuckT = 0, exitX = 0, exitZ = 0, progressX = 0, progressZ = 0, detour = false, detourX = 0, detourZ = 0, surfIntent = 0, intentX = 0, intentZ = 0;
const dummy = new T.Object3D(), foam = [], drops = [], camLook = new T.Vector3(), paddleDir = new T.Vector3(), paddleDown = new T.Vector3(0, -1, 0), paddleQ = new T.Quaternion();
const landOptions = { dynamic: true };
let queryX = 0, queryZ = 0, queryRadius = 0;
function surfPrompt(text) { if (K.UI && K.UI.prompt) K.UI.prompt(text, { source: 'surf', priority: 20 }); }
function clearSurfPrompt() { if (!K.UI) return; if (K.UI.clearPrompt) K.UI.clearPrompt('surf'); else if (K.UI.prompt) K.UI.prompt(null); }
function clearSurfIntent() { surfIntent = 0; intentX = intentZ = 0; clearSurfPrompt(); }
function rememberPascalTag() { const tag = A.pascal && A.pascal.tag; if (!tag) return null; if (!Object.prototype.hasOwnProperty.call(tag, '_surfHeadY')) tag._surfHeadY = tag.headY; pascalTag = tag; return tag; }
// Low dock slabs are boarding surfaces; their submerged sides must not trap a plank.
const waterObstacle = c => c.top > .65 && c.bot < SEA + 2.5 && W.overlaps(c, queryX, queryZ, queryRadius);
const lines = ['Kyoto, du weißt es! Ich kann nicht schwimmen!', 'Ich hasse Wasser!', 'Mein Lederhosen werden nass!', 'Das ist kein Boot, Kyoto!', 'Ich wollte nur Gassi gehen!'];
const swell = (x, z) => Math.sin(x * .095 + z * .14 - timer * 2.8) * .13 + Math.sin(z * .22 + timer * 1.8) * .055;
const wet = (x, z) => !W.inLand(x, z, 0);
const bounded = (x, z) => x > LIMIT.west && x < LIMIT.east && z > LIMIT.north && z < LIMIT.south;
function mesh(g, geo, mat, x = 0, y = 0, z = 0) { const m = new T.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = true; g.add(m); return m; }
function box(g, w, h, d, mat, x = 0, y = 0, z = 0) { return mesh(g, new T.BoxGeometry(w, h, d), mat, x, y, z); }
function bone(r, names) { for (const n of names) { const b = r.root.getObjectByName(n) || r.root.getObjectByName(n.replace(/[.:]/g, '')); if (b) return b; } return r.root; }
function attach(r, obj, names) { r.root.add(obj); r.root.updateMatrixWorld(true); bone(r, names).attach(obj); outfit.push(obj); obj.visible = false; }
/* ---- surf look: rash guard + board shorts as a coat-shader overlay (bind-space regions), sunglasses on the head bone ---- */
const SURF = { value: 0 }, fringe = [];
const OUTFIT_GLSL = `
float sfBand(float a, float b, float x, float s) { return smoothstep(a - s, a + s, x) * (1.0 - smoothstep(b - s, b + s, x)); }
float sfPaw(vec2 q) { vec2 c = fract(q) - 0.5; vec2 id = floor(q); c += 0.12 * vec2(sin(id.y * 3.1), cos(id.x * 2.3));
  float pad = 1.0 - smoothstep(0.13, 0.16, length(c * vec2(1.0, 1.25) + vec2(0.0, 0.08)));
  float toes = 0.0; for (int i = 0; i < 4; i++) { float a = -1.05 + float(i) * 0.7; toes = max(toes, 1.0 - smoothstep(0.05, 0.075, length(c - vec2(sin(a), cos(a)) * 0.2 - vec2(0.0, 0.02)))); }
  return max(pad, toes); }
float sfFlower(vec2 q) { vec2 c = fract(q) - 0.5; float r = length(c), a = atan(c.y, c.x);
  float petal = 1.0 - smoothstep(0.0, 0.03, r - (0.16 + 0.07 * cos(5.0 * a))); float core = 1.0 - smoothstep(0.04, 0.06, r); return max(petal * 0.9, core * 2.0); }
vec3 surfOutfit(vec3 base, vec3 p) {
  float ax = abs(p.x);
  float neck = step(0.82, p.z) * smoothstep(1.46, 1.54, p.y);                       // bandana + neck ruff stay fur
  float tail = step(p.z, -0.62) * smoothstep(1.52, 1.62, p.y);                       // tail plume stays fur
  float torso = sfBand(-0.42, 1.12, p.z, 0.04) * smoothstep(0.9, 1.0, p.y);
  float sleeve = sfBand(0.5, 1.1, p.z, 0.04) * sfBand(0.66, 1.0, p.y, 0.03) * step(0.1, ax);
  float shirt = max(torso, sleeve) * (1.0 - neck);
  float shorts = sfBand(-1.3, -0.4, p.z, 0.04) * smoothstep(0.64, 0.74, p.y) * (1.0 - tail);
  vec2 side = vec2(p.z, p.y);
  vec3 teal = vec3(0.07, 0.66, 0.64), tealD = vec3(0.03, 0.45, 0.47), cream = vec3(1.0, 0.95, 0.8);
  vec3 sc = mix(teal, tealD, step(0.5, fract(p.y * 2.2 + 0.25)) * 0.35);                 // soft horizontal stripes
  sc = mix(sc, cream, sfPaw(side * 3.4) * 0.95);
  sc = mix(sc, vec3(1.0, 0.42, 0.45), sfBand(0.93, 1.02, p.y, 0.01) * sfBand(-0.42, 1.12, p.z, 0.0));   // coral hem line
  vec3 coral = vec3(1.0, 0.4, 0.36), gold = vec3(1.0, 0.8, 0.26);
  float fl = sfFlower(vec2(p.z * 3.0 + p.x * 1.7, p.y * 3.0));
  vec3 bc = mix(coral, cream, clamp(fl, 0.0, 1.0) * 0.85); bc = mix(bc, gold, clamp(fl - 1.0, 0.0, 1.0));
  bc = mix(bc, gold, sfBand(-0.46, -0.38, p.z, 0.01));                                  // waistband
  vec3 c = mix(base, sc, shirt); c = mix(c, bc, shorts * (1.0 - shirt));
  return c; }`;
function patchCoat(m) {
  if (m.userData.surfPatched) return; m.userData.surfPatched = true;
  const prev = m.onBeforeCompile, prevKey = m.customProgramCacheKey ? m.customProgramCacheKey.bind(m) : null;
  m.onBeforeCompile = function (sh, r) { if (prev) prev.call(this, sh, r); sh.uniforms.uSurf = SURF;
    sh.vertexShader = 'varying vec3 vSurfP;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n  vSurfP = position;');
    sh.fragmentShader = 'uniform float uSurf; varying vec3 vSurfP;\n' + OUTFIT_GLSL + sh.fragmentShader.replace('#include <map_fragment>', '#include <map_fragment>\n  if (uSurf > 0.5) diffuseColor.rgb = surfOutfit(diffuseColor.rgb, vSurfP);'); };
  m.customProgramCacheKey = () => (prevKey ? prevKey() : '') + '|surf'; m.needsUpdate = true;
}
const surfLook = { get visible() { return SURF.value > .5; }, set visible(v) { SURF.value = v ? 1 : 0; fringe.forEach(f => { f.visible = !v; }); } };
function lensTex() {
  const c = document.createElement('canvas'); c.width = 64; c.height = 64; const g = c.getContext('2d');
  const gr = g.createLinearGradient(0, 0, 0, 64); gr.addColorStop(0, '#2a2f6b'); gr.addColorStop(.55, '#7a3fa8'); gr.addColorStop(1, '#ff7a6a'); g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
  g.fillStyle = 'rgba(255,255,255,.75)'; g.beginPath(); g.ellipse(22, 20, 12, 5, -.5, 0, 7); g.fill(); g.beginPath(); g.ellipse(44, 44, 4, 2, -.5, 0, 7); g.fill();
  const t = new T.CanvasTexture(c); t.encoding = T.sRGBEncoding; return t;
}
function makeShades() {
  // built in the mesh's bind space around the eyes, then re-expressed in the head bone's space via its inverse bind matrix
  let sm = null; A.kyoto.root.traverse(o => { if (!sm && o.isSkinnedMesh && !/_fringe/.test(o.name)) sm = o; }); if (!sm) return null;
  const head = sm.skeleton.bones.find(b => /^head$/i.test(b.name)); if (!head) return null;
  const inv = sm.skeleton.boneInverses[sm.skeleton.bones.indexOf(head)];
  const g = new T.Group(); g.name = 'surf_sunglasses';
  const ink = K.toon('#1b1830'), lens = new T.MeshBasicMaterial({ map: lensTex() });
  const rr = (w, h, r) => { const sh = new T.Shape(), x = -w / 2, y = -h / 2; sh.moveTo(x + r, y); sh.lineTo(x + w - r, y); sh.quadraticCurveTo(x + w, y, x + w, y + r); sh.lineTo(x + w, y + h - r); sh.quadraticCurveTo(x + w, y + h, x + w - r, y + h); sh.lineTo(x + r, y + h); sh.quadraticCurveTo(x, y + h, x, y + h - r); sh.lineTo(x, y + r); sh.quadraticCurveTo(x, y, x + r, y); return sh; };
  for (const s of [1, -1]) {
    const eye = new T.Vector3(s * .168, 2.238, 1.6), fwd = new T.Vector3(s * .34, .04, .94).normalize();
    const L = new T.Group(); L.position.copy(eye).addScaledVector(fwd, .055); L.lookAt(L.position.clone().add(fwd)); g.add(L);
    const frame = new T.Mesh(new T.ExtrudeGeometry(rr(.2, .13, .045), { depth: .022, bevelEnabled: false, curveSegments: 6 }), ink); frame.position.z = -.011; L.add(frame);
    const glass = new T.Mesh(new T.ShapeGeometry(rr(.17, .102, .036), 6), lens); glass.position.z = .0125; L.add(glass);
    const arm = new T.Mesh(new T.BoxGeometry(.018, .022, .36), ink); arm.position.set(s * .098, .025, -.17); arm.rotation.y = -s * .32; L.add(arm);
  }
  const bridge = new T.Mesh(new T.TorusGeometry(.05, .013, 6, 10, Math.PI), ink); bridge.position.set(0, 2.262, 1.655); bridge.rotation.x = -.35; g.add(bridge);
  g.applyMatrix4(inv); head.add(g); K.inkShell && K.inkShell(g, .006); return g;
}
function makeGear() {
  rememberPascalTag();
  const coral = K.toon('#ff6277'), cream = K.toon('#fff5ca'), teal = K.toon('#13bac8'), ink = K.toon('#222747'), gold = K.toon('#ffcb43');
  board = new T.Group(); board.name = 'surf_longboard';
  const shape = new T.Shape(); shape.moveTo(0, 2.25); shape.bezierCurveTo(.9, 2.08, 1.05, .35, .74, -1.75); shape.quadraticCurveTo(0, -2.12, -.74, -1.75); shape.bezierCurveTo(-1.05, .35, -.9, 2.08, 0, 2.25);
  const deckGeo = new T.ExtrudeGeometry(shape, { depth: .14, bevelEnabled: true, bevelSize: .07, bevelThickness: .055, bevelSegments: 2, steps: 1, curveSegments: 14 }); deckGeo.rotateX(Math.PI / 2);
  mesh(board, deckGeo, teal, 0, .12); box(board, .22, .026, 3.9, gold, 0, .16, .02);
  for (const x of [-.52, .52]) box(board, .09, .027, 2.5, cream, x, .17, -.2);
  const pad = mesh(board, new T.SphereGeometry(1, 16, 8), ink, 0, .14, -.92); pad.scale.set(.56, .038, .69);
  const pawParts = [[0, 0, .20, .17], [-.23, .21, .09, .12], [-.08, .31, .09, .12], [.10, .31, .09, .12], [.25, .20, .09, .12]].map(([x, z, sx, sz]) => { const g = new T.CylinderGeometry(1, 1, .025, 12); g.scale(sx, 1, sz); g.translate(x, .18, 1.25 + z); return g; });
  const paw = T.BufferGeometryUtils.mergeBufferGeometries(pawParts); pawParts.forEach(g => g.dispose()); mesh(board, paw, gold);
  const fin = box(board, .07, .43, .48, teal, 0, -.24, -1.28); fin.rotation.x = -.25;
  K.inkShell(board, .018); A.kyoto.root.add(board); board.visible = false;
  // surf outfit painted onto the coat itself (rash guard + board shorts follow the fur and the rig; the bandana stays visible) + real sunglasses
  A.kyoto.root.traverse(o => { if (!o.isMesh) return; const ms = Array.isArray(o.material) ? o.material : [o.material];
    if (/_fringe/.test(o.name)) { fringe.push(o); return; } ms.forEach(m => { if (m && /coat/.test(m.name)) patchCoat(m); }); });
  outfit.push(surfLook);
  const glasses = makeShades(); if (glasses) { outfit.push(glasses); glasses.visible = false; }
  plank = new T.Group(); plank.name = 'pascal_plank'; const wood = K.toon('#b97842'), light = K.toon('#e6ad64');
  for (let i = -1; i <= 1; i++) { box(plank, .49, .19, 3.3 - Math.abs(i) * .15, i === 0 ? light : wood, i * .52); for (const z of [-1.05, 1.05]) mesh(plank, new T.CylinderGeometry(.045, .045, .025, 6), ink, i * .52, .11, z); }
  for (const z of [-1.1, 1.1]) box(plank, 1.66, .09, .17, cream, 0, .115, z);
  K.inkShell(plank, .022); K.scene.add(plank); plank.visible = false;
  oar = new T.Group(); oar.name = 'pascal_oar'; mesh(oar, new T.CylinderGeometry(.055, .07, 2, 8), light, 0, -.52); const blade = mesh(oar, new T.SphereGeometry(1, 10, 8), wood, 0, -1.6); blade.scale.set(.22, .48, .07);
  bone(A.pascal, ['hand.R', 'handR']).add(oar); oar.visible = false;
  for (const name of ['hips', 'thigh.L', 'thigh.R', 'shin.L', 'shin.R', 'upperarm.R', 'forearm.R', 'upperarm.L', 'forearm.L']) { const b = bone(A.pascal, [name]); if (b !== A.pascal.root) poses.push({ b, name, p: b.position.clone(), q: b.quaternion.clone() }); }
  A.pascal.root.traverse(o => { if (/skate/i.test(o.name) && o.isMesh) skates.push({ o, visible: o.visible }); });
}
function makeFX() {
  const mat = new T.MeshBasicMaterial({ color: '#e8ffff', transparent: true, opacity: .85, depthWrite: false });
  spray = new T.InstancedMesh(new T.IcosahedronGeometry(1, 0), mat, 90); spray.frustumCulled = false; spray.name = 'surf_spray';
  wake = new T.InstancedMesh(new T.RingGeometry(.7, 1, 16, 1, 0, Math.PI), mat, 56); wake.frustumCulled = false; wake.name = 'surf_wake';
  const white = new T.Color('#ffffff'); for (let i = 0; i < 90; i++) spray.setColorAt(i, white); for (let i = 0; i < 56; i++) wake.setColorAt(i, white);
  K.scene.add(spray, wake); for (let i = 0; i < 90; i++) drops.push({ life: 0, max: 1, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, size: 0 });
  for (let i = 0; i < 56; i++) foam.push({ life: 0, max: 1, x: 0, y: 0, z: 0, angle: 0, size: 0 });
  drawFX(0);
}
function burst(x, y, z, n, force = 1) { for (let i = 0; i < n; i++) { const p = drops[splashCursor++ % drops.length], a = Math.random() * Math.PI * 2; p.life = p.max = .5 + Math.random() * .5; p.x = x; p.y = y; p.z = z; p.vx = Math.cos(a) * (1 + Math.random() * 3) * force; p.vz = Math.sin(a) * (1 + Math.random() * 3) * force; p.vy = (2 + Math.random() * 3) * force; p.size = .07 + Math.random() * .12; } }
function trail(x, z, heading, size) { const f = foam[wakeCursor++ % foam.length]; f.life = f.max = 1.65; f.x = x; f.z = z; f.y = SEA + .10; f.angle = heading; f.size = size; }
function drawFX(dt) {
  for (let i = 0; i < drops.length; i++) { const p = drops[i]; p.life = Math.max(0, p.life - dt); if (p.life) { p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt; p.vy -= dt * 9; } dummy.position.set(p.x, p.y, p.z); dummy.rotation.set(0, 0, 0); dummy.scale.setScalar(p.life ? p.size * Math.min(1, p.life * 4) : 0); dummy.updateMatrix(); spray.setMatrixAt(i, dummy.matrix); }
  for (let i = 0; i < foam.length; i++) { const f = foam[i]; f.life = Math.max(0, f.life - dt); const age = 1 - f.life / f.max, sz = f.size * (1 + age * 2); dummy.position.set(f.x, f.y, f.z); dummy.rotation.set(-Math.PI / 2, 0, -f.angle); dummy.scale.set(f.life ? sz : 0, f.life ? sz * .42 : 0, f.life / f.max); dummy.updateMatrix(); wake.setMatrixAt(i, dummy.matrix); }
  spray.instanceMatrix.needsUpdate = wake.instanceMatrix.needsUpdate = true;
}
function solidWater(x, z, radius) { queryX = x; queryZ = z; queryRadius = radius; return W.forNear(x, z, radius, waterObstacle); }
function landing(x, z, radius) { if (!W.inLand(x, z, radius)) return null; const y = W.groundAt(x, z, W.walkH(x, z) + .6, radius); return W.blockedAt(x, z, radius, y, landOptions) ? null : y; }
function launch(x, z) {
  if (S.active || P.ext || P.mode !== 'walk') return;
  entryX = P.x; entryZ = P.z; S.active = true; P.ext = surfStep; P.surfing = true; P.board = 0; P.safe = null; P.x = x; P.z = z;
  const speed = Math.max(10, Math.hypot(P.vx || 0, P.vz || 0)); P.vx = Math.sin(P.heading) * speed; P.vz = Math.cos(P.heading) * speed;
  air = Math.max(0, P.y - (SEA + .3)); airV = 0; pop = .4; cool = .45; bank = 0;
  board.visible = true; outfit.forEach(o => o.visible = true); A.kyoto.board.visible = false;
  burst(P.x, SEA + .3, P.z, 22); K.sfx.yip(); K.fn.juice(.1, .1); A.sfxText(P.x, P.y + 2.3, P.z, 'SURF’S UP!', 'pink');
  if (!K.game.told.surf) { K.game.told.surf = 1; K.UI.banner('GOOD WAVES. GOOD BOY.', 'WASD carve · Shift boost · Space hop · B bark'); }
  if (!A.pascal.ext || A.pascal.ext === paddleStep) { A.pascal.ext = paddleStep; if (!S.paddling) { shout = 1; routeT = 0; stuckT = 0; detour = false; progressX = A.pascal.x; progressZ = A.pascal.z; pascalWet = false; exitX = x; exitZ = z; } }
}
function landPlayer(x, z, y) {
  S.active = false; P.surfing = false; if (P.ext === surfStep) P.ext = null; P.x = x; P.z = z; P.y = y; P.vy = 0; P.vx *= .45; P.vz *= .45; P.onGround = true; P.safe = null;
  board.visible = false; outfit.forEach(o => o.visible = false); A.kyoto.root.rotation.set(0, P.heading, 0); A.kyoto.root.position.set(x, y, z); A.kyoto.root.scale.setScalar(1);
  burst(x, y + .5, z, 20, .7); K.sfx.yip(); A.sfxText(x, y + 2.3, z, 'POOF!', 'pink'); shoreDelay = .3; air = airV = bank = 0;
}
function surfStep(dt) {
  if (P.mode !== 'walk') { landPlayer(P.x, P.z, P.y); return; }
  const input = K.inp, yaw = K.game.camYaw, ix = -Math.cos(yaw) * input.mx + Math.sin(yaw) * input.mz, iz = Math.sin(yaw) * input.mx + Math.cos(yaw) * input.mz;
  const mag = P.stun > 0 ? 0 : Math.min(1, Math.hypot(ix, iz)), oldH = P.heading;
  if (mag > .1) P.heading = U.lerpAng(P.heading, Math.atan2(ix, iz), 1 - Math.exp(-dt * (air > .15 ? 2.2 : 3.8)));
  const turn = U.angDiff(P.heading, oldH) / Math.max(dt, .001); bank = U.damp(bank, U.clamp(-turn * .10, -.30, .30), 8, dt);
  const turbo = K.game.buffs.turbo > 0 ? 1.22 : 1, speed = (input.sprint ? 30 : 23) * turbo * mag;
  P.vx = U.damp(P.vx, Math.sin(P.heading) * speed, mag > .1 ? 2.3 : 2.8, dt); P.vz = U.damp(P.vz, Math.cos(P.heading) * speed, mag > .1 ? 2.3 : 2.8, dt);
  if (Math.hypot(P.vx, P.vz) < .08) P.vx = P.vz = 0;
  const nx = P.x + P.vx * dt, nz = P.z + P.vz * dt, ground = landing(nx, nz, .78);
  if (ground != null && cool <= 0) { landPlayer(nx, nz, ground); return; }
  if (bounded(nx, nz) && !solidWater(nx, nz, .55)) { P.x = nx; P.z = nz; } else { P.vx *= -.25; P.vz *= -.25; }
  P.speed = Math.hypot(P.vx, P.vz); S.distance += P.speed * dt; P.stamina = Math.min(1, P.stamina + dt * .15); cool = Math.max(0, cool - dt);
  if (input.jump && air < .12 && cool <= 0) { airV = 7.5 + P.speed * .07; air = .13; S.jumps++; cool = .4; burst(P.x, SEA + .3, P.z, 14); K.sfx.boing(); K.fn.juice(.1, .08); }
  const wasAir = air; if (air > 0 || airV > 0) { airV -= 21 * dt; air = Math.max(0, air + airV * dt); if (!air) { airV = 0; if (wasAir > .01) { S.landings++; burst(P.x, SEA + .2, P.z, 24, 1.25); K.fn.juice(.12, .12); if (P.speed > 14) A.sfxText(P.x, SEA + 2.8, P.z, 'SPLASH!', 'big'); } } }
  P.y = SEA + .32 + swell(P.x, P.z) + air; P.onGround = air < .12; P.vy = airV;
  const r = A.kyoto; P.barkT = Math.max(0, (P.barkT || 0) - dt); if (!P.barkT) r.play('idle', .12); r.mixer.update(dt);
  r.root.position.set(P.x, P.y, P.z); r.root.rotation.set(U.clamp(-airV * .017, -.17, .20) + Math.cos(timer * 2.8 + P.z * .14) * .025, P.heading, K.reduceMotion ? bank * .3 : bank); r.root.scale.setScalar(1); r.board.visible = false;
  pop = Math.max(0, pop - dt); board.scale.setScalar(1 + Math.sin(pop / .4 * Math.PI) * .13);
  emitT -= dt; wakeT -= dt;
  if (P.speed > 2 && air < .2) { if (emitT <= 0) { emitT = .07; burst(P.x - Math.sin(P.heading) * 1.5, SEA + .25, P.z - Math.cos(P.heading) * 1.5, 2 + (Math.abs(bank) > .15 ? 2 : 0), .5); } if (wakeT <= 0) { wakeT = .09; trail(P.x - Math.sin(P.heading) * 1.5, P.z - Math.cos(P.heading) * 1.5, P.heading, .8); } }
}
function posePaddler(dt) {
  const p = A.pascal, tag = rememberPascalTag(); if (tag) tag.headY = 2.8; p.play('idle', .15); p.mixer.update(dt);
  for (const q of poses) { q.b.position.copy(q.p); q.b.quaternion.copy(q.q); const n = q.name; if (n === 'hips') q.b.position.y -= .98; if (n.startsWith('thigh')) q.b.rotateX(-.25); if (n.startsWith('shin')) q.b.rotateX(1.8); if (n === 'upperarm.R') q.b.rotateX(-.65 + Math.sin(timer * 4) * .35); if (n === 'forearm.R') q.b.rotateX(-.85); if (n === 'upperarm.L') q.b.rotateX(-.8); if (n === 'forearm.L') q.b.rotateX(-1.1); }
  // Keep the blade aimed into the water while its grip stays attached to the hand.
  p.root.updateMatrixWorld(true);
  paddleDir.set(Math.cos(p.heading) * .6 + Math.sin(p.heading) * Math.sin(timer * 4) * .65, -1.25, -Math.sin(p.heading) * .6 + Math.cos(p.heading) * Math.sin(timer * 4) * .65).normalize();
  oar.parent.getWorldQuaternion(paddleQ).invert(); oar.quaternion.setFromUnitVectors(paddleDown, paddleDir).premultiply(paddleQ);
}
function restorePascal() {
  const p = A.pascal; if (!S.paddling && p.ext !== paddleStep) return; const owned = p.ext === paddleStep; const tag = rememberPascalTag(); if (tag) tag.headY = tag._surfHeadY; if (owned) p.ext = null; S.paddling = false; pascalWet = false; plank.visible = oar.visible = false;
  for (const q of poses) { q.b.position.copy(q.p); q.b.quaternion.copy(q.q); } skates.forEach(s => s.o.visible = s.visible); p.root.rotation.set(0, p.heading, 0); if (owned) { p.wait = Math.max(p.wait > 100 ? 0 : p.wait, 1.2); p.safe = null; p.play('idle', .1); }
}
function landLine(x0, z0, x1, z1, y0) {
  // Match Pascal's entire footprint when stepping down off a sea-lion platform.
  // Keep ground and collision probes at the same radius.
  const steps = Math.max(1, Math.ceil(Math.hypot(x1 - x0, z1 - z0) / .4));
  let y = y0 == null ? A.pascal.y : y0;
  for (let i = 0; i <= steps; i++) { const t = i / steps, x = x0 + (x1 - x0) * t, z = z0 + (z1 - z0) * t; y = W.groundAt(x, z, y, .9); if (W.blockedAt(x, z, .9, y)) return false; }
  return true;
}
function alternateShore(p) {
  // Nav cells at the tip of Pier 39 can be sealed by sea-lion platforms. Find
  // a reachable edge instead of pushing forever against the same platform.
  for (let radius = 3; radius <= 39; radius += 3) for (let i = 0; i < 32; i++) {
    const a = i * Math.PI / 16, x = p.x + Math.sin(a) * radius, z = p.z + Math.cos(a) * radius;
    if (landing(x, z, 1) == null) continue;
    for (let j = 0; j < 8; j++) {
      const b = j * Math.PI / 4, wx = x + Math.sin(b) * 2.4, wz = z + Math.cos(b) * 2.4;
      if (!wet(wx, wz) || solidWater(wx, wz, .65)) continue;
      let clear = landLine(p.x, p.z, x, z, p.y); detour = false;
      // A short retreat frees Pascal from the pocket between two sea lions.
      for (let r = 4; !clear && r <= 12; r += 4) for (let k = 0; !clear && k < 16; k++) {
        const a2 = k * Math.PI / 8, qx = p.x + Math.sin(a2) * r, qz = p.z + Math.cos(a2) * r, qy = landing(qx, qz, .95);
        if (qy != null && landLine(p.x, p.z, qx, qz, p.y) && landLine(qx, qz, x, z, qy)) { clear = true; detour = true; detourX = qx; detourZ = qz; }
      }
      if (clear) { entryX = x; entryZ = z; exitX = wx; exitZ = wz; routeT = 0; return true; }
    }
  }
  return false;
}
function paddleStep(dt) {
  const p = A.pascal; if (detour && Math.hypot(p.x - detourX, p.z - detourZ) < 1) detour = false;
  const tx = !S.paddling ? (detour ? detourX : entryX) : P.x, tz = !S.paddling ? (detour ? detourZ : entryZ) : P.z;
  let dx = tx - p.x, dz = tz - p.z, distance = Math.hypot(dx, dz), d = distance || 1;
  if (!S.paddling) {
    if (!S.active && landLine(p.x, p.z, P.x, P.z)) { restorePascal(); return; }
    if (!detour && (distance < 3 || wet(p.x + dx / d * 1.5, p.z + dz / d * 1.5))) { S.paddling = true; plank.visible = oar.visible = true; skates.forEach(s => s.o.visible = false); shout = 0; }
    else { if (!landLine(p.x, p.z, tx, tz)) {
      routeT -= dt; if (routeT <= 0) { routeT = .3; W.computeFlow(tx, tz, p.x, p.z); const target = W.flowTarget(p.x, p.z); routeX = target ? target[0] : tx; routeZ = target ? target[1] : tz; }
      dx = routeX - p.x; dz = routeZ - p.z; d = Math.hypot(dx, dz) || 1;
    } p.heading = U.lerpAng(p.heading, Math.atan2(dx, dz), 1 - Math.exp(-dt * 5)); W.move(p, dx / d * 15 * dt, dz / d * 15 * dt, .9, p.y, { grounded: true }); p.y = W.groundAt(p.x, p.z, p.y, .9); p.place(); p.play('skate'); p.mixer.update(dt); stuckT += dt; if (stuckT > .8) { if (Math.hypot(p.x - progressX, p.z - progressZ) < 2) alternateShore(p); progressX = p.x; progressZ = p.z; stuckT = 0; } return; }
  }
  pascalWet = pascalWet || wet(p.x, p.z); dx = (pascalWet ? P.x : exitX) - p.x; dz = (pascalWet ? P.z : exitZ) - p.z; distance = Math.hypot(dx, dz); d = distance || 1;
  const speed = distance > (pascalWet ? (S.active ? 5 : .4) : .03) ? 11.5 * (.88 + Math.sin(timer * 4) * .12) : 0;
  p.heading = U.lerpAng(p.heading, Math.atan2(dx, dz), 1 - Math.exp(-dt * 2));
  let nx = p.x + dx / d * speed * dt, nz = p.z + dz / d * speed * dt;
  const ground = landing(nx, nz, .9);
  if (ground != null && !S.active && (pascalWet || Math.hypot(P.x - p.x, P.z - p.z) < 4)) { p.x = nx; p.z = nz; p.y = ground; p.place(); burst(p.x, p.y + .4, p.z, 12); restorePascal(); return; }
  if (ground != null) { W.move(p, dx / d * speed * dt, dz / d * speed * dt, .9, ground, { grounded: true }); p.y = ground; }
  else if (bounded(nx, nz) && !solidWater(nx, nz, .65)) { p.x = nx; p.z = nz; pascalWet = pascalWet || wet(nx, nz); p.y = SEA + .32 + swell(nx, nz) * .65; }
  else { // Slide around a pier corner without crossing its solid supports.
    nx = p.x + Math.cos(p.heading) * speed * dt; nz = p.z - Math.sin(p.heading) * speed * dt;
    if (wet(nx, nz) && !solidWater(nx, nz, .65)) { p.x = nx; p.z = nz; }
  }
  p.place(); posePaddler(dt); p.root.rotation.z = Math.sin(timer * 3) * .045; plank.position.set(p.x, p.y, p.z); plank.rotation.set(Math.sin(timer * 2) * .025, p.heading, Math.sin(timer * 3) * .045);
  shout -= dt; if (shout <= 0) { A.say(p.tag, lines[line++ % lines.length], 3.4, 'shout'); shout = 6; }
  if (speed && Math.floor(timer * 10) !== Math.floor((timer - dt) * 10)) trail(p.x - Math.sin(p.heading), p.z - Math.cos(p.heading), p.heading, .5);
}
function addIsland() {
  // Use the exact drawn rock mesh, so feet follow its low-poly surface.
  let rock; K.scene.traverse(o => { if (o.isMesh && o.geometry.type === 'SphereGeometry' && o.geometry.parameters.radius === 26 && Math.abs(o.position.x - 40) < .01 && Math.abs(o.position.z + 398) < .01) rock = o; });
  if (rock) { rock.updateMatrixWorld(true); const geo = rock.geometry.clone().applyMatrix4(rock.matrixWorld); W.addSurface(geo); geo.dispose(); }
  // Conservative strips remain inside the rock's dry cap; they never bridge the bay.
  for (let z = -414; z < -382; z += 2) { const dz = Math.max(Math.abs(z + 398), Math.abs(z + 400)), half = 30 * Math.sqrt(Math.max(0, 1 - (dz / 18) ** 2)); if (half > 4) W.RECTS.push({ x0: 40 - half, x1: 40 + half, z0: z, z1: z + 2, name: 'surf_alcatraz' }); }
  const x = 43, z = -383, y = W.walkH(x, z);
  const buildOriginal = A.buildPhotos;
  A.buildPhotos = function () {
    const result = buildOriginal.apply(this, arguments);
    if (A.photos.some(p => p.id === 'alcatraz') || !A.photos.length) return result;
    const source = A.photos[0], g = source.g.clone(true);
    g.position.set(x, y, z); A.photoRoot.add(g);
    const spot = { id: 'alcatraz', label: 'ALCATRAZ', x, y, z, g, got: false, hold: 0, popT: 0, ph: .4 };
    for (const key of ['icon', 'check', 'ring', 'prog', 'glow']) spot[key] = g.children[source.g.children.indexOf(source[key])];
    spot.fl = spot.icon.getObjectByName('flash'); spot.fl.material = source.fl.material.clone();
    spot.ring.material = source.ring.material.clone(); spot.glow.material = source.glow.material.clone();
    for (const [key, inner, outer] of [['ring', 2.2, 2.62], ['prog', 1.74, 2.1]]) {
      const geo = new T.RingGeometry(inner, outer, 48).rotateX(-Math.PI / 2), pos = geo.attributes.position;
      for (let i = 0; i < pos.count; i++) pos.setY(i, W.walkH(x + pos.getX(i), z + pos.getZ(i)) - y + .1);
      spot[key].geometry = geo; if (key === 'prog') geo.setDrawRange(0, 0);
    }
    A.photos.push(spot); A.PHOTOS.push(['alcatraz', 'ALCATRAZ', x, z, y]); return result;
  };
  const original = A.photoSrc; A.photoSrc = function (id) { return id === 'alcatraz' ? 'photos/p_alcatraz.png' : original.apply(this, arguments); };
}
function reset() {
  if (!board) return; if (P.ext === surfStep) P.ext = null; S.active = false; P.surfing = false; clearSurfIntent(); board.visible = false; outfit.forEach(o => o.visible = false); restorePascal();
  air = airV = bank = pop = cool = shoreDelay = 0; timer = 0; S.distance = S.jumps = S.landings = 0; drops.forEach(p => p.life = 0); foam.forEach(p => p.life = 0); drawFX(0); A.kyoto.root.rotation.x = A.kyoto.root.rotation.z = 0;
}
K.on('build', () => { makeGear(); makeFX(); addIsland(); });
K.on('start', reset); K.on('beforeEnd', reset); K.on('end', reset);
K.on('step', dt => {
  timer += dt; shoreDelay = Math.max(0, shoreDelay - dt); drawFX(dt);
  if (!S.active && !P.ext && P.mode === 'walk' && shoreDelay <= 0 && P.stun <= 0 && Math.hypot(K.inp.mx, K.inp.mz) > .15) {
    const yaw = K.game.camYaw, dx = -Math.cos(yaw) * K.inp.mx + Math.sin(yaw) * K.inp.mz, dz = Math.sin(yaw) * K.inp.mx + Math.cos(yaw) * K.inp.mz, d = Math.hypot(dx, dz) || 1;
    const nx = P.x + dx / d * 1.35, nz = P.z + dz / d * 1.35;
    if (bounded(nx, nz) && wet(nx, nz) && !solidWater(nx, nz, .5)) {
      const dot = surfIntent > 0 ? dx / d * intentX + dz / d * intentZ : 1;
      if (dot < .72) surfIntent = 0;
      intentX = dx / d; intentZ = dz / d; surfIntent += dt;
      surfPrompt('HOLD TO SURF');
      if (surfIntent >= .4) { P.heading = Math.atan2(dx, dz); surfIntent = 0; clearSurfPrompt(); launch(nx, nz); }
    } else { clearSurfIntent(); }
  } else if (!S.active) { clearSurfIntent(); }
  if (!S.active && (P.ext || P.mode !== 'walk')) clearSurfIntent();
});
K.on('pause', on => { if (on && !S.active) clearSurfIntent(); });
K.on('frame', () => { if (S.active && !K.sceneCam && K.camera.position.y < SEA + 1.15) { K.camera.position.y = SEA + 1.15; camLook.set(P.x + Math.sin(P.heading) * 3, P.y + 1.7, P.z + Math.cos(P.heading) * 3); K.camera.lookAt(camLook); } });
K.on('bark', () => { if (S.active) { burst(P.x, SEA + .25, P.z, 14, .75); if (S.paddling) { A.say(A.pascal.tag, 'Nicht bellen! PADDELN!', 2.8, 'shout'); shout = 4; } } });
K.scenes = K.scenes || {};
K.scenes.surf = h => {
  h.play(); h.g.told.surf = 1; Object.assign(P, { x: 52, z: -366, y: SEA + .32, heading: Math.PI * .73, vx: 15, vz: -13, mode: 'walk' }); launch(P.x, P.z); air = 0; airV = 0;
  Object.assign(A.pascal, { x: K.VW < K.VH ? 51 : 48, z: K.VW < K.VH ? -367 : -365, y: SEA + .32, heading: 2.25, wait: 0 }); S.paddling = true; plank.visible = oar.visible = true; A.pascal.ext = paddleStep; skates.forEach(s => s.o.visible = false);
  h.g.camYaw = P.heading; h.st(7, ['KeyW']);
  const portrait = K.VW < K.VH; K.sceneCam = { noClip: true, pos: new T.Vector3(P.x + (portrait ? 9 : 7), portrait ? 5.2 : 3.2, P.z + (portrait ? 22 : 10.5)), look: new T.Vector3(P.x - 2.5, .65, P.z - 1.5) }; h.st(1);
  A.say(A.pascal.tag, 'Ich hasse Wasser!', 4, 'shout'); A.updateTags(0);
};
// Production-loop checks: use the same keyboard stepper as all review scenes.
// This scene is opt-in and never runs in a normal game.
K.scenes.surf_test = h => {
  const results = [], check = (name, value) => { if (!value) throw new Error('SURF CHECK: ' + name + ' ' + JSON.stringify({player:[P.x,P.y,P.z],pascal:[A.pascal.x,A.pascal.y,A.pascal.z],active:S.active,paddling:S.paddling,entry:[entryX,entryZ],exit:[exitX,exitZ],wet:pascalWet,ext:!!A.pascal.ext})); results.push(name); };
  const stage = (x, z, heading) => {
    h.g.start(true); h.g.told.surf = 1; h.g.told.photo = 1;
    Object.assign(P, { x, z, y: W.groundAt(x, z, 0, .7), heading, vx: 0, vz: 0, vy: 0, inv: 999, safe: null });
    Object.assign(A.pascal, { x: x - Math.sin(heading) * 8, z: z - Math.cos(heading) * 8, wait: 999, y: P.y });
    h.g.camYaw = heading; h.g.camReset = true; h.g.flowT = 0;
  };
  h.play(); stage(252, 110, Math.PI / 2); h.st(1, ['KeyW']); check('tap does not launch surf', !S.active); h.st(15); check('release resets surf intent', !S.active); h.st(45, ['KeyW']);
  check('east shore launches board and outfit', S.active && P.ext === surfStep && board.visible && outfit.every(o => o.visible));
  for (let i = 0; i < 20 && !S.paddling; i++) h.st(1); // shoreline confirmation delays Pascal's approach too
  check('Pascal follows on plank', S.paddling && plank.visible && oar.visible && A.pascal.ext === paddleStep);
  const speed = P.speed; h.st(1); check('release preserves momentum', P.speed > 1 && P.speed < speed);
  h.st(100); check('coast settles for photos', P.speed < .6);
  h.st(1, ['Space']); check('Space launches off swell', S.jumps === 1 && !P.onGround && P.vy > 0);
  h.st(65); check('wave jump lands', P.onGround && S.landings > 0);
  h.st(1, ['KeyB']); check('bark works on water', P.barkT > 0);
  h.g.camYaw = -Math.PI / 2; h.st(105, ['KeyW']);
  check('return to east shore restores walking', !S.active && !P.ext && !board.visible && outfit.every(o => !o.visible));
  h.st(80); check('Pascal restores on dry land', !S.paddling && A.pascal.ext == null && !plank.visible && !oar.visible);
  stage(84, -288, Math.PI); h.st(35, ['KeyW']); check('pier tip launches', S.active && P.z < -292);
  h.g.camYaw = Math.atan2(43 - P.x, -383 - P.z); h.st(115, ['KeyW']); h.st(45);
  check('Alcatraz landing is reachable', !S.active && W.inLand(P.x, P.z, .7) && Math.hypot(P.x - 40, P.z + 398) < 32);
  const ph = A.photos.find(s => s.id === 'alcatraz'); check('Alcatraz joins album once', !!ph && A.photos.filter(s => s.id === 'alcatraz').length === 1);
  // Walk the final metres to the ring using real movement; no collection calls.
  h.g.camYaw = Math.atan2(ph.x - P.x, ph.z - P.z);
  for (let i = 0; i < 100 && Math.hypot(ph.x - P.x, ph.z - P.z) > 1; i++) h.st(1, ['KeyW']);
  h.st(40); check('photo collects through normal hold-still logic', ph.got && h.g.photos === 1);
  for (let i = 0; i < 600 && (S.paddling || A.pascal.ext === paddleStep); i++) h.st(1);
  check('Pascal completes the island crossing after Kyoto lands', !S.paddling && A.pascal.ext == null && Math.hypot(A.pascal.x - 40, A.pascal.z + 398) < 32);
  for (const [name, x, z, heading] of [['Ocean Beach', -788, 200, -Math.PI / 2], ['north coast', -100, -207, Math.PI], ['south coast', 0, 591, 0]]) {
    stage(x, z, heading); h.st(35, ['KeyW']); check(name + ' launches', S.active);
  }
  stage(100, -250, Math.PI / 2); h.st(30, ['KeyW']); check('pier side launches', S.active);
  P.x = 300; P.z = -350; h.st(300, ['KeyW']); check('surf crosses 200 units of open water', S.active && P.x > 500 && S.distance > 200);
  const pausedX = P.x, pausedZ = P.z; h.g.pause(true); h.st(20, ['KeyW', 'Space']); check('pause freezes surfing', P.x === pausedX && P.z === pausedZ); h.g.pause(false);
  P.x = LIMIT.east - .2; P.z = 110; P.vx = 30; P.vz = 0; h.g.camYaw = Math.PI / 2; h.st(40, ['KeyW']); check('bay bounds contain surf', P.x < LIMIT.east);
  h.g.start(true); check('restart clears both takeovers and all gear', !S.active && !S.paddling && !P.ext && !A.pascal.ext && !board.visible && !plank.visible);
  S.reviewResults = results; console.info('SURF PASS ' + results.length + ': ' + results.join('; '));
  K.UI.banner('SURF CHECKS: ' + results.length + ' PASS', 'shore · pier · island · jump · bark · photo · reset');
};

})(window.K);
