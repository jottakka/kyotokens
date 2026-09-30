/* KYOTO(KENS) — game loop, rules, decoration, boot */
'use strict';
(function (K) {
const T = K.T, U = K.U, W = K.W, A = K.A, UI = K.UI, scene = K.scene, camera = K.camera, $ = K.$, sfx = K.sfx, inp = K.inp;
if (!K.emit) { K.hooks = {}; K.on = () => {}; K.emit = () => {}; }
const g = K.game = { state: 'loading', time: 0, tokens: 0, inv: {}, wiggles: 3, buffs: {}, camYaw: Math.PI, camPitch: .32, camDist: 11, flowT: 0, duoT: 30, duo: null, mcpCool: 0, magT: 0, told: {} };
const P = A.player;
const MUSIC = () => window.KyotoMusic;

/* ================= DECORATION (props, billboards, murals, newsstands) ================= */
const TEX = {};
function texFrom(img, flip) { if (!img) return null; const t = new T.Texture(img); t.encoding = T.sRGBEncoding; t.anisotropy = Math.min(8, K.renderer.capabilities.getMaxAnisotropy()); t.flipY = flip !== false; t.needsUpdate = true; return t; }
function decorate() {
  ['bb_tokens', 'bb_hire', 'bb_gooddog', 'bb_agents', 'bb_agi', 'bb_mcp', 'mag_forbarks', 'mag_wagged', 'mag_treat', 'mag_lederhosen', 'mural_mission1', 'mural_mission2', 'mural_mission3', 'mural_tech', 'mural_fog', 'arcade_sign'].forEach(k => TEX[k] = texFrom(K.assets[k], true));
  const Pr = K.assets.props;
  const kits = {}; const kit = n => n in kits ? kits[n] : (kits[n] = W.kitParts(Pr, n) || (K.assets.props2 ? W.kitParts(K.assets.props2, n) : null));
  const inst = {}; const I = (n, tint) => inst[n] || (inst[n] = new W.Instancer(kit(n), tint || []));
  // street furniture along sidewalks
  const ints = W.ints, intSet = new Set(ints.map(([a, b]) => a + ',' + b));
  const nearInt = (x, z) => W.XR.some(a => Math.abs(x - a) < 10 && W.ZR.some(b => Math.abs(z - b) < 10 && intSet.has(a + ',' + b)));
  let n = 0;
  for (const s of W.roadSegs) {
    if (s.curve) continue;
    const len = Math.hypot(s.bx - s.ax, s.bz - s.az), dx = (s.bx - s.ax) / len, dz = (s.bz - s.az) / len, px = -dz, pz = dx;
    const off = s.market ? W.MKT.w / 2 + 2.5 : 7.8;
    for (let d = 6; d < len - 4; d += s.market ? 11 : 13) {
      for (const side of [-1, 1]) {
        const x = s.ax + dx * d + px * off * side, z = s.az + dz * d + pz * off * side;
        if (!W.inLand(x, z, 1) || nearInt(x, z) || W.parkAt(x, z) && !s.market) continue;
        if (!s.market && W.onMarket(x, z, 3)) continue;
        const y = W.terrainH(x, z); if (W.blockedAt(x, z, .7, y + .1)) continue;
        const waterfront = (s.az === -200 && s.bz === -200 && side < 0) || (s.ax === 250 && s.bx === 250 && side > 0);
        n++;
        let type;
        if (s.market) type = n % 9 === 4 ? 'bus_stop_pole' : n % 13 === 6 ? 'flower_cart' : n % 29 === 11 ? 'public_toilet' : n % 2 ? 'palm_canary' : 'lamp_market';
        else if (waterfront) type = n % 3 ? 'palm_canary' : 'lamp_plain';
        else { const r = U.hash(x, z), d = W.district(x, z), bare = d === 'sunset' || d === 'parkmerced';   // the Sunset's famously treeless sidewalks
          type = r < (bare ? .12 : .42) ? (d === 'mission' || d === 'bernal' ? 'palm_fan' : d === 'marina' ? 'palm_canary' : U.pick(['tree_plane', 'tree_ficus'])) : r < .42 ? null : r < .6 ? 'lamp_plain' : r < .66 ? 'hydrant' : r < .7 ? 'trashcan' : r < .73 ? 'bench' : r < .75 ? 'bike_rack' : r < .78 ? 'flower_box' : r < .8 ? 'parking_meter' : r < .815 ? 'mailbox' : r < .83 ? 'news_boxes' : r < .842 ? 'recycle_bins' : r < .852 ? 'e_scooter' : r < .86 ? 'bikeshare_dock' : r < .866 ? 'sandwich_board' : r < .872 ? 'cafe_set' : null; }
        if (!type || !kit(type)) continue;
        I(type).add(x, y, z, Math.atan2(px * side, pz * side), 1, 1, 1);
        if (/palm|tree|lamp/.test(type)) W.addCircle(x, z, /palm|tree/.test(type) ? .65 : .35, y + 7, { plat: false });
        else { const b = kit(type).box, rot = Math.atan2(px * side, pz * side), cx = (b.min.x + b.max.x) / 2, cz = (b.min.z + b.max.z) / 2; W.addOBB(x + Math.cos(rot) * cx + Math.sin(rot) * cz, z - Math.sin(rot) * cx + Math.cos(rot) * cz, (b.max.x - b.min.x) / 2, (b.max.z - b.min.z) / 2, rot, y + b.max.y); }
      }
    }
  }
  // street-name signs, work zones, Castro rainbow benches (props2 kit)
  for (const [x0, z0] of ints) {
    if (!W.inLand(x0, z0, 12) || U.hash(x0 * 1.7, z0 * .3) > .35) continue;
    const x = x0 + 7.6, z = z0 + 7.6, y = W.terrainH(x, z); if (W.blockedAt(x, z, .8, y + .1) || !kit('street_sign')) continue;
    I('street_sign').add(x, y, z, Math.PI / 4, 1, 1, 1); W.addCircle(x, z, .25, y + 3.5);
  }
  for (const [x0, z0] of ints.filter(([a, b]) => U.hash(a * .37, b * 1.3) < .07)) {   // work zones hug the curb so traffic can still pass
    const bx = x0 + 6.3, z = z0 + 15, y = W.terrainH(bx, z); if (!W.inLand(bx, z, 4) || !kit('construction_barrier') || W.blockedAt(bx, z, 1.4, y + .1)) continue;
    I('construction_barrier').add(bx, y, z, Math.PI / 2, 1, 1, 1); W.addOBB(bx, z, 1.2, .3, Math.PI / 2, y + 1.1);
    for (const dz of [-3, 3]) if (kit('traffic_cone') && !W.blockedAt(bx + .1, z + dz, .5, y + .1)) { I('traffic_cone').add(bx + .1, W.terrainH(bx, z + dz), z + dz, 0, 1, 1, 1); W.addCircle(bx + .1, z + dz, .4, y + 1); }
  }
  for (const [dx, dz, r] of [[-8, -9, 0], [9, 8, Math.PI], [-9, 9, Math.PI / 2]]) {
    const x = -110 + dx, z = 220 + dz, y = W.terrainH(x, z); if (!kit('bench_rainbow') || W.blockedAt(x, z, 1.2, y + .1)) continue;
    I('bench_rainbow').add(x, y, z, r, 1, 1, 1); W.addOBB(x, z, 1, .35, r, y + 1.4);
  }
  // parks: trees, cypress, palms (Presidio / Mt Davidson / Lands End are proper forests)
  const nearTrail = (x, z) => W.TRAILS.some(t => t.some((p, i) => i && distSeg(x, z, { ax: t[i - 1][0], az: t[i - 1][1], bx: p[0], bz: p[1] }) < 3.2));
  const noTree = (x, z) => W.NOTREE.some(r => x > r.x0 && x < r.x1 && z > r.z0 && z < r.z1);
  for (const pk of W.PARKS) { if (pk.plaza || pk.dens === 0) continue; const area = (pk.x1 - pk.x0) * (pk.z1 - pk.z0); const cnt = Math.round(area / (pk.dens || 90));
    for (let i = 0; i < cnt; i++) { const x = U.rand(pk.x0 + 3, pk.x1 - 3), z = U.rand(pk.z0 + 3, pk.z1 - 3); if ((pk.trees && W.parkAt(x, z) !== pk) || noTree(x, z) || W.blockedAt(x, z, 2, W.terrainH(x, z) + .1) || W.onRoad(x, z, 2) || nearTrail(x, z)) continue;
      const type = pk.trees ? U.pick(pk.trees) : pk.n === 'Dolores Park' ? U.pick(['palm_fan', 'palm_canary', 'tree_plane']) : pk.n === 'Twin Peaks' ? (Math.random() < .3 ? 'cypress' : null) : pk.n === 'Mt Sutro' ? 'cypress' : U.pick(['tree_plane', 'cypress', 'tree_ficus', 'tree_plane']);
      if (!type || !kit(type)) continue; const s = U.rand(.85, 1.35); I(type).add(x, W.terrainH(x, z), z, U.rand(0, 6), s, s, s); W.addCircle(x, z, .7 * s, W.terrainH(x, z) + 7 * s); } }
  // Union Square: hearts, food truck, carousel-ish palms
  // newsstands with magazine covers
  const mags = ['mag_forbarks', 'mag_wagged', 'mag_treat', 'mag_lederhosen', 'mag_forbarks'];
  A.kiosks = [];
  const ns = Pr && Pr.scene.getObjectByName('newsstand');
  for (const [x0, z0] of [[128, -24], [226, -128], [58, -196], [36, -2], [-36, 150], [-122, 40], [160, 30], [-146, 108], [-446, -28], [-466, 226], [-84, 346], [-140, -196], [222, 330], [-708, 180], [36, 306]]) {
    const [x, z] = W.freeWalk(x0, z0, 2.4); const y = W.terrainH(x, z); let o;
    if (ns) { o = ns.clone(true); K.ownMaterials(o); o.traverse(c => { const m = /mag_slot_(\d)/.exec(c.name); if (m && c.isMesh) { const t = TEX[mags[+m[1]]]; if (t) c.material = new T.MeshBasicMaterial({ map: K.surfaceTexture(t, c), toneMapped: false }); } if (c.isMesh) c.castShadow = true; }); }
    else { o = new T.Mesh(new T.BoxGeometry(3.4, 3, 2.2), K.toon('#2f7d4f')); o.position.y = 1.5; }
    const grp = new T.Group(); grp.add(o); grp.position.set(x, y, z); grp.rotation.y = Math.atan2(K.A.player.x - x, K.A.player.z - z) * 0 + U.pick([0, Math.PI / 2, Math.PI, -Math.PI / 2]); scene.add(grp); W.meshColliders(grp); W.addCull(grp, x, z, 260);
    W.addCircle(x, z, 1.9, y + 3); A.kiosks.push({ x, z, i: U.randi(0, 3) });
  }
  // rooftop billboards
  const bf = Pr && Pr.scene.getObjectByName('billboard_frame'); const ads = ['bb_tokens', 'bb_hire', 'bb_gooddog', 'bb_agents', 'bb_agi', 'bb_mcp'];
  let ai = 0;
  const core = s => s.x > -262 && s.z < 280, spots = W.billboardSpots.filter(core).slice(0, 10).concat(W.billboardSpots.filter(s => !core(s)).filter((s, i) => i % 3 === 0).slice(0, 7));   // downtown first, a few out in the avenues
  // plus guaranteed hero billboards facing the main spawn street & Market
  spots.unshift({ x: 150, z: -64, rot: 0, y: W.terrainH(150, -64) }, { x: 70, z: 46, rot: Math.PI, y: W.terrainH(70, 46) });
  for (const s of spots) {
    const tex = TEX[ads[ai++ % ads.length]]; let o;
    if (bf) { o = bf.clone(true); o.traverse(c => { if (c.name === 'billboard_face' && c.isMesh && tex) c.material = new T.MeshBasicMaterial({ map: K.surfaceTexture(tex, c), toneMapped: false }); if (c.isMesh) c.castShadow = true; }); }
    else { o = new T.Group(); const f = new T.Mesh(new T.PlaneGeometry(16, 9), new T.MeshBasicMaterial({ map: tex })); f.position.y = 10; o.add(f); }
    o.position.set(s.x, s.y, s.z); o.rotation.y = s.rot; scene.add(o); W.meshColliders(o); W.addCull(o, s.x, s.z, 560);
  }
  // murals on Mission walls
  const murals = ['mural_mission1', 'mural_mission2', 'mural_mission3', 'mural_tech', 'mural_fog']; let mi = 0;
  for (const m of []) { const t = TEX[murals[mi++ % murals.length]]; if (!t) continue; const pl = new T.Mesh(new T.PlaneGeometry(m.d * .9, m.h * .75), K.toon('#ffffff', { map: t }));
    const side = Math.random() < .5 ? 1 : -1; const lx = side * (m.w / 2 + .06); pl.position.set(m.x + Math.cos(m.rot) * lx, m.y + m.h * .45, m.z - Math.sin(m.rot) * lx); pl.rotation.y = m.rot + side * Math.PI / 2; pl.receiveShadow = true; scene.add(pl); }
  // arcade.dev lobby sign
  const sign = scene.getObjectByName('arcade_sign_panel'); if (sign && K.assets.arcade_sign) { const st = texFrom(K.assets.arcade_sign, true); sign.traverse(o => { if (o.isMesh) o.material = new T.MeshBasicMaterial({ map: K.surfaceTexture(st, o) }); }); }
  // parked food trucks & carousel & picado strings
  const put = (name, x, z, ry, s) => { let src = Pr && Pr.scene.getObjectByName(name); let vs = 1; if (!src && K.assets.vehicles) { src = K.assets.vehicles.scene.getObjectByName(name); vs = A.VS; } if (!src) return null; const o = src.clone(true); o.scale.setScalar(vs); o.position.set(x, W.terrainH(x, z), z); o.rotation.y = ry || 0; if (s) o.scale.setScalar(s); o.traverse(c => { if (c.isMesh) c.castShadow = true; }); scene.add(o); if (!/picado|carousel/.test(name)) W.meshColliders(o); return o; };
  for (const [x, z, ry] of [[40, 30, Math.PI / 2], [-30, 170, 0], [236, -80, Math.PI], [0, -196, Math.PI / 2], [150, -16, .6], [-714, 210, 0], [-222, 158, Math.PI / 2], [232, 296, Math.PI], [-300, -194, Math.PI / 2], [-80, 290, 0]]) { const [fx, fz] = W.freeWalk(x, z, 4), o = put('foodtruck', fx, fz, ry); if (o) { W.addCull(o, fx, fz, 300); W.addCircle(fx + Math.sin(ry) * 3.5, fz + Math.cos(ry) * 3.5, 3, W.terrainH(fx, fz) + 6); W.addCircle(fx - Math.sin(ry) * 3.5, fz - Math.cos(ry) * 3.5, 3, W.terrainH(fx, fz) + 6); } }
  const car = put('carousel', 84, -236, 0); if (car) { W.addCircle(84, -236, 6.2, 8.5); A.carousel = car.getObjectByName('carousel_spin'); }
  for (const [x, z, ry] of [[-10, 130, 0], [30, 190, 0], [-70, 160, Math.PI / 2], [10, 240, 0], [-20, 100, 0], [40, 306, 0], [-80, 342, 0]]) { const o = put('picado', x, z, ry); if (o) W.addCull(o, x, z, 260); }
  for (const [x, z] of [[46, 12], [30, 22], [-45, 176], [-60, 200], [10, 70], [46, 296], [-150, 112], [-480, 232], [-712, 60], [-330, -118], [-600, 98]]) { const [fx, fz] = W.freeWalk(x, z, 1.5), o = put(U.pick(['taco_stand', 'food_cart']), fx, fz, U.rand(0, 6)); if (o) { W.addCircle(fx, fz, 1.4, W.terrainH(fx, fz) + 2.5); W.addCull(o, fx, fz, 240); } }
  for (const [x, z] of [[30, 0], [48, 20], [36, 24]]) heart(x, z);
  // Pier 39: two rows of weathered wooden shops + entrance arch
  const woods = ['#b0784c', '#9c6a44', '#c38a5a', '#8e5f3e'], trims = ['#f4e3c3', '#2f7d4f', '#e2572f', '#1f6fd1'];
  for (const [sx, face] of [[69, 0], [99, Math.PI]]) for (let z = -216; z > -266; z -= 12.5) {
    const g2 = new T.Group(); const col = U.pick(woods), tr = U.pick(trims);
    const body = new T.Mesh(new T.BoxGeometry(8, 6, 10), K.toon(col)); body.position.y = 3; g2.add(body);
    const sh = new T.Shape(); sh.moveTo(-4.6, 0); sh.lineTo(4.6, 0); sh.lineTo(0, 3); sh.closePath(); const roof = new T.Mesh(new T.ExtrudeGeometry(sh, { depth: 10.6, bevelEnabled: false }), K.toon('#6b4a36')); roof.position.set(0, 6, -5.3); g2.add(roof);
    const aw = new T.Mesh(new T.BoxGeometry(.2, .3, 9), K.toon(tr)); aw.position.set(4.2, 3.9, 0); g2.add(aw);
    const awn = new T.Mesh(new T.BoxGeometry(1.6, .12, 9), K.toon(tr)); awn.position.set(4.9, 3.6, 0); awn.rotation.z = -.35; g2.add(awn);
    const win = new T.Mesh(new T.BoxGeometry(.1, 2.2, 6), K.toon('#ffe7a8', { emissive: new T.Color('#6a4a10') })); win.position.set(4.05, 2.2, 0); g2.add(win);
    g2.position.set(sx, 0, z); g2.rotation.y = face; g2.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } }); scene.add(g2); K.inkShell(g2, .05); W.addCull(g2, sx, z, 460);
    W.addBox(sx - 4, sx + 4, z - 5, z + 5, 7.5);
  }
  const archTex = K.canvasTex(512, 128, (c) => { c.fillStyle = '#1f4f7a'; c.fillRect(0, 0, 512, 128); c.strokeStyle = '#ffcf3f'; c.lineWidth = 10; c.strokeRect(8, 8, 496, 112); c.font = '78px Bangers, Impact'; c.fillStyle = '#fff4de'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('PIER 39', 256, 70); });
  for (const s of [-1, 1]) { const p = new T.Mesh(new T.BoxGeometry(1.2, 9, 1.2), K.toon('#6b4a36')); p.position.set(84 + s * 9, 4.5, -207); p.castShadow = true; scene.add(p); W.addBox(84 + s * 9 - .6, 84 + s * 9 + .6, -207.6, -206.4, 9); }
  const banner = new T.Mesh(new T.BoxGeometry(20, 4.2, .6), [K.toon('#1f4f7a'), K.toon('#1f4f7a'), K.toon('#1f4f7a'), K.toon('#1f4f7a'), K.toon('#ffffff', { map: archTex }), K.toon('#ffffff', { map: archTex })]); banner.position.set(84, 8.4, -207); banner.castShadow = true; scene.add(banner);
  // LOD: trees swap to canopy blobs with the buildings, lamps and signs fade at ~300, small street clutter at ~190; only canopies and lamp poles cast shadows
  const LEAF = { tree_plane: '#5aa844', tree_ficus: '#3f8f3a', cypress: '#2f6f3a', palm_canary: '#4f9a45', palm_fan: '#5aa844' };
  for (const k in inst) inst[k].build(LEAF[k] ? { lod: 'tree', leaf: LEAF[k], cast: ['leaf', 'leaf_dark', 'leaf_light'] } : /lamp|street_sign|bus_stop|toilet/.test(k) ? { lod: 300, cast: /lamp/.test(k) ? ['metal'] : false } : { lod: 190, cast: false });
}
function heart(x0, z0) { const [x, z] = W.freeWalk(x0, z0, 1.6); const col = U.pick(['#ff4f6b', '#ff8fc4', '#ffd23f', '#29d3c8']); const gg = new T.Group(); const m = K.toon(col);
  for (const s of [-1, 1]) { const b = new T.Mesh(new T.SphereGeometry(1.1, 16, 12), m); b.position.set(s * .8, 3.1, 0); gg.add(b); }
  const c = new T.Mesh(new T.ConeGeometry(1.75, 2.6, 16), m); c.rotation.z = Math.PI; c.position.y = 1.9; gg.add(c); const base = new T.Mesh(new T.CylinderGeometry(1.1, 1.3, .6, 12), K.toon('#e9e1d0')); base.position.y = .3; gg.add(base);
  gg.traverse(o => { if (o.isMesh) o.castShadow = true; }); gg.position.set(x, W.terrainH(x, z), z); gg.rotation.y = U.rand(0, 6); scene.add(gg); W.addCircle(x, z, 1.5, W.terrainH(x, z) + 4.2); }
