/* feat_boss.js — the manager on the red Vespa shows up more and actually DOES things:
   · ride-bys: when he is far away he re-routes to blocks near Kyoto
   · pillion rides: when he stops next to Kyoto, press E to hop on the back for a walk-and-talk escape (Pascal can't grab him)
   · surprise 1:1s: if he passes Pascal while Pascal is chasing, he stops him for a "quick sync" */
(function (K) {
const T = K.T, U = K.U;
const RIDE_LINES = ['Walk-and-talk! Love it.', "Let's take this offline. Literally.", 'Hold on — agile means FAST.', 'This is our 1:1 now. Any blockers?', 'Vroom is a verb. Put it in the retro.', 'Great bandana. Very on-brand.'];
const SYNC_LINES = ['Pascal! Quick 1:1 about Kyoto\'s roadmap?', 'Pascal, got 5? Let\'s align on the dog.', 'Pascal! Your OKRs, real quick…', 'Pascal, per my last email…'];
const PASCAL_BACK = ['Nicht JETZT! Mein Hund!!', 'Ja ja, aber… KYOTO!', 'Kann das nicht warten?!', 'Ich bin im Urlaub! Ab sofort!'];
const S = { far: 0, sync: 0, ride: 0, lineT: 0, prompt: false, backT: 0, rideExt: null, rideCooldown: 0 };
const tmp = new T.Vector3();

K.on('start', () => { if (helmet) helmet.visible = false; S.far = 20; S.sync = 25; S.ride = 0; S.backT = 0; S.rideExt = null; S.rideCooldown = 0; const b = K.A.boss; if (b) { b.riding = false; b.fast = 0; b.kudosT = 0; } });

/* Kyoto's riding helmet: built in the coat mesh's bind space and re-expressed in the head bone's space (same trick as the surf sunglasses). */
let helmet = null;
function makeHelmet() {
  if (helmet) return helmet;
  const A = K.A; let sm = null; A.kyoto.root.traverse(o => { if (!sm && o.isSkinnedMesh && o.name === 'Kyoto') sm = o; }); if (!sm) return null;
  const head = sm.skeleton.bones.find(b => /^head$/i.test(b.name)); if (!head) return null;
  const inv = sm.skeleton.boneInverses[sm.skeleton.bones.indexOf(head)];
  const g = new T.Group(); g.name = 'kyoto_helmet';
  const red = K.toon('#e8383d'), white = K.toon('#fff6e6'), dark = K.toon('#2a2733'), gold = K.toon('#ffcb43');
  const C = new T.Vector3(0, 2.14, 1.0);
  const dome = (mat, phi0, phiL, k) => { const m = new T.Mesh(new T.SphereGeometry(1, 24, 14, phi0, phiL, 0, Math.PI / 2 + .12), mat); m.scale.set(.43 * k, .4 * k, .53 * k); m.position.copy(C); g.add(m); return m; };
  dome(red, 0, Math.PI * 2, 1);
  dome(white, Math.PI / 2 - .13, .26, 1.025); dome(white, Math.PI * 1.5 - .13, .26, 1.025);   // racing stripe front to back
  const rim = new T.Mesh(new T.TorusGeometry(1, .07, 8, 28), dark); rim.rotation.x = Math.PI / 2; rim.scale.set(.44, .53, 1); rim.position.set(C.x, C.y - .04, C.z); g.add(rim);
  const peak = new T.Mesh(new T.SphereGeometry(1, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), dark); peak.scale.set(.3, .05, .2); peak.position.set(0, C.y + .1, C.z + .5); peak.rotation.x = -.18; g.add(peak);
  const bolt = new T.Mesh(new T.SphereGeometry(.05, 8, 6), gold); bolt.position.set(0, C.y + .43, C.z); g.add(bolt);
  for (const sx of [-1, 1]) { const st = new T.Mesh(new T.CylinderGeometry(.018, .018, .5, 6), dark); st.position.set(sx * .3, C.y - .27, C.z + .18); st.rotation.set(.2, 0, sx * .5); g.add(st); }   // chin straps
  g.applyMatrix4(inv); head.add(g); K.inkShell && K.inkShell(g, .009); g.visible = false; helmet = g; return g;
}
const seatV = new T.Vector3(), seatQ = new T.Quaternion();

function hopOn(b) {
  const A = K.A, P = A.player; b.riding = true; b.fast = 21; b.stopT = 0; S.ride = 14; S.lineT = 1.2;
  K.sfx.vespa && K.sfx.vespa(); K.fn.juice(.12, .15); A.kyoto.play('sit', .15);
  A.say(b.tag, 'Hop on! Let\'s walk-and-talk!', 2.4); K.UI.banner('VESPA RIDE', 'walk-and-talk with your manager', 'boss');
  P.speed = 0; P.vx = P.vz = 0;
  const hm = makeHelmet(); if (hm) hm.visible = true; A.kyoto.root.scale.setScalar(.56);
  S.rideExt = P.ext = dt => {   // Kyoto sits on the saddle behind the manager, leaning with the bike; the camera follows P
    b.v.updateMatrixWorld(true); seatV.set(0, .93, -.74); b.v.localToWorld(seatV); b.v.getWorldQuaternion(seatQ);
    P.x = seatV.x; P.z = seatV.z; P.y = seatV.y; P.heading = b.heading; P.speed = b.spd; P.inv = Math.max(P.inv, .4); P.onGround = true;
    const r = K.A.kyoto.root; r.position.set(P.x, P.y - .02 + Math.abs(Math.sin(K.game.time * 9)) * .03, P.z); r.quaternion.copy(seatQ); K.A.kyoto.mixer.update(dt);
    S.ride -= dt; S.lineT -= dt; if (S.lineT <= 0) { S.lineT = 3.6; A.say(b.tag, U.pick(RIDE_LINES), 3); }
    if (S.ride <= 0 || K.pressed('Space') || (S.ride < 12.5 && K.pressed('KeyE'))) hopOff(b);
  };
}
function hopOff(b) {
  const A = K.A, P = A.player; if (helmet) helmet.visible = false; A.kyoto.root.scale.setScalar(1); b.riding = false; b.fast = 0; b.stopT = 2; b.cool = 14; if (P.ext === S.rideExt) P.ext = null; S.rideExt = null; S.rideCooldown = 20;
  const h = b.heading, f = K.W.free(b.x + Math.cos(h) * 2.2, b.z - Math.sin(h) * 2.2, .8); P.x = f[0]; P.z = f[1]; P.y = K.W.terrainH(P.x, P.z); P.vy = 7; P.onGround = false; P.inv = 1;
  A.kyoto.play('jump', .1); A.say(b.tag, 'Great sync! Same time next week?', 2.6); A.addTokens(4096, 'kudos'); K.fn.juice(.1, .2);
}

K.on('step', (h, g) => {
  const A = K.A, b = A.boss, P = A.player, pz = A.pascal; if (!b || !b.loop) return;
  S.rideCooldown = Math.max(0, S.rideCooldown - h);
  const dK = Math.hypot(P.x - b.x, P.z - b.z);
  // ride-bys: re-route onto a block near Kyoto when he's been far away for a while
  if (!b.riding) { S.far = dK > 85 ? S.far - h : Math.max(S.far, 10); if (S.far <= 0) { S.far = U.rand(10, 16); const L = A.randomLoop && A.randomLoop([P.x, P.z, 70]);
    if (L) { const fx = Math.sin(P.heading), fz = Math.cos(P.heading); let best = 0, bs = -1e9;
      for (let k = 0; k < 20; k++) { const s = U.rand(0, L.len), q = A.loopPos(L, s), dx = q.x - P.x, dz = q.z - P.z, d = Math.hypot(dx, dz); if (d < 38 || d > 75) continue;
        const ahead = (dx * fx + dz * fz) / d, sc = ahead * 2 - Math.abs(d - 55) / 25; if (sc > bs) { bs = sc; best = s; } }   // ahead of Kyoto: he rides into view
      if (bs > -1e9) { b.loop = L; b.s = best; b.hello = true; } } } }
  if (b.hello && dK < 42 && !b.riding) { b.hello = false; K.sfx.vespa && K.sfx.vespa(); A.say(b.tag, U.pick(['BEEP BEEP! Kyoto! Quick sync?', 'Kyoto! Got 5 minutes? Hop on!', 'Hey Kyoto! How is the pawgress?']), 3.2); }
  // pillion ride offer
  // surprise 1:1 that blocks Pascal
  S.sync -= h; if (S.sync <= 0 && !b.riding && pz.wait <= 0 && pz.stun <= 0 && !pz.ext) {
    const dP = Math.hypot(pz.x - b.x, pz.z - b.z), dPK = Math.hypot(pz.x - P.x, pz.z - P.z);
    if (dP < 11 && dPK > 12 && dPK < 50) { S.sync = 40; S.backT = .9; b.stopT = 4; pz.stun = 3.8; pz.vx = pz.vz = 0; A.say(b.tag, U.pick(SYNC_LINES), 3.6);
      if (dK < 60) K.UI.banner('BLOCKED BY A MEETING', 'your manager booked Pascal', 'boss'); A.sfxText(pz.x, pz.y + 3.2, pz.z, '📅 1:1', 'big'); }
    else S.sync = 1;
  }
  if (S.backT > 0) { S.backT -= h; if (S.backT <= 0 && K.game.state === 'play') A.say(pz.tag, U.pick(PASCAL_BACK), 2.6, 'shout'); }
});
K.on('bark', P => { const b = K.A.boss; if (b && !b.riding && Math.hypot(P.x - b.x, P.z - b.z) < 17 && !(b.kudosT > K.game.time)) { b.kudosT = K.game.time + 20; K.A.addTokens(1024, 'bark noted in 1:1'); } });
function cleanupRide() { const b = K.A.boss, P = K.A.player; if (helmet) helmet.visible = false; K.A.kyoto.root.scale.setScalar(1); S.backT = 0; if (b && b.riding) { b.riding = false; b.fast = 0; if (P.ext === S.rideExt) P.ext = null; S.rideExt = null; } }
K.on('beforeEnd', cleanupRide); K.on('end', cleanupRide);
K.boss = { canRide: () => { const b = K.A.boss, P = K.A.player; return !!(S.rideCooldown <= 0 && b && !b.riding && !P.ext && P.mode === 'walk' && P.onGround && P.stun <= 0 && P.interactT <= 0 && b.spd < 1.5 && Math.hypot(P.x - b.x, P.z - b.z) < 4.5); }, tryRide: () => { const b = K.A.boss; if (!K.boss.canRide()) return false; K.inp.act = false; hopOn(b); return true; } };
K.scenes = K.scenes || {};
K.scenes.vespa = h => { h.play(); const b = K.A.boss, P = K.A.player; h.st(2); h.go(b.x + 2, b.z + 2); b.stopT = 5; h.st(2); hopOn(b); h.st(45); const hd = b.heading;
  K.sceneCam = { noClip: true, pos: new T.Vector3(b.x + Math.cos(hd) * 6 - Math.sin(hd) * 3, b.y || 3.2, b.z - Math.sin(hd) * 6 - Math.cos(hd) * 3), look: new T.Vector3(b.x, 1.4, b.z) }; K.sceneCam.pos.y = 3.2; h.st(1); };
K.scenes.boss_check = h => {
  let n = 0; const check = (ok, msg) => { if (!ok) throw new Error('BOSS CHECK: ' + msg); n++; };
  h.play(); const b = K.A.boss, P = K.A.player, pz = K.A.pascal;
  b.stopT = 5; h.st(45); h.go(b.x + 2, b.z + 2); h.st(2); P.interactT = 0;
  h.st(1, ['KeyE']); check(b.riding && P.ext === S.rideExt, 'real E ride path');
  const x = P.x, z = P.z; h.g.pause(true); h.st(4, ['KeyW']); check(P.x === x && P.z === z, 'pause freezes ride');
  h.g.pause(false); h.st(2); h.st(1, ['Space']); check(!b.riding && !P.ext, 'Space exits');
  check(S.rideCooldown > 0, 'ride reward cannot be farmed immediately');
  h.g.start(true); h.go(b.x + 20, b.z); P.inv = 999; b.stopT = 5;
  P.x = b.x + 3.5; P.z = b.z; pz.x = b.x + 3; pz.z = b.z; pz.y = K.W.terrainH(pz.x, pz.z); pz.wait = pz.stun = 0; pz.place(); S.sync = 0;
  h.st(1); check(S.backT === 0 && pz.stun === 0, 'manager skips close chase');
  P.x = b.x + 25; P.z = b.z; P.y = K.W.terrainH(P.x, P.z); P.vx = P.vz = 0; P.safe = null; S.sync = 0;
  h.st(1); check(S.backT > 0 && pz.stun > 3, 'manager interrupts Pascal dP=' + Math.hypot(pz.x - b.x, pz.z - b.z).toFixed(2) + ' dPK=' + Math.hypot(pz.x - P.x, pz.z - P.z).toFixed(2) + ' sync=' + S.sync.toFixed(2) + ' stun=' + pz.stun.toFixed(2));
  const reply = S.backT; h.g.pause(true); h.st(40); check(S.backT === reply, 'meeting reply freezes during pause');
  h.g.pause(false); h.st(35); check(S.backT <= 0, 'reply arrives on simulation time');
  S.backT = .9; h.g.start(true); h.g.start(true); check(S.backT === 0 && !b.riding && !P.ext && b.kudosT === 0, 'double restart cleanup');
  console.warn('BOSS_CHECK PASS ' + n);
};
})(window.K);

