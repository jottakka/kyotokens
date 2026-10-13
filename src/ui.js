/* KYOTO(KENS) — UI: 3D title/pause/end menus + comic HUD */
'use strict';
(function (K) {
const T = K.T, U = K.U, W = K.W, scene = K.scene, camera = K.camera, $ = K.$;
const UI = K.UI = {};
const ray = new T.Raycaster(); const m2 = new T.Vector2();

/* ---------- 3D words ---------- */
/* Crisp painted lettering. The extruded glyph meshes double-inked (their baked _ink shell + a runtime hull) and z-fought inside the
   letters, which read as speckled noise; menu words are now canvas-painted planes sized to the original glyph bounds. */
const WORD_TEXT = { w_paused: 'PAUSED', w_play: 'PLAY', w_resume: 'RESUME', w_restart: 'RESTART', w_menu: 'MENU', w_again: 'AGAIN', w_go: 'GO!', w_goodboy: 'GOOD BOY!', w_leashed: 'LEASHED!' };
const WORD_GOLD = { w_paused: 1, w_goodboy: 1, w_leashed: 1, w_go: 1 };
function paintWord(cv, txt, gold) {
  const g = cv.getContext('2d'), w = cv.width, h = cv.height; g.clearRect(0, 0, w, h);
  let size = h * .62; g.font = `${size}px "Titan One", "Bangers", Impact, sans-serif`; const mw = g.measureText(txt).width, maxW = w * .9; if (mw > maxW) size *= maxW / mw;
  g.font = `${size}px "Titan One", "Bangers", Impact, sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.lineJoin = 'round';
  const cx = w / 2, cy = h * .52, d = Math.round(size * .07), side = gold ? '#b8421c' : '#7a5aa8', face = g.createLinearGradient(0, cy - size * .5, 0, cy + size * .5);
  (gold ? [[0, '#fffbe0'], [.45, '#ffd84a'], [1, '#ff9a1f']] : [[0, '#ffffff'], [1, '#ffeccc']]).forEach(([t, c]) => face.addColorStop(t, c));
  for (let i = d; i > 0; i--) { g.fillStyle = side; g.fillText(txt, cx + i * .5, cy + i); }
  g.lineWidth = size * .17; g.strokeStyle = '#1a1026'; g.strokeText(txt, cx + d * .5, cy + d); g.strokeText(txt, cx, cy);
  g.fillStyle = face; g.fillText(txt, cx, cy);
}
function word(name, scale) {
  const G = K.assets.ui3d; const g = new T.Group(); g.name = 'W_' + name;
  const a = G && G.scene.getObjectByName(name), txt = WORD_TEXT[name];
  if (a && txt) {
    const probe = a.clone(); probe.position.set(0, 0, 0); probe.updateMatrixWorld(true); const box = new T.Box3().setFromObject(probe), sz = box.getSize(new T.Vector3()), ctr = box.getCenter(new T.Vector3()), pw = sz.x * 1.12, ph = Math.max(sz.y * 1.5, pw * .28);
    const cv = document.createElement('canvas'); cv.width = 1024; cv.height = Math.max(128, Math.min(512, Math.round(1024 * ph / pw)));
    const tex = new T.CanvasTexture(cv); tex.encoding = T.sRGBEncoding; tex.anisotropy = 8;
    const draw = () => { paintWord(cv, txt, WORD_GOLD[name]); tex.needsUpdate = true; }; draw();
    if (document.fonts && document.fonts.load) document.fonts.load('100px "Titan One"').then(draw).catch(() => {});
    const m = new T.Mesh(new T.PlaneGeometry(pw, ph), new T.MeshBasicMaterial({ map: tex, transparent: true, alphaTest: .02, depthWrite: false }));
    m.position.set(ctr.x, ctr.y, 0); m.material.userData.menuOwned = true; g.add(m);
    if (scale) g.scale.setScalar(scale);
    return g;
  }
  const b = G && G.scene.getObjectByName(name + '_ink');
  if (a) { const c = a.clone(); c.position.set(0, 0, 0); g.add(c); }
  if (b) { const c = b.clone(); c.position.set(0, 0, 0); g.add(c); }
  g.traverse(o => { if (o.isMesh) { o.castShadow = true; o.material = Array.isArray(o.material) ? o.material.map(fixInk) : fixInk(o.material); } });
  K.inkShell(g, .07);
  if (scale) g.scale.setScalar(scale);
  return g;
}
function fixInk(m) { if (m.name && /ink/.test(m.name)) { const c = m.clone(); c.side = T.BackSide; c.userData.menuOwned = true; return c; } return m; }
UI.word = word;
UI.buttons = [];
function button(g, fn) { g.userData.btn = fn; g.userData.base = g.scale.x; UI.buttons.push(g); return g; }

/* ---------- title set ---------- */
UI.buildTitle = function () {
  const P0 = new T.Vector3(18, 0, -146); P0.y = W.terrainH(P0.x, P0.z) + 22;
  const d = new T.Vector3(-.95, 0, -.3).normalize(), r = new T.Vector3(-d.z, 0, d.x);   // west: sunset + Golden Gate behind the sign
  const face = Math.atan2(-d.x, -d.z);
  const g = new T.Group(); scene.add(g); UI.title = g;
  // rooftop slab + parapet + string lights
  const bh = P0.y - W.terrainH(P0.x, P0.z) + 4; const bld = new T.Mesh(new T.BoxGeometry(21, bh, 13), K.toon('#b8573c')); bld.position.copy(P0).add(new T.Vector3(0, -bh / 2 - .8, 0)); bld.rotation.y = face; bld.castShadow = bld.receiveShadow = true; g.add(bld);
  const roof = new T.Mesh(new T.BoxGeometry(22, 1, 14), K.toon('#c9876a')); roof.position.copy(P0).add(new T.Vector3(0, -.5, 0)); roof.rotation.y = face; roof.receiveShadow = true; roof.castShadow = true; g.add(roof);
  const tcv = document.createElement('canvas'); tcv.width = tcv.height = 256; const tg = tcv.getContext('2d'); tg.fillStyle = '#6a5470'; tg.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 9; i++) { tg.fillStyle = i % 2 ? 'rgba(40,24,52,.22)' : 'rgba(255,190,160,.08)'; tg.fillRect(0, i * 29, 256, 3); }
  for (let i = 0; i < 70; i++) { tg.fillStyle = `rgba(${Math.random() < .5 ? '30,18,40' : '255,200,170'},${.05 + Math.random() * .08})`; tg.beginPath(); tg.ellipse(Math.random() * 256, Math.random() * 256, 4 + Math.random() * 16, 2 + Math.random() * 6, Math.random() * 3, 0, 7); tg.fill(); }
  const ttx = new T.CanvasTexture(tcv); ttx.wrapS = ttx.wrapT = T.RepeatWrapping; ttx.repeat.set(3, 2); ttx.encoding = T.sRGBEncoding;
  const tar = new T.Mesh(new T.BoxGeometry(21, .05, 13), new T.MeshToonMaterial({ map: ttx, gradientMap: K.grad3 })); tar.position.copy(P0).add(new T.Vector3(0, .02, 0)); tar.rotation.y = face; g.add(tar);
  const tank = new T.Group(); const barrel = new T.Mesh(new T.CylinderGeometry(2.2, 2.2, 4, 16), K.toon('#8a5a3a')); barrel.position.y = 5.2; tank.add(barrel);
  const cone = new T.Mesh(new T.ConeGeometry(2.5, 1.6, 16), K.toon('#6b4a36')); cone.position.y = 8; tank.add(cone);
  for (const [x, z] of [[-1.5, -1.5], [1.5, -1.5], [-1.5, 1.5], [1.5, 1.5]]) { const l = new T.Mesh(new T.CylinderGeometry(.12, .12, 3.2, 6), K.toon('#3a3f4a')); l.position.set(x, 1.6, z); tank.add(l); }
  const deco = new T.Group(); deco.position.copy(P0); deco.rotation.y = face; g.add(deco);   // local frame: +x = right, -z = toward the sign
  const put = (geo, col, x, y, z, ry) => { const m = new T.Mesh(geo, K.toon(col)); m.position.set(x, y, z); if (ry) m.rotation.y = ry; m.castShadow = m.receiveShadow = true; deco.add(m); return m; };
  for (const [w, x, z] of [[22, 0, 6.8], [22, 0, -6.8]]) put(new T.BoxGeometry(w, .9, .45), '#a8472f', x, .45, z);
  for (const [dd, x] of [[13.6, 10.8], [13.6, -10.8]]) put(new T.BoxGeometry(.45, .9, dd), '#a8472f', x, .45, 0);
  put(new T.BoxGeometry(22.6, .16, .7), '#e9b08c', 0, .95, 6.8); put(new T.BoxGeometry(22.6, .16, .7), '#e9b08c', 0, .95, -6.8);
  put(new T.BoxGeometry(1.6, 1.1, 1.2), '#8b93a6', -7.8, .55, 3.6); put(new T.CylinderGeometry(.45, .45, .5, 12), '#5d6475', -7.8, 1.3, 3.6);   // AC unit + fan
  put(new T.CylinderGeometry(.18, .18, 1.8, 8), '#6b7280', 8.2, .9, 4.4); put(new T.ConeGeometry(.42, .5, 8), '#6b7280', 8.2, 2.0, 4.4);           // vent stack
  for (const [x, z, c] of [[-4.6, 5.2, '#4f9a45'], [5.6, 5.4, '#3f8a3a'], [-9.4, -4.6, '#58a24c']]) { put(new T.CylinderGeometry(.5, .38, .7, 10), '#c46a3a', x, .35, z); put(new T.IcosahedronGeometry(.75, 0), c, x, 1.15, z); }
  for (const [x, z, sx, sz] of [[-2.8, 3.2, 1.8, .9], [2.2, 4.6, 1.2, .6], [-6.2, 1.2, .9, .5]]) {   // puddles mirroring the sunset sky
    const pm = new T.Mesh(new T.CircleGeometry(1, 24), new T.MeshBasicMaterial({ color: '#ff9fb2', transparent: true, opacity: .55 })); pm.rotation.x = -Math.PI / 2; pm.scale.set(sx, sz, 1); pm.position.set(x, .06, z); deco.add(pm); }
  put(new T.BoxGeometry(2.2, .12, 1.1), '#7a4a2a', 4.4, .72, 1.6); put(new T.BoxGeometry(.1, .7, .1), '#3a2a1f', 3.5, .35, 1.2); put(new T.BoxGeometry(.1, .7, .1), '#3a2a1f', 5.3, .35, 2.0);   // bench
  const bw = put(new T.CylinderGeometry(.12, .14, .42, 10), '#d9a441', 4.0, 1.0, 1.6); put(new T.CylinderGeometry(.13, .13, .08, 10), '#fff6e2', 4.0, 1.24, 1.6);   // a Feierabend beer
  // logo on scaffold
  const G = K.assets.ui3d; const logo = new T.Group();
  ['logo', 'logo_plate'].forEach(n => { const s = G && G.scene.getObjectByName(n); if (s) { const c = s.clone(); c.position.set(0, n === 'logo_plate' ? -1.9 : 0, n === 'logo_plate' ? .6 : 0); if (n === 'logo_plate') c.rotation.x = -.08; logo.add(c); } });
  logo.traverse(o => { if (o.isMesh) o.castShadow = true; }); K.inkShell(logo, .12);
  { // dark marquee board behind the letters: warm letters on a warm sunset need a night-sky backdrop to read
    const bb = new T.Box3().setFromObject(logo), sz = bb.getSize(new T.Vector3()), c = bb.getCenter(new T.Vector3());
    const Wd = sz.x + 1.4, Hd = sz.y + 2.9, R = .9, back = new T.Group(); back.position.set(c.x, c.y + .75, bb.min.z - .35);
    const mk = (w, h, r, col, z, depth) => { const geo = depth ? new T.ExtrudeGeometry(roundRect(w, h, r), { depth, bevelEnabled: true, bevelThickness: .08, bevelSize: .08, bevelSegments: 2, curveSegments: 10 }) : new T.ShapeGeometry(roundRect(w, h, r), 10);
      const m = new T.Mesh(geo, depth ? [new T.MeshBasicMaterial({ color: col }), new T.MeshBasicMaterial({ color: new T.Color(col).multiplyScalar(.5) })] : new T.MeshBasicMaterial({ color: col })); m.position.z = z; back.add(m); return m; };
    mk(Wd + .9, Hd + .9, R + .4, '#1a1026', -.62);            // ink
    mk(Wd + .5, Hd + .5, R + .25, '#ffcf3f', -.5, .18);       // gold frame
    const face = mk(Wd, Hd, R, '#2b1a4a', -.25, .2);            // deep plum board
    const glow = new T.Mesh(new T.ShapeGeometry(roundRect(Wd - .8, Hd * .3, .3), 6), new T.MeshBasicMaterial({ color: '#6b4bb0', transparent: true, opacity: .35 })); glow.position.set(0, Hd * .28, 0); back.add(glow);
    const per = 2 * (Wd + Hd), n = Math.round(per / .75);
    for (let i = 0; i < n; i++) { let t = i / n * per, x, y; const hw = Wd / 2 + .02, hh = Hd / 2 + .02;
      if (t < Wd) { x = -hw + t; y = hh; } else if ((t -= Wd) < Hd) { x = hw; y = hh - t; } else if ((t -= Hd) < Wd) { x = hw - t; y = -hh; } else { t -= Wd; x = -hw; y = -hh + t; }
      const bl = new T.Mesh(new T.SphereGeometry(.13, 8, 6), new T.MeshBasicMaterial({ color: i % 2 ? '#fff1a8' : '#ff8fc4' })); bl.position.set(x, y, .05); back.add(bl); (UI.marquee = UI.marquee || []).push(bl); }
    logo.add(back);
  }
  logo.scale.setScalar(.95); logo.position.copy(P0).addScaledVector(d, 7).addScaledVector(r, .6).add(new T.Vector3(0, 8.4, 0)); logo.rotation.y = face; g.add(logo); UI.logo = logo;
  for (const s of [-1, 1]) { const pole = new T.Mesh(new T.BoxGeometry(.5, 8, .5), K.toon('#2e3340')); pole.position.copy(P0).addScaledVector(d, 7.6).addScaledVector(r, .6 + s * 6.4).add(new T.Vector3(0, 4, 0)); pole.castShadow = true; g.add(pole); }
  const bulbs = []; for (let i = 0; i <= 16; i++) { const t = i / 16; const b = new T.Mesh(new T.SphereGeometry(.13, 8, 6), new T.MeshBasicMaterial({ color: i % 3 ? '#ffe28a' : '#ff8fc4' })); b.position.copy(P0).addScaledVector(r, .6 + (t - .5) * 12.6).addScaledVector(d, 7.2).add(new T.Vector3(0, 5.6 - Math.sin(t * Math.PI) * 1.1, 0)); g.add(b); bulbs.push(b); }
  UI.bulbs = bulbs;
  // PLAY
  const play = slab('w_play', '#13b5a6', .5, null, 3.6); play.position.copy(P0).addScaledVector(d, 1.2).addScaledVector(r, 3.8).add(new T.Vector3(0, 2.2, 0)); play.rotation.y = face; play.position.y -= .5; play.position.addScaledVector(r, .6); g.add(play); button(play, () => K.game.requestStart()); UI.play = play;
  // keycaps: how to play without paragraphs
  const keys = [];
  let off = -6.6; keys.forEach(n => { const s = G && G.scene.getObjectByName(n); if (!s) return; const c = s.clone(); c.position.set(0, 0, 0); c.traverse(o => { if (o.isMesh) o.castShadow = true; }); K.inkShell(c, .05); const w = n === 'key_SPACE' ? 3 : n === 'key_SHIFT' ? 2 : 1; c.scale.setScalar(.62);
    const pos = P0.clone().addScaledVector(d, -3.4).addScaledVector(r, off + w * .62 * .5 - 1.2).add(new T.Vector3(0, .55, 0)); c.position.copy(pos); c.rotation.y = face; c.rotation.x = -.35; g.add(c); off += w * .62 + .3; });
  const rim = new T.DirectionalLight('#ff9a4a', 1.1); rim.position.copy(P0).addScaledVector(d, 40).add(new T.Vector3(0, 9, 0)); rim.target.position.copy(P0); g.add(rim); g.add(rim.target);   // low sun behind the sign: glowing orange edges
  UI.titleCam = { pos: P0.clone().addScaledVector(d, -8.4).add(new T.Vector3(0, 2.6, 0)).addScaledVector(r, -.7), look: P0.clone().addScaledVector(d, 3.5).addScaledVector(r, .4).add(new T.Vector3(0, 3.55, 0)) };
  UI.P0 = P0; UI.face = face; UI.dir = d;
};
UI.placeTitleKyoto = function (k) { k.root.position.copy(UI.P0).addScaledVector(UI.dir, -.6).add(new T.Vector3(-UI.dir.z * -3.1, 0, UI.dir.x * -3.1)); k.root.rotation.y = UI.face + .45; k.root.scale.setScalar(1.0); k.play('sit', 0); };

/* ---------- camera-attached menu (pause / end) ---------- */
UI.cam = new T.Group(); K.uiScene.add(UI.cam);
function stackWords(list) {
  UI.clearCam(); UI.buttons = UI.buttons.filter(b => b.parent && b.parent !== UI.cam && UI.title && UI.title.visible);
  list.forEach(([name, y, s, fn]) => { const w = word(name, s); w.position.set(0, y, -12); w.rotation.x = -.05; UI.cam.add(w); if (fn) button(w, fn); });
}
/* comic slab button: extruded rounded plate + thick ink backing + gloss strip, 3D word on its face */
function roundRect(w, h, r) {
  const s = new T.Shape(), x = -w / 2, y = -h / 2;
  s.moveTo(x + r, y); s.lineTo(x + w - r, y); s.quadraticCurveTo(x + w, y, x + w, y + r); s.lineTo(x + w, y + h - r); s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  s.lineTo(x + r, y + h); s.quadraticCurveTo(x, y + h, x, y + h - r); s.lineTo(x, y + r); s.quadraticCurveTo(x, y, x + r, y); return s;
}
function slab(name, color, s, fn, minW) {
  const g = new T.Group(); g.name = 'S_' + name; const w = word(name, s);
  const bb = new T.Box3().setFromObject(w), sz = bb.getSize(new T.Vector3()), c = bb.getCenter(new T.Vector3());
  const W = Math.max(minW || 0, sz.x + 1.1), H = sz.y + .8, R = Math.min(.5, H * .35);
  const body = new T.Mesh(new T.ExtrudeGeometry(roundRect(W, H, R), { depth: .42, bevelEnabled: true, bevelThickness: .1, bevelSize: .09, bevelSegments: 3, curveSegments: 10 }), [new T.MeshBasicMaterial({ color }), new T.MeshBasicMaterial({ color: new T.Color(color).multiplyScalar(.52) })]);
  body.position.z = -.72; body.material.forEach(m => { m.userData.menuOwned = true; });
  const ink = new T.Mesh(new T.ShapeGeometry(roundRect(W + .5, H + .5, R + .24), 10), new T.MeshBasicMaterial({ color: '#1a1026' })); ink.position.z = -.84; ink.material.userData.menuOwned = true;
  const drop = new T.Mesh(new T.ShapeGeometry(roundRect(W + .42, H + .42, R + .2), 10), new T.MeshBasicMaterial({ color: '#1a1026', transparent: true, opacity: .35 })); drop.position.set(.26, -.3, -.88); drop.material.userData.menuOwned = true;
  const gloss = new T.Mesh(new T.ShapeGeometry(roundRect(W - .5, H * .22, H * .1), 6), new T.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: .32 })); gloss.position.set(0, H * .26, -.2); gloss.material.userData.menuOwned = true;
  const side = new T.Color(color).multiplyScalar(.55);
  w.traverse(o => { if (!o.isMesh) return; const f = m => { if (/lg_face|lg_gold$|lg_cream/.test(m.name)) { m = m.clone(); m.color.set('#fff6e2'); m.userData.menuOwned = true; } else if (/_side$/.test(m.name)) { m = m.clone(); m.color.copy(side); m.userData.menuOwned = true; } return m; };
    o.material = Array.isArray(o.material) ? o.material.map(f) : f(o.material); });
  for (const mesh of [drop, ink, body, gloss]) mesh.userData.menuGeometry = true;
  w.position.set(-c.x, -c.y, 0); g.add(drop, ink, body, gloss, w);
  if (fn) button(g, fn); return g;
}
/* sunburst card behind menus: alternating warm rays, halftone, soft round edge */
let burstTex = null;
function sunburst(r, x, y) {
  if (!burstTex) {
    const cv = document.createElement('canvas'); cv.width = cv.height = 512; const g2 = cv.getContext('2d'), C = 256;
    for (let i = 0; i < 24; i++) { g2.fillStyle = i % 2 ? '#ff7a59' : '#ffb347'; g2.beginPath(); g2.moveTo(C, C); g2.arc(C, C, 260, i / 24 * Math.PI * 2, (i + 1) / 24 * Math.PI * 2); g2.fill(); }
    g2.fillStyle = 'rgba(255,60,120,.28)'; for (let yy = 8; yy < 512; yy += 14) for (let xx = (yy / 14 % 2) * 7 + 4; xx < 512; xx += 14) { const d = Math.hypot(xx - C, yy - C) / C; g2.beginPath(); g2.arc(xx, yy, 1.2 + 3.2 * d, 0, 7); g2.fill(); }
    const gr = g2.createRadialGradient(C, C, 150, C, C, 256); gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(1, 'rgba(0,0,0,1)'); g2.globalCompositeOperation = 'destination-out'; g2.fillStyle = gr; g2.fillRect(0, 0, 512, 512);
    burstTex = new T.CanvasTexture(cv); burstTex.encoding = T.sRGBEncoding;
  }
  const m = new T.Mesh(new T.CircleGeometry(r, 64), new T.MeshBasicMaterial({ map: burstTex, transparent: true, depthWrite: false })); m.material.userData.menuOwned = true; m.userData.menuGeometry = true;
  m.position.set(x, y, -18); m.userData.spin = .06; m.userData.noBob = true; return m;
}
/* the real Kyoto, live in the menu layer */
function menuDog(x, y, z, s, ry, anim) {
  const r = K.rigClone(K.assets.kyoto); r.root.position.set(x, y, z); r.root.scale.setScalar(s); r.root.rotation.set(.08, ry, 0); r.play(anim || 'idle', 0);
  r.root.userData.noBob = true; UI.cam.add(r.root); UI.menuDogs.push(r); return r;
}
UI.menuDogs = [];
UI.showPause = function (on) {
  const hud = document.getElementById('hud'); if (hud) hud.style.visibility = on ? 'hidden' : '';
  if (!on) return UI.clearCam();
  UI.clearCam();
  const sb = sunburst(9.5, 1.2, .4); sb.material.opacity = .62; UI.cam.add(sb);
  const t = word('w_paused', 1.3); t.position.set(2.2, 1.55, -12); t.rotation.set(-.05, -.1, .04); UI.cam.add(t);
  [['w_resume', '#ff9d00', () => K.game.pause(false)], ['w_restart', '#00b8d4', () => K.game.requestStart(true)], ['w_menu', '#ff2d8a', () => location.reload()]].forEach(([n, col, fn], i) => {
    const b = slab(n, col, .5, fn, 4.0); b.position.set(-4.4 + i * 4.45, -2.75, -12); b.rotation.set(-.2, .14 - i * .14, (i - 1) * -.03); UI.cam.add(b); });
  const dog = menuDog(-6.35, -1.95, -12.3, 1.9, .5, 'sit');
  dog.root.traverse(o => { if (/_fringe/.test(o.name)) o.visible = false; });
};
UI.showEnd = function (win) {
  UI.clearCam();
  const sb = sunburst(K.coarse ? 5 : 9, K.coarse ? 0 : 5.4, K.coarse ? 6 : 1.2); sb.material.opacity = K.coarse ? 0 : .7; UI.cam.add(sb);
  const t = word(win ? 'w_goodboy' : 'w_leashed', .86); t.position.set(K.coarse ? 0 : 5.0, K.coarse ? (K.VW < K.VH ? 12 : 4.5) : 3.15, -12); t.rotation.set(-.05, -.12, .05); UI.cam.add(t);
  if (K.coarse) return;
  const b = slab('w_again', '#ff4d1a', .66, () => K.game.requestStart(true), 5.4); b.position.set(5.0, -3.3, -12); b.rotation.set(-.2, -.16, -.02); UI.cam.add(b);
};
UI.clearCam = () => { for (const r of UI.menuDogs) { r.clearOnce(); r.mixer.stopAllAction(); r.mixer.uncacheRoot(r.root); const materials = new Set(), skeletons = new Set(); r.root.traverse(o => { if (o.material) for (const m of Array.isArray(o.material) ? o.material : [o.material]) materials.add(m); if (o.skeleton) skeletons.add(o.skeleton); }); materials.forEach(m => m.dispose()); skeletons.forEach(s => { if (s.dispose) s.dispose(); }); } UI.menuDogs.length = 0; UI.cam.traverse(o => { if ((o.userData.ink || o.userData.menuGeometry) && o.geometry) o.geometry.dispose(); if (o.material) for (const m of Array.isArray(o.material) ? o.material : [o.material]) if (m.userData.menuOwned) m.dispose(); }); UI.buttons = UI.buttons.filter(b => b.parent !== UI.cam && b.parent); UI.cam.clear(); UI.hover = null; document.body.style.cursor = ''; };

/* ---------- picking ---------- */
UI.hover = null;
UI.pick = function (x, y) {
  m2.set(x / K.VW * 2 - 1, -(y / K.VH) * 2 + 1);
  const camBtns = UI.buttons.filter(b => b.parent === UI.cam), worldBtns = UI.buttons.filter(b => b.parent && b.parent !== UI.cam && b.parent.visible !== false);
  for (const [list, cam] of [[camBtns, K.uiCam], [worldBtns, camera]]) { if (!list.length) continue; ray.setFromCamera(m2, cam); const hits = ray.intersectObjects(list, true); if (hits.length) { let o = hits[0].object; while (o && !o.userData.btn) o = o.parent; if (o) return o; } }
  return null;
};
K.onClick = function (x, y) { const b = UI.pick(x, y); if (b) { K.sfx.click(); b.userData.btn(); } };
UI.update = function (dt, t) {
  UI.updateBanner(dt); UI.resolvePrompt();
  const m = K.mouse, menu = K.game && ['title', 'paused', 'end'].includes(K.game.state); const h = menu && m ? UI.pick(m.x, m.y) : null;
  if (h !== UI.hover) { UI.hover = h; document.body.style.cursor = h ? 'pointer' : ''; if (h) K.sfx.click(); }
  for (const b of UI.buttons) { const target = b.userData.base * (b === UI.hover ? 1.14 : 1); const s = U.damp(b.scale.x, target, 12, dt); b.scale.setScalar(s); b.rotation.z = K.reduceMotion ? 0 : (b === UI.hover ? Math.sin(t * 9) * .04 : Math.sin(t * 2 + b.id) * .015); }
  if (UI.logo && UI.title.visible && !K.reduceMotion) { if (UI.logo.userData.baseY == null) UI.logo.userData.baseY = UI.logo.position.y; UI.logo.position.y = UI.logo.userData.baseY + Math.sin(t * 1.4) * .12; UI.logo.rotation.z = Math.sin(t * .8) * .02; }
  if (UI.bulbs) UI.bulbs.forEach((b, i) => { b.material.color.set(((i + Math.floor(t * 3)) % 3) ? '#ffe28a' : '#ff8fc4'); });
  if (UI.marquee && UI.title && UI.title.visible) { const ph = Math.floor(t * 8); UI.marquee.forEach((b, i) => b.material.color.set((i + ph) % 4 === 0 ? '#ffffff' : i % 2 ? '#ffd23f' : '#ff6fb5')); }
  for (const c of UI.cam.children) { if (c.userData.spin && !K.reduceMotion) c.rotation.z += c.userData.spin * dt; if (c.userData.noBob) continue; if (c.userData.baseY == null) c.userData.baseY = c.position.y; c.position.y = c.userData.baseY + (K.reduceMotion ? 0 : Math.sin(t * 2 + c.id) * .035); }
  for (const r of UI.menuDogs) r.mixer.update(dt);
};

/* ---------- HUD ---------- */
const hud = UI.hud = {};
UI.buildHud = function () {
  hud.letters = [...document.querySelectorAll('#letters .L')];
  hud.tokens = $('#tokNum'); hud.ctx = $('#ctxBar'); hud.paws = $('#paws'); hud.stam = $('#stamBar'); hud.chips = $('#chips'); hud.prompt = $('#prompt'); hud.promptT = $('#promptText');
  hud.radio = $('#radio'); hud.arrow = $('#pArrow'); hud.timer = $('#timer'); hud.banner = $('#banner');
  hud.mm = $('#minimap'); hud.mmg = hud.mm.getContext('2d'); hud.mm.style.cursor = 'pointer'; hud.mm.style.pointerEvents = 'auto'; hud.mm.addEventListener('click', () => K.game.mapKey && K.game.mapKey());
  hud.paws.innerHTML = '<i></i><i></i><i></i>';
  hud.prompt.addEventListener('click', () => { if (promptSelected && promptSelected.onActivate) promptSelected.onActivate(); else K.testKey('KeyE'); });
  hud.prompt.setAttribute('role', 'button'); hud.prompt.setAttribute('aria-live', 'polite');
  const utility = document.createElement('div'); utility.id = 'utilityBar'; $('#hud').appendChild(utility);
  ['lf-family-button', 'kt-toggle', 'stamBox'].forEach(id => { const e = document.getElementById(id); if (e) utility.appendChild(e); });
  UI.buildShortcuts();
  hud.albBtn = $('#albumBtn'); hud.albN = $('#albN');
  hud.albBtn.addEventListener('click', () => { hud.albBtn.blur(); K.game.albumKey(); });   // blur: Space/Enter must stay game keys
  $('#albX').addEventListener('click', () => { $('#albX').blur(); K.game.pause(false); });
  $('#album').addEventListener('pointerdown', e => { if (e.target.id === 'album') K.game.pause(false); });
  $('#albGrid').addEventListener('click', e => { const c = e.target.closest('.ac.got'); if (!c) return; const s = K.A.photos[+c.dataset.i], z = $('#albZoom'); UI.photoImage(z.querySelector('img'), s); z.querySelector('b').textContent = s.label; z.hidden = false; K.sfx.click(); });
  $('#albZoom').addEventListener('click', () => { $('#albZoom').hidden = true; });
};

/* ---------- cinematic: letterbox, caption, skip hint, iris wipe, camera flash ---------- */
UI.cine = function (on) { const lb = $('#lbox'); lb.hidden = false; lb.classList.toggle('on', on); if (!on) { UI.caption(null); UI.skipHint(false); } };
UI.caption = t => { const c = $('#cap'); if (t) c.textContent = t; c.classList.toggle('on', !!t); };
UI.skipHint = on => $('#skipHint').classList.toggle('on', !!on);
UI.iris = function () { const e = $('#iris'); if (K.reduceMotion || !e.animate) { e.hidden = true; return; } e.hidden = false;
  e.animate([{ width: '0px', height: '0px' }, { width: '0px', height: '0px', offset: .18 }, { width: '12vmax', height: '12vmax', offset: .4 }, { width: '300vmax', height: '300vmax' }], { duration: 900, easing: 'ease-in' }).onfinish = () => { e.hidden = true; }; };
UI.flash = function () { const f = $('#flashFx'); if (f.animate && !K.reduceMotion) f.animate([{ opacity: .92 }, { opacity: 0 }], { duration: 450, easing: 'ease-out' }); };

/* ---------- photo album: polaroid pop → fly into the album button, grid overlay ---------- */
UI.setAlbum = function (n, total, bump) { if (!hud.albN) return; hud.albN.textContent = n + '/' + total; hud.albBtn.classList.toggle('full', n >= total); if (bump) { hud.albBtn.classList.remove('bump'); void hud.albBtn.offsetWidth; hud.albBtn.classList.add('bump'); } };
UI.polaroid = function (s, onLand) {
  const box = $('#snapPol'), el = document.createElement('div'); el.className = 'pol';
  el.innerHTML = '<img alt=""><b></b><i class="stk">+1<br>PHOTO</i>'; UI.photoImage(el.querySelector('img'), s); el.querySelector('b').textContent = s.label;
  box.appendChild(el); box.hidden = false;
  let fin = false; const gen = UI.polGen; const done = () => { if (fin) return; fin = true; el.remove(); if (!box.children.length) box.hidden = true; if (onLand && gen === UI.polGen) onLand(); };
  setTimeout(done, K.reduceMotion || !el.animate ? 1600 : 2500);   // fallback if animation frames are throttled
  if (!el.animate || K.reduceMotion) return;
  const t = hud.albBtn.getBoundingClientRect(), r = el.getBoundingClientRect(), dx = t.left + t.width / 2 - (r.left + r.width / 2), dy = t.top + t.height / 2 - (r.top + r.height / 2);
  el.animate([
    { transform: 'translate(-50%,-50%) scale(.2) rotate(-24deg)', opacity: 0, easing: 'cubic-bezier(.2,1.6,.4,1)' },
    { transform: 'translate(-50%,-50%) scale(1) rotate(-5deg)', opacity: 1, offset: .2, easing: 'ease-in-out' },
    { transform: 'translate(-50%,-50%) scale(1.03) rotate(-4deg)', opacity: 1, offset: .66, easing: 'cubic-bezier(.55,0,.85,.4)' },
    { transform: `translate(calc(-50% + ${dx.toFixed(0)}px),calc(-50% + ${dy.toFixed(0)}px)) scale(.12) rotate(16deg)`, opacity: .85 },
  ], { duration: 2200 }).onfinish = done;
};
UI.photoImage = function (img, s) {
  img.alt = s.label; img.onerror = () => { img.onerror = null; img.src = 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="400" height="280"><rect width="400" height="280" fill="%23fff0cb"/><text x="200" y="145" text-anchor="middle" font-size="24" fill="%23263546">POSTCARD COLLECTED</text></svg>'.replaceAll('%23', '#')); };
  img.src = K.A.photoSrc(s.id);
};
UI.albumOpen = false;
UI.album = function (on) {
  const el = $('#album'); UI.albumOpen = !!on; $('#hud').classList.toggle('photos-open', !!on); el.hidden = !on; $('#albZoom').hidden = true; if (!on) return;
  const list = K.A.photos; $('#albCount').textContent = list.filter(s => s.got).length + '/' + list.length;
  $('#albGrid').innerHTML = list.map((s, i) => { const r = `style="--r:${((i * 7) % 5 - 2) * 1.6}deg"`; return s.got ? `<button type="button" class="ac got" data-i="${i}" ${r}><img alt="${s.label}"><span>${s.label}</span></button>` : `<div class="ac" ${r}><i></i><span>${s.label}</span></div>`; }).join('');
  $('#albGrid').querySelectorAll('.got').forEach(c => UI.photoImage(c.querySelector('img'), list[+c.dataset.i]));
};
let bannerTO = 0, bannerAge = 0, bannerActive = null;
const bannerQueue = [];
function showBanner(item) {
  const b = hud.banner; bannerActive = item; bannerAge = 0;
  b.querySelector('.big').textContent = item.big; const small = b.querySelector('.small'); small.textContent = item.small; small.hidden = !item.small;
  b.className = item.cls; b.hidden = false; void b.offsetWidth; b.classList.add('show');
}
UI.banner = function (big, small = '', cls = '', group = '') {
  if (!hud.banner || bannerActive && bannerActive.big === big && bannerActive.small === small || bannerQueue.some(b => b.big === big && b.small === small)) return;
  const item = {big, small, cls, group};
  if (group) for (let i=bannerQueue.length-1;i>=0;i--) if (bannerQueue[i].group===group) bannerQueue.splice(i,1);
  if (!bannerActive || group && bannerActive.group===group) showBanner(item); else bannerQueue.push(item);
};
UI.updateBanner = function (dt) {
  if (!bannerActive || !K.game || K.game.state !== 'play') return;
  bannerAge += dt;
  if (bannerAge >= 1.9) { if (bannerQueue.length) showBanner(bannerQueue.shift()); else { bannerActive = null; hud.banner.hidden = true; } }
};
let radioTO = 0;
UI.radio = function (title) { if (!hud.radio) return; hud.radio.querySelector('b').textContent = title; hud.radio.hidden = false; hud.radio.classList.remove('in'); void hud.radio.offsetWidth; hud.radio.classList.add('in'); clearTimeout(radioTO); radioTO = setTimeout(() => { hud.radio.hidden = true; }, 4200); };
let promptLast = null, promptSelected = null;
const promptOffers = new Map();
UI.clearPrompt = source => { promptOffers.delete(source); UI.resolvePrompt(); };
UI.prompt = function (text, options = {}) {
  const source = options.source || 'main';
  if (!text) promptOffers.delete(source);
  else promptOffers.set(source, {text, source, priority: options.priority == null ? 50 : options.priority, onActivate: options.onActivate, expires: (K.game ? K.game.time : 0) + .3});
  UI.resolvePrompt();
};
UI.resolvePrompt = function () {
  if (!hud.prompt) return;
  const g = K.game; promptSelected = null;
  for (const [source, offer] of promptOffers) {
    if (g && offer.expires < g.time) { promptOffers.delete(source); continue; }
    if (!promptSelected || offer.priority > promptSelected.priority) promptSelected = offer;
  }
  const chosen = g && g.state === 'play' && !(K.agent && K.agent.open) && promptSelected ? promptSelected.text : null;
  const text = chosen && K.coarse ? chosen.replace(/^[EF] · /, 'TAP · ') : chosen;
  hud.prompt.hidden = !text; hud.prompt.dataset.source = text ? promptSelected.source : '';
  if (text !== promptLast) { promptLast = text; hud.promptT.textContent = text || ''; }
};
UI.polGen = 0;
UI.reset = function () { bannerQueue.length = 0; bannerActive = null; bannerAge = 0; promptOffers.clear(); UI.polGen++; UI.bigMap(false); $('#hud').classList.remove('photos-open'); $('#hud').style.visibility = ''; clearTimeout(bannerTO); clearTimeout(radioTO); ['#banner', '#radio', '#mag', '#pArrow', '#album', '#snapPol'].forEach(id => $(id).hidden = true); UI.albumOpen = false; UI.prompt(null); document.querySelectorAll('.sfx,.floater,.ring,#snapPol .pol').forEach(e => { e.getAnimations && e.getAnimations().forEach(a => a.cancel()); e.remove(); }); if (K.A.tags) K.A.tags.forEach(t => { t.bt = 0; t.b.hidden = true; }); };
UI.setLetter = (i, on) => hud.letters[i].classList.toggle('got', on);
UI.hudUpdate = function (g) {
  const P = K.A.player; hud.tokens.textContent = U.fmt(g.tokens); hud.ctx.style.width = (U.clamp(g.tokens / 200000, 0, 1) * 100).toFixed(1) + '%';
  [...hud.paws.children].forEach((e, i) => e.classList.toggle('off', i >= g.wiggles));
  hud.stam.style.width = ((g.buffs.buzz > 0 ? 1 : P.stamina) * 100).toFixed(0) + '%';
  hud.timer.textContent = U.mmss(g.time);
  const patrol = $('#patrolN'); if (patrol) { patrol.textContent = '🐾' + (g.hydrants || 0); patrol.title = 'Paw Patrol: ' + (g.hydrants || 0) + ' hydrants marked'; }
  const chips = []; if (P.mode === 'car') chips.push(['🚗', Math.ceil(P.carT)]); if (P.board > 0) chips.push(['🛹', Math.ceil(P.board)]); if (P.mode === 'cable') chips.push(['🚋', '']);
  const icons = { ghost: '👻', magnet: '🧲', turbo: '⚡', jammer: '📡', buzz: '🍺' }; for (const k in icons) if (g.buffs[k] > 0) chips.push([icons[k], Math.ceil(g.buffs[k])]);
  const html = chips.map(c => `<span class="chip">${c[0]}<b>${c[1]}</b></span>`).join(''); if (hud.chips._h !== html) { hud.chips.innerHTML = html; hud.chips._h = html; }
  // Pascal off-screen arrow
  const pz = K.A.pascal; const d = Math.hypot(pz.x - P.x, pz.z - P.z);
  if (d < 90 && pz.wait <= 0) { const v = new T.Vector3(pz.x, pz.y + 3, pz.z).project(camera); const on = v.z < 1 && Math.abs(v.x) < .92 && Math.abs(v.y) < .9;
    if (!on) { let ax = v.x, ay = v.y; if (v.z > 1) { ax = -ax; ay = -ay; } const a = Math.atan2(ay, ax); const R = .86; const px = (Math.cos(a) * R * .5 + .5) * K.VW, py = (-Math.sin(a) * R * .5 + .5) * K.VH;
      hud.arrow.hidden = false; hud.arrow.style.transform = `translate(${px}px,${py}px) rotate(${-a}rad)`; hud.arrow.classList.toggle('hot', d < 25); } else hud.arrow.hidden = true; } else hud.arrow.hidden = true;
};
/* Desktop action strip and pooled world badges share the production readiness gates. */
const shortcutDefs = [
  ['KeyW','WASD','Move','✥'], ['ShiftLeft','SHIFT','Run','»'], ['Space','SPC ↑','Jump','⤒'],
  ['KeyB','B ↓','Bark','◖'], ['KeyE','E →','Act','↗'], ['KeyQ','Q ←','Kyotoken','✦'],
  ['KeyF','F','Pee','⚑'], ['KeyC','C','Look back','⟲'], ['KeyL','L','Map','◇'], ['Tab','TAB','Photos','▣'],
  ['KeyJ','J','Family','♡'], ['KeyP','P','Pause','Ⅱ']
];
let shortcutBar, shortcutToggle, cueLayer;
const shortcuts = [], badgePool = [], badgePoint = new T.Vector3();
UI.actionReady = { E: false, F: false, B: false, Q: false };
UI.actionCues = [];
UI.buildShortcuts = () => {
  if (shortcutBar) return;
  const dock = document.createElement('div'); dock.id = 'shortcutDock';
  shortcutToggle = document.createElement('button'); shortcutToggle.id = 'shortcutToggle'; shortcutToggle.type = 'button';
  shortcutToggle.textContent = '⌨'; shortcutToggle.title = 'Show or hide controls'; shortcutToggle.setAttribute('aria-label', 'Show or hide controls'); shortcutToggle.setAttribute('aria-expanded', 'true');
  shortcutBar = document.createElement('div'); shortcutBar.id = 'shortcutBar'; shortcutBar.setAttribute('role', 'toolbar'); shortcutBar.setAttribute('aria-label', 'Game controls');
  shortcutToggle.setAttribute('aria-controls', 'shortcutBar');
  shortcutToggle.onclick = () => { shortcutBar.hidden = !shortcutBar.hidden; shortcutToggle.setAttribute('aria-expanded', String(!shortcutBar.hidden)); shortcutToggle.blur(); };
  for (const [code,key,verb,icon] of shortcutDefs) {
    const b = document.createElement('button'); b.type = 'button'; b.dataset.code = code;
    b.innerHTML = '<i aria-hidden="true">'+icon+'</i><kbd>'+key+'</kbd><span>'+verb+'</span>';
    b.setAttribute('aria-label', verb+' ('+key+')'); b.title = verb+' · '+key;
    // Movement remains keyboard-held; action/menu shortcuts are also clickable.
    if (code === 'KeyW' || code === 'ShiftLeft') { b.tabIndex = -1; b.setAttribute('aria-disabled', 'true'); }
    else b.onclick = () => { if (K.game.state === 'play') { K.testKey(code); K.keys[code] = false; } b.blur(); };
    shortcutBar.appendChild(b); shortcuts.push(b);
  }
  dock.append(shortcutBar, shortcutToggle); $('#hud').appendChild(dock);
  cueLayer = document.createElement('div'); cueLayer.id = 'actionCues'; cueLayer.setAttribute('aria-hidden', 'true'); $('#hud').appendChild(cueLayer);
};
let cueHUDObstacles = [], cueHUDSignature = '';
const cueHUDSelectors = '#mmWrap,#tokBox,#topC,#stamBox,#utilityBar,#hudBtns,#touch-top,#touch-actions button,#kvBtn,#flypodQuest,#prompt,#shortcutDock';
function refreshCueHUDObstacles() {
  const elements = [...document.querySelectorAll(cueHUDSelectors)];
  const signature = [K.VW,K.VH,document.body.className,document.getElementById('hud').style.visibility,document.fonts && document.fonts.status,
    ...elements.map(e => (e.id || e.className)+'|'+!!e.closest('[hidden]')+'|'+e.textContent)].join('~');
  if (signature === cueHUDSignature) return;
  cueHUDSignature = signature; cueHUDObstacles = [];
  for (const e of elements) {
    if (e.closest('[hidden]')) continue;
    const css = getComputedStyle(e); if (css.visibility === 'hidden' || css.display === 'none') continue;
    const r = e.getBoundingClientRect(); if (r.width > 0 && r.height > 0) cueHUDObstacles.push({left:r.left,top:r.top,right:r.right,bottom:r.bottom});
  }
}
function placeBadge(index, x, y, z, key, label, waymo, drawn) {
  badgePoint.set(x,y,z); const p = K.A.project(badgePoint);
  if (!p.ok || p.x < 24 || p.x > K.VW - 24 || p.y < 36 || p.y > K.VH - 90) return index;
  if (!key && !(K.sceneCam && K.sceneCam.noClip) && W.clipCamera && W.clipCamera(K.camera.position, badgePoint, .05) < .94) return index;
  if (drawn && sameActionCueNearby(key,p,drawn)) return index;
  let b = badgePool[index];
  if (!b) { b = document.createElement('div'); b.innerHTML = '<kbd></kbd><span></span>'; cueLayer.appendChild(b); badgePool.push(b); }
  b.hidden = false; b.className = waymo ? 'world-cue waymo-cue' : 'world-cue';
  b.firstChild.textContent = key; b.firstChild.hidden = !key; b.lastChild.textContent = label;
  const css = getComputedStyle(cueLayer), safeLeft = parseFloat(css.getPropertyValue('--cue-safe-left')) || 0,
    safeRight = parseFloat(css.getPropertyValue('--cue-safe-right')) || 0, safeTop = parseFloat(css.getPropertyValue('--cue-safe-top')) || 0,
    safeBottom = parseFloat(css.getPropertyValue('--cue-safe-bottom')) || 0;
  const measureKey = [key,label,waymo,K.VW,K.VH,document.fonts && document.fonts.status].join('|');
  if (b._cueMeasureKey !== measureKey) { b._cueMeasureKey = measureKey; b._cueWidth = b.offsetWidth; b._cueHeight = b.offsetHeight; }
  const width = b._cueWidth, height = b._cueHeight, halfWidth = width/2, edge = 8, gap = 8;
  const clampX = v => Math.max(halfWidth+edge+safeLeft,Math.min(K.VW-halfWidth-edge-safeRight,v));
  const boxAt = c => ({left:c.x-halfWidth,right:c.x+halfWidth,top:c.y-height,bottom:c.y});
  const obstacles = cueHUDObstacles.concat((drawn || []).filter(d=>d.box).map(d=>d.box));
  const clear = c => { const r=boxAt(c); return r.top>=safeTop+edge && r.bottom<=K.VH-safeBottom-edge &&
    obstacles.every(o=>r.right<=o.left-gap || r.left>=o.right+gap || r.bottom<=o.top-gap || r.top>=o.bottom+gap); };
  const candidates = [{x:clampX(p.x),y:p.y,below:false},{x:clampX(p.x),y:p.y+height+gap,below:true}];
  for (const d of [width+gap,2*(width+gap)]) for (const sign of [-1,1]) candidates.push({x:clampX(p.x+sign*d),y:p.y,below:false});
  for (const d of [48,96,144]) candidates.push({x:clampX(p.x),y:p.y-d,below:false},{x:clampX(p.x),y:p.y+height+gap+d,below:true});
  const chosen = candidates.find(clear); if (!chosen) { b.hidden = true; return index; }
  chosen.x = Math.round(chosen.x); chosen.y = Math.round(chosen.y);
  const box = boxAt(chosen), tailX = Math.max(8,Math.min(width-16,p.x-box.left-4));
  b.style.setProperty('--cue-tail-x',tailX+'px'); b.style.setProperty('--cue-tail-top',chosen.below?'-6px':'auto');
  b.style.setProperty('--cue-tail-bottom',chosen.below?'auto':'-6px'); b.style.setProperty('--cue-tail-rotation',chosen.below?'225deg':'45deg');
  b.style.transform = 'translate(-50%,-100%) translate('+chosen.x+'px,'+chosen.y+'px)';
  if (drawn) drawn.push({key,x:p.x,y:p.y,anchor:{x:p.x,y:p.y,z:p.z},labelX:chosen.x,labelY:chosen.y,below:chosen.below,box});
  return index + 1;
}
UI.updateActionCues = () => {
  if (!shortcutBar || !K.game) return;
  const playing = K.game.state === 'play' && !(K.agent && K.agent.open), ready = UI.actionReady;
  shortcutBar.parentNode.hidden = !playing; cueLayer.hidden = !playing;
  // Commit this frame's final camera quaternion before projecting world labels.
  if (playing) { K.camera.updateMatrixWorld(true); refreshCueHUDObstacles(); }
  for (const key in ready) ready[key] = false;
  const targets = UI.actionCues = playing && K.hudTargets ? K.hudTargets() : [];
  for (const t of targets) ready[t.key] = true;
  if (playing && K.agent) ready.Q = K.agent.abilities.some((a,i) => K.agent.reason ? !K.agent.reason(i) : K.game.tokens >= a[1] && K.agent.cooldowns[i] <= 0);
  if (playing && K.A.player.mode === 'car' && K.A.player.interactT <= 0) ready.E = true;
  for (let i=0;i<shortcuts.length;i++) {
    const b=shortcuts[i],code=shortcutDefs[i][0], active=!!ready[code.slice(3)];
    b.classList.toggle('ready',active); b.classList.toggle('pressed',!!K.keys[code] || code==='KeyW' && !!(K.inp.mx || K.inp.mz));
  }
  let used=0; const drawnCues=[];
  if (playing) {
    for (const t of targets) { if (used >= 12) break; used=placeBadge(used,t.x,t.y+t.height,t.z,t.key,t.o.kind === 'waymo' ? 'WAYMO' : t.label,t.o.kind === 'waymo',drawnCues); }
    const P=K.A.player;
    let count=0;
    for (const c of K.A.cars) if (c.kind==='waymo' && c.mode!=='driven' && Math.hypot(c.x-P.x,c.z-P.z)<45 && count<4) {
      if (targets.some(t=>t.o===c)) continue;
      used=placeBadge(used,c.x,(c.bot||0)+3.05,c.z,'','WAYMO',true); count++;
    }
  }
  UI.actionCueLayout={drawn:drawnCues,sameKeyMergeRadiusCSS:40};
  for(let i=used;i<badgePool.length;i++)badgePool[i].hidden=true;
};
K.on('frame', UI.updateActionCues);
K.on('pause', UI.updateActionCues);
K.on('end', UI.updateActionCues);

UI.minimap = function () {
  const P = K.A.player, c = hud.mm, g = hud.mmg, Wd = c.width, R = Wd / 2, k = Wd / 230;
  const rot = -Math.PI / 2 - Math.atan2(Math.cos(K.game.camYaw), Math.sin(K.game.camYaw)); const cr = Math.cos(rot), sr = Math.sin(rot);
  g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, Wd, Wd); g.save(); g.beginPath(); g.arc(R, R, R, 0, 7); g.clip();
  g.fillStyle = '#2f7fa0'; g.fillRect(0, 0, Wd, Wd);
  g.translate(R, R); g.rotate(rot); g.scale(k / W.MS, k / W.MS); g.drawImage(W.mapCanvas, -W.mapX(P.x), -W.mapZ(P.z)); g.restore();
  const to = (x, z) => { const dx = (x - P.x) * k, dz = (z - P.z) * k; return [R + dx * cr - dz * sr, R + dx * sr + dz * cr]; };
  const dot = (x, z, r, col, edge, label) => { let [sx, sy] = to(x, z); const dx = sx - R, dy = sy - R, dd = Math.hypot(dx, dy); if (dd > R - 10) { if (!edge) return; sx = R + dx / dd * (R - 10); sy = R + dy / dd * (R - 10); }
    g.fillStyle = '#241634'; g.beginPath(); g.arc(sx, sy, r + 2.5, 0, 7); g.fill(); g.fillStyle = col; g.beginPath(); g.arc(sx, sy, r, 0, 7); g.fill();
    if (label) { g.fillStyle = '#241634'; g.font = `bold ${Math.round(r * 1.3)}px Bangers, Impact, sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(label, sx, sy + 1); } };
  const icon = (x,z,kind,color,edge=false) => {
    let [sx,sy]=to(x,z); const dx=sx-R,dy=sy-R,d=Math.hypot(dx,dy);
    if(d>R-13){if(!edge)return;sx=R+dx/d*(R-13);sy=R+dy/d*(R-13);}
    g.save();g.translate(sx,sy);g.lineWidth=2.5;g.strokeStyle='#241634';g.fillStyle=color;
    if(kind==='car'){g.fillRect(-8,-5,16,10);g.strokeRect(-8,-5,16,10);g.fillStyle='#29bbc9';g.fillRect(-3,-3,6,6);g.fillStyle='#241634';for(const x0 of [-6,4]){g.fillRect(x0,-7,3,3);g.fillRect(x0,4,3,3);}}
    else if(kind==='mail'){g.fillRect(-8,-6,16,12);g.strokeRect(-8,-6,16,12);g.beginPath();g.moveTo(-7,-5);g.lineTo(0,1);g.lineTo(7,-5);g.stroke();}
    else if(kind==='vespa'){g.beginPath();g.moveTo(-7,4);g.lineTo(4,4);g.lineTo(4,-7);g.lineTo(0,-7);g.stroke();g.fillRect(-7,-2,10,6);g.beginPath();g.arc(-6,6,3,0,7);g.arc(6,6,3,0,7);g.fill();g.stroke();}
    else{g.beginPath();g.arc(0,0,9,0,7);g.fill();g.stroke();g.fillStyle='#241634';g.font='bold 11px Arial';g.textAlign='center';g.textBaseline='middle';g.fillText(kind,0,1);}
    g.restore();
  };
  K.A.cars.forEach(c2 => { if(c2.kind==='waymo')icon(c2.x,c2.z,'car','#fff'); });
  const boss=K.A.boss;if(boss)icon(boss.x,boss.z,'vespa','#ff514f',true);
  for(const c of K.life ? K.life.carriers : [])icon(c.x,c.z,'mail','#fff2bd');
  for(const c of K.ceos ? K.ceos.state.actors : [])if(c.active)icon(c.x,c.z,c.id==='elon'?'E':c.id==='sam'?'S':'D','#c9a3ff',true);
  const cam = (x, z, edge) => { let [sx, sy] = to(x, z); const dx = sx - R, dy = sy - R, dd = Math.hypot(dx, dy); if (dd > R - 14) { if (!edge) return; sx = R + dx / dd * (R - 14); sy = R + dy / dd * (R - 14); } else if (edge) return;
    const rr = (x0, y0, w, h, r) => { g.beginPath(); g.moveTo(x0 + r, y0); g.arcTo(x0 + w, y0, x0 + w, y0 + h, r); g.arcTo(x0 + w, y0 + h, x0, y0 + h, r); g.arcTo(x0, y0 + h, x0, y0, r); g.arcTo(x0, y0, x0 + w, y0, r); g.closePath(); g.fill(); };
    g.save(); g.translate(sx, sy); g.globalAlpha = edge ? .85 : 1; g.fillStyle = '#241634'; rr(-12, -9, 24, 18, 5); rr(-5, -12, 10, 5, 2); g.fillStyle = '#ff4fa3'; rr(-9.5, -6.5, 19, 13, 3); g.fillStyle = '#fff'; g.beginPath(); g.arc(0, .5, 4.4, 0, 7); g.fill(); g.fillStyle = '#29d3c8'; g.beginPath(); g.arc(0, .5, 2.6, 0, 7); g.fill(); g.restore(); };
  let nearest = null, nd = Infinity; for (const s of K.A.photos || []) { if (s.got) continue; const d = Math.hypot(s.x - P.x, s.z - P.z); if (d < nd) { nd = d; nearest = s; } cam(s.x, s.z, false); }
  if (nearest) cam(nearest.x, nearest.z, true);
  if (K.campaign) {
    for (const j of K.campaign.jobs) if (!K.campaign.collected.has(j)) icon(j.x,j.z,'F','#b7f84a');
    for (const q of K.campaign.kiosks) icon(q.x,q.z,'D','#8aa1a8');
    const queue=K.campaign.jobs.filter(j=>K.campaign.collected.has(j)&&!K.campaign.deployed.has(j));
    const targets=K.campaign.carried?K.campaign.pads.filter(p=>p.phase==='idle').map(p=>({x:p.approachWorld[0],z:p.approachWorld[2]})):K.campaign.jobs.filter(j=>j.phase==='available');
    const next=targets.slice().sort((a,b)=>Math.hypot(a.x-P.x,a.z-P.z)-Math.hypot(b.x-P.x,b.z-P.z))[0];
    if(next){let [x,y]=to(next.x,next.z);const d=Math.hypot(x-R,y-R);if(d>R-17){x=R+(x-R)/d*(R-17);y=R+(y-R)/d*(R-17);}g.save();g.strokeStyle='#b7f84a';g.lineWidth=3;g.setLineDash([5,5]);g.beginPath();g.moveTo(R,R);g.lineTo(x,y);g.stroke();g.restore();icon(next.x,next.z,queue.length?'D':'F','#b7f84a',true);}
  }
  K.A.agents.forEach(a => dot(a.pos.x, a.pos.z, 3.5, a.hacked ? '#29d3c8' : '#ff5a4e'));
  K.A.letters.forEach(l => { if (!l.got) dot(l.x, l.z, 9, '#ffcf3f', true, l.ch); });
  const pz = K.A.pascal; dot(pz.x, pz.z, 8, '#ff7a3d', true, 'P');
  g.fillStyle = '#fff'; g.strokeStyle = '#241634'; g.lineWidth = 4; g.beginPath(); const hh = rot + Math.atan2(Math.cos(P.heading), Math.sin(P.heading)); g.translate(R, R); g.rotate(hh + Math.PI / 2); g.moveTo(0, -12); g.lineTo(9, 9); g.lineTo(0, 4); g.lineTo(-9, 9); g.closePath(); g.stroke(); g.fill(); g.setTransform(1, 0, 0, 1, 0, 0);
};

