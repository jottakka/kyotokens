/* SF street life — deterministic, city-wide instanced batches. */
(function (K) {
'use strict';
try {
K.dress = function (scene) {
  const stats = K.dressStats = { lanterns: 0, furniture: 0, cafes: 0, wirePoles: 0, drawCalls: 0 };
  try {
    const W = K.W, T = K.T, U = K.U, batches = [], dm = new T.Object3D();
    const up = new T.Vector3(0, 1, 0), dir = new T.Vector3();
    let seed = 0x53464c49;
    const rand = (a, b) => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return a + (b - a) * seed / 4294967296; };
    // Independent quotas total 6000; reserve complete objects before emitting parts.
    const left = { lantern: 1800, furniture: 2200, cafe: 400, wire: 1600 };
    function reserve(kind, n) { if (left[kind] < n) return false; left[kind] -= n; return true; }
    const box = () => new T.BoxGeometry(1, 1, 1);
    const cyl = () => new T.CylinderGeometry(1, 1, 1, 10);
    const ball = () => new T.SphereGeometry(1, 12, 8);
    // Bake primitive parts and their colours into a single draw-call geometry.
    function shape(parts) {
      const p = [], n = [], c = [];
      for (const [geo, color, x, y, z, sx, sy, sz, rz] of parts) {
        const g = geo.index ? geo.toNonIndexed() : geo, col = new T.Color(color);
        g.scale(sx, sy, sz); if (rz) g.rotateZ(rz); g.translate(x, y, z);
        const pos = g.attributes.position, nor = g.attributes.normal;
        for (let i = 0; i < pos.count; i++) {
          p.push(pos.getX(i), pos.getY(i), pos.getZ(i)); n.push(nor.getX(i), nor.getY(i), nor.getZ(i)); c.push(col.r, col.g, col.b);
        }
        g.dispose(); if (g !== geo) geo.dispose();
      }
      const g = new T.BufferGeometry();
      g.setAttribute('position', new T.Float32BufferAttribute(p, 3));
      g.setAttribute('normal', new T.Float32BufferAttribute(n, 3));
      g.setAttribute('color', new T.Float32BufferAttribute(c, 3)); return g;
    }
    const yellow = '#eebd37', white = '#f2e5c9', metal = '#54666b', green = '#297253';
    function batch(name, geo, shadow, material) {
      const b = { name, geo, shadow: !!shadow, mat: material || K.toon('#ffffff', { vertexColors: true }), matrices: [] };
      batches.push(b); return b;
    }
    function put(b, x, y, z, sx = 1, sy = 1, sz = 1, angle = 0) {
      if (!/lantern/.test(b.name)) {
        if (!b.support) { b.geo.computeBoundingBox(); b.support = b.geo.boundingBox.clone();
          // Umbrella canopy is suspended on a narrow pole.
          if (b.name === 'striped umbrella') { b.support.min.x = b.support.min.z = -.06; b.support.max.x = b.support.max.z = .06; }
        }
        const it = { x, y, z, ry: angle, sx, sy, sz };
        if (!W.supportPlacement(b.name, b.support, it, 'prop')) return;
        x = it.x; y = it.y; z = it.z;
      }
      dm.position.set(x, y, z); dm.rotation.set(0, angle, 0); dm.scale.set(sx, sy, sz); dm.updateMatrix(); b.matrices.push(dm.matrix.clone());
    }
    function rod(b, a, v, radius) {
      dir.set(v[0] - a[0], v[1] - a[1], v[2] - a[2]); const len = dir.length();
      dm.position.set((a[0] + v[0]) / 2, (a[1] + v[1]) / 2, (a[2] + v[2]) / 2);
      dm.quaternion.setFromUnitVectors(up, dir.normalize()); dm.scale.set(radius, len, radius); dm.updateMatrix(); b.matrices.push(dm.matrix.clone());
    }
    const hydrant = batch('hydrant', shape([
      [cyl(), yellow, 0, .43, 0, .23, .86, .23], [ball(), white, 0, .91, 0, .27, .19, .27],
      [cyl(), white, 0, .08, 0, .3, .16, .3], [cyl(), yellow, 0, .61, 0, .12, .68, .12, Math.PI / 2]
    ]), true);
    const bin = batch('bin', shape([
      [cyl(), green, 0, .59, 0, .4, 1.18, .4], [cyl(), '#174b3b', 0, 1.2, 0, .44, .12, .44],
      [box(), '#172f31', 0, .98, .393, .32, .19, .045], [box(), white, 0, .58, .403, .23, .25, .025]
    ]), true);
    const news = batch('news box', shape([
      [box(), '#ffffff', 0, .7, 0, .7, 1.3, .64], [box(), '#213947', 0, .84, .329, .52, .52, .025],
      [box(), '#f6edd7', 0, .87, .348, .4, .34, .025], [box(), '#344a50', 0, .35, .34, .3, .07, .04]
    ]), true);
    const planter = batch('planter', shape([
      [new T.CylinderGeometry(.53, .4, .65, 10), '#be6944', 0, .325, 0, 1, 1, 1],
      [cyl(), '#e3945e', 0, .6, 0, .57, .13, .57], [ball(), '#438647', 0, .86, 0, .57, .36, .52]
    ]), true);
    const rack = batch('bike rack', shape([
      [cyl(), metal, -.42, .4, 0, .055, .8, .055], [cyl(), metal, .42, .4, 0, .055, .8, .055],
      [new T.TorusGeometry(.42, .055, 6, 12, Math.PI), metal, 0, .8, 0, 1, 1, 1]
    ]), true);
    const meter = batch('parking meter', shape([
      [cyl(), metal, 0, .65, 0, .055, 1.3, .055], [ball(), '#8a9995', 0, 1.43, 0, .19, .28, .14],
      [box(), '#233d43', 0, 1.48, .13, .2, .14, .03], [box(), yellow, 0, 1.28, .14, .11, .025, .02]
    ]), true);
    const table = batch('cafe table', shape([
      [cyl(), '#dca55b', 0, 1.04, 0, .6, .12, .6], [cyl(), metal, 0, .51, 0, .07, 1.02, .07], [cyl(), metal, 0, .05, 0, .35, .1, .35]
    ]), true);
    const chairParts = [[box(), '#347e89', 0, .57, 0, .48, .1, .48], [box(), '#347e89', 0, .87, -.22, .48, .5, .07]];
    for (const x of [-.19, .19]) for (const z of [-.19, .19]) chairParts.push([cyl(), metal, x, .28, z, .03, .56, .03]);
    const chair = batch('cafe chair', shape(chairParts), true);
    const umbrellaParts = [[cyl(), white, 0, 1.36, 0, .045, 2.72, .045]];
    for (let i = 0; i < 12; i++) umbrellaParts.push([
      new T.ConeGeometry(1.5, .7, 1, 1, true, i * Math.PI / 6, Math.PI / 6), i % 2 ? white : '#cf503c', 0, 2.72, 0, 1, 1, 1
    ]);
    const umbrella = batch('striped umbrella', shape(umbrellaParts), true);
    umbrella.mat = K.toon('#ffffff', { vertexColors: true, side: T.DoubleSide });
    const lantern = batch('lantern body', ball(), false, K.toon('#cf302b', { emissive: new T.Color('#ff3b1f'), emissiveIntensity: .35 }));
    const trim = batch('lantern trim', shape([
      [cyl(), yellow, 0, .28, 0, .16, .09, .16], [cyl(), yellow, 0, -.28, 0, .16, .09, .16],
      [cyl(), '#cd6b2c', 0, -.43, 0, .035, .22, .035]
    ]), false);
    const cable = batch('overhead cables', cyl(), false, K.toon('#34333c'));
    const pole = batch('wire supports', cyl(), true, K.toon('#81918f'));
    const segs = (W.roadSegs || []).filter(s => Number.isFinite(s.ax + s.az + s.bx + s.bz + s.w) && s.w > 0 && Math.hypot(s.bx - s.ax, s.bz - s.az) > .01);
    function nearIntersection(x, z, own) {
      if (W.ints && W.ints.some(p => Math.hypot(x - (p.x == null ? p[0] : p.x), z - (p.z == null ? p[1] : p.z)) < 7)) return true;
      // Also covers intersections omitted from W.ints (curves and Market Street).
      return segs.some(s => {
        if (s === own) return false;
        const dx = s.bx - s.ax, dz = s.bz - s.az, t = U.clamp(((x - s.ax) * dx + (z - s.az) * dz) / (dx * dx + dz * dz), 0, 1);
        return Math.hypot(x - s.ax - dx * t, z - s.az - dz * t) < 7;
      });
    }
    function clear(x, z, s) {
      return !nearIntersection(x, z, s) && W.inLand(x, z, 1) && !W.parkAt(x, z) && !W.onRoad(x, z, .4) && !W.blockedAt(x, z, .6, W.terrainH(x, z) + .1);
    }
    const cafeDistricts = ['mission', 'nob', 'china', 'marina', 'haight'];
    const wireDistricts = ['fidi', 'soma', 'mission', 'haight', 'china', 'nob'];
    // Shuffle traversal deterministically so budgets do not favour one end of town.
    for (let i = segs.length - 1; i > 0; i--) { const j = Math.floor(rand(0, i + 1)); [segs[i], segs[j]] = [segs[j], segs[i]]; }
    for (const s of segs) {
      const len = Math.hypot(s.bx - s.ax, s.bz - s.az), dx = (s.bx - s.ax) / len, dz = (s.bz - s.az) / len, nx = -dz, nz = dx;
      const district = W.district((s.ax + s.bx) / 2, (s.az + s.bz) / 2), off = s.w / 2 + 2;
      const at = (d, o) => [s.ax + dx * d + nx * o, s.az + dz * d + nz * o];
      if (district === 'china') for (let d = 5; d < len - 3; d += rand(9, 11)) {
        const count = Math.floor(rand(5, 8)), steps = count + 1;
        if (!reserve('lantern', count * 2 + steps)) break;
        const a = at(d, -off), b = at(d, off), ya = W.terrainH(...a) + 6.4, yb = W.terrainH(...b) + 6.4;
        const point = t => [U.lerp(a[0], b[0], t), U.lerp(ya, yb, t) - .45 * Math.sin(Math.PI * t), U.lerp(a[1], b[1], t)];
        for (let i = 0; i < steps; i++) rod(cable, point(i / steps), point((i + 1) / steps), .018);
        for (let i = 1; i <= count; i++) {
          const p = point(i / steps); put(lantern, p[0], p[1] - .34, p[2], .39, .28, .39); put(trim, p[0], p[1] - .34, p[2]); stats.lanterns++;
        }
      }
      if (len > 40 && wireDistricts.includes(district)) {
        const spans = Math.ceil(len / 25), supports = [];
        for (let i = 0; i <= spans; i++) {
          const d = len * i / spans, p = at(d, off), center = at(d, 0);
          const h = W.terrainH(...center) + 7.5, y = W.terrainH(...p);
          const ok = W.inLand(...p, 1) && !W.parkAt(...p) && !W.onRoad(...p, .4) && !W.blockedAt(p[0], p[1], .6, y + .1) && h > y + 1;
          supports.push({ p, h, y, ok });
        }
        if (reserve('wire', spans * 4 + supports.length * 2)) {
          supports.forEach(({ p, h, y, ok }) => {
            if (!ok) return;
            const end = [p[0] - nx * 4.3, h, p[1] - nz * 4.3];
            rod(pole, [p[0], y, p[1]], [p[0], h + .15, p[1]], .085); rod(pole, [p[0], h, p[1]], end, .045);
            W.addCircle(p[0], p[1], .14, h + .15); W.perches.push({ x: p[0], y: h + .15, z: p[1], kind: 'wire' }); stats.wirePoles++;
            W.placements.push({ name: 'wire support', kind: 'prop', x: p[0], z: p[1], before: { water: false, gap: 0 }, after: { water: false, gap: 0 } });
          });
          for (let i = 0; i < spans; i++) for (const offset of [off - 2.8, off - 4]) {
            if (!supports[i].ok || !supports[i + 1].ok) continue;
            const a = at(len * i / spans, offset), b = at(len * (i + 1) / spans, offset);
            const v = [a[0], supports[i].h, a[1]], w = [b[0], supports[i + 1].h, b[1]];
            const mid = [(v[0] + w[0]) / 2, (v[1] + w[1]) / 2 - .12, (v[2] + w[2]) / 2]; rod(cable, v, mid, .018); rod(cable, mid, w, .018);
          }
        }
      }
      // Cafes are planned before furniture so a whole cluster can pass clearance.
      for (let d = rand(18, 48); d < len - 8; d += rand(54, 66)) {
        const side = rand(0, 1) < .5 ? -1 : 1, angle = Math.atan2(-nx * side, -nz * side), p = at(d, side * off);
        if (!cafeDistricts.includes(W.district(...p))) continue;
        const cs = Math.cos(angle), sn = Math.sin(angle), local = (x, z) => [p[0] + cs * x + sn * z, p[1] - sn * x + cs * z];
        const tables = [-1.7, 1.7].map(x => local(x, 0)), chairs = [-2.6, -.8, .8, 2.6].map(x => local(x, 0));
        if (![p, ...tables, ...chairs].every(q => clear(q[0], q[1], s)) || !reserve('cafe', 7)) continue;
        for (const q of tables) { const y = W.terrainH(...q); put(table, q[0], y, q[1]); W.addCircle(q[0], q[1], .6, y + 1.1); }
        chairs.forEach((q, i) => { const y = W.terrainH(...q); put(chair, q[0], y, q[1], 1, 1, 1, angle + (i % 2 ? -1 : 1) * Math.PI / 2); W.addCircle(q[0], q[1], .32, y + 1.12); });
        const y = W.terrainH(...p); put(umbrella, p[0], y, p[1], 1, 1, 1, angle); W.addCircle(p[0], p[1], .12, y + 3.07); stats.cafes++;
      }
      for (const side of [-1, 1]) for (let d = rand(8, 16); d < len - 7; d += rand(12, 20)) {
        const angle = Math.atan2(-nx * side, -nz * side), kind = Math.floor(rand(0, 6));
        const count = kind === 2 ? Math.floor(rand(2, 4)) : 1, spots = [];
        for (let i = 0; i < count; i++) spots.push(at(d + (i - (count - 1) / 2) * 1.05, side * off));
        if (!spots.every(q => clear(q[0], q[1], s)) || !reserve('furniture', count)) continue;
        spots.forEach((q, i) => {
          const y = W.terrainH(...q), b = [hydrant, bin, news, planter, rack, meter][kind];
          put(b, q[0], y, q[1], 1, 1, 1, angle);
          if (kind === 2) { if (!b.colors) b.colors = []; b.colors.push(new T.Color(['#3476b6', '#cb4540', yellow][i])); }
          W.addCircle(q[0], q[1], [.3, .45, .5, .6, .48, .2][kind], y + [1.1, 1.26, 1.35, 1.22, 1.28, 1.71][kind]); stats.furniture++;
        });
      }

    }
    for (const b of batches) {
      if (!b.matrices.length) { b.geo.dispose(); continue; }
      const mesh = new T.InstancedMesh(b.geo, b.mat, b.matrices.length); mesh.name = 'dressing: ' + b.name;
      b.matrices.forEach((m, i) => mesh.setMatrixAt(i, m));
      if (b.colors) { b.colors.forEach((c, i) => mesh.setColorAt(i, c)); mesh.instanceColor.needsUpdate = true; }
      mesh.instanceMatrix.needsUpdate = true; mesh.frustumCulled = false; mesh.castShadow = b.shadow; mesh.receiveShadow = true;
      scene.add(mesh); stats.drawCalls++;
    }
  } catch (e) { console.warn('K.dress: street dressing failed', e); }
};
} catch (e) { console.warn('K.dress: initialization failed', e); }
})(window.K);
