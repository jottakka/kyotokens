/* KYOTO(KENS) — actors: Kyoto, Pascal, people, traffic, animals, pickups, events */
'use strict';
(function (K) {
const T = K.T, U = K.U, W = K.W, scene = K.scene;
const A = K.A = {};
const tv = new T.Vector3();

/* ================= TEXTURES FOR OUTFITS ================= */
const TX = A.tx = {};
function buildTextures() {
  TX.gingham = K.canvasTex(64, 64, g => { g.fillStyle = '#f4f7fc'; g.fillRect(0, 0, 64, 64); g.fillStyle = 'rgba(60,110,190,.55)'; for (let i = 0; i < 64; i += 16) { g.fillRect(0, i, 64, 8); g.fillRect(i, 0, 8, 64); } }, true); TX.gingham.repeat.set(3, 3);
  TX.plaid = K.canvasTex(64, 64, g => { g.fillStyle = '#e0622a'; g.fillRect(0, 0, 64, 64); g.fillStyle = 'rgba(28,36,70,.7)'; g.fillRect(0, 22, 64, 12); g.fillRect(22, 0, 12, 64); g.fillStyle = 'rgba(255,220,160,.55)'; g.fillRect(0, 48, 64, 3); g.fillRect(48, 0, 3, 64); g.fillStyle = 'rgba(120,20,10,.4)'; g.fillRect(0, 6, 64, 5); g.fillRect(6, 0, 5, 64); }, true); TX.plaid.repeat.set(2, 2);
  TX.socks = K.canvasTex(32, 64, g => { g.fillStyle = '#f6f3ea'; g.fillRect(0, 0, 32, 64); g.fillStyle = '#2f7d4f'; g.fillRect(0, 8, 32, 5); g.fillRect(0, 17, 32, 3); }, true);
  TX.hawaii = K.canvasTex(64, 64, g => { g.fillStyle = '#ff8a3d'; g.fillRect(0, 0, 64, 64); for (let i = 0; i < 9; i++) { g.fillStyle = i % 2 ? '#ffe45c' : '#2fd0c0'; g.beginPath(); g.arc(Math.random() * 64, Math.random() * 64, 6, 0, 7); g.fill(); } }, true);
  TX.sparkle = K.canvasTex(64, 64, g => { g.fillStyle = '#ff3fa4'; g.fillRect(0, 0, 64, 64); for (let i = 0; i < 90; i++) { g.fillStyle = Math.random() < .5 ? '#ffd1ee' : '#ffffff'; g.fillRect(Math.random() * 64, Math.random() * 64, 2, 2); } }, true);
  TX.stripes = K.canvasTex(32, 32, g => { g.fillStyle = '#1f2a3a'; g.fillRect(0, 0, 32, 32); g.fillStyle = '#f4f1ea'; g.fillRect(0, 0, 32, 6); g.fillRect(0, 16, 32, 6); }, true);
}

/* ================= SPEECH / FX HELPERS (DOM) ================= */
const labels = K.$('#labels');
A.tags = [];
A.tag = function (obj, name, cls, headY, maxD) {
  const el = document.createElement('div'); el.className = 'tag ' + (cls || '');
  const inr = document.createElement('div'); inr.className = 'in';
  const b = document.createElement('div'); b.className = 'bubble'; b.hidden = true;
  const n = document.createElement('div'); n.className = 'name'; n.textContent = name || ''; n.hidden = !name;
  inr.append(b, n); el.appendChild(inr); labels.appendChild(el);
  const t = { obj, el, b, n, headY, maxD: maxD || 90, bt: 0, shown: null }; A.tags.push(t); return t;
};
A.say = function (t, text, dur, kind) { if (!t) return; t.b.textContent = text; t.b.className = 'bubble ' + (kind || 'speech'); t.b.hidden = false; t.bt = dur || 2.8; };
A.untag = t => { if (!t) return; t.el.remove(); const i = A.tags.indexOf(t); if (i >= 0) A.tags.splice(i, 1); };
const wp = new T.Vector3();
A.project = v => { tv.copy(v).project(K.camera); return { x: (tv.x * .5 + .5) * K.VW, y: (-tv.y * .5 + .5) * K.VH, ok: tv.z < 1 && tv.z > -1 }; };
A.updateTags = function (dt) {
  for (const t of A.tags) {
    if (t.bt > 0) { t.bt -= dt; if (t.bt <= 0) t.b.hidden = true; }
    let show = t.obj.visible !== false && (!t.n.hidden || !t.b.hidden) && !A.hideTags;
    if (show) { t.obj.getWorldPosition(wp); wp.y += t.headY; const d = wp.distanceTo(K.camera.position); if (d > t.maxD) show = false; else { const p = A.project(wp); if (!p.ok) show = false; else { t.el.style.transform = `translate(${p.x.toFixed(1)}px,${p.y.toFixed(1)}px)`; t.el.style.zIndex = String(1000 - Math.round(d)); } } }
    if (show !== t.shown) { t.el.style.display = show ? '' : 'none'; t.shown = show; }
  }
};
A.sfxText = function (x, y, z, text, cls) { wp.set(x, y, z); const p = A.project(wp); if (!p.ok) return; const d = document.createElement('div'); d.className = 'sfx ' + (cls || ''); d.textContent = text; d.style.left = p.x + 'px'; d.style.top = p.y + 'px'; d.style.setProperty('--r', (U.rand(-12, 12)).toFixed(0) + 'deg'); labels.appendChild(d); setTimeout(() => d.remove(), 1100); };
A.floater = function (x, y, z, text, cls) { wp.set(x, y, z); const p = A.project(wp); if (!p.ok) return; const d = document.createElement('div'); d.className = 'floater ' + (cls || ''); d.textContent = text; d.style.left = p.x + 'px'; d.style.top = p.y + 'px'; labels.appendChild(d); setTimeout(() => d.remove(), 1100); };

/* ================= CHARACTER FACTORY ================= */
const SKINS = ['#f6d2b8', '#f1c4a3', '#e0ac80', '#c68a62', '#a86f4c', '#8d5a3b', '#6b4430'];
A.person = function (o) {
  const r = K.rigClone(K.assets.human);
  r.show(o.acc || []);
  const drop = []; r.root.traverse(c => { if (c.name && c.name.startsWith('acc_') && !c.visible) drop.push(c); }); drop.forEach(c => c.parent && c.parent.remove(c));
  const set = (k, v) => { if (v == null) return; if (v.isTexture) r.tex(k, v); else r.color(k, v); };
  set('skin', o.skin || U.pick(SKINS)); set('shirt', o.shirt); set('sleeve', o.sleeve != null ? o.sleeve : o.shirt); set('pants_up', o.pants); set('pants_lo', o.pantsLo != null ? o.pantsLo : o.pants);
  set('socks', o.socks); set('shoes', o.shoes); set('hair', o.hair); set('beard', o.beard || o.hair); set('hat', o.hat); set('coat', o.coat); set('vest', o.vest); set('bag', o.bag); set('lens', o.lens); set('leather', o.leather);
  if (o.sleeveSkin) set('sleeve', r.mats.skin && r.mats.skin[0].color.getStyle());
  r.root.scale.setScalar(o.scale || 1);
  scene.add(r.root);
  r.x = 0; r.z = 0; r.y = 0; r.heading = 0;
  r.place = function () { r.root.position.set(r.x, r.y, r.z); r.root.rotation.y = r.heading; };
  return r;
};
const HAIRS = ['#1d1510', '#3a2618', '#6b4423', '#b8864f', '#e2c07a', '#8a3b1f', '#c9c3bd', '#2b2b33'];
const CLOTH = ['#e2572f', '#2fb6c7', '#7a5cff', '#ffd23f', '#2d2f36', '#ff6fa1', '#4f9a45', '#c77dff', '#f4f1ea', '#1f6fd1', '#ff8a3d', '#18a676'];
const PANTS = ['#2b3446', '#3b4a66', '#6b5a44', '#1f2a3a', '#8a7a5a', '#2d2f36', '#4a3a5a'];
A.ARCHETYPES = [
  () => ({ n: 'tech', acc: ['acc_vest', 'acc_backpack', 'acc_phone', 'acc_hair_short', U.pick(['acc_glasses', 'acc_cap'])], shirt: U.pick(['#f4f1ea', '#cfe0f5', '#2d2f36']), vest: U.pick(['#2b3140', '#1f6fd1', '#4f9a45']), pants: '#3b4a66', hat: '#2d2f36', bag: U.pick(CLOTH), lens: '#1a2230' }),
  () => ({ n: 'grandma', acc: ['acc_hair_bun', 'acc_glasses', 'acc_dress'], shirt: '#b98ad8', coat: U.pick(['#ffb3c7', '#8fd3ff', '#fff1c9']), hair: '#d9d4cf', skin: U.pick(SKINS), pants: '#6b5a44', scale: .9, lens: '#7a5a3a' }),
  () => ({ n: 'cook', acc: ['acc_apron', 'acc_cap', 'acc_beard_short'], shirt: '#2d2f36', hat: '#1d1d22', pants: '#2d2f36', skin: U.pick(SKINS.slice(2)) }),
  () => ({ n: 'tourist', acc: ['acc_buckethat', 'acc_camera', 'acc_hair_short'], shirt: TX.hawaii, sleeve: TX.hawaii, pants: '#c9b58a', pantsLo: null, hat: '#f4e3b0', lens: '#1a2230', sleeveSkin: false }),
  () => ({ n: 'runner', acc: ['acc_hair_long', 'acc_shades'], shirt: U.pick(['#ff6fa1', '#2fb6c7', '#ffd23f']), sleeveSkin: true, pants: '#1f2a3a', shoes: '#ff5a5a', hair: U.pick(HAIRS) }),
  () => ({ n: 'musician', acc: ['acc_fedora', 'acc_guitar', 'acc_beard_short'], shirt: '#3a2a4a', pants: '#2b2b33', hat: '#3b2e25', skin: U.pick(SKINS.slice(3)) }),
  () => ({ n: 'parent', acc: ['acc_hair_long', 'acc_backpack'], shirt: U.pick(CLOTH), pants: U.pick(PANTS), bag: '#4f9a45', hair: U.pick(HAIRS) }),
  () => ({ n: 'queen', acc: ['acc_hair_afro', 'acc_dress', 'acc_shades'], shirt: TX.sparkle, coat: TX.sparkle, hair: '#ffe27a', pants: '#ff3fa4', shoes: '#ff3fa4', scale: 1.08, lens: '#ff3fa4' }),
  () => ({ n: 'skater', acc: ['acc_cap', 'acc_hair_short'], shirt: U.pick(['#2d2f36', '#e2572f', '#7a5cff']), pants: '#2b2f38', hat: U.pick(CLOTH) }),
  () => ({ n: 'local', acc: [U.pick(['acc_hair_short', 'acc_hair_curlysmall', 'acc_hair_long', 'acc_hair_bun', 'acc_hair_afro']), U.pick(['', 'acc_glasses', 'acc_beanie', 'acc_cap', ''])], shirt: U.pick(CLOTH), pants: U.pick(PANTS), hair: U.pick(HAIRS), hat: U.pick(CLOTH) }),
];

// Preserve the legacy factory for the protected hero, manager and MCP dealer.
A.legacyPerson = A.person;
const npcModels = [], npcPalettes = new Map(), npcSleeves = new Map();
let npcSerial = 0;
// Extend the existing loader, calling it exactly once; build still waits for all rigs.
const loadBaseAssets = K.loadAll;
K.loadAll = async function (list, progress) {
  let humans = [];
  try { const response = await fetch('assets/ext/manifest.json'); if (response.ok) humans = (await response.json()).filter(a => a.kind === 'human' && /CC0/.test(a.license)); } catch (_) {}
  const base = ['casual_character', 'worker', 'skateboarder'].map(name => ({ name, file: 'assets/npc/' + name + '.json' }));
  for (const h of humans) if (!base.some(b => b.name === h.name) && /\.json$/.test(h.file)) base.push(h);
  const result = await loadBaseAssets.call(K, list.concat(base.map(a => ['npc_' + a.name, a.file])), progress);
  base.forEach(a => { const g = K.assets['npc_' + a.name]; if (g && g.animations.length) { prepareNPC(g, a.name); npcModels.push({ name: a.name, g }); } });
  if (K.ceos && K.ceos.preloadCutArt) { K.loadStatus && K.loadStatus('Loading character art', 'CEO portraits and outlines'); await K.ceos.preloadCutArt(); }
  return result;
};
function prepareNPC(g, name) {
  if (name === 'skateboarder') {
    const head = g.scene.getObjectByName('head'); if (head) head.scale.multiplyScalar(.72);
    for (const clip of g.animations) for (const track of clip.tracks) if (track.name === 'head.scale') for (let i = 0; i < track.values.length; i++) track.values[i] *= .72;
  }
  g.scene.updateMatrixWorld(true);
  const bounds = new T.Box3().setFromObject(g.scene);
  g.npcScale = 3.25 / Math.max(.01, bounds.max.y - bounds.min.y); g.npcFloor = bounds.min.y;
  const meshes = []; g.scene.traverse(m => { if (m.isMesh) meshes.push(m); });
  // K.inkShell's expansion, with the original skeleton bound to the outline too.
  const ink = g.npcInk = new T.MeshBasicMaterial({ color: '#241d32', side: T.BackSide, skinning: true });
  const outlines = new Map();
  for (const m of meshes) {
    const geo = m.geometry.clone(), p = geo.attributes.position, n = geo.attributes.normal;
    if (!n) continue;
    const meshScale = m.getWorldScale(new T.Vector3());
    const width = .018 / (g.npcScale * Math.max(meshScale.x, meshScale.y, meshScale.z));
    for (let i = 0; i < p.count; i++) p.setXYZ(i, p.getX(i) + n.getX(i) * width, p.getY(i) + n.getY(i) * width, p.getZ(i) + n.getZ(i) * width);
    const shell = m.isSkinnedMesh ? new T.SkinnedMesh(geo, ink) : new T.Mesh(geo, ink);
    shell.name = m.name + '_npcInk'; shell.userData.ink = true; shell.position.copy(m.position); shell.quaternion.copy(m.quaternion); shell.scale.copy(m.scale);
    if (m.isSkinnedMesh) { shell.bindMode = m.bindMode; shell.bind(m.skeleton, m.bindMatrix); }
    shell.frustumCulled = false; m.parent.add(shell);
    if (!outlines.has(m.parent)) outlines.set(m.parent, []); outlines.get(m.parent).push(shell);
  }
  outlines.forEach(parts => {
    if (parts.length < 2) return;
    const geometry = T.BufferGeometryUtils.mergeBufferGeometries(parts.map(p => p.geometry), false);
    if (!geometry) return;
    parts.forEach((p, i) => { p.geometry.dispose(); if (i) p.parent.remove(p); }); parts[0].geometry = geometry;
  });
}
function npcRole(mesh, material) {
  const name = (mesh.parent.name + ' ' + mesh.name).toLowerCase(), mat = material.name.toLowerCase();
  if (/skin/.test(mat)) return 'skin';
  if (/hair|moustache|eyebrow/.test(mat)) return 'hair';
  if (/eye/.test(mat)) return '';
  if (/shoe|boot|socks/.test(mat)) return 'shoes';
  if (/pants/.test(mat)) return 'pants';
  if (/shirt|dress/.test(mat)) return 'shirt';
  if (/feet|shoe/.test(name)) return 'shoes';
  if (/legs|pants/.test(name)) return 'pants';
  if (/body|torso/.test(name)) return 'shirt';
  if (/worker_yellow/.test(mat)) return 'hat';
  return '';
}
A.person = function (options) {
  const o = options || {};
  if (o.legacy || !npcModels.length) return A.legacyPerson(o);
  const index = npcSerial++, skater = o.n === 'skater';
  const candidates = npcModels.filter(m => m.name !== 'skateboarder');
  const selected = npcModels.find(m => m.name === o.model) || (skater && npcModels.find(m => m.name === 'skateboarder')) || candidates[index % candidates.length] || npcModels[0];
  const g = selected.g, r = K.rigClone(g), model = r.root, root = new T.Group(); root.add(model);
  model.scale.setScalar(g.npcScale); model.position.y = -g.npcFloor * g.npcScale;
  r.root = root; r.model = model; r.sourceModel = selected.name;
  const colors = { shirt: o.shirt && !o.shirt.isTexture ? o.shirt : CLOTH[index % CLOTH.length], pants: o.pants || '#34445c', skin: o.skin || SKINS[index % SKINS.length], hair: o.hair || HAIRS[index % HAIRS.length], shoes: o.shoes || '#eee7d7', hat: o.hat || '#e4b34a' };
  const setPalette = () => model.traverse(m => {
    if (!m.isMesh) return;
    if (m.userData.ink) { m.material = g.npcInk; return; }
    if (o.longSleeves && m.isSkinnedMesh && /body/i.test(m.name + ' ' + m.parent.name) && /skin/i.test(m.material.name || '')) {
      const key = selected.name + ':' + m.geometry.uuid + ':' + colors.shirt + ':' + colors.skin;
      if (!npcSleeves.has(key)) {
        const geometry = m.geometry.clone(), indices = geometry.attributes.skinIndex, weights = geometry.attributes.skinWeight, data = new Float32Array(indices.count * 3);
        const skin = new T.Color(colors.skin), cloth = new T.Color(colors.shirt);
        for (let v = 0; v < indices.count; v++) {
          let hand = 0;
          for (let j = 0; j < 4; j++) { const bone = m.skeleton.bones[indices.getComponent ? indices.getComponent(v, j) : indices.array[v * 4 + j]]; if (bone && /wrist|index|thumb|middle|ring|pinky/i.test(bone.name)) hand += weights.array[v * 4 + j]; }
          const c = hand > .35 ? skin : cloth; data.set([c.r, c.g, c.b], v * 3);
        }
        geometry.setAttribute('color', new T.BufferAttribute(data, 3)); npcSleeves.set(key, geometry);
      }
      m.geometry = npcSleeves.get(key); const material = K.toon('#ffffff', { skinning: true, vertexColors: true }); material.name = 'npc_sleeves'; m.material = material; return;
    }
    const head = /head/i.test(m.name + ' ' + m.parent.name);
    if (o.headless && head) m.visible = false;
    const tint = src => {
      const role = npcRole(m, src), color = colors[role], key = selected.name + ':' + src.name + ':' + (color || 'original');
      if (!npcPalettes.has(key)) { const mat = src.clone(); if (color) mat.color.set(color); npcPalettes.set(key, mat); }
      return npcPalettes.get(key);
    };
    m.material = Array.isArray(m.material) ? m.material.map(tint) : tint(m.material);
  });
  setPalette(); r.mats = {};
  if (o.headless) model.traverse(m => { if (m.isMesh && /head/i.test(m.name + ' ' + m.parent.name)) m.visible = false; });
  const clips = g.animations, find = names => { for (const name of names) { const c = clips.find(c => c.name.split('|').pop().toLowerCase().replace(/^(man|female)_/, '') === name); if (c) return r.actions[c.name]; } return null; };
  const aliases = { idle: ['idle', 'idle_neutral'], walk: ['walk'], run: ['run', 'sprint'], panic: ['run', 'sprint'], wave: ['wave', 'clapping', 'emote-yes', 'interact'], talk: ['interact', 'clapping', 'working', 'emote-yes', 'idle'], sit: ['sit', 'sitting', 'crouch', 'idle'], skate: ['skate', 'idle'], jump: ['jump', 'skate-air', 'idle'] };
  Object.keys(aliases).forEach(name => { r.actions[name] = find(aliases[name]) || find(['idle']) || Object.values(r.actions)[0]; });
  const play = r.play; r.play = function (name, fade, speed) { play(name, fade, speed); r.curName = name; };
  r.color = function (name, color) { colors[name] = color; setPalette(); };
  root.scale.setScalar(o.scale || 1); root.name = 'npc_' + selected.name;
  r.x = r.y = r.z = r.heading = 0;
  r.place = function () { root.position.set(r.x, r.y, r.z); root.rotation.y = r.heading; };
  scene.add(root); r.play('idle', 0); r.mixer.update((index * .173) % 1);
  return r;
};

/* ================= KYOTO ================= */
const P = A.player = { x: 115, z: -22, y: 0, vy: 0, heading: Math.PI, speed: 0, mode: 'walk', onGround: true, stun: 0, inv: 0, stamina: 1, board: 0, car: null, carT: 0, cable: null };
function buildKyoto() {
  const r = K.rigClone(K.assets.kyoto);
  scene.add(r.root); A.kyoto = r; r.play('idle');
  r.tongue = r.root.getObjectByName('tongue');
  r.tag = A.tag(r.root, '', 'kyoto', 2.4, 80); r.neck = r.root.getObjectByName('neck'); r.chest = r.root.getObjectByName('front'); r.hips = r.root.getObjectByName('back');
  // skateboard (procedural, shown when riding)
  const b = new T.Group(); const deck = new T.Mesh(new T.BoxGeometry(.9, .12, 2.6), K.toon('#e2572f')); deck.castShadow = true; b.add(deck);
  const grip = new T.Mesh(new T.BoxGeometry(.8, .02, 2.3), K.toon('#2b2433')); grip.position.y = .07; b.add(grip);
  for (const [x, z] of [[-.3, .85], [.3, .85], [-.3, -.85], [.3, -.85]]) { const w = new T.Mesh(new T.CylinderGeometry(.14, .14, .14, 10), K.toon('#ffd23f')); w.rotation.z = Math.PI / 2; w.position.set(x, -.16, z); b.add(w); }
  b.position.y = .25; b.visible = false; K.ownMaterials(b); r.root.add(b); r.board = b;
}

/* ================= PASCAL ================= */
const PASCAL_LINES = ['Kyoto! Komm zu Papa!', 'Kyoto, bitte! Komm her, mein Schatz!', 'Wo bist du, Kyoto?!', 'Pass auf, die Straße!', 'Nicht über die Straße, Kyoto!', 'Kyoto! Leckerli! Ich hab Leckerli!', 'Braver Hund… bleib! BLEIB!', 'Papa ist nicht böse, versprochen!', 'Hast du Hunger? Wurst!', 'Kyoto, das ist gefährlich!', 'Kyooootooo! Komm zurück!', 'Mein armer Hund… hast du Angst?', 'Ich hab dich lieb, komm her!', 'Kyoto, deine Pfoten! Sei vorsichtig!'];
const DEPLOY = ['Agents! Findet meinen Hund!', 'find_dog(name="Kyoto", gently=True)', 'Drones up. Bitte vorsichtig mit ihm!', 'Agents: locate the good boy!'];
function buildPascal() {
  if (K.assets.pascal) {   // reconstructed hero model (goal renders), driven by the shared human clips
    const r = K.rigClone(K.assets.pascal, { clips: K.pascalClips || (K.pascalClips = K.retarget(K.assets.human, K.assets.pascal).concat(K.assets.pascal.animations || [])) });
    r.root.scale.setScalar(1.06); scene.add(r.root);
    Object.assign(r, { x: 240, z: 196, y: 0, heading: 0, vx: 0, vz: 0, wait: 3, stun: 0, agentT: 22, sayT: 5, rage: 0, glitch: 0, glitchCool: 0, hugT: 0, ping: 0 });
    r.place = function () { r.root.position.set(r.x, r.y, r.z); r.root.rotation.y = r.heading; };
    r.tag = A.tag(r.root, 'Pascal', 'pascal', 4.3, 160); r.hand = r.root.getObjectByName('handR');
    r.play('idle'); A.pascal = r; return;
  }
  const r = A.person({ legacy: true, acc: ['acc_hair_curly', 'acc_beard_full', 'acc_suspenders', 'acc_flap', 'acc_lederhosen', 'acc_shirtfront', 'acc_skates_L', 'acc_skates_R', 'acc_phone'], skin: '#f3c6a6', shirt: TX.gingham, pants: '#6b4424', pantsLo: '#f3c6a6', socks: TX.socks, shoes: '#1c1f24', hair: '#e3862c', beard: '#c9702a', leather: '#6b4424', scale: 1.06 });
  r.color('wheels', '#29d3c8'); r.color('accent', '#ffd35a'); r.color('phone', '#6fe0da'); r.color('eye_b', '#2f6fc8');
  Object.assign(r, { x: 240, z: 196, vx: 0, vz: 0, wait: 3, stun: 0, agentT: 22, sayT: 5, rage: 0, glitch: 0, glitchCool: 0, hugT: 0, ping: 0 });
  r.tag = A.tag(r.root, 'Pascal', 'pascal', 4.3, 160); r.hand = r.root.getObjectByName('handR');
  r.play('idle'); A.pascal = r;
}

/* ================= MANAGER ON THE RED VESPA ================= */
const BOSS_LINES = ["Hi Kyoto, don't forget our 1:1!", 'Hey Kyoto, how is the pawgress of your project?', 'Love the velocity. Very pawductive sprint!', "Quick sync? I'll send an invite. Fetch-themed.", "What's the ETA on those letters? EOD works.", "Is Pascal a blocker? Let's unblock you.", 'Per my last bark…', "Great energy! Let's circle back after your walk.", 'Remember: no treats without OKRs.', "Let's take this offline. And off-leash.", 'Kudos in #wins for the zoomies!', "Let's align on your Q4 sniffing goals.", 'Performance review: exceeds expectations. Good boy.'];
A.VS = 1.9;
function vehicleNode(name) { const V = K.assets.vehicles; const n = V && V.scene.getObjectByName(name); if (!n) return null; const c = n.clone(true); c.position.set(0, 0, 0); c.rotation.set(0, 0, 0); c.scale.setScalar(A.VS); K.ownMaterials(c); c.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } }); return c; }
function buildBoss() {
  const r = A.person({ legacy: true, acc: ['acc_beanie', 'acc_glasses_rect', 'acc_beard_short'], skin: '#f0c4a8', shirt: TX.plaid, pants: '#2f3a52', hat: '#2e3b4e', beard: '#d19a5c', hair: '#d19a5c', lens: '#1c1f24' });
  r.play('sit');
  let v = vehicleNode('vespa');
  if (!v) { v = new T.Group(); const body = new T.Mesh(new T.SphereGeometry(1, 16, 12), K.toon('#d0161f')); body.scale.set(.5, .45, .9); body.position.set(0, .8, -.3); v.add(body); }
  scene.add(v); v.add(r.root); const vs = v.scale.x || 1; r.root.scale.setScalar(1 / vs); r.root.position.set(0, .04, -.255); r.root.rotation.set(0, 0, 0);   // pelvis on the saddle (vespa-local units)
  const wheels = []; v.traverse(o => { if (/wheel/.test(o.name)) wheels.push(o); });
  const pts = [[-110 + 3, -20 + 3], [130 - 3, -20 + 3], [130 - 3, 100 - 3], [-110 + 3, 100 - 3]]; let len = 0; for (let k = 0; k < 4; k++) { const a = pts[k], b = pts[(k + 1) % 4]; len += Math.hypot(b[0] - a[0], b[1] - a[1]); }
  A.boss = { rig: r, v, wheels, loop: { pts, len }, s: 0, spd: 12, x: 0, z: 0, heading: 0, cool: 0, stopT: 0, first: false, tag: A.tag(v, 'Manager', 'boss', 4.8, 120) };
}