/* ---------- full San Francisco map (L or tap the minimap) ---------- */
const LM_ICONS = { ggb_tower: ['🌉', 'Golden Gate'], alcatraz_cellhouse: ['🏝️', 'Alcatraz'], coit: ['🗼', 'Coit Tower'], transamerica: ['🔺', 'Transamerica'], ferry: ['⛴️', 'Ferry Bldg'], palace: ['🏛️', 'Palace of Fine Arts'],
  painted: ['🏠', 'Painted Ladies'], chinagate: ['🏮', 'Chinatown'], salesforce: ['🏙️', 'Salesforce'], oracle_glove: ['⚾', 'Oracle Park'], windmill: ['🌷', 'Windmill'], sutro: ['📡', 'Sutro Tower'], conservatory: ['🌿', 'Conservatory'], lighthouse: ['🚨', 'Lighthouse'], japantown: ['🌸', 'Japantown'] };
function mapSegmentsCross(a,b) {
  const turn=(p,q,r)=>(q[0]-p[0])*(r[1]-p[1])-(q[1]-p[1])*(r[0]-p[0]);
  const on=(p,q,r)=>Math.abs(turn(p,q,r))<1e-6&&r[0]>=Math.min(p[0],q[0])-1e-6&&r[0]<=Math.max(p[0],q[0])+1e-6&&r[1]>=Math.min(p[1],q[1])-1e-6&&r[1]<=Math.max(p[1],q[1])+1e-6;
  const p=a.from,q=a.to,r=b.from,s=b.to,t1=turn(p,q,r),t2=turn(p,q,s),t3=turn(r,s,p),t4=turn(r,s,q);
  return (t1*t2<0&&t3*t4<0)||on(p,q,r)||on(p,q,s)||on(r,s,p)||on(r,s,q);
}
function mapSegmentHitsBox(line,b,pad=0) {
  const x=b.x-pad,y=b.y-pad,w=b.w+2*pad,h=b.h+2*pad;
  const inside=p=>p[0]>=x&&p[0]<=x+w&&p[1]>=y&&p[1]<=y+h;
  return inside(line.from)||inside(line.to)||[[[x,y],[x+w,y]],[[x+w,y],[x+w,y+h]],[[x+w,y+h],[x,y+h]],[[x,y+h],[x,y]]].some(e=>mapSegmentsCross(line,{from:e[0],to:e[1]}));
}
function mapLeadersConflict(a,b,dpr=1) {
  if(!mapSegmentsCross(a,b))return false;
  if(Math.hypot(a.from[0]-b.from[0],a.from[1]-b.from[1])>2*dpr)return true;
  // Different icons at one world position may fan out from a shared junction.
  const av=[a.to[0]-a.from[0],a.to[1]-a.from[1]],bv=[b.to[0]-b.from[0],b.to[1]-b.from[1]],length=Math.hypot(...av)*Math.hypot(...bv);
  return length>0&&(av[0]*bv[0]+av[1]*bv[1])/length>.985;
}
function layoutCompactMapNames(labels,obstacles,width,height,dpr,measure,markerLeaders=[],requests=[]) {
  const overlaps=(a,b)=>a.x<b.x+b.w&&a.x+a.w>b.x&&a.y<b.y+b.h&&a.y+a.h>b.y;
  const occupied=obstacles.slice(),leaders=[],badges=[],unresolved=[],pad=4*dpr,reach=12*dpr;
  const numbered=labels.map((l,i)=>({...l,number:l.number||i+1}));
  const order=numbered.slice().sort((a,b)=>{
    const crowd=l=>numbered.filter(o=>o!==l&&Math.hypot(o.sx-l.sx,o.sy-l.sy)<48*dpr).length;
    return crowd(b)-crowd(a)||a.number-b.number;
  });
  for(const label of order) {
    const candidates=[[label.sx,label.sy]];
    for(const r of [6,10,14,18,22,26,30])for(let i=0;i<24;i++){
      const a=i*Math.PI/12;candidates.push([label.sx+Math.cos(a)*r*dpr,label.sy+Math.sin(a)*r*dpr]);
    }
    const boxAt=([sx,sy])=>({x:sx-reach,y:sy-reach,w:2*reach,h:2*reach,kind:'landmark-badge',id:label.key,sx,sy});
    const lineAt=box=>{
      const dx=box.sx-label.sx,dy=box.sy-label.sy,distance=Math.hypot(dx,dy),trim=Math.min(distance,10*dpr);
      const to=distance?[box.sx-dx/distance*trim,box.sy-dy/distance*trim]:[box.sx,box.sy];
      return {key:label.key,from:[label.sx,label.sy],to,lengthCSS:Math.max(0,distance-trim)/dpr};
    };
    const boxes=candidates.map(boxAt).filter(b=>b.x>=pad&&b.y>=pad&&b.x+b.w<=width-pad&&b.y+b.h<=height-pad);
    const safeLine=(b,line)=>line.lengthCSS<=20&&!occupied.some(o=>!(label.sx>=o.x&&label.sx<=o.x+o.w&&label.sy>=o.y&&label.sy<=o.y+o.h)&&mapSegmentHitsBox(line,o,dpr))&&![...markerLeaders,...leaders].some(l=>mapLeadersConflict(line,l,dpr)||mapSegmentHitsBox(l,b,dpr));
    let chosen=boxes.find(b=>!occupied.some(o=>overlaps(b,o))&&safeLine(b,lineAt(b)));
    if(!chosen){
      // Keep the landmark visible and disclose an unresolved dense future scene.
      chosen=boxes.slice().sort((a,b)=>occupied.filter(o=>overlaps(a,o)).length-occupied.filter(o=>overlaps(b,o)).length)[0];
      unresolved.push(label.key);
    }
    if(!chosen){unresolved.push(label.key);continue;}
    const line=lineAt(chosen),trailSafe=safeLine(chosen,line);occupied.push(chosen);
    if(line.lengthCSS>1&&trailSafe)leaders.push(line);
    badges.push({...label,...chosen,anchorX:label.sx,anchorY:label.sy,radius:9*dpr,leaderLengthCSS:line.lengthCSS});
  }
  // Place larger collectible and quest symbols before the small photo dots.
  // Their keys and world anchors are unchanged; the paint callbacks stay original.
  const symbols={};
  const ordered=requests.slice().sort((a,b)=>b.radius-a.radius||a.id.localeCompare(b.id));
  for(const request of ordered){
    const reach=request.radius+4*dpr,candidates=[];
    const add=(sx,sy)=>{if(Math.hypot(sx-request.anchorX,sy-request.anchorY)>48*dpr)return;const b={x:sx-reach,y:sy-reach,w:2*reach,h:2*reach,kind:request.kind||'marker',id:request.id,sx,sy};if(b.x>=pad&&b.y>=pad&&b.x+b.w<=width-pad&&b.y+b.h<=height-pad)candidates.push(b);};
    const cx=request.anchorX+(request.offsetX||0),cy=request.anchorY+(request.offsetY||0);add(cx,cy);
    for(let r=4;r<=48;r+=4)for(let k=0;k<32;k++){const a=k*Math.PI/16;add(cx+Math.cos(a)*r*dpr,cy+Math.sin(a)*r*dpr);}
    candidates.sort((a,b)=>Math.hypot(a.sx-cx,a.sy-cy)-Math.hypot(b.sx-cx,b.sy-cy));
    let chosen=candidates.find(b=>!occupied.some(o=>overlaps(b,o)));
    if(!chosen){unresolved.push(request.id);chosen=candidates.slice().sort((a,b)=>occupied.filter(o=>overlaps(a,o)).length-occupied.filter(o=>overlaps(b,o)).length)[0];}
    if(chosen){symbols[request.id]=chosen;occupied.push(chosen);}
  }
  // Resolve the complete compact cluster as one bounded layout, not stream order.
  const all=[...badges.map(b=>({box:b,anchorX:b.anchorX,anchorY:b.anchorY,max:30*dpr})),...requests.filter(r=>symbols[r.id]).map(r=>({box:symbols[r.id],anchorX:r.anchorX,anchorY:r.anchorY,max:48*dpr}))];
  const clampSymbol=item=>{
    const b=item.box,reach=b.w/2;let x=b.x+reach,y=b.y+reach;
    const dx=x-item.anchorX,dy=y-item.anchorY,d=Math.hypot(dx,dy);if(d>item.max){x=item.anchorX+dx/d*item.max;y=item.anchorY+dy/d*item.max;}
    x=Math.max(pad+reach,Math.min(width-pad-reach,x));y=Math.max(pad+reach,Math.min(height-pad-reach,y));b.x=x-reach;b.y=y-reach;b.sx=x;b.sy=y;
  };
  const separate=(a,b,amount)=>{
    const dx=Math.min(a.x+a.w,b.x+b.w)-Math.max(a.x,b.x),dy=Math.min(a.y+a.h,b.y+b.h)-Math.max(a.y,b.y);if(dx<=0||dy<=0)return false;
    if(dx<dy){const sign=a.x+a.w/2<b.x+b.w/2?-1:1;a.x+=sign*(dx+.02*dpr)*amount;if(amount<1)b.x-=sign*(dx+.02*dpr)*(1-amount);}
    else{const sign=a.y+a.h/2<b.y+b.h/2?-1:1;a.y+=sign*(dy+.02*dpr)*amount;if(amount<1)b.y-=sign*(dy+.02*dpr)*(1-amount);}
    return true;
  };
  for(let pass=0;pass<800;pass++){
    let changed=false;for(let i=0;i<all.length;i++){const a=all[i];for(const o of obstacles)changed=separate(a.box,o,1)||changed;for(let j=i+1;j<all.length;j++)changed=separate(a.box,all[j].box,.5)||changed;clampSymbol(a);}for(const a of all)clampSymbol(a);if(!changed)break;
  }
  unresolved.length=0;for(let i=0;i<all.length;i++){const a=all[i];if(obstacles.some(o=>overlaps(a.box,o))||all.some((b,j)=>j!==i&&overlaps(a.box,b.box)))unresolved.push(a.box.id);}
  leaders.length=0;for(const b of badges){const dx=b.sx-b.anchorX,dy=b.sy-b.anchorY,d=Math.hypot(dx,dy),trim=Math.min(d,10*dpr);b.leaderLengthCSS=Math.max(0,d-trim)/dpr;if(b.leaderLengthCSS>1)leaders.push({key:b.key,from:[b.anchorX,b.anchorY],to:[b.sx-dx/d*trim,b.sy-dy/d*trim],lengthCSS:b.leaderLengthCSS});}
  return {symbols,placements:[],leaders,fallbacks:badges.sort((a,b)=>a.number-b.number),occupied,unresolved:[...new Set(unresolved)],placementOrder:order.map(l=>l.key),maximumLeaderLengthCSS:Math.max(0,...leaders.map(l=>l.lengthCSS)),minimumBadgeClearanceCSS:4};
}