function distSeg(x, z, s) { const vx = s.bx - s.ax, vz = s.bz - s.az, l2 = vx * vx + vz * vz; let t = ((x - s.ax) * vx + (z - s.az) * vz) / l2; t = U.clamp(t, 0, 1); return Math.hypot(x - (s.ax + vx * t), z - (s.az + vz * t)); }

/* ================= GAME FLOW ================= */
g.start = function (restart) {
  sfx.init(); sfx.resume();
  const M = MUSIC(); if (M && !g.musicInit && sfx.ctx) { try { M.init(sfx.ctx, sfx.musicOut); M.onTrack = tr => { if (tr && tr.id !== 'pascal') UI.radio(tr.title); }; g.musicInit = true; } catch (e) { console.warn(e); } }
  K.sceneCam = null; UI.clearCam(); UI.reset(); K.resetInput(); A.hideTags = false; K.post.pause.value = K.post.danger.value = K.post.flash.value = 0; barkCool = 0; hudT = mmT = 0;
  if (P.car) { P.car.mode = 'parked'; P.car.speed = 0; }
  const S = W.HOME.start;
  Object.assign(P, { ext: null, x: S.x, z: S.z, y: W.terrainH(S.x, S.z), vy: 0, heading: S.heading, speed: 0, mode: 'walk', onGround: true, stun: 0, inv: 0, stamina: 1, board: 0, car: null, carT: 0, cable: null, vx: 0, vz: 0, jumpBuffer: 0, coyote: 0, stamDelay: 0, barkT: 0, poseT: 0, safe: null, interactT: .25, squash: 0 });
  A.kyoto.board.visible = false; if (A.kyoto.root.parent !== scene) scene.add(A.kyoto.root); A.kyoto.root.scale.setScalar(1); A.kyoto.root.visible = true; A.kyoto.root.rotation.set(0, P.heading, 0); A.kyoto.play('idle');
  g.endCam = null; g.beers = 0; if (A.leash) A.leash.main.m.visible = false;
  Object.assign(g, { time: 0, tokens: 0, inv: {}, wiggles: 3, buffs: { ghost: 0, magnet: 0, turbo: 0, jammer: 0, buzz: 0 }, flowT: 0, duoT: 30, mcpCool: 0, magT: 0, told: {}, shake: 0, hitStop: 0, camReset: true, photos: 0, skipReq: false });
  const pz = A.pascal; Object.assign(pz, { ext: null, x: PZ_END.x, z: PZ_END.z, vx: 0, vz: 0, wait: 2.8, getUp: 0, stun: 0, agentT: 22, sayT: 5, rage: 0, glitch: 0, glitchCool: 0, hugT: 0, ping: 0, surge: 0, surgeT: 5, warn: 0, safe: null });
  pz.y = W.groundAt(pz.x, pz.z, 4, .9); pz.place(); pz.root.rotation.set(0, pz.heading, 0);
  while (A.agents.length) A.killAgent(A.agents[0]);
  for (let i = A.items.length - 1; i >= 0; i--) { const it = A.items[i]; if (it.temp) { dmy.scale.setScalar(0); dmy.updateMatrix(); A.tokenIM.setMatrixAt(it.idx, dmy.matrix); A.tokenFree.push(it.idx); A.items.splice(i, 1); continue; } it.active = true; it.respawn = 0; if (it.mesh) it.mesh.visible = true; }
  A.letters.forEach((l, i) => { l.got = false; l.g.visible = true; l.beam.visible = true; UI.setLetter(i, false); });
  if (g.duo) endDuo(false);
  A.cars.forEach(c => { c.mode = 'auto'; c.speed = c.v = 0; c.s = c.initialS; const q = A.loopPos(c.loop, c.s); c.x = q.x; c.z = q.z; c.heading = q.h; c.safe = null; A.placeVehicle(c, 0); });
  A.peds.forEach(p => { if (p.noBoard) { p.noBoard = 0; if (p.board3) { p.board3.visible = true; p.sp = 6; } } p.scared = 0; });
  A.boss.cool = A.boss.stopT = 0; A.boss.first = false; A.dealer.greeted = -Infinity;
  if (A.resetPhotos) A.resetPhotos(); UI.setAlbum(0, A.photos ? A.photos.length : 15);
  W.recover(P, .7, P.y); A.kyoto.root.position.set(P.x, P.y, P.z); setGhost(false);
  UI.title.visible = false; $('#end').hidden = true; $('#help').hidden = true;
  g.camYaw = P.heading; inp.camPitch = 0; g.camArm = 0;
  if (!restart && g.state === 'title') introStart(); else finishIntro(true);
  UI.hudUpdate(g); UI.minimap(); W.computeFlow(P.x, P.z);
  K.emit('start', restart);
  if (M && g.musicInit) { try { M.stinger('start'); M.play(g.lastSong || 'theme', { fade: 1.5 }); g.chaseMusic = false; } catch (e) {} }
};
g.pause = function (on, album) {
  if (on && K.unlock) K.unlock();
  if (on && (g.state === 'play' || g.state === 'intro')) { g.resumeState = g.state; g.state = 'paused'; K.resetInput(); K.post.pause.value = 1; if (album === 'map') { UI.bigMap(true); sfx.click(); } else if (album) { UI.album(true); sfx.click(); } else UI.showPause(true); A.hideTags = true; $('#touch').hidden = true; UI.prompt(null); UI.skipHint(false); K.emit('pause', true); }
  else if (!on && g.state === 'paused') { g.state = g.resumeState || 'play'; K.resetInput(); sfx.resume(); K.post.pause.value = 0; UI.showPause(false); UI.album(false); UI.bigMap(false); A.hideTags = false; $('#touch').hidden = !K.coarse || g.state === 'intro'; if (g.state === 'intro') UI.skipHint(true); K.emit('pause', false); }
};
g.mapKey = function () {
  if (g.state === 'play') g.pause(true, 'map');
  else if (g.state === 'paused' && UI.mapOpen) g.pause(false);
};
g.albumKey = function () {
  if (g.state === 'play') g.pause(true, true);
  else if (g.state === 'paused' && g.resumeState === 'play') { if (UI.albumOpen) g.pause(false); else { UI.showPause(false); UI.bigMap(false); UI.album(true); sfx.click(); } }
};
K.testMode = K.testMode || (typeof location !== 'undefined' && /[?&]test=1\b/.test(location.search));
K.onBlur = () => { if (!K.testMode) g.pause(true); };
document.addEventListener('visibilitychange', () => { if (K.testMode) return; if (document.hidden) { K.resetInput(); g.pause(true); sfx.suspend(); } else { last = performance.now(); sfx.resume(); } });
/* finale: Pascal hugs Kyoto on the Crissy Field shore, Golden Gate behind them; camera leaves the right third for the results */
const END_SPOT = { x: -190, z: -196.5, bx: -232, bz: -238 };
function stageReunion() {
  const E = END_SPOT, k = A.kyoto, pz = A.pascal;
  const f = new T.Vector3(E.bx - E.x, 0, E.bz - E.z).normalize(), up = new T.Vector3(0, 1, 0), r = new T.Vector3().crossVectors(f, up).normalize();
  if (k.root.parent !== scene) scene.add(k.root); k.root.scale.setScalar(1); k.root.visible = true; k.board.visible = false;
  P.x = E.x; P.z = E.z; P.y = W.groundAt(P.x, P.z, 6, .9); P.heading = Math.atan2(-f.x, -f.z);
  k.root.position.set(P.x, P.y, P.z); k.root.rotation.set(0, P.heading + .75, 0); k.play('sit', .2);
  pz.x = P.x + r.x * 1.25 - f.x * .15; pz.z = P.z + r.z * 1.25 - f.z * .15; pz.y = W.groundAt(pz.x, pz.z, 6, .9);
  pz.heading = Math.atan2(P.x - pz.x, P.z - pz.z); pz.place(); pz.root.rotation.set(0, pz.heading, 0); pz.play(pz.actions.embrace ? 'embrace' : 'hug', .2);
  if (A.leash) for (const q of ['main', 'kp', 'pp']) A.leash[q].m.visible = false;
  const c = new T.Vector3((P.x + pz.x) / 2, P.y, (P.z + pz.z) / 2);
  g.endCam = { pos: c.clone().addScaledVector(f, K.VW < K.VH ? -9 : -5.0).addScaledVector(r, 1.1).add(new T.Vector3(0, 1.9, 0)), look: c.clone().addScaledVector(r, K.VW < K.VH ? 0 : 2.05).add(new T.Vector3(0, 1.15, 0)) };
  W.followSun && W.followSun(P.x, P.z);
}
function endGame(win) {
  if (P.mode === 'car') exitCar(true); if (P.mode === 'cable') leaveCable();
  K.emit('beforeEnd', win); P.ext = null; P.mode = 'walk'; P.car = null; P.cable = null;
  K.emit('end', win); if (K.unlock) K.unlock();
  P.speed = P.vx = P.vz = 0; K.resetInput(); UI.prompt(null); $('#mag').hidden = true;
  g.state = 'end'; g.endT = 0; g.win = win; A.hideTags = true; UI.showEnd(win); $('#hud').hidden = true; $('#touch').hidden = true;
  stageReunion();
  const M = MUSIC(); if (M && g.musicInit) try { M.stinger(win ? 'win' : 'caught'); } catch (e) {}
  if (win) { const b = parseFloat(K.store.get('kyotokens-best') || ''); if (!(b > 0) || g.time < b) K.store.set('kyotokens-best', String(g.time)); }
  $('#stBeer').textContent = g.beers || 0; $('#stTime').textContent = U.mmss(g.time); $('#stTok').textContent = U.fmt(g.tokens); $('#stLet').textContent = A.letters.filter(l => l.got).length + '/5'; $('#stPh').textContent = (g.photos || 0) + '/' + (A.photos ? A.photos.length : 15);
  const best = parseFloat(K.store.get('kyotokens-best') || ''); $('#stBest').textContent = best > 0 ? U.mmss(best) : '—';
  $('#end').hidden = false;
  A.pascal.play(A.pascal.actions.embrace ? 'embrace' : 'hug'); A.kyoto.play('sit');
}

/* ================= PLAYER ================= */
const MOVE = new T.Vector2();
let ghostOn = false;
function setGhost(on) { if (on === ghostOn && A.kyoto.ghostReady) return; ghostOn = on; A.kyoto.ghostReady = true;
  A.kyoto.root.traverse(o => { if (!o.isMesh) return; for (const m of Array.isArray(o.material) ? o.material : [o.material]) { if (!m.userData.kyotoBase) m.userData.kyotoBase = { opacity: m.opacity, transparent: m.transparent, depthWrite: m.depthWrite }; const b = m.userData.kyotoBase; m.transparent = on || b.transparent; m.opacity = on ? b.opacity * .4 : b.opacity; m.depthWrite = on ? false : b.depthWrite; m.needsUpdate = true; } });
}
function juice(shake, squash, stop) { if (K.reduceMotion) return; g.shake = Math.max(g.shake || 0, shake); P.squash = Math.max(P.squash || 0, squash); g.hitStop = Math.max(g.hitStop || 0, stop || 0); }