/* Two-bone IK for the seated rider: hands on the grips, feet on the floorboard, torso leaning into the bars.
   Aims each bone at its child so it works whatever the rig's local axes are. Targets are vespa-local. */
const ikV = [0, 1, 2, 3, 4, 5].map(() => new T.Vector3()), ikQ = [0, 1, 2].map(() => new T.Quaternion()), ikM = new T.Matrix4();
function ikAim(bone, child, target) {
  bone.updateWorldMatrix(true, true);
  const cur = ikV[0].subVectors(child.getWorldPosition(ikV[1]), bone.getWorldPosition(ikV[2])).normalize(), des = ikV[3].subVectors(target, ikV[2]).normalize();
  ikQ[0].setFromUnitVectors(cur, des).multiply(bone.getWorldQuaternion(ikQ[1])); bone.parent.getWorldQuaternion(ikQ[2]).invert();
  bone.quaternion.copy(ikQ[2].multiply(ikQ[0]));
}
function ikLimb(root, tip, target, pole, lens) {   // root=thigh/upperarm, mid=shin/forearm, tip=foot/hand (world targets)
  const mid = tip.parent, S = root.getWorldPosition(new T.Vector3());
  const l1 = lens[0], l2 = lens[1], to = new T.Vector3().subVectors(target, S), d = U.clamp(to.length(), Math.abs(l1 - l2) + .01, l1 + l2 - .005), u = to.normalize();
  const a = (l1 * l1 - l2 * l2 + d * d) / (2 * d), h = Math.sqrt(Math.max(0, l1 * l1 - a * a));
  const pv = pole.clone().addScaledVector(u, -pole.dot(u)).normalize(), E = S.clone().addScaledVector(u, a).addScaledVector(pv, h);
  ikAim(root, mid, E); ikAim(mid, tip, S.clone().addScaledVector(u, d));
}
A.poseRider = function (b) {
  const r = b.rig, v = b.v; if (!r.ik) { const g = n => r.root.getObjectByName(n); r.ik = { spine: g('spine'), chest: g('chest'), neck: g('neck'), head: g('head'), arm: [g('upperarmL'), g('upperarmR')], hand: [g('handL'), g('handR')], leg: [g('thighL'), g('thighR')], foot: [g('footL'), g('footR')] }; if (Object.values(r.ik).flat().some(x => !x)) r.ik = { none: true }; }
  const k = r.ik; if (k.none) return;
  v.updateMatrixWorld(true); r.root.updateMatrixWorld(true);
  const W = (x, y, z) => new T.Vector3(x, y, z).applyMatrix4(v.matrixWorld), D = (x, y, z) => new T.Vector3(x, y, z).transformDirection(v.matrixWorld);
  // lean the torso toward the bars (chest is aimed ~29° past vertical), keep the head level
  const sp = k.spine.getWorldPosition(new T.Vector3()); ikAim(k.spine, k.chest, sp.clone().add(D(0, Math.cos(.5), Math.sin(.5))));
  const nk = k.neck.getWorldPosition(new T.Vector3()); ikAim(k.neck, k.head, nk.clone().add(D(0, Math.cos(.12), Math.sin(.12))));   // head back up, eyes on the road
  const len = (p, c) => p.getWorldPosition(ikV[4]).distanceTo(c.getWorldPosition(ikV[5]));
  for (let i = 0; i < 2; i++) {
    const side = i ? -1 : 1, up = k.arm[i], fa = k.hand[i].parent, th = k.leg[i], sh = k.foot[i].parent;
    if (!(i === 1 && r.curName === 'wave')) ikLimb(up, k.hand[i], W(side * .37, 1.23, .40), D(side * 1, -.45, -.3), [len(up, fa), len(fa, k.hand[i])]);
    ikLimb(th, k.foot[i], W(side * .2, .56, .3), D(side * .7, .3, 1), [len(th, sh), len(sh, k.foot[i])]);
  }
};

/* ================= LOOP PATHS ================= */
A.loopPos = function (loop, s) { const P = loop.pts, L = loop.len; s = ((s % L) + L) % L; for (let i = 0; i < P.length; i++) { const a = P[i], b = P[(i + 1) % P.length], l = Math.hypot(b[0] - a[0], b[1] - a[1]); if (s <= l) { const t = s / l; return { x: a[0] + (b[0] - a[0]) * t, z: a[1] + (b[1] - a[1]) * t, h: Math.atan2(b[0] - a[0], b[1] - a[1]) }; } s -= l; } return { x: P[0][0], z: P[0][1], h: 0 }; };
function rectLoop(x0, x1, z0, z1, lane) { lane = lane || 3; const pts = [[x0 + lane, z0 + lane], [x1 - lane, z0 + lane], [x1 - lane, z1 - lane], [x0 + lane, z1 - lane]]; let len = 0; for (let k = 0; k < 4; k++) { const a = pts[k], b = pts[(k + 1) % 4]; len += Math.hypot(b[0] - a[0], b[1] - a[1]); } return { pts, len }; }
function loopOK(loop) { for (let k = 0; k < 4; k++) { const a = loop.pts[k], b = loop.pts[(k + 1) % 4], n = Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / 8); for (let i = 0; i <= n; i++) { const x = U.lerp(a[0], b[0], i / n), z = U.lerp(a[1], b[1], i / n); if (!W.inLand(x, z, 1) || Math.hypot(x - W.STAD.x, z - W.STAD.z) < W.STAD.r1 + 3 || W.terrainH(x, z) > 26 || !W.onRoad(x, z, -1)) return false; } } return true; }
A.randomLoop = near => randomLoop(near);
function randomLoop(near) { for (let t = 0; t < 90; t++) { const i = U.randi(0, W.XR.length - 2), j = U.randi(0, W.ZR.length - 2); const i2 = Math.min(W.XR.length - 1, i + U.randi(1, 3)), j2 = Math.min(W.ZR.length - 1, j + U.randi(1, 3)); if (near && Math.hypot((W.XR[i] + W.XR[i2]) / 2 - near[0], (W.ZR[j] + W.ZR[j2]) / 2 - near[1]) > near[2]) continue; const l = rectLoop(W.XR[i], W.XR[i2], W.ZR[j], W.ZR[j2]); if (loopOK(l)) return l; } return rectLoop(10, 130, -80, 40); }