function routeCompactMapLeaders(lines,boxes,width,height,dpr,priority=[],attempt=0) {
  const routed=[],unrouted=[],pad=0;
  const length=points=>points.slice(1).reduce((sum,p,i)=>sum+Math.hypot(p[0]-points[i][0],p[1]-points[i][1]),0)/dpr;
  for(const input of lines.slice().sort((a,b)=>{const rank=l=>{const i=priority.indexOf(l.key||l.id);return i<0?999:i;};return rank(a)-rank(b)||b.lengthCSS-a.lengthCSS;})){
    let line={...input};
    if(line.id){const own=boxes.find(b=>b.id===line.id),dx=line.to[0]-line.from[0],dy=line.to[1]-line.from[1],distance=Math.hypot(dx,dy),trim=own?Math.min(distance,Math.max(0,own.w/2-4*dpr)):0;line.targetCenter=line.to;line.to=distance?[line.to[0]-dx/distance*trim,line.to[1]-dy/distance*trim]:line.to;}
    const id=line.key||line.id,origin=line.from;
    const routeBoxes=boxes;
    const blockers=routeBoxes.filter(b=>b.id!==id&&b.kind!=='label'&&!(origin[0]>=b.x&&origin[0]<=b.x+b.w&&origin[1]>=b.y&&origin[1]<=b.y+b.h));
    const limit=line.key?20:48;
    const clear=(a,b)=>!blockers.some(o=>mapSegmentHitsBox({from:a,to:b},o,pad))&&!routed.some(other=>other.segments.some(seg=>mapLeadersConflict({from:a,to:b},seg,dpr)));
    let points=[line.from,line.to];
    if(!clear(...points)){
      const radius=limit*dpr,near=blockers.filter(b=>b.x<Math.max(origin[0],line.to[0])+radius&&b.x+b.w>Math.min(origin[0],line.to[0])-radius&&b.y<Math.max(origin[1],line.to[1])+radius&&b.y+b.h>Math.min(origin[1],line.to[1])-radius);
      const nodes=[line.from,line.to],goals=new Set([1]);
      if(line.id){const own=boxes.find(b=>b.id===line.id),center=line.targetCenter;if(own)for(let k=0;k<16;k++){const a=k*Math.PI/8;goals.add(nodes.length);nodes.push([center[0]+Math.cos(a)*own.w/2,center[1]+Math.sin(a)*own.h/2]);}}
      for(const b of near)for(const x of [b.x-pad-.005*dpr,b.x+b.w+pad+.005*dpr])for(const y of [b.y-pad-.005*dpr,b.y+b.h+pad+.005*dpr])if(x>=dpr&&x<=width-dpr&&y>=dpr&&y<=height-dpr&&!blockers.some(o=>x>=o.x-pad&&x<=o.x+o.w+pad&&y>=o.y-pad&&y<=o.y+o.h+pad))nodes.push([x,y]);
      for(const prior of routed)for(const point of prior.points)if(Math.hypot(point[0]-origin[0],point[1]-origin[1])+Math.hypot(point[0]-line.to[0],point[1]-line.to[1])<2*radius)for(let k=0;k<8;k++){const a=k*Math.PI/4,x=point[0]+Math.cos(a)*dpr,y=point[1]+Math.sin(a)*dpr;if(x>=dpr&&x<=width-dpr&&y>=dpr&&y<=height-dpr&&!blockers.some(o=>x>=o.x&&x<=o.x+o.w&&y>=o.y&&y<=o.y+o.h))nodes.push([x,y]);}
      let target=1;const dist=nodes.map(()=>Infinity),previous=nodes.map(()=>-1),done=new Set();dist[0]=0;
      for(let pass=0;pass<nodes.length;pass++){
        let a=-1;for(let i=0;i<nodes.length;i++)if(!done.has(i)&&(a<0||dist[i]<dist[a]))a=i;
        if(a<0||!Number.isFinite(dist[a])||dist[a]>limit*dpr)break;if(goals.has(a)){target=a;break;}done.add(a);
        for(let b=0;b<nodes.length;b++)if(b!==a&&!done.has(b)){const next=dist[a]+Math.hypot(nodes[a][0]-nodes[b][0],nodes[a][1]-nodes[b][1]);if(next<dist[b]&&next<=limit*dpr&&clear(nodes[a],nodes[b])){dist[b]=next;previous[b]=a;}}
      }
      if(!Number.isFinite(dist[target])){unrouted.push(id);continue;}
      points=[];for(let i=target;i>=0;i=previous[i])points.unshift(nodes[i]);
    }
    const segments=points.slice(1).map((to,i)=>({key:line.key,id:line.id,from:points[i],to,origin}));
    routed.push({...line,points,segments,lengthCSS:length(points)});
  }
  if(unrouted.length&&attempt<3)return routeCompactMapLeaders(lines,boxes,width,height,dpr,[...unrouted,...priority.filter(id=>!unrouted.includes(id))],attempt+1);
  return{routed,unrouted,attempts:attempt+1};
}

