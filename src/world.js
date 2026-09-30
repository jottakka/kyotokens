/* KYOTO(KENS) — world: geography, terrain, roads, districts, landmarks, sky, water, collision, nav */
'use strict';
(function (K) {
const T = K.T, U = K.U, scene = K.scene;
const W = K.W = {};

/* ================= GEOGRAPHY ================= */
// Coastline: the old downtown island (x -262..258, z -212..272) keeps its outline; the city now runs west to Ocean Beach and south to Candlestick Point.
const SHORE = W.SHORE = [
  [-262, -212], [110, -212], [180, -186], [258, -150],
  [258, 330], [268, 380], [278, 430], [271, 470], [258, 502], [238, 540], [212, 570], [170, 590],
  [60, 596], [-80, 590], [-240, 598], [-420, 592], [-600, 598], [-792, 592],
  [-792, -20], [-780, -42], [-764, -58], [-728, -72], [-680, -80], [-640, -92], [-592, -100], [-546, -118], [-512, -146], [-492, -176], [-470, -200], [-440, -212], [-380, -216], [-320, -214],
];
W.RECTS = [
  { x0: 64, x1: 104, z0: -292, z1: -205, name: 'pier39' },
  { x0: 128, x1: 140, z0: -250, z1: -198 }, { x0: 160, x1: 172, z0: -240, z1: -188 }, { x0: 196, x1: 208, z0: -225, z1: -170 },
  { x0: 252, x1: 300, z0: -60, z1: -48 }, { x0: 252, x1: 300, z0: 18, z1: 30 }, { x0: 252, x1: 292, z0: 62, z1: 74 },
  { x0: 252, x1: 296, z0: 300, z1: 312 }, { x0: 264, x1: 310, z0: 388, z1: 400 }, { x0: 260, x1: 304, z0: 478, z1: 492, name: 'crane' },
  { x0: -240, x1: -220, z0: -472, z1: -205, name: 'bridge' },
  { x0: -300, x1: -150, z0: -545, z1: -466, name: 'marin' },
];
W.XR = [-710, -650, -590, -530, -470, -410, -350, -290, -230, -170, -110, -50, 10, 70, 130, 190, 250];
W.ZR = [-200, -140, -80, -20, 40, 100, 160, 220, 280, 340, 400, 460, 520, 580];
W.MKT = { a: new T.Vector2(236, -110), d: new T.Vector2(-408, 362).normalize(), w: 22, len: 520 };
W.STAD = { x: 210, z: 150, r0: 34, r1: 44, gate: -Math.PI * 0.75 };
W.HILLS = [
  { x: 40, z: -165, r: 34, h: 20, n: 'Telegraph Hill' }, { x: -78, z: -152, r: 44, h: 22, n: 'Russian Hill' }, { x: -15, z: -70, r: 50, h: 17, n: 'Nob Hill' },
  { x: -150, z: -112, r: 52, h: 12, n: 'Pacific Heights' }, { x: -205, z: -88, r: 42, h: 10 }, { x: -140, z: 10, r: 24, h: 8, n: 'Alamo Square' },
  { x: -150, z: 214, r: 58, h: 40, n: 'Twin Peaks' }, { x: -118, z: 240, r: 40, h: 30 }, { x: -46, z: 190, r: 30, h: 10, n: 'Dolores Park' },
  { x: 140, z: 236, r: 46, h: 12, n: 'Potrero Hill' }, { x: -205, z: 170, r: 36, h: 22, n: 'Mt Sutro' },
  { x: -360, z: -132, r: 66, h: 12, n: 'Presidio' }, { x: -448, z: -104, r: 40, h: 9 },
  { x: -690, z: -64, r: 48, h: 13, n: 'Lands End' }, { x: -566, z: -98, r: 34, h: 8, n: 'Sea Cliff' }, { x: -772, z: -40, r: 26, h: 9 },
  { x: -320, z: 10, r: 36, h: 15, n: 'Lone Mountain' }, { x: -380, z: 250, r: 42, h: 18, n: 'Grand View' }, { x: -292, z: 300, r: 38, h: 12, n: 'Forest Hill' },
  { x: -210, z: 360, r: 60, h: 36, n: 'Mt Davidson' }, { x: -140, z: 430, r: 42, h: 10, n: 'Glen Park' },
  { x: 40, z: 370, r: 56, h: 26, n: 'Bernal Heights' }, { x: 70, z: 515, r: 60, h: 16, n: 'McLaren Park' }, { x: 200, z: 540, r: 36, h: 16, n: 'Bayview Hill' },
];
W.LAKES = [
  { x: -330, z: 122, rx: 30, rz: 17, irx: 13, irz: 7, n: 'Stow Lake' }, { x: -560, z: 70, rx: 20, rz: 11, n: 'Spreckels Lake' },
  { x: -660, z: 128, rx: 18, rz: 10, n: 'Middle Lake' }, { x: -612, z: 490, rx: 66, rz: 44, n: 'Lake Merced' },
];
function inPoly(x, z) { let c = false; for (let i = 0, j = SHORE.length - 1; i < SHORE.length; j = i++) { const [xi, zi] = SHORE[i], [xj, zj] = SHORE[j]; if (((zi > z) !== (zj > z)) && (x < (xj - xi) * (z - zi) / (zj - zi) + xi)) c = !c; } return c; }
function inLakeOne(l, x, z) { const u = (x - l.x) / l.rx, v = (z - l.z) / l.rz; if (u * u + v * v >= 1) return false; if (!l.irx) return true; const a = (x - l.x) / l.irx, b = (z - l.z) / l.irz; return a * a + b * b >= 1; }
const inLake = (x, z) => W.LAKES.some(l => inLakeOne(l, x, z));
const landAt = W.landAt = (x, z) => inPoly(x, z) && !inLake(x, z);
function inRect(x, z, p) { for (const r of W.RECTS) if (x >= r.x0 + p && x <= r.x1 - p && z >= r.z0 + p && z <= r.z1 - p) return r; return null; }
/* land raster (2-unit cells): 1 = land at least LR.M from any shore, 0 = water with the same margin, 2 = boundary band (exact test); plus distance to water for coastal bluffs */
const LR = { x0: -820, z0: -240, cs: 2, M: 2.5, nx: 580, nz: 430 };
let LRA = null, LRD = null;
function landRaster() {
  if (LRA) return;
  const { x0, z0, cs, nx, nz } = LR, a = LRA = new Uint8Array(nx * nz), n = SHORE.length, N = nx * nz;
  for (let j = 0; j < nz; j++) { const z = z0 + (j + .5) * cs, xs = [];
    for (let i = 0, k = n - 1; i < n; k = i++) { const [xi, zi] = SHORE[i], [xk, zk] = SHORE[k]; if ((zi > z) !== (zk > z)) xs.push(xi + (z - zi) * (xk - xi) / (zk - zi)); }
    xs.sort((p, q) => p - q);
    for (let k = 0; k + 1 < xs.length; k += 2) for (let i = Math.max(0, Math.ceil((xs[k] - x0) / cs - .5)), i1 = Math.min(nx - 1, Math.floor((xs[k + 1] - x0) / cs - .5)); i <= i1; i++) a[j * nx + i] = 1; }
  for (const l of W.LAKES) for (let j = Math.max(0, Math.floor((l.z - l.rz - z0) / cs)); j <= Math.min(nz - 1, Math.floor((l.z + l.rz - z0) / cs)); j++) for (let i = Math.max(0, Math.floor((l.x - l.rx - x0) / cs)); i <= Math.min(nx - 1, Math.floor((l.x + l.rx - x0) / cs)); i++) if (inLakeOne(l, x0 + (i + .5) * cs, z0 + (j + .5) * cs)) a[j * nx + i] = 0;
  const d = LRD = new Float32Array(N); for (let c = 0; c < N; c++) d[c] = a[c] ? 1e6 : 0;   // chamfer distance to water, in cells
  for (let j = 1; j < nz; j++) for (let i = 1; i < nx - 1; i++) { const c = j * nx + i; if (d[c]) d[c] = Math.min(d[c], d[c - 1] + 1, d[c - nx] + 1, d[c - nx - 1] + 1.414, d[c - nx + 1] + 1.414); }
  for (let j = nz - 2; j >= 0; j--) for (let i = nx - 2; i > 0; i--) { const c = j * nx + i; if (d[c]) d[c] = Math.min(d[c], d[c + 1] + 1, d[c + nx] + 1, d[c + nx + 1] + 1.414, d[c + nx - 1] + 1.414); }
  const R = LR.M + cs + .5, mark = (x, z) => { for (let j = Math.max(0, Math.floor((z - R - z0) / cs)), j1 = Math.min(nz - 1, Math.floor((z + R - z0) / cs)); j <= j1; j++) for (let i = Math.max(0, Math.floor((x - R - x0) / cs)), i1 = Math.min(nx - 1, Math.floor((x + R - x0) / cs)); i <= i1; i++) a[j * nx + i] = 2; };
  for (let i = 0, k = n - 1; i < n; k = i++) { const [ax, az] = SHORE[k], [bx, bz] = SHORE[i], m = Math.ceil(Math.hypot(bx - ax, bz - az)); for (let s = 0; s <= m; s++) mark(ax + (bx - ax) * s / m, az + (bz - az) * s / m); }
  for (const l of W.LAKES) for (const [rx, rz] of l.irx ? [[l.rx, l.rz], [l.irx, l.irz]] : [[l.rx, l.rz]]) { const m = Math.ceil(Math.PI * (rx + rz)); for (let s = 0; s < m; s++) { const t = s / m * Math.PI * 2; mark(l.x + Math.cos(t) * rx, l.z + Math.sin(t) * rz); } }
}
const rasterAt = (x, z) => { landRaster(); const i = Math.floor((x - LR.x0) / LR.cs), j = Math.floor((z - LR.z0) / LR.cs); return i >= 0 && j >= 0 && i < LR.nx && j < LR.nz ? LRA[j * LR.nx + i] : 0; };
W.inLand = function (x, z, p) {
  p = p || 0;
  const v = p <= LR.M ? rasterAt(x, z) : 2;
  if (v === 1) return true;
  const inside = v === 0 ? (a, b) => !!inRect(a, b, 0) : (a, b) => landAt(a, b) || !!inRect(a, b, 0);
  if (!inside(x, z)) return false;
  if (p > 0) for (let i = 0; i < 16; i++) { const a = i * Math.PI / 8; if (!inside(x + Math.cos(a) * p, z + Math.sin(a) * p)) return false; }
  return true;
};
W.bridgeH = function (z) { const d = -z; if (d < 206) return 0; if (d < 250) return 16 * U.smooth((d - 206) / 44); if (d < 425) return 16; if (d < 468) return 16 * U.smooth((468 - d) / 43); return 0; };
const HGS = 48, NOHILL = []; let HGRID = null;
W.hillH = function (x, z) {
  if (!HGRID) { HGRID = new Map(); for (const k of W.HILLS) for (let i = Math.floor((k.x - k.r) / HGS); i <= Math.floor((k.x + k.r) / HGS); i++) for (let j = Math.floor((k.z - k.r) / HGS); j <= Math.floor((k.z + k.r) / HGS); j++) { const q = i * 4096 + j; if (!HGRID.has(q)) HGRID.set(q, []); HGRID.get(q).push(k); } }
  let h = 0; for (const k of HGRID.get(Math.floor(x / HGS) * 4096 + Math.floor(z / HGS)) || NOHILL) { const dx = x - k.x, dz = z - k.z, q = (dx * dx + dz * dz) / (k.r * k.r); if (q < 1) { const v = k.h * (1 - q) * (1 - q); if (v > h) h = v; } }
  return h;
};
W.coastK = function (x, z) {   // hills ease down to sea level within ~12 units of the water: coastal bluffs, no floating over the surf
  landRaster(); const fx = (x - LR.x0) / LR.cs - .5, fz = (z - LR.z0) / LR.cs - .5, i = Math.floor(fx), j = Math.floor(fz); if (i < 0 || j < 0 || i >= LR.nx - 1 || j >= LR.nz - 1) return 0;
  const u = fx - i, v = fz - j, n = LR.nx, c = j * n + i, D = LRD, d = (D[c] * (1 - u) + D[c + 1] * u) * (1 - v) + (D[c + n] * (1 - u) + D[c + n + 1] * u) * v;
  return U.smooth((d * LR.cs - 1.5) / 11);
};
const lakeSD = (l, x, z) => { let sd = (1 - Math.hypot((x - l.x) / l.rx, (z - l.z) / l.rz)) * Math.min(l.rx, l.rz); if (l.irx) sd = Math.min(sd, (Math.hypot((x - l.x) / l.irx, (z - l.z) / l.irz) - 1) * Math.min(l.irx, l.irz)); return sd; };   // > 0 in the water
W.terrainH = function (x, z) {
  let h = W.hillH(x, z);
  if (h > 0) h *= W.coastK(x, z);
  for (const l of W.LAKES) if (Math.abs(x - l.x) < l.rx + 3 && Math.abs(z - l.z) < l.rz + 3) { const b = U.clamp(-1.6 - lakeSD(l, x, z) * .9, -3.2, 0); if (b < h) h = b; }   // banks slope down to the waterline
  if (x > -242 && x < -218 && z < -200 && z > -472) { const b = W.bridgeH(z); if (b > h) h = b; }
  return h;
};
/* rendered terrain grid (4-unit cells); walkable ground never sits below the drawn mesh */
const TG = W.TG = { x0: -812, z0: -236, cs: 4, nx: 284, nz: 212 };
let HF = null;
W.meshH = function (x, z) {
  if (!HF) return -1e9; const fx = (x - TG.x0) / TG.cs, fz = (z - TG.z0) / TG.cs, i = Math.floor(fx), j = Math.floor(fz); if (i < 0 || j < 0 || i >= TG.nx || j >= TG.nz) return -1e9;
  const u = fx - i, v = fz - j, w = TG.nx + 1, a = HF[j * w + i], b = HF[(j + 1) * w + i], c = HF[(j + 1) * w + i + 1], d = HF[j * w + i + 1];
  return u + v <= 1 ? a + (d - a) * u + (b - a) * v : c + (b - c) * (1 - u) + (d - c) * (1 - v);
};
W.groundH = (x, z) => Math.max(W.terrainH(x, z), W.meshH(x, z));
W.mktDist = function (x, z) { const px = x - W.MKT.a.x, pz = z - W.MKT.a.y; const t = px * W.MKT.d.x + pz * W.MKT.d.y; return { d: Math.abs(px * W.MKT.d.y - pz * W.MKT.d.x), t }; };
W.onMarket = (x, z, pad) => { const m = W.mktDist(x, z); return m.t > -5 && m.t < W.MKT.len && m.d < W.MKT.w / 2 + (pad || 0); };

/* ================= RESERVATIONS / PARKS ================= */
// none: no grid streets inside; trees/dens: park planting for decorate()
W.PARKS = [
  { x0: -700, x1: -172, z0: 50, z1: 148, n: 'Golden Gate Park', col: '#6fbf57' },
  { x0: -64, x1: -26, z0: 168, z1: 214, n: 'Dolores Park', col: '#79c85a' },
  { x0: -162, x1: -120, z0: -8, z1: 34, n: 'Alamo Square', col: '#74c257' },
  { x0: 22, x1: 58, z0: -8, z1: 28, n: 'Union Square', col: '#e9cfa8', plaza: true },
  { x0: 16, x1: 64, z0: -188, z1: -146, n: 'Telegraph Hill', col: '#72b957' },
  { x0: -215, x1: -165, z0: -195, z1: -148, n: 'Palace of Fine Arts', col: '#79c85a' },
  { x0: -196, x1: -106, z0: 176, z1: 262, n: 'Twin Peaks', col: '#d9b45a' },
  { x0: -232, x1: -176, z0: 150, z1: 196, n: 'Mt Sutro', col: '#5aa850' },
  { x0: -164, x1: -116, z0: 46, z1: 94, n: 'Panhandle', col: '#74c257', trees: ['tree_plane', 'tree_ficus', 'cypress'], dens: 55 },
  { x0: -446, x1: -238, z0: -216, z1: -190, n: 'Crissy Field', col: '#8fd46a', none: 1, trees: ['palm_canary'], dens: 420 },
  { x0: -496, x1: -238, z0: -190, z1: -88, n: 'Presidio', col: '#5aa04c', none: 1, trees: ['cypress', 'cypress', 'tree_plane', 'tree_ficus'], dens: 34 },
  { x0: -800, x1: -590, z0: -120, z1: -26, n: 'Lands End', col: '#6fae55', none: 1, trees: ['cypress', 'cypress', 'tree_plane'], dens: 42 },
  { x0: -800, x1: -718, z0: -26, z1: 600, n: 'Ocean Beach', col: '#f4dca6', none: 1, beach: 1, dens: 0 },
  { x0: -404, x1: -356, z0: 226, z1: 274, n: 'Grand View', col: '#7cc25a', trees: ['cypress'], dens: 110 },
  { x0: -262, x1: -158, z0: 306, z1: 412, n: 'Mt Davidson', col: '#4f9a45', none: 1, trees: ['cypress', 'tree_ficus', 'cypress', 'tree_plane'], dens: 36 },
  { x0: -164, x1: -116, z0: 406, z1: 454, n: 'Glen Canyon', col: '#79c85a', trees: ['tree_plane', 'cypress'], dens: 55 },
  { x0: 16, x1: 64, z0: 346, z1: 394, n: 'Bernal Heights', col: '#d9b45a', trees: ['cypress'], dens: 700 },
  { x0: 16, x1: 124, z0: 466, z1: 574, n: 'McLaren Park', col: '#6fbf57', none: 1, trees: ['tree_plane', 'cypress', 'tree_ficus'], dens: 62 },
  { x0: -704, x1: -536, z0: 406, z1: 600, n: 'Lake Merced', col: '#7cc25a', none: 1, trees: ['cypress', 'tree_plane'], dens: 95 },
];
W.RES = [ // landmark sites (no kit buildings)
  { x: 95, z: -110, r: 18 }, { x: 115, z: -40, r: 16 }, { x: 175, z: 12, r: 16 }, { x: 244, z: -110, r: 30 },
  { x: W.STAD.x, z: W.STAD.z, r: W.STAD.r1 + 6 }, { x: 232, z: 212, r: 30 }, { x: -110, z: 40, r: 2 },
];
W.NOTREE = [{ x0: -376, x1: -276, z0: -164, z1: -84 }, { x0: -632, x1: -584, z0: 104, z1: 144 }];   // Presidio Main Post lawn, bison paddock
W.parkAt = (x, z) => W.PARKS.find(p => x >= p.x0 && x <= p.x1 && z >= p.z0 && z <= p.z1);
W.reserved = (x, z, r) => W.RES.some(c => Math.hypot(x - c.x, z - c.z) < c.r + (r || 0)) || !!W.parkAt(x, z);

/* Ground-support registry: all kit instances and ground landmarks are audited before
 * correction and after placement. Footprints sample the whole support area at <=1m,
 * including the drawn terrain (not only the analytic hill at the object origin).
 * Suspended signs, bridge decks and island landmarks have explicit support owners. */
W.placements = []; W.foundationParts = []; W.perches = [];
W.sampleFootprint = function (b, x, z, ry, sx, sz) {
  const nx = Math.max(1, Math.ceil((b.max.x - b.min.x) * sx)), nz = Math.max(1, Math.ceil((b.max.z - b.min.z) * sz));
  let low = Infinity, high = -Infinity, water = 0;
  const c = Math.cos(ry), s = Math.sin(ry);
  for (let i = 0; i <= nx; i++) for (let j = 0; j <= nz; j++) {
    const lx = (b.min.x + (b.max.x - b.min.x) * i / nx) * sx, lz = (b.min.z + (b.max.z - b.min.z) * j / nz) * sz;
    const px = x + c * lx + s * lz, pz = z - s * lx + c * lz;
    const h = W.terrainH(px, pz), mh = W.meshH(px, pz);
    low = Math.min(low, h, mh > -100 ? mh : h); high = Math.max(high, h, mh > -100 ? mh : h);
    if (!W.inLand(px, pz, 0) || (mh > -100 && mh < -1.5 && !inRect(px, pz, 0))) water++;
  }
  return { low, high, water };
};
W.supportPlacement = function (name, b, it, kind, options) {
  W._placementMove = null;
  const opt = options || {}, before = W.sampleFootprint(b, it.x, it.z, it.ry || 0, it.sx || 1, it.sz || 1);
  const base = it.y + b.min.y * (it.sy || 1), old = { x: it.x, y: it.y, z: it.z };
  let sample = before, removed = false;
  if (before.water && !opt.deck) {
    let found = false;
    for (let radius = 1; radius <= 18 && !found; radius++) for (let a = 0; a < 16; a++) {
      const x = old.x + Math.cos(a * Math.PI / 8) * radius, z = old.z + Math.sin(a * Math.PI / 8) * radius;
      if (W.onRoad(x, z, .7) || W.blockedAt(x, z, .8, W.terrainH(x, z) + .1)) continue;
      const q = W.sampleFootprint(b, x, z, it.ry || 0, it.sx || 1, it.sz || 1);
      if (q.water) continue;
      if (kind === 'building') {
        let blocked = false; const c = Math.cos(it.ry || 0), sn = Math.sin(it.ry || 0);
        for (const u of [0, .5, 1]) for (const v of [0, .5, 1]) { const lx = (b.min.x + (b.max.x - b.min.x) * u) * (it.sx || 1), lz = (b.min.z + (b.max.z - b.min.z) * v) * (it.sz || 1), px = x + c * lx + sn * lz, pz = z - sn * lx + c * lz; if (W.blockedAt(px, pz, .15, W.terrainH(px, pz) + .1)) blocked = true; }
        if (blocked) continue;
      }
      it.x = x; it.z = z; sample = q; found = true; break;
    }
    if (!found) removed = true;
  }
  // Keep existing sunk foundations; raise buried hill houses to a usable ground floor.
  let bottom = base;
  if (!removed && !opt.deck) {
    bottom = sample.high - (kind === 'building' ? .12 : .025);
    it.y = bottom - b.min.y * (it.sy || 1);
  }
  const foundation = !removed && !opt.deck && bottom - sample.low > .09;
  if (foundation) {
    const depth = bottom - sample.low + .2, c = Math.cos(it.ry || 0), sn = Math.sin(it.ry || 0);
    const cx = (b.min.x + b.max.x) / 2 * (it.sx || 1), cz = (b.min.z + b.max.z) / 2 * (it.sz || 1);
    const width = (b.max.x - b.min.x) * (it.sx || 1) + .04, length = (b.max.z - b.min.z) * (it.sz || 1) + .04;
    const x = it.x + c * cx + sn * cz, z = it.z - sn * cx + c * cz;
    W.foundationParts.push(bx(width, depth, length, kind === 'building' ? '#958b82' : '#b7aaa0', x, bottom - depth / 2, z, it.ry));
    if (kind === 'building' && depth > 1.6) {
      // Garage doors on the exposed downhill frontage give tall plinths an SF basement scale.
      for (const side of [-1, 1]) {
        const gx = x + sn * (length / 2 + .027) * side, gz = z + c * (length / 2 + .027) * side;
        const ground = W.terrainH(gx, gz), height = Math.min(2.2, bottom - ground - .18);
        if (height < 1.25) continue;
        W.foundationParts.push(bx(Math.min(width * .6, 3.4), height, .05, '#566970', gx, ground + height / 2 + .04, gz, it.ry));
        for (let h = .3; h < height; h += .32) W.foundationParts.push(bx(Math.min(width * .6, 3.4), .035, .07, '#879b9b', gx, ground + h, gz, it.ry));
      }
    }
    W.addOBB(x, z, width / 2, length / 2, it.ry || 0, bottom, { step: kind !== 'building' });
  }
  const row = { name, kind, before: { water: before.water > 0, gap: Math.max(0, base - before.low) },
    after: { water: !removed && !opt.deck && sample.water > 0, gap: removed || foundation || opt.deck ? 0 : Math.max(0, bottom - sample.low) },
    x: it.x, z: it.z, y: it.y, removed, foundation, moved: Math.hypot(it.x - old.x, it.z - old.z) > .01 };
  row.support = { box: b.clone(), item: it, bottom: foundation ? sample.low - .2 : bottom, deck: !!opt.deck };
  W.placements.push(row);
  if (kind === 'prop') W._placementMove = { x: old.x, z: old.z, dx: it.x - old.x, dz: it.z - old.z, dy: it.y - old.y, removed, radius: Math.max(2, (b.max.x - b.min.x) + (b.max.z - b.min.z)) };
  return !removed;
};
W.auditPlacements = function () {
  const result = { count: W.placements.length, before: { water: 0, floating: 0 }, after: { water: 0, floating: 0 }, foundations: 0, moved: 0, removed: 0, kinds: {} };
  for (const p of W.placements) {
    if (p.support && !p.removed) { const a = p.support, it = a.item, q = W.sampleFootprint(a.box, it.x, it.z, it.ry || 0, it.sx || 1, it.sz || 1);
      p.after = { water: !a.deck && q.water > 0, gap: a.deck ? 0 : Math.max(0, a.bottom - q.low) };
    }
    const k = result.kinds[p.kind] || (result.kinds[p.kind] = { count: 0, waterBefore: 0, floatingBefore: 0, waterAfter: 0, floatingAfter: 0 }); k.count++;
    for (const phase of ['before', 'after']) { const q = p[phase], suffix = phase === 'before' ? 'Before' : 'After';
      if (q.water) { result[phase].water++; k['water' + suffix]++; }
      if (q.gap > .16) { result[phase].floating++; k['floating' + suffix]++; }
    }
    if (p.foundation) result.foundations++; if (p.moved) result.moved++; if (p.removed) result.removed++;
  }
  return result;
};
function correctedCollider(x, z, top) {
  const p = W._placementMove;
  if (!p || Math.hypot(x - p.x, z - p.z) > p.radius) return { x, z, top };
  if (p.remaining > 1) p.remaining--; else W._placementMove = null;
  return p.removed ? null : { x: x + p.dx, z: z + p.dz, top: top + p.dy };
}

/* ================= COLLISION ================= */
const cgrid = new Map(), CG = 16; let stamp = 0;
const ckey = (i, j) => (i + 200) * 2000 + (j + 200);
W.boxes = []; W.dynamic = [];
function index(c, x0, x1, z0, z1) { for (let i = Math.floor(x0 / CG); i <= Math.floor(x1 / CG); i++) for (let j = Math.floor(z0 / CG); j <= Math.floor(z1 / CG); j++) { const k = ckey(i, j); let a = cgrid.get(k); if (!a) { a = []; cgrid.set(k, a); } a.push(c); } }
W.addBox = (x0, x1, z0, z1, top, o) => { const c = Object.assign({ t: 0, x0, x1, z0, z1, top, bot: -50, plat: true, _s: 0 }, o || {}); index(c, x0, x1, z0, z1); W.boxes.push(c); return c; };
W.addCircle = (x, z, r, top, o) => { const fixed = correctedCollider(x, z, top); if (!fixed) return null; ({ x, z, top } = fixed); const c = Object.assign({ t: 1, x, z, r, top, bot: -50, plat: true, _s: 0 }, o || {}); index(c, x - r, x + r, z - r, z + r); return c; };
W.addOBB = function (x, z, hx, hz, heading, top, opt) { const fixed = correctedCollider(x, z, top); if (!fixed) return null; ({ x, z, top } = fixed); const c = Object.assign({ t: 3, x, z, hx, hz, heading, top, bot: -50, plat: true, _s: 0 }, opt); const w = Math.abs(Math.cos(heading)) * hx + Math.abs(Math.sin(heading)) * hz, d = Math.abs(Math.sin(heading)) * hx + Math.abs(Math.cos(heading)) * hz; index(c, x - w, x + w, z - d, z + d); return c; };
W.meshColliders = function (root, filter) {
  root.updateWorldMatrix(true, true); let adjustment = null;
  let groundName = ''; root.traverse(o => { if (/^(newsstand|foodtruck|food_cart|taco_stand)$/.test(o.name)) groundName = o.name; });
  if (groundName && !root.userData.groundAudited) {
    root.userData.groundAudited = true;
    const bounds = new T.Box3().setFromObject(root); bounds.min.sub(root.position); bounds.max.sub(root.position);
    const it = { x: root.position.x, y: root.position.y, z: root.position.z, ry: 0, sx: 1, sy: 1, sz: 1 }, old = root.position.clone();
    const accepted = W.supportPlacement(groundName, bounds, it, 'static prop');
    adjustment = { x: old.x, z: old.z, dx: it.x - old.x, dz: it.z - old.z, dy: it.y - old.y, removed: !accepted, radius: Math.max(5, bounds.max.x - bounds.min.x + bounds.max.z - bounds.min.z), remaining: groundName === 'foodtruck' ? 2 : 1 };
    if (accepted) root.position.set(it.x, it.y, it.z);
    else { root.visible = false; W._placementMove = adjustment; return; }
    W._placementMove = null; root.updateWorldMatrix(true, true);
  } root.traverse(o => { if (!o.isMesh || o.userData.ink || /ink/.test(o.name) || (filter && !filter(o))) return; const b = new T.Box3().setFromObject(o); if (b.isEmpty()) return; W.addBox(b.min.x, b.max.x, b.min.z, b.max.z, b.max.y, { bot: b.min.y, plat: true }); }); if (adjustment) W._placementMove = adjustment; };
W.addRing = (x, z, r0, r1, top, gate, half) => { const c = { t: 2, x, z, r0, r1, top, gate, half, bot: -50, plat: false, _s: 0 }; index(c, x - r1, x + r1, z - r1, z + r1); return c; };
W.forNear = function (x, z, r, fn) {
  const query = ++stamp;
  const i0 = Math.floor((x - r) / CG), i1 = Math.floor((x + r) / CG), j0 = Math.floor((z - r) / CG), j1 = Math.floor((z + r) / CG);
  for (let i = i0; i <= i1; i++) for (let j = j0; j <= j1; j++) { const a = cgrid.get(ckey(i, j)); if (!a) continue; for (let k = 0; k < a.length; k++) { const c = a[k]; if (c._s === query) continue; c._s = query; if (fn(c)) return true; } }
  return false;
};
W.contact = function (c, x, z, r) {
  let dx, dz, d;
  if (c.t === 0 || c.t === 3) {
    const sn = c.t === 3 ? Math.sin(c.heading) : 0, cs = c.t === 3 ? Math.cos(c.heading) : 1;
    const cx = c.t === 3 ? c.x + cs * (c.ox || 0) + sn * (c.oz || 0) : (c.x0 + c.x1) / 2, cz = c.t === 3 ? c.z - sn * (c.ox || 0) + cs * (c.oz || 0) : (c.z0 + c.z1) / 2;
    const hx = c.t === 3 ? c.hx : (c.x1 - c.x0) / 2, hz = c.t === 3 ? c.hz : (c.z1 - c.z0) / 2;
    const lx = (x - cx) * cs - (z - cz) * sn, lz = (x - cx) * sn + (z - cz) * cs;
    dx = lx - U.clamp(lx, -hx, hx); dz = lz - U.clamp(lz, -hz, hz); d = Math.hypot(dx, dz);
    if (d >= r) return null;
    let depth = r - d;
    if (d > 1e-8) { dx /= d; dz /= d; }
    else if (hx - Math.abs(lx) < hz - Math.abs(lz)) { dx = lx < 0 ? -1 : 1; dz = 0; depth = hx - Math.abs(lx) + r; }
    else { dx = 0; dz = lz < 0 ? -1 : 1; depth = hz - Math.abs(lz) + r; }
    return { x: dx * cs + dz * sn, z: -dx * sn + dz * cs, depth };
  }
  dx = x - c.x; dz = z - c.z; d = Math.hypot(dx, dz);
  const nx = d > 1e-8 ? dx / d : 1, nz = d > 1e-8 ? dz / d : 0;
  if (c.t === 1) return d < c.r + r ? { x: nx, z: nz, depth: c.r + r - d } : null;
  if (d + r <= c.r0 || d - r >= c.r1) return null;
  const angle = U.angDiff(Math.atan2(dz, dx), c.gate), gap = c.half - Math.abs(angle);
  if (gap > 0 && d * Math.sin(gap) >= r) return null;
  let out = { x: nx, z: nz, depth: c.r1 + r - d };
  if (d - c.r0 + r < out.depth) out = { x: -nx, z: -nz, depth: d - c.r0 + r };
  if (gap > -.2) { const edge = c.gate + (angle < 0 ? -c.half : c.half), sign = angle < 0 ? 1 : -1, depth = r - d * Math.sin(gap);
    if (depth < out.depth) out = { x: -Math.sin(edge) * sign, z: Math.cos(edge) * sign, depth }; }
  return out;
};
W.overlaps = (c, x, z, r) => !!W.contact(c, x, z, Math.max(r, .0001));
function solid(c, y, height, step) { return y < c.top - .015 && y + height > c.bot + .015 && !(c.step && c.top <= y + step + .015); }
// cheap reject for moving bodies (vehicles) far from the query circle, before their terrain-height getters run
const dynNear = (c, x, z, r) => { if (c.t !== 3) return true; const R = Math.abs(c.ox || 0) + Math.abs(c.oz || 0) + c.hx + c.hz + r; return Math.abs(x - c.x) < R && Math.abs(z - c.z) < R; };
W.blockedAt = function (x, z, r, y, opt) {
  opt = opt || {};
  if (!W.inLand(x, z, r)) return true;
  if (W.forNear(x, z, r, c => solid(c, y, opt.height || 1.4, opt.step == null ? .6 : opt.step) && W.overlaps(c, x, z, r))) return true;
  return !!opt.dynamic && W.dynamic.some(c => dynNear(c, x, z, r) && c.owner !== opt.ignore && (!opt.filter || opt.filter(c)) && solid(c, y, opt.height || 1.4, 0) && W.overlaps(c, x, z, r));
};
const surfaces = new Map(), SG = 8, skey = (i, j) => (i + 400) * 4000 + (j + 400);
W.addSurface = function (geo) { const p = geo.attributes.position, idx = geo.index, n = idx ? idx.count : p.count;
  for (let i = 0; i < n; i += 3) { const tri = []; for (let j = 0; j < 3; j++) { const k = idx ? idx.getX(i + j) : i + j; tri.push(p.getX(k), p.getY(k), p.getZ(k)); }
    const x0 = Math.min(tri[0], tri[3], tri[6]), x1 = Math.max(tri[0], tri[3], tri[6]), z0 = Math.min(tri[2], tri[5], tri[8]), z1 = Math.max(tri[2], tri[5], tri[8]);
    for (let x = Math.floor(x0 / SG); x <= Math.floor(x1 / SG); x++) for (let z = Math.floor(z0 / SG); z <= Math.floor(z1 / SG); z++) { const key = skey(x, z); if (!surfaces.has(key)) surfaces.set(key, []); surfaces.get(key).push(tri); }
  }
};
W.walkH = function (x, z) { let h = W.groundH(x, z); const tris = surfaces.get(skey(Math.floor(x / SG), Math.floor(z / SG))); if (!tris) return h;
  for (const a of tris) { const den = (a[5] - a[8]) * (a[0] - a[6]) + (a[6] - a[3]) * (a[2] - a[8]); if (Math.abs(den) < 1e-8) continue; const u = ((a[5] - a[8]) * (x - a[6]) + (a[6] - a[3]) * (z - a[8])) / den, v = ((a[8] - a[2]) * (x - a[6]) + (a[0] - a[6]) * (z - a[8])) / den; if (u >= -1e-6 && v >= -1e-6 && u + v <= 1.000001) h = Math.max(h, a[1] * u + a[4] * v + a[7] * (1 - u - v)); }
  return h;
};
W.groundAt = function (x, z, y, r) {
  let g = W.walkH(x, z); r = r == null ? .35 : r;
  W.forNear(x, z, r, c => { if (c.plat && c.top <= y + (c.step ? .6 : .02) && c.top > g && W.overlaps(c, x, z, r)) g = c.top; return false; });
  return g;
};
W.recover = function (e, r, y, opt) {
  opt = Object.assign({ dynamic: true, ignore: e }, opt);
  if (!W.blockedAt(e.x, e.z, r, y, opt)) return true;
  const ox = e.x, oz = e.z;
  for (let k = 0; k < 8; k++) {
    let best = null;
    const visit = c => { if (c.owner === opt.ignore || !solid(c, y, opt.height || 1.4, opt.step == null ? .6 : opt.step)) return false; const n = W.contact(c, e.x, e.z, r); if (n && (!best || n.depth < best.depth)) best = n; return false; };
    W.forNear(e.x, e.z, r, visit); if (opt.dynamic) W.dynamic.forEach(c => dynNear(c, e.x, e.z, r) && visit(c));
    if (!best) break;
    e.x += best.x * (best.depth + .002); e.z += best.z * (best.depth + .002);
    if (!W.blockedAt(e.x, e.z, r, y, opt)) return true;
  }
  e.x = ox; e.z = oz;
  if (e.safe && !W.blockedAt(e.safe.x, e.safe.z, r, e.safe.y, opt)) { e.x = e.safe.x; e.z = e.safe.z; e.y = e.safe.y; return true; }
  return false;
};
W.move = function (e, dx, dz, r, y, opt) {
  if (![dx, dz, e.x, e.z, y].every(Number.isFinite)) return true;
  opt = Object.assign({ dynamic: true, ignore: e }, opt);
  let hit = false, cy = y;
  if (!opt.test && !W.recover(e, r, y, opt)) return true;
  const n = Math.max(1, Math.ceil(Math.hypot(dx, dz) / Math.min(.25, r * .4))), sx = dx / n, sz = dz / n;
  const heightAt = (x, z) => { if (!opt.grounded) return cy; const ground = W.groundAt(x, z, cy, r); return cy - ground > .6 ? cy : ground; };
  const blocked = (x, z) => W.blockedAt(x, z, r, heightAt(x, z), opt) || (opt.test && !opt.test(x, z));
  for (let i = 0; i < n; i++) {
    let mx = sx, mz = sz;
    if (blocked(e.x + mx, e.z + mz)) {
      hit = true;
      let normal = null;
      const visit = c => { if (c.owner === opt.ignore || !solid(c, heightAt(e.x + mx, e.z + mz), opt.height || 1.4, opt.step == null ? .6 : opt.step)) return false; const v = W.contact(c, e.x + mx, e.z + mz, r); if (v && (!normal || v.depth > normal.depth)) normal = v; return false; };
      W.forNear(e.x + mx, e.z + mz, r, visit); if (opt.dynamic) W.dynamic.forEach(c => dynNear(c, e.x + mx, e.z + mz, r) && visit(c));
      if (normal) { const dot = mx * normal.x + mz * normal.z; if (dot < 0) { mx -= dot * normal.x; mz -= dot * normal.z; } }
      if (!blocked(e.x + mx, e.z + mz)) { e.x += mx; e.z += mz; }
      else {
        for (const axis of Math.abs(sx) > Math.abs(sz) ? ['x', 'z'] : ['z', 'x']) {
          const vx = axis === 'x' ? sx : 0, vz = axis === 'z' ? sz : 0;
          if (!blocked(e.x + vx, e.z + vz)) { e.x += vx; e.z += vz; }
          else { let lo = 0, hi = 1; for (let j = 0; j < 7; j++) { const t = (lo + hi) / 2; if (blocked(e.x + vx * t, e.z + vz * t)) hi = t; else lo = t; } e.x += vx * lo; e.z += vz * lo; }
        }
      }
    } else { e.x += mx; e.z += mz; }
    if (opt.grounded) { const ground = W.groundAt(e.x, e.z, cy, r); if (cy - ground > .6) { e.y = cy; e.onGround = false; opt.grounded = false; } else cy = ground; }
  }
  if (opt.grounded) e.y = cy;
  if (!blocked(e.x, e.z)) e.safe = { x: e.x, z: e.z, y: opt.grounded ? cy : y };
  return hit;
};
W.pushOut = function (e, cx, cz, R) {
  const n = W.contact({ t: 1, x: cx, z: cz, r: R }, e.x, e.z, .001); if (!n) return false;
  W.move(e, n.x * (n.depth + .002), n.z * (n.depth + .002), .7, e.y || 0); return true;
};
W.ceilingAt = function (x, z, feet, height, r) { let ceiling = Infinity; W.forNear(x, z, r, c => { if (c.bot >= feet + height - .03 && W.overlaps(c, x, z, r)) ceiling = Math.min(ceiling, c.bot); return false; }); return ceiling; };
W.liftCamera = function (p, r) { p.y = Math.max(p.y, W.walkH(p.x, p.z) + r + .01); for (let i = 0; i < 16; i++) { let y = p.y; W.forNear(p.x, p.z, r, c => { if (p.y - r < c.top && p.y + r > c.bot && W.overlaps(c, p.x, p.z, r)) y = Math.max(y, c.top + r + .01); return false; }); if (y === p.y) break; p.y = y; } return p; };
W.cameraBlocked = (x, y, z, r) => y < W.walkH(x, z) + r || W.forNear(x, z, r, c => y - r < c.top && y + r > c.bot && W.overlaps(c, x, z, r));
W.clipCamera = function (from, to, r) {
  const dx = to.x - from.x, dy = to.y - from.y, dz = to.z - from.z, n = Math.max(1, Math.ceil(Math.hypot(dx, dy, dz) / .2));
  let safe = 0;
  for (let i = 0; i <= n; i++) { const t = i / n; if (W.cameraBlocked(from.x + dx * t, from.y + dy * t, from.z + dz * t, r)) { let lo = safe, hi = t; for (let j = 0; j < 8; j++) { const q = (lo + hi) / 2; if (W.cameraBlocked(from.x + dx * q, from.y + dy * q, from.z + dz * q, r)) hi = q; else lo = q; } return lo; } safe = t; }
  return 1;
};
const RGS = 32, roadGrid = new Map();
function roadsNear(x, z) { return roadGrid.get(Math.floor(x / RGS) * 4096 + Math.floor(z / RGS)) || NOHILL; }
W.onRoad = function (x, z, pad) { pad = pad || 0; for (const s of roadsNear(x, z)) { const vx = s.bx - s.ax, vz = s.bz - s.az, l2 = vx * vx + vz * vz; let t = ((x - s.ax) * vx + (z - s.az) * vz) / l2; t = t < 0 ? 0 : t > 1 ? 1 : t; if (Math.hypot(x - (s.ax + vx * t), z - (s.az + vz * t)) < s.w / 2 + pad) return true; } return false; };
W.freeWalk = function (x, z, r) { r = r || .8; for (let k = 0; k < 160; k++) { const a = k * 2.4, d = k * .6; const nx = x + Math.cos(a) * d, nz = z + Math.sin(a) * d; if (!W.blockedAt(nx, nz, r, W.terrainH(nx, nz) + .1) && !W.onRoad(nx, nz, r)) return [nx, nz]; } return W.free(x, z, r); };
W.free = function (x, z, r) { r = r || .8; if (!W.blockedAt(x, z, r, W.terrainH(x, z) + .1)) return [x, z]; for (let k = 1; k < 80; k++) { const a = k * 2.4, d = k * .7; const nx = x + Math.cos(a) * d, nz = z + Math.sin(a) * d; if (!W.blockedAt(nx, nz, r, W.terrainH(nx, nz) + .1)) return [nx, nz]; } return [x, z]; };

/* ================= MATERIALS & TEXTURES ================= */
const toon = K.toon;
function asphaltTex(market) {
  return K.canvasTex(128, 256, (g, w, h) => {
    g.fillStyle = market ? '#4b4057' : '#51495f'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 1400; i++) { g.fillStyle = Math.random() < .5 ? 'rgba(255,255,255,.05)' : 'rgba(0,0,0,.09)'; g.fillRect(Math.random() * w, Math.random() * h, 2, 2); }
    if (market) {
      g.fillStyle = '#b83a3a'; g.fillRect(14, 0, 30, h); g.fillRect(84, 0, 30, h);
      g.fillStyle = '#9aa0ad'; g.fillRect(56, 0, 3, h); g.fillRect(69, 0, 3, h);
      g.fillStyle = '#f7f1e3'; for (let y = 0; y < h; y += 64) { g.fillRect(8, y, 3, 34); g.fillRect(117, y, 3, 34); }
    } else {
      g.fillStyle = '#ffd24a'; g.fillRect(60, 0, 3, h); g.fillRect(66, 0, 3, h);
      g.fillStyle = '#f7f1e3'; g.fillRect(4, 0, 3, h); g.fillRect(121, 0, 3, h);
    }
  }, true);
}
W.tex = { road: asphaltTex(false), market: asphaltTex(true) };

/* ================= TERRAIN MESH (tiles over one height field) ================= */
function buildTerrain() {
  const { x0, z0, cs, nx, nz } = TG, w = nx + 1, N = w * (nz + 1);
  HF = new Float32Array(N); const land = new Uint8Array(N), col = new Float32Array(N * 3), c = new T.Color();
  const cSide = new T.Color('#cfae9c'), cRock = new T.Color('#8f7d8f'), cGold = new T.Color('#e2b95c'), cSand = new T.Color('#f4dca6'), cBluff = new T.Color('#a8927c'), cLawn = new T.Color('#7cc25a');
  for (let j = 0; j <= nz; j++) for (let i = 0; i <= nx; i++) { const x = x0 + i * cs, z = z0 + j * cs; land[j * w + i] = inPoly(x, z) ? (inLake(x, z) ? 2 : 1) : 0; }   // 0 sea, 1 land, 2 lake
  const L = (i, j) => i < 0 || j < 0 || i > nx || j > nz ? 0 : land[j * w + i];
  for (let j = 0; j <= nz; j++) for (let i = 0; i <= nx; i++) {
    const k = j * w + i, x = x0 + i * cs, z = z0 + j * cs, ld = land[k] === 1;
    let y = land[k] ? W.terrainH(x, z) : -3.2;
    const seaAdj = ld && (!L(i + 1, j) || !L(i - 1, j) || !L(i, j + 1) || !L(i, j - 1)); if (seaAdj) y = Math.min(y, -.4);
    HF[k] = y;
    const pk = ld && W.parkAt(x, z), coast = ld && x < -262 && z < -30 && W.coastK(x, z) < .35;
    if (!ld) c.copy(cRock);
    else if (!seaAdj && y < -.25) c.copy(cSand);   // lake beaches
    else if (pk && pk.beach) c.copy(cSand);
    else if (coast) c.copy(W.hillH(x, z) > 3 ? cBluff : cSand);
    else if (pk) { c.set(pk.col); if ((pk.n === 'Twin Peaks' || pk.n === 'Bernal Heights') && y < 12) c.lerp(cLawn, .6); }
    else if (W.hillH(x, z) > 18) c.copy(cGold);
    else c.copy(cSide);
    const n = U.hash(Math.floor(x / 6), Math.floor(z / 6)) * .06 - .03; c.offsetHSL(0, 0, n);
    col[k * 3] = c.r; col[k * 3 + 1] = c.g; col[k * 3 + 2] = c.b;
  }
  const H = (i, j) => HF[Math.min(nz, Math.max(0, j)) * w + Math.min(nx, Math.max(0, i))];
  const mat = new T.MeshToonMaterial({ vertexColors: true, gradientMap: K.grad3 }); mat.name = 'terrain';
  const TS = 64; W.terrainTiles = [];
  for (let tj = 0; tj < nz; tj += TS) for (let ti = 0; ti < nx; ti += TS) {
    const ni = Math.min(TS, nx - ti), nj = Math.min(TS, nz - tj);
    let any = false; for (let j = tj; j <= tj + nj && !any; j++) for (let i = ti; i <= ti + ni; i++) if (land[j * w + i]) { any = true; break; }
    if (!any) continue;
    const vn = (ni + 1) * (nj + 1), pos = new Float32Array(vn * 3), nor = new Float32Array(vn * 3), cl = new Float32Array(vn * 3), idx = [];
    for (let j = 0; j <= nj; j++) for (let i = 0; i <= ni; i++) {
      const gi = ti + i, gj = tj + j, k = gj * w + gi, v = (j * (ni + 1) + i) * 3;
      pos[v] = x0 + gi * cs; pos[v + 1] = HF[k]; pos[v + 2] = z0 + gj * cs;
      const ax = H(gi - 1, gj) - H(gi + 1, gj), az = H(gi, gj - 1) - H(gi, gj + 1), l = Math.hypot(ax, 2 * cs, az);
      nor[v] = ax / l; nor[v + 1] = 2 * cs / l; nor[v + 2] = az / l;
      cl[v] = col[k * 3]; cl[v + 1] = col[k * 3 + 1]; cl[v + 2] = col[k * 3 + 2];
    }
    for (let j = 0; j < nj; j++) for (let i = 0; i < ni; i++) { const a = j * (ni + 1) + i, b = a + ni + 1; idx.push(a, b, a + 1, b, b + 1, a + 1); }
    const g = new T.BufferGeometry(); g.setAttribute('position', new T.BufferAttribute(pos, 3)); g.setAttribute('normal', new T.BufferAttribute(nor, 3)); g.setAttribute('color', new T.BufferAttribute(cl, 3)); g.setIndex(idx); g.computeBoundingSphere();
    const m = new T.Mesh(g, mat); m.receiveShadow = true; m.matrixAutoUpdate = false; scene.add(m); W.terrainTiles.push(m);
  }
  W.terrain = W.terrainTiles[0];
}

/* ================= ROADS ================= */
const roadSegs = []; // {ax,az,bx,bz,w,kind}
function ribbon(p, w, lift, vScale, arr) {   // road ribbon along a polyline: ~3-unit grid in both directions so it hugs the hills
  const base = arr.pos.length / 3, m = Math.max(2, Math.round(w / 3)); let v = 0;
  for (let i = 0; i < p.length; i++) {
    const a = p[Math.max(0, i - 1)], b = p[Math.min(p.length - 1, i + 1)], l = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1, px = -(b[1] - a[1]) / l * w / 2, pz = (b[0] - a[0]) / l * w / 2;
    if (i) v += Math.hypot(p[i][0] - p[i - 1][0], p[i][1] - p[i - 1][1]) / vScale;
    for (let k = 0; k <= m; k++) { const s = k / m * 2 - 1, x = p[i][0] + px * s, z = p[i][1] + pz * s; arr.pos.push(x, W.groundH(x, z) + lift, z); arr.uv.push(k / m, v); }
  }
  for (let i = 0; i < p.length - 1; i++) for (let k = 0; k < m; k++) { const a = base + i * (m + 1) + k, b = a + m + 1; arr.idx.push(a, a + 1, b, a + 1, b + 1, b); }
}
function stripGeo(ax, az, bx, bz, w, lift, vScale, arr) { const n = Math.max(1, Math.ceil(Math.hypot(bx - ax, bz - az) / 3)); ribbon(Array.from({ length: n + 1 }, (_, i) => [ax + (bx - ax) * i / n, az + (bz - az) * i / n]), w, lift, vScale, arr); }
const polyStrip = ribbon;
function geoFrom(arr, walk) { const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(arr.pos, 3)); g.setAttribute('uv', new T.Float32BufferAttribute(arr.uv, 2)); g.setIndex(arr.idx); g.computeVertexNormals(); if (walk !== false) W.addSurface(g); return g; }
const NOSTREET = ['Palace of Fine Arts', 'Telegraph Hill', 'Alamo Square', 'Dolores Park', 'Union Square'];
function segOK(ax, az, bx, bz) {
  for (let k = 0; k <= 4; k++) { const x = U.lerp(ax, bx, k / 4), z = U.lerp(az, bz, k / 4); if (!landAt(x, z)) return false; if (Math.hypot(x - W.STAD.x, z - W.STAD.z) < W.STAD.r1 + 4) return false; if (W.terrainH(x, z) > 27) return false; }
  const mx = (ax + bx) / 2, mz = (az + bz) / 2; if (mx > -110 && mx < -50 && Math.abs(mz + 140) < 1) return false; // Lombard (drawn separately)
  const pk = W.parkAt(mx, mz); if (!pk) return true;
  if (pk.n === 'Golden Gate Park') return ax === bx ? ax === -470 || ax === -230 : az === 100 && mx > -290;   // Park Presidio / 19th Ave crossings + east JFK
  return !pk.none && !NOSTREET.includes(pk.n);
}
// winding park drives and a few dirt trails (drawn separately, not part of the street grid)
W.CURVES = [
  { n: 'JFK Drive', w: 9, pts: Array.from({ length: 53 }, (_, i) => { const x = -290 - i * 8; return [x, 100 + 14 * Math.sin((x + 290) / 45)]; }) },
  { n: 'Lincoln Blvd', w: 9, pts: [[-236, -170], [-262, -168], [-300, -161], [-340, -168], [-382, -176], [-422, -168], [-452, -150], [-468, -124], [-474, -100], [-470, -86]] },
];
W.TRAILS = [
  [[-300, -120], [-326, -94], [-372, -98], [-414, -118], [-440, -144], [-418, -168], [-380, -160], [-330, -170], [-300, -140], [-300, -120]],
  [[-596, -88], [-640, -82], [-690, -66], [-740, -58], [-766, -48]],
  [[-238, 330], [-222, 344], [-214, 360], [-196, 366], [-176, 352], [-170, 330]],
];
function smoothPts(p, step) { const out = []; for (let i = 0; i < p.length - 1; i++) { const a = p[Math.max(0, i - 1)], b = p[i], c = p[i + 1], d = p[Math.min(p.length - 1, i + 2)], n = Math.max(1, Math.ceil(Math.hypot(c[0] - b[0], c[1] - b[1]) / step));
  for (let k = 0; k < n; k++) { const t = k / n, t2 = t * t, t3 = t2 * t, f = (u0, u1, u2, u3) => .5 * (2 * u1 + (-u0 + u2) * t + (2 * u0 - 5 * u1 + 4 * u2 - u3) * t2 + (-u0 + 3 * u1 - 3 * u2 + u3) * t3); out.push([f(a[0], b[0], c[0], d[0]), f(a[1], b[1], c[1], d[1])]); } } out.push(p[p.length - 1]); return out; }