/* ================= TRAFFIC ================= */
A.cars = [];
function makeCar(kind, color) {
  let g = vehicleNode(kind);
  if (!g) { g = new T.Group(); const b = new T.Mesh(new T.BoxGeometry(2.1, 1.4, 4.4), K.toon(color || '#f4f5f6')); b.position.y = 1; b.castShadow = true; g.add(b); }
  if (kind === 'bus' || kind === 'foodtruck') g.scale.multiplyScalar(.83);
  if (kind === 'bus') g.scale.z *= .68;
  if (color) g.traverse(o => { if (o.isMesh) (Array.isArray(o.material) ? o.material : [o.material]).forEach(m => { if (m.name === 'body') m.color.set(color); }); });
  scene.add(g);
  const wheels = [], spin = []; g.traverse(o => { if (/wheel/.test(o.name)) wheels.push(o); if (/lidar/.test(o.name)) spin.push(o); });
  if (kind === 'waymo') {   // see-through cabin glass + a steering wheel, so a driving Kyoto sits visibly inside
    g.traverse(o => { if (!o.isMesh) return; (Array.isArray(o.material) ? o.material : [o.material]).forEach(m => { if (m.name === 'glass') { m.transparent = true; m.opacity = .32; m.color.set('#bfe9ff'); m.depthWrite = false; } }); });
    const sw = new T.Mesh(new T.TorusGeometry(.12, .02, 6, 16), K.toon('#23262d')); sw.position.set(-.13, .86, .5); sw.rotation.x = -1.0; sw.scale.setScalar(1.3); sw.name = 'steer'; g.add(sw);
  }
  return { g, wheels, spin };
}
A.body = function (c, kind) {
  const box = new T.Box3().setFromObject(c.g || c.v), size = box.getSize(new T.Vector3());
  c.ox = (box.min.x + box.max.x) / 2; c.oz = (box.min.z + box.max.z) / 2; c.t = 3; c.hx = Math.max(.5, size.x / 2); c.hz = Math.max(.6, size.z / 2); c.bodyHeight = Math.max(1, size.y); c.owner = c;
  if (kind) c.kind = kind;
  Object.defineProperties(c, { bot: { get() { return W.terrainH(c.x, c.z); } }, top: { get() { return c.bot + c.bodyHeight; } } });
  W.dynamic.push(c); return c;
};
A.vehicleClear = function (c, x, z, heading, dynamic = true) {
  // Static footprint probes use the world's spatial index. Dynamic hulls use SAT and our hash.
  const sn = Math.sin(heading), cs = Math.cos(heading), inset = .12;
  const nx = Math.max(1, Math.ceil(c.hx * 2 / .8)), nz = Math.max(1, Math.ceil(c.hz * 2 / .8));
  c.staticBlocked = false;
  const y = W.terrainH(x, z), opt = { dynamic: false, ignore: c, height: c.bodyHeight, step: .12 };
  for (let i = 0; i <= nx; i++) for (let j = 0; j <= nz; j++) {
    if (dynamic === 'moving') break;
    const lx = (c.ox || 0) + U.lerp(-c.hx + inset, c.hx - inset, i / nx), lz = (c.oz || 0) + U.lerp(-c.hz + inset, c.hz - inset, j / nz);
    if (W.blockedAt(x + cs * lx + sn * lz, z - sn * lx + cs * lz, .16, y, opt)) { c.staticBlocked = true; return false; }
  }
  if (dynamic === 'static') return true;
  c.blocker = null;
  const list = A.trafficNear ? A.trafficNear(x, z, Math.hypot(c.hx, c.hz) + 20, c._hulls || (c._hulls = [])) : W.dynamic;
  const pose = c._pose || (c._pose = {}); Object.assign(pose, { x, z, heading, hx: c.hx, hz: c.hz, ox: c.ox, oz: c.oz });
  for (const b of list) {
    if (b === c || b.owner === c || !Number.isFinite(b.hx) || (!dynamic && (b.kind === 'cablecar' || b.kind === 'streetcar'))) continue;
    if (Math.abs(W.terrainH(b.x, b.z) - y) > Math.max(c.bodyHeight, b.bodyHeight || 2)) continue;
    if (A.hullsOverlap(pose, b, .08)) { c.blocker = b; return false; }
  }
  return true;
};
A.hullsOverlap = function (a, b, margin = 0) {
  const sa = Math.sin(a.heading), ca = Math.cos(a.heading), sb = Math.sin(b.heading), cb = Math.cos(b.heading);
  const dx = b.x + cb * (b.ox || 0) + sb * (b.oz || 0) - a.x - ca * (a.ox || 0) - sa * (a.oz || 0);
  const dz = b.z - sb * (b.ox || 0) + cb * (b.oz || 0) - a.z + sa * (a.ox || 0) - ca * (a.oz || 0);
  for (let i = 0; i < 4; i++) {
    const x = i === 0 ? ca : i === 1 ? sa : i === 2 ? cb : sb, z = i === 0 ? -sa : i === 1 ? ca : i === 2 ? -sb : cb;
    const ra = Math.abs(x * ca - z * sa) * a.hx + Math.abs(x * sa + z * ca) * a.hz;
    const rb = Math.abs(x * cb - z * sb) * b.hx + Math.abs(x * sb + z * cb) * b.hz;
    if (Math.abs(dx * x + dz * z) >= ra + rb + margin) return false;
  }
  return true;
};
A.dogInPath = function (c, x, z, h) { if (P.mode !== 'walk' && P.mode !== 'hug') return false; return Math.abs(P.y - W.terrainH(x, z)) < c.bodyHeight && W.overlaps({ t: 3, x, z, heading: h, hx: c.hx, hz: c.hz, ox: c.ox, oz: c.oz }, P.x, P.z, .9); };
// Re-home only behind the camera, with a full clear hull and a valid graph route.
A.wayDirector = function () {
  if (!A.roadGraph) return;
  let close = 0, far = null;
  for (const c of A.cars) if (c.kind === 'waymo' && c.mode === 'auto') {
    const d = Math.hypot(c.x - P.x, c.z - P.z); if (d < 90) close++; if (d > 330) far = c;
  }
  if (close >= 3 || !far) return;
  A.rehomeTraffic(far, true);
};
A.placeVehicle = function (c, dt) { placeVehicle(c.g, c.x, c.z, c.heading, c.hz * 2); c.wheels.forEach(w => w.rotation.x += c.speed * dt / .8); c.spin.forEach(s => s.rotation.y += dt * 10); };
function buildTraffic() {
  const civ = ['#e2572f', '#2fb6c7', '#ffd23f', '#7a5cff', '#f4f1ea', '#2d2f36', '#ff6fa1', '#4f9a45', '#1f6fd1', '#c0392b'];
  const CORE = [0, 20, 330];   // a share of the traffic stays downtown, the rest spreads over the whole grid
  for (let i = 0; i < 18; i++) { const c = makeCar('waymo'); A.cars.push(Object.assign(c, { kind: 'waymo', loop: randomLoop(i < 6 ? CORE : null), s: U.rand(0, 400), v: 9, max: U.rand(8.5, 10.5), mode: 'auto', x: 0, z: 0, heading: 0, speed: 0, yieldT: 0 })); }
  for (let i = 0; i < 34; i++) { const k = U.pick(['sedan', 'hatch', 'pickup', 'sedan']); const c = makeCar(k, U.pick(civ)); A.cars.push(Object.assign(c, { kind: k, loop: randomLoop(i < 12 ? CORE : null), s: U.rand(0, 400), v: 10, max: U.rand(9, 13), mode: 'auto', x: 0, z: 0, heading: 0, speed: 0, yieldT: 0 })); }
  for (let i = 0; i < 4; i++) { const c = makeCar('bus'); A.cars.push(Object.assign(c, { kind: 'bus', loop: i < 2 ? rectLoop(-170, 190, -80, 100) : randomLoop(), s: i * 300, v: 7, max: 7.5, mode: 'auto', x: 0, z: 0, heading: 0, speed: 0, yieldT: 0 })); }
  for (let i = 0; i < 4; i++) { const c = makeCar('foodtruck'); A.cars.push(Object.assign(c, { kind: 'foodtruck', loop: randomLoop(), s: U.rand(0, 300), v: 6, max: 7, mode: 'auto', x: 0, z: 0, heading: 0, speed: 0, yieldT: 0 })); }
  A.carGroup = new T.Group(); scene.add(A.carGroup);
  A.cars.forEach((c, id) => { c.id = id; A.carGroup.add(c.g); A.body(c); c.x = c.z = -10000 - id * 40; });
  buildRoadGraph();
  A.roadGraph.edges.forEach(e => { e.stop = e.dx > .9; });
  A.cars.forEach(c => {
    if (!A.rehomeTraffic(c, false)) throw new Error('No clear traffic spawn for ' + c.id);
    c.initialRoad = c.edge; c.initialRoadS = c.roadS;
    c.loop = { pts: [[c.x, c.z], [c.x + Math.sin(c.heading), c.z + Math.cos(c.heading)]], len: 2 }; c.s = c.initialS = 0;
  });
  // cable cars: Powell (x=-50) and California (z=-80) lines, back and forth up Nob Hill
  A.cables = [];
  const lines = [{ ax: -50, az: -190, bx: -50, bz: 130 }, { ax: -100, az: -80, bx: 120, bz: -80 }];
  lines.forEach((L, li) => { for (let k = 0; k < 2; k++) { const c = makeCar('cablecar'); A.cables.push(Object.assign(c, { line: L, t: k ? .7 : .2, dir: k ? -1 : 1, pause: 0, x: 0, z: 0, heading: 0, kind: 'cablecar', speed: 6.5, bellT: U.rand(3, 9), tag: A.tag(c.g, '', null, 5, 60) })); } });
  // F-Market streetcar
  const sc = makeCar('streetcar'); A.streetcar = Object.assign(sc, { t: .1, dir: 1, pause: 0, kind: 'streetcar', speed: 7 });
  A.cables.forEach(c => { c.pathT = c.t; A.body(c); }); A.body(A.streetcar); A.streetcar.pathT = .1; A.bodyBoss = A.body(A.boss); A.updateTraffic(0, false);
}
function carAhead(c, range, list) {
  const fx = Math.sin(c.heading), fz = Math.cos(c.heading);
  for (const e of list) { if (!e || e === c) continue; const dx = e.x - c.x, dz = e.z - c.z, f = dx * fx + dz * fz; if (f > 0 && f < range && Math.abs(-dx * fz + dz * fx) < 3.4) return true; } return false;
}
// 24-unit buckets are reused; moving a car updates its bucket immediately, so later cars see it.
A.trafficHash = new Map();
A.hashTraffic = function (c) {
  const key = Math.floor(c.x / 24) + ',' + Math.floor(c.z / 24);
  if (c._trafficKey === key) return;
  if (c._trafficKey != null) { const old = A.trafficHash.get(c._trafficKey); if (old) { const i = old.indexOf(c); if (i >= 0) old.splice(i, 1); } }
  let bucket = A.trafficHash.get(key); if (!bucket) A.trafficHash.set(key, bucket = []); bucket.push(c); c._trafficKey = key;
};
A.trafficNear = function (x, z, r, out) {
  out.length = 0;
  for (let i = Math.floor((x - r) / 24); i <= Math.floor((x + r) / 24); i++) for (let j = Math.floor((z - r) / 24); j <= Math.floor((z + r) / 24); j++) {
    const bucket = A.trafficHash.get(i + ',' + j); if (bucket) for (const c of bucket) out.push(c);
  }
  return out;
};
const ROAD_INSET = 16;
function roadPoint(e, s, out = {}) { out.x = e.a.x + e.dx * s - e.dz * 3; out.z = e.a.z + e.dz * s + e.dx * 3; out.h = e.h; return out; }
function buildRoadGraph() {
  const nodes = new Map(), edges = [], node = (x, z) => { const key = x + ',' + z; if (!nodes.has(key)) nodes.set(key, { x, z, out: [], owner: null }); return nodes.get(key); };
  for (const s of W.roadSegs || []) {
    if (s.ax === -50 && s.bx === -50 && s.az < 160 || s.az === -80 && s.bz === -80 && s.ax >= -110 && s.ax < 130) continue;
    if (s.market || s.w !== 12 || Math.hypot(s.bx - s.ax, s.bz - s.az) < 32) continue;
    const a = node(s.ax, s.az), b = node(s.bx, s.bz), len = Math.hypot(b.x - a.x, b.z - a.z);
    for (const [u, v] of [[a, b], [b, a]]) {
      const dx = (v.x - u.x) / len, dz = (v.z - u.z) / len, e = { a: u, b: v, dx, dz, len, h: Math.atan2(dx, dz), id: edges.length };
      const probe = { hx: 2.55, hz: 6.9, bodyHeight: 4.5, ox: 0, oz: 0 }; let ok = true;
      for (let d = ROAD_INSET; d <= len - ROAD_INSET; d += 1) { const q = roadPoint(e, d); if (!A.vehicleClear(probe, q.x, q.z, q.h, 'static')) { ok = false; break; } }
      if (ok) { u.out.push(e); edges.push(e); }
    }
  }
  // Remove dead ends: all remaining streets lead to a junction with a non-U-turn exit.
  let changed = true;
  while (changed) { changed = false; for (const e of edges) if (!e.closed && !e.b.out.some(o => !o.closed && o.b !== e.a)) { e.closed = true; changed = true; } }
  A.roadGraph = { nodes, edges: edges.filter(e => !e.closed) };
  A.routeNetworks=new Map();
}
function showBusStops() {
  if(A.busStopGroup) { scene.remove(A.busStopGroup); A.busStopGroup.traverse(o=>{if(o.isMesh)o.geometry.dispose();}); }
  const group=A.busStopGroup=new T.Group();scene.add(group);
  const stops=A.roadGraph.edges.filter(e=>e.stop), mat=A.stopMaterials || (A.stopMaterials=[K.toon('#248ab0'),K.toon('#e5f4eb')]);
  const poles=new T.InstancedMesh(new T.CylinderGeometry(.07,.07,3.3,5),mat[1],stops.length);
  const boards=new T.InstancedMesh(new T.BoxGeometry(1.1,.65,.12),mat[0],stops.length), dummy=new T.Object3D();
  stops.forEach((e,i)=>{
    const q=roadPoint(e,e.len-24),x=q.x-e.dz*4.8,z=q.z+e.dx*4.8,y=W.terrainH(x,z);
    dummy.position.set(x,y+1.65,z);dummy.rotation.set(0,e.h,0);dummy.updateMatrix();poles.setMatrixAt(i,dummy.matrix);
    dummy.position.y=y+3.1;dummy.updateMatrix();boards.setMatrixAt(i,dummy.matrix);
  });
  group.add(poles,boards); // two draw calls for the entire bus-stop network
}
function resumeParked(c,dt) {
  c.parkedT=(c.parkedT || 0)+dt;
  if(c.parkedT<10 || Math.hypot(c.x-P.x,c.z-P.z)<20)return;
  if(Math.hypot(c.x-P.x,c.z-P.z)>330 && Math.hypot(c.x-K.camera.position.x,c.z-K.camera.position.z)>330) {
    if(A.rehomeTraffic(c,false))c.mode='auto';return;
  }
  for(const e of A.roadGraph.edges) {
    if(Math.abs(U.angDiff(e.h,c.heading))>.3 || !trafficRoutes(c).has(e))continue;
    const s=(c.x-e.a.x)*e.dx+(c.z-e.a.z)*e.dz,q=roadPoint(e,s);
    if(s<ROAD_INSET || s>e.len-ROAD_INSET || Math.hypot(q.x-c.x,q.z-c.z)>.5 || !A.vehicleClear(c,q.x,q.z,q.h))continue;
    setRoad(c,e,s);c.mode='auto';return;
  }
}
function setRoad(c, edge, s) {
  if (c.junction && c.junction.owner === c) c.junction.owner = null;
  c.edge = edge; c.roadS = s; c.curve = null; c.junction = null; c.nextEdge = null; c.waitT = 0; c.busServed = false; c.busT = 0;
  const q = roadPoint(edge, s); c.x = q.x; c.z = q.z; c.heading = q.h; c.v = c.speed = 0; A.hashTraffic(c);
}
A.rehomeTraffic = function (c, nearby) {
  const edges = A.roadGraph.edges, fw = A._roadForward || (A._roadForward = new T.Vector3());
  if (nearby) K.camera.getWorldDirection(fw);
  for (let k = 0; k < 180; k++) {
    const e = edges[(c.id * 37 + k * 29 + (c.rehomes || 0) * 17) % edges.length], s = ROAD_INSET + 2 + ((c.id * 13 + k * 7) % Math.max(1, e.len - ROAD_INSET * 2 - 4)), q = roadPoint(e, s);
    if(!trafficRoutes(c).has(e))continue;
    const d = Math.hypot(q.x - P.x, q.z - P.z);
    if (nearby && (d < 55 || d > 110 || (q.x - K.camera.position.x) * fw.x + (q.z - K.camera.position.z) * fw.z > -15)) continue;
    if (!nearby && c.edge && (d < 330 || Math.hypot(q.x - K.camera.position.x, q.z - K.camera.position.z) < 330)) continue;
    if (!A.vehicleClear(c, q.x, q.z, q.h) || A.dogInPath(c, q.x, q.z, q.h)) continue;
    setRoad(c, e, s); c.rehomes = (c.rehomes || 0) + 1; A.placeVehicle(c, 0); return true;
  }
  return false;
};
function roadCurve(c, next) {
  const e = c.edge, p = roadPoint(e, e.len - ROAD_INSET), q = roadPoint(next, ROAD_INSET), pts = [];
  const turn=U.angDiff(next.h,e.h), control=Math.abs(turn)<.1?ROAD_INSET*2/3:ROAD_INSET;
  let len = 0, last = null;
  for (let i = 0; i <= 24; i++) {
    const t = i / 24, u = 1 - t;
    const x = u*u*u*p.x + 3*u*u*t*(p.x + e.dx*control) + 3*u*t*t*(q.x - next.dx*control) + t*t*t*q.x;
    const z = u*u*u*p.z + 3*u*u*t*(p.z + e.dz*control) + 3*u*t*t*(q.z - next.dz*control) + t*t*t*q.z;
    const dx = 3*u*u*e.dx*control + 6*u*t*(q.x-next.dx*control-p.x-e.dx*control) + 3*t*t*next.dx*control;
    const dz = 3*u*u*e.dz*control + 6*u*t*(q.z-next.dz*control-p.z-e.dz*control) + 3*t*t*next.dz*control;
    if (last) len += Math.hypot(x-last.x, z-last.z); last = { x, z, h: Math.atan2(dx,dz), s:len };
    if (!A.vehicleClear(c, x, z, last.h, 'static')) return null;
    // Keep the entire turning body on asphalt, including its middle edge (not just the four corners).
    const sn=Math.sin(last.h),cs=Math.cos(last.h);
    for(const side of [-1,1])for(let along=-c.hz;along<=c.hz;along+=1) {
      const lx=(c.ox || 0)+side*c.hx,lz=(c.oz || 0)+along;
      if(!W.onRoad(x+cs*lx+sn*lz,z-sn*lx+cs*lz,.15))return null;
    }
    const pose={t:3,x,z,heading:last.h,hx:c.hx,hz:c.hz,ox:c.ox,oz:c.oz};
    if(A.peds.some(p=>p.still && !p.lifeDriven && W.overlaps(pose,p.x,p.z,.85)))return null;
    pts.push(last);
  }
  return { pts, len, s: 0, next };
}
function curvePoint(curve, s, out) {
  const pts = curve.pts; for (let i=1; i<pts.length; i++) if (s <= pts[i].s || i === pts.length-1) {
    const a=pts[i-1], b=pts[i], t=U.clamp((s-a.s)/(b.s-a.s),0,1); out.x=U.lerp(a.x,b.x,t); out.z=U.lerp(a.z,b.z,t); out.h=U.lerpAng(a.h,b.h,t); return out;
  }
}
function trafficRoutes(c) {
  const key=c.kind+':'+c.hx.toFixed(2)+':'+c.hz.toFixed(2);
  const cache=A.routeNetworks || (A.routeNetworks=new Map());
  if(cache.has(key))return cache.get(key);
  const routes=new Map(), old=c.edge;
  for(const e of A.roadGraph.edges) {
    const turns=[]; c.edge=e;
    for(const next of e.b.out) if(!next.closed && next.b!==e.a) { const curve=roadCurve(c,next);if(curve)turns.push(curve); }
    if(turns.length)routes.set(e,turns);
  }
  c.edge=old;
  // Fixed point removes roads that can enter an intersection but have no legal continuation for this body.
  let changed=true;
  while(changed) { changed=false;for(const [e,turns] of routes) { const valid=turns.filter(t=>routes.has(t.next));if(!valid.length) { routes.delete(e);changed=true; } else routes.set(e,valid); } }
  cache.set(key,routes);return routes;
}
function chooseRoad(c) {
  const opts=trafficRoutes(c).get(c.edge) || [];
  if(!opts.length)return false;
  const i=(c.id+(c.turns || 0)*7+(c.reroutes || 0))%opts.length, template=opts[i];
  c.nextEdge=template.next;c.plannedCurve={pts:template.pts,len:template.len,s:0,next:template.next};return true;
}
function roadOccupant(c, list, range) {
  const sn=Math.sin(c.heading), cs=Math.cos(c.heading); let gap=range, lead=null;
  const pose=c._anticipatePose || (c._anticipatePose={});
  Object.assign(pose,{t:3,hx:c.hx,hz:c.hz,ox:c.ox,oz:c.oz});
  for (const b of list) {
    if (b===c || b===P && P.mode!=='walk' && P.mode!=='hug') continue;
    if (!b.hx) {
      if(Math.hypot(b.x-c.x,b.z-c.z)>32 || Math.abs((b.y || 0)-W.terrainH(c.x,c.z))>c.bodyHeight+1)continue;
      const limit=Math.min(24, c.curve?c.curve.len-c.curve.s:c.edge.len-ROAD_INSET-c.roadS);
      for(let d=0;d<=limit;d+=1.5) {
        const q=c._anticipatePoint || (c._anticipatePoint={});
        if(c.curve)curvePoint(c.curve,c.curve.s+d,q);else roadPoint(c.edge,c.roadS+d,q);
        pose.x=q.x;pose.z=q.z;pose.heading=q.h;
        if(W.overlaps(pose,b.x,b.z,.75)) { if(d<gap) { gap=d;lead=b; } break; }
      }
      continue;
    }
    if(c.curve && b.mode!=='parked' && b.mode!=='driven')continue;
    const dx=b.x-c.x,dz=b.z-c.z,along=dx*sn+dz*cs,lateral=Math.abs(dx*cs-dz*sn),dh=(b.heading || 0)-c.heading;
    const width=Math.abs(Math.cos(dh))*b.hx+Math.abs(Math.sin(dh))*b.hz,length=Math.abs(Math.cos(dh))*b.hz+Math.abs(Math.sin(dh))*b.hx;
    const front=along-(c.hz+Math.abs(c.oz || 0))-length;
    if(along>0 && lateral<c.hx+width+.25 && front<gap && Math.abs(W.terrainH(b.x,b.z)-W.terrainH(c.x,c.z))<c.bodyHeight+1) { gap=front;lead=b; }
  }
  const result=c._ahead || (c._ahead={});result.gap=gap;result.lead=lead;return result;
}
function planPedestrianCrossing(p) {
  // A short, collision-checked sidewalk route avoids asking a pedestrian to walk through a stopped car.
  const nearby=A.trafficNear(p.x,p.z,40,[]), parent=new Map(), queue=[[0,0]], key=(x,z)=>(x+20)*41+z+20;
  const clear=(x,z)=>!W.blockedAt(x,z,.7,W.terrainH(x,z)) && !nearby.some(b=>b.hx && b!==p && W.overlaps(b,x,z,.7));
  parent.set(key(0,0),null);let found=null;
  for(let head=0;head<queue.length && head<1681;head++) {
    const [ix,iz]=queue[head],x=p.x+ix,z=p.z+iz;
    if(head && !W.onRoad(x,z,1.3)) {found=[ix,iz];break;}
    for(const [dx,dz] of [[1,0],[-1,0],[0,1],[0,-1],[1,1],[-1,1],[1,-1],[-1,-1]]) {
      const nx=ix+dx,nz=iz+dz,k=key(nx,nz);
      if(Math.abs(nx)>20 || Math.abs(nz)>20 || parent.has(k) || !clear(p.x+nx,p.z+nz))continue;
      if(dx && dz && (!clear(p.x+nx,z) || !clear(x,p.z+nz)))continue;
      parent.set(k,[ix,iz]);queue.push([nx,nz]);
    }
  }
  if(!found)return null;
  const path=[];let at=found;
  while(at && (at[0] || at[1])) {path.push({x:p.x+at[0],z:p.z+at[1]});at=parent.get(key(at[0],at[1]));}
  path.reverse();return {path,index:0,park:!p.lifeDriven};
}
function trafficStep(c, dt, play) {
  if (!c.edge) { // Small logic fixtures without a built world keep the legacy path contract.
    const q=A.loopPos(c.loop,c.s+c.v*dt), blocked=A.dogInPath(c,q.x,q.z,q.h) || carAhead(c, c.hz+5, [P]);
    c.v=U.damp(c.v,blocked?0:c.max,blocked?8:1.4,dt);
    if (!blocked && A.vehicleClear(c,q.x,q.z,q.h)) { c.s+=c.v*dt; c.x=q.x; c.z=q.z; c.heading=q.h; } else c.v=0;
    c.speed=c.v; return;
  }
  const near=A.trafficNear(c.x,c.z,48,c._near || (c._near=[]));
  const ahead=roadOccupant(c,near,45), polite=c.kind==='waymo', brake=polite?7:9;
  let target=c.max, reason='', gap=ahead.gap;
  if (ahead.lead) { target=Math.min(target,Math.sqrt(2*brake*Math.max(0,gap-(polite?3.5:2)))); if (gap<4+c.v*(polite?1.5:1.1)) target=Math.min(target,Math.max(0,(ahead.lead.speed || 0)+(gap-4)*.65)); reason='following'; }
  c.busT=Math.max(0,(c.busT || 0)-dt);
  const remaining=c.edge.len-ROAD_INSET-c.roadS;
  if (c.kind==='bus' && !c.curve && c.edge.stop && !c.busServed) {
    const d=c.edge.len-24-c.roadS; target=Math.min(target,Math.sqrt(2*brake*Math.max(0,d)));
    if(d<.3 && c.v<.3) { c.busServed=true; c.busT=3; c.busStops=(c.busStops || 0)+1; } reason='bus stop';
  }
  if(c.busT>0) { target=0; reason='bus stop'; }
  if(!c.curve) {
    if(remaining<25 && !c.nextEdge) chooseRoad(c);
    // Every junction is an all-way stop. FIFO arrival + one reservation prevents conflicting turns.
    if(remaining<15) {
      const n=c.edge.b; c.stopT=(remaining<.3 && c.v<.2)?(c.stopT || 0)+dt:0;
      if (!n.owner && c.stopT>.45 && c.nextEdge) {
        const q=roadPoint(c.nextEdge,ROAD_INSET+c.hz+2); let open=A.vehicleClear(c,q.x,q.z,q.h);
        for(const point of c.plannedCurve.pts)if(open && !A.vehicleClear(c,point.x,point.z,point.h,'moving'))open=false;
        let first=true; for(const b of near) if(b!==c && b.edge && b.edge.b===n && b.waitT>c.waitT+.05) first=false;
        if(open && first) { n.owner=c; c.junction=n; c.curve=c.plannedCurve; c.turns=(c.turns || 0)+1; c.stopT=0; }
      }
      if(!c.curve) { target=Math.min(target,Math.sqrt(2*brake*Math.max(0,remaining))); reason='intersection'; }
    }
  } else target=Math.min(target,polite?4.5:5.5);
  // A stopped pedestrian is never a deadlock to drive through.
  if(ahead.lead && !ahead.lead.hx) {
    const ped=ahead.lead;
    // Complete stalled crossings, including culled life actors and tiny coastal patrol segments.
    // Kyoto always retains control; traffic waits until he chooses to move.
    if(ped!==P && (ped.lifeDriven || !ped.still) && (c.waitT || 0)>3 && !ped.trafficYield) {
      ped.trafficYield=planPedestrianCrossing(ped);
    }
    reason='crossing'; if(play && (c.honkT || 0)<=0 && gap<16) {
      c.honkT=5; A.say(c.tag || (c.tag=A.tag(c.g,'',null,3.4,65)),polite?'Yielding…':'Beep!',1.2,polite?'code':'shout');
    }
  }
  c.honkT=Math.max(0,(c.honkT || 0)-dt);
  const accel=target<c.v?brake:(polite?2.8:4), desired=U.clamp((target-c.v)*3,-accel,accel);
  c.accel=U.damp(c.accel || 0,desired,polite?5:9,dt); c.v=Math.max(0,Math.min(c.max,c.v+c.accel*dt));
  let distance=c.v*dt;
  if(!c.curve) distance=Math.min(distance,Math.max(0,remaining));
  if(ahead.lead) distance=Math.min(distance,Math.max(0,gap-1.2));
  const q=c._roadPose || (c._roadPose={});
  if(c.curve) curvePoint(c.curve,Math.min(c.curve.len,c.curve.s+distance),q); else roadPoint(c.edge,c.roadS+distance,q);
  let go=distance>0 && !A.dogInPath(c,q.x,q.z,q.h) && A.vehicleClear(c,q.x,q.z,q.h,'moving');
  if(go) {
    c.x=q.x; c.z=q.z; c.heading=q.h;
    if(c.curve) { c.curve.s+=distance; if(c.curve.s>=c.curve.len-.001) { c.edge=c.curve.next; c.roadS=c.curve.passEnd || ROAD_INSET; c.passing=false; c.curve=null; c.nextEdge=null; c.busServed=false; } }
    else c.roadS+=distance;
    A.hashTraffic(c);
  } else { c.v=0; c.accel=0; if(!reason) reason='obstacle'; }
  if(c.junction && !c.curve && c.roadS>ROAD_INSET+c.hz+1) { if(c.junction.owner===c)c.junction.owner=null; c.junction=null; }
  c.speed=go?distance/dt:0; c.waitReason=reason; c.lastLead=ahead.lead && {id:ahead.lead.id,kind:ahead.lead.kind,arch:ahead.lead.arch,x:ahead.lead.x,z:ahead.lead.z,gap};
  c.waitT=c.speed<.2?(c.waitT || 0)+dt:0;
  // Obstructed lane: turn before entering it; parked cars in the current lane get a checked passing path.
  if(ahead.lead && ahead.lead.mode==='parked' && !c.curve && remaining>20 && gap<18) tryPassing(c,ahead.lead);
  if(c.waitT>12 && reason!=='crossing' && reason!=='bus stop') {
    if(!c.curve && (c.retryAt || 0)<A.trafficTime) { c.deadlocks=(c.deadlocks || 0)+1; c.retryAt=A.trafficTime+2; c.reroutes=(c.reroutes || 0)+1; c.nextEdge=null; chooseRoad(c); }
    // Never teleport a visible queue. Distant blocked routes are recycled onto clear lanes.
    if(Math.hypot(c.x-P.x,c.z-P.z)>330 && Math.hypot(c.x-K.camera.position.x,c.z-K.camera.position.z)>330) A.rehomeTraffic(c,false);
  }
}
function tryPassing(c, obstacle) {
  if(c.passing || c.junction) return;
  const e=c.edge, finish=Math.min(e.len-14,c.roadS+Math.max(25,c.hz*2+obstacle.hz*2+10)); if(finish>=e.len-14)return;
  const pts=[]; let len=0, last=null;
  for(let i=0;i<=40;i++) {
    const t=i/40, q=roadPoint(e,U.lerp(c.roadS,finish,t)), offset=-5.8*Math.sin(Math.PI*t)**2;
    q.x-=e.dz*offset; q.z+=e.dx*offset; q.h=e.h-Math.atan2(-5.8*Math.PI*Math.sin(2*Math.PI*t),finish-c.roadS); // derivative of rightward offset
    if(!A.vehicleClear(c,q.x,q.z,q.h) || A.dogInPath(c,q.x,q.z,q.h))return;
    if(last)len+=Math.hypot(q.x-last.x,q.z-last.z); q.s=len; pts.push(q); last=q;
  }
  c.curve={pts,len,s:0,next:e,passEnd:finish}; c.passing=true;
}
function placeVehicle(o, x, z, heading, len) {
  const h0 = W.terrainH(x + Math.sin(heading) * len / 2, z + Math.cos(heading) * len / 2), h1 = W.terrainH(x - Math.sin(heading) * len / 2, z - Math.cos(heading) * len / 2);
  o.position.set(x, (h0 + h1) / 2, z); o.rotation.set(0, heading, 0); o.rotateX(-Math.atan2(h0 - h1, len));
}
A.updateTraffic = function (dt, play) {
  A.trafficTime=(A.trafficTime || 0)+dt;
  for (const c of A.cars) A.hashTraffic(c);
  for (const c of A.cables) A.hashTraffic(c);
  if (A.streetcar) A.hashTraffic(A.streetcar);
  if (A.boss) A.hashTraffic(A.boss);
  if (P.mode === 'walk' || P.mode === 'hug') A.hashTraffic(P);
  for (const p of A.peds) {
    if(p.trafficYield) {
      const route=p.trafficYield,goal=route.path[route.index],dx=goal.x-p.x,dz=goal.z-p.z,d=Math.hypot(dx,dz);
      if(p.lifeDriven)p.startle=Math.max(p.startle || 0,.1);
      if(d<.12) { route.index++;if(route.index===route.path.length) {if(route.park) {p.still=true;p.play('idle');}p.trafficYield=null;} }
      else {
        const x=p.x,z=p.z;W.move(p,dx/d*Math.min(d,dt*2),dz/d*Math.min(d,dt*2),.65,p.y,{dynamic:true,ignore:p});p.y=W.terrainH(p.x,p.z);
        route.blocked=Math.hypot(p.x-x,p.z-z)<.001?(route.blocked || 0)+dt:0;if(route.blocked>1)p.trafficYield=null;
        if(p.root.parent)p.place();
      }
    }
    A.hashTraffic(p);
  }
  if (play && (A.wmT = (A.wmT || 0) - dt) <= 0) { A.wmT = 2.5; if (A.wayDirector) A.wayDirector(); }
  const cam = K.camera.position, grp = A.carGroup;
  for (const c of A.cars) {
    if (c.mode === 'driven') continue;
    if(c.mode==='parked' && A.roadGraph)resumeParked(c,dt);
    if (c.mode === 'auto' && dt > 0) trafficStep(c, dt, play);
    const dc = Math.abs(c.x - cam.x) + Math.abs(c.z - cam.z);
    if (grp) { const show = dc < 330; if (show !== (c.g.parent === grp)) { if (show) grp.add(c.g); else grp.remove(c.g); } if (!show) continue; }
    A.placeVehicle(c, dt);
  }
  for (const c of A.cables) {
    const oldT = c.pathT; const L = c.line; const len = Math.hypot(L.bx - L.ax, L.bz - L.az);
    if (c.pause > 0) c.pause -= dt; else { c.pathT += c.dir * 6.5 * dt / len; if (c.pathT > 1) { c.pathT = 1; c.dir = -1; c.pause = 3; } if (c.pathT < 0) { c.pathT = 0; c.dir = 1; c.pause = 3; } }
    const nextX = U.lerp(L.ax, L.bx, c.pathT), nextZ = U.lerp(L.az, L.bz, c.pathT), nextH = Math.atan2(L.bx - L.ax, L.bz - L.az) + (c.dir < 0 ? Math.PI : 0);
    if (dt > 0 && (A.dogInPath(c, nextX, nextZ, nextH) || !A.vehicleClear(c, nextX, nextZ, nextH, false))) c.pathT = oldT;
    c.x = U.lerp(L.ax, L.bx, c.pathT); c.z = U.lerp(L.az, L.bz, c.pathT); c.heading = Math.atan2(L.bx - L.ax, L.bz - L.az) + (c.dir < 0 ? Math.PI : 0);
    placeVehicle(c.g, c.x, c.z, c.heading, 14);
    c.bellT -= dt; if (c.bellT <= 0) { c.bellT = U.rand(6, 12); if (play && Math.hypot(P.x - c.x, P.z - c.z) < 40) { K.sfx.bell(); A.say(c.tag, 'DING DING!', 1.2, 'shout'); } }
  }
  if (A.streetcar) { const s = A.streetcar, M = W.MKT, oldT = s.pathT; if (s.pause > 0) s.pause -= dt; else { s.pathT += s.dir * 7 * dt / M.len; if (s.pathT > .95) { s.pathT = .95; s.dir = -1; s.pause = 4; } if (s.pathT < .03) { s.pathT = .03; s.dir = 1; s.pause = 4; } }
    const nextX = M.a.x + M.d.x * s.pathT * M.len, nextZ = M.a.y + M.d.y * s.pathT * M.len, nextH = Math.atan2(M.d.x, M.d.y) + (s.dir < 0 ? Math.PI : 0);
    if (dt > 0 && (A.dogInPath(s, nextX, nextZ, nextH) || !A.vehicleClear(s, nextX, nextZ, nextH, false))) s.pathT = oldT;
    const d = s.pathT * M.len; s.x = M.a.x + M.d.x * d; s.z = M.a.y + M.d.y * d; s.heading = Math.atan2(M.d.x, M.d.y) + (s.dir < 0 ? Math.PI : 0); placeVehicle(s.g, s.x, s.z, s.heading, 22); }
  // manager
  const b = A.boss; if (b) {
    const near = play && P.mode !== 'car' ? Math.hypot(P.x - b.x, P.z - b.z) : 1e9;
    b.stopT = Math.max(0, b.stopT - dt); b.cool = Math.max(0, b.cool - dt);
    const block = carAhead(b, 6, [b.riding ? null : P, A.pascal].concat(A.cars));
    b.spd = U.damp(b.spd, (b.stopT > 0 || block) ? 0 : (b.fast || 12), (b.stopT > 0 || block) ? 5 : 1.2, dt);
    const nextS = b.s + b.spd * dt; let q = A.loopPos(b.loop, nextS); if (dt === 0 || ((b.riding || !A.dogInPath(b, q.x, q.z, q.h)) && A.vehicleClear(b, q.x, q.z, q.h))) b.s = nextS; else { b.spd = 0; q = A.loopPos(b.loop, b.s); } b.x = q.x; b.z = q.z; const turn = U.angDiff(q.h, b.heading); b.heading = U.lerpAng(b.heading, q.h, 1 - Math.exp(-dt * 5));
    placeVehicle(b.v, b.x, b.z, b.heading, 1.8); b.v.rotateZ(-turn * .5); b.wheels.forEach(w => w.rotation.x += b.spd * dt / .4);
    if (near < 14 && b.cool <= 0 && !b.riding) { b.cool = 11; b.stopT = 4.5; K.sfx.vespa(); A.say(b.tag, b.first ? U.pick(BOSS_LINES) : BOSS_LINES[0], 3.8); b.first = true; b.rig.once('wave', .15, () => b.rig.play('sit')); if (Math.random() < .5) { A.addTokens(2048, 'kudos'); } }
    b.rig.mixer.update(dt); A.poseRider(b);
  }
};