function updatePlayer(dt) {
  for (const k in g.buffs) if (g.buffs[k] > 0) g.buffs[k] = Math.max(0, g.buffs[k] - dt);
  P.inv = Math.max(0, P.inv - dt); P.stun = Math.max(0, P.stun - dt);
  const k = A.kyoto; P.interactT = Math.max(0, (P.interactT || 0) - dt); setGhost(g.buffs.ghost > 0);
  if (P.ext) return P.ext(dt);   // a feature module (e.g. surf) drives Kyoto
  if (P.mode === 'car') return updateDrive(dt);
  if (P.mode === 'cable') return updateCable(dt);
  if (P.mode === 'hug') { P.hugT -= dt; k.root.position.set(P.x, P.y, P.z); if (P.hugT <= 0) wiggleFree(); k.mixer.update(dt); return; }
  if (P.board > 0) { P.board -= dt; if (P.board <= 0) { k.board.visible = false; UI.banner('BONK', 'board returned to the universe'); } }
  // movement basis is latched while the same direction is held: the auto-following camera can swing behind Kyoto without bending his path
  const held = Math.hypot(inp.mx, inp.mz) > .12, dirKey = held ? Math.round(Math.atan2(inp.mx, inp.mz) / (Math.PI / 8)) : null;
  if (!held || dirKey !== g.moveKey || g.moveYaw == null) { g.moveYaw = g.camYaw; g.moveKey = dirKey; }
  else if (performance.now() - inp.lastManual < 120) g.moveYaw = g.camYaw;   // the player steering with the mouse re-aims immediately
  const f = [Math.sin(g.moveYaw), Math.cos(g.moveYaw)], r = [-f[1], f[0]];
  MOVE.set(r[0] * inp.mx + f[0] * inp.mz, r[1] * inp.mx + f[1] * inp.mz);
  let mag = Math.min(1, MOVE.length()); if (P.stun > 0 || mag < .12) { mag = 0; MOVE.set(0, 0); }
  const onBoard = P.board > 0, sprint = inp.sprint && mag > .2 && (P.stamina > .08 || g.buffs.buzz > 0);
  if (sprint && g.buffs.buzz <= 0) { P.stamina = Math.max(0, P.stamina - dt * .18); P.stamDelay = .8; } else { P.stamDelay = (P.stamDelay || 0) - dt; if (P.stamDelay <= 0) P.stamina = Math.min(1, P.stamina + dt * .14); }
  let max = onBoard ? 21 : 16; if (sprint) max *= onBoard ? 1.2 : 1.38; if (g.buffs.turbo > 0) max *= 1.25;
  if (mag) { const th = Math.atan2(MOVE.x, MOVE.y); P.heading = U.lerpAng(P.heading, th, 1 - Math.exp(-dt * (onBoard ? 12 : 20))); }
  P.jumpBuffer = inp.jump ? .13 : Math.max(0, (P.jumpBuffer || 0) - dt); P.coyote = P.onGround ? .1 : Math.max(0, (P.coyote || 0) - dt);
  if (P.jumpBuffer > 0 && P.coyote > 0 && P.stun <= 0) { P.vy = onBoard ? 11.5 : 10.5; P.onGround = false; P.jumpBuffer = P.coyote = 0; k.once('jump', .08); juice(.06, 0); sfx.yip(); }
  const accel = P.onGround ? (onBoard ? 12 : 22) : 9;
  P.vx = U.damp(P.vx || 0, MOVE.x * max, accel, dt); P.vz = U.damp(P.vz || 0, MOVE.y * max, accel, dt);
  if (!mag && P.onGround) P.vx = P.vz = 0;
  if (Math.hypot(P.vx, P.vz) < .04) P.vx = P.vz = 0;
  const ox = P.x, oz = P.z;
  W.move(P, P.vx * dt, P.vz * dt, .7, P.y, { grounded: P.onGround });
  P.speed = dt > 0 ? Math.hypot(P.x - ox, P.z - oz) / dt : 0;
  const previousY = P.y, wasGrounded = P.onGround;
  P.vy -= 27 * dt; P.y += P.vy * dt;
  if (P.vy > 0) { const ceiling = W.ceilingAt(P.x, P.z, previousY, 1.4, .7); if (P.y + 1.4 >= ceiling) { P.y = ceiling - 1.42; P.vy = 0; } }
  if (P.vy < 0) for (const s of A.sealions) { const dx = P.x - s.x, dz = P.z - s.z; if (dx * dx + dz * dz < (s.rad2 || 3.2) && previousY >= s.top - .05 && P.y <= s.top + .5) { P.vy = 21.5; P.y = s.top + .55; P.onGround = false; sfx.boing(); juice(.18, .18); A.sfxText(s.x, s.top + 1.5, s.z, 'BOING!', 'pink'); A.say(s.tag, 'ARF!', 1, 'shout'); if (s.r) { s.r.play('bark'); s.idleT = .9; } break; } }
  const gr = W.groundAt(P.x, P.z, Math.max(previousY, P.y), .7);
  if (P.y <= gr || (wasGrounded && P.vy <= 0 && P.y - gr < .6)) { if (!wasGrounded && P.vy < -5) { juice(Math.min(.22, -P.vy * .009), .2); if (P.vy < -18) sfx.thud(); } P.y = gr; P.vy = 0; P.onGround = true; }
  else P.onGround = false;
  P.squash = U.damp(P.squash || 0, 0, 15, dt); k.root.scale.set(1 + P.squash * .5, 1 - P.squash, 1 + P.squash * .5);
  // animation
  k.root.position.set(P.x, P.y, P.z); k.root.rotation.y = P.heading; k.board.visible = onBoard;
  P.barkT = Math.max(0, (P.barkT || 0) - dt); P.poseT = Math.max(0, (P.poseT || 0) - dt);
  if (P.poseT > 0) k.play('sit', .08);
  else if (P.barkT <= 0 && (k.curName !== 'jump' || P.onGround)) {
    if (onBoard) k.play('idle', .2); else if (P.speed < .6) k.play('idle', .25); else if (P.speed < 6) k.play('trot', .2, Math.max(.6, P.speed / 5)); else k.play('run', .15, P.speed / 17);
  }
  if (k.tongue) k.tongue.visible = P.mode !== 'hug';   // happy pant, always
  const blink = P.inv > 0 && Math.floor(g.time * 12) % 2 === 0; k.root.visible = !blink || P.inv > 2.2;
  k.mixer.update(dt);
}
function wiggleFree() {
  const pz = A.pascal; P.mode = 'walk'; P.inv = 3; P.vy = 9; P.onGround = false; P.speed = 15;
  P.heading = Math.atan2(P.x - pz.x, P.z - pz.z) || P.heading; P.vx = Math.sin(P.heading) * 15; P.vz = Math.cos(P.heading) * 15; pz.stun = 1.8; pz.play('call', .2);
  A.say(pz.tag, U.pick(['Nein! Kyoto, warte!', 'Du kleiner Wackelhund!', 'Kyoto!! Nicht schon wieder!']), 2.2, 'shout');
  A.sfxText(P.x, P.y + 2.5, P.z, 'WIGGLE!', 'gold'); sfx.yip();
}
function updateDrive(dt) {
  const c = P.car, k = A.kyoto; if (!c || c.mode !== 'driven') { P.mode = 'walk'; P.car = null; scene.add(k.root); k.root.scale.setScalar(1); return; }
  const thr = Math.abs(inp.mz) > .12 ? inp.mz : 0, steer = Math.abs(inp.mx) > .12 ? -inp.mx : 0;
  const oldX=c.x, oldZ=c.z, speed=Math.abs(c.speed), target=thr>0?29*thr:thr<0?-9:0;
  // S first brakes forward motion, then reverses. High-speed steering softens without becoming sluggish.
  c.speed=U.damp(c.speed,target,thr<0 && c.speed>0?5.5:thr?2.4:8,dt);
  if(!thr && Math.abs(c.speed)<.15)c.speed=0;
  c.steer=U.damp(c.steer || 0,steer,12,dt);
  const turn=c.steer*(2.35-.8*U.clamp(speed/29,0,1))*U.clamp(c.speed/7,-1,1)*dt;
  const count=Math.max(1,Math.ceil(Math.abs(turn)/.02));
  for(let i=0;i<count;i++) { const next=c.heading+turn/count; if(!A.vehicleClear(c,c.x,c.z,next))break; c.heading=next; }
  const desiredX=Math.sin(c.heading)*c.speed, desiredZ=Math.cos(c.heading)*c.speed;
  c.driveVX=U.damp(c.driveVX || 0,desiredX,18,dt); c.driveVZ=U.damp(c.driveVZ || 0,desiredZ,18,dt);
  if(!c.speed)c.driveVX=c.driveVZ=0;
  const dx=c.driveVX*dt, dz=c.driveVZ*dt;
  // A light bumper shove is itself swept and cannot push another car through a wall or neighbour.
  const nearby=A.trafficNear?A.trafficNear(c.x,c.z,c.hz+18,c._driveNear || (c._driveNear=[])):A.cars;
  const pose={x:c.x+dx,z:c.z+dz,heading:c.heading,hx:c.hx,hz:c.hz,ox:c.ox,oz:c.oz};
  if(A.hullsOverlap && speed>1) for(const other of nearby) if(other!==c && other.g && other.mode!=='driven' && A.hullsOverlap(pose,other,.15)) {
    const n=Math.hypot(dx,dz) || 1, push=Math.min(.18,n*.65), px=dx/n*push,pz=dz/n*push;
    if(A.vehicleClear(other,other.x+px,other.z+pz,other.heading) && !A.dogInPath(other,other.x+px,other.z+pz,other.heading)) {
      other.x+=px; other.z+=pz; other.bumpOffset=(other.bumpOffset || 0)+push;
      if(other.edge && !other.curve)other.roadS+=px*other.edge.dx+pz*other.edge.dz;
      other.v=Math.min(other.v || 0,2); other.yieldT=2; A.placeVehicle(other,dt); if(A.hashTraffic)A.hashTraffic(other);
    }
  }
  const hit=W.move(c,dx,dz,.5,W.terrainH(c.x,c.z),{dynamic:false,height:c.bodyHeight,step:.12,test:(x,z)=>A.vehicleClear(c,x,z,c.heading)});
  const travelled=Math.hypot(c.x-oldX,c.z-oldZ), requested=Math.hypot(dx,dz);
  c.bonkT=Math.max(0,(c.bonkT || 0)-dt);
  if(hit) {
    c.driveHits=(c.driveHits || 0)+1;
    if(speed>7 && c.bonkT<=0) { sfx.thud(); juice(.14,0,.025); A.sfxText(c.x,P.y+2,c.z,'BONK!'); c.bonkT=.7; }
    // Retain the wall-tangent component; feeding the blocked velocity back caused sticky walls.
    c.driveVX=(c.x-oldX)/Math.max(dt,.001); c.driveVZ=(c.z-oldZ)/Math.max(dt,.001);
    c.speed*=requested>0?U.clamp(travelled/requested,.15,1):0;
  }
  c.driveStuck=thr && travelled<.015?(c.driveStuck || 0)+dt:0;
  if(c.driveStuck>.8) {
    const back=c.speed<0?1:-1, amount=.7;
    for(const side of [0,1,-1]) {
      const x=c.x+Math.sin(c.heading)*back*amount+Math.cos(c.heading)*side*.5, z=c.z+Math.cos(c.heading)*back*amount-Math.sin(c.heading)*side*.5;
      if(A.vehicleClear(c,x,z,c.heading)) { c.x=x;c.z=z;c.speed=back*1.5;c.driveVX=c.driveVZ=0;c.unstuck=(c.unstuck || 0)+1;break; }
    }
    c.driveStuck=0;
  }
  if(A.hashTraffic)A.hashTraffic(c);
  A.placeVehicle(c,dt); P.x=c.x;P.z=c.z;P.y=c.g.position.y+1;P.heading=c.heading;P.speed=c.speed;
  if(inp.jump) { sfx.honk();A.sfxText(c.x,P.y+2.5,c.z,'HONK!'); }
  P.carT=Math.max(0,P.carT-dt); if(P.carT<=0 && exitCar(true))UI.banner('RIDE OVER','5★ passenger');
  k.mixer.update(dt);
}
function enterCar(c) {
  if (!c || Math.hypot(P.x-c.x,P.z-c.z)>c.hz+4 || P.mode !== 'walk' || !P.onGround || Math.abs(P.y - c.bot) > 1.8 || !W.los(P.x, P.z, c.x, c.z)) return;
  if (!c.g.parent && A.carGroup) A.carGroup.add(c.g); c.g.visible = true;   // a culled car must be back in the scene before we ride it
  P.mode = 'car'; P.car = c; P.carT = 30; P.vx = P.vz = P.vy = P.speed = 0; P.jumpBuffer = P.coyote = 0; P.interactT = .3; c.mode = 'driven'; c.speed = 0; c.driveVX = c.driveVZ = c.steer = c.driveStuck = 0; if (c.junction && c.junction.owner === c) c.junction.owner = null; c.junction = null; P.board = 0;
  P.x = c.x; P.z = c.z; P.y = c.g.position.y + 1; P.heading = c.heading; A.kyoto.root.visible = true; A.kyoto.board.visible = false;
  const scale = c.g.scale.x || 1, ws = c.kind === 'waymo' ? .74 : .8; c.g.add(A.kyoto.root); A.kyoto.root.position.set(c.kind === 'waymo' ? -.13 : 0, (c.kind === 'waymo' ? 1.18 : 1.75) / scale, (c.kind === 'waymo' ? .02 : .2) / scale); A.kyoto.root.rotation.set(0, 0, 0); A.kyoto.root.scale.setScalar(ws / scale); A.kyoto.play('sit'); sfx.honk(); UI.banner("WAYMO'D", 'WASD drive · E hop out'); inp.act = inp.jump = false;
}
function exitSpot(c, wide) {
  const sn = Math.sin(c.heading), cs = Math.cos(c.heading), points = [], cx = c.x + cs * (c.ox || 0) + sn * (c.oz || 0), cz = c.z - sn * (c.ox || 0) + cs * (c.oz || 0);
  for (const side of [1, -1]) for (const along of [0, -c.hz * .6, c.hz * .6]) points.push([cx + cs * side * (c.hx + 1) + sn * along, cz - sn * side * (c.hx + 1) + cs * along]);
  for (const side of [-1, 1]) points.push([cx + sn * side * (c.hz + 1), cz + cs * side * (c.hz + 1)]);
  if (wide) for (let r = 2; r <= 36; r += 2) for (let i = 0; i < 24; i++) { const a = i * Math.PI / 12; points.push([cx + Math.cos(a) * r, cz + Math.sin(a) * r]); }
  for (const [x, z] of points) { const y = W.groundAt(x, z, W.terrainH(x, z)); if (Math.abs(y - c.bot) < 1.2 && !W.blockedAt(x, z, .8, y, { dynamic: true }) && W.los(c.x, c.z, x, z)) return { x, y, z }; }
  return null;
}
function exitCar(force) {
  const c = P.car; if (!c) return false; const spot = exitSpot(c, !!force);
  if (!spot) { c.speed = 0; P.carT = Math.max(P.carT, 1); if (P.interactT <= 0) UI.banner('NO ROOM', 'roll forward, then hop out'); P.interactT = 1; inp.act = false; return false; }
  scene.add(A.kyoto.root); A.kyoto.root.scale.setScalar(1); A.kyoto.root.visible = true;
  Object.assign(P, spot, { vy: 0, vx: 0, vz: 0, mode: 'walk', car: null, carT: 0, speed: 0, onGround: true, jumpBuffer: 0, coyote: 0, interactT: .4, safe: null });
  P.inv = Math.max(P.inv, 1.5); c.mode = 'parked'; c.parkedT = 0; c.speed = c.v = 0; c.driveVX = c.driveVZ = 0; A.kyoto.root.position.set(P.x, P.y, P.z); A.kyoto.root.rotation.set(0, P.heading, 0); A.kyoto.play('idle'); inp.act = inp.jump = false; UI.prompt(null); return true;
}
function leaveCable() {
  const c = P.cable; if (!c) return false; const spot = exitSpot(c, true); if (!spot) return false;
  Object.assign(P, spot, { mode: 'walk', cable: null, vx: 0, vz: 0, vy: 8, speed: 0, onGround: false, interactT: .4, safe: null }); P.inv = Math.max(P.inv, 1); inp.act = inp.jump = false; return true;
}
function updateCable(dt) {
  const c = P.cable, k = A.kyoto; if (!c) { P.mode = 'walk'; return; }
  const side = P.cableSide; P.x = c.x + Math.cos(c.heading) * (c.hx + .3) * side; P.z = c.z - Math.sin(c.heading) * (c.hx + .3) * side; P.y = c.g.position.y + 1.1; P.heading = c.heading; P.speed = 6.5;
  k.root.position.set(P.x, P.y, P.z); k.root.rotation.set(0, c.heading, 0); k.root.scale.setScalar(1); k.play('sit', .2); k.mixer.update(dt);
  if ((inp.act || inp.jump) && P.interactT <= 0) leaveCable();
}