W.ints = [];
function buildRoads() {
  const R = { pos: [], uv: [], idx: [] }, MK = { pos: [], uv: [], idx: [] }, X = { pos: [], uv: [], idx: [] }, TR = { pos: [], uv: [], idx: [] };
  const zs = [-212].concat(W.ZR, [600]), xs = [TG.x0].concat(W.XR, [258]), arms = new Map(), arm = (x, z, f) => { const k = x + ',' + z; arms.set(k, (arms.get(k) || 0) | f); };
  for (const x of W.XR) for (let i = 0; i < zs.length - 1; i++) { const a = zs[i], b = zs[i + 1]; if (segOK(x, a, x, b)) { stripGeo(x, a, x, b, 12, .06, 12, R); roadSegs.push({ ax: x, az: a, bx: x, bz: b, w: 12 }); arm(x, a, 2); arm(x, b, 1); } }
  for (const z of W.ZR) for (let i = 0; i < xs.length - 1; i++) { const a = xs[i], b = xs[i + 1]; if (segOK(a, z, b, z)) { stripGeo(a, z, b, z, 12, .08, 12, R); roadSegs.push({ ax: a, az: z, bx: b, bz: z, w: 12 }); arm(a, z, 4); arm(b, z, 8); } }
  for (const c of W.CURVES) { const p = smoothPts(c.pts, 3); polyStrip(p, c.w, .07, 12, R); for (let i = 0; i < p.length - 1; i += 2) { const q = p[Math.min(p.length - 1, i + 2)]; roadSegs.push({ ax: p[i][0], az: p[i][1], bx: q[0], bz: q[1], w: c.w, curve: true }); } }
  for (const t of W.TRAILS) polyStrip(smoothPts(t, 3), 3.4, .05, 8, TR);
  // Market Street
  const A = W.MKT.a, D = W.MKT.d; let t1 = W.MKT.len;
  while (!landAt(A.x + D.x * t1, A.y + D.y * t1)) t1 -= 4;
  W.MKT.len = t1;
  stripGeo(A.x, A.y, A.x + D.x * t1, A.y + D.y * t1, W.MKT.w, .12, 24, MK);
  roadSegs.push({ ax: A.x, az: A.y, bx: A.x + D.x * t1, bz: A.y + D.y * t1, w: W.MKT.w, market: true });
  // intersection patches + crosswalk stripes (only where streets actually cross); stripes are terrain-hugging decals
  const ZB = { pos: [], col: [], idx: [] }, zcol = new T.Color();
  const stripe = (px, pz, rot, color) => { zcol.set(color); const base = ZB.pos.length / 3;
    for (let j = 0; j <= 2; j++) for (let i = 0; i <= 1; i++) { const lx = i - .5, lz = (j - 1) * 1.6, x = px + (rot ? lz : lx), z = pz + (rot ? lx : lz); ZB.pos.push(x, W.groundH(x, z) + .13, z); ZB.col.push(zcol.r, zcol.g, zcol.b); }
    for (let j = 0; j < 2; j++) { const a = base + j * 2; if (rot) ZB.idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); else ZB.idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); } };
  for (const x of W.XR) for (const z of W.ZR) {
    const f = arms.get(x + ',' + z) || 0; if (!(f & 3) || !(f & 12)) continue;
    W.ints.push([x, z]); stripGeo(x, z - 6, x, z + 6, 12, .1, 1000, X);
    const rainbow = Math.hypot(x + 110, z - 220) < 5;
    for (const [ox, oz, rot, bit] of [[0, -8, 0, 1], [0, 8, 0, 2], [-8, 0, 1, 8], [8, 0, 1, 4]]) { if (!(f & bit)) continue; for (let k = -4; k <= 4; k += 1.6)
      stripe(x + ox + (rot ? 0 : k), z + oz + (rot ? k : 0), rot, rainbow ? ['#ff5a5a', '#ffa54a', '#ffe14a', '#5ad16a', '#4aa8ff', '#9a6bff'][Math.round((k + 4) / 1.6) % 6] : '#f7f1e3'); }
  }
  const zgeo = new T.BufferGeometry(); zgeo.setAttribute('position', new T.Float32BufferAttribute(ZB.pos, 3)); zgeo.setAttribute('color', new T.Float32BufferAttribute(ZB.col, 3)); zgeo.setIndex(ZB.idx); zgeo.computeVertexNormals();
  const zebra = new T.Mesh(zgeo, new T.MeshToonMaterial({ color: '#f7f1e3', vertexColors: true, gradientMap: K.grad3 })); zebra.receiveShadow = true; scene.add(zebra);
  const rm = toon('#ffffff', { map: W.tex.road }), mm = toon('#ffffff', { map: W.tex.market }), xm = toon('#51495f'), tm = toon('#c9a36b');
  if (!rm.name) rm.name = 'road'; if (!mm.name) mm.name = 'road'; if (!xm.name) xm.name = 'road';
  for (const [a, m] of [[R, rm], [MK, mm], [X, xm]]) { const mesh = new T.Mesh(geoFrom(a), m); mesh.receiveShadow = true; scene.add(mesh); }
  const trail = new T.Mesh(geoFrom(TR, false), tm); trail.receiveShadow = true; scene.add(trail);
  // Lombard Street — the crooked one down Russian Hill
  const dm = new T.Object3D();
  const L = { pos: [], uv: [], idx: [] }; const pts = []; const xa = -110, xb = -50, zc = -140;
  for (let i = 0; i <= 8; i++) { const x = U.lerp(xa, xb, i / 8); pts.push([x, zc + (i % 2 ? 7 : -7)]); }
  pts[0][1] = zc; pts[8][1] = zc;
  for (let i = 0; i < pts.length - 1; i++) stripGeo(pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1], 8, .1, 10, L);
  const lmm = toon('#b86a4a'); if (!lmm.name) lmm.name = 'lombard'; const lm = new T.Mesh(geoFrom(L), lmm); lm.receiveShadow = true; scene.add(lm);
  W.lombard = pts;
  const flowerCols = ['#ff5aa0', '#ff8a3d', '#ffd23f', '#b06cff', '#ff4f6b'];
  const fg = new T.SphereGeometry(1, 8, 6); const fls = [];
  for (let i = 0; i < 8; i++) { const x = U.lerp(xa, xb, (i + .5) / 8); for (const s of [-1, 1]) { const z = zc + s * 8.5 * (i % 2 ? -1 : 1) * .5 + s * 2; fls.push([x, z]); } }
  const fim = new T.InstancedMesh(fg, toon('#ffffff'), fls.length * 3);
  let fi = 0; fls.forEach(([x, z]) => { for (let k = 0; k < 3; k++) { const px = x + U.rand(-2, 2), pz = z + U.rand(-1, 1); dm.position.set(px, W.terrainH(px, pz) + .3, pz); dm.scale.set(1.6, .7, 1.2); dm.rotation.set(0, 0, 0); dm.updateMatrix(); fim.setMatrixAt(fi, dm.matrix); fim.setColorAt(fi++, new T.Color(U.pick(flowerCols))); } });
  fg.boundingSphere = new T.Sphere(new T.Vector3(-80, 18, -140), 40);   // instanced bounds must cover every flower, not the unit sphere at the origin
  dm.scale.set(1, 1, 1); fim.castShadow = true; scene.add(fim);
  W.roadSegs = roadSegs;
  for (const s of roadSegs) { const p = s.w / 2 + 10; for (let i = Math.floor((Math.min(s.ax, s.bx) - p) / RGS); i <= Math.floor((Math.max(s.ax, s.bx) + p) / RGS); i++) for (let j = Math.floor((Math.min(s.az, s.bz) - p) / RGS); j <= Math.floor((Math.max(s.az, s.bz) + p) / RGS); j++) { const k = i * 4096 + j; if (!roadGrid.has(k)) roadGrid.set(k, []); roadGrid.get(k).push(s); } }
}