/* ================= PEDESTRIANS ================= */
// rig culling: far rigs leave the scene graph, off-screen ones hide, only close ones cast shadows
const FR = new T.Frustum(), FM = new T.Matrix4(), FS = new T.Sphere(new T.Vector3(), 3.4);
A.camFrustum = function () { const c = K.camera; FM.multiplyMatrices(c.projectionMatrix, c.matrixWorldInverse); FR.setFromProjectionMatrix(FM); return FR; };
function cullRig(o, root, group, x, y, z, range, shadowR) {
  const cam = K.camera.position, dx = x - cam.x, dz = z - cam.z, d2 = dx * dx + dz * dz, show = d2 < range * range;
  if (show !== (root.parent === group)) { if (show) group.add(root); else group.remove(root); }
  if (!show) return false;
  FS.center.set(x, y + 1.2, z); root.visible = FR.intersectsSphere(FS);
  const sh = d2 < shadowR * shadowR; if (sh !== o.shadowOn) { o.shadowOn = sh; root.traverse(m => { if (m.isMesh && !m.userData.ink) m.castShadow = sh; }); }
  return root.visible;
}
A.peds = [];
const SCARED = ['AAH! A very good boy!', 'Is that a golden retriever?!', 'My croissant!', 'Not the fluffy one!', "I'm calling 311!", 'Cute! TERRIFYING! Cute!', 'He barked at my startup idea!', 'Oh no, he is SO soft!'];
const HELLO = ['Hi puppy!', 'Who’s a good boy?', 'Is he lost?', 'Omg a golden!', 'Sit! …no?', 'Pascal is looking for you!', 'Nice collar!', 'Pet tax, please!'];
function buildPeds() {
  A.pedGroup = new T.Group(); scene.add(A.pedGroup);
  const segs = W.roadSegs.filter(s => !s.market && s.w === 12);
  for (let n = 0, tries = 0; n < 110 && tries < 2400; tries++) {
    const s = U.pick(segs); const vert = s.ax === s.bx; const off = (Math.random() < .5 ? -1 : 1) * 7.6; const len = Math.hypot(s.bx - s.ax, s.bz - s.az);
    const k0 = U.rand(.05, .6), k1 = Math.min(.95, k0 + U.rand(.2, .4));
    const at = k => vert ? [s.ax + off, U.lerp(s.az, s.bz, k)] : [U.lerp(s.ax, s.bx, k), s.az + off];
    let ok = true; for (let i = 0; i <= 8; i++) { const [x, z] = at(U.lerp(k0, k1, i / 8)); if (!W.inLand(x, z, 1) || W.blockedAt(x, z, .6, W.terrainH(x, z) + .1)) { ok = false; break; } } if (!ok) continue;
    const arch = U.pick(A.ARCHETYPES)(); const p = A.person(arch);
    Object.assign(p, { arch: arch.n, vert, s, off, k0, k1, k: U.rand(k0, k1), dir: Math.random() < .5 ? 1 : -1, sp: arch.n === 'runner' ? 5 : U.rand(1.3, 1.9), scared: 0, len, hiT: U.rand(0, 5) });
    p.tag = A.tag(p.root, '', null, 3.9, 55); p.play(arch.n === 'runner' ? 'run' : 'walk', 0, arch.n === 'runner' ? .8 : .9); A.peds.push(p); n++;
  }
  // stationary folks: musicians, cooks, chatting coworkers
  const spots = [[40, 32, 'musician'], [-12, 150, 'musician'], [205, -95, 'musician'], [-40, 214, 'cook'], [40, -8, 'cook'], [110, -26, 'tech'], [120, -26, 'tech'], [-130, 36, 'tourist'], [70, -206, 'tourist'], [0, -150, 'tourist'],
    [-142, 108, 'musician'], [-150, 110, 'queen'], [-82, 348, 'cook'], [44, 306, 'musician'], [-468, 228, 'grandma'], [-444, -26, 'parent'], [-716, 150, 'tourist'], [-706, 300, 'runner'], [-606, 101, 'tourist'], [-212, 84, 'tourist'], [-330, -122, 'tourist'], [-760, -22, 'local'], [226, 302, 'local'], [-140, -196, 'runner']];
  for (const [x, z, n] of spots) { const f = W.free(x, z, .7); const arch = A.ARCHETYPES.map(a => a()).find(a => a.n === n) || A.ARCHETYPES[0](); const p = A.person(arch); Object.assign(p, { arch: n, still: true, x: f[0], z: f[1], y: W.terrainH(f[0], f[1]), heading: U.rand(0, 6), scared: 0, hiT: 1 }); p.place(); p.play(n === 'musician' ? 'talk' : n === 'tech' ? 'talk' : 'idle'); p.tag = A.tag(p.root, n === 'tech' ? 'arcade.dev' : '', null, 3.9, 50); A.peds.push(p); W.addCircle(f[0], f[1], .7, p.y + 3.4); }
  A.peds.forEach(p => A.pedGroup.add(p.root));
}
A.updatePeds = function (dt, play) {
  const grp = A.pedGroup; if (grp) A.camFrustum();
  for (const p of A.peds) {
    if(p.trafficYield) { if(p.root.parent) {p.place();p.play(p.arch==='runner'?'run':'walk');p.mixer.update(dt);}continue; }
    const dP = Math.hypot(P.x - p.x, P.z - p.z);
    if (p.still) { const vis = !grp || cullRig(p, p.root, grp, p.x, p.y, p.z, 175, 55); if (vis && dP < 30 && !p.lifeDriven) p.mixer.update(dt); if (play && dP < 6 && (p.hiT -= dt) < 0) { p.hiT = 8; A.say(p.tag, p.arch === 'tech' ? U.pick(["Kyoto! Pascal's looking everywhere!", 'Your badge still works, buddy.', 'Our tools fetch anything. Except dogs.']) : U.pick(HELLO), 2.4); } continue; }
    p.scared = Math.max(0, p.scared - dt);
    const sp = p.scared > 0 ? 6 : p.sp; p.k += p.dir * sp * dt / p.len;
    if (p.k > p.k1) { p.k = p.k1; p.dir = -1; } if (p.k < p.k0) { p.k = p.k0; p.dir = 1; }
    const s = p.s; if (p.vert) { p.x = s.ax + p.off; p.z = U.lerp(s.az, s.bz, p.k); p.heading = (s.bz > s.az) === (p.dir > 0) ? 0 : Math.PI; } else { p.x = U.lerp(s.ax, s.bx, p.k); p.z = s.az + p.off; p.heading = (s.bx > s.ax) === (p.dir > 0) ? Math.PI / 2 : -Math.PI / 2; }
    p.y = W.terrainH(p.x, p.z); const vis = !grp || cullRig(p, p.root, grp, p.x, p.y, p.z, 175, 55); if (vis) p.place();
    if (vis && dP < 70) p.mixer.update(dt);
    if (p.scared <= 0 && p.curName === 'panic') p.play(p.arch === 'runner' ? 'run' : 'walk', .3);
    if (play && P.mode === 'walk') W.pushOut(P, p.x, p.z, 1.3);
    if (play && dP < 5 && p.scared <= 0 && (p.hiT -= dt) < 0) { p.hiT = 10; A.say(p.tag, U.pick(HELLO), 2.2); }
  }
};
A.scare = function (p, fromX, fromZ) { p.scared = 4; const s = p.s; if (s) p.dir = Math.sign(p.vert ? (p.z - fromZ) * (s.bz - s.az) : (p.x - fromX) * (s.bx - s.ax)) || 1; p.play('panic', .15); if (Math.random() < .6) A.say(p.tag, U.pick(SCARED), 2.2, 'shout'); };