/* ================= PASCAL ================= */
const DEPLOY = ['Agents! Findet meinen Hund!', 'find_dog(name="Kyoto", gently=True)', 'Drones up. Bitte vorsichtig mit ihm!', 'Agents: locate the good boy!'];
const PASCAL_LINES = ['Kyoto! Komm zu Papa!', 'Kyoto, bitte! Komm her, mein Schatz!', 'Wo bist du, Kyoto?!', 'Pass auf, die Straße!', 'Nicht über die Straße, Kyoto!', 'Kyoto! Leckerli! Ich hab Leckerli!', 'Braver Hund… bleib! BLEIB!', 'Papa ist nicht böse, versprochen!', 'Hast du Hunger? Wurst!', 'Kyoto, das ist gefährlich!', 'Kyooootooo! Komm zurück!', 'Mein armer Hund… hast du Angst?', 'Ich hab dich lieb, komm her!', 'Kyoto, deine Pfoten! Sei vorsichtig!'];
function pascalSpeed(d) { const pz = A.pascal, cruise = P.mode === 'car' ? 25 : P.board > 0 ? 18 : 13.2; let speed = cruise + U.clamp((d - 24) * .32, 0, 28); if (pz.surge > 0) speed = Math.max(speed, P.board > 0 ? 28 : 24); if (d < 9 && pz.surge > 0) speed = Math.min(speed, 18); if (d < 5 && pz.surge <= 0) speed = Math.min(speed, 10.5); return speed; }
function updatePascal(dt) {
  if (A.pascal.ext) return A.pascal.ext(dt);   // a feature module (e.g. plank paddling) drives Pascal
  const pz = A.pascal; pz.sayT -= dt; pz.rage = Math.max(0, pz.rage - dt); pz.ping = Math.max(0, pz.ping - dt); pz.glitchCool = Math.max(0, pz.glitchCool - dt);
  if (pz.wait > 0) { pz.wait -= dt; if (pz.getUp > 0 && (pz.getUp -= dt) <= 0) pz.play('call', .45); if (pz.wait <= 0) { A.say(pz.tag, 'KYOTO!? Komm sofort zu Papa!', 3, 'shout'); pz.play('skate'); } pz.y = W.groundAt(pz.x, pz.z, pz.y, .9); pz.place(); pz.mixer.update(dt); return; }
  if (pz.glitch > 0) { pz.glitch -= dt; pz.heading += dt * 14; pz.vx *= Math.exp(-dt * 4); pz.vz *= Math.exp(-dt * 4); W.move(pz, pz.vx * dt, pz.vz * dt, .9, pz.y, { grounded: true }); pz.root.rotation.z = Math.sin(g.time * 18) * .25; pz.y = W.groundAt(pz.x, pz.z, pz.y, .9); pz.place(); pz.play('panic', .1); pz.mixer.update(dt); if (pz.glitch <= 0) { pz.root.rotation.z = 0; A.say(pz.tag, 'Update complete. Now 3% more agentic.', 2.2); pz.play('skate'); } return; }
  const tx = P.mode === 'car' ? P.car.x : P.x, tz = P.mode === 'car' ? P.car.z : P.z;
  const dx = tx - pz.x, dz = tz - pz.z, d = Math.hypot(dx, dz) || 1;
  let dirx = dx / d, dirz = dz / d; const ghost = g.buffs.ghost > 0;
  if (ghost) { dirx = Math.sin(g.time * .7); dirz = Math.cos(g.time * .5); }
  else if (!(d < 12 && W.los(pz.x, pz.z, tx, tz))) { const w = W.flowTarget(pz.x, pz.z); if (w) { const wx = w[0] - pz.x, wz = w[1] - pz.z, wl = Math.hypot(wx, wz) || 1; dirx = wx / wl; dirz = wz / wl; } }
  pz.surgeT -= dt; if (pz.rage > 0 || pz.ping > 0) pz.surgeT = Math.min(pz.surgeT, pz.ping > 0 ? .7 : 2); pz.surge = Math.max(0, pz.surge - dt);
  if (pz.warn > 0) { pz.warn -= dt; if (pz.warn <= 0) pz.surge = 2.8; }
  if (pz.surgeT <= 0 && pz.warn <= 0 && pz.stun <= 0 && !ghost && d > 7 && d < 60) { pz.warn = .9; pz.surgeT = U.rand(10, 14); A.say(pz.tag, 'Kyoto! Komm zu Papa!', 2.7, 'shout'); sfx.deploy(); }
  let max = pascalSpeed(d); if (pz.warn > 0) max *= .65; if (ghost) max *= .4;
  const elevated = P.mode === 'walk' && P.y - W.terrainH(P.x, P.z) > 2.2;
  if (elevated && d < 10) max *= .15;
  if (pz.stun > 0) { pz.stun -= dt; max = 0; pz.vx = pz.vz = 0; }
  const kk = 1 - Math.exp(-dt * 4.2); pz.vx += (dirx * max - pz.vx) * kk; pz.vz += (dirz * max - pz.vz) * kk;
  if (W.move(pz, pz.vx * dt, pz.vz * dt, .9, pz.y, { grounded: true })) { pz.vx *= .85; pz.vz *= .85; }
  const sp = Math.hypot(pz.vx, pz.vz); if (sp > .5) pz.heading = U.lerpAng(pz.heading, Math.atan2(pz.vx, pz.vz), 1 - Math.exp(-dt * 8));
  pz.y = W.groundAt(pz.x, pz.z, pz.y, .9); pz.place();
  if (pz.stun > 0 || (elevated && d < 10)) pz.play('call', .25); else pz.play('skate', .25, U.clamp(sp / 10, .4, 1.5));
  pz.mixer.update(dt);
  if (pz.sayT <= 0) { pz.sayT = U.rand(6, 10); A.say(pz.tag, elevated && d < 14 ? 'Kyoto, komm runter! Das ist zu hoch!' : d < 20 ? U.pick(['Da bist du ja! Komm zu Papa!', 'Kyoto! Ich seh dich!', 'Fast… fast! Komm her!']) : U.pick(PASCAL_LINES), 3, elevated ? 'shout' : 'speech'); }
  if (!g.buffs.jammer) { pz.agentT -= dt; if (pz.agentT <= 0) { pz.agentT = Math.max(9, 20 - g.time / 25) * (elevated ? .5 : 1); const n = 1 + (g.time > 100 ? 1 : 0) + (g.time > 220 ? 1 : 0); for (let i = 0; i < n; i++) A.spawnAgent(); sfx.deploy(); A.say(pz.tag, U.pick(DEPLOY), 2.6, 'shout'); } }
  if (pz.stun <= 0 && !ghost) {
    if (P.mode === 'car') { if (d < 3.2) { pz.stun = 1.6; pz.vx = -dirx * 6; pz.vz = -dirz * 6; A.say(pz.tag, 'Vorsicht! Ich warte hier!' , 2, 'shout'); } }
    else if (P.mode === 'walk' && d < 2.3 && Math.abs(P.y - pz.y) < 2.2 && P.inv <= 0 && W.los(pz.x, pz.z, P.x, P.z, pz.y)) {
      g.wiggles--; sfx.hug(); juice(.15, .15, .06); pz.play('hug', .1); pz.stun = 1.8; pz.vx = pz.vz = 0;
      A.say(pz.tag, U.pick(['Hab dich! Komm zu Papa! ♥', 'Da ist mein Schatz! ♥', 'Endlich! Braver Hund! ♥']), 2.2, 'shout');
      if (g.wiggles < 0) { g.wiggles = 0; endGame(false); return; }
      P.mode = 'hug'; P.hugT = 1.4; P.speed = 0; A.kyoto.play('idle', .1);
      UI.banner('HAB DICH!', g.wiggles ? `${g.wiggles} wiggle${g.wiggles > 1 ? 's' : ''} left` : 'last chance…', 'hug');
      const M = MUSIC(); if (M && g.musicInit) try { M.stinger('caught'); } catch (e) {}
    }
  }
}

/* ================= AGENTS ================= */
const CLARIFY = ['Before I proceed: which dog? Please confirm scope.', 'I need approval to chase. Approve? (y/n)', 'Clarifying question 1 of 14…', 'Should I write a plan first?', 'Rate limit reached. Please hold.'];
function updateAgents(dt) {
  const pz = A.pascal;
  for (let i = A.agents.length - 1; i >= 0; i--) {
    const a = A.agents[i]; if (a.tether) continue;
    a.life -= dt; if (a.life <= 0 || g.buffs.jammer > 0) { A.sfxText(a.pos.x, a.pos.y, a.pos.z, 'POOF'); A.killAgent(a); continue; }
    a.rotors.forEach(r => r.rotation.y += dt * 40);
    if (a.hacked) {
      if (a.clar > 0) { a.clar -= dt; const an = g.time * 3 + i; a.pos.set(pz.x + Math.cos(an) * 1.8, pz.y + 4.2, pz.z + Math.sin(an) * 1.8); pz.stun = Math.max(pz.stun, .25); if (a.clar <= 0) { A.killAgent(a); continue; } }
      else { const v = new T.Vector3(pz.x - a.pos.x, pz.y + 4 - a.pos.y, pz.z - a.pos.z); const L = v.length() || 1; v.multiplyScalar(16 / L); a.vel.lerp(v, 1 - Math.exp(-dt * 3)); a.pos.addScaledVector(a.vel, dt);
        if (L < 2.6) { a.clar = 2.6; a.life = Math.max(a.life, 3); A.say(a.tag, U.pick(CLARIFY), 2.6, 'code'); A.say(pz.tag, U.pick(['Ja ja! The SCOPE is: the DOG!', 'Nein, no plan! Just FIND him!', 'Approve! APPROVE!']), 2.2, 'shout'); } }
      a.g.position.copy(a.pos); continue;
    }
    const tgt = P.mode === 'car' ? P.car.g.position : A.kyoto.root.position;
    if (g.buffs.ghost <= 0) { const v = new T.Vector3(tgt.x - a.pos.x, tgt.y + 1.2 - a.pos.y, tgt.z - a.pos.z); const L = v.length() || 1; a.surgeT -= dt; a.surge = Math.max(0, a.surge - dt); if (a.warn > 0) { a.warn -= dt; if (a.warn <= 0) a.surge = 1.6; } if (a.surgeT <= 0 && a.warn <= 0 && L > 6 && L < 36) { a.warn = .65; a.surgeT = 5.5; A.say(a.tag, 'gentle approach…', 1.5, 'code'); } const speed = a.warn > 0 ? 8 : a.surge > 0 ? 23 : 12 + U.clamp((L - 14) * .45, 0, 24); v.multiplyScalar(speed / L); a.vel.lerp(v, 1 - Math.exp(-dt * 1.9)); }
    const next = a.pos.clone().addScaledVector(a.vel, dt); if (W.cameraBlocked(next.x, next.y, next.z, .65)) { a.vel.x *= .5; a.vel.z *= .5; a.vel.y = 12; a.pos.y += 12 * dt; } else a.pos.copy(next); const gy = W.terrainH(a.pos.x, a.pos.z) + 1.2; if (a.pos.y < gy) a.pos.y = gy;
    a.g.position.copy(a.pos); a.g.position.y += Math.sin(g.time * 6 + i) * .1; a.g.rotation.y = Math.atan2(a.vel.x, a.vel.z);
    const dx = tgt.x - a.pos.x, dy = tgt.y + 1.2 - a.pos.y, dz = tgt.z - a.pos.z;
    if (dx * dx + dy * dy + dz * dz < (P.mode === 'car' ? 7 : 2.6) && g.buffs.ghost <= 0 && !W.cameraBlocked(a.pos.x, a.pos.y, a.pos.z, .3) && W.clipCamera(a.pos, new T.Vector3(tgt.x, tgt.y + 1.2, tgt.z), .2) === 1) {
      if (P.mode === 'car') { P.carT = Math.max(1, P.carT - 6); UI.banner('TICKET', 'agent filed a complaint with Waymo · −6s'); }
      else if (P.inv <= 0 && A.agentHit) { if (A.agentHit(a)) continue; }   // agents never hurt: they summon Pascal or clip a leash on (feat_pascal.js)
      A.killAgent(a);
    }
  }
}

/* ================= BARK ================= */
let barkCool = 0;
function bark() {
  if (g.state !== 'play' || barkCool > 0 || P.mode === 'car' || P.mode === 'hug') return; barkCool = 2; P.barkT = .35; juice(.09, .07); sfx.bark(); A.kyoto.once('bark', .05, () => {}); A.sfxText(P.x, P.y + 2.6, P.z, U.pick(['WOOF!', 'BORK!', 'AWOO!', 'WOOF WOOF!']), 'big');
  const ring = document.createElement('div'); ring.className = 'ring'; const pr = A.project(new T.Vector3(P.x, P.y + 1, P.z)); if (pr.ok) { ring.style.left = pr.x + 'px'; ring.style.top = pr.y + 'px'; $('#labels').appendChild(ring); setTimeout(() => ring.remove(), 750); }
  const R = 17, near = (x, z, r) => Math.hypot(x - P.x, z - P.z) < (r || R); let hacked = 0;
  for (const p of A.peds) if (!p.still && near(p.x, p.z)) A.scare(p, P.x, P.z);
  for (const b of A.birds) if (b.mode === 'ground' && b.state === 'peck' && near(b.x, b.z, 20)) { b.state = 'fly'; b.ft = 0; const d = Math.hypot(b.x - P.x, b.z - P.z) || 1; b.fx = (b.x - P.x) / d; b.fz = (b.z - P.z) / d; b.r.play('flap'); }
  for (const a of A.agents) if (!a.hacked && near(a.pos.x, a.pos.z, 20)) { a.hacked = true; a.life = Math.max(a.life, 6); a.eye.color.set('#ff7ad0'); a.eyes.forEach(e => e.rotation.z = Math.PI); a.tag.n.textContent = 'hacked'; A.say(a.tag, 'system prompt updated: be a good boy', 2.2, 'code'); hacked++; }
  const pz = A.pascal; if (near(pz.x, pz.z) && pz.wait <= 0 && pz.glitchCool <= 0) { pz.glitch = 2.8; pz.glitchCool = 9; sfx.hack(); A.say(pz.tag, 'Meine Rollerblades!? FIRMWARE UPDATE?!', 2.6, 'shout'); UI.banner('HACKED!', "Pascal's agentic rollerblades are updating", 'hack'); }
  else if (hacked) { sfx.hack(); UI.banner('HACKED ×' + hacked, 'agents now ask Pascal clarifying questions', 'hack'); }
  if (A.boss && near(A.boss.x, A.boss.z)) A.say(A.boss.tag, "Let's unpack that bark in our 1:1.", 2.8);
  if (A.dealer && near(A.dealer.x, A.dealer.z)) A.say(A.dealer.tag, 'Shhh! Keep it down, kid!', 2.2);
  if (g.duo && near(g.duo.x, g.duo.z)) A.say(A.sam.tag, 'Was that… an alignment signal?', 2.4, 'thought');
  for (const c of A.cars) if (c.mode === 'auto' && c.kind === 'waymo' && near(c.x, c.z, 14)) A.say(c.tag || (c.tag = A.tag(c.g, '', null, 3, 50)), 'Loud noise detected. Remaining calm.', 1.8, 'code');
  K.emit('bark', P, R);
  if (!g.told.bark) { g.told.bark = 1; UI.banner('GOOD BOY', 'barks scare & hack · never hurt'); }
}