/* ================= KIT INSTANCING + LOD ================= */
/* Collect (geometry, material) parts of a named kit object, baked relative to the kit root. */
function kitParts(gltf, name) {
  const node = gltf && gltf.scene.getObjectByName(name); if (!node) return null;
  gltf.scene.updateMatrixWorld(true);
  const inv = new T.Matrix4().copy(node.matrixWorld).invert();
  const parts = []; const box = new T.Box3();
  node.traverse(o => { if (!o.isMesh) return; const rel = new T.Matrix4().multiplyMatrices(inv, o.matrixWorld);
    const geo = o.geometry.clone().applyMatrix4(rel); geo.computeBoundingBox(); box.union(geo.boundingBox);
    (Array.isArray(o.material) ? o.material : [o.material]).forEach((m, gi) => parts.push({ geo, mat: m, group: Array.isArray(o.material) ? geo.groups[gi] : null })); });
  // Ground-contact geometry, excluding overhanging foliage, lamps and seat backs.
  const support = new T.Box3(), v = new T.Vector3();
  for (const p of parts) { const a = p.geo.attributes.position; for (let i = 0; i < a.count; i++) if (a.getY(i) <= box.min.y + .18) support.expandByPoint(v.fromBufferAttribute(a, i)); }
  if (support.isEmpty()) support.copy(box);
  return { parts, box, support, name };
}
/* Per 96-unit chunk: detailed instances near the camera, a single merged impostor (boxes / canopy blobs) far away, small props only within their range. */
const LODS = W.LODS = new Map(); W.LOD = { near: 330, minor: 200, far: 1100 }; W.cull = [];
W.addCull = (o, x, z, r) => W.cull.push({ o, x, z, r2: r * r });
function lodCell(x, z) { const k = Math.floor(x / 96) + ',' + Math.floor(z / 96); let e = LODS.get(k); if (!e) LODS.set(k, e = { x0: 1e9, x1: -1e9, z0: 1e9, z1: -1e9, det: [], minor: [], props: [], imp: [], ip: null, near: null, mid: null }); return e; }
const minorPart = (kit, m) => m === 'accent' || m === 'gold' || m === 'white' || (m === 'metal' && kit !== 'glass') || (m === 'brick' && kit !== 'brick') || (m === 'glass' && kit !== 'glass') || (m === 'green' && kit !== 'china');
class Instancer {
  constructor(kit, tintNames) { this.kit = kit; this.tint = tintNames || ['wall']; this.items = []; }
  add(x, y, z, ry, sx, sy, sz, color) {
    W._placementMove = null;
    const it = { x, y, z, ry, sx: sx || 1, sy: sy || 1, sz: sz || 1, color };
    if (this.kit) {
      const building = /^(vic_[abc]|edw|deco|glass|brick|mission|china|corner|stucco)$/.test(this.kit.name);
      if (!W.supportPlacement(this.kit.name, building ? this.kit.box : this.kit.support || this.kit.box, it, building ? 'building' : 'prop')) return;
      if (/lamp/.test(this.kit.name)) W.perches.push({ x: it.x, y: it.y + this.kit.box.max.y * it.sy, z: it.z, kind: 'lamp' });
    }
    this.items.push(it); return it;
  }
  build(opts) {
    opts = opts || {};
    if (!this.items.length || !this.kit) return;
    const chunks = new Map();
    for (const it of this.items) { const key = Math.floor(it.x / 96) + ',' + Math.floor(it.z / 96); if (!chunks.has(key)) chunks.set(key, []); chunks.get(key).push(it); }
    const dm = new T.Object3D(), kb = this.kit.box, name = this.kit.name || '';
    for (const items of chunks.values()) {
      const bounds = new T.Box3();
      for (const it of items) { dm.position.set(it.x, it.y, it.z); dm.rotation.set(0, it.ry, 0); dm.scale.set(it.sx, it.sy, it.sz); dm.updateMatrix(); it.m = dm.matrix.clone(); bounds.union(kb.clone().applyMatrix4(it.m)); }
      const sphere = bounds.getBoundingSphere(new T.Sphere()), e = opts.lod ? lodCell(items[0].x, items[0].z) : null;
      if (e) { e.x0 = Math.min(e.x0, bounds.min.x); e.x1 = Math.max(e.x1, bounds.max.x); e.z0 = Math.min(e.z0, bounds.min.z); e.z1 = Math.max(e.z1, bounds.max.z); }
      for (const p of this.kit.parts) {
        const geo = new T.BufferGeometry(); for (const k in p.geo.attributes) geo.setAttribute(k, p.geo.attributes[k]); if (p.geo.index) geo.setIndex(p.geo.index);   // shared buffers: one GPU copy per kit part
        if (p.group) geo.setDrawRange(p.group.start, p.group.count);
        geo.boundingSphere = sphere; geo.boundingBox = bounds;
        const tinted = this.tint.includes(p.mat.name), im = new T.InstancedMesh(geo, tinted ? (p.tmat || (p.tmat = p.mat.clone())) : p.mat, items.length);
        im.castShadow = Array.isArray(opts.cast) ? opts.cast.includes(p.mat.name) : opts.cast !== false; im.receiveShadow = true;
        items.forEach((it, i) => { im.setMatrixAt(i, it.m); if (tinted) im.setColorAt(i, new T.Color(it.color || '#ffffff')); });
        if (tinted && im.instanceColor) im.instanceColor.needsUpdate = true;
        im.frustumCulled = true; im.matrixAutoUpdate = false; scene.add(im);   // static: skip per-frame matrix work
        if (!e) continue;
        if (typeof opts.lod === 'number') e.props.push({ m: im, r: opts.lod });
        else (opts.lod === 'bld' && minorPart(name, p.mat.name) ? e.minor : e.det).push(im);
      }
      if (e && opts.lod === 'bld') for (const it of items) e.imp.push({ it, kit: this.kit, shape: 'box' });
      if (e && opts.lod === 'tree') for (const it of items) e.imp.push({ it, kit: this.kit, shape: 'tree', leaf: opts.leaf });
    }
  }
}
W.kitParts = kitParts; W.Instancer = Instancer;
W.buildImpostors = function () {
  const tex = K.canvasTex(32, 32, g => { g.fillStyle = '#ffffff'; g.fillRect(0, 0, 32, 32); g.fillStyle = '#3b4766'; g.fillRect(9, 7, 14, 17); g.fillStyle = '#6c7ba0'; g.fillRect(9, 7, 14, 3); }, true);
  const mat = new T.MeshToonMaterial({ vertexColors: true, map: tex, gradientMap: K.grad3 }); mat.name = 'impostor';
  const c = new T.Color(), v = new T.Vector3(), n = new T.Vector3(), t2 = new T.Vector3(), tint = new T.Color(), top = new T.Color();
  const mc = (kit, nm) => { const p = kit.parts.find(q => q.mat.name === nm); return p && p.mat.color; };
  for (const e of LODS.values()) {
    if (!e.imp.length) continue;
    const pos = [], nor = [], col = [], uv = [];
    const quad = (a, b, cc, d, cl, us, vs) => { n.subVectors(b, a).cross(t2.subVectors(cc, a)).normalize(); for (const [p, u, w] of [[a, 0, 0], [b, us, 0], [cc, us, vs], [a, 0, 0], [cc, us, vs], [d, 0, vs]]) { pos.push(p.x, p.y, p.z); nor.push(n.x, n.y, n.z); col.push(cl.r, cl.g, cl.b); uv.push(u, w); } };
    for (const { it, kit, shape, leaf } of e.imp) {
      const b = kit.box;
      if (shape === 'box') {
        const P = [0, 1, 2, 3, 4, 5, 6, 7].map(i => new T.Vector3(i & 1 ? b.max.x : b.min.x, i & 2 ? b.max.y : Math.max(b.min.y, 0), i & 4 ? b.max.z : b.min.z).applyMatrix4(it.m));
        tint.set(it.color || '#ffffff'); const base = mc(kit, 'wall') || mc(kit, 'brick') || mc(kit, 'glass') || mc(kit, 'stone'); if (base) tint.multiply(base);
        top.copy(mc(kit, 'roof') || tint).multiplyScalar(.8);
        const wx = (b.max.x - b.min.x) * it.sx / 3.2, wz = (b.max.z - b.min.z) * it.sz / 3.2, hy = (b.max.y - Math.max(0, b.min.y)) * it.sy / 3.6;
        for (const [a, bb, cc, d, us] of [[1, 0, 2, 3, wx], [4, 5, 7, 6, wx], [0, 4, 6, 2, wz], [5, 1, 3, 7, wz]]) quad(P[a], P[bb], P[cc], P[d], tint, Math.max(1, Math.round(us)), Math.max(1, Math.round(hy)));   // -z, +z, -x, +x walls, counter-clockwise from outside
        quad(P[6], P[7], P[3], P[2], top, 0, 0);
      } else {
        const r = (b.max.x - b.min.x) * .45 * it.sx, h = b.max.y * it.sy, cy = h * .64, ry = h * .34, o = new T.Vector3(it.x, it.y + cy, it.z);
        c.set(leaf || '#4f9a45');
        const ring = [0, 1, 2, 3].map(k => new T.Vector3(Math.cos(k * Math.PI / 2 + it.ry) * r, 0, Math.sin(k * Math.PI / 2 + it.ry) * r).add(o)), up = o.clone().setY(o.y + ry), dn = o.clone().setY(o.y - ry * .8);
        for (let k = 0; k < 4; k++) for (const tip of [up, dn]) { const a = ring[k], bq = ring[(k + 1) % 4], tri = tip === up ? [a, tip, bq] : [a, bq, tip]; v.subVectors(tri[1], tri[0]).cross(new T.Vector3().subVectors(tri[2], tri[0])).normalize(); if (v.y * (tip === up ? 1 : -1) < 0) v.negate(); const cl = tip === up ? c : c.clone().multiplyScalar(.75);
          for (const p of tri) { pos.push(p.x, p.y, p.z); nor.push(v.x, v.y, v.z); col.push(cl.r, cl.g, cl.b); uv.push(.04, .04); } }
      }
    }
    const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); g.setAttribute('normal', new T.Float32BufferAttribute(nor, 3)); g.setAttribute('color', new T.Float32BufferAttribute(col, 3)); g.setAttribute('uv', new T.Float32BufferAttribute(uv, 2)); g.computeBoundingSphere();
    const m = new T.Mesh(g, mat); m.visible = false; m.matrixAutoUpdate = false; scene.add(m); e.ip = m; e.imp = null;
  }
};
W.updateLOD = function (x, z) {
  const L = W.LOD;
  for (const e of LODS.values()) {
    const dx = Math.max(e.x0 - x, 0, x - e.x1), dz = Math.max(e.z0 - z, 0, z - e.z1), d = Math.sqrt(dx * dx + dz * dz);
    const near = d < L.near + (e.near ? 12 : -12), mid = near && d < L.minor + (e.mid ? 12 : -12);
    if (near !== e.near) { e.near = near; for (const m of e.det) m.visible = near; }
    if (mid !== e.mid) { e.mid = mid; for (const m of e.minor) m.visible = mid; }
    if (e.ip) { const v = !near && d < L.far; if (e.ip.visible !== v) e.ip.visible = v; }
    for (const p of e.props) { const v = d < p.r; if (p.m.visible !== v) p.m.visible = v; }
  }
  for (const c of W.cull) { const dx = c.x - x, dz = c.z - z, v = dx * dx + dz * dz < c.r2; if (c.o.visible !== v) c.o.visible = v; }
};

