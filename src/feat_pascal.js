/* feat_pascal.js — Pascal's agents never hurt Kyoto. When one reaches him:
   · Pascal far away  → the agent shares the location and Pascal POOFs in right behind Kyoto
   · Pascal close     → the agent clips a glowing leash on Kyoto for a few seconds; wiggling (moving) snaps it sooner */
(function (K) {
const T = K.T, U = K.U;
let teth = null, leash = null;
const up = new T.Vector3(0, 1, 0), va = new T.Vector3(), vb = new T.Vector3(), dir = new T.Vector3();
function leashMesh() {
  if (leash) return leash;
  const geo = new T.CylinderGeometry(.04, .04, 1, 6, 1, true); geo.translate(0, .5, 0);
  leash = new T.Mesh(geo, new T.MeshBasicMaterial({ color: '#ff4fa8' })); leash.frustumCulled = false;
  const glow = new T.Mesh(geo, new T.MeshBasicMaterial({ color: '#ff9bd2', transparent: true, opacity: .35, depthWrite: false, blending: T.AdditiveBlending })); glow.scale.set(2.6, 1, 2.6); leash.add(glow);
  K.scene.add(leash); return leash;
}
function span(m, a, b) { dir.subVectors(b, a); const L = dir.length() || 1; m.position.copy(a); m.quaternion.setFromUnitVectors(up, dir.divideScalar(L)); m.scale.y = L; }

function hit(a) {
  const A = K.A, P = A.player, pz = A.pascal, g = K.game, dP = Math.hypot(pz.x - P.x, pz.z - P.z);
  if (P.ext || P.surfing || P.mode !== 'walk') return false;
  if (dP > 40 && pz.wait <= 0 && !pz.ext) {   // summon Pascal
    const h = P.heading; let best = null;
    for (const r of [18, 14, 22, 10]) { const f = K.W.free(P.x - Math.sin(h) * r, P.z - Math.cos(h) * r, .9); if (Math.hypot(f[0] - P.x, f[1] - P.z) > 8) { best = f; break; } }
    if (best) {
      A.sfxText(pz.x, pz.y + 3, pz.z, 'POOF!', 'big'); pz.x = best[0]; pz.z = best[1]; pz.y = K.W.groundAt(pz.x, pz.z, P.y + 2, .9); pz.vx = pz.vz = 0; pz.place(); pz.stun = .6; pz.surge = 1.8; pz.safe = null;
      A.sfxText(pz.x, pz.y + 3, pz.z, 'POOF!', 'big'); A.say(pz.tag, U.pick(['Danke, Agent! Da bist du ja!', 'Teleport! Hallo Schatz!', 'Location shared! Komm zu Papa!']), 2.6, 'shout');
      A.say(a.tag, '📍 location shared', 1.6, 'code'); K.UI.banner('PASCAL SUMMONED', 'an agent shared your location', 'hug'); K.sfx.deploy && K.sfx.deploy(); K.fn.juice(.14, .1);
      P.inv = 2; return false;
    }
  }
  // leash
  if (teth) return false;
  teth = { a, x: P.x, z: P.z, t: 2.8, wig: 0 }; a.tether = true; P.inv = 4; leashMesh().visible = true;
  A.say(a.tag, U.pick(['leash.attach(dog)', 'safety_leash: ON', 'gently holding…']), 1.8, 'code'); K.sfx.zap(); A.sfxText(P.x, P.y + 2.4, P.z, 'CLICK!', 'pink');
  if (!g.told.leash) { g.told.leash = 1; K.UI.banner('LEASHED!', 'wiggle to snap it', 'hug'); }
  return true;
}
function release(snap) {
  const A = K.A, P = A.player; if (!teth) return; const a = teth.a; teth = null; K.UI.clearPrompt('leash'); if (leash) leash.visible = false; P.inv = Math.max(P.inv, 1.2);
  if (snap) { K.sfx.snap && K.sfx.snap(); K.fn.juice(.16, .2, .04); A.sfxText(P.x, P.y + 2.4, P.z, 'SNAP!', 'big'); P.vy = 6; P.onGround = false; }
  a.tether = false; A.killAgent(a);
}
K.on('build', () => { K.A.agentHit = hit; });
K.on('start', () => { if (teth) release(false); });
K.on('beforeEnd', () => { if (teth) release(false); });
K.on('end', () => { if (teth) release(false); });
K.on('step', (h, g) => {
  if (!teth) return; const A = K.A, P = A.player, a = teth.a;
  if (A.agents.indexOf(a) < 0 || P.mode !== 'walk' || P.ext || a.hacked || g.buffs.ghost > 0 || g.buffs.jammer > 0) { release(false); return; }
  K.UI.prompt(K.coarse ? 'DRAG TO WIGGLE FREE!' : 'WASD · WIGGLE FREE!', {source:'leash',priority:90,onActivate:()=>{}});
  const moving = Math.hypot(K.inp.mx, K.inp.mz) > .3; teth.t -= h * (moving ? 1.7 : 1); teth.wig += h;
  // the drone hovers over the anchor; Kyoto can only strain against the leash
  const dx = P.x - teth.x, dz = P.z - teth.z, d = Math.hypot(dx, dz), R = 2.4;
  if (d > R) { P.x = teth.x + dx / d * R; P.z = teth.z + dz / d * R; P.speed *= .6; A.kyoto.root.position.x = P.x; A.kyoto.root.position.z = P.z; }
  a.pos.set(teth.x + Math.sin(teth.wig * 3) * .4, K.W.terrainH(teth.x, teth.z) + 3.2 + Math.sin(teth.wig * 6) * .15, teth.z + Math.cos(teth.wig * 3) * .4); a.g.position.copy(a.pos);
  a.rotors.forEach(r => r.rotation.y += h * 40);
  if (teth.t <= 0) release(true);
});
K.on('frame', () => {
  if (!teth || !leash) return; const A = K.A;
  if (A.collarPos) A.collarPos(va); else va.set(A.player.x, A.player.y + 1.2, A.player.z);
  vb.copy(teth.a.pos); vb.y -= .3; span(leash, va, vb);
  const k = 1 + Math.max(0, 1 - teth.t / 2.8) * .8; leash.material.color.setHSL(.9, 1, .55 + Math.sin(teth.wig * 20) * .1 * k);
});
K.scenes = K.scenes || {};
K.scenes.agents_check = h => { h.play(); const P = K.A.player, pz = K.A.pascal, A = K.A; h.go(20, -30); P.ext = null; pz.wait = 999; A.spawnAgent(); const a = A.agents[A.agents.length - 1]; if (!a || !A.agentHit) throw new Error('AGENT CHECK: no agent hit API'); a.pos.set(P.x + 1, P.y + 3, P.z); a.g.position.copy(a.pos); if (!A.agentHit(a) || !teth || !teth.a.tether || !leash.visible) throw new Error('AGENT CHECK: tether acquisition failed'); P.x += 8; P.z += 8; h.st(1, ['KeyW']); if (Math.hypot(P.x - teth.x, P.z - teth.z) > 2.401) throw new Error('AGENT CHECK: leash radius failed'); h.st(60, ['KeyW']); if (teth) throw new Error('AGENT CHECK: wiggle release failed'); P.surfing = true; P.ext = () => {}; A.spawnAgent(); const surf = A.agents[A.agents.length - 1]; surf.pos.set(P.x + 1, P.y + 3, P.z); surf.g.position.copy(surf.pos); if (A.agentHit(surf) || teth) throw new Error('AGENT CHECK: surfing rejection failed'); P.surfing = false; P.ext = null; A.spawnAgent(); const b = A.agents[A.agents.length - 1]; b.pos.set(P.x + 1, P.y + 3, P.z); b.g.position.copy(b.pos); A.agentHit(b); if (!teth) throw new Error('AGENT CHECK: second tether failed'); K.game.buffs.ghost = 1; h.st(1); if (teth) throw new Error('AGENT CHECK: ghost release failed'); A.spawnAgent(); const c = A.agents[A.agents.length - 1]; c.pos.set(P.x + 1, P.y + 3, P.z); c.g.position.copy(c.pos); A.agentHit(c); K.game.buffs.jammer = 1; h.st(1); if (teth) throw new Error('AGENT CHECK: jammer release failed'); h.g.buffs.ghost = h.g.buffs.jammer = 0; pz.wait = 0; pz.x = P.x + 90; pz.z = P.z; A.spawnAgent(); const summon = A.agents[A.agents.length - 1]; const oldX = pz.x; A.agentHit(summon); if (pz.x === oldX || Math.hypot(pz.x - P.x, pz.z - P.z) > 40) throw new Error('AGENT CHECK: summon failed'); A.killAgent(summon); h.g.start(true); h.g.start(true); if (teth || leash.visible) throw new Error('AGENT CHECK: restart leash remains'); console.warn('AGENTS_CHECK PASS 9'); };
})(window.K);