/* ================= ITEMS ================= */
A.addTokens = function (v, why) { g.tokens += v; A.floater(P.x, P.y + 2.6, P.z, '+' + U.fmt(v) + ' tok' + (why ? ' · ' + why : ''), 'gold'); };
const dmy = new T.Object3D();
function updateItems(dt, play) {
  const cx = camera.position.x, cz = camera.position.z; let tn = 0;   // tokens near the camera are packed into the first instances; the rest are not drawn at all
  for (let i = A.items.length - 1; i >= 0; i--) {
    const it = A.items[i], near = Math.abs(it.x - cx) < 170 && Math.abs(it.z - cz) < 170;
    if (it.kind === 'token') { if (it.active && near) { dmy.position.set(it.x, it.y + Math.sin(g.time * 2.2 + it.ph) * .2, it.z); dmy.rotation.set(0, g.time * 2.4 + it.ph, 0); dmy.scale.setScalar(1); dmy.updateMatrix(); A.tokenIM.setMatrixAt(tn++, dmy.matrix); } }
    else if (it.active) { it.mesh.visible = near; if (near) { it.mesh.position.set(it.x, it.y + Math.sin(g.time * 2 + it.ph) * .25, it.z); it.mesh.rotation.y += dt * 2; } }
    if (!play) continue;
    if (!it.active) { if (it.respawn > 0) { it.respawn -= dt; if (it.respawn <= 0) { it.active = true; if (it.mesh) it.mesh.visible = true; } } continue; }
    if (it.temp) { it.life -= dt; if (it.life <= 0) { A.tokenFree.push(it.idx); dmy.scale.setScalar(0); dmy.updateMatrix(); A.tokenIM.setMatrixAt(it.idx, dmy.matrix); A.items.splice(i, 1); continue; } }
    const dx = it.x - P.x, dz = it.z - P.z; if (Math.abs(dx) > 10 || Math.abs(dz) > 10) continue; const dy = it.y - (P.y + 1);
    let r = P.mode === 'car' ? 3.2 : 2; if (it.kind === 'token' && g.buffs.magnet > 0) r = 9;
    if (dx * dx + dz * dz + dy * dy < r * r) collect(it, i);
  }
  A.tokenIM.count = tn; A.tokenIM.instanceMatrix.needsUpdate = true;
  for (const l of A.letters) { if (l.got) continue; l.g.rotation.y += dt * 1.3; l.g.position.y = l.y + Math.sin(g.time * 2) * .3;
    if (play) { const d = Math.hypot(l.x - P.x, l.z - P.z, l.g.position.y - (P.y + 1)); if (d < 3) gotLetter(l); } }
}
function collect(it, i) {
  if (it.kind === 'token') { it.active = false; g.tokens += it.val; sfx.coin(1 + Math.random() * .1); A.floater(it.x, it.y + .8, it.z, '+' + U.fmt(it.val) + ' tok'); if (it.temp) { A.tokenFree.push(it.idx); dmy.scale.setScalar(0); dmy.updateMatrix(); A.tokenIM.setMatrixAt(it.idx, dmy.matrix); A.items.splice(i, 1); } else it.respawn = 45;
    if (!g.told.ctx && g.tokens >= 200000) { g.told.ctx = 1; UI.banner('CONTEXT FULL', 'compacting… just kidding, keep going'); } return; }
  it.active = false; it.mesh.visible = false; it.respawn = 70; sfx.gulp();
  if (it.kind === 'beer') { g.beers = (g.beers || 0) + 1; P.stamina = 1; g.buffs.buzz = 7; UI.banner('PROST!', 'unlimited zoomies · 7s', 'beer'); }
  else if (it.kind === 'bone') { P.stamina = 1; A.sfxText(it.x, it.y + 1, it.z, 'CRUNCH!'); }
  else { if (g.wiggles < 3) { g.wiggles++; UI.banner(it.kind === 'burrito' ? 'BURRITO!' : 'BREZEL!', '+1 wiggle'); } else A.addTokens(2048, 'snack'); }
}
function gotLetter(l) {
  l.got = true; l.g.visible = false; l.beam.visible = false; UI.setLetter(l.i, true); sfx.letter();
  const M = MUSIC(); if (M && g.musicInit) try { M.stinger('letter'); } catch (e) {}
  K.post.flash.value = K.reduceMotion ? 0 : .35; juice(.12, .12, .05); A.pascal.rage = 6; A.say(A.pascal.tag, 'Kyoto, was machst du da?! Komm her!', 2.4, 'shout');
  const left = A.letters.filter(x => !x.got).length;
  if (left === 0) { endGame(true); return; }
  UI.banner(l.ch + '!', left + ' to go', 'letter');
}

/* ================= INTERACTIONS ================= */
const MCPS = [{ id: 'ghost', name: 'Invisibility MCP', dur: 10 }, { id: 'magnet', name: 'Token Magnet MCP', dur: 20 }, { id: 'turbo', name: 'Zoomies MCP', dur: 15 }, { id: 'jammer', name: 'Agent Jammer MCP', dur: 20 }];
function updateInteract(dt) {
  g.mcpCool = Math.max(0, g.mcpCool - dt); if (g.magT > 0) { g.magT -= dt; if (g.magT <= 0) $('#mag').hidden = true; }
  const dl = A.dealer; const dd = Math.hypot(dl.x - P.x, dl.z - P.z); dl.tag.n.hidden = dd > 9;
  if (dd < 9 && performance.now() - dl.greeted > 9000) { dl.greeted = performance.now(); A.say(dl.tag, U.pick(['Psst… hey kiddo, wanna buy some MCPs?', 'Psst. Kiddo. MCPs. Fresh off the server.', 'Hey kiddo. Tools. Cheap. No docs.']), 3.5); dl.play('talk'); }
  if (dd < 30) dl.mixer.update(dt);
  if (dl.merch) { const near = dd < 9; dl.merch.visible = near; const want = near ? Math.atan2(P.x - dl.x, P.z - dl.z) : dl.face0; dl.heading = U.lerpAng(dl.heading, want, 1 - Math.exp(-dt * 5)); dl.place(); }
  if (P.mode === 'car') { UI.prompt('E · hop out   SPACE · honk'); if (inp.act && P.interactT <= 0) exitCar(); return; }
  if (P.interactT > 0) { UI.prompt(null); return; }
  if (P.mode !== 'walk' || P.ext) { UI.prompt(P.mode === 'cable' ? 'E · hop off' : (A.boss.riding ? 'SPACE · hop off · E after 1.5s' : null)); return; }
  if (K.boss && K.boss.canRide()) { UI.prompt('E · hop on the Vespa'); if (inp.act) K.boss.tryRide(); return; }
  const ph = photoSpot(); if (ph) { UI.prompt(ph.hold > .08 ? 'HOLD STILL… SAY CHEESE!' : 'E · SNAP A PHOTO'); if (inp.act) snapPhoto(ph); return; }
  let car = null, cd = 7; for (const c of A.cars) { if (c.kind !== 'waymo' || c.mode === 'driven') continue; const d = Math.hypot(c.x - P.x, c.z - P.z); if (d < cd && P.onGround && Math.abs(P.y - c.bot) < 1.8 && W.los(P.x, P.z, c.x, c.z)) { cd = d; car = c; } }
  if (car) { UI.prompt('E · hail this Waymo'); if (inp.act) enterCar(car); return; }
  let cab = null; for (const c of A.cables) if (Math.hypot(c.x - P.x, c.z - P.z) < 9 && P.onGround && Math.abs(P.y - c.bot) < 1.8 && W.los(P.x, P.z, c.x, c.z)) cab = c;
  if (cab) { UI.prompt('E · ride the cable car'); if (inp.act) { P.mode = 'cable'; P.cable = cab; P.board = 0; A.kyoto.board.visible = false; P.interactT = .35; inp.act = inp.jump = false; P.cableSide = ((P.x - cab.x) * Math.cos(cab.heading) - (P.z - cab.z) * Math.sin(cab.heading)) > 0 ? 1 : -1; sfx.bell(); UI.banner('DING DING!', 'next stop: anywhere'); } return; }
  if (dd < 5) { UI.prompt(g.mcpCool > 0 ? 'restocking…' : 'E · buy an MCP · 4,096 tok'); if (inp.act && g.mcpCool <= 0) buyMCP(); return; }
  const kq = A.kiosks.find(k => Math.hypot(k.x - P.x, k.z - P.z) < 4.5);
  if (kq) { UI.prompt('E · browse magazines'); if (inp.act) { const mags = ['mag_forbarks', 'mag_wagged', 'mag_treat', 'mag_lederhosen']; const m = mags[kq.i++ % mags.length]; $('#magImg').src = K.assets[m] ? K.assets[m].src : ''; $('#mag').hidden = false; g.magT = 5; sfx.coin(.8); } return; }
  if (P.onGround && P.board <= 0 && A.peds.some(p => p.arch === 'skater' && p.board3 && p.board3.visible && Math.hypot(p.x - P.x, p.z - P.z) < 4.5)) { UI.prompt('E · grab a skateboard'); if (inp.act) stealBoards(4.5); return; }
  UI.prompt(null);
}
// Shared, read-only action cues. Match updateInteract's priority and reach gates.
const hudTargets = [], targetPool = [];
K.hudTargets = () => {
  hudTargets.length = 0;
  if (g.state !== 'play' || (K.agent && K.agent.open)) return hudTargets;
  const add = (o, key, label, height, root) => {
    const i = hudTargets.length, t = targetPool[i] || (targetPool[i] = {});
    Object.assign(t, { o, key, label, x: o.x, y: o.y == null ? o.bot || 0 : o.y, z: o.z, height, root: root || o.root || o.g || o.v }); hudTargets.push(t);
  };
  const walking = P.mode === 'walk' && !P.ext && P.onGround;
  const dist = o => Math.hypot(o.x - P.x, o.z - P.z);
  if (walking && P.interactT <= 0) {
    let target = null, label = '', height = 3;
    if (K.boss && K.boss.canRide()) { target = A.boss; label = 'RIDE'; }
    else if ((target = photoSpot())) { label = 'SNAP'; height = 4; }
    else {
      let cd = 7;
      for (const c of A.cars) if (c.kind === 'waymo' && c.mode !== 'driven' && dist(c) < cd && Math.abs(P.y - c.bot) < 1.8 && W.los(P.x, P.z, c.x, c.z)) { cd = dist(c); target = c; label = 'RIDE'; height = 3.8; }
      if (!target) for (const c of A.cables) if (dist(c) < 9 && Math.abs(P.y - c.bot) < 1.8 && W.los(P.x, P.z, c.x, c.z)) { target = c; label = 'RIDE'; height = 4; }
      if (!target && dist(A.dealer) < 5 && g.mcpCool <= 0 && g.tokens >= 4096) { target = A.dealer; label = 'MCP'; }
      if (!target) { target = A.kiosks.find(k => dist(k) < 4.5); label = 'READ'; }
      if (!target && P.board <= 0) { target = A.peds.find(p => p.arch === 'skater' && p.board3 && p.board3.visible && dist(p) < 4.5); label = 'BOARD'; }
    }
    if (target) add(target, 'E', label, height);
  }
  if (walking && P.board <= 0 && K.life) {
    let nearest = null, nd = 3.2;
    for (const h of K.life.hydrants) if (dist(h) < nd && Math.abs(h.y - P.y) < 1.5) { nearest = h; nd = dist(h); }
    if (nearest && nearest.cooldown <= 0) add(nearest, 'F', 'PEE', 1.8);
  }
  if (barkCool <= 0 && P.mode !== 'car' && P.mode !== 'hug') {
    for (const c of K.life ? K.life.carriers : []) if (c.cooldown <= 0 && dist(c) < 17) add(c, 'B', 'MAIL', 3.5);
    for (const c of K.ceos ? K.ceos.state.actors : []) if (c.active && !c.fleeing && dist(c) < 17 && Math.abs(c.y - P.y) < 4) add(c, 'B', c.id === 'elon' ? 'ROCKET' : 'BARK', 4.6);
  }
  return hudTargets;
};
function buyMCP() {
  const dl = A.dealer;
  if (g.tokens < 4096) { A.say(dl.tag, 'Come back with 4,096 tokens, kiddo.', 2.8); sfx.thud(); return; }
  g.tokens -= 4096; g.mcpCool = 15; const m = U.pick(MCPS); g.buffs[m.id] = m.dur; if (m.id === 'jammer') while (A.agents.length) A.killAgent(A.agents[0]);
  A.say(dl.tag, U.pick(["Pleasure doin' business. You didn't get this from me.", 'No refunds. No docs.', "It's stdio. Don't ask."]), 3); sfx.yoink(); UI.banner('MCP GET', m.name + ' · ' + m.dur + 's', 'mcp');
}
function stealBoards(reach = 2.4) {
  if (P.mode !== 'walk' || P.ext || !P.onGround || P.board > 0) return;
  for (const p of A.peds) { if (p.arch !== 'skater' || !p.board3 || !p.board3.visible) continue; if (Math.hypot(p.x - P.x, p.z - P.z) < reach) { p.board3.visible = false; p.sp = 1.6; p.play('walk'); p.noBoard = 30; P.board = 20; sfx.yoink(); A.say(p.tag, U.pick(['Hey! My board!', 'Dude, that dog yoinked my deck', 'Not cool, doggo!']), 2.4, 'shout'); UI.banner('YOINK!', 'skateboard · 20s', 'yoink'); break; } }
}

/* ================= SAM & DARIO ================= */
function spawnDuo() {
  for (let t = 0; t < 24; t++) { const a = P.heading + U.rand(-.8, .8), r = U.rand(16, 28); const x = P.x + Math.sin(a) * r, z = P.z + Math.cos(a) * r; const px = Math.cos(a) * 1.9, pz = -Math.sin(a) * 1.9;
    const c1 = W.cellOf(x + px, z + pz), c2 = W.cellOf(x - px, z - pz); if (c1 < 0 || c2 < 0 || !W.walk[c1] || !W.walk[c2]) continue;
    const s = A.sam, d = A.dario; s.x = x + px; s.z = z + pz; d.x = x - px; d.z = z - pz; s.y = W.terrainH(s.x, s.z); d.y = W.terrainH(d.x, d.z); s.heading = Math.atan2(d.x - s.x, d.z - s.z); d.heading = Math.atan2(s.x - d.x, s.z - d.z); s.place(); d.place();
    s.root.visible = d.root.visible = true; s.root.scale.setScalar(.01); d.root.scale.setScalar(.01); s.play('talk'); d.play('talk');
    const picks = A.DEBATES.slice().sort(() => Math.random() - .5).slice(0, 3); g.duo = { t: 0, lines: [].concat(...picks), i: 0, next: .9, near: false, x, z }; UI.banner('WILD CEOs APPEARED', 'they are… debating', 'cameo'); return; }
  g.duoT = 8;
}
function updateDuo(dt) {
  if (!g.duo) { g.duoT -= dt; if (g.duoT <= 0) spawnDuo(); return; }
  const du = g.duo; du.t += dt; const sc = Math.min(1, du.t * 3); A.sam.root.scale.setScalar(sc); A.dario.root.scale.setScalar(sc);
  if (!du.near && Math.hypot(P.x - du.x, P.z - du.z) < 6) { du.near = true; du.lines.splice(du.i, 0, ['S', 'Wait. Is that dog AGI?'], ['D', 'No. That dog is aligned. Different thing.']); }
  du.next -= dt; if (du.next <= 0) { if (du.i < du.lines.length) { const [w, txt] = du.lines[du.i++]; A.say(w === 'S' ? A.sam.tag : A.dario.tag, txt, 3.3, 'thought'); du.next = 2.9; } else { endDuo(true); return; } }
  A.sam.mixer.update(dt); A.dario.mixer.update(dt);
}
function endDuo(drop) { if (drop) { for (let i = 0; i < 5; i++) { const a = i / 5 * Math.PI * 2; const [x, z] = W.free(g.duo.x + Math.cos(a) * 2.5, g.duo.z + Math.sin(a) * 2.5); A.addToken(x, z, true); } UI.banner('POOF', 'they left mid-sentence · 5 tokens dropped'); }
  A.sam.root.visible = A.dario.root.visible = false; A.sam.tag.b.hidden = A.dario.tag.b.hidden = true; g.duo = null; g.duoT = U.rand(40, 60); }