/* ================= DISTRICTS & BUILDINGS ================= */
const PAL = {
  res: ['#ff9ec7', '#8fd3ff', '#ffd166', '#9be3b5', '#c7a6ff', '#ffb38a', '#7ad7d0', '#fff1c9', '#ff7a6b', '#b5e36b', '#f7a8ff', '#ffe3a3'],
  mission: ['#ffb347', '#ff6f91', '#4ecdc4', '#ffe66d', '#c06cff', '#ff8c42', '#7bd389'],
  glass: ['#a6d0f0', '#b9dcf2', '#8fb8e0', '#c4e0f5'], stone: ['#f0dcc0', '#e3cfae', '#f5e6cf', '#d9c3a0'],
  brick: ['#c05a3c', '#b0503a', '#d0714a', '#a8452f'], china: ['#ffd7a8', '#ffc6c6', '#fff0cf'], stucco: ['#fff0d4', '#ffe0e8', '#e3f4ff', '#f0ffe0', '#ffe9c2'],
  haight: ['#ff4fa3', '#7a5cff', '#29d3c8', '#ffd23f', '#ff8a3d', '#b5e36b', '#ff5a5a', '#c06cff', '#4ecdc4'],
  pastel: ['#ffc6d9', '#bfe4ff', '#fff0a8', '#c8f0c0', '#ffd2b0', '#dccaff', '#b9efe6', '#ffe0f0', '#f9e2c0', '#ffe9a8'],
};
function district(x, z) {
  const southOfMkt = (x - W.MKT.a.x) * W.MKT.d.y - (z - W.MKT.a.y) * W.MKT.d.x < 0;
  if (x > 0 && x < 60 && z > -130 && z < -30) return 'china';
  if (x > 40 && z < 60 && !southOfMkt) return 'fidi';
  if (x > 40 && southOfMkt && z < 130) return 'soma';
  if (x > 90 && z > 430) return 'bayview';
  if (x > 180 && z >= 130) return 'dogpatch';
  if (x > 100 && z >= 130) return 'potrero';
  if (x > -30 && x < 110 && z > 300) return 'bernal';
  if (x > -110 && x < 110 && z >= 120) return 'mission';
  if (x > -170 && z > 430) return 'excelsior';
  if (x > -170 && z > 262) return 'noe';
  if (x < -262 && z < 46) return 'richmond';
  if (x < -410 && z > 400) return 'parkmerced';
  if (x < -262 && z > 150) return 'sunset';
  if (x < -170 && z > 262) return 'westportal';
  if (x < -200 && z > 148) return 'sunset';
  if (x < -100 && z > 90 && z < 170) return 'haight';
  if (x < -110 && z < -130) return 'marina';
  if (x > -60 && x < 0 && z > -120 && z < -30) return 'nob';
  return 'res';
}
W.district = district;
const MIX = {
  res: [['vic_a', 3], ['vic_b', 3], ['vic_c', 3], ['edw', 2], ['corner', 1]],
  nob: [['edw', 3], ['deco', 1], ['vic_b', 1]],
  china: [['china', 4], ['corner', 1]],
  fidi: [['glass', 3], ['deco', 3]],
  soma: [['brick', 3], ['glass', 1], ['corner', 1], ['deco', 1]],
  dogpatch: [['brick', 3], ['corner', 2], ['mission', 1]],
  mission: [['mission', 4], ['vic_a', 2], ['corner', 1], ['vic_c', 1]],
  sunset: [['stucco', 5], ['corner', 1]],
  richmond: [['stucco', 3], ['edw', 2], ['vic_b', 1], ['corner', 1]],
  westportal: [['stucco', 3], ['edw', 2], ['corner', 1], ['mission', 1]],
  haight: [['vic_a', 3], ['vic_b', 3], ['vic_c', 3], ['corner', 1]],
  marina: [['stucco', 3], ['edw', 2], ['vic_b', 1]],
  noe: [['vic_a', 3], ['vic_b', 2], ['vic_c', 2], ['edw', 2], ['corner', 1]],
  bernal: [['stucco', 3], ['vic_a', 2], ['vic_c', 1], ['corner', 1]],
  potrero: [['vic_b', 2], ['stucco', 2], ['edw', 1], ['corner', 1], ['brick', 1]],
  excelsior: [['stucco', 4], ['corner', 1], ['mission', 1]],
  bayview: [['stucco', 3], ['brick', 2], ['corner', 1], ['mission', 1]],
  parkmerced: [['deco', 3], ['glass', 1]],
};
const PASTEL = /sunset|richmond|excelsior|westportal|bayview|bernal/;
function palFor(type, dist) { if (dist === 'haight' && type !== 'corner') return PAL.haight; if (type === 'stucco' && PASTEL.test(dist)) return PAL.pastel; if (type.startsWith('vic') || type === 'edw' || type === 'corner') return PAL.res; if (type === 'mission') return PAL.mission; if (type === 'glass') return PAL.glass; if (type === 'deco') return PAL.stone; if (type === 'brick') return PAL.brick; if (type === 'china') return PAL.china; return PAL.stucco; }
function wpick(list) { let s = 0; list.forEach(l => s += l[1]); let r = Math.random() * s; for (const l of list) { r -= l[1]; if (r <= 0) return l[0]; } return list[0][0]; }
const CAST = n => ['wall', 'brick', 'glass', 'red', 'roof'].concat(n === 'deco' ? ['stone'] : n === 'china' ? ['green'] : []);
W.muralWalls = []; W.billboardSpots = [];
function buildBlocks() {
  const B = K.assets.buildings;
  const kits = {}; ['vic_a', 'vic_b', 'vic_c', 'edw', 'deco', 'glass', 'brick', 'mission', 'china', 'corner', 'stucco'].forEach(n => { const k = kitParts(B, n); if (k) kits[n] = k; });
  const inst = {}; for (const n in kits) inst[n] = new Instancer(kits[n], n === 'glass' ? ['glass'] : n === 'brick' ? ['brick'] : ['wall']);
  const muralKeys = ['mural_mission1', 'mural_mission2', 'mural_mission3', 'mural_tech', 'mural_fog'];
  const muralInst = [];
  if (kits.mission) muralKeys.forEach(k => { const img = K.assets[k]; if (!img) return; const t = new T.Texture(img); t.encoding = T.sRGBEncoding; t.flipY = true; t.needsUpdate = true;
    const kit = { box: kits.mission.box, name: 'mission', parts: kits.mission.parts.map(p => p.mat.name === 'mural' ? Object.assign({}, p, { mat: K.toon('#ffffff', { map: K.surfaceTexture(t, p.geo) }) }) : p) }; muralInst.push(new Instancer(kit, ['wall'])); });
  const has = Object.keys(kits).length > 0;
  const xs = [TG.x0].concat(W.XR, [258]), zs = [-212].concat(W.ZR, [600]);
  const corners = (k, x, z, rot) => [[k.box.min.x, k.box.min.z], [k.box.max.x, k.box.min.z], [k.box.min.x, k.box.max.z], [k.box.max.x, k.box.max.z]].map(([a, b]) => [x + Math.cos(rot) * a + Math.sin(rot) * b, z - Math.sin(rot) * a + Math.cos(rot) * b]);
  const put = (type, x, z, rot, dist, cs) => {
    const k = kits[type]; let ymin = 1e9; for (const [cx, cz] of cs) ymin = Math.min(ymin, W.terrainH(cx, cz));
    const tall = type === 'glass' || type === 'deco';
    const sy = tall ? U.rand(.75, 1.45) * (dist === 'fidi' ? 1.15 : .8) : 1;
    const y = ymin - .3;
    const placed = (type === 'mission' && muralInst.length ? U.pick(muralInst) : inst[type]).add(x, y, z, rot, 1, sy, 1, U.pick(palFor(type, dist)));
    if (!placed) return 0;
    const top = placed.y + k.box.max.y * sy;
    if (top < 32) W.perches.push({ x: placed.x, y: top + .05, z: placed.z, kind: 'roof' });
    W.lastBuilding = placed;
    W.addBox(Math.min(...cs.map(v => v[0])) + placed.x - x, Math.max(...cs.map(v => v[0])) + placed.x - x, Math.min(...cs.map(v => v[1])) + placed.z - z, Math.max(...cs.map(v => v[1])) + placed.z - z, top);
    return top;
  };
  const place = (type, x, z, rot, dist) => {
    const k = kits[type]; if (!k) return 0;
    const sz = k.box.getSize(new T.Vector3()); const w = sz.x, d = sz.z;
    // footprint axis aligned after rot (multiples of 90deg)
    const sw = Math.abs(Math.sin(rot)) > .5 ? d : w, sd = Math.abs(Math.sin(rot)) > .5 ? w : d;
    const cs = corners(k, x, z, rot);
    for (const [cx, cz] of cs) { if (!landAt(cx, cz) || W.reserved(cx, cz, 0) || W.onMarket(cx, cz, 2)) return 0; }
    if (W.reserved(x, z, 2) || W.onMarket(x, z, 4)) return 0;
    const top = put(type, x, z, rot, dist, cs);
    if (!top) return 0;
    if ((type === 'brick' || type === 'edw') && Math.random() < .12) W.billboardSpots.push({ x: W.lastBuilding.x, z: W.lastBuilding.z, rot, y: top, w: sw, d: sd });
    return sw;
  };
  for (let i = 0; i < xs.length - 1; i++) for (let j = 0; j < zs.length - 1; j++) {
    const bx0 = xs[i] + 9, bx1 = xs[i + 1] - 9, bz0 = zs[j] + 9, bz1 = zs[j + 1] - 9;
    if (bx1 - bx0 < 8 || bz1 - bz0 < 8) continue;
    const cx = (bx0 + bx1) / 2, cz = (bz0 + bz1) / 2; const dist = district(cx, cz); const mix = MIX[dist];
    const isAlley = Math.abs(cx + 20) < 2 && Math.abs(cz - 10) < 2;
    if (isAlley) { W.alley = { x: bx0 + 11, z: cz, face: -Math.PI / 2 }; const dump = new T.Mesh(new T.BoxGeometry(2.6, 1.7, 1.5), toon('#2f7d4f')); dump.position.set(bx0 + 7, W.terrainH(bx0 + 7, cz + 4) + .85, cz + 4); dump.castShadow = true; scene.add(dump); W.addBox(bx0 + 5.7, bx0 + 8.3, cz + 3.25, cz + 4.75, W.terrainH(bx0 + 7, cz + 4) + 1.7); }
    if (!has) continue;
    if (dist === 'fidi' || (dist === 'soma' && Math.random() < .4) || dist === 'parkmerced') {
      // towers: fill quadrants
      for (const [qx, qz] of [[bx0 + 11, bz0 + 11], [bx1 - 11, bz0 + 11], [bx0 + 11, bz1 - 11], [bx1 - 11, bz1 - 11]]) { if (Math.random() < (dist === 'parkmerced' ? .6 : .85)) place(wpick(mix), qx, qz, U.pick([0, Math.PI / 2, Math.PI, -Math.PI / 2]), dist); }
      continue;
    }
    // perimeter rows: north edge faces -z (rot PI), south edge faces +z (rot 0)
    const rowDepth = 14;
    for (const [edgeZ, rot] of [[bz0, Math.PI], [bz1, 0]]) {
      let x = bx0;
      while (x < bx1 - 4) { const type = wpick(mix); const k = kits[type]; if (!k) { x += 8; continue; } const w = k.box.max.x - k.box.min.x, d = k.box.max.z - k.box.min.z; if (x + w > bx1 + .5) break;
        const z = rot === 0 ? edgeZ - d / 2 : edgeZ + d / 2; const used = place(type, x + w / 2, z, rot, dist); x += (used || w) + U.rand(0, .6); }
    }
    for (const [edgeX, rot] of [[bx0, -Math.PI / 2], [bx1, Math.PI / 2]]) {
      if (isAlley && edgeX === bx0) continue;
      let z = bz0 + rowDepth;
      while (z < bz1 - rowDepth - 4) { const type = wpick(mix); const k = kits[type]; if (!k) { z += 8; continue; } const w = k.box.max.x - k.box.min.x, d = k.box.max.z - k.box.min.z; if (z + w > bz1 - rowDepth + .5) break;
        const x = rot > 0 ? edgeX - d / 2 : edgeX + d / 2; const used = place(type, x, z + w / 2, rot, dist); z += (used || w) + U.rand(0, .6); }
    }
  }
  // Presidio Main Post: red-brick barracks around the parade lawn (inside the park, so placed directly)
  if (kits.brick) for (const [x, z, r] of [[-356, -146, 0], [-326, -146, 0], [-296, -146, 0], [-356, -100, Math.PI], [-326, -100, Math.PI]]) put('brick', x, z, r, 'presidio', corners(kits.brick, x, z, r));
  for (const n in inst) inst[n].build({ lod: 'bld', cast: CAST(n) });
  muralInst.forEach(m => m.build({ lod: 'bld', cast: CAST('mission') }));
}

