/* One run, one souvenir: bark near the Giants fan to borrow his little SF cap. */
(function (K) {
'use strict';
const T = K.T, A = K.A, W = K.W;
const hat = K.hat = { owned: false, npc: null, cap: null };
const RANGE = 5;
function makeCap() {
  const cap = new T.Group(); cap.name = 'sf_souvenir_cap';
  // Three r128 expects linear material colors; keep the fabric black in the warm scene light.
  const black = K.toon(new T.Color('#111114').convertSRGBToLinear());
  const seam = K.toon(new T.Color('#242428').convertSRGBToLinear());
  const orange = new T.MeshBasicMaterial({ color: new T.Color('#ff6500').convertSRGBToLinear(), toneMapped: false, side: T.DoubleSide });
  const add = (geometry, material, x, y, z) => { const m = new T.Mesh(geometry, material); m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true; cap.add(m); return m; };
  // A structured six-panel crown: upright at the forehead, rounded over the skull.
  const profile = [[0, 1], [.08, 1], [.17, .95], [.245, .81], [.30, .58], [.335, .28], [.343, 0]], depthScale = 1.025;
  const crown = add(new T.LatheGeometry(profile.map(p => new T.Vector2(p[1] * .355, p[0])), 32), black, 0, 0, 0); crown.scale.z = depthScale;
  const band = add(new T.CylinderGeometry(.352, .352, .035, 32), black, 0, .005, 0); band.scale.z = depthScale;
  const button = add(new T.SphereGeometry(.026, 10, 6), black, 0, .343, 0); button.scale.y = .45;
  for (let i = 0; i < 6; i++) {
    const a = (i + .5) * Math.PI / 3;
    const points = profile.map(p => new T.Vector3(Math.sin(a) * p[1] * .357, p[0] + .001, Math.cos(a) * p[1] * (.355 * depthScale + .002)));
    add(new T.TubeGeometry(new T.CatmullRomCurve3(points), 24, .002, 3, false), seam, 0, 0, 0);
  }
  // A thin, gently cupped bill projects forward; its curved outline is not a second dome.
  const positions = [], indices = [], cols = 20, rows = 8, layer = (cols + 1) * (rows + 1);
  for (let side = 0; side < 2; side++) for (let row = 0; row <= rows; row++) for (let col = 0; col <= cols; col++) {
    const u = col / cols * 2 - 1, v = row / rows;
    positions.push(u * (.30 + .068 * Math.sin(Math.PI * v)), -.004 - .035 * u * u - .020 * v * v - side * .023, .13 + v * (.47 - .14 * u * u));
  }
  for (let row = 0; row < rows; row++) for (let col = 0; col < cols; col++) {
    const a = row * (cols + 1) + col, b = a + 1, c = a + cols + 1, d = c + 1;
    indices.push(a, c, b, b, c, d, a + layer, b + layer, c + layer, b + layer, d + layer, c + layer);
  }
  const edge = (a, b) => indices.push(a, b, a + layer, b, b + layer, a + layer);
  for (let col = 0; col < cols; col++) { edge(col + 1, col); edge(rows * (cols + 1) + col, rows * (cols + 1) + col + 1); }
  for (let row = 0; row < rows; row++) { edge(row * (cols + 1), (row + 1) * (cols + 1)); edge((row + 1) * (cols + 1) + cols, row * (cols + 1) + cols); }
  const bill = new T.BufferGeometry(); bill.setAttribute('position', new T.Float32BufferAttribute(positions, 3)); bill.setIndex(indices); bill.computeVertexNormals();
  add(bill, black, 0, 0, 0).name = 'forward_curved_bill';
  // Filled, angular S and serif F follow the front panel like orange embroidery.
  const logo = new T.Group(); logo.name = 'orange_interlocking_SF'; cap.add(logo);
  const frontRadius = y => {
    for (let i = 1; i < profile.length; i++) if (y <= profile[i][0]) {
      const a = profile[i - 1], b = profile[i], f = (y - a[0]) / (b[0] - a[0]); return (a[1] + (b[1] - a[1]) * f) * .355;
    }
    return 0;
  };
  const letter = (name, points, lift) => {
    const shape = new T.Shape(points.map(p => new T.Vector2(p[0] * 1.1, p[1] * 1.1))), source = new T.ShapeGeometry(shape).toNonIndexed(), p = source.attributes.position, vertices = [];
    const project = a => { const x = a.x, y = a.y + .17, r = frontRadius(y); vertices.push(x, y, Math.sqrt(Math.max(0, r * r - x * x)) * depthScale + lift); };
    // Subdivide before projecting so broad letter strokes cannot disappear inside the curved crown.
    const triangle = (a, b, c, depth) => {
      if (!depth) { project(a); project(b); project(c); return; }
      const ab = a.clone().add(b).multiplyScalar(.5), bc = b.clone().add(c).multiplyScalar(.5), ca = c.clone().add(a).multiplyScalar(.5);
      triangle(a, ab, ca, depth - 1); triangle(ab, b, bc, depth - 1); triangle(ca, bc, c, depth - 1); triangle(ab, bc, ca, depth - 1);
    };
    for (let i = 0; i < p.count; i += 3) triangle(new T.Vector2(p.getX(i), p.getY(i)), new T.Vector2(p.getX(i + 1), p.getY(i + 1)), new T.Vector2(p.getX(i + 2), p.getY(i + 2)), 3);
    source.dispose(); const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(vertices, 3)); g.computeVertexNormals();
    const m = new T.Mesh(g, orange); m.name = name; logo.add(m);
  };
  letter('embroidered_S', [[-.078, .117], [.042, .117], [.071, .101], [.077, .080], [.040, .091], [-.054, .091], [-.053, .055], [-.034, .039], [.048, .014], [.075, -.012], [.078, -.065], [.058, -.084], [-.051, -.087], [-.081, -.066], [-.086, -.024], [-.057, -.024], [-.052, -.057], [.045, -.061], [.045, -.030], [.027, -.015], [-.060, .014], [-.083, .037], [-.087, .094]], .005);
  letter('embroidered_F', [[-.030, .080], [.080, .070], [.105, .040], [.075, .047], [.007, .054], [.007, .020], [.049, .010], [.060, -.001], [.060, -.021], [.007, -.014], [.007, -.093], [.028, -.115], [-.022, -.115], [-.038, -.096], [-.018, -.082], [-.018, .060]], .007);
  K.ownMaterials(cap); return cap;
}
function fitNPC() {
  const p = hat.npc, cap = hat.cap;
  p.root.add(cap); cap.visible = true; cap.scale.setScalar(.88); cap.position.set(0, 3.15, 0); cap.rotation.set(0, 0, 0);
  p.root.updateMatrixWorld(true); const head = fanHead(); if (head) head.attach(cap);
}
function fanHead() { const p = hat.npc; return (p.model || p.root).getObjectByName('Head') || p.root.getObjectByName('head'); }
function addHairFlower() {
  const p = hat.npc, flower = new T.Group(); flower.name = 'sf_fan_hair_flower';
  const petal = K.toon('#fff0d4'), center = K.toon('#ffb735'), green = K.toon('#45824c');
  const add = (geometry, material, x, y, z, sx, sy, sz) => { const m = new T.Mesh(geometry, material); m.position.set(x, y, z); m.scale.set(sx, sy, sz); m.castShadow = true; flower.add(m); return m; };
  // A five-petal blossom tucked beside the temple; it stays with the fan.
  for (let i = 0; i < 5; i++) { const a = i * Math.PI * 2 / 5; const m = add(new T.SphereGeometry(1, 8, 5), petal, Math.cos(a) * .082, Math.sin(a) * .082, 0, .075, .049, .025); m.rotation.z = a; }
  add(new T.SphereGeometry(1, 8, 5), center, 0, 0, .029, .044, .044, .024);
  const stem = add(new T.CylinderGeometry(.01, .01, .13, 5), green, .015, -.095, -.013, 1, 1, 1); stem.rotation.z = -.18;
  const leaf = add(new T.SphereGeometry(1, 6, 4), green, .048, -.10, -.006, .057, .022, .013); leaf.rotation.z = .65;
  flower.position.set(-.29, 2.99, .22); flower.rotation.y = -.35; p.root.add(flower); K.ownMaterials(flower); p.root.updateMatrixWorld(true); fanHead().attach(flower); hat.flower = flower;
}
function fitKyoto() {
  const dog = A.kyoto, cap = hat.cap, head = dog.root.getObjectByName('head');
  // Bind-space skull bounds: head extends along +Y; the crown faces -Z.
  head.add(cap); cap.scale.setScalar(.88); cap.position.set(0, .50, -.30); cap.rotation.set(-Math.PI / 2, 0, 0); cap.visible = true;
}
K.on('build', () => {
  const s = W.HOME.start, q = W.freeWalk(s.x + 7, s.z - 7, .8);
  const p = hat.npc = A.person({ model: 'casual_character', shirt: '#fff1d5', pants: '#29364b', shoes: '#ed7c38', hair: '#422a1d', skin: '#dfaa80' });
  Object.assign(p, { x: q[0], z: q[1], y: W.terrainH(q[0], q[1]), heading: -Math.PI / 4 }); p.place(); p.play('idle', 0);
  p.root.name = 'sf_cap_fan'; p.tag = A.tag(p.root, 'SF FAN · B / ↓', null, 3.8, 30);
  hat.cap = makeCap(); fitNPC(); addHairFlower();
});
K.on('start', () => { hat.owned = false; A.player.sfHat = false; hat.npc.tag.n.textContent = 'SF FAN · B / ↓'; fitNPC(); });
K.on('step', dt => { const p = hat.npc; if (!p) return; p.mixer.update(dt); });
K.on('bark', p => {
  if (hat.owned || !hat.npc || Math.hypot(p.x - hat.npc.x, p.z - hat.npc.z) > RANGE || Math.abs(p.y - hat.npc.y) > 3) return;
  hat.owned = true; p.sfHat = true; fitKyoto(); hat.npc.tag.n.textContent = 'SF FAN';
  A.say(hat.npc.tag, 'Looking good, little Giants fan!', 3); K.UI.banner('SF CAP!', 'A little San Francisco souvenir. Yours for this run.', 'gold'); K.sfx.coin();
});
K.scenes = K.scenes || {};
function stage(h, collect) {
  h.play(); h.pz.wait = 1e6; const p = hat.npc;
  h.go(p.x + 2, p.z + 2); h.P.heading = -Math.PI / 4; h.st(2);
  if (collect) { K.fn.bark(); h.st(30); }
  K.sceneCam = { noClip: true, pos: new T.Vector3(p.x - 3, p.y + 3.4, p.z + 7), look: new T.Vector3(p.x + 1, p.y + 1.9, p.z + 1) }; h.st(1);
}
K.scenes.hatnpc = h => stage(h, false);
K.scenes.hat = h => stage(h, true);
K.scenes.hatcheck = h => {
  h.play(); h.pz.wait = 1e6; const p = hat.npc, results = [];
  const check = (ok, message) => { if (!ok) throw new Error('hat check: ' + message); results.push(message); };
  check(!hat.owned && hat.cap.parent === fanHead(), 'NPC initially wears cap');
  check(hat.flower.visible && hat.flower.parent === fanHead(), 'flower is attached to fan hair');
  h.st(65); h.P.x = p.x + 30; h.P.z = p.z; h.P.y = p.y; K.fn.bark(); check(!hat.owned, 'distant bark does not award cap');
  h.st(65); h.P.x = p.x + 2; h.P.z = p.z + 2; h.P.y = p.y; K.fn.bark();
  check(hat.owned && h.P.sfHat && hat.cap.parent === A.kyoto.root.getObjectByName('head'), 'real nearby bark transfers cap to Kyoto head');
  check(hat.flower.visible && hat.flower.parent === fanHead(), 'flower remains on fan after cap transfer');
  h.st(90, ['KeyW']); check(hat.cap.visible && hat.owned && hat.cap.parent === A.kyoto.root.getObjectByName('head'), 'cap persists through movement');
  const parent = hat.cap.parent; K.fn.bark(); check(hat.cap.parent === parent && hat.owned, 'repeat bark preserves acquired cap');
  h.g.start(true); check(!hat.owned && !h.P.sfHat && hat.cap.parent === fanHead(), 'new run returns cap to NPC');
  h.P.x = p.x + 2; h.P.z = p.z + 2; h.P.y = p.y; K.fn.bark(); h.pz.wait = 1e6; h.st(65);
  check(hat.owned && hat.cap.parent === A.kyoto.root.getObjectByName('head'), 'cap can be acquired again after restart');
  K.hatCheck = { ok: true, results }; stageCamera(h, p);
};
function stageCamera(h, p) { h.go(p.x + 2, p.z + 2); h.P.heading = -Math.PI / 4; h.st(2); K.sceneCam = { noClip: true, pos: new T.Vector3(p.x - 3, p.y + 3.4, p.z + 7), look: new T.Vector3(p.x + 1, p.y + 1.9, p.z + 1) }; h.st(1); }
})(window.K);