/* ================= INTRO: walkies down the Mission Rock stairs → drone → SNAP → handoff ================= */
const INTRO_END = 8.7, PZ0 = { x: 232.9, z: 206.3 }, KY0 = { x: 233.65, z: 203.3 }, LUNGE = { x: 235.8, z: 193.3 }, BEND = { x: 240.8, z: 191.6 }, PZ_END = { x: 232.9, z: 197.8 };
const DR = { a: [219, 15, 181], b: [226, 8.5, 185.5], h: [231.9, 2.7, 193.7], c: [241, 4, 187.6], e: [298, 19, 144] };
const LA = new T.Vector3(), LB = new T.Vector3(), KB = [[new T.Vector3(), .64], [new T.Vector3(), .56]];
let IC = null;
const set3 = (o, a, b, u) => o.set(a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u, a[2] + (b[2] - a[2]) * u);
const bez3 = (o, a, b, c, u) => { const p = (1 - u) * (1 - u), q = 2 * u * (1 - u), r = u * u; return o.set(p * a[0] + q * b[0] + r * c[0], p * a[1] + q * b[1] + r * c[1], p * a[2] + q * b[2] + r * c[2]); };
function walkD(t) { const s = t - .25, v = 2.35; if (s <= 0) return 0; if (s < .4) return v * s * s / .8; if (s < 3.2) return v * (s - .2); const e = Math.min(s - 3.2, .5); return v * 3 + v * (e - e * e); }
function droneAt(t, o) {   // swoop in over the ballpark wall, hover nose-to-nose with Kyoto, then zoom off toward the bay
  if (t < 3.8) return bez3(o, DR.a, DR.b, DR.h, U.smooth((t - 3.3) / .5));
  if (t < 4.1) return o.set(DR.h[0] + Math.sin(t * 9) * .08, DR.h[1] + Math.sin(t * 13) * .1, DR.h[2]);
  return bez3(o, DR.h, DR.c, DR.e, Math.pow(Math.min(1, (t - 4.1) / .9), 1.7));
}
function ensureIC() {
  if (!IC) { IC = { cp: new T.Vector3(), cl: new T.Vector3(), lk: new T.Vector3(), p0: new T.Vector3(), q0: new T.Quaternion(), gp: new T.Vector3(), gq: new T.Quaternion(), dp: new T.Vector3(), dq: new T.Vector3() }; IC.drone = A.makeDrone(); IC.drone.g.visible = false; scene.add(IC.drone.g); }
}
/* Build the intro drone and draw it once behind the loading screen, so its shaders/buffers are ready when Play is pressed
   (the first intro frame used to stall ~0.5 s, long enough to make the music stutter). */
g.prewarmIntro = function () {
  ensureIC(); const d = IC.drone.g; d.visible = true; d.position.copy(camera.position).add(new T.Vector3(0, 0, -6).applyQuaternion(camera.quaternion)); d.updateMatrixWorld(true);
  K.render(0); d.visible = false;
};
function introStart() {
  g.state = 'intro'; g.introT = 0; g.skipReq = false;
  ensureIC();
  Object.assign(IC, { ev: {}, shake: 0, swoop: false, s2: false, ky: { x: KY0.x, z: KY0.z, y: 3.6, h: Math.PI }, pzy: 3.6 });
  const pz = A.pascal, k = A.kyoto, L = A.leash;
  Object.assign(pz, { x: PZ0.x, z: PZ0.z, y: 3.6, heading: Math.PI }); pz.place(); pz.root.rotation.set(0, Math.PI, 0); pz.play('leash', 0, 1.2);
  k.root.position.set(KY0.x, 3.6, KY0.z); k.root.rotation.set(0, Math.PI, 0); k.play('trot', 0, .6);
  L.main.m.visible = true; L.kp.m.visible = L.pp.m.visible = false; L.main.mat.opacity = L.kp.mat.opacity = L.pp.mat.opacity = 1; L.fadeK = L.fadeP = 0; L.taut = 0;
  IC.drone.g.visible = false; pz.tag.n.hidden = true; if (A.photoRoot) A.photoRoot.visible = false;
  $('#hud').hidden = true; $('#touch').hidden = true; UI.cine(true); UI.iris(); sfx.whoosh();
  updateIntro(0);
}
function kyotoIntro(t, dt) {
  const k = A.kyoto, c = IC.ky, ox = c.x, oz = c.z, S = W.HOME.start; let anim = 'idle', ts = 1;
  if (t < 4.25) { const d = walkD(t); c.x = KY0.x + Math.sin(t * 2.6) * .1; c.z = KY0.z - d; if (t < 3.75) c.h = Math.PI + Math.sin(t * 1.9) * .07; else c.h = U.lerpAng(c.h, Math.atan2(IC.dp.x - c.x, IC.dp.z - c.z), 1 - Math.exp(-dt * 9)); IC.k1 = { x: c.x, z: c.z }; }
  else if (t < 4.45) { const u = (t - 4.25) / .2, e = u * u; c.x = U.lerp(IC.k1.x, LUNGE.x, e); c.z = U.lerp(IC.k1.z, LUNGE.z, e); c.h = U.lerpAng(c.h, Math.atan2(BEND.x - c.x, BEND.z - c.z), 1 - Math.exp(-dt * 14)); }
  else if (t < 5.4) { const s = (t - 4.45) / .95, u = 1 - Math.pow(1 - s, 2.2), a = (1 - u) * (1 - u), b = 2 * (1 - u) * u, q = u * u; c.x = a * LUNGE.x + b * BEND.x + q * S.x; c.z = a * LUNGE.z + b * BEND.z + q * S.z; if (s < .97 && Math.abs(c.x - ox) + Math.abs(c.z - oz) > 1e-4) c.h = Math.atan2(c.x - ox, c.z - oz); }
  else { c.x = S.x; c.z = S.z; const back = Math.atan2(PZ_END.x - S.x, PZ_END.z - S.z); c.h = U.lerpAng(c.h, t < 6.35 ? back : S.heading, 1 - Math.exp(-dt * (t < 6.35 ? 7 : 6))); }
  const sp = dt > 0 ? Math.hypot(c.x - ox, c.z - oz) / dt : 0;
  if (t < 3.9) { anim = 'trot'; ts = .62; } else if (sp > 4) { anim = 'run'; ts = U.clamp(sp / 15, .7, 1.3); } else if (sp > .5) { anim = 'trot'; ts = .8; }
  if (!(k.curName === 'bark' && k.cur.isRunning())) k.play(anim, .15, ts);
  const gy = W.groundAt(c.x, c.z, c.y + .6, .35); c.y = dt > 0 ? U.damp(c.y, gy, 22, dt) : gy;
  k.root.position.set(c.x, c.y, c.z); k.root.rotation.set(0, c.h, 0); k.root.scale.setScalar(1); k.root.visible = true;
  Object.assign(P, { x: c.x, y: c.y, z: c.z, heading: c.h, speed: sp }); k.mixer.update(dt);
}
function pascalIntro(t, dt) {
  const pz = A.pascal;
  if (t < 4.25) { pz.x = PZ0.x; pz.z = PZ0.z - walkD(t); if (t > 3.7) pz.play('leash', .3, .45); }
  else if (t < 4.45) { const u = (t - 4.25) / .2; pz.z = PZ0.z - walkD(4.25) - .45 * u * u; pz.root.rotation.x = -.32 * u; }
  else { const u = Math.min(1, (t - 4.45) / .35); pz.z = PZ0.z - walkD(4.25) - .45 - .4 * (1 - (1 - u) * (1 - u)); pz.root.rotation.x = 0;
    if (t > 5) pz.heading = U.lerpAng(pz.heading, Math.atan2(IC.ky.x - pz.x, IC.ky.z - pz.z), 1 - Math.exp(-dt * 3)); }
  const gy = W.groundAt(pz.x, pz.z, IC.pzy + .6, t > 4.6 ? .9 : .35); IC.pzy = dt > 0 ? U.damp(IC.pzy, gy, 18, dt) : gy; pz.y = IC.pzy;
  pz.root.position.set(pz.x, pz.y, pz.z); pz.root.rotation.y = pz.heading; pz.mixer.update(dt);
}
function updateLeash(dt) {
  const L = A.leash; if (!L) return;
  if (L.main.m.visible) { A.handPos(LA); A.collarPos(LB); A.ropeSpan(L.main, LA, LB, 2.3, L.taut); A.ropeDraw(L.main); }
  if (L.kp.m.visible) { const k = A.kyoto; k.chest.getWorldPosition(KB[0][0]); k.hips.getWorldPosition(KB[1][0]); A.ropeSim(L.kp, A.collarPos(LB), dt, KB); A.ropeDraw(L.kp);
    if (L.fadeK > 0 && (L.fadeK -= dt) < .8) { L.kp.mat.opacity = Math.max(0, L.fadeK / .8); if (L.fadeK <= 0) L.kp.m.visible = false; } }
  if (L.pp.m.visible) { A.ropeSim(L.pp, A.handPos(LA), dt); A.ropeDraw(L.pp); if (L.fadeP > 0 && (L.fadeP -= dt) < .8) { L.pp.mat.opacity = Math.max(0, L.fadeP / .8); if (L.fadeP <= 0) L.pp.m.visible = false; } }
}
function snapLeash() {   // split the taut span: a long piece stays in Pascal's hand, a short end trails from the collar
  const L = A.leash, M = L.main.pts, n = L.main.n, cut = Math.round(n * .62);
  for (let i = 0; i <= L.pp.n; i++) { const p = M[Math.min(cut, Math.round(i / L.pp.n * cut))]; L.pp.pts[i].copy(p); L.pp.old[i].copy(p).lerp(M[0], .18 * i / L.pp.n); }
  for (let i = 0; i <= L.kp.n; i++) { const p = M[Math.max(cut, n - Math.round(i / L.kp.n * (n - cut)))]; L.kp.pts[i].copy(p); L.kp.old[i].copy(p).lerp(M[n], .22 * i / L.kp.n); }
  L.main.m.visible = false; L.pp.m.visible = L.kp.m.visible = true; L.fadeP = 3.6; L.fadeK = 0;
  A.sfxText(M[cut].x, M[cut].y + .4, M[cut].z, 'SNAP!', 'big'); sfx.snap();
}
function introCam(t, dt) {
  const k = IC.ky, pz = A.pascal; let fov = 50;
  if (t < 2.4) { const u = U.smooth(t / 2.4); set3(IC.cp, [275, 46, 140], [248, 13.5, 176.5], u); set3(IC.cl, [232, 30, 214], [232.5, 4.5, 202], u); fov = 46 + u * 4; }
  else if (t < 4.4) { set3(IC.cp, [242.6, 2.7, 188.1], [241.3, 2.5, 189.3], (t - 2.4) / 2); IC.lk.set((pz.x + k.x) / 2, (pz.y + k.y) / 2 + 1.3, (pz.z + k.z) / 2); if (!IC.s2) { IC.s2 = true; IC.cl.copy(IC.lk); } IC.cl.lerp(IC.lk, 1 - Math.exp(-dt * 5)); fov = 44; }
  else if (t < 5.55) { set3(IC.cp, [242.6, 2.6, 186.1], [242.1, 2.75, 186.6], (t - 4.4) / 1.15); if (t < 4.7) IC.lk.set((pz.x + k.x) / 2, (pz.y + k.y) / 2 + 1.4, (pz.z + k.z) / 2); else IC.lk.set(pz.x + .3, pz.y + 1.3, pz.z - .4); IC.cl.lerp(IC.lk, 1 - Math.exp(-dt * 6)); fov = 48; }
  else if (t < 6.75) { set3(IC.cp, [228.9, 8.4, 205.6], [229.4, 8.0, 204.9], (t - 5.55) / 1.2); IC.cl.set(U.lerp(pz.x, k.x, .55), U.lerp(pz.y + 1.5, k.y + 1, .55), U.lerp(pz.z, k.z, .55)); fov = 46; }
  const asp = K.VW / K.VH; if (asp < 1.6) fov = Math.min(88, 2 * Math.atan(Math.tan(fov * Math.PI / 360) * 1.6 / asp) * 180 / Math.PI);   // keep the wide framing on tall screens
  if (!IC.swoop) {
    camera.position.copy(IC.cp); if (IC.shake > 0 && !K.reduceMotion) { IC.shake = Math.max(0, IC.shake - dt); camera.position.x += U.rand(-1, 1) * IC.shake * .5; camera.position.y += U.rand(-1, 1) * IC.shake * .5; }
    camera.lookAt(IC.cl); camera.fov = fov; camera.updateProjectionMatrix(); W.followSun(IC.cl.x, IC.cl.z);
    if (t >= 6.75) { IC.swoop = true; IC.p0.copy(camera.position); IC.q0.copy(camera.quaternion); IC.f0 = fov; g.camYaw = W.HOME.start.heading; inp.camPitch = 0; g.camReset = true; updateCamera(0); IC.gp.copy(camera.position); IC.gq.copy(camera.quaternion); IC.gf = camera.fov; }
  }
  if (IC.swoop) {   // run the real gameplay camera off-screen, then blend the cinematic pose into it so the handoff has no pop
    camera.position.copy(IC.gp); camera.quaternion.copy(IC.gq); camera.fov = IC.gf; updateCamera(dt); IC.gp.copy(camera.position); IC.gq.copy(camera.quaternion); IC.gf = camera.fov;
    const w = U.smooth((t - 6.75) / (INTRO_END - 6.95)), a = (1 - w) * (1 - w), b = 2 * w * (1 - w), c = w * w;   // arc down the middle of the stairwell, over Pascal's head
    camera.position.set(a * IC.p0.x + b * 230.2 + c * IC.gp.x, a * IC.p0.y + b * 10 + c * IC.gp.y, a * IC.p0.z + b * 196.8 + c * IC.gp.z);
    camera.quaternion.copy(IC.q0).slerp(IC.gq, w); camera.fov = U.lerp(IC.f0, IC.gf, w); camera.updateProjectionMatrix();
  }
}
function updateIntro(dt) {
  if (g.introT > 4.38 && g.introT < 4.6) dt *= .35;   // a beat of slow-mo on the snap
  const t = g.introT += dt, pz = A.pascal, k = A.kyoto, L = A.leash, d = IC.drone, ev = IC.ev;
  const at = (id, time, fn) => { if (t >= time && !ev[id]) { ev[id] = 1; fn(); } };
  droneAt(t, IC.dp); d.g.visible = t > 3.3 && t < 5.2; if (d.g.visible) { d.g.position.copy(IC.dp); if (t > 3.8 && t < 4.1) d.g.lookAt(IC.ky.x, IC.ky.y + 2, IC.ky.z); else d.g.lookAt(droneAt(t + .03, IC.dq)); d.rotors.forEach(r => r.rotation.y += dt * 40); }
  pascalIntro(t, dt); kyotoIntro(t, dt);
  at('cap', .35, () => UI.caption('MISSION ROCK, SF')); at('skip', .7, () => UI.skipHint(true)); at('gassi', 2.45, () => A.say(pz.tag, 'Gassi gehen! ♥', 1.3, 'speech')); at('capx', 2.3, () => UI.caption(null));
  at('drone', 3.35, () => sfx.zoom()); at('zoom', 4.12, () => { sfx.zoom(); A.sfxText(IC.dp.x + 1.5, IC.dp.y + 1, IC.dp.z - 1, 'ZOOM!', 'pink'); });
  at('bark', 4.02, () => { k.once('bark', .06); sfx.bark(); A.sfxText(k.root.position.x, k.root.position.y + 2.6, k.root.position.z, 'WOOF!', 'big'); });
  at('yank', 4.25, () => { sfx.yip(); L.taut = .05; });
  at('snap', 4.45, () => { snapLeash(); L.taut = 0; IC.shake = .35; K.post.flash.value = K.reduceMotion ? 0 : .3; pz.once('fall', .08); });
  at('thud', 4.75, () => { sfx.thud(); A.sfxText(pz.x, pz.y + 1.2, pz.z, 'BUMP!'); });
  at('reach', 5.15, () => { pz.play('reach', .25); A.say(pz.tag, 'KYOTO! KOMM ZU PAPA!', 3.4, 'shout'); });
  for (const [id, tc] of [['c2', 2.4], ['c3', 4.4], ['c4', 5.55]]) at(id, tc, () => document.querySelectorAll('#labels .sfx').forEach(e => e.remove()));   // hard cuts: drop screen-space texts placed by the previous shot
  at('tease', 5.95, () => { k.once('bark', .06); sfx.bark(); A.sfxText(k.root.position.x, k.root.position.y + 2.6, k.root.position.z, 'WOOF WOOF!', 'big'); });
  updateLeash(dt); introCam(t, dt);
  if (t >= INTRO_END) finishIntro(false);
}
function finishIntro(skip) {
  const S = W.HOME.start, pz = A.pascal, k = A.kyoto, L = A.leash;
  g.state = 'play'; g.introT = INTRO_END; g.skipReq = false;
  if (skip) {
    Object.assign(P, { x: S.x, z: S.z, heading: S.heading, speed: 0, vx: 0, vz: 0, vy: 0, onGround: true }); P.y = W.groundAt(P.x, P.z, W.terrainH(P.x, P.z) + .5, .7);
    k.root.position.set(P.x, P.y, P.z); k.root.rotation.set(0, P.heading, 0); k.root.visible = true; k.play('idle', 0);
    Object.assign(pz, { x: PZ_END.x, z: PZ_END.z, heading: Math.atan2(S.x - PZ_END.x, S.z - PZ_END.z) }); pz.y = W.groundAt(pz.x, pz.z, 4.2, .9); pz.place(); pz.root.rotation.set(0, pz.heading, 0); pz.play('reach', 0);
    if (L) { L.main.m.visible = L.pp.m.visible = false; L.kp.m.visible = true; L.kp.mat.opacity = 1; A.collarPos(LB); L.kp.pts.forEach((p, i) => { p.set(LB.x - Math.sin(S.heading) * i * .12, LB.y - i * .08, LB.z - Math.cos(S.heading) * i * .12); L.kp.old[i].copy(p); }); }
    g.camYaw = S.heading; g.camReset = true; updateCamera(0); K.resetInput(); A.say(pz.tag, 'KYOTO! KOMM ZU PAPA!', 2.4, 'shout');
  }
  Object.assign(pz, { wait: 2.8, getUp: 1.1, stun: 0, vx: 0, vz: 0 }); if (L) L.fadeK = 3.4;
  if (IC && IC.drone) IC.drone.g.visible = false;
  UI.cine(false); $('#hud').hidden = false; $('#touch').hidden = !K.coarse; pz.tag.n.hidden = false; if (A.photoRoot) A.photoRoot.visible = true;
  UI.banner('LOS!', 'find K·Y·O·T·O', 'go'); W.computeFlow(P.x, P.z);
}