/* ================= LANDMARKS ================= */
W.landmark = {};
function lmPut(name, x, z, ry, s, yOff) {
  const L = K.assets.landmarks; const node = L && L.scene.getObjectByName(name);
  if (!node) return null;
  const o = node.clone(true); const y = (yOff != null ? yOff : W.terrainH(x, z));
  o.position.set(x, y, z); o.rotation.set(0, ry || 0, 0); if (s) o.scale.setScalar(s);
  scene.add(o); o.updateMatrixWorld(true);
  let b = new T.Box3().setFromObject(o);
  if (!/ggb_|lighthouse|alcatraz|oracle_|chinagate|palace/.test(name)) {
    const local = b.clone(); local.min.sub(o.position); local.max.sub(o.position);
    const it = { x, y, z, ry: 0, sx: 1, sy: 1, sz: 1 };
    if (W.supportPlacement(name, local, it, 'landmark')) { o.position.set(it.x, it.y, it.z); o.updateMatrixWorld(true); b = new T.Box3().setFromObject(o); }
    else o.visible = false;
  }
  W.landmark[name] = { o, b };
  return o;
}
function lmBox(name, pad, top) { const l = W.landmark[name]; if (!l) return; const b = l.b; W.addBox(b.min.x, b.max.x, b.min.z, b.max.z, top != null ? top : b.max.y); }
function buildLandmarks() {
  lmPut('transamerica', 95, -110, 0); lmBox('transamerica', 1);
  lmPut('montgomery44', 115, -40, 0); lmBox('montgomery44', 0);
  lmPut('salesforce', 175, 12, 0); lmBox('salesforce', 1);
  lmPut('ferry', 244, -110, -Math.PI / 2); lmBox('ferry', 0);
  lmPut('coit', 40, -165, 0, 1, W.terrainH(40, -165) - .5); { const l = W.landmark.coit; if (l) W.addCircle(40, -165, 3.8, l.b.max.y); }
  lmPut('palace', -198, -176, 0); { const l = W.landmark.palace; if (l) { for (let k = 0; k < 8; k++) { const a = k * Math.PI / 4; W.addCircle(-198 + Math.cos(a) * 9, -176 + Math.sin(a) * 9, .9, 20); } } }
  buildHome();
  lmPut('painted', -126, 10, -Math.PI / 2); lmBox('painted', 0);
  W.windSails = [];   // Dutch + Murphy windmills guard the ocean end of Golden Gate Park
  for (const wz of [62, 138]) { const o = lmPut('windmill', -688, wz, Math.PI / 2); if (o) { W.addCircle(-688, wz, 4, W.landmark.windmill.b.max.y); const s = o.getObjectByName('windmill_sails'); if (s) W.windSails.push(s); } }
  lmPut('conservatory', -196, 66, 0); lmBox('conservatory', 1);
  lmPut('sutro', -205, 170, 0, 1, W.terrainH(-205, 170) - .5); W.addCircle(-205, 170, 5, 80);
  lmPut('chinagate', 10, -50, 0); { const l = W.landmark.chinagate; if (l) { W.addBox(l.b.min.x, l.b.min.x + 1.6, -51, -49, 9); W.addBox(l.b.max.x - 1.6, l.b.max.x, -51, -49, 9); } }
  lmPut('lighthouse', 26, -392, 0, 1, 4); lmBox('lighthouse'); lmPut('alcatraz_cellhouse', 44, -400, 0, 1, 3.5); lmBox('alcatraz_cellhouse');
  for (const tz of [-262, -416]) { const o = lmPut('ggb_tower', -230, tz, 0, 1, -3); if (o) for (const s of [-1, 1]) { const a = -230 + s * 9, b = -230 + s * 14.8; W.addBox(Math.min(a, b), Math.max(a, b), tz - 4.4, tz + 4.4, 77, { bot: -3 }); } }   // the two legs only: the deck runs between them
  lmPut('oracle_glove', W.STAD.x + Math.cos(W.STAD.gate + Math.PI + .7) * 40, W.STAD.z + Math.sin(W.STAD.gate + Math.PI + .7) * 40, -W.STAD.gate, 1, 15);
  lmPut('oracle_bottle', W.STAD.x + Math.cos(W.STAD.gate + Math.PI + 1.0) * 40, W.STAD.z + Math.sin(W.STAD.gate + Math.PI + 1.0) * 40, 0, 1, 15);
  for (const name of ['oracle_glove', 'oracle_bottle']) { const l = W.landmark[name]; if (l) W.meshColliders(l.o); }
  const clockTex = K.canvasTex(256, 256, g => { g.fillStyle = '#fff8e6'; g.beginPath(); g.arc(128, 128, 124, 0, 7); g.fill(); g.strokeStyle = '#241634'; g.lineWidth = 12; g.stroke(); for (let i = 0; i < 12; i++) { const a = i * Math.PI / 6; g.fillStyle = '#241634'; g.fillRect(128 + Math.cos(a) * 98 - 5, 128 + Math.sin(a) * 98 - 5, 10, 10); } g.lineWidth = 12; g.beginPath(); g.moveTo(128, 128); g.lineTo(128, 52); g.moveTo(128, 128); g.lineTo(186, 150); g.stroke(); });
  clockTex.flipY = true;
  const fc = scene.getObjectByName('ferry_clock'); if (fc) fc.traverse(o => { if (o.isMesh) o.material = new T.MeshBasicMaterial({ map: K.surfaceTexture(clockTex, o) }); });
  buildOutlands();
}
/* procedural landmarks for the new districts: primitives merged into one mesh per colour (few draw calls), ink outlines */
const xf = (geo, x, y, z, ry, sx, sy, sz, rz) => geo.applyMatrix4(new T.Matrix4().compose(new T.Vector3(x, y, z), new T.Quaternion().setFromEuler(new T.Euler(0, ry || 0, rz || 0)), new T.Vector3(sx || 1, sy || 1, sz || 1)));
function merged(list, ink, parent) {   // list: [geometry, colour] pairs (already placed)
  const by = {}, g = new T.Group(); for (const [geo, col] of list) (by[col] = by[col] || []).push(geo);
  for (const col in by) { const o = new T.Mesh(T.BufferGeometryUtils.mergeBufferGeometries(by[col]), toon(col)); o.castShadow = o.receiveShadow = true; g.add(o); }
  if (ink) K.inkShell(g, ink); (parent || scene).add(g); return g;
}
const bx = (w, h, d, col, x, y, z, ry) => [xf(new T.BoxGeometry(w, h, d), x, y, z, ry), col];
function buildOutlands() {
  // Golden Gate toll plaza on the bridge approach (International Orange canopy, one booth)
  const tz = -186, tp = [bx(30, 1.1, 11, '#e0512f', -230, 7.7, tz), bx(31, .5, 11.6, '#f4efe6', -230, 7, tz), bx(1.8, 2.8, 3.4, '#f4efe6', -230, 1.4, tz), bx(2.3, .4, 3.9, '#e0512f', -230, 3, tz), bx(1.9, .9, 2.6, '#29d3c8', -230, 1.9, tz)];
  for (const sx of [-244, -216]) for (const sz of [tz - 4.5, tz + 4.5]) { tp.push(bx(1.2, 7, 1.2, '#b9c3cf', sx, 3.5, sz)); W.addBox(sx - .6, sx + .6, sz - .6, sz + .6, 7); }
  merged(tp, .06); W.addBox(-231.1, -228.9, tz - 1.9, tz + 1.9, 3.2); W.addBox(-245, -215, tz - 5.5, tz + 5.5, 8.3, { bot: 6.75 });
  // Cliff House on the bluff above Ocean Beach, Seal Rocks offshore
  const chx = -764, chz = -34; let chy = Math.min(...[[-6, -11], [6, -11], [-6, 11], [6, 11]].map(([a, b]) => W.terrainH(chx + a, chz + b))) - .3;
  const cliff = { x: chx, y: chy, z: chz, ry: 0, sx: 1, sy: 1, sz: 1 };
  W.supportPlacement('Cliff House', new T.Box3(new T.Vector3(-6.4, 0, -11.4), new T.Vector3(6.4, 10.6, 11.4)), cliff, 'building'); chy = cliff.y;
  merged([bx(12, 6.5, 22, '#f4efe6', chx, chy + 3.25, chz), bx(12.3, 1.7, 22.3, '#26344a', chx, chy + 3.9, chz), bx(12.8, .7, 22.8, '#2f8f9d', chx, chy + 6.8, chz), bx(8, 3, 10, '#fff8ea', chx + 1, chy + 8.6, chz - 3), bx(8.4, .5, 10.4, '#ff5a5a', chx + 1, chy + 10.3, chz - 3)], .06);
  W.addBox(chx - 6.4, chx + 6.4, chz - 11.4, chz + 11.4, chy + 7.2); W.addBox(chx - 3, chx + 5, chz - 8, chz + 2, chy + 10.6);
  W.sealRocks = []; const rocks = [];
  for (const [x, z, r] of [[-810, -50, 7], [-822, -33, 5.5], [-806, -20, 4.5]]) { rocks.push([xf(new T.DodecahedronGeometry(r, 0), x, -1.2, z, x, 1.25, .75, 1), '#8f7d6f']); W.sealRocks.push([x, z, -1.2 + r * .7]); }
  merged(rocks, .08);
  // Golden Gate Park bison paddock: split-rail fence and four very round bison
  const P = { x0: -628, x1: -588, z0: 108, z1: 140 }, fence = [];
  for (const [ax, az, bxx, bz] of [[P.x0, P.z0, P.x1, P.z0], [P.x1, P.z0, P.x1, P.z1], [P.x1, P.z1, P.x0, P.z1], [P.x0, P.z1, P.x0, P.z0]]) {
    const len = Math.hypot(bxx - ax, bz - az), mx = (ax + bxx) / 2, mz = (az + bz) / 2, ry = Math.atan2(bxx - ax, bz - az), y = W.terrainH(mx, mz);
    for (const h of [.7, 1.3]) fence.push(bx(.18, .18, len, '#8a5a3a', mx, y + h, mz, ry));
    for (let k = 0; k <= len; k += 4) { const x = ax + (bxx - ax) * k / len, z = az + (bz - az) * k / len; fence.push(bx(.3, 1.7, .3, '#6b4424', x, W.terrainH(x, z) + .85, z)); }
    W.addBox(Math.min(ax, bxx) - .2, Math.max(ax, bxx) + .2, Math.min(az, bz) - .2, Math.max(az, bz) + .2, y + 1.6);
  }
  W.addCull(merged(fence), (P.x0 + P.x1) / 2, (P.z0 + P.z1) / 2, 260);
  for (const [x, z, ry] of [[-616, 118, .6], [-600, 126, -2.2], [-610, 132, 2.8], [-596, 114, -.9]]) { const b = bison(); const y = W.terrainH(x, z); b.position.set(x, y, z); b.rotation.y = ry; W.addCircle(x, z, 1.5, y + 2.3); W.addCull(b, x, z, 220); }
  // Hunters Point shipyard gantry crane
  const red = '#d63a2f', cr = [bx(40, 4, 14, red, 282, 38, 485), bx(40.4, 1, 14.4, '#f4efe6', 282, 35.6, 485), bx(36, 2.2, 3, red, 318, 39.2, 485), bx(6, 4.4, 6, '#f4efe6', 262, 33, 485), bx(.3, 16, .3, '#2d2f36', 326, 30, 485)];
  for (const lx of [268, 296]) { for (const lz of [480, 490]) { cr.push(bx(1.8, 36, 1.8, red, lx, 18, lz)); W.addBox(lx - .9, lx + .9, lz - .9, lz + .9, 36); } cr.push(bx(1.2, 1.2, 10, '#f4efe6', lx, 12, 485), bx(1.2, 1.2, 10, '#f4efe6', lx, 24, 485)); }
  merged(cr, .08); W.addBox(262, 302, 478, 492, 40, { bot: 36 });
}
function bison() {
  const sph = () => new T.SphereGeometry(1, 12, 9), dark = '#3a2618';
  const parts = [[xf(sph(), 0, 1.55, -.3, 0, .95, .85, 1.35), '#6b4a33'], [xf(sph(), 0, 1.95, .75, 0, 1.05, 1.05, .95), dark], [xf(sph(), 0, 1.35, 1.65, 0, .55, .58, .62), dark], [xf(sph(), 0, 1.6, -1.65, 0, .12, .45, .12), dark]];
  for (const s of [-1, 1]) parts.push([xf(new T.ConeGeometry(.12, .45, 6), s * .45, 1.78, 1.75, 0, 1, 1, 1, -s * 1.1), '#efe2c4']);
  for (const [x, z] of [[-.45, .7], [.45, .7], [-.45, -1], [.45, -1]]) parts.push(bx(.32, 1, .32, dark, x, .5, z));
  return merged(parts, .05);
}