/* ================= ANIMALS ================= */
A.birds = []; A.sealions = [];
function animalRig(name) { const G = K.assets.animals; if (!G) return null; const node = G.scene.getObjectByName(name + '_rig') || G.scene.getObjectByName(name); if (!node) return null;
  const root = T.SkeletonUtils.clone(node); K.ownMaterials(root); root.traverse(o => { if (o.isMesh) { o.frustumCulled = false; o.castShadow = true; } });
  const mixer = new T.AnimationMixer(root); const actions = {};
  G.animations.forEach(c => { if (c.tracks.length && c.tracks[0].name.startsWith(name + '_')) actions[c.name.split('|').pop()] = mixer.clipAction(c, root); });
  return { root, mixer, actions, play(n) { const a = actions[n] || Object.values(actions)[0]; if (!a) return; if (this.cur === a) return; if (this.cur) this.cur.fadeOut(.2); a.reset().fadeIn(.2).play(); this.cur = a; } };
}
// sea lions waddle around their dock spot, flop over, lift their heads and bark
function slMove(s, dt) {
  s.stT -= dt; const R = s.root;
  if (s.st === 'walk') {
    const dx = s.tx - s.x, dz = s.tz - s.z, d = Math.hypot(dx, dz);
    if (d < .12 || s.stT <= 0) { s.st = Math.random() < .35 ? 'flop' : 'idle'; s.stT = s.st === 'flop' ? 1.6 : U.rand(2.5, 7); if (s.r) s.r.play(s.st === 'flop' ? 'flop' : 'idle'); }
    else { const v = Math.min(d, dt * 1.1); s.x += dx / d * v; s.z += dz / d * v; R.rotation.y = U.lerpAng(R.rotation.y, Math.atan2(dx, dz), 1 - Math.exp(-dt * 5)); s.mv += dt * 7; }
  } else if (s.stT <= 0) {
    if (s.st === 'flop') { s.st = 'idle'; s.stT = U.rand(2, 5); if (s.r) s.r.play('idle'); }
    else { const a = U.rand(0, 6.283), r = U.rand(.6, 1.7); s.tx = s.hx + Math.cos(a) * r; s.tz = s.hz + Math.sin(a) * r * .6; s.st = 'walk'; s.stT = 4; if (s.r) s.r.play('walk'); }
  }
  const hop = s.st === 'walk' ? Math.abs(Math.sin(s.mv)) * .12 : 0; R.position.set(s.x, s.y + hop, s.z);
  const sq = s.st === 'walk' ? 1 + Math.sin(s.mv * 2) * .06 : 1 + Math.sin(performance.now() * .002 + s.hx) * .025; R.scale.y = R.scale.x * sq;
}
function buildAnimals() {
  // sea lions on the K-dock at Pier 39 + a few lazing on the promenade
  const docks = [[72, -284], [84, -286], [96, -284]];
  const P39 = K.assets.props && K.assets.props.scene.getObjectByName('k_dock');
  docks.forEach(([x, z]) => { W.addBox(x - 4, x + 4, z - 2, z + 2, .3, { step: true }); if (P39) { const d = P39.clone(true); d.position.set(x, .02, z); scene.add(d); } else { const d = new T.Mesh(new T.BoxGeometry(8, .3, 4), K.toon('#a8744c')); d.position.set(x, .15, z); scene.add(d); } });
  const G = A.animalGroup = new T.Group(); scene.add(G);
  const slSpots = [[70, -284], [74, -283.5], [82, -286], [86, -285.5], [94, -284], [98, -284.5], [-120, -205], [140, -207], [30, -207]].concat((W.sealRocks || []).slice(0, 2));   // + Seal Rocks off the Cliff House
  slSpots.forEach(([x, z, yRock], i) => {
    const r = animalRig('sealion'); let root;
    if (r) { root = r.root; r.play('idle'); } else { root = new T.Mesh(new T.SphereGeometry(1, 12, 10), K.toon('#6b4a33')); root.scale.set(.7, .55, 1.3); }
    const y = yRock != null ? yRock : W.terrainH(x, z) + (z < -270 ? .3 : 0); root.position.set(x, y, z); root.rotation.y = U.rand(0, 6); G.add(root);
    const SC = yRock != null ? 1.9 : 1.75; root.scale.multiplyScalar(SC);   // big, chunky Pier 39 sea lions
    const top = y + 1.1 * SC * .85; W.addCircle(x, z, .9 * SC * .8, top);
    A.sealions.push({ r, root, x, z, y, top, hx: x, hz: z, rad2: 3.2 * SC * SC * .7, roam: yRock == null, mv: 0, st: 'idle', stT: U.rand(1, 6), tx: x, tz: z, barkT: U.rand(3, 12), tag: A.tag(root, '', null, 2.4 * SC * .7, 60) });
  });
  // seagulls circling the waterfronts, parrots around Coit Tower, pigeons in plazas
  const spawnBird = (kind, o) => { const r = animalRig(kind); if (!r) return; G.add(r.root); r.play(o.anim || 'flap'); A.birds.push(Object.assign({ kind, r, t: U.rand(0, 100) }, o)); };
  const gull = (cx, cz) => spawnBird('seagull', { mode: 'circle', cx, cz, rad: U.rand(12, 40), h: U.rand(14, 34), w: U.rand(.25, .5) * (Math.random() < .5 ? 1 : -1), anim: 'glide' });
  for (let i = 0; i < 16; i++) gull(U.rand(-150, 240), U.rand(-260, -200));
  for (let i = 0; i < 12; i++) gull(U.rand(-820, -740), U.rand(-60, 560));   // Ocean Beach
  for (let i = 0; i < 5; i++) gull(U.rand(-440, -250), U.rand(-240, -205));   // Crissy Field
  for (let i = 0; i < 5; i++) gull(U.rand(250, 300), U.rand(270, 520));   // Dogpatch / Hunters Point
  for (let i = 0; i < 10; i++) spawnBird('parrot', { mode: 'circle', cx: 40, cz: -165, rad: U.rand(10, 22), h: U.rand(28, 40), w: U.rand(.6, .9), anim: 'flap' });
  const plazas = [[40, 10], [-45, 190], [150, -60], [0, 70], [236, -130], [-140, 22], [60, -200], [-140, 110], [-80, 350], [-470, 226], [-440, -24], [226, 300], [-330, -124], [-212, 80], [44, 300]];
  plazas.forEach(([cx, cz]) => { for (let i = 0; i < 6; i++) { const [x, z] = W.free(cx + U.rand(-8, 8), cz + U.rand(-8, 8), .4); spawnBird('pigeon', { mode: 'ground', x, z, hx: x, hz: z, state: 'peck', ft: 0, anim: 'peck', heading: U.rand(0, 6) }); } });
  for (let i = 0; i < 5; i++) { const [x, z] = W.free(U.rand(0, 60), -206, .4); spawnBird('crab', { mode: 'crab', x, z, x0: x - 6, x1: x + 6, dir: 1, anim: 'walk', heading: Math.PI / 2 }); }
  for (let i = 0; i < 5; i++) { const [x, z] = W.free(-778, U.rand(0, 560), .4); spawnBird('crab', { mode: 'crab', x, z, x0: x - 6, x1: x + 6, dir: 1, anim: 'walk', heading: Math.PI / 2 }); }
}
A.updateAnimals = function (dt, play) {
  const G = A.animalGroup; if (G) A.camFrustum();
  for (const b of A.birds) {
    b.t += dt; const r = b.r;
    if (b.mode === 'circle') { const a = b.t * b.w; const x = b.cx + Math.cos(a) * b.rad, z = b.cz + Math.sin(a) * b.rad, y = b.h + Math.sin(b.t * .7) * 2; r.root.position.set(x, y, z); r.root.rotation.set(0, Math.atan2(-Math.sin(a) * Math.sign(b.w), Math.cos(a) * Math.sign(b.w)), -.35 * Math.sign(b.w)); if (Math.random() < .002 && b.kind === 'parrot' && Math.hypot(P.x - x, P.z - z) < 50) K.sfx.squawk(); }
    else if (b.mode === 'ground') {
      const d = Math.hypot(P.x - b.x, P.z - b.z);
      if (b.state === 'peck') { r.root.position.set(b.x, W.terrainH(b.x, b.z) + .05, b.z); r.root.rotation.y = b.heading; if (play && d < (Math.abs(P.speed) > 12 ? 9 : 4.5)) { b.state = 'fly'; b.ft = 0; b.fx = (b.x - P.x) / (d || 1); b.fz = (b.z - P.z) / (d || 1); r.play('flap'); if (Math.random() < .3) K.sfx.flap(); } }
      else if (b.state === 'fly') { b.ft += dt; b.x += b.fx * 9 * dt; b.z += b.fz * 9 * dt; const y = W.terrainH(b.x, b.z) + Math.min(14, b.ft * 9); r.root.position.set(b.x, y, b.z); r.root.rotation.y = Math.atan2(b.fx, b.fz); if (b.ft > 3.5) { b.state = 'return'; } }
      else if (b.state === 'return') { const dx = b.hx - b.x, dz = b.hz - b.z, l = Math.hypot(dx, dz); if (l < .6) { b.state = 'peck'; b.x = b.hx; b.z = b.hz; r.play('peck'); } else { b.x += dx / l * 7 * dt; b.z += dz / l * 7 * dt; r.root.position.set(b.x, W.terrainH(b.x, b.z) + Math.min(8, l * .5), b.z); r.root.rotation.y = Math.atan2(dx, dz); } }
    } else if (b.mode === 'crab') { b.x += b.dir * .8 * dt; if (b.x > b.x1 || b.x < b.x0) b.dir *= -1; r.root.position.set(b.x, W.terrainH(b.x, b.z), b.z); r.root.rotation.y = b.heading; }
    const rp = r.root.position; if (!G || cullRig(b, r.root, G, rp.x, rp.y - 1, rp.z, 150, 30)) r.mixer.update(dt);
  }
  for (const s of A.sealions) if (s.roam && Math.hypot(P.x - s.x, P.z - s.z) < 110) slMove(s, dt);
  for (const s of A.sealions) { const vis = !G || cullRig(s, s.root, G, s.x, s.y, s.z, 150, 40); if (vis && s.r && Math.hypot(P.x - s.x, P.z - s.z) < 80) s.r.mixer.update(dt); if (s.idleT > 0) { s.idleT -= dt; if (s.idleT <= 0 && s.r) s.r.play('idle'); } s.barkT -= dt; if (s.barkT <= 0) { s.barkT = U.rand(7, 16); if (Math.hypot(P.x - s.x, P.z - s.z) < 30) { A.say(s.tag, U.pick(['ARF!', 'ARF ARF!', '*flop*']), 1.4, 'shout'); if (s.r) { s.r.play('bark'); s.idleT = .9; } if (Math.hypot(P.x - s.x, P.z - s.z) < 30) K.sfx.arf(); } } }
};