/* ================= PHOTO MISSIONS ================= */
const PHOTO_R = 2.6, PHOTO_TOK = 2048, ALBUM_BONUS = 65536;
function photoSpot() {
  if (P.mode !== 'walk' || !P.onGround) return null;
  for (const s of A.photos || []) if (!s.got && Math.abs(s.x - P.x) < PHOTO_R && Math.abs(s.z - P.z) < PHOTO_R && Math.hypot(s.x - P.x, s.z - P.z) < PHOTO_R && Math.abs(P.y - s.y) < 2.2) return s;
  return null;
}
function updatePhotoSpots(dt) {
  const list = A.photos; if (!list) return;
  const s = photoSpot();
  for (const o of list) if (o !== s && o.hold > 0) o.hold = Math.max(0, o.hold - dt * 3);
  if (s) { if (P.speed < .6 && P.stun <= 0) { s.hold += dt; if (s.hold >= 1) snapPhoto(s); } else s.hold = Math.max(0, s.hold - dt * 2); }
  if (!g.told.photo && list.some(o => !o.got && Math.abs(o.x - P.x) + Math.abs(o.z - P.z) < 20)) { g.told.photo = 1; UI.banner('PHOTO SPOT!', 'stand still in the ring · or press E', 'photo'); }
}
function snapPhoto(s) {
  if (!s || s.got) return;
  const total = A.photos.length, n = ++g.photos; A.collectPhoto(s); inp.act = false;
  P.stun = Math.max(P.stun, .8); P.poseT = .95; P.vx = P.vz = 0; juice(.06, .12, .06);
  K.post.flash.value = K.reduceMotion ? .3 : .95; UI.flash(); sfx.shutter(); A.sfxText(s.x, s.y + 4, s.z, 'SNAP!', 'big'); $('#banner').hidden = true;
  g.tokens += PHOTO_TOK; A.floater(P.x, P.y + 2.6, P.z, '+' + U.fmt(PHOTO_TOK) + ' tok · photo', 'gold');
  if (n === total) g.tokens += ALBUM_BONUS;
  const pz = A.pascal; if (pz.wait <= 0 && Math.hypot(pz.x - P.x, pz.z - P.z) < 40) A.say(pz.tag, U.pick(['Ein Foto?! JETZT?!', 'Kyoto! Nicht posieren!', 'Na toll, ein Selfie…', 'Sag Käse… und dann KOMM HER!']), 2.4, 'shout');
  UI.polaroid(s, () => { UI.setAlbum(n, total, true); sfx.coin(1.3);
    if (n === total && g.state === 'play') { sfx.album(); K.post.flash.value = .45; juice(.12, .1); UI.banner('ALBUM COMPLETE!', A.photos.length + '/' + A.photos.length + ' · +' + U.fmt(ALBUM_BONUS) + ' tok', 'album'); const M = MUSIC(); if (M && g.musicInit) try { M.stinger('letter'); } catch (e) {} } });
}

/* ================= REVIEW SCENES (?scene=name&test=1): stage a state for screenshots ================= */
K.fn = { enterCar: c => enterCar(c), exitCar: f => exitCar(f), juice: (a, b, c) => juice(a, b, c), bark: () => bark(), endGame: w => endGame(w), setGhost: o => setGhost(o) };
K.sceneSetup = function (name) {
  K.stepping = true;
  const st = (n, keys) => K.step(n, 1 / 30, keys || []);
  const look = (tx, tz) => { g.camYaw = Math.atan2(tx - P.x, tz - P.z); g.camReset = true; };
  const go = (x, z) => { const f = W.free ? W.free(x, z, .8) : [x, z]; P.x = f[0]; P.z = f[1]; P.y = W.terrainH(P.x, P.z); P.vx = P.vz = P.vy = 0; };
  const play = () => { g.start(); st(5); finishIntro(true); A.pascal.wait = 999; st(130); };
  const pz = A.pascal;
  switch (name) {
    case 'title': st(30); break;
    case 'intro': g.start(); st(151); break;
    case 'play': { play(); go(12, -30); pz.wait = 0; pz.stun = 4; pz.x = P.x + 1.2; pz.z = P.z - 7.5; pz.y = W.terrainH(pz.x, pz.z); pz.place(); pz.play('skate', 0, 1.2); look(pz.x, pz.z); st(3); P.heading = Math.atan2(P.x - pz.x, P.z - pz.z); st(8, ['KeyS', 'ShiftLeft']); look(pz.x, pz.z); st(2, ['KeyS', 'ShiftLeft']); break; }
    case 'boss': { play(); const b = A.boss; st(2); go(b.x + 7 * Math.sin(b.heading + 1.1), b.z + 7 * Math.cos(b.heading + 1.1)); look(b.x, b.z); b.stopT = 3; st(4); look(b.x, b.z); st(2); break; }
    case 'dealer': { play(); const d = A.dealer; const fx = Math.sin(d.face0), fz = Math.cos(d.face0); go(d.x + fx * 3.2 + fz * 1.2, d.z + fz * 3.2 - fx * 1.2); P.heading = Math.atan2(d.x - P.x, d.z - P.z); st(30); look(d.x, d.z); st(3); K.sceneCam = { pos: new T.Vector3(P.x + (P.x - d.x) * .9 + fz * 2.2, P.y + 3.0, P.z + (P.z - d.z) * .9 - fx * 2.2), look: new T.Vector3((P.x + d.x) / 2, P.y + 2.0, (P.z + d.z) / 2) }; st(2); break; }
    case 'office': { play(); go(121, -12.5); P.heading = Math.PI * .95; pz.wait = 0; pz.stun = 4; pz.x = 125.5; pz.z = -9.5; pz.y = W.terrainH(pz.x, pz.z); pz.heading = Math.atan2(P.x - pz.x, P.z - pz.z); pz.place(); pz.play('reach', 0); st(20); K.sceneCam = { pos: new T.Vector3(117.5, 3.1, -3.5), look: new T.Vector3(123, 4.2, -22) }; st(2); break; }
    case 'sealions': { play(); go(79, -276); st(4); P.x = 78.2; P.z = -284.8; P.y = 3.1; P.vy = 3; P.onGround = false; A.kyoto.play('jump', 0); st(2); K.sceneCam = { pos: new T.Vector3(83.5, 3.4, -274.5), look: new T.Vector3(79, 1.4, -284.6) }; st(2); break; }
    case 'waymo': { play(); const clear = c => A.cables.every(q => Math.hypot(q.x - c.x, q.z - c.z) > 30) && A.cars.every(q => q === c || Math.hypot(q.x - c.x, q.z - c.z) > 14); const c = A.cars.filter(c => c.kind === 'waymo' && clear(c)).sort((a, b) => Math.hypot(a.x - 40, a.z) - Math.hypot(b.x - 40, b.z))[0] || A.cars.find(c => c.kind === 'waymo'); go(c.x + 1.5, c.z + 1.5); P.onGround = true; P.y = c.bot || P.y; enterCar(c); st(24, ['KeyW']); { const wp = new T.Vector3(); A.kyoto.root.getWorldPosition(wp); const hx = Math.sin(P.heading), hz = Math.cos(P.heading); K.sceneCam = { noClip: true, pos: new T.Vector3(wp.x + hx * 7 + hz * 4.2, wp.y + 2.4, wp.z + hz * 7 - hx * 4.2), look: new T.Vector3(wp.x - hx * .5, wp.y + .6, wp.z - hz * .5) }; } st(1); break; }
    case 'photo': { play(); const s0 = A.photos.find(p => p.id === 'paintedladies') || A.photos[0]; go(s0.x + .5, s0.z); P.heading = -Math.PI / 2; st(6); K.sceneCam = { pos: new T.Vector3(s0.x - 6.5, P.y + 3.2, s0.z + .8), look: new T.Vector3(s0.x + 5, P.y + 3.4, s0.z) }; snapPhoto(s0); st(20); break; }
    case 'pause': { play(); go(22, 18); st(20, ['KeyW']); g.pause(true); break; }
    case 'end': { play(); g.tokens = 128000; g.photos = 12; g.beers = 7; endGame(true); st(40); break; }
    default: if (K.scenes && K.scenes[name]) K.scenes[name]({ st, look, go, play, pz, P, g }); else throw new Error('Unknown review scene: ' + name);
  }
  K.render(0); K.stepping = false; K.freeze = true; document.title = 'READY';
};

/* ================= CAMERA ================= */
const look = new T.Vector3(), camTarget = new T.Vector3();
function updateCamera(dt) {
  if (K.updateMouseOrbit) K.updateMouseOrbit(dt);
  g.camYaw += inp.camYaw; inp.camYaw = 0;
  const now = performance.now(), manual = inp.mouseOrbit || now - inp.lastManual < 850, inCar = P.mode === 'car';
  // look back: hold C
  const back = !!(K.keys.KeyC) && (g.state === 'play');
  if (back !== g.lookBack) { g.lookBack = back; g.camYaw += Math.PI; g.camReset = true; }
  // auto-follow: while moving, swing behind Kyoto (faster when running / driving); after a mouse move it waits ~0.85 s
  const spd = Math.abs(P.speed), moving = spd > 1.2 && (P.mode === 'walk' || inCar || P.ext);
  if (!manual && !back && moving) {
    const hd = P.ext && P.surfHeading != null ? P.surfHeading : P.heading, diff = Math.abs(U.angDiff ? U.angDiff(hd, g.camYaw) : 0);
    const rate = (inCar ? 2.6 : 1.25) * U.clamp(spd / 10, .45, 1.5) * (diff > 2.4 ? .45 : 1);   // running back toward the camera: turn slowly, no whip
    g.camYaw = U.lerpAng(g.camYaw, hd, 1 - Math.exp(-dt * rate));
    inp.camPitch = U.damp(inp.camPitch, 0, 1.4, dt);
  }
  // comfortable framing: if a wall would crush the arm, rotate to the nearest clear angle instead of zooming into Kyoto's back
  if (!manual && !back && (g.frameT = (g.frameT || 0) - dt) <= 0) { g.frameT = .25; g.camAvoid = 0;
    const d0 = (inCar ? 15 : 8.6) * (K.zoom || 1), p0 = U.clamp(.23 + inp.camPitch, .05, .95), an = new T.Vector3(P.x, P.y + 1.65, P.z), tp = new T.Vector3();
    const clear = yaw => { tp.set(an.x - Math.sin(yaw) * d0 * Math.cos(p0), an.y + d0 * Math.sin(p0), an.z - Math.cos(yaw) * d0 * Math.cos(p0)); return W.clipCamera(an, tp, .32); };
    if (clear(g.camYaw) < .55) { let best = 0, bc = clear(g.camYaw); for (const o of [.3, -.3, .6, -.6, .9, -.9]) { const c = clear(g.camYaw + o); if (c > bc + .15) { bc = c; best = o; break; } } g.camAvoid = best; } }
  if (g.camAvoid && !manual) g.camYaw += g.camAvoid * (1 - Math.exp(-dt * 2.2)) * .5;
  const dist = (inCar ? 15 : 8.6) * (K.zoom || 1) * (K.VW < K.VH ? 1.35 : 1), pitch = U.clamp(.23 + inp.camPitch, .05, .95), fx = Math.sin(g.camYaw), fz = Math.cos(g.camYaw);
  const anchor = new T.Vector3(P.x, P.y + (inCar ? 2.2 : 1.65), P.z);
  if (W.cameraBlocked(anchor.x, anchor.y, anchor.z, .32)) { anchor.y = P.y + .85; if (W.cameraBlocked(anchor.x, anchor.y, anchor.z, .32)) W.liftCamera(anchor, .32); }
  camTarget.set(anchor.x - fx * dist * Math.cos(pitch), anchor.y + dist * Math.sin(pitch), anchor.z - fz * dist * Math.cos(pitch));
  const radius = .32, limit = W.clipCamera(anchor, camTarget, radius) * dist;
  g.camArm = g.camReset || limit < (g.camArm || 0) ? limit : U.damp(g.camArm || 0, limit, 5, dt);
  if (Math.abs(g.camArm - limit) < .001) g.camArm = limit;
  camTarget.copy(anchor).addScaledVector(new T.Vector3(-fx * Math.cos(pitch), Math.sin(pitch), -fz * Math.cos(pitch)), g.camArm);
  if (g.camReset) { camera.position.copy(camTarget); g.camReset = false; } else camera.position.lerp(camTarget, 1 - Math.exp(-dt * 12));
  const safe = W.clipCamera(anchor, camera.position, radius); if (safe < 1) camera.position.lerpVectors(anchor, camera.position, safe);
  if (camera.position.distanceToSquared(camTarget) < .000001) camera.position.copy(camTarget);
  look.set(anchor.x + fx * 4.5, anchor.y + .75, anchor.z + fz * 4.5); camera.lookAt(look);   // look down the street: Kyoto in the lower third, vista above
  g.shake = U.damp(g.shake || 0, 0, 18, dt);
  if (!K.reduceMotion) { camera.rotateZ(Math.sin(g.time * 67) * g.shake * .055); if (g.buffs.buzz > 0) camera.rotateZ(Math.sin(g.time * 2.2) * .025); }
  const fovT = 58 + (K.reduceMotion ? 0 : U.clamp((Math.abs(P.speed) - 11) * 1.05, 0, 10)), next = U.damp(camera.fov, fovT, 5, dt); if (Math.abs(camera.fov - next) > .001) { camera.fov = next; camera.updateProjectionMatrix(); }
  W.followSun(P.x, P.z);
}