/* ================= PASCAL'S HOME: Mission Rock (from the user's photo) ================= */
W.HOME = { x: 232, z: 202, start: { x: 246, z: 184.5, heading: 2.35 } };   // foot-of-stairs origin; complex faces north (-z) toward Oracle Park; start = plaza spawn facing the bay
// the model's east/west gable walls are blank brick (very visible from the bay and the start plaza): paint window floors on them in the shader
function homeFacade(root) {
  const done = new Map();
  root.traverse(c => { if (!c.isMesh) return; const f = m => { if (!m || !/^mr_brick/.test(m.name)) return m; if (done.has(m)) return done.get(m); const n = m.clone(); done.set(m, n);
    n.onBeforeCompile = sh => {
      sh.vertexShader = 'varying vec3 vFacP; varying vec3 vFacN;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n  vFacP = (modelMatrix * vec4(transformed, 1.0)).xyz; vFacN = normalize(mat3(modelMatrix) * objectNormal);');
      sh.fragmentShader = 'varying vec3 vFacP; varying vec3 vFacN;\n' + sh.fragmentShader.replace('#include <map_fragment>', `#include <map_fragment>
  if (abs(vFacN.x) > 0.8 && vFacP.y > 0.3) {
    float u = vFacP.z, v = vFacP.y; vec2 q = vec2(u, v - 0.6) / vec2(3.1, 3.4); vec2 f = fract(q), id = floor(q);
    float up = step(4.4, v);
    float frame = up * step(0.14, f.x) * step(f.x, 0.86) * step(0.18, f.y) * step(f.y, 0.9);
    float win = up * step(0.2, f.x) * step(f.x, 0.8) * step(0.24, f.y) * step(f.y, 0.84);
    float mull = step(abs(f.x - 0.5), 0.018);
    float lit = step(0.7, fract(sin(dot(id, vec2(12.9898, 78.233))) * 43758.5453));
    vec3 glass = mix(vec3(0.15, 0.23, 0.33) + 0.16 * (1.0 - f.y), vec3(1.0, 0.8, 0.46), lit);
    float sill = up * step(0.14, f.x) * step(f.x, 0.86) * step(0.12, f.y) * step(f.y, 0.18);
    vec3 c = diffuseColor.rgb; c = mix(c, vec3(0.9, 0.86, 0.78), max(frame, sill)); c = mix(c, glass, win * (1.0 - mull));
    float sf = (1.0 - up) * step(0.06, fract(u / 6.2)) * step(fract(u / 6.2), 0.94) * step(0.6, v) * step(v, 3.6);
    c = mix(c, mix(vec3(0.17, 0.27, 0.33), vec3(0.95, 0.78, 0.5), step(0.5, fract(u / 12.4)) * 0.55), sf);
    diffuseColor.rgb = c; }`); };
    n.customProgramCacheKey = () => 'mrFacade'; return n; };
    c.material = Array.isArray(c.material) ? c.material.map(f) : f(c.material); });
}
function buildHome() {
  const H = W.HOME, ox = H.x, oz = H.z; const G = K.assets.missionrock;
  const node = G && G.scene.getObjectByName('missionrock_complex');
  if (node) { const o = node.clone(true), hg = new T.Group(); hg.add(o); homeFacade(o); hg.position.set(ox, 0, oz); hg.rotation.y = Math.PI; o.traverse(c => { if (c.isMesh) { c.castShadow = true; c.receiveShadow = true; } }); scene.add(hg); W.meshColliders(hg, m => /fence|railing|planter/.test(m.name)); }   // keep the node's own offset (model origin sits mid-height)
  W.addBox(ox - 23, ox - 6, oz - 6, oz + 18, 26.6); W.addBox(ox + 6, ox + 23, oz - 6, oz + 18, 26.6);
  W.addBox(ox - 12.4, ox + 12.4, oz + 5.6, oz + 28.4, 75);
  const N = 14, rise = 3.6 / N, run = .62;
  for (let i = 0; i < N; i++) W.addBox(ox - 6, ox + 6, oz - 8 + i * run, oz - 8 + (i + 1) * run, rise * (i + 1), { step: true });
  W.addBox(ox - 6, ox + 6, oz + .68, oz + 5.6, 3.6, { step: true });
  for (let i = 0; i < N; i += 3) for (const s of [-1, 1]) W.addBox(ox + s * 5.2 - .7, ox + s * 5.2 + .7, oz - 8 + i * run, oz - 8 + i * run + 1.8, rise * (i + 2) + .6);
  H.top = { x: ox, y: 3.6, z: oz + 3 }; H.foot = { x: ox, y: 0, z: oz - 10 };
}