function sameActionCueNearby(key,point,drawn) {
  return !!key&&drawn.some(c=>c.key===key&&Math.hypot(c.x-point.x,c.y-point.y)<=40);
}

UI.bigMap = function (on) {
  let el = document.getElementById('bigmap');
  if (!on) { if (el) el.hidden = true; UI.mapOpen = false; return; }
  if (!el) {
    el = document.createElement('div'); el.id = 'bigmap'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-label', 'San Francisco map'); el.setAttribute('aria-modal', 'true');
    el.innerHTML = '<div class="bm-card"><div class="bm-title">SAN FRANCISCO</div><div class="bm-content"><canvas width="1100" height="900"></canvas><div class="bm-sidebar"><div class="bm-legend"><span class="bm-item"><span class="k">➤</span> You (Kyoto)</span><span class="bm-item"><span class="p">●</span> Pascal</span><span class="bm-item"><span class="l">●</span> letters</span><span class="bm-item"><span class="c">●</span> photos</span><span class="bm-item bm-landmark"><span class="lm">①</span> landmarks · see key</span><span class="bm-item bm-waymo"><span class="w">●</span> Waymo</span><span class="bm-item"><span class="f">F</span> folder</span><span class="bm-item"><span class="d"><i>D</i></span> deploy</span></div><div class="bm-scroll-cue" aria-hidden="true">LANDMARK KEY · SCROLL FOR MORE ↓</div><div class="bm-key" aria-label="Numbered landmarks" hidden></div></div></div><button class="bm-close" aria-label="Close map">✕</button></div>';
    const st = document.createElement('style'); st.textContent = `#bigmap{--bm-safe-top:env(safe-area-inset-top,0px);--bm-safe-right:env(safe-area-inset-right,0px);--bm-safe-bottom:env(safe-area-inset-bottom,0px);--bm-safe-left:env(safe-area-inset-left,0px);position:fixed;inset:0;z-index:40;display:flex;align-items:center;justify-content:center;box-sizing:border-box;padding:calc(12px + var(--bm-safe-top)) calc(12px + var(--bm-safe-right)) calc(20px + var(--bm-safe-bottom)) calc(12px + var(--bm-safe-left));background:rgba(20,12,34,.55);backdrop-filter:blur(3px)}
#bigmap[hidden]{display:none}.bm-card{position:relative;background:#fff4dc;border:5px solid #241634;border-radius:22px;box-shadow:0 10px 0 #241634,0 24px 60px rgba(0,0,0,.45);box-sizing:border-box;padding:14px;max-width:min(94vw,1100px);max-height:92vh;display:flex;flex-direction:column;align-items:center;transform:rotate(-.6deg)}
.bm-content{display:flex;flex-direction:column;align-items:center;width:100%;min-width:0}.bm-sidebar{width:100%;min-width:0}.bm-card canvas{width:100%;height:auto;flex-shrink:0;object-fit:contain;border-radius:14px;border:4px solid #241634;background:#2f7fa0}
.bm-title{font:clamp(23px,5vw,44px) Bangers,Impact,sans-serif;padding-right:54px;box-sizing:border-box;width:100%;min-height:48px;display:flex;align-items:center;justify-content:center;flex-shrink:0;letter-spacing:3px;color:#ff4fa3;-webkit-text-stroke:2px #241634;text-shadow:0 4px 0 #241634;margin:-4px 0 6px}
.bm-legend{flex-shrink:0;font:bold 15px system-ui,sans-serif;color:#241634;margin-top:8px;display:flex;gap:10px;flex-wrap:wrap;justify-content:center}.bm-legend .k{display:inline-grid;place-items:center;width:18px;height:18px;box-sizing:border-box;border:2px solid #fff;border-radius:50%;background:#ffb020;color:#241634;box-shadow:0 0 0 1px #241634;font:900 15px/1 system-ui}.bm-legend .p{color:#ff7a3d}.bm-legend .l{color:#ffcf3f}.bm-legend .c{color:#ff4fa3}.bm-legend .w{color:#e8edf5;-webkit-text-stroke:1px #241634}
.bm-legend .f,.bm-legend .d{display:inline-grid;place-items:center;width:18px;height:18px;border:2px solid #241634;color:#241634;line-height:1}.bm-legend .f{border-radius:50%;background:#b7f84a}.bm-legend .d{background:#8aa1a8;transform:rotate(45deg);margin:0 3px}.bm-legend .d i{font-style:normal;transform:rotate(-45deg)}
.bm-legend .bm-item{display:inline-flex;align-items:center;gap:4px;white-space:nowrap}.bm-card[data-compact="true"] .bm-waymo{display:none}.bm-key{height:80px;max-height:80px;overflow-y:auto;flex-shrink:0;width:100%;box-sizing:border-box;margin-top:4px;display:flex;align-content:flex-start;justify-content:center;flex-wrap:wrap;gap:2px 10px;font:bold 10px/16px system-ui,sans-serif;color:#241634}.bm-scroll-cue{display:none;font:bold 10px/18px system-ui,sans-serif;color:#3c294c;background:#eadbc2;border-radius:5px;padding:0 6px;margin-top:4px;text-align:center}.bm-card[data-compact="true"] .bm-scroll-cue{display:block}.bm-sidebar:focus-visible,.bm-key:focus-visible{outline:3px solid #8b54c8;outline-offset:2px}.bm-key[hidden]{display:none}.bm-key span{white-space:nowrap}.bm-key b,.bm-legend .lm{display:inline-grid;place-items:center;box-sizing:border-box;min-width:20px;height:20px;background:#fff4dc;border:2px solid #241634;color:#241634;border-radius:50%;margin-right:3px;font:bold 11px/1 system-ui,sans-serif}.bm-legend .bm-landmark{display:none}.bm-card[data-compact="true"] .bm-landmark{display:inline-flex}
.bm-close{position:absolute;top:6px;right:6px;width:48px;height:52px;border-radius:50%;border:4px solid #241634;background:#ff4fa3;color:#fff;font:bold 24px system-ui;box-shadow:0 5px 0 #241634;cursor:pointer}
@media(max-width:500px){.bm-legend{font-size:11px;gap:6px;line-height:18px}.bm-legend .k,.bm-legend .f,.bm-legend .d{width:15px;height:15px}}
@media(min-width:700px) and (max-height:500px){.bm-card .bm-content{display:grid;grid-template-columns:minmax(0,1fr) 220px;gap:14px;align-items:start}.bm-card .bm-sidebar{display:flex;flex-direction:column;max-height:var(--bm-content-height,300px);overflow-y:auto;overscroll-behavior:contain}.bm-card .bm-legend{display:grid;grid-template-columns:1fr 1fr;justify-content:start;align-content:start;font-size:10px;line-height:16px;gap:3px 6px;margin:0 0 6px}.bm-card .bm-legend .bm-item{gap:2px}.bm-card .bm-legend .bm-landmark{grid-column:1 / -1}.bm-card .bm-key{display:block;height:auto;max-height:none;width:100%;overflow:visible;margin:0;font-size:11px;line-height:17px}.bm-card .bm-key span{display:block}.bm-card .bm-key b{height:18px;min-width:18px;vertical-align:middle}.bm-card .bm-key[hidden]{display:none}}
@media(max-height:500px){.bm-key{height:36px;max-height:36px}.bm-card{padding:8px}.bm-title{font-size:24px;min-height:34px;margin:0 0 2px;letter-spacing:2px;-webkit-text-stroke:1px #241634;text-shadow:0 2px 0 #241634;padding-right:48px}.bm-legend{font-size:11px;line-height:18px;gap:6px;margin-top:4px}.bm-legend .k,.bm-legend .f,.bm-legend .d{width:15px;height:15px}.bm-close{width:44px;height:44px;font-size:22px;top:3px;right:3px;box-shadow:0 3px 0 #241634}}`;
    st.textContent += '@media(min-width:700px) and (max-height:500px){.bm-card .bm-legend{font-size:10px;line-height:16px;gap:3px 6px;margin-top:0}.bm-card .bm-key{height:auto;max-height:none}.bm-card .bm-title{padding-right:48px}}';
    document.head.appendChild(st); document.body.appendChild(el);
    el.querySelector('.bm-close').onclick = () => K.game.mapKey(); el.onclick = e => { if (e.target === el) K.game.mapKey(); };
  }
  el.hidden = false; UI.mapOpen = true;
  const cv = el.querySelector('canvas'), card = el.querySelector('.bm-card'), g = cv.getContext('2d'), M = W.mapCanvas, dpr = Math.min(2, devicePixelRatio || 1);
  const px = n => parseFloat(n) || 0, overlayStyle = getComputedStyle(el), cardStyle = getComputedStyle(card), canvasStyle = getComputedStyle(cv);
  const safe = {top:px(overlayStyle.getPropertyValue('--bm-safe-top')),right:px(overlayStyle.getPropertyValue('--bm-safe-right')),bottom:px(overlayStyle.getPropertyValue('--bm-safe-bottom')),left:px(overlayStyle.getPropertyValue('--bm-safe-left'))};
  const availableW = Math.min(innerWidth * .94, innerWidth - safe.left - safe.right - 24, 1100);
  const availableH = Math.min(innerHeight * .92, innerHeight - safe.top - safe.bottom - 32);
  card.style.width = availableW + 'px'; card.style.maxWidth = availableW + 'px'; card.style.maxHeight = availableH + 'px';
  const insetW = px(cardStyle.paddingLeft) + px(cardStyle.paddingRight) + px(cardStyle.borderLeftWidth) + px(cardStyle.borderRightWidth) + px(canvasStyle.borderLeftWidth) + px(canvasStyle.borderRightWidth);
  const insetH = px(cardStyle.paddingTop) + px(cardStyle.paddingBottom) + px(cardStyle.borderTopWidth) + px(cardStyle.borderBottomWidth) + px(canvasStyle.borderTopWidth) + px(canvasStyle.borderBottomWidth);
  let cssW = Math.max(100, availableW - insetW), reservedHeight = 0;
  const wideLandscape=innerWidth>=700&&innerHeight<=500;
  const sidebar=el.querySelector('.bm-sidebar');sidebar.setAttribute('role','region');sidebar.setAttribute('aria-label','Map legend and landmark key');sidebar.tabIndex=wideLandscape?0:-1;
  const title=el.querySelector('.bm-title'),legend=el.querySelector('.bm-legend'),keyPanel=el.querySelector('.bm-key');
  keyPanel.tabIndex=wideLandscape?-1:0;
  if(wideLandscape){
    card.dataset.compact='true';keyPanel.hidden=false;
    const ts=getComputedStyle(title),contentH=Math.max(100,availableH-insetH-title.offsetHeight-px(ts.marginTop)-px(ts.marginBottom));
    card.style.setProperty('--bm-content-height',contentH+'px');
    const sidebarW=220,gap=14;
    cssW=Math.max(100,Math.min(availableW-insetW-sidebarW-gap,contentH*1.22));reservedHeight=availableH-contentH;
  }else{
    card.style.removeProperty('--bm-content-height');
    for(let pass=0;pass<3;pass++){
      card.dataset.compact=String(cssW<500);keyPanel.hidden=cssW>=500;
      cv.style.width=cssW+'px';cv.style.height=cssW/1.22+'px';
      const ts=getComputedStyle(title),ls=getComputedStyle(legend);
      reservedHeight=insetH+title.offsetHeight+px(ts.marginTop)+px(ts.marginBottom)+legend.offsetHeight+px(ls.marginTop)+px(ls.marginBottom)+(keyPanel.hidden?0:keyPanel.offsetHeight+4+el.querySelector('.bm-scroll-cue').offsetHeight+4);
      cssW=Math.max(100,Math.min(availableW-insetW,(availableH-reservedHeight)*1.22));
    }
  }
  cv.style.width = cssW + 'px'; cv.style.height = cssW / 1.22 + 'px';
  cv.width = Math.round(cssW * dpr); cv.height = Math.round(cssW / 1.22 * dpr); const CW = cv.width, CH = cv.height; g.setTransform(1, 0, 0, 1, 0, 0);
  const markerScale = Math.max(.55, Math.min(1, cssW / 800)), unit = dpr * markerScale, compact = wideLandscape || cssW < 500;
  card.dataset.compact=String(compact);
  const markerPaint=[],markerLeaderPaint=[],markerLeaders=[],compactMarkerFallbacks=[];const paintMarker=fn=>compact?markerPaint.push(fn):fn();
  const s = Math.min(CW / M.width, CH / M.height), ox = (CW - M.width * s) / 2, oy = (CH - M.height * s) / 2;
  g.fillStyle = '#2f7fa0'; g.fillRect(0, 0, CW, CH); g.drawImage(M, ox, oy, M.width * s, M.height * s);
  const to = (x, z) => [ox + W.mapX(x) * s, oy + W.mapZ(z) * s], occupied = [], labels = [], markers = [];
  const reserve = (x, y, w, h, kind, id) => { const box = {x:x-w/2,y:y-h/2,w,h,kind,id}; occupied.push(box); return box; };
  const intersects = (a,b) => a.x < b.x+b.w && a.x+a.w > b.x && a.y < b.y+b.h && a.y+a.h > b.y;
  const P = K.A.player, [playerX, playerY] = to(P.x,P.z), playerRadius = 18 * unit;
  const playerBox = reserve(playerX,playerY,2*playerRadius,2*playerRadius,'player','you');
  // The NW sea corner is reserved before placing markers, so the compass cannot paint over one.
  const compassX = 50*dpr, compassY = 50*dpr, compass = reserve(compassX,compassY,66*unit,66*unit,'compass','north');
  paintMarker(()=>{g.save(); g.translate(compassX,compassY); g.scale(unit*.8,unit*.8); g.fillStyle='#fff4dc';g.strokeStyle='#241634';g.lineWidth=4;g.beginPath();g.arc(0,0,36,0,7);g.fill();g.stroke();g.fillStyle='#ff4fa3';g.beginPath();g.moveTo(0,-28);g.lineTo(10,4);g.lineTo(-10,4);g.closePath();g.fill();g.fillStyle='#241634';g.font='bold 16px Bangers, Impact';g.textAlign='center';g.textBaseline='middle';g.fillText('N',0,16);g.restore();});
  g.textAlign = 'center'; g.textBaseline = 'middle';
  for (const k in LM_ICONS) { const l = W.landmark && W.landmark[k]; if (!l || !l.o) continue; const p = l.o.getWorldPosition(new T.Vector3()); const [sx,sy] = to(p.x,p.z);
    if(!compact){paintMarker(()=>{g.font=`${26*unit}px system-ui,"Apple Color Emoji",sans-serif`;g.textAlign='center';g.textBaseline='middle';g.fillText(LM_ICONS[k][0],sx,sy);});reserve(sx,sy,28*unit,28*unit,'landmark',k);}labels.push({key:k,text:LM_ICONS[k][1],sx,sy,number:Object.keys(LM_ICONS).indexOf(k)+1}); }
  { const [hx,hy]=to(W.HOME.x,W.HOME.z);paintMarker(()=>{g.font=`${26*unit}px system-ui,"Apple Color Emoji"`;g.textAlign='center';g.textBaseline='middle';g.fillText('🏡',hx,hy);});reserve(hx,hy,28*unit,28*unit,'home','home'); }
  let compactLayout=null;
  if(compact){
    const requests=[];
    const requestPin=(x,z,r,id,kind='marker',offsetX=0,offsetY=0)=>{const [anchorX,anchorY]=to(x,z);requests.push({anchorX,anchorY,radius:r*unit,id,kind,offsetX:offsetX*unit,offsetY:offsetY*unit});};
    (K.A.photos||[]).forEach((p,i)=>{if(!p.got)requestPin(p.x,p.z,10,'photo-'+i);});
    K.A.letters.forEach((l,i)=>{if(!l.got)requestPin(l.x,l.z,14,'letter-'+i);});
    requestPin(K.A.pascal.x,K.A.pascal.z,15,'pascal');
    if(K.campaign){K.campaign.jobs.forEach((j,i)=>{if(!K.campaign.collected.has(j))requestPin(j.x,j.z,12,'folder-'+i);});K.campaign.kiosks.forEach((q,i)=>requestPin(q.x,q.z,14,'deploy-'+i,'deploy',17,-15));}
    compactLayout=layoutCompactMapNames(labels,occupied,CW,CH,dpr,text=>g.measureText(text).width,[],requests);
    for(const b of compactLayout.fallbacks)occupied.push({x:b.x,y:b.y,w:b.w,h:b.h,kind:b.kind,id:b.id});
  }
  // Keep nearby markers separate. Short leaders retain the exact original world location.
  const placeMarker = (anchorX,anchorY,radius,id,kind='marker',offsetX=0,offsetY=0) => {
    const pad=4*dpr, reach=radius+pad;
    const boxAt=(x,y)=>({x:Math.max(pad,Math.min(CW-2*reach-pad,x-reach)),y:Math.max(pad,Math.min(CH-2*reach-pad,y-reach)),w:2*reach,h:2*reach,kind,id});
    const candidates=[[anchorX+offsetX,anchorY+offsetY]];
    for(let r=8*unit;r<=96*unit;r+=8*unit)for(let i=0;i<16;i++){const a=i*Math.PI/8;candidates.push([anchorX+offsetX+Math.cos(a)*r,anchorY+offsetY+Math.sin(a)*r]);}
    const boxes=compact&&compactLayout?.symbols[id]?[compactLayout.symbols[id]]:candidates.map(([x,y])=>boxAt(x,y));
    const markerLine=b=>({id,from:[anchorX,anchorY],to:[b.x+reach,b.y+reach],lengthCSS:Math.hypot(b.x+reach-anchorX,b.y+reach-anchorY)/dpr});
    const anchorInside=b=>anchorX>=b.x&&anchorX<=b.x+b.w&&anchorY>=b.y&&anchorY<=b.y+b.h;
    const safeTrail=b=>{const l=markerLine(b);return l.lengthCSS<=48&&!occupied.some(o=>!anchorInside(o)&&mapSegmentHitsBox(l,o,dpr))&&![...markerLeaders,...(compactLayout?.leaders||[])].some(o=>mapLeadersConflict(l,o,dpr)||mapSegmentHitsBox(o,b,dpr));};
    let box=boxes.find(b=>!occupied.some(o=>intersects(b,o))&&(!compact||safeTrail(b)));
    const trailSafe=!!box;
    // Preserve visibility if a future scene is denser than the bounded search. Diagnostics disclose any remaining overlaps.
    if(!box)box=boxes.find(b=>!occupied.some(o=>intersects(b,o)))||boxes.sort((a,b)=>occupied.filter(o=>intersects(a,o)).length-occupied.filter(o=>intersects(b,o)).length)[0];
    if(compact&&!trailSafe)compactMarkerFallbacks.push(id);
    occupied.push(box);const x=box.x+reach,y=box.y+reach;
    markers.push({...box,anchorX,anchorY,sx:x,sy:y,radius,displacement:Math.hypot(x-anchorX,y-anchorY)/dpr});
    if(Math.hypot(x-anchorX,y-anchorY)>3*dpr){const line={from:[anchorX,anchorY],to:[x,y],lengthCSS:Math.hypot(x-anchorX,y-anchorY)/dpr};const draw=()=>{g.save();g.strokeStyle='#241634';g.globalAlpha=.55;g.lineWidth=dpr;g.beginPath();g.moveTo(anchorX,anchorY);g.lineTo(x,y);g.stroke();g.restore();};if(compact){if(trailSafe){line.id=id;markerLeaders.push(line);markerLeaderPaint.push(draw);}}else draw();}
    return [x,y];
  };
  const pin=(x,z,r,col,label,id)=>{r*=unit;const [ax,ay]=to(x,z),[sx,sy]=placeMarker(ax,ay,r+3*unit,id);paintMarker(()=>{g.fillStyle='#241634';g.beginPath();g.arc(sx,sy,r+3*unit,0,7);g.fill();g.fillStyle=col;g.beginPath();g.arc(sx,sy,r,0,7);g.fill();
    if(label){g.fillStyle='#241634';g.font=`bold ${Math.round(r*1.25)}px Bangers,Impact,sans-serif`;g.textAlign='center';g.textBaseline='middle';g.fillText(label,sx,sy+unit*.5);}});};
  if(!compact)K.A.cars.forEach((c,i)=>{if(c.kind==='waymo')pin(c.x,c.z,4,'#e8edf5',null,'waymo-'+i);});
  (K.A.photos||[]).forEach((p,i)=>{if(!p.got)pin(p.x,p.z,7,'#ff4fa3',null,'photo-'+i);});
  K.A.letters.forEach((l,i)=>{if(!l.got)pin(l.x,l.z,11,'#ffcf3f',l.ch,'letter-'+i);});
  const pz=K.A.pascal;pin(pz.x,pz.z,12,'#ff7a3d','P','pascal');
  if(K.campaign){
    const queue=K.campaign.jobs.filter(j=>K.campaign.collected.has(j)&&!K.campaign.deployed.has(j));
    const targets=K.campaign.carried?K.campaign.pads.filter(p=>p.phase==='idle').map(p=>({x:p.approachWorld[0],z:p.approachWorld[2]})):K.campaign.jobs.filter(j=>j.phase==='available');
    const next=targets.slice().sort((a,b)=>Math.hypot(a.x-P.x,a.z-P.z)-Math.hypot(b.x-P.x,b.z-P.z))[0];
    if(next){const [x,y]=to(P.x,P.z),[tx,ty]=to(next.x,next.z);g.save();g.strokeStyle='#50631d';g.lineWidth=3*dpr;g.setLineDash([6*dpr,4*dpr]);g.beginPath();g.moveTo(x,y);g.lineTo(tx,ty);g.stroke();g.restore();}
    K.campaign.jobs.forEach((j,i)=>{if(!K.campaign.collected.has(j))pin(j.x,j.z,9,'#b7f84a','F','folder-'+i);});
    K.campaign.kiosks.forEach((q,i)=>{const [ax,ay]=to(q.x,q.z),[x,y]=placeMarker(ax,ay,14*unit,'deploy-'+i,'deploy',17*unit,-15*unit);paintMarker(()=>{g.save();g.translate(x,y);g.fillStyle='#8aa1a8';g.strokeStyle='#241634';g.lineWidth=3*unit;g.beginPath();g.moveTo(0,-12*unit);g.lineTo(12*unit,0);g.lineTo(0,12*unit);g.lineTo(-12*unit,0);g.closePath();g.fill();g.stroke();g.fillStyle='#241634';g.font=`bold ${14*unit}px sans-serif`;g.textAlign='center';g.fillText('D',0,unit*.5);g.restore();});});
  }
  // A halo and heading arrow identify Kyoto; collectibles retain their KYOTO letters.
  paintMarker(()=>{g.save();g.translate(playerX,playerY);g.fillStyle='#ffb020';g.strokeStyle='#241634';g.lineWidth=2*unit;g.beginPath();g.arc(0,0,16*unit,0,7);g.fill();g.stroke();g.strokeStyle='#fff';g.lineWidth=3*unit;g.beginPath();g.arc(0,0,13.5*unit,0,7);g.stroke();
  const [fx,fy]=to(P.x+Math.sin(P.heading),P.z+Math.cos(P.heading));g.rotate(Math.atan2(fy-playerY,fx-playerX)+Math.PI/2);g.fillStyle='#241634';g.beginPath();g.moveTo(0,-10*unit);g.lineTo(7*unit,7*unit);g.lineTo(0,3*unit);g.lineTo(-7*unit,7*unit);g.closePath();g.fill();g.restore();});
  markers.push({...playerBox,anchorX:playerX,anchorY:playerY,sx:playerX,sy:playerY,radius:playerRadius,displacement:0});
  // Place names stay at 10px on compact maps, using the same measured collision search.
  const labelFont=compact?10:12;g.font=`bold ${labelFont*dpr}px system-ui,sans-serif`;g.textAlign='center';g.textBaseline='middle';
  const placements=[];
  const routeProof=compact?routeCompactMapLeaders([...compactLayout.leaders,...markerLeaders],occupied,CW,CH,dpr):{routed:[],unrouted:[]};
  if(compact){
    for(const l of routeProof.routed){g.strokeStyle="#3c294c";g.lineWidth=dpr;g.beginPath();g.moveTo(...l.points[0]);for(const p of l.points.slice(1))g.lineTo(...p);g.stroke();}
    markerPaint.forEach(draw=>draw());
    g.font=`bold ${labelFont*dpr}px system-ui,sans-serif`;g.textAlign="center";g.textBaseline="middle";
    for(const b of compactLayout.placements){g.fillStyle="#fff4dc";g.fillRect(b.x,b.y,b.w,b.h);g.fillStyle="#241634";g.fillText(b.text,b.x+b.w/2,b.y+b.h/2);placements.push(b);occupied.push(b);}
    for(const l of compactLayout.fallbacks){g.fillStyle="#fff4dc";g.strokeStyle="#241634";g.lineWidth=2*dpr;g.beginPath();g.arc(l.sx,l.sy,9*dpr,0,7);g.fill();g.stroke();g.fillStyle="#241634";g.font=`bold ${11*dpr}px system-ui,sans-serif`;g.fillText(l.number,l.sx,l.sy);}
    el.querySelector(".bm-key").innerHTML=compactLayout.fallbacks.map(l=>`<span><b>${l.number}</b>${l.text}</span>`).join("");
  }else for(const label of labels){
    const w=g.measureText(label.text).width+8*dpr,h=(compact?16:20)*dpr,pad=4*dpr,candidates=[];
    for(const dy of [27,-27,49,-49,71,-71,93,-93])for(const dx of [0,-40,40,-80,80,-120,120])candidates.push([label.sx+dx*dpr,label.sy+dy*dpr]);
    const boxAt=(x,y)=>({x:Math.max(pad,Math.min(CW-w-pad,x-w/2)),y:Math.max(pad,Math.min(CH-h-pad,y-h/2)),w,h,kind:'label'});
    let box=candidates.map(([x,y])=>boxAt(x,y)).find(b=>!occupied.some(o=>intersects(b,o)));
    if(!box){const free=[];for(let y=pad;y<=CH-h-pad;y+=12*dpr)for(let x=pad;x<=CW-w-pad;x+=12*dpr){const b={x,y,w,h,kind:'label'};if(!occupied.some(o=>intersects(b,o)))free.push(b);}free.sort((a,b)=>Math.hypot(a.x+w/2-label.sx,a.y+h/2-label.sy)-Math.hypot(b.x+w/2-label.sx,b.y+h/2-label.sy));box=free[0];}
    if(!box)continue;
    occupied.push(box);const x=box.x+w/2,y=box.y+h/2;
    if(Math.hypot(x-label.sx,y-label.sy)>34*dpr){g.strokeStyle='#3c294c';g.lineWidth=2*dpr;g.beginPath();g.moveTo(label.sx,label.sy);g.lineTo(Math.max(box.x,Math.min(box.x+w,label.sx)),Math.max(box.y,Math.min(box.y+h,label.sy)));g.stroke();}
    g.fillStyle='#fff4dc';g.fillRect(box.x,box.y,w,h);g.fillStyle='#241634';g.fillText(label.text,x,y);placements.push({...label,...box});
  }
  const overlappingMarkers=[];for(let i=0;i<markers.length;i++)for(let j=i+1;j<markers.length;j++)if(intersects(markers[i],markers[j]))overlappingMarkers.push([markers[i].id,markers[j].id]);
  const compassCoveredMarkers=markers.filter(m=>intersects(m,compass)).map(m=>m.id);
  const drawnLeaders=routeProof.routed;const leaderSegments=drawnLeaders.flatMap(l=>l.segments);let leaderCrossings=0,leaderMarkerIntersections=0,leaderReservedBoxIntersections=0;
  for(let i=0;i<leaderSegments.length;i++){const l=leaderSegments[i];for(const other of leaderSegments.slice(i+1))if((l.key||l.id)!==(other.key||other.id)&&mapLeadersConflict(l,other,dpr))leaderCrossings++;for(const o of occupied){if(o.kind==='label'||o.id===(l.key||l.id))continue;const atOrigin=l.origin[0]>=o.x&&l.origin[0]<=o.x+o.w&&l.origin[1]>=o.y&&l.origin[1]<=o.y+o.h;if(!atOrigin&&mapSegmentHitsBox(l,o))leaderReservedBoxIntersections++;if(!atOrigin&&mapSegmentHitsBox(l,o))leaderMarkerIntersections++;}}
  UI.mapLayout={compact,wideLandscape,minimumLandmarkClearanceCSS:4,unresolvedLandmarks:compactLayout?.unresolved||[],landmarkBadgeDiameterCSS:20,landmarkBadgeFontCSS:11,numberedLandmarks:compactLayout?.fallbacks||[],placementOrder:compactLayout?.placementOrder||labels.map(l=>l.key),leaders:drawnLeaders.filter(l=>l.key),unroutedLeaders:routeProof.unrouted,maximumLandmarkLeaderLengthCSS:compactLayout?.maximumLeaderLengthCSS||0,maximumLeaderLengthCSS:Math.max(0,...drawnLeaders.map(l=>l.lengthCSS)),markerLeaders:drawnLeaders.filter(l=>l.id),compactMarkerFallbacks,leaderCrossings,leaderMarkerIntersections,leaderReservedBoxIntersections,minimumLeaderInkClearanceCSS:3,leaderRoutingAttempts:routeProof.attempts||1,leaderIntersectionLimits:'Original world anchors and symbol positions unchanged. Leader paths avoid unchanged complete symbol boxes, which include4px marker padding; world anchors and symbol centres remain unchanged; original anchor/own target boxes excluded. Unroutable leaders disclosed explicitly.',keyPanelHeight:compact?el.querySelector('.bm-key').offsetHeight:0,width:CW,height:CH,cssWidth:cssW,cssHeight:cssW/1.22,dpr,markerScale,labelFont,availableW,availableH,reservedHeight,safe,labels:placements,expectedLabels:labels.length,unplacedLabels:labels.filter(l=>!placements.some(p=>p.key===l.key)&&!compactLayout?.fallbacks.some(p=>p.key===l.key)).map(l=>l.key),markers,overlappingMarkers,compass,compassCoveredMarkers,occupied};
};