/* ================= PICKUPS ================= */
A.items = []; A.letters = [];
const tokenMat = K.toon('#3fe0e8', { emissive: new T.Color('#0b7f95') });
function propGeo(name) { const k = W.kitParts(K.assets.props, name); return k; }
function buildPickups() {
  // tokens (instanced)
  const tk = propGeo('token'); let tg = tk && tk.parts[0] ? tk.parts[0].geo : new T.CylinderGeometry(.55, .55, .14, 6).rotateX(Math.PI / 2);
  const MAX = 640; A.tokenIM = new T.InstancedMesh(tg, tokenMat, MAX); A.tokenIM.frustumCulled = false; A.tokenIM.count = 0; A.tokenIM.instanceMatrix.setUsage(T.DynamicDrawUsage); A.tokenIM.castShadow = false; scene.add(A.tokenIM); A.tokenFree = []; A.tokenN = 0;
  for (let i = 0; i < 480; i++) { const [x, z] = W.randomRoadPoint(); A.addToken(x, z); }
  const food = [['beer', 24], ['pretzel', 16], ['burrito', 16], ['bone', 20]];
  for (const [kind, n] of food) for (let i = 0; i < n; i++) {
    const [x, z] = W.randomRoadPoint(); const k = propGeo(kind); let m;
    if (k) { m = new T.Group(); k.parts.forEach(p => { const mesh = new T.Mesh(p.geo, p.mat); mesh.castShadow = true; m.add(mesh); }); }
    else m = new T.Mesh(new T.SphereGeometry(.4, 10, 8), K.toon(kind === 'beer' ? '#f0a830' : '#a8622b'));
    m.scale.setScalar(1.3); scene.add(m); A.items.push({ kind, mesh: m, x, z, y: W.terrainH(x, z) + 1.3, active: true, respawn: 0, ph: Math.random() * 6 });
  }
  // letters K Y O T O
  const spots = [
    ['K', 40 + 7, -165 + 7, null], ['Y', -230, -338, W.bridgeH(-338) + 2.6], ['O', 84, -283, 7.2], ['T', W.mound[0], W.mound[1], 2.8], ['O', -150, 214, W.terrainH(-150, 214) + 2.6],
  ];
  const UI = K.assets.ui3d;
  const bcv = document.createElement('canvas'); bcv.width = 4; bcv.height = 128; const bg2 = bcv.getContext('2d'); const bgr = bg2.createLinearGradient(0, 128, 0, 0);
  bgr.addColorStop(0, '#ffffff'); bgr.addColorStop(.25, '#8a8a8a'); bgr.addColorStop(.7, '#1c1c1c'); bgr.addColorStop(1, '#000000'); bg2.fillStyle = bgr; bg2.fillRect(0, 0, 4, 128);
  const beamMat = new T.MeshBasicMaterial({ color: '#ffd35a', transparent: true, opacity: .32, alphaMap: new T.CanvasTexture(bcv), depthWrite: false, fog: false, side: T.DoubleSide, blending: T.AdditiveBlending });   // bright at the letter, fading into the sky
  spots.forEach(([ch, x, z, y], i) => {
    const g = new T.Group();
    const src = UI && UI.scene.getObjectByName('L_' + ch), ink = UI && UI.scene.getObjectByName('L_' + ch + '_ink');
    if (src) { const a = src.clone(); a.position.set(0, 0, 0); g.add(a); g.traverse(o => { if (o.isMesh) o.castShadow = true; }); K.inkShell(g, .09); g.scale.setScalar(.9); }
    else g.add(new T.Mesh(new T.TorusGeometry(1, .3, 8, 20), K.toon('#ffc93c')));
    const yy = y != null ? y : W.terrainH(x, z) + 2.6; g.position.set(x, yy, z); scene.add(g);
    const beam = new T.Mesh(new T.CylinderGeometry(1.1, 1.1, 260, 12, 1, true), beamMat); beam.position.set(x, yy + 130, z); scene.add(beam);
    A.letters.push({ ch, i, g, beam, x, z, y: yy, got: false });
  });
}
A.addToken = function (x, z, temp, y) {
  const idx = A.tokenFree.length ? A.tokenFree.pop() : (A.tokenN < 640 ? A.tokenN++ : -1); if (idx < 0) return;
  A.tokenIM.count = A.tokenN; A.items.push({ kind: 'token', idx, x, z, y: (y != null ? y : W.terrainH(x, z)) + 1.3, active: true, respawn: 0, temp: !!temp, life: temp ? 25 : 0, val: U.pick([256, 512, 1024, 1024, 2048, 4096]), ph: Math.random() * 6 });
};

/* ================= AGENTS (Pascal's drones) ================= */
A.agents = [];
function makeDrone() {
  const g = new T.Group();
  const white = K.toon('#f7f8fb'), grey = K.toon('#aab4c4'), visor = K.toon('#141a2a');
  const body = new T.Mesh(new T.SphereGeometry(.62, 20, 16), white); body.scale.set(1.05, .92, .95); body.castShadow = true; g.add(body);
  const vis = new T.Mesh(new T.SphereGeometry(.5, 20, 14, -Math.PI * .42, Math.PI * .84, Math.PI * .28, Math.PI * .42), visor); vis.position.z = .1; vis.scale.set(1.08, 1, 1.02); g.add(vis);
  const eye = new T.MeshBasicMaterial({ color: '#7ee8ff' });
  const eyes = [];
  for (const s of [-1, 1]) { const e = new T.Mesh(new T.TorusGeometry(.085, .028, 6, 14, Math.PI), eye); e.position.set(s * .17, .06, .6); e.rotation.z = 0; g.add(e); eyes.push(e); }
  for (const s of [-1, 1]) { const ear = new T.Mesh(new T.CylinderGeometry(.13, .13, .12, 14), grey); ear.rotation.z = Math.PI / 2; ear.position.set(s * .66, 0, 0); g.add(ear); }
  const mast = new T.Mesh(new T.CylinderGeometry(.03, .03, .35, 6), grey); mast.position.y = .7; g.add(mast);
  const rotors = [];
  const r = new T.Mesh(new T.BoxGeometry(1.5, .03, .14), grey); r.position.y = .88; g.add(r); rotors.push(r);
  const r2 = r.clone(); r2.rotation.y = Math.PI / 2; r.add(r2);
  K.inkShell(g, .035);
  return { g, rotors, eye, eyes };
}
A.makeDrone = makeDrone;
A.spawnAgent = function () { const d = makeDrone(); scene.add(d.g); const pz = A.pascal; const a = Object.assign(d, { pos: new T.Vector3(pz.x, pz.y + 4.5, pz.z), vel: new T.Vector3(U.rand(-3, 3), 4, U.rand(-3, 3)), life: 18, hacked: false, clar: 0, surge: 0, surgeT: 3, warn: 0 }); a.tag = A.tag(d.g, 'agent', 'agent', 1.3, 70); A.say(a.tag, U.pick(['tool_call: find_dog()', 'scope: dog.locate', 'GET /kyoto → 200', 'await gentle_retrieval()']), 2.2, 'code'); A.agents.push(a); };
A.killAgent = function (a) { const i = A.agents.indexOf(a); if (i < 0) return; scene.remove(a.g); A.untag(a.tag); const geos = new Set(); a.g.traverse(o => { if (o.geometry) geos.add(o.geometry); }); geos.forEach(g => g.dispose()); a.eye.dispose(); A.agents.splice(i, 1); };

/* ================= SAM & DARIO, DEALER ================= */
A.DEBATES = [
  [['S', 'We should ship AGI by Friday.'], ['D', 'Have we red-teamed Friday?']],
  [['D', "We're pacing the frontier."], ['S', "I'm pacing the frontier. Also my living room."]],
  [['S', 'Compute is all you need.'], ['D', 'A constitution is all you need.']],
  [['S', 'Just raised a few more trillion.'], ['D', 'Cool. I wrote a 15,000-word essay.']],
  [['D', 'Race to the top!'], ['S', 'Race? Hold my GPUs.']],
  [['S', 'feel the AGI'], ['D', 'feel the Responsible Scaling Policy']],
  [['S', 'Scaling laws never lie.'], ['D', 'Interpretability says they have 3 hidden features.']],
  [['D', 'Machines of Loving Grace.'], ['S', 'machines of loving grace (lowercase)']],
  [['S', 'What if we just… made it bigger?'], ['D', 'What if we just… made it kinder?']],
  [['S', 'My agents book flights.'], ['D', "My agents ask if you're sure about the flight."]],
  [['S', 'Context window: infinite.'], ['D', 'Context window: responsibly large.']],
];
function buildCameos() {
  A.sam = A.person({ acc: ['acc_hair_short'], shirt: '#8a8f98', pants: '#3b4a66', hair: '#4a3526', skin: '#f1c9ad' }); A.sam.root.visible = false; A.sam.tag = A.tag(A.sam.root, 'Sam', 'cameo', 3.9, 90);
  A.dario = A.person({ acc: ['acc_hair_curlysmall', 'acc_glasses'], shirt: '#5a7fb0', pants: '#8c7b5f', hair: '#2a2320', skin: '#e8c0a0', lens: '#1c1f24' }); A.dario.root.visible = false; A.dario.tag = A.tag(A.dario.root, 'Dario', 'cameo', 3.9, 90);
  const al = W.alley || { x: -34, z: 10 };
  const d = A.person({ legacy: true, acc: ['acc_coat', 'acc_fedora', 'acc_shades'], coat: '#5b4636', pants: '#2a2a2e', hat: '#3b2e25', skin: '#d9a882', lens: '#0b0c0f' });
  const [dx, dz] = W.free(al.x, al.z, .8); Object.assign(d, { x: dx, z: dz, y: W.terrainH(dx, dz), heading: al.face || -Math.PI / 2, greeted: 0 }); d.place(); d.play('idle');
  d.tag = A.tag(d.root, '???', 'dealer', 3.9, 40); W.addCircle(dx, dz, .7, d.y + 3.6); A.dealer = d; d.face0 = d.heading;
  // the coat opens on MCP cartridges when a customer comes close
  const lab = K.canvasTex(64, 32, g2 => { g2.fillStyle = '#111018'; g2.fillRect(0, 0, 64, 32); g2.fillStyle = '#fff'; g2.font = 'bold 20px sans-serif'; g2.textAlign = 'center'; g2.fillText('MCP', 32, 23); });
  d.merch = new T.Group(); d.merch.visible = false;
  [['#2ef2e0', -.34, 2.55], ['#ff4fd8', -.34, 2.22], ['#b6ff3b', -.34, 1.89], ['#ffb02e', .34, 2.55], ['#9d7bff', .34, 2.22], ['#2ef2e0', .34, 1.89]].forEach(([c, x, y], i) => {
    const m = new T.Mesh(new T.BoxGeometry(.2, .26, .05), [K.toon(c), K.toon(c), K.toon(c), K.toon(c), new T.MeshBasicMaterial({ map: lab, color: c }), K.toon(c)]);
    m.position.set(x * 1.18, y, .42); m.rotation.y = x > 0 ? .5 : -.5; d.merch.add(m); });
  const glow = new T.Mesh(new T.PlaneGeometry(1.3, 1.1), new T.MeshBasicMaterial({ color: '#7af7ff', transparent: true, opacity: .18, blending: T.AdditiveBlending, depthWrite: false })); glow.position.set(0, 2.22, .5); d.merch.add(glow);
  d.root.add(d.merch);
}