/* ================= STADIUM (Oracle Park) ================= */
function buildStadium() {
  const S = W.STAD, hm = .17, ts = Math.PI / 2 - S.gate + hm, tl = Math.PI * 2 - 2 * hm, g = new T.Group(); g.position.set(S.x, 0, S.z); scene.add(g);
  const add = (geo, m, y, o) => { const mesh = new T.Mesh(geo, m); mesh.position.y = y; if (o) Object.assign(mesh.rotation, o); mesh.castShadow = mesh.receiveShadow = true; g.add(mesh); return mesh; };
  const stripes = K.canvasTex(64, 64, (c) => { for (let i = 0; i < 8; i++) { c.fillStyle = i % 2 ? '#5bbf4a' : '#6fd35a'; c.fillRect(i * 8, 0, 8, 64); } }, true); stripes.repeat.set(8, 8);
  add(new T.CircleGeometry(S.r0, 48).rotateX(-Math.PI / 2), toon('#ffffff', { map: stripes }), .08);
  add(new T.RingGeometry(S.r0 - 3, S.r0, 48).rotateX(-Math.PI / 2), toon('#c8895a'), .1);
  const dir = [Math.cos(S.gate), Math.sin(S.gate)], D = [dir[0] * 14, dir[1] * 14];
  const dia = add(new T.PlaneGeometry(15, 15).rotateX(-Math.PI / 2).rotateY(-S.gate + Math.PI / 4), toon('#d19a64'), .12); dia.position.x = D[0]; dia.position.z = D[1];
  const mound = add(new T.CylinderGeometry(1.8, 2.4, .5, 16), toon('#d19a64'), .3); mound.position.x = D[0]; mound.position.z = D[1];
  W.mound = [S.x + D[0], S.z + D[1]];
  // Sweep a radial/height profile along the original gate arc. Analytic normals
  // smooth the circumference while retaining crisp tread/riser corners.
  const sweep = (strips, repeats = 1) => {
    const positions = [], normals = [], uvs = [], indices = [], segments = 192;
    for (const [ra, ya, rb, yb, va = 0, vb = 1] of strips) {
      const base = positions.length / 3, dr = rb - ra, dy = yb - ya, len = Math.hypot(dr, dy);
      for (let i = 0; i <= segments; i++) {
        const a = ts + tl * i / segments, sn = Math.sin(a), cs = Math.cos(a);
        positions.push(ra * sn, ya, ra * cs, rb * sn, yb, rb * cs);
        normals.push(-dy * sn / len, dr / len, -dy * cs / len, -dy * sn / len, dr / len, -dy * cs / len);
        // Reverse U so painted lettering reads correctly from inside the bowl.
        const u = (1 - i / segments) * repeats; uvs.push(u, va, u, vb);
        if (i < segments) { const n = base + i * 2; indices.push(n, n + 1, n + 2, n + 1, n + 3, n + 2); }
      }
    }
    const geo = new T.BufferGeometry();
    geo.setAttribute('position', new T.Float32BufferAttribute(positions, 3));
    geo.setAttribute('normal', new T.Float32BufferAttribute(normals, 3));
    geo.setAttribute('uv', new T.Float32BufferAttribute(uvs, 2)); geo.setIndex(indices);
    geo.computeBoundingSphere(); return geo;
  };
  const ringProfile = (r, width, y, height) => {
    const a = r - width / 2, b = r + width / 2, lo = y - height / 2, hi = y + height / 2;
    return [[a, lo, a, hi], [a, hi, b, hi], [b, hi, b, lo], [b, lo, a, lo]];
  };
  const wallR = S.r0 + .25;
  const pads = K.canvasTex(2048, 256, c => {
    c.fillStyle = '#194e40'; c.fillRect(0, 0, 2048, 256);
    for (let x = 0; x < 2048; x += 32) {
      c.fillStyle = '#103b32'; c.fillRect(x, 0, 3, 256);
      c.fillStyle = '#2a6753'; c.fillRect(x + 4, 0, 2, 256);
    }
    c.fillStyle = '#fff0b5'; c.font = 'bold 64px sans-serif'; c.textAlign = 'center';
    c.textBaseline = 'middle';
    ['335', '365', '399', '421', '365'].forEach((n, i) => c.fillText(n, 190 + i * 417, 112));
  });
  add(sweep([[wallR, .12, wallR, 3.5], [wallR + .35, 3.5, wallR + .35, .12]]), toon('#ffffff', { map: pads }), 0);
  add(sweep(ringProfile(wallR + .175, .53, 3.55, .18)), toon('#f6c744'), 0);
  const seats = K.canvasTex(256, 128, c => {
    c.fillStyle = '#243a37'; c.fillRect(0, 0, 256, 128);
    // One seating block per tile: chunky backs/cushions, aisle at each end.
    for (let i = 0; i < 8; i++) {
      const x = 18 + i * 28;
      c.fillStyle = '#122b28'; c.fillRect(x, 25, 24, 94);
      c.fillStyle = i === 2 || i === 5 ? '#df7838' : '#347967'; c.fillRect(x, 14, 22, 48);
      c.fillStyle = i === 2 || i === 5 ? '#f49a51' : '#529581'; c.fillRect(x + 2, 14, 18, 7);
      c.fillStyle = i === 2 || i === 5 ? '#bd592b' : '#286350'; c.fillRect(x, 70, 22, 29);
    }
    c.fillStyle = '#b9b49a'; c.fillRect(0, 0, 12, 128); c.fillRect(244, 0, 12, 128);
    c.fillStyle = '#e4d8b8'; for (let y = 8; y < 128; y += 24) { c.fillRect(0, y, 12, 4); c.fillRect(244, y, 12, 4); }
  }, true);
  const seating = [], concrete = [], rails = [], posts = [];
  const tiers = [[S.r0 + 1.1, 3.9], [S.r0 + 4.0, 7.3], [S.r0 + 6.9, 10.7]];
  for (const [r, y] of tiers) {
    concrete.push([r, y - .55, r, y]);
    for (let row = 0; row < 5; row++) {
      const a = r + row * .44, h = y + row * .56;
      seating.push([a, h, a + .44, h], [a + .44, h, a + .44, h + .56]);
    }
    const back = r + 2.2, floor = y + 2.8;
    concrete.push([back, floor, back + .7, floor]);
    rails.push(...ringProfile(back + .07, .12, floor + .95, .14), ...ringProfile(back + .07, .1, floor + .5, .1));
    const count = Math.round(back * tl / 7);
    for (let i = 0; i <= count; i++) {
      // Keep even the end posts inside the open arc.
      const a = ts + .006 + (tl - .012) * i / count;
      posts.push([Math.sin(a) * (back + .07), floor + .45, Math.cos(a) * (back + .07), a]);
    }
  }
  // All rows/tiers share one seat draw; integer block repeats keep aisles aligned.
  add(sweep(seating, Math.round((S.r0 + 5) * tl / 10)), toon('#ffffff', { map: seats }), 0);
  concrete.push(...ringProfile(S.r1 - .5, .6, 15.1, 1.2), ...ringProfile(S.r1 - .9, 1.4, 15.85, .3));
  add(sweep(concrete), toon('#d9c9a7'), 0);
  add(sweep(rails), toon('#384c46'), 0);
  // Solid end walls where the arc stops at the gate: close the stair profile so the stands no longer end in a hollow, floating cut.
  {
    const wR = wallR + .35, pr = [[wR, 0], [S.r1, 0], [S.r1, 15.4], [S.r1 - .2, 15.4]];
    for (let i = tiers.length - 1; i >= 0; i--) {
      const [r, y] = tiers[i], back = r + 2.2, floor = y + 2.8;
      pr.push([back + .7, floor], [back, floor]);
      for (let row = 4; row >= 0; row--) { const a = r + row * .44, h = y + row * .56; pr.push([a + .44, h + .56], [a, h + .56], [a, h]); }
      pr.push([r, y - .55]);
    }
    pr.push([wR, 3.5]);
    const shape = new T.Shape(pr.map(([r, y]) => new T.Vector2(r, y))), sg = new T.ShapeGeometry(shape);
    for (const a of [ts, ts + tl]) {
      const geo = sg.clone(), q = geo.attributes.position;
      for (let i = 0; i < q.count; i++) { const r = q.getX(i), y = q.getY(i); q.setXYZ(i, r * Math.sin(a), y, r * Math.cos(a)); }
      geo.computeVertexNormals(); geo.computeBoundingSphere();
      add(geo, toon('#d6c6a2', { side: T.DoubleSide }), 0);
    }
  }
  const uprights = new T.InstancedMesh(new T.BoxGeometry(.12, .9, .12), toon('#384c46'), posts.length), transform = new T.Object3D();
  posts.forEach(([x, y, z, a], i) => { transform.position.set(x, y, z); transform.rotation.y = a; transform.updateMatrix(); uprights.setMatrixAt(i, transform.matrix); });
  uprights.castShadow = uprights.receiveShadow = true; g.add(uprights);
  // Oracle Park's King Street facade: red brick, tall arched openings with dark-green steel gates, cream stone base/trim, upper window tier
  const brick = K.canvasTex(256, 576, (c) => {
    const W_ = 256, H_ = 576; c.fillStyle = '#b3472f'; c.fillRect(0, 0, W_, H_);
    for (let y = 0, r = 0; y < H_; y += 9, r++) { c.fillStyle = 'rgba(236,170,140,.35)'; c.fillRect(0, y, W_, 1.5); for (let x = (r % 2) * 11; x < W_; x += 22) c.fillRect(x, y, 1.5, 9); }
    for (let i = 0; i < 90; i++) { c.fillStyle = `rgba(${Math.random() < .5 ? '90,26,16' : '220,120,90'},${.08 + Math.random() * .1})`; c.fillRect(Math.random() * W_, Math.random() * H_, 10 + Math.random() * 14, 8); }
    const cream = '#efe1c4', green = '#1d4b3b', greenL = '#2f725a';
    c.fillStyle = '#e2d3b3'; c.fillRect(0, H_ - 52, W_, 52); c.fillStyle = 'rgba(0,0,0,.12)'; c.fillRect(0, H_ - 54, W_, 3);          // stone base
    const ax = 128, aw = 142, top = H_ * .36, bot = H_ - 52;                                                                           // tall arch
    c.fillStyle = cream; c.beginPath(); c.moveTo(ax - aw / 2 - 12, bot); c.lineTo(ax - aw / 2 - 12, top + aw / 2); c.arc(ax, top + aw / 2, aw / 2 + 12, Math.PI, 0); c.lineTo(ax + aw / 2 + 12, bot); c.fill();
    const gr = c.createLinearGradient(0, top, 0, bot); gr.addColorStop(0, '#0f2c22'); gr.addColorStop(1, '#1d4b3b'); c.fillStyle = gr;
    c.beginPath(); c.moveTo(ax - aw / 2, bot); c.lineTo(ax - aw / 2, top + aw / 2); c.arc(ax, top + aw / 2, aw / 2, Math.PI, 0); c.lineTo(ax + aw / 2, bot); c.fill();
    c.strokeStyle = greenL; c.lineWidth = 3; for (let x = ax - aw / 2 + 12; x < ax + aw / 2; x += 14) { c.beginPath(); c.moveTo(x, bot); c.lineTo(x, top + aw / 2 - Math.sqrt(Math.max(0, (aw / 2) ** 2 - (x - ax) ** 2)) + 6); c.stroke(); }
    c.beginPath(); c.moveTo(ax - aw / 2, top + aw * .72); c.lineTo(ax + aw / 2, top + aw * .72); c.stroke();
    c.fillStyle = cream; c.fillRect(ax - 11, top - 16, 22, 26);                                                                      // keystone
    for (const x of [30, 226]) { c.fillStyle = '#9c3b27'; c.fillRect(x - 13, 0, 26, H_ - 52); c.fillStyle = 'rgba(255,200,170,.18)'; c.fillRect(x - 13, 0, 4, H_ - 52); }   // pilasters
    c.fillStyle = cream; c.fillRect(0, H_ * .2, W_, 12); c.fillRect(0, 10, W_, 16);                                                   // string course + cornice
    for (const x of [78, 178]) { c.fillStyle = cream; c.fillRect(x - 24, H_ * .06 + 10, 48, 58); c.fillStyle = green; c.fillRect(x - 18, H_ * .06 + 16, 36, 46); c.fillStyle = greenL; c.fillRect(x - 1.5, H_ * .06 + 16, 3, 46); }
  }, true);
  brick.repeat.set(37, 1);
  add(new T.CylinderGeometry(S.r1, S.r1, 16, 96, 1, true, ts, tl), toon('#ffffff', { map: brick, side: T.DoubleSide }), 8);
  add(new T.CylinderGeometry(S.r1 + .35, S.r1 + .35, .6, 96, 1, true, ts, tl), toon('#1f5a45', { side: T.DoubleSide }), 17.1);   // green steel crown rail
  add(new T.CylinderGeometry(S.r1 + .5, S.r1 + .5, 1.4, 64, 1, true, ts, tl), toon('#f6ecd8', { side: T.DoubleSide }), 16);
  for (let k = 0; k < 4; k++) { const a = S.gate + Math.PI / 4 + k * Math.PI / 2; const p = add(new T.CylinderGeometry(.5, .7, 36, 8), toon('#6d737c'), 18); p.position.x = Math.cos(a) * 48; p.position.z = Math.sin(a) * 48;
    const l = add(new T.BoxGeometry(7, 3, 1), toon('#fffbe6', { emissive: new T.Color('#fff1b0') }), 36); l.position.x = p.position.x; l.position.z = p.position.z; l.rotation.y = -a + Math.PI / 2; W.addCircle(S.x + p.position.x, S.z + p.position.z, .7, 37.5, { plat: false }); }
  W.addRing(S.x, S.z, S.r0, S.r1 + .5, 17, S.gate, hm);
}

/* ================= WATERFRONT, BRIDGES ================= */
function buildWater() {
  const g = new T.PlaneGeometry(5000, 5000, 1, 1).rotateX(-Math.PI / 2);
  const m = new T.ShaderMaterial({
    uniforms: { time: { value: 0 }, fogColor: { value: scene.fog.color }, fogNear: { value: scene.fog.near }, fogFar: { value: scene.fog.far }, sunDir: { value: new T.Vector3(-1, .35, .15).normalize() }, camPos: { value: K.camera.position } },
    vertexShader: 'varying vec3 wp; void main(){ vec4 w = modelMatrix * vec4(position,1.0); wp = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }',
    fragmentShader: `uniform float time, fogNear, fogFar; uniform vec3 fogColor, sunDir, camPos; varying vec3 wp;
      float h(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453); }
      void main(){
        vec2 p = wp.xz;
        float w1 = sin(p.x * .09 + time * 1.1 + sin(p.y * .05) * 2.0) * sin(p.y * .11 - time * .8);
        float w2 = sin((p.x + p.y) * .05 - time * .6);
        float band = w1 * .6 + w2 * .4;
        vec3 deep = vec3(0.10, 0.34, 0.52), mid = vec3(0.16, 0.56, 0.68), hi = vec3(1.0, 0.72, 0.62);
        vec3 col = mix(deep, mid, smoothstep(-0.2, 0.5, band));
        vec3 v = normalize(camPos - wp);
        vec2 s2 = normalize(sunDir.xz); vec2 v2 = normalize(-v.xz);
        float glint = pow(max(0.0, dot(v2, s2)), 18.0);
        float sparkle = step(0.93, fract(band * 3.0 + h(floor(p * .5)) * .3)) * (0.35 + glint * 1.8);
        col = mix(col, hi, sparkle);
        col += vec3(1.0, 0.45, 0.35) * glint * 0.35;
        float d = length(camPos - wp);
        col = mix(col, fogColor, smoothstep(fogNear, fogFar, d));
        gl_FragColor = vec4(col, 1.0);
      }`,
  });
  const w = new T.Mesh(g, m); w.position.y = -1.6; scene.add(w); W.water = m;
  // piers (wooden decks), posts as one instanced mesh
  const deck = toon('#a8744c'), post = toon('#5b4130'); if (!deck.name) deck.name = 'deck';
  const posts = [];
  for (const r of W.RECTS) {
    if (r.name === 'bridge' || r.name === 'marin') continue;
    const mesh = new T.Mesh(new T.BoxGeometry(r.x1 - r.x0, 1.2, r.z1 - r.z0), deck); mesh.position.set((r.x0 + r.x1) / 2, -.55, (r.z0 + r.z1) / 2); mesh.receiveShadow = mesh.castShadow = true; scene.add(mesh); W.addBox(r.x0, r.x1, r.z0, r.z1, .05, { step: true });
    for (let x = r.x0 + 1; x < r.x1; x += 6) for (let z = r.z0 + 1; z < r.z1; z += 8) posts.push([x, z]);
    if (!r.name && !(r.x0 === 252 && r.z0 === 18)) { const shed = new T.Mesh(new T.BoxGeometry(r.x1 - r.x0 - 2, 6, (r.z1 - r.z0) * .6), toon(U.pick(['#e8d6b8', '#cfe3e8', '#f2c6a8']))); shed.position.set((r.x0 + r.x1) / 2, 3, (r.z0 + r.z1) / 2 + (r.z1 < -180 ? -4 : 0)); shed.castShadow = true; scene.add(shed);
      W.addBox((r.x0 + r.x1) / 2 - (r.x1 - r.x0 - 2) / 2, (r.x0 + r.x1) / 2 + (r.x1 - r.x0 - 2) / 2, shed.position.z - (r.z1 - r.z0) * .3, shed.position.z + (r.z1 - r.z0) * .3, 6); }
  }
  const pg = new T.CylinderGeometry(.35, .35, 3, 6), pim = new T.InstancedMesh(pg, post, posts.length), dm = new T.Object3D();
  posts.forEach(([x, z], i) => { dm.position.set(x, -2, z); dm.updateMatrix(); pim.setMatrixAt(i, dm.matrix); });
  pg.boundingSphere = new T.Sphere(new T.Vector3(180, -2, 100), 480); scene.add(pim);
  // Golden Gate deck, cables, suspenders
  const O = '#e0512f', om = toon(O);
  const L = 270, segs = 70; const dg = new T.PlaneGeometry(20, L, 1, segs).rotateX(-Math.PI / 2); const p = dg.attributes.position;
  for (let i = 0; i < p.count; i++) { const z = p.getZ(i) - 338; p.setY(i, W.bridgeH(z) + .05); } dg.computeVertexNormals();
  const uv = dg.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setY(i, uv.getY(i) * L / 12);
  const bdm = new T.Mesh(dg, toon('#ffffff', { map: W.tex.road })); bdm.position.set(-230, 0, -338); bdm.receiveShadow = true; scene.add(bdm);
  for (const sx of [-240.5, -219.5]) { const s = new T.PlaneGeometry(L, 4, segs, 1).rotateY(Math.PI / 2); const q = s.attributes.position; for (let i = 0; i < q.count; i++) { const z = q.getZ(i) - 338; q.setY(i, W.bridgeH(z) + (q.getY(i) > 0 ? 1.3 : -2.7)); } s.computeVertexNormals();
    const sm = new T.Mesh(s, toon(O, { side: T.DoubleSide })); sm.position.set(sx, 0, 0); sm.position.z = -338; sm.position.x = sx; scene.add(sm); }
  const cy = z => { if (z >= -262) return 14 + 64 * ((-206 - z) / 56); if (z <= -416) return 14 + 64 * ((z + 472) / 56); const t = (z + 339) / 77; return 20 + 58 * t * t; };
  const sus = [];
  for (const sx of [-241, -219]) { const pts = []; for (let z = -206; z >= -472; z -= 4) pts.push(new T.Vector3(sx, cy(z), z)); const tube = new T.Mesh(new T.TubeGeometry(new T.CatmullRomCurve3(pts), 90, .55, 6), om); tube.castShadow = true; scene.add(tube);
    for (let z = -210; z >= -468; z -= 5) { const d = W.bridgeH(z); if (cy(z) - d < 2) continue; sus.push(sx, cy(z), z, sx, d + 1.2, z); } }
  const lg = new T.BufferGeometry(); lg.setAttribute('position', new T.Float32BufferAttribute(sus, 3)); scene.add(new T.LineSegments(lg, new T.LineBasicMaterial({ color: O })));
  // Marin hills + Alcatraz rock
  const hm = toon('#7fb35a'); for (let i = 0; i < 5; i++) { const h = new T.Mesh(new T.SphereGeometry(55, 20, 12), i % 2 ? hm : toon('#a3c265')); h.position.set(-330 + i * 60, -18, -600 + U.rand(-20, 20)); h.scale.set(1.5, .9, 1); scene.add(h); }
  const marin = new T.Mesh(new T.BoxGeometry(150, 3, 80), toon('#8ab85e')); marin.position.set(-225, -1.5, -505); marin.receiveShadow = true; scene.add(marin);
  const rock = new T.Mesh(new T.SphereGeometry(26, 18, 10), toon('#9b8f7c')); rock.scale.set(1.3, .3, .8); rock.position.set(40, -3, -398); scene.add(rock);
  // Bay Bridge
  const bm = toon('#b9c3cf'); const bdeck = new T.Mesh(new T.BoxGeometry(418, 1.6, 16), bm); bdeck.position.set(536, 18, 22); scene.add(bdeck);
  const ramp = new T.Mesh(new T.BoxGeometry(70, 1.6, 16), bm); ramp.position.set(292, 9, 22); ramp.rotation.z = Math.atan(18 / 70); scene.add(ramp);
  const lights = [];
  for (const tx of [370, 490, 610]) { for (const s of [-7, 7]) { const t = new T.Mesh(new T.BoxGeometry(2.4, 52, 2.4), bm); t.position.set(tx, 26, 22 + s); scene.add(t); } }
  for (const s of [-7.5, 7.5]) { const pts = []; for (let x = 310; x <= 730; x += 6) { const tt = ((x - 310) % 120) / 120; const y = 20 + 30 * Math.pow(2 * tt - 1, 2); pts.push(new T.Vector3(x, y, 22 + s)); if (x % 12 === 0) lights.push(x, y + .6, 22 + s); } scene.add(new T.Mesh(new T.TubeGeometry(new T.CatmullRomCurve3(pts), 140, .35, 5), bm)); }
  const lgb = new T.BufferGeometry(); lgb.setAttribute('position', new T.Float32BufferAttribute(lights, 3)); scene.add(new T.Points(lgb, new T.PointsMaterial({ color: '#fff4d0', size: 1.6 })));
  // Ocean Beach surf: two foam lines rolling in and out
  const surfFoam = K.canvasTex(128, 512, c => {
    c.clearRect(0, 0, 128, 512); c.lineCap = 'round';
    for (let band = 0; band < 3; band++) { c.strokeStyle = band ? 'rgba(240,255,246,.3)' : 'rgba(255,255,244,.85)'; c.lineWidth = band ? 2 : 5;
      c.beginPath(); for (let y = 0; y <= 512; y += 4) { const x = 46 + band * 15 + Math.sin(y * Math.PI / 64) * 12 + Math.sin(y * Math.PI / 16) * 3; if (!y) c.moveTo(x, y); else c.lineTo(x, y); } c.stroke();
    }
    c.fillStyle = 'rgba(245,255,245,.55)'; for (let i = 0; i < 90; i++) { const y = i * 5.69, x = 36 + Math.sin(y * Math.PI / 64) * 12 + U.hash(i, 21) * 44; c.beginPath(); c.ellipse(x, y, 1 + U.hash(i, 5) * 2, 2.4, 0, 0, Math.PI * 2); c.fill(); }
  }, true); surfFoam.repeat.set(1, 24);
  W.surf = [0, 1].map(i => { const f = new T.Mesh(new T.PlaneGeometry(i ? 3 : 5, 610).rotateX(-Math.PI / 2), new T.MeshBasicMaterial({ map: surfFoam, color: '#fff8f0', transparent: true, opacity: .6, depthWrite: false })); f.position.set(-798 - i * 9, -1.5, 286); f.renderOrder = 2; scene.add(f); return f; });
}