/* ---------- touch controls ---------- */
UI.buildTouch = function () {
  if (!K.coarse) return;
  K.touch = { x: 0, z: 0, sprint: false };
  const zone = $('#stickZone'), base = $('#stickBase'), knob = $('#stickKnob'); let pid = null;
  const upd = e => { const r = base.getBoundingClientRect(); let dx = e.clientX - (r.left + r.width / 2), dy = e.clientY - (r.top + r.height / 2); const d = Math.hypot(dx, dy), m = 52; if (d > m) { dx *= m / d; dy *= m / d; } knob.style.transform = `translate(${dx}px,${dy}px)`; const dead = d < 8; K.touch.x = dead ? 0 : dx / m; K.touch.z = dead ? 0 : -dy / m; K.touch.sprint = d > m * .92; };
  zone.addEventListener('pointerdown', e => { if (pid !== null) return; pid = e.pointerId; zone.setPointerCapture(pid); upd(e); });
  zone.addEventListener('pointermove', e => { if (e.pointerId === pid) upd(e); });
  const end = e => { if (e.pointerId !== pid) return; pid = null; knob.style.transform = ''; K.touch.x = K.touch.z = 0; K.touch.sprint = false; };
  zone.addEventListener('pointerup', end); zone.addEventListener('pointercancel', end); zone.addEventListener('lostpointercapture', end);
  const look = $('#lookZone'); let lp = null, lx = 0, ly = 0;
  look.addEventListener('pointerdown', e => { if (lp !== null) return; lp = e.pointerId; look.setPointerCapture(lp); lx = e.clientX; ly = e.clientY; });
  look.addEventListener('pointermove', e => { if (e.pointerId !== lp) return; K.inp.camYaw -= (e.clientX - lx) * .008; K.inp.camPitch = U.clamp(K.inp.camPitch + (e.clientY - ly) * .005, -.5, .7); lx = e.clientX; ly = e.clientY; K.inp.lastManual = performance.now(); });
  const endLook = e => { if (e.pointerId === lp) lp = null; }; look.addEventListener('pointerup', endLook); look.addEventListener('pointercancel', endLook); look.addEventListener('lostpointercapture', endLook);
  K.resetTouch = () => { pid = lp = null; knob.style.transform = ''; K.touch.x = K.touch.z = 0; K.touch.sprint = false; };
  const tap = (id, fn) => $(id).addEventListener('pointerdown', e => { e.preventDefault(); if (K.game.state === 'play') fn(); });
  tap('#bJump', () => K.inp.jump = true); tap('#bAct', () => K.inp.act = true); tap('#bBark', () => K.inp.bark = true);
};
})(window.K);