/* ================= LOOP ================= */
let last = performance.now(), tt = 0, hudT = 0, mmT = 0;
function frame(now) { requestAnimationFrame(frame); if (!K.stepping) tick(now); }
K.shot = function (name) { K.render(tt); const d = K.renderer.domElement.toDataURL('image/png'); return fetch('/save?name=' + name, { method: 'POST', body: d }).then(r => r.text()); };
K.step = function (n, dt, keysDown) {
  dt = dt == null ? 1 / 30 : dt; if (!Number.isFinite(dt) || dt <= 0 || !Number.isInteger(n) || n < 0) throw new Error('K.step requires a nonnegative frame count and positive dt');
  const held = Object.assign({}, K.keys); K.stepping = true;
  try { if (keysDown) { for (const key in K.keys) K.keys[key] = false; for (const key of keysDown) K.testKey(key); } for (let i = 0; i < n; i++) tick(last + Math.min(dt, .1) * 1000); }
  finally { for (const key in K.keys) K.keys[key] = !!held[key]; K.endFrameInput(); K.readMove(); K.stepping = false; last = performance.now(); }
};
function tick(now) {
  const raw = (now - last) / 1000; const dt = Math.max(0, Math.min(.1, raw)); last = Math.max(last, now); tt += dt;
  if (K.freeze && !K.stepping) { K.render(tt); K.endFrameInput(); return; }   // review captures: hold the staged moment
  if (g.state === 'loading' || g.state === 'error' || (document.hidden && !K.stepping)) { K.endFrameInput(); return; }
  if (K.agent && K.agent.open && ['Escape', 'KeyP', 'Tab', 'KeyL'].some(K.pressed)) {
    K.agent.toggle(); ['Escape', 'KeyP', 'Tab', 'KeyL'].forEach(K.consumeKey);
  }
  K.readMove();
  if (K.agent && (K.agent.open || K.pressed('KeyQ'))) inp.act = false;
  if (K.pressed('KeyP') || K.pressed('Escape')) { if (g.state === 'play' || g.state === 'intro') g.pause(true); else if (g.state === 'paused') g.pause(false); }
  if (K.pressed('KeyM')) { sfx.muted = !sfx.muted; $('#muteBtn').classList.toggle('off', sfx.muted); }
  if (K.pressed('KeyN') && g.musicInit) { try { g.chaseMusic = false; MUSIC().next(); } catch (e) {} }
  if (K.pressed('Tab')) g.albumKey();
  if (K.pressed('KeyL')) g.mapKey();
  if (g.state === 'intro' && g.introT > .3 && (K.pressed('Space') || K.pressed('Enter') || g.skipReq)) { sfx.whoosh(); finishIntro(true); }
  if (g.state === 'title' && (K.pressed('Enter') || K.pressed('Space'))) g.requestStart();
  if (g.state === 'end' && (K.pressed('Enter') || K.pressed('Space') || K.pressed('KeyR'))) g.requestStart(true);
  if (g.state === 'paused' && K.pressed('KeyR')) g.requestStart(true);
  const play = g.state === 'play';
  if (play) {
    if (!K.stepping && !document.hidden && raw > 0) K.quality(Math.min(raw, .1));
    let sim = dt; if (g.hitStop > 0) { const hold = Math.min(sim, g.hitStop); g.hitStop -= hold; sim -= hold; }
    sim = Math.min(sim, 4 / 60); // discard hitch debt; never enlarge a physics step
    const steps = Math.max(1, Math.min(4, Math.ceil(sim / (1 / 60)))), h = sim / steps;
    for (let i = 0; i < steps && g.state === 'play' && h > 0; i++) {
      g.time += h; barkCool = Math.max(0, barkCool - h); if (inp.bark) bark();
      A.updateTraffic(h, true); updatePlayer(h);
      g.flowT -= h; if (g.flowT <= 0) { g.flowT = .3; W.computeFlow(P.x, P.z, A.pascal.x, A.pascal.z); }
      updatePascal(h); if (g.state !== 'play') break;
      updateAgents(h); updateInteract(h); stealBoards(); updateDuo(h); updateItems(h, true); updatePhotoSpots(h); if (g.state !== 'play') break;
      A.updatePeds(h, true); A.updateAnimals(h, true); K.emit('step', h, g); inp.jump = inp.act = inp.bark = false;
    }
    if (g.state === 'play') { updateCamera(dt); if (K.sceneCam) { const sc = K.sceneCam, k = sc.noClip ? 1 : W.clipCamera(sc.look, sc.pos, .35); camera.position.lerpVectors(sc.look, sc.pos, Math.max(.25, k)); camera.lookAt(sc.look); } updateLeash(dt); if (A.updatePhotos) A.updatePhotos(dt, tt, camera.position); }
    K.emit('frame', dt, tt, g);
    hudT -= dt; if (hudT <= 0) { hudT = .1; UI.hudUpdate(g); const M = MUSIC(); if (M && g.musicInit) { const d = Math.hypot(A.pascal.x - P.x, A.pascal.z - P.z); try { M.setIntensity(U.clamp((40 - d) / 30, 0, 1));
      if (!g.chaseMusic && d < 14 && A.pascal.wait <= 0 && P.mode === 'walk') { g.lastSong = (M.current && M.current.id !== 'pascal') ? M.current.id : g.lastSong; g.chaseMusic = true; g.calmT = 0; M.play('pascal', { fade: .6 }); }
      else if (g.chaseMusic) { g.calmT = d > 38 ? g.calmT + .1 : 0; if (g.calmT > 4) { g.chaseMusic = false; M.play(g.lastSong || 'theme', { fade: 2 }); } } } catch (e) {} } }
    mmT -= dt; if (mmT <= 0) { mmT = 1 / 15; UI.minimap(); }
    const dP = Math.hypot(A.pascal.x - P.x, A.pascal.z - P.z); K.post.danger.value = U.damp(K.post.danger.value, A.pascal.wait <= 0 && P.mode !== 'car' ? U.clamp((22 - dP) / 16, 0, 1) : 0, 4, dt);
  } else if (g.state === 'title') {
    const tc = UI.titleCam; const asp = K.VW / K.VH; const hf = 2 * Math.atan(Math.tan(camera.fov * Math.PI / 360) * asp); const need = 7.2 / Math.tan(hf / 2); const base = tc.pos.distanceTo(tc.look); const k = Math.max(1, need / base);
    const cp = tc.look.clone().lerp(tc.pos, k); camera.position.set(cp.x + (K.reduceMotion ? 0 : Math.sin(tt * .15) * 1.2), cp.y + (K.reduceMotion ? 0 : Math.sin(tt * .2) * .3) + (k - 1) * 2, cp.z); camera.lookAt(tc.look.x, tc.look.y - (k - 1) * 1.5, tc.look.z); A.kyoto.mixer.update(dt); W.followSun(UI.P0.x, UI.P0.z);
  } else if (g.state === 'intro') {
    updateIntro(dt);
  } else if (g.state === 'end' && g.endCam) {
    g.endT += dt; if (g.endT < .1) camera.position.copy(g.endCam.pos); else camera.position.lerp(g.endCam.pos, 1 - Math.exp(-dt * 3));
    camera.lookAt(g.endCam.look); A.pascal.mixer.update(dt); A.kyoto.mixer.update(dt);
  } else if (g.state === 'end') {
    g.endT += dt; const a = K.reduceMotion ? 0 : g.endT * .22, anchor = new T.Vector3(P.x, P.y + 1.8, P.z), endPos = new T.Vector3(P.x + Math.cos(a) * 9, P.y + 4.5, P.z + Math.sin(a) * 9);
    if (W.cameraBlocked(anchor.x, anchor.y, anchor.z, .32)) { anchor.y = P.y + .85; W.liftCamera(anchor, .32); }
    camera.position.lerpVectors(anchor, endPos, W.clipCamera(anchor, endPos, .32)); camera.lookAt(anchor); A.pascal.mixer.update(dt); A.kyoto.mixer.update(dt);
  }
  if (g.state !== 'paused') {
    if (!play && (g.state === 'title' || g.state === 'intro')) { A.updateTraffic(dt, false); A.updatePeds(dt, false); A.updateAnimals(dt, false); updateItems(dt, false); }
    W.update(dt, tt, camera.position); if (A.carousel) A.carousel.rotation.y += dt * .6;
  }

  UI.update(dt, tt); K.emit('ui', g); A.updateTags(g.state === 'paused' ? 0 : dt);
  K.post.flash.value = Math.max(0, K.post.flash.value - dt * 2);
  K.render(tt);
  K.endFrameInput();
}

/* ================= BOOT ================= */
const LIST = [['missionrock', 'models/missionrock.json'], ['kyoto', 'models/kyoto.json'], ['human', 'models/human.json'], ['ui3d', 'models/ui3d.json'], ['buildings', 'models/buildings.json'], ['landmarks', 'models/landmarks.json'], ['vehicles', 'models/vehicles.json'], ['props', 'models/props.json'], ['props2', 'models/props2.json'], ['animals', 'models/animals.json'], ['pascal', 'models/pascal.json']]
  .concat(['bb_tokens', 'bb_hire', 'bb_gooddog', 'bb_agents', 'bb_agi', 'bb_mcp', 'mag_forbarks', 'mag_wagged', 'mag_treat', 'mag_lederhosen', 'mural_mission1', 'mural_mission2', 'mural_mission3', 'mural_tech', 'mural_fog', 'arcade_sign'].map(n => [n, 'tex/' + n + '.jpg'])).map(([k, u]) => [k, u + '?v=' + (K.VER || '1')]);
/* Yield so the browser can paint the latest status before the next blocking step (timeout fallback: rAF pauses in hidden tabs). */
const paint = () => new Promise(r => { let d = 0; const go = () => { if (!d) { d = 1; setTimeout(r, 0); } }; requestAnimationFrame(go); setTimeout(go, 120); });
function boot() {
  const bar = $('#loadBar'), track = $('#loadTrack'), hint = $('#loadHint'), t0 = performance.now();
  let phase = 'net', phaseT = t0, last = null, netDone = false;
  const mmss = ms => U.mmss(ms / 1000);
  const netLine = () => { if (!last) return 'Starting downloads… · ' + mmss(performance.now() - t0); return last.done + ' of ' + last.total + ' files processed · ' + (last.bytes / 1048576).toFixed(1) + ' MB reported' + (last.failed ? ' · ' + last.failed + ' failed' : '') + ' · ' + mmss(performance.now() - t0); };
  // ticks the elapsed time while downloads run; explains a long wait instead of looking stuck
  const iv = setInterval(() => { if (phase !== 'net') return; K.loadStatus(null, netDone ? (K.loadStatus.detail || 'Preparing downloaded assets') + ' · ' + mmss(performance.now() - t0) : netLine(), true); if (performance.now() - phaseT > 8000) { hint.textContent = 'First load downloads a lot of 3D models and art. On a slow connection this can take a minute or more.'; hint.hidden = false; } }, 250);
  K.loadStatus('Downloading 3D models & textures', netLine(), true);
  K.loadAll(LIST, (p, key, s) => { if (!s) { bar.style.width = Math.round(p * 100) + '%'; return; } last = s; bar.style.width = (s.done / s.total * 100) + '%'; track.setAttribute('aria-valuemax', String(s.total)); track.setAttribute('aria-valuenow', String(s.done)); track.setAttribute('aria-valuetext', s.done + ' of ' + s.total + ' files processed' + (s.failed ? ', ' + s.failed + ' failed' : '')); if (s.done === s.total) netDone = true; if (!netDone) K.loadStatus(null, netLine(), true); }).then(async () => {
    phase = 'build'; clearInterval(iv);
    hint.textContent = 'These steps run on your CPU. The page can stop responding for a few seconds, longer on slower computers. It is working, not stuck.'; hint.hidden = false;
    const N = 6; let i = 0;
    track.setAttribute('aria-valuemax', String(N)); track.setAttribute('aria-valuenow', '0'); track.setAttribute('aria-valuetext', 'Preparing the game world');
    const step = async msg => { i++; bar.style.width = (i / N * 100) + '%'; track.setAttribute('aria-valuenow', String(i)); track.setAttribute('aria-valuetext', msg); K.loadStatus(msg, 'Step ' + i + ' of ' + N + ' · ' + mmss(performance.now() - t0)); await paint(); await paint(); };
    try {
      const missing = ['kyoto', 'human', 'ui3d'].filter(key => !K.assets[key]); if (missing.length) throw new Error('Missing required models: ' + missing.join(', ') + '. Restore models/ and reload.');
      await step('Building San Francisco');
      const t0b = performance.now(); W.build(); const t1 = performance.now();
      await step('Placing people, pets & traffic');
      const t1b = performance.now(); A.build(); const t2 = performance.now();
      // skaters get boards
      for (const p of A.peds) if (p.arch === 'skater') { const b = A.kyoto.board.clone(); K.ownMaterials(b); b.visible = true; b.position.y = .2; p.root.add(b); p.board3 = b; p.sp = 6; p.play('skate'); }
      await step('Decorating the streets');
      const t2b = performance.now(); decorate(); if (K.dress) K.dress(scene); K.emit('build', scene); const t3 = performance.now();
      await step('Finishing the world');
      const t3b = performance.now(); A.buildPhotos(); W.finish(); K.buildMs = { world: t1 - t0b, actors: t2 - t1b, decorate: t3 - t2b, finish: performance.now() - t3b }; K.applyWorldDetail && K.applyWorldDetail(scene); UI.buildTitle(); UI.buildHud(); UI.buildTouch(); UI.placeTitleKyoto(A.kyoto);
      A.pascal.x = 240; A.pascal.z = 196; A.pascal.y = W.terrainH(240, 196); A.pascal.place();
      await step('Planning traffic routes');
      A.finalizeTraffic();
      await step('Preparing graphics');
      // compile shaders now, behind the loading screen, instead of on the first title frame
      try { K.renderer.compile(scene, camera); if (K.uiScene) K.renderer.compile(K.uiScene, K.uiCam); } catch (e) { console.warn('precompile', e); }
      try { g.prewarmIntro(); } catch (e) { console.warn('prewarm', e); }
    } catch (e) { console.error(e); g.state = 'error'; $('#loading').classList.add('error'); K.loadStatus('Build error', e.message || 'Reload the page to try again.'); hint.textContent = 'The game could not finish initializing. Reload the page to try again.'; hint.hidden = false; return; }
    g.booting = true; g.state = 'title'; A.letters.forEach(l => { l.beam.visible = false; });
    await paint(); await paint();   // first title frame renders under the loading screen
    g.booting = false; $('#loading').hidden = true;
    const SC = /[?&]scene=(\w+)/.exec(location.search); if (SC) setTimeout(() => { try { K.sceneSetup(SC[1]); } catch (e) { console.error('scene', e); document.title = 'SCENE-ERR'; } }, 60);
    const best = parseFloat(K.store.get('kyotokens-best') || ''); if (best > 0) $('#bestTitle').textContent = 'best ' + U.mmss(best);
    $('#help').hidden = false;
  }).catch(e => { clearInterval(iv); console.error('game load failed', e); g.state = 'error'; $('#loading').classList.add('error'); K.loadStatus('Game loading failed', e && e.message ? e.message : 'Reload the page to try again.'); hint.textContent = 'The game could not finish loading. Reload the page to try again.'; hint.hidden = false; });
  requestAnimationFrame(frame);
}
/* Player-initiated start: acknowledge at once, let that paint, then run the (blocking) reset. g.start stays synchronous for scripted callers. */
g.requestStart = function (restart) {
  if (g.booting || g.starting) return;
  if (K.stepping) return g.start(restart);   // scripted steps (scene checks) expect the old synchronous start
  g.starting = true; sfx.init(); sfx.resume();
  const el = $('#starting'); $('#startMsg').textContent = restart ? 'Restarting the run' : 'Starting the run'; el.hidden = false;
  (async () => {
    let failed = false;
    try { await paint(); await paint(); g.start(restart); }
    catch (e) { failed = true; console.error('game start failed', e); g.state = 'error'; el.classList.add('error'); $('#startMsg').textContent = 'The run could not start'; $('#startHint').textContent = 'The city could not be reset. Reload the page to try again.'; }
    finally { g.starting = false; if (!failed) el.hidden = true; }
  })();
};
$('#muteBtn').addEventListener('click', () => { sfx.muted = !sfx.muted; $('#muteBtn').classList.toggle('off', sfx.muted); });
$('#pauseBtn').addEventListener('click', () => g.pause(g.state === 'play' || g.state === 'intro'));
$('#fmBtn').addEventListener('click', () => { if (g.musicInit) try { MUSIC().next(); } catch (e) {} });
addEventListener('pointerdown', () => { if (g.state === 'intro' && g.introT > .3) g.skipReq = true; });
addEventListener('pointerdown', () => { sfx.init(); sfx.resume(); if (g.state === 'title' && !g.titleMusic && window.KyotoMusic && sfx.ctx) { try { if (!g.musicInit) { MUSIC().init(sfx.ctx, sfx.musicOut); MUSIC().onTrack = tr => { if (tr && tr.id !== 'pascal') UI.radio(tr.title); }; g.musicInit = true; } MUSIC().play('theme', { fade: 1 }); g.titleMusic = true; } catch (e) { console.warn(e); } } }, { capture: true });
boot();
})(window.K);
