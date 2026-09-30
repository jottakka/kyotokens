/* R3 sea: shoreline construction, locally generated rigged wildlife and maintenance crew.
 * No actor/UI wrappers; W.inLand and W.move remain the authority for walking.
 * Static detail is merged by material; birds/fish/ripples use shared instanced batches.
 */
(function (K) {
'use strict';
const T = K.T, W = K.W, U = K.U, SEA = -1.6, TAU = Math.PI * 2;
const S = K.sea = { birds: [], dolphins: [], dogs: [], boats: [], stats: {}, time: 0 };
S.isWaterAt = (x, z) => !W.inLand(x, z, 0);
const materials = new Map(), staticParts = [], foam = [], temp = new T.Object3D();
const vec = new T.Vector3(), up = new T.Vector3(0, 1, 0);
function mat(color) { if (!materials.has(color)) materials.set(color, K.toon(color)); return materials.get(color); }
function mesh(geo, color, parent, x = 0, y = 0, z = 0, sx = 1, sy = 1, sz = 1) {
  const o = new T.Mesh(geo, mat(color)); o.position.set(x, y, z); o.scale.set(sx, sy, sz); o.castShadow = o.receiveShadow = true; parent.add(o); return o;
}
const box = () => new T.BoxGeometry(1, 1, 1), ball = () => new T.SphereGeometry(1, 10, 7);
function part(geo, col, x, y, z, sx = 1, sy = 1, sz = 1, ry = 0, rz = 0) {
  temp.position.set(x, y, z); temp.rotation.set(0, ry, rz); temp.scale.set(sx, sy, sz); temp.updateMatrix();
  staticParts.push([geo.applyMatrix4(temp.matrix), col]);
}
function beam(a, b, radius, color) {
  vec.set(b[0] - a[0], b[1] - a[1], b[2] - a[2]); const length = vec.length();
  temp.position.set((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2);
  temp.quaternion.setFromUnitVectors(up, vec.normalize()); temp.scale.set(radius, length, radius); temp.updateMatrix();
  staticParts.push([new T.CylinderGeometry(1, 1, 1, 6).applyMatrix4(temp.matrix), color]);
}
function flush() {
  const colors = new Map();
  for (const [g, c] of staticParts) { if (!colors.has(c)) colors.set(c, []); colors.get(c).push(g); }
  for (const [c, gs] of colors) { const g = T.BufferGeometryUtils.mergeBufferGeometries(gs.map(o => o.index ? o.toNonIndexed() : o)); const o = mesh(g, c, K.scene); o.name = 'sea static ' + c; }
  S.stats.staticBatches = colors.size; staticParts.length = 0;
}
// One coloured mesh per articulated part, rather than one draw call per feather/eye.
function bake(root) {
  root.updateMatrixWorld(true); const gs = [];
  root.traverse(o => { if (!o.isMesh) return; let g = o.geometry.clone().applyMatrix4(o.matrixWorld); if (g.index) g = g.toNonIndexed();
    const p = g.attributes.position, a = new Float32Array(p.count * 3), c = o.material.color;
    for (let i = 0; i < p.count; i++) { a[i * 3] = c.r; a[i * 3 + 1] = c.g; a[i * 3 + 2] = c.b; } g.setAttribute('color', new T.BufferAttribute(a, 3)); gs.push(g);
  });
  return T.BufferGeometryUtils.mergeBufferGeometries(gs);
}
function batch(geo, n, name) {
  const o = new T.InstancedMesh(geo, K.toon('#ffffff', { vertexColors: !!geo.attributes.color }), n);
  o.name = name; o.frustumCulled = false; o.castShadow = false; K.scene.add(o); return o;
}
function matrixAt(o, i, x, y, z, ry = 0, rz = 0, sx = 1, sy = sx, sz = sx, rx = 0) {
  temp.position.set(x, y, z); temp.rotation.set(rx, ry, rz); temp.scale.set(sx, sy, sz); temp.updateMatrix(); o.setMatrixAt(i, temp.matrix);
}
function shoreline() {
  // Vertical concrete quay, salt-darkened foot and pale coping, with open pier mouths.
  for (let i = 0; i < W.SHORE.length; i++) {
    const a = W.SHORE[i], b = W.SHORE[(i + 1) % W.SHORE.length], dx = b[0] - a[0], dz = b[1] - a[1], len = Math.hypot(dx, dz), nx = dz / len, nz = -dx / len;
    const developed = (a[0] > -240 && b[0] > -240 && (a[0] + b[0]) / 2 > -120 && (a[1] + b[1]) / 2 < 510);
    if (developed) {
      const count = Math.ceil(len / 6), step = len / count, ry = Math.atan2(dx, dz);
      for (let j = 0; j < count; j++) {
        const x = a[0] + dx * (j + .5) / count, z = a[1] + dz * (j + .5) / count;
        if (W.inLand(x + nx * 1.1, z + nz * 1.1, 0)) continue;
        part(box(), '#8e9c9e', x - nx * .08, -1.46, z - nz * .08, .7, 3.12, step + .015, ry);
        part(box(), '#415d67', x + nx * .29, -1.66, z + nz * .29, .06, .8, step, ry);
        part(box(), '#e7dac3', x - nx * .24, .045, z - nz * .24, 1.05, .17, step + .01, ry);
        part(box(), '#657c82', x + nx * .285, -.38, z + nz * .285, .075, .06, step - .12, ry);
        foam.push({ x: x + nx * .62, z: z + nz * .62, ry, length: step * .87, phase: j * .6 });
        if (j % 3 === 0) bollard(x - nx * .65, z - nz * .65, .13);
      }
    } else {
      // Irregular, half-submerged rip-rap at wild headlands; beach stays clear of rocks.
      const beach = (a[0] < -780 && b[0] < -780) || ((a[0] + b[0]) / 2 > -450 && (a[0] + b[0]) / 2 < -260 && a[1] < -190 && b[1] < -190);
      for (let d = 2; d < len; d += beach ? 5 : 3.5) {
        const x = a[0] + dx * d / len, z = a[1] + dz * d / len;
        if (!beach) part(new T.DodecahedronGeometry(1, 0), d % 7 < 3.5 ? '#7b898b' : '#a5a399', x + nx * .45, -1.35, z + nz * .45, 1.35 + U.hash(x, z), .8 + U.hash(z, x), 1.4, d);
        else {
          // Land-side wet/dry beach gradient follows actual terrain vertices.
          const p = [], c = [], cols = ['#b7a17a', '#dcc18b', '#f3dda5'];
          for (let v = 0; v < 2; v++) for (let u = 0; u < 3; u++) {
            const xx = x + dx / len * (v ? 2.6 : -2.6) - nx * (u * 5 + .4), zz = z + dz / len * (v ? 2.6 : -2.6) - nz * (u * 5 + .4);
            const h = W.meshH(xx, zz), color = new T.Color(cols[u]); p.push(xx, h + .035, zz); c.push(color.r, color.g, color.b);
          }
          const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(p, 3)); g.setAttribute('color', new T.Float32BufferAttribute(c, 3)); g.setIndex([0, 3, 1, 1, 3, 4, 1, 4, 2, 2, 4, 5]); g.computeVertexNormals();
          // Merge all beach strips below, preserving their vertex colour gradient.
          beachParts.push(g);
        }
      }
    }
  }
  foamBatch = batch(new T.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), foam.length, 'lapping waterline');
  foamBatch.material = new T.MeshBasicMaterial({ color: '#d2f6e9', transparent: true, opacity: .5, depthWrite: false });
  if (beachParts.length) { const o = new T.Mesh(T.BufferGeometryUtils.mergeBufferGeometries(beachParts), K.toon('#ffffff', { vertexColors: true, side: T.DoubleSide })); o.name = 'wet sand to dry beach'; K.scene.add(o); }
  for (const r of W.RECTS) {
    if (/bridge|marin|surf_/.test(r.name || '')) continue;
    const longZ = r.z1 - r.z0 > r.x1 - r.x0;
    // Exposed perimeter piles/fenders read above the water, not hidden under the deck centre.
    const pile = (x, z) => { part(new T.CylinderGeometry(.23, .3, 3.9, 7), '#695143', x, -1.25, z); part(new T.CylinderGeometry(.27, .27, .13, 7), '#344650', x, .43, z); W.addCircle(x, z, .28, .72, { plat: false }); };
    for (let x = r.x0 + .2; x < r.x1; x += 8) { pile(x, r.z0 + .1); pile(x, r.z1 - .1); }
    for (let z = r.z0 + 8; z < r.z1 - 2; z += 8) { pile(r.x0 + .1, z); pile(r.x1 - .1, z); }
    // Actual timber joists and individual deck board seams; piers already own walk surfaces.
    const start = longZ ? r.z0 : r.x0, end = longZ ? r.z1 : r.x1;
    for (let d = start + 1; d < end; d += 2) part(box(), '#79563d', longZ ? (r.x0 + r.x1) / 2 : d, .057, longZ ? d : (r.z0 + r.z1) / 2, longZ ? r.x1 - r.x0 : .045, .014, longZ ? .045 : r.z1 - r.z0);
    const ex = longZ ? r.x0 + .7 : r.x1 - .7, ez = longZ ? r.z0 + .7 : r.z0 + .7;
    for (let d = 0; d <= 8; d += 4) { const x = ex + (longZ ? d : 0), z = ez + (longZ ? 0 : d); bollard(x, z, .05); if (d < 8) for (let k = 0; k < 8; k++) {
      const t = k / 8, u = (k + 1) / 8;
      beam([x + (longZ ? 4 * t : 0), .77 - .28 * Math.sin(t * Math.PI), z + (longZ ? 0 : 4 * t)], [x + (longZ ? 4 * u : 0), .77 - .28 * Math.sin(u * Math.PI), z + (longZ ? 0 : 4 * u)], .035, '#344650');
    } }
  }
}
const beachParts = [];
function bollard(x, z, y) {
  part(new T.CylinderGeometry(.19, .25, .8, 8), '#293e49', x, y + .4, z);
  part(new T.CylinderGeometry(.31, .31, .12, 8), '#e8bb55', x, y + .82, z);
  W.addCircle(x, z, .26, y + .88, { plat: false });
  W.perches.push({ x, y: y + .89, z, kind: 'quay' });
}
function boats() {
  for (const [x, z, color, angle] of [[278, 202, '#dc6046', -.4], [285, -115, '#458d9e', 1.1], [110, -310, '#f5c564', .6], [305, 285, '#589ea1', 2]]) {
    const root = new T.Group(); root.position.set(x, SEA + .25, z); root.rotation.y = angle; K.scene.add(root);
    mesh(ball(), '#273943', root, 0, -.1, 0, 1.5, .6, 3.3);
    mesh(ball(), color, root, 0, .1, 0, 1.48, .5, 3.28);
    mesh(box(), '#f5e4c3', root, 0, .42, -.2, 2.4, .22, 4.8);
    mesh(box(), '#ffefcf', root, 0, 1.25, -.5, 1.7, 1.65, 2.1);
    mesh(box(), '#284d61', root, 0, 1.5, .56, 1.4, .66, .025);
    mesh(box(), '#fff6df', root, 0, 2.15, -.5, 2.1, .17, 2.5);
    mesh(new T.CylinderGeometry(.06, .06, 2.8, 6), '#3b4d52', root, 0, 3.35, -.6);
    mesh(new T.ConeGeometry(.45, 1.3, 3), '#e6814d', root, .25, 4.2, -.6, 1, 1, .1).rotation.z = -Math.PI / 2;
    K.inkShell(root, .025); S.boats.push({ root, x, z, angle });
  }
  for (let i = 0; i < 16; i++) {
    const x = i < 8 ? 277 + i * 3 : 119 + (i - 8) * 6, z = i < 8 ? 170 + i * 18 : -310 - (i - 8) * 6;
    part(new T.SphereGeometry(1, 8, 6), i % 2 ? '#f1d9a2' : '#e75f40', x, SEA + .15, z, .45, .6, .45);
    part(new T.CylinderGeometry(.035, .035, 1.4, 5), '#34434a', x, SEA + 1, z);
  }
}
function birdGeometry(crow) {
  const g = new T.Group(), body = crow ? '#303949' : '#f5f0da', wing = crow ? '#303949' : '#a1b2b8';
  mesh(ball(), body, g, 0, .2, 0, .24, .24, .47); mesh(ball(), body, g, 0, .43, .34, .21, .22, .23);
  mesh(new T.ConeGeometry(.095, .31, 5).rotateX(Math.PI / 2), crow ? '#192532' : '#e6ac3e', g, 0, .42, .59);
  for (const side of [-1, 1]) { mesh(ball(), '#101f2c', g, side * .18, .47, .43, .04, .045, .04); mesh(new T.CylinderGeometry(.025, .025, .21, 5), '#bc873c', g, side * .13, -.045, .04); }
  mesh(new T.ConeGeometry(.19, .43, 3).rotateX(-Math.PI / 2), wing, g, 0, .18, -.52, 1, .4, 1);
  return bake(g);
}
function wingGeometry(crow, side) {
  const g = new T.Group(), c = crow ? '#303949' : '#c1c9c3';
  const shape = new T.Shape(); shape.moveTo(0, 0); shape.lineTo(side * .65, .18); shape.lineTo(side * 1.22, -.36); shape.lineTo(side * .68, -.25); shape.lineTo(side * .15, -.3); shape.closePath();
  const geo = new T.ExtrudeGeometry(shape, { depth: .045, bevelEnabled: false }).rotateX(-Math.PI / 2);
  mesh(geo, c, g); mesh(ball(), crow ? '#16212e' : '#344958', g, side * .94, -.005, .25, .26, .03, .12);
  return bake(g);
}
function birds() {
  const quay = W.perches.filter(p => p.kind === 'quay');
  for (let i = 0; i < Math.min(36, quay.length); i++) { const p = quay[Math.floor(i * quay.length / 36)]; S.birds.push({ ...p, homeX: p.x, homeZ: p.z, homeY: p.y + .16, crow: false, phase: i * 1.83, flight: i % 3 === 0 ? 12 : 0, t: i * .7, scatter: 0 }); }
  const urban = W.perches.filter(p => p.kind !== 'quay' && p.x > -500 && p.z < 450);
  for (let i = 0; i < Math.min(36, urban.length); i++) { const p = urban[Math.floor(i * urban.length / 36)]; S.birds.push({ ...p, homeX: p.x, homeZ: p.z, homeY: p.y + .16, crow: true, phase: i * 2.31, flight: 0, t: i * .9, scatter: 0 }); }
  for (const crow of [false, true]) { const list = S.birds.filter(b => b.crow === crow), n = list.length;
    const body = batch(birdGeometry(crow), n, crow ? 'crows' : 'seagulls'), left = batch(wingGeometry(crow, -1), n, 'bird left wings'), right = batch(wingGeometry(crow, 1), n, 'bird right wings');
    list.forEach((b, i) => Object.assign(b, { i, body, left, right }));
  }
  S.stats.seagulls = S.birds.filter(b => !b.crow).length; S.stats.crows = S.birds.filter(b => b.crow).length;
}
function scare(P, radius) {
  let scared = 0;
  for (const b of S.birds) if ((!b.scatter || b.flight <= 0) && Math.hypot(P.x - b.x, P.z - b.z) < radius && Math.abs((P.y || 0) - b.y) < radius) { b.flight = 5.5; b.scatter = 1; b.t = 0; scared++; }
  S.stats.lastScattered = scared;
}
function fishGeometry() {
  const g = new T.Group(); mesh(ball(), '#78c9ce', g, 0, 0, 0, .17, .26, .59);
  mesh(ball(), '#f4edc1', g, 0, -.08, .04, .15, .13, .44);
  mesh(new T.ConeGeometry(.32, .5, 3).rotateX(-Math.PI / 2), '#467e9c', g, 0, 0, -.6, .25, 1, 1);
  for (const s of [-1, 1]) mesh(ball(), '#163746', g, s * .14, .1, .34, .05, .055, .05);
  return bake(g);
}
const fish = [], FISH_COUNT = 40;
let fishBatch, rippleBatch, foamBatch;
function dolphin() {
  const root = new T.Group(), body = new T.Group(); root.add(body);
  mesh(ball(), '#628e9f', body, 0, 0, 0, .58, .55, 1.65);
  mesh(ball(), '#c2d6c7', body, 0, -.24, .13, .43, .3, 1.32);
  mesh(ball(), '#6999a7', body, 0, .08, 1.18, .43, .43, .65);
  mesh(ball(), '#81aab0', body, 0, -.02, 1.89, .21, .16, .52);
  const fin = new T.Shape(); fin.moveTo(0, 0); fin.lineTo(-.6, .1); fin.lineTo(-.42, .9); fin.quadraticCurveTo(-.03, .55, .42, 0);
  mesh(new T.ExtrudeGeometry(fin, { depth: .09, bevelEnabled: false }).rotateY(Math.PI / 2), '#456f85', body, -.045, .37, 0);
  for (const s of [-1, 1]) {
    mesh(ball(), '#142c3d', body, s * .34, .2, 1.45, .065, .07, .07);
    mesh(ball(), '#538397', body, s * .68, -.25, .4, .6, .085, .27).rotation.y = s * .5;
  }
  const tail = new T.Group(); tail.position.z = -1.65; root.add(tail);
  for (const s of [-1, 1]) mesh(ball(), '#538397', tail, s * .4, 0, -.3, .58, .1, .28).rotation.y = -s * .45;
  const baked = new T.Mesh(bake(body), K.toon('#ffffff', { vertexColors: true })); root.remove(body); root.add(baked); K.inkShell(root, .023); K.scene.add(root);
  return { root, tail };
}
function seaLife() {
  fishBatch = batch(fishGeometry(), FISH_COUNT, 'jumping fish');
  rippleBatch = batch(new T.TorusGeometry(1, .055, 4, 24).rotateX(-Math.PI / 2), FISH_COUNT + 9, 'splash rings'); rippleBatch.material = K.toon('#d8f7ef');
  for (let i = 0; i < FISH_COUNT; i++) {
    const bay = i % 3, x = bay === 0 ? 270 + (i % 7) * 7 : bay === 1 ? 100 + (i % 5) * 14 : 50 + (i % 7) * 12;
    const z = bay === 0 ? 175 + Math.floor(i / 3) * 8 : bay === 1 ? -315 - Math.floor(i / 3) * 7 : -353 - Math.floor(i / 3) * 4;
    fish.push({ x, z, phase: i * .67, angle: i * 2.4 });
  }
  for (let i = 0; i < 9; i++) { const d = dolphin(); Object.assign(d, { x: i < 6 ? 92 + (i % 3) * 9 : 290 + (i % 3) * 8, z: i < 6 ? -376 - Math.floor(i / 3) * 25 : 218 + (i % 3) * 9, phase: i % 3 * .28 + Math.floor(i / 3) * 2.5 }); S.dolphins.push(d); }
  S.stats.fish = fish.length; S.stats.dolphins = S.dolphins.length;
}
function corgi() {
  const root = new T.Group(), body = new T.Group(); root.add(body);
  const tan = '#d29a51', cream = '#fff0cc';
  mesh(ball(), tan, body, 0, .76, -.22, .49, .44, .94);
  mesh(ball(), cream, body, 0, .66, .5, .43, .36, .35);
  for (const x of [-.31, .31]) for (const z of [-.7, .4]) { mesh(ball(), tan, body, x, .35, z, .18, .34, .21); mesh(ball(), cream, body, x, .16, z + .08, .18, .13, .25); }
  mesh(ball(), tan, body, 0, 1.24, .66, .51, .5, .45);
  for (const s of [-1, 1]) { const ear = mesh(new T.ConeGeometry(.235, .62, 3), tan, body, s * .38, 1.74, .64, 1, 1, .65); ear.rotation.z = -s * .18;
    mesh(new T.ConeGeometry(.125, .36, 3), '#dc9a89', body, s * .38, 1.75, .71, 1, 1, .35).rotation.z = -s * .18;
    mesh(ball(), '#1b2a36', body, s * .225, 1.34, 1.047, .085, .105, .045); mesh(ball(), '#fffbee', body, s * .225 - .018, 1.37, 1.083, .025, .032, .018);
    mesh(ball(), cream, body, s * .16, 1.08, 1.06, .23, .18, .21);
  }
  mesh(ball(), cream, body, 0, 1.36, 1.044, .085, .27, .04); mesh(ball(), '#23303b', body, 0, 1.15, 1.24, .13, .085, .075);
  mesh(ball(), '#422f37', body, 0, .98, 1.19, .11, .08, .025); mesh(ball(), '#ec8a8c', body, 0, .955, 1.22, .066, .09, .025);
  // Orange vest with reflective shoulder and waist bands; yellow hard hat leaves ears visible.
  mesh(ball(), '#ef703c', body, 0, .84, -.05, .505, .435, .63);
  for (const x of [-.505, .505]) { mesh(box(), '#fff0a6', body, x, .83, .2, .025, .55, .09); mesh(box(), '#fff0a6', body, x, .71, -.08, .025, .08, .9); }
  mesh(new T.SphereGeometry(.4, 12, 7, 0, TAU, 0, Math.PI / 2), '#ffcd43', body, 0, 1.63, .68, 1, .8, 1);
  mesh(new T.CylinderGeometry(.46, .46, .075, 12), '#ffe28a', body, 0, 1.64, .69, 1, 1, 1.08);
  mesh(box(), '#ffdf77', body, 0, 1.87, .68, .055, .08, .49);
  const baked = new T.Mesh(bake(body), K.toon('#ffffff', { vertexColors: true })); root.remove(body); root.add(baked);
  const tail = new T.Group(); tail.position.set(0, .98, -1); mesh(ball(), tan, tail, 0, .08, -.23, .15, .17, .42); mesh(ball(), cream, tail, 0, .09, -.54, .13, .14, .16); root.add(tail);
  K.inkShell(root, .02); const d = { root, tail };
  // the sculpted, painted construction corgi (Hunyuan3D shape + projected reference paint) replaces the primitive stand-in when loaded
  loadCorgi(g => { const m = T.SkeletonUtils ? T.SkeletonUtils.clone(g.scene) : g.scene.clone(true); if (K.toonify) K.toonify(m); m.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    m.scale.setScalar(.98); root.children.slice().forEach(c => { if (c !== m) c.visible = false; }); root.add(m); K.inkShell(m, .012); d.model = m; });
  return d;
}
let corgiReq = null;
function loadCorgi(cb) {
  if (!T.GLTFLoader) return; if (!corgiReq) corgiReq = new Promise(res => new T.GLTFLoader().load('models/corgi.json?v=' + (K.VER || ''), res, undefined, () => res(null)));
  corgiReq.then(g => { if (g) cb(g); });
}
function maintenance() {
  const root = S.sign = new T.Group(); root.position.set(253.5, 0, 22); root.rotation.y = -Math.PI / 2; K.scene.add(root); root.name = 'Oakland maintenance crew';
  mesh(box(), '#656e73', root, 0, .35, 0, 13, .7, 3.4);
  for (const x of [-3.6, 3.6]) mesh(box(), '#354b56', root, x, 3.9, -1.05, .35, 7.1, .35);
  mesh(box(), '#243844', root, 0, 5.6, -.65, 8.5, 5.8, .3);
  const fallback = K.canvasTex(1024, 448, c => { c.fillStyle = '#f6d775'; c.fillRect(0, 0, 1024, 448); c.fillStyle = '#213945'; c.textAlign = 'center'; c.font = '900 54px sans-serif'; c.fillText('BAY BRIDGE → OAKLAND', 512, 86); c.font = '900 76px sans-serif'; c.fillText('UNDER MAINTENANCE', 512, 216); c.font = 'bold 34px sans-serif'; c.fillText('GOOD BOYS AT WORK', 512, 292); for (let x = -80; x < 1080; x += 100) { c.beginPath(); c.moveTo(x, 356); c.lineTo(x + 48, 356); c.lineTo(x + 110, 448); c.lineTo(x + 62, 448); c.fill(); } });
  const panel = new T.Mesh(new T.PlaneGeometry(8.1, 5.4), new T.MeshBasicMaterial({ map: fallback })); panel.position.set(0, 5.6, -.48); root.add(panel);
  // Same-origin optional art; fallback stays readable even if the art worker is late.
  const img = new Image(); img.onload = () => { const texture = new T.Texture(img); texture.encoding = T.sRGBEncoding; texture.needsUpdate = true; panel.material.map = texture; panel.material.needsUpdate = true; S.stats.signArt = 'art/sign_bay_bridge.png'; }; img.onerror = () => { S.stats.signArt = 'canvas fallback'; }; img.src = 'art/sign_bay_bridge.png';
  for (const x of [-3.45, 3.45]) { const d = corgi(); d.root.position.set(x, .7, .55); d.root.scale.setScalar(1.25); root.add(d.root); d.phase = x; S.dogs.push(d); }
  for (const x of [-6.3, -4.8, 0, 4.8, 6.3]) { mesh(box(), '#2b3b42', root, x, .13, 3.3, .95, .16, .95); mesh(new T.ConeGeometry(.34, 1.1, 8), '#ef7641', root, x, .74, 3.3); mesh(new T.CylinderGeometry(.2, .25, .17, 8), '#fff0d1', root, x, .72, 3.3); }
  for (const x of [-5.5, 5.5]) { for (const dx of [-.8, .8]) mesh(box(), '#354b56', root, x + dx, 1.02, 1.6, .14, .65, .25); mesh(box(), '#eee2bd', root, x, 1.4, 1.6, 2.2, .72, .16); for (const dx of [-.72, 0, .72]) mesh(box(), '#eb773c', root, x + dx, 1.4, 1.7, .28, .76, .03).rotation.z = -.45; }
  // A high solid panel blocks the full 16m ramp; base is a genuine platform.
  W.addBox(252.1, 255.2, 13.8, 30.2, 8.45); W.addBox(249.8, 254.9, 15.5, 28.5, .7, { step: true });
  for (const d of S.dogs) d.tag = K.A.tag(d.root, '', '', 2.2, 55);
  S.stats.corgis = S.dogs.length;
}
let shoutCooldown = 0, birdCall = 5;
function animate(dt) {
  const P = K.A.player; S.time += dt; const t = S.time;
  shoutCooldown -= dt; birdCall -= dt;
  if (Math.hypot(P.x - 251, P.z - 22) < 20 && shoutCooldown <= 0) { K.A.say(S.dogs[Math.floor(t) % 2].tag, Math.floor(t) % 2 ? 'Closed for good boys only!' : 'Wuff! Under maintenance!', 3.5, 'shout'); shoutCooldown = 12; }
  for (const d of S.dogs) { d.tail.rotation.y = Math.sin(t * 8 + d.phase) * .5; d.root.rotation.z = Math.sin(t * 1.6 + d.phase) * .018; }
  for (const b of S.boats) { b.root.position.y = SEA + .25 + Math.sin(t * 1.2 + b.x) * .12; b.root.rotation.z = Math.sin(t * .9 + b.z) * .035; b.root.visible = Math.hypot(P.x - b.x, P.z - b.z) < 350; }
  foam.forEach((f, i) => matrixAt(foamBatch, i, f.x, SEA + .065 + Math.sin(t * 1.8 + f.phase) * .035, f.z, f.ry, 0, .5 + .18 * Math.sin(t * 1.8 + f.phase), 1, f.length)); foamBatch.instanceMatrix.needsUpdate = true;
  if (Math.abs(P.speed) > 9) scare(P, 5.5);
  for (const b of S.birds) {
    b.t += dt; b.flight = Math.max(0, b.flight - dt);
    if (!b.flight && b.t > 14 + b.phase % 7) { b.flight = 10; b.t = 0; b.scatter = 0; }
    let x = b.homeX, y = b.homeY, z = b.homeZ, heading = b.phase, flap = -.1;
    if (b.flight > 0) { const duration = b.scatter ? 5.5 : 10, elapsed = duration - b.flight, fade = Math.min(1, elapsed / 1.2, b.flight / 1.5), a = elapsed * .7 + b.phase;
      x += Math.sin(a) * 8 * fade; z += Math.cos(a) * 8 * fade; y += (b.crow ? 5 : 8) * fade + Math.sin(elapsed * 2) * .25 * fade; heading = a + Math.PI / 2; flap = Math.sin(t * (b.scatter ? 16 : 9) + b.phase) * .65;
    } else { const hop = Math.max(0, Math.sin(b.t * 3 + b.phase) - .93) * 4; y += hop; heading += Math.sin(b.t * .4) * .4;
      if (b.crow && birdCall <= 0 && Math.hypot(P.x - x, P.z - z) < 30) { K.A.sfxText(x, y + .7, z, 'CAW!', 'small'); K.sfx.squawk(); birdCall = 14; }
    }
    b.x = x; b.y = y; b.z = z;
    const visible = Math.hypot(P.x - x, P.z - z) < 260, scale = visible ? (b.crow ? .9 : 1.05) : 0;
    matrixAt(b.body, b.i, x, y, z, heading, 0, scale);
    matrixAt(b.left, b.i, x, y + .28, z, heading, b.flight ? -flap : -1.25, scale);
    matrixAt(b.right, b.i, x, y + .28, z, heading, b.flight ? flap : 1.25, scale);
  }
  for (const b of S.birds) { b.body.instanceMatrix.needsUpdate = b.left.instanceMatrix.needsUpdate = b.right.instanceMatrix.needsUpdate = true; }
  for (let i = 0; i < fish.length; i++) {
    const f = fish[i], cycle = (t + f.phase) % 7, q = cycle / 1.5, active = q < 1, dist = (q - .5) * 5;
    const x = f.x + Math.sin(f.angle) * dist, z = f.z + Math.cos(f.angle) * dist;
    matrixAt(fishBatch, i, x, SEA + Math.sin(q * Math.PI) * 2.5, z, f.angle, 0, active && S.isWaterAt(x, z) ? 1 : 0, active ? 1 : 0, active ? 1 : 0, -Math.atan2(Math.cos(q * Math.PI) * 5.2, 3.3));
    const splash = cycle > 1.5 && cycle < 2.6, r = (cycle - 1.5) / 1.1;
    matrixAt(rippleBatch, i, f.x + Math.sin(f.angle) * 2.5, SEA + .07, f.z + Math.cos(f.angle) * 2.5, 0, 0, splash ? .2 + r * 1.8 : 0, splash ? 1 - r : 0, splash ? .2 + r * 1.8 : 0);
  }
  S.dolphins.forEach((d, i) => {
    // Third pod joins the surfer, only when the complete leap corridor is clear water.
    const surfing = K.surf && K.surf.active;
    if (i >= 6 && surfing) { const x = P.x + 15 + (i - 6) * 7, z = P.z - 12; if (S.isWaterAt(x - 7, z) && S.isWaterAt(x + 7, z)) { d.x += (x - d.x) * Math.min(1, dt * 2); d.z += (z - d.z) * Math.min(1, dt * 2); } }
    const cycle = (t + d.phase) % 7, q = cycle / 2.7, leap = q < 1, x = d.x + (q - .5) * 14, z = d.z;
    const y = SEA + (leap ? Math.sin(q * Math.PI) * 3.2 : -.25), near = Math.hypot(P.x - d.x, P.z - d.z) < 320;
    d.root.visible = near && S.isWaterAt(x, z); d.root.position.set(leap ? x : d.x + Math.sin(t * .4) * 6, y, z);
    d.root.rotation.set(0, Math.PI / 2, leap ? Math.atan2(Math.cos(q * Math.PI) * 3.7, 5.2) : 0); d.tail.rotation.x = Math.sin(t * 6 + d.phase) * .22;
    const r = (cycle - 2.7) / 1.3, splash = r >= 0 && r < 1;
    matrixAt(rippleBatch, fish.length + i, d.x + 7, SEA + .075, d.z, 0, 0, splash ? .6 + r * 3 : 0, splash ? 1 - r : 0, splash ? .6 + r * 3 : 0);
  });
  fishBatch.instanceMatrix.needsUpdate = rippleBatch.instanceMatrix.needsUpdate = true;
}
K.on('build', () => { W._placementMove = null; shoreline(); boats(); maintenance(); birds(); seaLife(); flush(); animate(0); });
K.on('step', dt => animate(dt));
K.on('bark', (P, radius) => scare(P, radius || 20));
K.on('start', () => { S.time = 0; shoutCooldown = 0; birdCall = 5; for (const b of S.birds) { b.flight = !b.crow && b.i % 3 === 0 ? 10 : 0; b.scatter = 0; b.t = b.phase; } });
K.scenes = K.scenes || {};
function view(h, x, z, pos, look, t) { h.play(); h.go(x, z); h.pz.wait = 1000; h.g.duoT = 1000; h.g.told.photo = 1; h.st(5); S.time = t || 0; animate(0); K.sceneCam = { noClip: true, pos: new T.Vector3(...pos), look: new T.Vector3(...look) }; h.st(1); }
K.scenes.waterfront = h => view(h, 254, 186, [282, 9.5, 224], [255, 1.1, 189], 1);
K.scenes.baybridge = h => { view(h, 245, 22, [245.5, 8.9, 22], [253.5, 3.8, 22], 2); K.A.say(S.dogs[0].tag, 'Wuff! Under maintenance!', 6, 'shout'); K.A.updateTags(0); };
K.scenes.hills = h => view(h, -144, 14, [-159, 17, 31], [-126, 7, 10], 2);
K.scenes.sealife = h => view(h, 103, -281, [124, 5.5, -357], [104, .7, -378], 1.1);
K.scenes.beaches = h => view(h, -785, 60, [-806, 7, 86], [-782, .5, 53], .5);
K.scenes.sea_piers = h => view(h, 103, -280, [117, 7, -304], [88, 1, -285], 1);
K.scenes.sea_audit = h => {
  h.play(); h.go(254, 186); h.pz.wait = 1000; h.st(2);
  const result = W.auditPlacements();
  console.warn('SEA_AUDIT ' + JSON.stringify({ count: result.count, before: result.before, after: result.after, foundations: result.foundations, moved: result.moved, removed: result.removed }));
  for (const [kind, row] of Object.entries(result.kinds)) console.warn('SEA_KIND ' + kind + ' ' + JSON.stringify(row));
  console.warn('SEA_STATS ' + JSON.stringify(S.stats));
  const problems = W.placements.filter(p => p.after.water || p.after.gap > .16); for (const p of problems.slice(0, 10)) console.warn('SEA_BAD ' + JSON.stringify(p));
  if (problems.length) throw new Error('Sea placement audit failed: ' + problems.length);
  const e = { x: 250, z: 110, y: 0 }; W.move(e, 200, 0, .7, 0); if (!W.inLand(e.x, e.z, .7) || e.x > 257.301) throw new Error('Water boundary regression');
  const b = { x: 244, z: 22, y: 0 }; W.move(b, 30, 0, .7, 0); if (b.x > 251.5) throw new Error('Maintenance barrier permits crossing');
  const bird = S.birds.find(b => b.kind === 'quay'); scare({ x: bird.x, y: bird.y, z: bird.z }, 5); if (!S.stats.lastScattered) throw new Error('Bird scatter failed');
  S.time = .65; animate(0); if (S.dolphins[0].root.position.y < SEA + 1.5) throw new Error('Dolphin leap failed');
  S.time = 3.2; animate(0); const ring = new T.Matrix4(); rippleBatch.getMatrixAt(fish.length, ring); if (Math.abs(ring.elements[0]) < .1) throw new Error('Dolphin splash failed');
  if (S.isWaterAt(246, 184) || !S.isWaterAt(300, 184)) throw new Error('Sea API land/water classification failed');
  console.warn('SEA_CHECKS PASS placement, water boundary, maintenance collision, bird scatter, dolphin leap/splash, sea API');
  view(h, 254, 186, [282, 9.5, 224], [255, 1.1, 189], 1);
};
})(window.K);
