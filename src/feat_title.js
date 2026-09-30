/* feat_title.js — readable title sign. The extruded 3D letters were hard to read against the sunset (thin ink, halftone, overlapping
   subtitle plate), so the sign keeps its 3D marquee board but its lettering is painted crisply on a canvas: fat Titan One letters with a
   deep extrusion, thick ink outline and a separate subtitle ribbon underneath. Wraps UI.buildTitle (runs after the original). */
(function (K) {
const T = K.T, UI = K.UI;
function rr(g, x, y, w, h, r) { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }
function word(g, txt, x, y, size, face, side, depth) {
  g.font = `${size}px "Titan One", "Bangers", Impact, sans-serif`; g.textBaseline = 'alphabetic'; g.lineJoin = 'round';
  const d = Math.round(size * depth);
  for (let i = d; i > 0; i--) { g.fillStyle = side; g.fillText(txt, x + i * .55, y + i); }               // extrusion
  g.lineWidth = size * .16; g.strokeStyle = '#170c24'; g.strokeText(txt, x + d * .55, y + d);              // ink under the extrusion
  g.strokeText(txt, x, y);                                                                                   // ink outline
  const gr = g.createLinearGradient(0, y - size * .8, 0, y); face.forEach(([t, c]) => gr.addColorStop(t, c)); g.fillStyle = gr; g.fillText(txt, x, y);
  g.save(); g.beginPath(); g.rect(x - 20, y - size * .78, g.measureText(txt).width + 40, size * .2); g.clip(); g.fillStyle = 'rgba(255,255,255,.45)'; g.fillText(txt, x, y); g.restore();   // gloss band
  return g.measureText(txt).width;
}
function paint(W, H) {
  const c = document.createElement('canvas'); c.width = 2048; c.height = Math.round(2048 * H / W); const g = c.getContext('2d'), CW = c.width, CH = c.height;
  const big = CH * .42, small = big * .6;
  g.font = `${big}px "Titan One"`; const w1 = g.measureText('KYOTO').width; g.font = `${small}px "Titan One"`; const w2 = g.measureText('(KENS)').width;
  const gap = big * .06, total = w1 + gap + w2, x0 = (CW - total) / 2 - big * .05, base = CH * .56;
  word(g, 'KYOTO', x0, base, big, [[0, '#fffbe0'], [.45, '#ffd84a'], [1, '#ff9a1f']], '#b8421c', .09);
  word(g, '(KENS)', x0 + w1 + gap, base, small, [[0, '#ffe3f1'], [.5, '#ff6fb8'], [1, '#e83d8f']], '#7e1d57', .09);
  // subtitle ribbon, clearly below the letters
  const rw = CW * .56, rh = CH * .15, rx = (CW - rw) / 2, ry = CH * .7;
  g.fillStyle = '#170c24'; rr(g, rx - 10, ry - 8, rw + 20, rh + 24, rh * .45); g.fill();
  const rg = g.createLinearGradient(0, ry, 0, ry + rh); rg.addColorStop(0, '#39e0c8'); rg.addColorStop(1, '#12a391'); g.fillStyle = rg; rr(g, rx, ry, rw, rh, rh * .4); g.fill();
  g.fillStyle = 'rgba(255,255,255,.3)'; rr(g, rx + 14, ry + 8, rw - 28, rh * .28, rh * .14); g.fill();
  g.font = `${rh * .62}px "Titan One"`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.lineWidth = rh * .14; g.strokeStyle = '#170c24';
  g.strokeText('PACING THE FRONTIER', CW / 2, ry + rh * .54); g.fillStyle = '#fff6df'; g.fillText('PACING THE FRONTIER', CW / 2, ry + rh * .54);
  const t = new T.CanvasTexture(c); t.encoding = T.sRGBEncoding; t.anisotropy = 8; return t;
}
function build() {
  const logo = UI.logo; if (!logo) return;
  logo.updateMatrixWorld(true);
  const inv = logo.matrixWorld.clone().invert(), box = new T.Box3(), v = new T.Vector3();
  logo.traverse(o => { if (!o.isMesh || !o.geometry) return; const p = o.geometry.attributes.position; o.updateMatrixWorld(true);
    for (let i = 0; i < p.count; i += 7) { v.fromBufferAttribute(p, i).applyMatrix4(o.matrixWorld).applyMatrix4(inv); box.expandByPoint(v); } });
  if (box.isEmpty()) return;
  const size = box.getSize(new T.Vector3()), ctr = box.getCenter(new T.Vector3()), W = size.x, H = size.y;
  const sign = new T.Group(); sign.name = 'title_sign'; sign.position.copy(logo.position); sign.position.y -= .55; sign.quaternion.copy(logo.quaternion); sign.scale.copy(logo.scale).multiplyScalar(.92);   // a touch smaller + lower: the whole frame stays on screen
  const rrS = (w, h, r) => { const s = new T.Shape(), x = -w / 2, y = -h / 2; s.moveTo(x + r, y); s.lineTo(x + w - r, y); s.quadraticCurveTo(x + w, y, x + w, y + r); s.lineTo(x + w, y + h - r); s.quadraticCurveTo(x + w, y + h, x + w - r, y + h); s.lineTo(x + r, y + h); s.quadraticCurveTo(x, y + h, x, y + h - r); s.lineTo(x, y + r); s.quadraticCurveTo(x, y, x + r, y); return s; };
  const slab = (w, h, r, col, z, depth) => { const geo = depth ? new T.ExtrudeGeometry(rrS(w, h, r), { depth, bevelEnabled: true, bevelThickness: .06, bevelSize: .06, bevelSegments: 2, curveSegments: 10 }) : new T.ShapeGeometry(rrS(w, h, r), 10);
    const m = new T.Mesh(geo, depth ? [new T.MeshBasicMaterial({ color: col }), new T.MeshBasicMaterial({ color: new T.Color(col).multiplyScalar(.45) })] : new T.MeshBasicMaterial({ color: col })); m.position.set(ctr.x, ctr.y, box.max.z + z); sign.add(m); return m; };
  slab(W + .7, H + .7, 1.1, '#170c24', -.62);
  slab(W + .35, H + .35, .95, '#ffcf3f', -.5, .12);
  slab(W, H, .8, '#2a1747', -.3, .14);
  const glow = new T.Mesh(new T.PlaneGeometry(W * .9, H * .55), new T.MeshBasicMaterial({ color: '#5b3a9c', transparent: true, opacity: .35, depthWrite: false })); glow.position.set(ctr.x, ctr.y + H * .1, box.max.z - .05); sign.add(glow);
  const face = new T.Mesh(new T.PlaneGeometry(W * .97, H * .97), new T.MeshBasicMaterial({ map: paint(W, H), transparent: true, alphaTest: .02, depthWrite: false })); face.position.set(ctr.x, ctr.y, box.max.z - .02); face.renderOrder = 2; sign.add(face);
  const refresh = () => { face.material.map.dispose(); face.material.map = paint(W, H); face.material.needsUpdate = true; };
  if (document.fonts && document.fonts.load) document.fonts.load(`100px "Titan One"`).then(refresh).catch(() => {});
  // marquee bulbs around the frame (UI.update chases whatever is in UI.marquee)
  UI.marquee = []; const hw = (W + .35) / 2, hh = (H + .35) / 2, per = 4 * (hw + hh), n = Math.round(per / .72), bg = new T.SphereGeometry(.13, 8, 6);
  for (let i = 0; i < n; i++) { let t = i / n * per, x, y; if (t < 2 * hw) { x = -hw + t; y = hh; } else if ((t -= 2 * hw) < 2 * hh) { x = hw; y = hh - t; } else if ((t -= 2 * hh) < 2 * hw) { x = hw - t; y = -hh; } else { t -= 2 * hw; x = -hw; y = -hh + t; }
    const b = new T.Mesh(bg, new T.MeshBasicMaterial({ color: '#fff1a8' })); b.position.set(ctr.x + x, ctr.y + y, box.max.z - .25); sign.add(b); UI.marquee.push(b); }
  logo.visible = false; logo.parent.add(sign); UI.logo = sign; UI.titleSign = sign;
}
const orig = UI.buildTitle;
if (orig) UI.buildTitle = function () { const r = orig.apply(this, arguments); try { build(); } catch (e) { console.error('title sign', e); } return r; };
})(window.K);
