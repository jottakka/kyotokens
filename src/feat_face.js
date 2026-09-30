/* feat_face.js — a properly painted face for the Manager. The stock head had blank white glasses lenses (eyes hidden), a lumpy
   beard mesh and a ring for a mouth. This hides those bits and lays a hand-painted face decal (eyes, brows, nose shading, moustache,
   ginger beard, smile) over the REAL head triangles, so it hugs the head exactly and moves with it. While he speaks the mouth opens.
   Head-local units: +Z is forward, +Y up; face spans x ±.31, y -.15….47. */
(function (K) {
const T = K.T;
const W = 1024, H = 1024, X = x => (x + .34) / .68 * W, Y = y => (1 - (y + .18) / .66) * H, S = 1506;   // S = px per head unit
const INK = '#2a1a30';
function rng(seed) { let a = seed; return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
function beardPath(g, outlineOnly) {
  const edge = x => { const a = Math.abs(x); return a >= .262 ? .21 : a <= .115 ? .078 : .078 + (.21 - .078) * ((a - .115) / (.262 - .115)) ** 1.6; };   // where the beard starts (cheek line)
  g.beginPath();
  const pts = [[-.318, .215], [-.322, .02], [-.285, -.09], [-.17, -.168], [0, -.192], [.17, -.168], [.285, -.09], [.322, .02], [.318, .215]];
  g.moveTo(X(pts[0][0]), Y(pts[0][1]));
  for (let i = 1; i < pts.length; i++) { const p = pts[i], q = pts[i - 1]; g.quadraticCurveTo(X(q[0]), Y(q[1]) , X((p[0] + q[0]) / 2), Y((p[1] + q[1]) / 2)); }
  g.lineTo(X(pts[8][0]), Y(pts[8][1]));
  if (outlineOnly) return;
  for (let x = .30; x >= -.30; x -= .01) g.lineTo(X(x), Y(edge(x)));
  g.closePath();
}
function paint(talk) {
  return K.canvasTex(W, H, (g) => {
    g.clearRect(0, 0, W, H); g.lineJoin = 'round'; g.lineCap = 'round';
    const R = rng(7), ell = (x, y, rx, ry, fill, stroke, lw) => { g.beginPath(); g.ellipse(X(x), Y(y), rx * S, ry * S, 0, 0, 7); if (fill) { g.fillStyle = fill; g.fill(); } if (stroke) { g.lineWidth = lw; g.strokeStyle = stroke; g.stroke(); } };
    // warm cheeks + nose shading
    for (const s of [-1, 1]) { const gr = g.createRadialGradient(X(s * .175), Y(.085), 2, X(s * .175), Y(.085), .075 * S); gr.addColorStop(0, 'rgba(255,110,105,.42)'); gr.addColorStop(1, 'rgba(255,110,105,0)'); g.fillStyle = gr; g.fillRect(0, 0, W, H); }
    ell(0, .153, .033, .055, 'rgba(218,145,99,.32)'); ell(0, .102, .032, .012, 'rgba(139,77,52,.28)'); ell(-.008, .143, .007, .012, 'rgba(255,240,225,.22)');
    g.strokeStyle = 'rgba(120,60,45,.55)'; g.lineWidth = 7; for (const s of [-1, 1]) { g.beginPath(); g.moveTo(X(s * .022), Y(.098)); g.quadraticCurveTo(X(s * .034), Y(.09), X(s * .028), Y(.081)); g.stroke(); }
    // beard: ginger mass, hair clumps, ink outline
    g.save(); beardPath(g); g.clip();
    const bg = g.createLinearGradient(0, Y(.2), 0, Y(-.19)); bg.addColorStop(0, '#bd925f'); bg.addColorStop(.5, '#ae7c46'); bg.addColorStop(1, '#875b34'); g.fillStyle = bg; g.fillRect(0, 0, W, H);
    for (const s2 of [-1, 1]) { g.fillStyle = 'rgba(120,68,28,.35)'; g.beginPath(); g.ellipse(X(s2 * .2), Y(-.07), .085 * S, .05 * S, s2 * .5, 0, 7); g.fill(); g.fillStyle = 'rgba(255,214,140,.28)'; g.beginPath(); g.ellipse(X(s2 * .14), Y(.0), .05 * S, .028 * S, s2 * -.4, 0, 7); g.fill(); }
    g.fillStyle = 'rgba(255,214,140,.22)'; g.beginPath(); g.ellipse(X(0), Y(-.12), .11 * S, .03 * S, 0, 0, 7); g.fill();
    for (let i = 0; i < 50; i++) { const x = -.32 + R() * .64, y = -.2 + R() * .42, l = .022 + R() * .034, a = (Math.PI / 2) + (x * 1.4) + (R() - .5) * .5, light = R() > .55;
      g.strokeStyle = light ? 'rgba(248,212,140,.22)' : 'rgba(120,70,30,.18)'; g.lineWidth = (.002 + R() * .002) * S; g.beginPath(); g.moveTo(X(x), Y(y)); g.quadraticCurveTo(X(x + Math.cos(a) * l * .5 + .006), Y(y - Math.sin(a) * l * .5), X(x + Math.cos(a) * l), Y(y - Math.sin(a) * l)); g.stroke(); }
    g.restore();
    beardPath(g, true); g.lineWidth = 8; g.strokeStyle = INK; g.stroke();
    // mouth window: skin shows through, then lips + interior
    g.save(); g.globalCompositeOperation = 'destination-out'; ell(0, -.006, talk ? .056 : .066, talk ? .034 : .03, '#000'); g.restore();
    if (talk) {
      g.beginPath(); g.ellipse(X(0), Y(-.006), .056 * S, .034 * S, 0, 0, 7); g.fillStyle = '#5e1626'; g.fill();
      g.save(); g.beginPath(); g.ellipse(X(0), Y(-.006), .056 * S, .034 * S, 0, 0, 7); g.clip();
      g.fillStyle = '#fff8ea'; g.fillRect(X(-.07), Y(.03), .14 * S, .02 * S);              // upper teeth
      ell(0, -.04, .04, .022, '#e2707f'); g.restore();                                       // tongue
      g.lineWidth = 4; g.strokeStyle = INK; g.beginPath(); g.ellipse(X(0), Y(-.006), .056 * S, .034 * S, 0, 0, 7); g.stroke();
    } else {
      const sm = () => { g.beginPath(); g.moveTo(X(-.065), Y(.012)); g.quadraticCurveTo(X(0), Y(-.05), X(.065), Y(.012)); g.quadraticCurveTo(X(0), Y(.002), X(-.065), Y(.012)); g.closePath(); };
      sm(); g.fillStyle = '#5e1626'; g.fill(); g.save(); sm(); g.clip(); g.fillStyle = '#fff8ea'; g.fillRect(X(-.05), Y(.011), .1 * S, .011 * S); g.restore();
      g.lineWidth = 3.5; g.strokeStyle = INK; sm(); g.stroke();
      for (const s of [-1, 1]) { g.beginPath(); g.moveTo(X(s * .068), Y(.014)); g.lineTo(X(s * .078), Y(.024)); g.stroke(); }
    }
    // moustache: two curled lobes
    for (const s of [-1, 1]) {
      g.beginPath(); g.moveTo(X(0), Y(.082)); g.bezierCurveTo(X(s * 0.0425), Y(.1), X(s * 0.1020), Y(.088), X(s * 0.1275), Y(.045)); g.bezierCurveTo(X(s * 0.1173), Y(.032), X(s * 0.0935), Y(.038), X(s * 0.0765), Y(.05)); g.bezierCurveTo(X(s * 0.0425), Y(.06), X(s * 0.0170), Y(.052), X(0), Y(.05)); g.closePath();
      const mg = g.createLinearGradient(0, Y(.1), 0, Y(.03)); mg.addColorStop(0, '#ae7c46'); mg.addColorStop(1, '#875b34'); g.fillStyle = mg; g.fill(); g.lineWidth = .0015 * S; g.strokeStyle = '#79502f'; g.stroke();
      g.strokeStyle = 'rgba(255,214,140,.35)'; g.lineWidth = 4; for (let i = 0; i < 4; i++) { g.beginPath(); g.moveTo(X(s * (0.0170 + i * 0.0221)), Y(.078 - i * .004)); g.lineTo(X(s * (0.0255 + i * 0.0255)), Y(.05 - i * .003)); g.stroke(); }
    }
    // eyes: big friendly toon eyes with catch-lights, lids and brows
    for (const s of [-1, 1]) {
      const ex = s * .097, ey = .203;
      ell(ex, ey, .052, .036, '#fffdf6', INK, 8);
      g.save(); g.beginPath(); g.ellipse(X(ex), Y(ey), .052 * S, .036 * S, 0, 0, 7); g.clip(); ell(ex + s * -.004, ey - .002, .021, .023, '#2f6a9c'); ell(ex + s * -.004, ey - .002, .021, .023, null, '#1a3b5e', 4);
      ell(ex + s * -.004, ey - .004, .011, .012, '#0d0f16'); ell(ex + .006, ey + .004, .0055, .0055, '#ffffff');
      g.fillStyle = 'rgba(226,170,130,.95)'; g.fillRect(X(ex - .06), Y(ey + .04), .12 * S, .014 * S); g.restore();   // upper lid overlaps the iris
      g.lineWidth = .006 * S; g.strokeStyle = INK; g.beginPath(); g.ellipse(X(ex), Y(ey), .055 * S, .04 * S, 0, Math.PI * 1.06, Math.PI * 1.94); g.stroke();   // upper lid
      g.lineWidth = 5; g.strokeStyle = 'rgba(120,60,45,.55)'; g.beginPath(); g.ellipse(X(ex), Y(ey), .056 * S, .048 * S, 0, .25, Math.PI - .25); g.stroke();   // lower lid crease
      g.strokeStyle = '#9a5a26'; g.lineWidth = .011 * S; g.beginPath(); g.moveTo(X(s * .150), Y(.246)); g.quadraticCurveTo(X(s * .100), Y(.267), X(s * .047), Y(.251)); g.stroke();   // brow
    }
  });
}
/* Rectangular glasses built to sit around the painted eyes: dark frames, clear tinted lenses, bridge and temples. */
function glasses() {
  const g = new T.Group(), frame = K.toon('#2a2733'), lens = new T.MeshBasicMaterial({ color: '#bfe4ff', transparent: true, opacity: .16, depthWrite: false, side: T.DoubleSide });
  const rr = (w, h, r) => { const sh = new T.Shape(), x = -w / 2, y = -h / 2; sh.moveTo(x + r, y); sh.lineTo(x + w - r, y); sh.quadraticCurveTo(x + w, y, x + w, y + r); sh.lineTo(x + w, y + h - r); sh.quadraticCurveTo(x + w, y + h, x + w - r, y + h); sh.lineTo(x + r, y + h); sh.quadraticCurveTo(x, y + h, x, y + h - r); sh.lineTo(x, y + r); sh.quadraticCurveTo(x, y, x + r, y); return sh; };
  const ow = .152, oh = .1, t = .017, z = .292, ey = .205, ex = .097;
  for (const s of [-1, 1]) {
    const ring = rr(ow, oh, .028); ring.holes.push(new T.Path(rr(ow - t * 2, oh - t * 2, .018).getPoints(12).reverse()));
    const fm = new T.Mesh(new T.ExtrudeGeometry(ring, { depth: .014, bevelEnabled: false, curveSegments: 8 }), frame); fm.position.set(s * ex, ey, z); g.add(fm);
    const lm = new T.Mesh(new T.ShapeGeometry(rr(ow - t * 2, oh - t * 2, .018), 8), lens); lm.position.set(s * ex, ey, z + .006); g.add(lm);
    const arm = new T.Mesh(new T.BoxGeometry(.012, .014, .3), frame); arm.position.set(s * (ex + ow / 2 + .005), ey + .03, z - .15); arm.rotation.y = s * -.2; g.add(arm);
  }
  const bridge = new T.Mesh(new T.BoxGeometry(.05, .014, .014), frame); bridge.position.set(0, ey + .022, z + .007); g.add(bridge);
  return g;
}
function faceLift(rig) {
  const root = rig.root, head = root.getObjectByName('head'); if (!head) return;
  root.updateMatrixWorld(true);
  const body = []; root.traverse(o => { if (o.isSkinnedMesh && o.parent && o.parent.name === 'Body' && [].concat(o.material).some(m => m.name === 'h_skin')) body.push(o); });
  if (!body[0]) return;
  const mesh = body[0], g = mesh.geometry, p = g.attributes.position, si = g.attributes.skinIndex, sw = g.attributes.skinWeight, idx = g.index, bones = mesh.skeleton.bones, v = new T.Vector3();
  const local = [], ok = [];
  for (let i = 0; i < p.count; i++) {
    const w = [sw.getX(i), sw.getY(i), sw.getZ(i), sw.getW(i)], b = [si.getX(i), si.getY(i), si.getZ(i), si.getW(i)], m = Math.max(...w);
    ok[i] = m > .6 && /head/.test(bones[b[w.indexOf(m)]].name);
    v.fromBufferAttribute(p, i); mesh.boneTransform(i, v); v.applyMatrix4(mesh.matrixWorld); head.worldToLocal(v); local[i] = v.clone();
  }
  const pos = [], uv = [], remap = new Map(), ind = [];
  const use = i => { if (!remap.has(i)) { remap.set(i, pos.length / 3); const q = local[i]; pos.push(q.x, q.y, q.z); uv.push((q.x + .34) / .68, (q.y + .18) / .66); } return remap.get(i); };
  for (let t = 0; t < idx.count; t += 3) {
    const a = idx.getX(t), b = idx.getX(t + 1), c = idx.getX(t + 2); if (!(ok[a] && ok[b] && ok[c])) continue;
    const A = local[a], B = local[b], C = local[c], cx = (A.x + B.x + C.x) / 3, cy = (A.y + B.y + C.y) / 3, cz = (A.z + B.z + C.z) / 3;
    if (cz < .02 || cy < -.19 || cy > .47 || Math.abs(cx) > .33) continue;
    ind.push(use(a), use(b), use(c));
  }
  if (!ind.length) return;
  const geo = new T.BufferGeometry(); geo.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); geo.setAttribute('uv', new T.Float32BufferAttribute(uv, 2)); geo.setIndex(ind); geo.computeVertexNormals();
  const n = geo.attributes.normal, q = geo.attributes.position; for (let i = 0; i < q.count; i++) q.setXYZ(i, q.getX(i) + n.getX(i) * .006, q.getY(i) + n.getY(i) * .006, q.getZ(i) + n.getZ(i) * .006);
  const tex = { calm: paint(false), talk: paint(true) };
  const mat = K.toon('#ffffff', { map: tex.calm, transparent: true, alphaTest: .02, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
  const own = mat.clone(); own.gradientMap = mat.gradientMap;
  const decal = new T.Mesh(geo, own); decal.name = 'manager_face'; decal.renderOrder = 1; head.add(decal);
  // stock eyes / brows / mouth / lumpy beard out; glasses lenses turn clear so the painted eyes read
  root.traverse(o => {
    if (o.isMesh && o.parent && o.parent.name === 'Body' && [].concat(o.material).some(m => /^h_(eye_w|eye_b|white|hair|mouth)$/.test(m.name))) o.visible = false;
  });
  const beard = root.getObjectByName('acc_beard_short'); if (beard && beard.parent) beard.parent.remove(beard);
  const gl = root.getObjectByName('acc_glasses_rect'); if (gl && gl.parent) gl.parent.remove(gl);
  head.add(glasses());
  // hair peeking out under the beanie at the back and sides
  const hair = new T.Group(), hm = K.toon('#c98a45'), arc = new T.Mesh(new T.TorusGeometry(.292, .024, 8, 24, Math.PI * 1.55), hm); arc.rotation.x = Math.PI / 2; arc.rotation.z = Math.PI * .725; arc.position.set(0, .225, -.03); hair.add(arc);
  K.inkShell && K.inkShell(hair, .004); head.add(hair);
  rig.face = { decal, mat: own, tex, talk: false };
}
K.faceLift = faceLift;
K.on('build', () => { const b = K.A.boss; if (b && b.rig && !b.rig.face) { try { faceLift(b.rig); } catch (e) { console.error('faceLift', e); } } });
K.on('frame', () => {
  const b = K.A.boss, f = b && b.rig && b.rig.face; if (!f) return;
  const talking = !!(b.tag && b.tag.bt > 0 && (Math.floor(K.game.time * 7) % 2 === 0 || K.game.state !== 'play'));
  if (talking !== f.talk) { f.talk = talking; f.mat.map = talking ? f.tex.talk : f.tex.calm; f.mat.needsUpdate = true; }
});
})(window.K);