/* ---- Waymo look: the robotaxis read as generic white cars, so give every one the signature roof sensor 'hat', spinning
   lidar ring, fender/bumper sensor pods and the teal 'waymo' door wordmark (shared merged geometry: 3 draws per car) ---- */
(function (K) {
const T = K.T;
function logoTex() {
  const c = document.createElement('canvas'); c.width = 512; c.height = 160; const g = c.getContext('2d');
  const gr = g.createLinearGradient(20, 0, 150, 0); gr.addColorStop(0, '#2fd4c4'); gr.addColorStop(1, '#2a6df0');
  g.lineWidth = 22; g.lineCap = 'round'; g.lineJoin = 'round'; g.strokeStyle = gr;
  g.beginPath(); g.moveTo(28, 40); g.lineTo(62, 120); g.lineTo(88, 62); g.lineTo(114, 120); g.lineTo(148, 40); g.stroke();   // stylised W mark
  g.font = 'bold 92px "Nunito", "Titan One", sans-serif'; g.fillStyle = '#2b2f38'; g.textBaseline = 'middle'; g.fillText('waymo', 172, 84);
  const t = new T.CanvasTexture(c); t.encoding = T.sRGBEncoding; t.anisotropy = 4; return t;
}
function merged(parts) { const gs = parts.map(([geo, x, y, z, rx, ry]) => { geo.rotateX(rx || 0); geo.rotateY(ry || 0); geo.translate(x, y, z); return geo; }); const m = T.BufferGeometryUtils.mergeBufferGeometries(gs); gs.forEach(g => g.dispose()); return m; }
K.on('build', () => {
  const cars = (K.A.cars || []).filter(c => c.kind === 'waymo'); if (!cars.length) return;
  const blackGeo = merged([
    [new T.CylinderGeometry(.34, .38, .2, 20), 0, 1.86, -.15],                                   // sensor hat base
    [new T.CylinderGeometry(.24, .3, .2, 20), 0, 2.04, -.15],                                     // lidar housing
    [new T.SphereGeometry(.2, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), 0, 2.14, -.15],            // dome
    [new T.BoxGeometry(.16, .2, .28), 1.1, 1.0, 1.55], [new T.BoxGeometry(.16, .2, .28), -1.1, 1.0, 1.55],   // fender pods
    [new T.SphereGeometry(.13, 12, 8), 0, .72, 2.4], [new T.BoxGeometry(.5, .12, .1), 0, .52, -2.42],        // bumper sensors
    [new T.BoxGeometry(.12, .16, .2), .98, 1.45, .7], [new T.BoxGeometry(.12, .16, .2), -.98, 1.45, .7]]);   // mirror sensors
  const ringGeo = new T.TorusGeometry(.27, .035, 6, 28); ringGeo.rotateX(Math.PI / 2);
  const decalGeo = merged([[new T.PlaneGeometry(1.25, .39), 1.137, .86, -.2, 0, Math.PI / 2], [new T.PlaneGeometry(1.25, .39), -1.137, .86, -.2, 0, -Math.PI / 2]]);
  const black = K.toon('#16181d'), ring = new T.MeshBasicMaterial({ color: '#3ce8ff' }), decal = new T.MeshBasicMaterial({ map: logoTex(), transparent: true, alphaTest: .05 });
  for (const c of cars) {
    const add = (geo, m) => { const o = new T.Mesh(geo, m); o.castShadow = m === black; c.g.add(o); return o; };
    add(blackGeo, black); add(decalGeo, decal); const r = add(ringGeo, ring); r.position.set(0, 2.06, -.15); c.lidarRing = r;
  }
});
K.on('frame', (dt, tt) => { for (const c of K.A.cars || []) if (c.lidarRing && c.g.parent) { c.lidarRing.rotation.y += dt * 6; c.lidarRing.scale.setScalar(1 + Math.sin(tt * 8 + c.x) * .04); } });
})(window.K);