/* ================= LEASH: thin teal tube, sagging span or verlet dangle ================= */
const rt = new T.Vector3(), rn = new T.Vector3(), rb = new T.Vector3(), rd = new T.Vector3(), UPV = new T.Vector3(0, 1, 0), COLLAR = new T.Vector3(0, .26, -.34);
A.rope = function (n, rad, seg) {
  const rs = 6, idx = []; for (let i = 0; i < n; i++) for (let j = 0; j < rs; j++) { const a = i * rs + j, b = i * rs + (j + 1) % rs; idx.push(a, a + rs, b, b, a + rs, b + rs); }
  const g = new T.BufferGeometry(); g.setAttribute('position', new T.BufferAttribute(new Float32Array((n + 1) * rs * 3), 3)); g.setIndex(idx);
  const mat = new T.MeshToonMaterial({ color: '#29d3c8', gradientMap: K.grad3, transparent: true, emissive: new T.Color('#0a3a38') });
  const m = new T.Mesh(g, mat); m.frustumCulled = false; m.castShadow = true; m.visible = false; scene.add(m);
  const pts = [], old = []; for (let i = 0; i <= n; i++) { pts.push(new T.Vector3()); old.push(new T.Vector3()); }
  return { m, g, mat, n, rs, rad, pts, old, seg: seg || .15 };
};
A.ropeSpan = function (r, a, b, len, jig) {   // hand → collar, parabolic sag while slack, straight (and humming) when taut
  const d = a.distanceTo(b), sag = Math.sqrt(Math.max(0, len * len - d * d)) * .5;
  for (let i = 0; i <= r.n; i++) { const t = i / r.n, p = r.pts[i]; p.lerpVectors(a, b, t); p.y -= sag * 4 * t * (1 - t) - (jig || 0) * Math.sin(t * Math.PI) * Math.sin(performance.now() * .09); const gy = W.groundAt(p.x, p.z, p.y + .4, .05) + .04; if (p.y < gy) p.y = gy; r.old[i].copy(p); }
};
A.ropeSim = function (r, anchor, dt, body) {   // verlet chain hanging from anchor; body = [[center, radius]] spheres to drape over
  const P = r.pts, O = r.old, gdt = 42 * dt * dt; P[0].copy(anchor); O[0].copy(anchor);
  if (P[r.n].distanceToSquared(anchor) > r.n * r.n * r.seg * r.seg * 9) for (let i = 1; i <= r.n; i++) { P[i].set(anchor.x, anchor.y - i * r.seg, anchor.z); O[i].copy(P[i]); }   // teleported: re-hang
  for (let i = 1; i <= r.n; i++) { const p = P[i], o = O[i], vx = (p.x - o.x) * .96, vy = (p.y - o.y) * .96, vz = (p.z - o.z) * .96; o.copy(p); p.x += vx; p.y += vy - gdt; p.z += vz; }
  for (let k = 0; k < 6; k++) {
    for (let i = 1; i <= r.n; i++) { const a = P[i - 1], b = P[i]; rd.subVectors(b, a); const l = rd.length() || 1e-6, f = (l - r.seg) / l; if (i === 1) b.addScaledVector(rd, -f); else { a.addScaledVector(rd, f * .5); b.addScaledVector(rd, -f * .5); } }
    if (body) for (let i = 2; i <= r.n; i++) for (const [c, rad] of body) { rd.subVectors(P[i], c); const l = rd.length(); if (l < rad && l > 1e-6) P[i].addScaledVector(rd, (rad - l) / l); }
  }
  for (let i = 1; i <= r.n; i++) { const p = P[i], gy = W.groundAt(p.x, p.z, p.y + .4, .05) + .04; if (p.y < gy) { p.y = gy; O[i].x = U.lerp(O[i].x, p.x, .4); O[i].z = U.lerp(O[i].z, p.z, .4); } }
};
A.ropeDraw = function (r) {
  const p = r.g.attributes.position.array, P = r.pts, n = r.n;
  for (let i = 0; i <= n; i++) {
    rt.subVectors(P[Math.min(n, i + 1)], P[Math.max(0, i - 1)]); if (rt.lengthSq() < 1e-10) rt.set(0, 0, 1); rt.normalize();
    rn.crossVectors(rt, UPV); if (rn.lengthSq() < 1e-4) rn.set(1, 0, 0); rn.normalize(); rb.crossVectors(rt, rn);
    for (let j = 0; j < r.rs; j++) { const a = j / r.rs * Math.PI * 2, c = Math.cos(a) * r.rad, s = Math.sin(a) * r.rad, k = (i * r.rs + j) * 3;
      p[k] = P[i].x + rn.x * c + rb.x * s; p[k + 1] = P[i].y + rn.y * c + rb.y * s; p[k + 2] = P[i].z + rn.z * c + rb.z * s; }
  }
  r.g.attributes.position.needsUpdate = true; r.g.computeVertexNormals();
};
A.collarPos = out => {
  const k = A.kyoto; if (k.collarPt === undefined) k.collarPt = k.root.getObjectByName('collar_pt') || null;
  if (k.collarPt) { k.collarPt.updateWorldMatrix(true, false); return k.collarPt.getWorldPosition(out); }
  const nb = k.neck; nb.updateWorldMatrix(true, false); return out.copy(COLLAR).applyMatrix4(nb.matrixWorld); };
A.handPos = out => { const hb = A.pascal.hand; hb.updateWorldMatrix(true, false); return out.setFromMatrixPosition(hb.matrixWorld); };
function buildLeash() { A.leash = { main: A.rope(18, .045), kp: A.rope(8, .052, .17), pp: A.rope(9, .045, .17) }; }

/* ================= PHOTO SPOTS: Kyoto's SF album ================= */
A.PHOTOS = [
  ['goldengate', 'GOLDEN GATE', -206, -207.5], ['paintedladies', 'PAINTED LADIES', -142, 9, null, 3.2], ['lombard', 'LOMBARD ST', -80.5, -144.5], ['coit', 'COIT TOWER', 40, -181.5, null, 3],
  ['ferry', 'FERRY BUILDING', 227, -103], ['pier39', 'PIER 39', 77, -276], ['oraclepark', 'ORACLE PARK', 176, 113], ['palace', 'PALACE OF FINE ARTS', -186, -158, null, 3],
  ['transamerica', 'TRANSAMERICA', 95, -92], ['chinatown', 'CHINATOWN GATE', 10, -41], ['twinpeaks', 'TWIN PEAKS', -139, 205, null, 3], ['dolores', 'DOLORES PARK', -55, 202, null, 3.2],
  ['cablecar', 'CABLE CAR', -41, 124], ['missionrock', 'MISSION ROCK', 229.4, 205.3, 3.6], ['office', 'ARCADE.DEV HQ', 122, -22],
];
A.photos = []; A.photoURL = {};
// Static photo set: Alcatraz has a PNG only; load photos lazily when shown.
A.photoSrc = id => A.photoURL[id] || (id === 'alcatraz' ? 'photos/p_alcatraz.png' : 'photos/web/p_' + id + '.jpg');
function cameraIcon() {
  const g = new T.Group(); const add = (geo, m, x, y, z, rx, name) => { const o = new T.Mesh(geo, m); o.position.set(x, y, z); if (rx) o.rotation.x = rx; if (name) o.name = name; o.castShadow = true; g.add(o); return o; };
  add(new T.BoxGeometry(1.6, 1.04, .72), K.toon('#ff4fa3'), 0, 0, 0);
  add(new T.BoxGeometry(1.64, .34, .76), K.toon('#241634'), 0, -.2, 0);
  add(new T.BoxGeometry(.66, .32, .52), K.toon('#fff4de'), -.12, .66, 0);
  add(new T.CylinderGeometry(.44, .48, .34, 20), K.toon('#241634'), 0, -.02, .5, Math.PI / 2);
  add(new T.CylinderGeometry(.31, .31, .38, 20), K.toon('#29d3c8', { emissive: new T.Color('#0a4f55') }), 0, -.02, .52, Math.PI / 2);
  add(new T.SphereGeometry(.085, 8, 6), K.toon('#ffffff', { emissive: new T.Color('#ffffff') }), -.12, .1, .72);
  add(new T.BoxGeometry(.36, .22, .1), K.toon('#ffcf3f'), .5, .3, .38, 0, 'flash');
  add(new T.CylinderGeometry(.11, .11, .14, 12), K.toon('#ff4a4a'), .5, .58, 0);
  K.inkShell(g, .045); return g;
}
function checkIcon() {
  const g = new T.Group(), m = K.toon('#29d3c8', { emissive: new T.Color('#0b4f4a') });
  for (const [x, y, len, rz] of [[-.28, -.07, .74, .66], [.2, .13, 1.16, -.615]]) { const b = new T.Mesh(new T.BoxGeometry(.3, len, .3), m); b.position.set(x, y, 0); b.rotation.z = rz; b.castShadow = true; g.add(b); }
  K.inkShell(g, .05); return g;
}
function groundRing(x, z, y0, r0, r1, seg) {
  const pos = [], idx = [];
  for (let i = 0; i <= seg; i++) { const a = i / seg * Math.PI * 2, c = Math.cos(a), s = Math.sin(a); for (const r of [r0, r1]) pos.push(c * r, W.groundAt(x + c * r, z + s * r, y0 + .6, .05) - y0 + .09, s * r); }
  for (let i = 0; i < seg; i++) { const a = i * 2; idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); }
  const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); g.setIndex(idx); return g;
}
A.buildPhotos = function () {
  const root = A.photoRoot = new T.Group(); root.visible = false; scene.add(root);
  const cam = cameraIcon(), chk = checkIcon(), progMat = new T.MeshBasicMaterial({ color: '#ffffff', side: T.DoubleSide, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -3 });
  const glowTex = K.canvasTex(4, 64, (c, w, h) => { const gr = c.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, 'rgba(255,255,255,0)'); gr.addColorStop(1, 'rgba(255,255,255,1)'); c.fillStyle = gr; c.fillRect(0, 0, w, h); });
  const glowGeo = new T.CylinderGeometry(2.35, 2.35, 2.6, 28, 1, true);
  A.PHOTOS.forEach(([id, label, x0, z0, yFix, clear]) => {
    const [x, z] = yFix != null ? [x0, z0] : W.free(x0, z0, clear || 1.5), y = yFix != null ? yFix : W.groundAt(x, z, W.terrainH(x, z) + .5, .3);
    const g = new T.Group(); g.position.set(x, y, z); root.add(g);
    const icon = cam.clone(true); icon.position.y = 3.1; g.add(icon);
    const fl = icon.getObjectByName('flash'); fl.material = new T.MeshToonMaterial({ color: '#ffcf3f', gradientMap: K.grad3, emissive: new T.Color(0) });
    const check = chk.clone(true); check.position.y = 1.5; check.visible = false; g.add(check);
    const ring = new T.Mesh(groundRing(x, z, y, 2.2, 2.62, 48), new T.MeshBasicMaterial({ color: '#ffcf3f', transparent: true, side: T.DoubleSide, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 })); g.add(ring);
    const prog = new T.Mesh(groundRing(x, z, y, 1.74, 2.1, 48), progMat); prog.geometry.setDrawRange(0, 0); g.add(prog);
    const glow = new T.Mesh(glowGeo, new T.MeshBasicMaterial({ color: '#ff4fa3', map: glowTex, transparent: true, opacity: .3, depthWrite: false, blending: T.AdditiveBlending, side: T.DoubleSide })); glow.position.y = 1.3; g.add(glow);
    A.photos.push({ id, label, x, y, z, g, icon, fl, check, ring, prog, glow, got: false, hold: 0, popT: 0, ph: Math.random() * 6 });
  });
};
A.resetPhotos = function () { for (const s of A.photos) { Object.assign(s, { got: false, hold: 0, popT: 0 }); s.icon.visible = s.glow.visible = true; s.icon.scale.setScalar(1); s.check.visible = false; s.ring.material.color.set('#ffcf3f'); } };
A.collectPhoto = function (s) { s.got = true; s.popT = .5; s.hold = 0; s.glow.visible = false; s.prog.geometry.setDrawRange(0, 0); s.ring.material.color.set('#29d3c8'); };
A.updatePhotos = function (dt, t, cam) {
  for (const s of A.photos) {
    if (s.popT > 0) { s.popT = Math.max(0, s.popT - dt); const k = 1 - s.popT / .5; s.icon.scale.setScalar(k < .3 ? 1 + k * 1.4 : Math.max(.001, 1.42 * (1 - (k - .3) / .7))); s.icon.rotation.y += dt * 14;
      if (s.popT <= 0) { s.icon.visible = false; s.check.visible = true; s.check.scale.setScalar(.01); } continue; }
    if (!s.got) {
      const b = t * 2.1 + s.ph, dx = cam.x - s.x, dz = cam.z - s.z, near = Math.abs(dx) + Math.abs(dz) < 260 && dx * dx + dz * dz + (cam.y - s.y - 3.1) ** 2 > 10; s.icon.visible = near;   // hide far away and when it would fill the lens
      if (near) { s.icon.position.y = 3.1 + Math.sin(b) * .22; s.icon.rotation.set(0, Math.atan2(cam.x - s.x, cam.z - s.z) + Math.sin(b * .7) * .4, Math.sin(b * .9) * .08); s.icon.scale.setScalar(1 + s.hold * .25); }
      const blink = (t + s.ph) % 2.2 < .12 || s.hold > .6 && (t * 8) % 1 < .5; s.fl.material.emissive.setRGB(blink ? 1 : 0, blink ? .95 : 0, blink ? .75 : 0);
      s.ring.material.opacity = .7 + Math.sin(t * 4 + s.ph) * .2; s.glow.material.opacity = .26 + Math.sin(t * 3 + s.ph) * .07 + s.hold * .3;
      s.prog.geometry.setDrawRange(0, Math.floor(U.clamp(s.hold, 0, 1) * 48) * 6);
    } else { s.ring.material.opacity = .35; s.check.scale.setScalar(U.damp(s.check.scale.x, 1, 9, dt)); s.check.rotation.y += dt * 1.5; s.check.position.y = 1.5 + Math.sin(t * 2 + s.ph) * .12; }
  }
};