/* ================= SKY ================= */
function buildSky() {
  const m = new T.ShaderMaterial({
    side: T.BackSide, depthWrite: false, fog: false,
    uniforms: { sunDir: { value: new T.Vector3(-1, .2, .15).normalize() }, time: { value: 0 } },
    vertexShader: 'varying vec3 vd; void main(){ vd = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: `uniform vec3 sunDir; uniform float time; varying vec3 vd;
      void main(){
        float y = vd.y;
        vec3 horizon = vec3(1.0, 0.62, 0.40), mid = vec3(1.0, 0.43, 0.62), top = vec3(0.24, 0.17, 0.45), low = vec3(0.95, 0.55, 0.55);
        vec3 c = y < 0.0 ? mix(horizon, low, clamp(-y * 4.0, 0.0, 1.0)) : mix(horizon, mid, smoothstep(0.0, 0.25, y));
        c = mix(c, top, smoothstep(0.22, 0.75, y));
        float s = dot(vd, sunDir);
        c += vec3(1.0, 0.75, 0.35) * pow(max(s, 0.0), 12.0) * 0.6;
        c = mix(c, vec3(1.0, 0.95, 0.72), smoothstep(0.9965, 0.998, s));
        float band = step(0.5, fract((y + 0.02) * 22.0)) * smoothstep(0.02, 0.1, y) * (1.0 - smoothstep(0.1, 0.22, y));
        c = mix(c, c * 1.07, band * 0.5);
        gl_FragColor = vec4(c, 1.0);
      }`,
  });
  const sky = new T.Mesh(new T.SphereGeometry(2000, 32, 16), m); sky.renderOrder = -10; scene.add(sky); W.sky = sky;
  // comic clouds
  const ct = K.canvasTex(256, 128, (g) => {
    g.fillStyle = '#2b1b3f';
    const blob = (off, col) => { g.fillStyle = col; [[70, 78, 40], [120, 58, 50], [175, 72, 42], [205, 88, 28], [40, 92, 26]].forEach(([x, y, r]) => { g.beginPath(); g.arc(x + off, y + off, r, 0, 7); g.fill(); }); g.fillRect(40 + off, 88 + off, 170, 24); };
    blob(4, 'rgba(43,27,63,.9)'); blob(0, '#ffe8f0');
    g.fillStyle = 'rgba(255,170,190,.55)'; g.fillRect(40, 96, 170, 16);
  });
  W.clouds = [];
  for (let i = 0; i < 34; i++) {
    const s = new T.Sprite(new T.SpriteMaterial({ map: ct, transparent: true, depthWrite: false, fog: false })); const sc = U.rand(60, 150);
    s.scale.set(sc, sc / 2, 1); const a = U.rand(0, Math.PI * 2), r = U.rand(520, 1300); s.position.set(-260 + Math.cos(a) * r, U.rand(110, 260), 180 + Math.sin(a) * r); scene.add(s); W.clouds.push(s);
  }
  // Karl the Fog: one bank in the Golden Gate strait, one rolling in off Ocean Beach
  const ft = K.canvasTex(128, 128, (g) => { const gr = g.createRadialGradient(64, 64, 6, 64, 64, 62); gr.addColorStop(0, 'rgba(255,245,250,.95)'); gr.addColorStop(1, 'rgba(255,245,250,0)'); g.fillStyle = gr; g.fillRect(0, 0, 128, 128); });
  W.fog = [];
  for (let i = 0; i < 30; i++) { const s = new T.Sprite(new T.SpriteMaterial({ map: ft, transparent: true, depthWrite: false, opacity: .7 })); s.scale.set(U.rand(80, 150), U.rand(22, 40), 1);
    const sea = i % 2; s.userData.lo = sea ? -1180 : -720; s.userData.hi = sea ? -790 : -220;
    s.position.set(U.rand(s.userData.lo, s.userData.hi), U.rand(12, 44), sea ? U.rand(-160, 620) : U.rand(-520, -240)); scene.add(s); W.fog.push(s); }
}

/* ================= LIGHTS ================= */
function buildLights() {
  scene.fog = new T.Fog('#ffb49b', 240, 980);
  const hemi = new T.HemisphereLight('#ffd2e2', '#3e3688', .46); scene.add(hemi);   // cool violet fill: shadows read blue-purple against the warm key
  const sun = new T.DirectionalLight('#ffb070', .98); sun.castShadow = true; sun.shadow.mapSize.set(K.coarse ? 1024 : 2048, K.coarse ? 1024 : 2048);
  Object.assign(sun.shadow.camera, { left: -90, right: 90, top: 90, bottom: -90, near: 1, far: 340 }); sun.shadow.bias = -.0004; sun.shadow.normalBias = .03;
  scene.add(sun, sun.target); W.sun = sun; W.hemi = hemi;
  W.sunOffset = new T.Vector3(-165, 92, 48);   // lower sunset key: longer shadows, glowing west faces
}
W.followSun = function (x, z) { W.sun.position.set(x + W.sunOffset.x, W.sunOffset.y, z + W.sunOffset.z); W.sun.target.position.set(x, 0, z); };

/* ================= NAV GRID ================= */
const NG = W.NG = { x0: -802, z0: -548, cs: 4, nx: 281, nz: 290 };   // x0 offset puts a cell row in the 3.5-unit waterfront gap between Oracle Park and the bay (Mission Rock plaza exit)
const NN = NG.nx * NG.nz; const FLOW_CAP = 12000; const links = new Uint8Array(NN), navY = new Float32Array(NN); const walk = W.walk = new Uint8Array(NN), dist = W.dist = new Int32Array(NN), Q = new Int32Array(NN);
W.cellOf = (x, z) => { const i = Math.floor((x - NG.x0) / NG.cs), j = Math.floor((z - NG.z0) / NG.cs); if (i < 0 || j < 0 || i >= NG.nx || j >= NG.nz) return -1; return j * NG.nx + i; };
W.cellCenter = c => { const i = c % NG.nx; return [NG.x0 + (i + .5) * NG.cs, NG.z0 + ((c - i) / NG.nx + .5) * NG.cs]; };
const nearCs = [];
function navLink(x0, z0, x1, z1, y0, y1) {   // == los both ways; batched collider lookup, full height tracking only near steps/decks
  const len = Math.hypot(x1 - x0, z1 - z0), mx = (x0 + x1) / 2, mz = (z0 + z1) / 2, R = len / 2 + .95; let tricky = y0 > W.groundH(x0, z0) + .3 || y1 > W.groundH(x1, z1) + .3;
  nearCs.length = 0; W.forNear(mx, mz, R, c => { if (W.overlaps(c, mx, mz, R)) { nearCs.push(c); if (c.step) tricky = true; } return false; });
  if (tricky) return W.los(x0, z0, x1, z1, y0, y1) && W.los(x1, z1, x0, z0, y1, y0);
  const n = Math.max(1, Math.ceil(len / .5));
  for (let k = 0; k <= n; k++) { const t = k / n, x = x0 + (x1 - x0) * t, z = z0 + (z1 - z0) * t; if (!W.inLand(x, z, .9)) return false; if (!nearCs.length) continue; const y = W.walkH(x, z);
    for (const c of nearCs) if (solid(c, y, 1.4, .6) && W.overlaps(c, x, z, .9)) return false; }
  return true;
}
function buildNav() {
  for (let c = 0; c < NN; c++) { const [x, z] = W.cellCenter(c); let y = W.terrainH(x, z); W.forNear(x, z, .9, b => { if (b.step && W.overlaps(b, x, z, .9)) y = Math.max(y, b.top); return false; }); navY[c] = y; walk[c] = !W.blockedAt(x, z, .95, y); }
  links.fill(0);
  for (let c = 0; c < NN; c++) { if (!walk[c]) continue; const i = c % NG.nx, j = Math.floor(c / NG.nx), [x, z] = W.cellCenter(c);
    for (const k of [0, 2, 4, 5]) { const ni = i + DI[k], nj = j + DJ[k], nc = nj * NG.nx + ni; if (ni < 0 || nj < 0 || ni >= NG.nx || nj >= NG.nz || !walk[nc]) continue;
      const [tx, tz] = W.cellCenter(nc); if (navLink(x, z, tx, tz, navY[c], navY[nc])) { links[c] |= 1 << k; links[nc] |= 1 << [1, 0, 3, 2, 7, 6, 5, 4][k]; }
    }
  }
}
function nearestWalk(x, z) { const c0 = W.cellOf(x, z); if (c0 < 0) return -1; const i0 = c0 % NG.nx, j0 = (c0 - i0) / NG.nx; for (let r = 1; r < 12; r++) for (let dj = -r; dj <= r; dj++) for (let di = -r; di <= r; di++) { if (Math.max(Math.abs(di), Math.abs(dj)) !== r) continue; const i = i0 + di, j = j0 + dj; if (i < 0 || j < 0 || i >= NG.nx || j >= NG.nz) continue; const c = j * NG.nx + i; if (walk[c]) return c; } return -1; }
const DI = [1, -1, 0, 0, 1, 1, -1, -1], DJ = [0, 0, 1, -1, 1, -1, 1, -1];
W.computeFlow = function (tx, tz, sx, sz) {   // BFS from the target; with a seeker position (sx, sz) it stops once the seeker's neighbourhood is settled
  dist.fill(-1); let h = 0, t = 0, lim = Infinity; const nx = NG.nx, s = W.cellOf(tx, tz);
  if (s >= 0 && walk[s]) { Q[t++] = s; dist[s] = 0; }
  else {   // target squeezed into a gap the grid can't hold: seed every walkable cell around it (both sides of a wall or fence)
    const i0 = Math.floor((tx - NG.x0) / NG.cs), j0 = Math.floor((tz - NG.z0) / NG.cs);
    for (let dj = -2; dj <= 2; dj++) for (let di = -2; di <= 2; di++) { const i = i0 + di, j = j0 + dj; if (i < 0 || j < 0 || i >= nx || j >= NG.nz) continue; const c = j * nx + i; if (walk[c]) { dist[c] = 0; Q[t++] = c; } }
    if (!t) { const n = nearestWalk(tx, tz); if (n < 0) return; Q[t++] = n; dist[n] = 0; }
  }
  let stop = sx == null ? -1 : W.cellOf(sx, sz); if (stop >= 0 && !walk[stop]) stop = nearestWalk(sx, sz);
  let expanded = 0;
  while (h < t && expanded++ < FLOW_CAP) { const c = Q[h++]; if (dist[c] > lim) break; if (c === stop) lim = dist[c] + 2; const i = c % nx, j = (c - i) / nx, dc = dist[c] + 1; for (let k = 0; k < 8; k++) { const ni = i + DI[k], nj = j + DJ[k]; if (ni < 0 || nj < 0 || ni >= nx || nj >= NG.nz) continue; const n = nj * nx + ni; if (!walk[n] || dist[n] >= 0 || !(links[c] & (1 << k))) continue; if (k > 3 && (!walk[j * nx + ni] || !walk[nj * nx + i])) continue; dist[n] = dc; Q[t++] = n; } }
};
function bestN(c) { const i = c % NG.nx, j = Math.floor(c / NG.nx); let best = -1, bd = dist[c] < 0 ? Infinity : dist[c];
  for (let k = 0; k < 8; k++) { const ni = i + DI[k], nj = j + DJ[k]; if (ni < 0 || nj < 0 || ni >= NG.nx || nj >= NG.nz || !(links[c] & (1 << k))) continue; const n = nj * NG.nx + ni; if (dist[n] >= 0 && dist[n] < bd) { bd = dist[n]; best = n; } } return best; }
W.flowTarget = function (x, z) { let c = W.cellOf(x, z); if (c < 0) return null; if (!walk[c]) { c = nearestWalk(x, z); return c < 0 ? null : W.cellCenter(c); } const a = bestN(c); return a >= 0 ? W.cellCenter(a) : dist[c] < 0 ? null : W.cellCenter(c); };   // null = no route known: caller heads straight for the target
W.los = function (x0, z0, x1, z1, y0, y1) { const n = Math.max(1, Math.ceil(Math.hypot(x1 - x0, z1 - z0) / .4)); let y = y0 == null ? W.groundAt(x0, z0, W.terrainH(x0, z0)) : y0;
  for (let k = 0; k <= n; k++) { const t = k / n, x = U.lerp(x0, x1, t), z = U.lerp(z0, z1, t); y = W.groundAt(x, z, y, .9); if (W.blockedAt(x, z, .9, y)) return false; } return y1 == null || Math.abs(y - y1) < .7; };
W.randomRoadPoint = function (off) {
  for (let t = 0; t < 60; t++) { const s = U.pick(roadSegs); const k = Math.random(); let x = U.lerp(s.ax, s.bx, k), z = U.lerp(s.az, s.bz, k); const len = Math.hypot(s.bx - s.ax, s.bz - s.az); const px = -(s.bz - s.az) / len, pz = (s.bx - s.ax) / len; const o = off != null ? off : U.rand(-s.w / 2 + 1.5, s.w / 2 - 1.5); x += px * o; z += pz * o;
    if (!W.blockedAt(x, z, .8, W.terrainH(x, z) + .1)) return [x, z, s]; }
  return [115, -20, roadSegs[0]];
};

/* ================= MINIMAP BASE ================= */
function buildMap() {
  const MS = W.MS = .5; const c = document.createElement('canvas'); c.width = NG.nx * NG.cs * MS; c.height = NG.nz * NG.cs * MS; const g = c.getContext('2d');
  const X = x => (x - NG.x0) * MS, Z = z => (z - NG.z0) * MS;
  g.fillStyle = '#2f7fa0'; g.fillRect(0, 0, c.width, c.height);
  const land = new Path2D(); SHORE.forEach(([x, z], i) => i ? land.lineTo(X(x), Z(z)) : land.moveTo(X(x), Z(z))); land.closePath(); g.fillStyle = '#f2e2c8'; g.fill(land);
  W.RECTS.forEach(r => { g.fillStyle = r.name === 'bridge' ? '#e0512f' : r.name === 'marin' ? '#8ab85e' : '#a8744c'; g.fillRect(X(r.x0), Z(r.z0), (r.x1 - r.x0) * MS, (r.z1 - r.z0) * MS); });
  g.save(); g.clip(land);
  W.PARKS.forEach(p => { g.fillStyle = p.plaza ? '#e9cfa8' : p.beach ? '#f7e3a8' : p.dens && p.dens < 45 ? '#5fae4f' : '#86c965'; g.fillRect(X(p.x0), Z(p.z0), (p.x1 - p.x0) * MS, (p.z1 - p.z0) * MS); });
  g.fillStyle = '#2f7fa0'; W.LAKES.forEach(l => { g.beginPath(); g.ellipse(X(l.x), Z(l.z), l.rx * MS, l.rz * MS, 0, 0, 7); g.fill(); if (l.irx) { g.fillStyle = '#86c965'; g.beginPath(); g.ellipse(X(l.x), Z(l.z), l.irx * MS, l.irz * MS, 0, 0, 7); g.fill(); g.fillStyle = '#2f7fa0'; } });
  g.restore();
  g.lineCap = 'round';
  roadSegs.forEach(s => { g.strokeStyle = s.market ? '#c0454a' : '#6d6680'; g.lineWidth = s.w * MS; g.beginPath(); g.moveTo(X(s.ax), Z(s.az)); g.lineTo(X(s.bx), Z(s.bz)); g.stroke(); });
  g.strokeStyle = '#c9a36b'; g.lineWidth = 2; W.TRAILS.forEach(t => { g.beginPath(); t.forEach(([x, z], i) => i ? g.lineTo(X(x), Z(z)) : g.moveTo(X(x), Z(z))); g.stroke(); });
  g.fillStyle = '#b9a6c9'; W.boxes.forEach(b => { if (b.top > 4) g.fillRect(X(b.x0), Z(b.z0), (b.x1 - b.x0) * MS, (b.z1 - b.z0) * MS); });
  g.strokeStyle = '#b54a32'; g.lineWidth = 10 * MS; g.beginPath(); g.arc(X(W.STAD.x), Z(W.STAD.z), (W.STAD.r0 + W.STAD.r1) / 2 * MS, 0, 7); g.stroke();
  W.mapCanvas = c; W.mapX = X; W.mapZ = Z;
}

/* ================= BUILD ================= */
W.build = function () {
  buildLights(); buildSky(); buildTerrain(); buildWater(); buildRoads(); buildLandmarks(); buildStadium(); buildBlocks();
  W.hasBuildings = true;
};
W.finish = function () { W._placementMove = null; if (W.foundationParts.length) { const foundation = merged(W.foundationParts); foundation.name = 'terrain foundations'; } W.buildImpostors(); buildNav(); buildMap(); };
W.update = function (dt, t, focus) {
  if (W.water) { W.water.uniforms.time.value = t; }
  if (W.windSails) for (const s of W.windSails) s.rotation.y += dt * .5;
  for (const f of W.fog) { f.position.x += dt * 2.5; if (f.position.x > f.userData.hi) f.position.x = f.userData.lo; }
  for (const c of W.clouds) { c.position.x += dt * 1.2; if (c.position.x > 1200) c.position.x = -1500; }
  if (W.surf) W.surf.forEach((f, i) => { const k = Math.sin(t * .55 + i * 2.1); f.position.x = -798 - i * 9 + k * 3; f.material.opacity = .35 + .3 * (k * .5 + .5); });
  if (W.sky && focus) W.sky.position.set(focus.x, 0, focus.z);
  if (focus) W.updateLOD(focus.x, focus.z);
};
})(window.K);