/* ================= BUILD ================= */
A.build = function () { buildTextures(); buildKyoto(); buildPascal(); buildBoss(); buildTraffic(); buildPeds(); buildAnimals(); buildPickups(); buildCameos(); buildLeash(); };
// Fixed camera and representative six-person draw-call sample for before/after review.
K.scenes = K.scenes || {};
K.scenes.npcs = h => {
  h.play(); h.go(40, 4); h.pz.wait = 1e6;
  const sample = A.peds.slice(0, 6);
  sample.forEach((p, i) => { p.still = true; p.x = 35 + i * 2; p.z = 1; p.y = W.terrainH(p.x, p.z); p.heading = .2; p.place(); p.play(i % 3 === 0 ? 'wave' : 'walk'); });
  h.st(4); const y = W.terrainH(40, 1);
  K.sceneCam = { noClip: true, pos: new T.Vector3(45, y + 6, 16), look: new T.Vector3(40, y + 1.8, 1) }; h.st(1);
  const probe = new T.Scene(); probe.add(new T.AmbientLight(0xffffff, 1));
  const parents = sample.map(p => p.root.parent); sample.forEach(p => { probe.add(p.root); p.root.visible = true; });
  K.renderer.render(probe, K.camera);
  A.npcPerf = { calls: K.renderer.info.render.calls, triangles: K.renderer.info.render.triangles, geometries: K.renderer.info.memory.geometries, sample: sample.length, models: sample.map(p => p.sourceModel || 'legacy') };
  sample.forEach((p, i) => parents[i].add(p.root)); K.renderer.render(K.scene, K.camera);
  A.npcPerf.sceneCalls = K.renderer.info.render.calls; A.npcPerf.sceneTriangles = K.renderer.info.render.triangles;
  console.warn('NPC_PERF ' + JSON.stringify(A.npcPerf));
};
K.scenes.npc_check = h => {
  h.play(); h.go(40, 4); h.pz.wait = 1e6; h.st(2);
  const results = [], check = (ok, name) => { if (!ok) throw new Error('NPC CHECK: ' + name); results.push(name); };
  check(npcModels.length >= 13, '13 local animated CC0 model variants loaded');
  check(!A.boss.rig.sourceModel && !A.dealer.sourceModel, 'manager and dealer retain legacy rigs');
  const sample = [], names = ['casual_character', 'worker', 'human_man', 'woman_casual', 'woman_in_dress', 'skateboarder'];
  const probe = new T.Scene(); probe.add(new T.AmbientLight(0xffffff, 1));
  const y = W.terrainH(40, 1); K.sceneCam = { noClip: true, pos: new T.Vector3(43, y + 6, 17), look: new T.Vector3(40, y + 1.7, 1) }; h.st(1);
  function six(legacy) {
    names.forEach((name, i) => { const p = A.person({ model: name, legacy, acc: ['acc_hair_short', 'acc_cap'], shirt: '#42aabd', pants: '#35455b' }); p.x = 35 + i * 2; p.y = y; p.z = 1; p.place(); p.play('walk', 0); p.mixer.update(.25); probe.add(p.root); sample.push(p); });
    K.renderer.render(probe, K.camera);
    const info = { calls: K.renderer.info.render.calls, triangles: K.renderer.info.render.triangles };
    sample.splice(0).forEach(p => { probe.remove(p.root); p.mixer.stopAllAction(); }); return info;
  }
  const before = six(true), after = six(false); check(after.calls < before.calls, 'six equivalent people reduce draw calls');
  for (const model of npcModels) {
    const p = A.person({ model: model.name });
    for (const action of ['idle', 'walk', 'run', 'wave', 'sit', 'skate', 'panic']) { p.play(action, 0); p.mixer.update(.1); check(!!p.cur && !/death|punch|sword|gun/i.test(p.cur.getClip().name), model.name + ' safe ' + action); }
    check(p.sourceModel === model.name, model.name + ' factory selects model');
    A.scare(p, -1, -1); check(p.curName === 'panic' && p.scared === 4, model.name + ' bark maps to run');
    scene.remove(p.root); p.mixer.stopAllAction();
  }
  const far = A.peds[0]; far.x = far.z = 9000; far.still = true; const time = far.mixer.time; A.updatePeds(.1, false);
  check(far.mixer.time === time && !far.root.parent, 'distant rigs detach and stop animating');
  A.npcVerification = { checks: results.length, before, after, models: npcModels.map(m => m.name) };
  console.warn('NPC_CHECK ' + JSON.stringify(A.npcVerification));
};
K.scenes.npcs_all = h => {
  h.play(); h.go(40, 9); h.pz.wait = 1e6;
  const y = W.terrainH(40, 1);
  npcModels.forEach((m, i) => { const p = A.person({ model: m.name, shirt: CLOTH[i % CLOTH.length] }); p.x = 31 + (i % 7) * 3; p.z = i < 7 ? 1 : -5; p.y = y; p.place(); p.play(i % 2 ? 'walk' : 'wave', 0); p.mixer.update(.3); });
  K.sceneCam = { noClip: true, pos: new T.Vector3(43, y + 9, 24), look: new T.Vector3(40, y + 1.8, -1) }; h.st(1);
};

// The road graph must be rebuilt once dressing and stationary actors have registered their collision bodies. That scan takes
// seconds, so boot runs it behind the loading screen; a start that finds it already done only resets traffic (Play stays instant).
A.finalizeTraffic = function () {
  if (!A.roadGraph || A.trafficFinal) return;
  buildRoadGraph();
  A.roadGraph.edges.forEach(e => { e.stop = e.dx > .9; });
  showBusStops();
  for (const c of A.cars) trafficRoutes(c);   // warm the per-vehicle-type route cache (the slow part of the first rehome)
  A.trafficFinal = true;
};
K.on('start', () => {
  if (!A.roadGraph) return;
  A.finalizeTraffic();
  A.trafficHash.clear();
  for (const c of A.cars) { c._trafficKey = null; c.edge = null; c.x = c.z = -10000 - c.id * 40; }
  for (const c of [...A.cables, A.streetcar, A.boss, P, ...A.peds]) if (c) { c._trafficKey = null; A.hashTraffic(c); }
  for (const c of A.cars) { A.rehomeTraffic(c, false); c.accel = c.stopT = c.waitT = 0; A.placeVehicle(c, 0); }
});
// Production-path traffic audit; SAT uses rendered hull dimensions, including imported pivots.
K.scenes = K.scenes || {};
function trafficHullOverlap(a, b, inset = .05) {
  const sa = Math.sin(a.heading), ca = Math.cos(a.heading), sb = Math.sin(b.heading), cb = Math.cos(b.heading);
  const dx = b.x + cb * (b.ox || 0) + sb * (b.oz || 0) - a.x - ca * (a.ox || 0) - sa * (a.oz || 0);
  const dz = b.z - sb * (b.ox || 0) + cb * (b.oz || 0) - a.z + sa * (a.ox || 0) - ca * (a.oz || 0);
  for (const [x, z] of [[ca, -sa], [sa, ca], [cb, -sb], [sb, cb]]) {
    const ra = Math.abs(x * ca - z * sa) * (a.hx - inset) + Math.abs(x * sa + z * ca) * (a.hz - inset);
    const rb = Math.abs(x * cb - z * sb) * (b.hx - inset) + Math.abs(x * sb + z * cb) * (b.hz - inset);
    if (Math.abs(dx * x + dz * z) >= ra + rb) return false;
  }
  return true;
}
K.scenes.traffic_check = h => {
  h.play(); h.go(20, 3); h.pz.wait = 1e6;
  const params=new URLSearchParams(location.search), requested=Number(params.get('seconds') || 60);
  const seconds=Number.isFinite(requested)?Math.max(10,Math.min(180,requested)):60;
  const m = { seconds, vehicles: A.cars.length, overlapFrames: 0, overlapPairs: 0, stuckEvents: 0, flying: 0, averageSpeed: 0, minMoving: 1e9, maxStopped: 0 };
  const stop = new Map(), pairs = new Set(); let samples = 0;
  for (let i = 0; i < seconds * 60; i++) {
    A.updateTraffic(1 / 60, true); A.updatePeds(1 / 60, true); h.g.time += 1 / 60; if(!params.has('trafficOnly')) K.emit('step', 1 / 60, h.g);
    let overlaps = 0, moving = 0;
    for (let j = 0; j < A.cars.length; j++) {
      const c = A.cars[j]; m.averageSpeed += Math.abs(c.speed || 0); samples++;
      const t = Math.abs(c.speed || 0) < .2 ? (stop.get(c) || 0) + 1 / 60 : 0; stop.set(c, t); m.maxStopped = Math.max(m.maxStopped, t);
      if (t >= 30 && t < 30 + 1 / 60) m.stuckEvents++;
      if (Math.abs(c.speed || 0) > 1) moving++;
      const f = W.terrainH(c.x + Math.sin(c.heading) * c.hz, c.z + Math.cos(c.heading) * c.hz), b = W.terrainH(c.x - Math.sin(c.heading) * c.hz, c.z - Math.cos(c.heading) * c.hz);
      if (c.g.parent && (!Number.isFinite(c.g.position.y) || Math.abs(c.g.position.y - (f + b) / 2) > .1)) m.flying++;
      for (let k = j + 1; k < A.cars.length; k++) if (trafficHullOverlap(c, A.cars[k])) { overlaps++; if(!pairs.has(j + ':' + k))console.warn('OVERLAP '+JSON.stringify({a:j,b:k,x:c.x,z:c.z,otherX:A.cars[k].x,otherZ:A.cars[k].z})); pairs.add(j + ':' + k); }
    }
    m.overlapFrames += overlaps; m.minMoving = Math.min(m.minMoving, moving);
  }
  m.busStops=A.cars.reduce((n,c)=>n+(c.busStops || 0),0); m.turns=A.cars.reduce((n,c)=>n+(c.turns || 0),0);
  m.averageSpeed = +(m.averageSpeed / samples).toFixed(3); m.maxStopped = +m.maxStopped.toFixed(2); m.overlapPairs = pairs.size;
  A.trafficVerification = m; console.warn('TRAFFIC_CHECK ' + JSON.stringify(m));
  for (const c of A.cars) if (params.has('trafficDebug') && (stop.get(c) || 0)>15) console.warn('TRAFFIC_STALL '+JSON.stringify({id:c.id,kind:c.kind,x:c.x,z:c.z,hx:c.hx,hz:c.hz,reason:c.waitReason,remaining:c.edge && c.edge.len-12-c.roadS,owner:c.edge && c.edge.b.owner && c.edge.b.owner.id,next:!!c.nextEdge,curve:!!c.curve,wait:c.waitT,static:c.staticBlocked,lead:c.lastLead,blocker:c.blocker && (c.blocker.id ?? c.blocker.kind)}));
  if (A.roadGraph && (m.overlapFrames || m.stuckEvents || m.flying || (seconds >= 60 && !m.busStops))) throw new Error('Traffic invariants failed: ' + JSON.stringify(m));
  K.sceneCam = { pos: new T.Vector3(40, 48, 16), look: new T.Vector3(10, 0, -20) };
};

function reserveDriveFixture(car,x,z,radius) {
  for(const other of A.cars)if(other!==car && Math.hypot(other.x-x,other.z-z)<radius) {
    for(const e of A.roadGraph.edges) {
      const q=roadPoint(e,(e.len)/2);
      if(Math.hypot(q.x-x,q.z-z)<radius+100 || !trafficRoutes(other).has(e) || !A.vehicleClear(other,q.x,q.z,q.h))continue;
      setRoad(other,e,e.len/2);A.placeVehicle(other,0);break;
    }
  }
}
function stageDrive(h, quiet = false) {
  h.play(); h.pz.wait=1e6;
  const c=A.cars.find(c=>c.kind==='waymo');
  // Select an actual four-edge city block whose lanes and turns fit the production hull.
  let route=null;
  for(const e of A.roadGraph.edges) {
    if(Math.hypot(e.a.x,e.a.z)>300)continue;
    for(const b of e.b.out) for(const d of b.b.out) for(const f of d.b.out) {
      if(e.closed || b.closed || d.closed || f.closed || f.b!==e.a || d.b===e.a || b.b===e.a || Math.abs(e.dx*b.dx+e.dz*b.dz)>.1)continue;
      const edges=[e,b,d,f], pts=[]; let ok=true;
      for(let i=0;i<4;i++) {
        const edge=edges[i];
        for(let s=ROAD_INSET;s<edge.len-ROAD_INSET;s+=3) { const q=roadPoint(edge,s); if(!A.vehicleClear(c,q.x,q.z,q.h,'static'))ok=false; pts.push(q); }
        const prev=c.edge;c.edge=edge; const curve=roadCurve(c,edges[(i+1)%4]);c.edge=prev;
        if(!curve) { ok=false;break; } for(let k=0;k<curve.pts.length;k+=3)pts.push(curve.pts[k]);
      }
      if(ok) { route={edges,pts};break; }
    }
    if(route)break;
  }
  if(!route)throw new Error('No driveable city block');
  // A test fixture reserves the block; traffic elsewhere continues through the same update loop.
  const p=route.pts[0];
  reserveDriveFixture(c,p.x,p.z,150);
  if(quiet)for(const other of A.cars)if(other!==c)other.mode='review';
  setRoad(c,route.edges[0],ROAD_INSET);c.mode='parked';A.placeVehicle(c,0);
  h.go(c.x-Math.cos(c.heading)*(c.hx+1.5),c.z+Math.sin(c.heading)*(c.hx+1.5));h.P.y=c.bot;h.P.onGround=true;
  K.fn.enterCar(c); if(h.P.car!==c)throw new Error('Waymo entry failed');
  return {c,route};
}
K.scenes.drive_check = h => {
  const {c,route}=stageDrive(h,true), start={x:c.x,z:c.z};let index=1, distance=0, maxSpeed=0, ticks=0;
  h.P.carT=180; const render=K.render; K.render=()=>{};
  try {
  for(;ticks<3600 && index<route.pts.length;ticks++) {
    while(index<route.pts.length-1 && Math.hypot(c.x-route.pts[index].x,c.z-route.pts[index].z)<5.5)index++;
    const q=route.pts[index], error=U.angDiff(Math.atan2(q.x-c.x,q.z-c.z),c.heading), keys=[];
    if(Math.abs(error)>.06)keys.push(error>0?'KeyA':'KeyD');
    if(Math.abs(c.speed)<(Math.abs(error)>.3?4.5:8))keys.push('KeyW');
    const x=c.x,z=c.z;h.st(1,keys);distance+=Math.hypot(c.x-x,c.z-z);maxSpeed=Math.max(maxSpeed,Math.abs(c.speed));
    if(index===route.pts.length-1 && Math.hypot(c.x-q.x,c.z-q.z)<5)index++;
  }
  } finally { K.render=render; }
  const result={waypoints:index,total:route.pts.length,seconds:+(ticks/30).toFixed(2),distance:+distance.toFixed(2),maxSpeed:+maxSpeed.toFixed(2),wallHit:false,reverse:false,exit:false};
  console.warn('DRIVE_ROUTE '+JSON.stringify({...result,x:c.x,z:c.z,start}));
  if(index<route.pts.length)throw new Error('Drive failed to complete city block');
  // Reserve a straight section of the same real block for an explicit oblique barrier hit.
  const e=route.edges[0],reset=roadPoint(e,ROAD_INSET+1);reserveDriveFixture(c,reset.x,reset.z,100);
  setRoad(c,e,ROAD_INSET+1);c.mode='driven';c.driveVX=c.driveVZ=c.speed=0;A.placeVehicle(c,0);
  if(!A.vehicleClear(c,c.x,c.z,c.heading))throw new Error('Wall fixture could not reserve a clear start');
  h.st(10,['KeyW','KeyA']);
  const wall=roadPoint(e,e.len-ROAD_INSET+5), y=W.terrainH(wall.x,wall.z);
  if(e.dx)W.addBox(wall.x-.15,wall.x+.15,wall.z-16,wall.z+16,y+8);
  else W.addBox(wall.x-16,wall.x+16,wall.z-.15,wall.z+.15,y+8);
  const hits=c.driveHits || 0;
  for(let i=0;i<150 && (c.driveHits || 0)===hits;i++)h.st(1,['KeyW']);
  result.wallHit=(c.driveHits || 0)>hits;
  const x=c.x,z=c.z;h.st(80,['KeyS']);result.reverse=c.speed<0 && Math.hypot(c.x-x,c.z-z)>2;
  result.reverseDistance=+Math.hypot(c.x-x,c.z-z).toFixed(2);
  h.st(60,[]); result.exit=K.fn.exitCar(true) && !W.blockedAt(h.P.x,h.P.z,.8,h.P.y,{dynamic:true});
  for(const other of A.cars)if(other.mode==='review')other.mode='auto';
  A.driveVerification=result;console.warn('DRIVE_CHECK '+JSON.stringify(result));
  if(!result.wallHit || !result.reverse || !result.exit)throw new Error('Drive interaction invariants failed');
  K.sceneCam={pos:new T.Vector3(c.x+14,c.bot+12,c.z+18),look:new T.Vector3(c.x,c.bot+1,c.z)};h.st(1);
};
K.scenes.drive = h => {
  const {c}=stageDrive(h); h.st(22,['KeyW']);
  const sn=Math.sin(c.heading),cs=Math.cos(c.heading);
  K.sceneCam={noClip:true,pos:new T.Vector3(c.x-sn*10+cs*6,c.bot+5,c.z-cs*10-sn*6),look:new T.Vector3(c.x+sn*4,c.bot+1.5,c.z+cs*4)};h.st(1);
};
K.scenes.traffic = h => {
  h.play();h.go(16,3);h.pz.wait=1e6;
  const e=A.roadGraph.edges.find(e=>e.a.x===10 && e.a.z===-20 && e.b.z===40) || A.roadGraph.edges[0];
  const c=A.cars.find(c=>c.kind==='waymo');
  if(A.vehicleClear(c,...[roadPoint(e,15).x,roadPoint(e,15).z,e.h]))setRoad(c,e,15);
  const q=roadPoint(e,28);h.go(q.x,q.z);h.P.onGround=true;h.st(80);
  K.sceneCam={pos:new T.Vector3(c.x+24,c.bot+23,c.z+25),look:new T.Vector3(c.x,c.bot+1,c.z)};h.st(1);
};

})(window.K);
