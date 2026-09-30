/* KYOTO(KENS) — core: renderer, comic post-process, toon materials, assets, input, sfx */
'use strict';
window.K = window.K || {};
(function (K) {
const T = THREE;
K.T = T;
const U = K.U = {
  rand: (a, b) => a + Math.random() * (b - a),
  randi: (a, b) => Math.floor(a + Math.random() * (b - a + 1)),
  pick: a => a[Math.floor(Math.random() * a.length)],
  clamp: (v, a, b) => v < a ? a : v > b ? b : v,
  lerp: (a, b, t) => a + (b - a) * t,
  smooth: t => { t = t < 0 ? 0 : t > 1 ? 1 : t; return t * t * (3 - 2 * t); },
  angDiff: (a, b) => { let d = a - b; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2; return d; },
  damp: (a, b, k, dt) => a + (b - a) * (1 - Math.exp(-k * dt)),
  fmt: n => Math.round(n).toLocaleString('en-US'),
  mmss: s => Math.floor(s / 60) + ':' + String(Math.floor(s % 60)).padStart(2, '0'),
  hash: (x, z) => { const s = Math.sin(x * 127.1 + z * 311.7) * 43758.5453; return s - Math.floor(s); },
};
U.lerpAng = (a, b, t) => a + U.angDiff(b, a) * t;
K.reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
K.coarse = matchMedia('(pointer:coarse)').matches || ('ontouchstart' in window);
K.store = { get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }, set(k, v) { try { localStorage.setItem(k, v); } catch (e) {} } };

/* ---------------- renderer + comic pipeline ---------------- */
let VW = Math.max(1, innerWidth), VH = Math.max(1, innerHeight);
const renderer = K.renderer = new T.WebGLRenderer({ antialias: false, powerPreference: 'high-performance' });
const DPR = K.DPR = Math.min(devicePixelRatio || 1, K.coarse ? 1.25 : 1.5);   // 1.75 cost ~35% more pixels than 1.5 for little visible gain on a toon look
renderer.setPixelRatio(DPR);
renderer.setSize(VW, VH);
renderer.outputEncoding = T.sRGBEncoding;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = T.PCFSoftShadowMap;
renderer.autoClear = true;
document.getElementById('stage').appendChild(renderer.domElement);
const scene = K.scene = new T.Scene();
const camera = K.camera = new T.PerspectiveCamera(58, VW / VH, .15, 2400);

function makeRT() {
  const pr = renderer.getPixelRatio(); const rt = new T.WebGLRenderTarget(Math.floor(VW * pr), Math.floor(VH * pr), { minFilter: T.LinearFilter, magFilter: T.LinearFilter, format: T.RGBAFormat, encoding: T.sRGBEncoding });
  rt.depthTexture = new T.DepthTexture(); rt.depthTexture.type = T.UnsignedIntType;
  return rt;
}
let rt = makeRT();
const postMat = new T.ShaderMaterial({
  uniforms: {
    tColor: { value: rt.texture }, tDepth: { value: rt.depthTexture }, res: { value: new T.Vector2(VW * DPR, VH * DPR) },
    near: { value: camera.near }, far: { value: camera.far }, time: { value: 0 }, pause: { value: 0 }, danger: { value: 0 },
    lineW: { value: Math.max(1, DPR * 0.8) }, ink: { value: new T.Color('#241634') }, flash: { value: 0 }, speed: { value: 0 },
  },
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }',
  fragmentShader: `
    precision highp float;
    uniform sampler2D tColor; uniform sampler2D tDepth; uniform vec2 res; uniform float near, far, time, pause, danger, lineW, flash, speed; uniform vec3 ink;
    varying vec2 vUv;
    float ld(vec2 uv){ float z = texture2D(tDepth, uv).x; float n = z * 2.0 - 1.0; return (2.0 * near * far) / (far + near - n * (far - near)); }
    float luma(vec3 c){ return dot(c, vec3(0.299, 0.587, 0.114)); }
    void main(){
      vec2 px = lineW / res;
      vec3 col = texture2D(tColor, vUv).rgb;
      float d = ld(vUv);
      float dl = ld(vUv - vec2(px.x, 0.0)), dr = ld(vUv + vec2(px.x, 0.0)), du = ld(vUv + vec2(0.0, px.y)), dn = ld(vUv - vec2(0.0, px.y));
      float lap = abs(dl + dr - 2.0 * d) + abs(du + dn - 2.0 * d);
      float edgeD = smoothstep(0.028, 0.085, lap / max(d, 3.2));   // interior creases stay quiet in close-ups; silhouettes (big jumps) still ink
      vec3 cl = texture2D(tColor, vUv - vec2(px.x, 0.0)).rgb, cr = texture2D(tColor, vUv + vec2(px.x, 0.0)).rgb;
      vec3 cu = texture2D(tColor, vUv + vec2(0.0, px.y)).rgb, cd = texture2D(tColor, vUv - vec2(0.0, px.y)).rgb;
      float ce = length(cl - cr) + length(cu - cd);
      float edgeC = smoothstep(0.62, 1.05, ce) * 0.4;
      float edge = max(edgeD, edgeC);
      float farFade = 1.0 - smoothstep(260.0, 900.0, d);
      edge *= farFade;
      // Ben-Day halftone in the shadows
      float L = luma(col);
      float ang = 0.785398;
      vec2 fc = gl_FragCoord.xy / (5.2 * max(1.0, lineW * 0.9));
      vec2 q = mat2(cos(ang), -sin(ang), sin(ang), cos(ang)) * fc;
      float r = length(fract(q) - 0.5);
      float dark = clamp((0.33 - L) / 0.33, 0.0, 1.0) * farFade;
      float rad = sqrt(dark) * 0.62;
      float dotm = 1.0 - smoothstep(rad - 0.07, rad + 0.07, r);
      col = mix(col, col * vec3(0.62, 0.56, 0.6), dotm * 0.42 * step(0.03, dark));
      // grade: juicy saturation, warm highlights, soft rose shadows (keeps golds golden)
      float g = luma(col);
      col = mix(vec3(g), col, 1.22);
      col = mix(col * vec3(1.0, 0.9, 0.96), col * vec3(1.05, 1.0, 0.94), smoothstep(0.2, 0.8, g));
      col = mix(col, ink, edge * 0.92);
      // paper grain + vignette
      float n = fract(sin(dot(gl_FragCoord.xy + time * 17.0, vec2(12.9898, 78.233))) * 43758.5453);
      col += (n - 0.5) * 0.024;
      vec2 v = vUv - 0.5; float vig = 1.0 - smoothstep(0.25, 0.85, length(v * vec2(1.0, 0.8)));
      col *= mix(0.78, 1.0, vig);
      // danger pulse (Pascal close) + pause desaturation + flash
      col = mix(col, col * vec3(1.15, 0.72, 0.72), danger * (1.0 - vig) * 0.9);
      if (pause > 0.0) { vec3 bl = vec3(0.0); for (int i = -2; i <= 2; i++) for (int j = -2; j <= 2; j++) bl += texture2D(tColor, vUv + vec2(float(i), float(j)) * px * 3.0).rgb;
        col = mix(col, bl / 25.0, pause * 0.9); }
      col = mix(col, vec3(luma(col)) * vec3(0.62, 0.52, 0.78), pause * 0.3);
      // comic speed lines when sprinting
      if (speed > 0.01) { vec2 sc = (vUv - 0.5) * vec2(res.x / res.y, 1.0); float ra = length(sc), an = atan(sc.y, sc.x);
        float lane = floor(an * 38.0); float hsh = fract(sin(lane * 91.7) * 4375.85); float run = fract(ra * 1.6 - time * (2.2 + hsh * 1.8) + hsh);
        float line = step(.72, hsh) * smoothstep(.34, .62, ra) * smoothstep(.0, .25, run) * (1.0 - smoothstep(.25, .6, run));
        col = mix(col, vec3(1.0, 0.98, 0.92), line * speed * .55); }
      col = mix(col, vec3(1.0, 0.97, 0.88), flash);
      gl_FragColor = vec4(col, 1.0);
    }`,
  depthTest: false, depthWrite: false,
});
const postScene = new T.Scene();
const postCam = new T.OrthographicCamera(-1, 1, 1, -1, 0, 1);
postScene.add(new T.Mesh(new T.PlaneGeometry(2, 2), postMat));
K.post = postMat.uniforms;
K.usePost = true;
/* overlay scene for camera-space 3D menus (never occluded, never post-processed) */
const uiScene = K.uiScene = new T.Scene();
const uiCam = K.uiCam = new T.PerspectiveCamera(50, VW / VH, .1, 100);
uiScene.add(new T.HemisphereLight('#fff1f6', '#6b4a8c', .75));
const uiSun = new T.DirectionalLight('#ffe2c0', .8); uiSun.position.set(-3, 5, 6); uiScene.add(uiSun);
K.render = function (t) {
  postMat.uniforms.time.value = K.reduceMotion ? 0 : t;
  if (!K.usePost) { renderer.setRenderTarget(null); renderer.render(scene, camera); }
  else { renderer.setRenderTarget(rt); renderer.render(scene, camera); renderer.setRenderTarget(null); renderer.render(postScene, postCam); }
  if (K.UI && K.UI.cam && K.UI.cam.children.length) { renderer.autoClear = false; renderer.clearDepth(); renderer.render(uiScene, uiCam); renderer.autoClear = true; }
};
function onResize() {
  VW = Math.max(1, innerWidth); VH = Math.max(1, innerHeight); K.VW = VW; K.VH = VH;
  renderer.setSize(VW, VH); camera.aspect = VW / VH; camera.updateProjectionMatrix(); if (K.uiCam) { K.uiCam.aspect = VW / VH; K.uiCam.updateProjectionMatrix(); }
  rt.depthTexture.dispose(); rt.dispose(); rt = makeRT(); postMat.uniforms.tColor.value = rt.texture; postMat.uniforms.tDepth.value = rt.depthTexture;
  postMat.uniforms.res.value.set(VW * renderer.getPixelRatio(), VH * renderer.getPixelRatio()); postMat.uniforms.lineW.value = Math.max(1, renderer.getPixelRatio() * .8);
}
K.VW = VW; K.VH = VH;
addEventListener('resize', onResize);
/* adaptive quality: step down resolution / shadows if frames are slow */
let qAcc = 0, qN = 0, qLevel = 0;
K.quality = function (dt) {
  if (!(dt > 0) || document.hidden) return;
  qAcc += Math.min(dt, .1); qN++; if (qN < (K.coarse ? 40 : 60)) return;
  const avg = qAcc / qN; qAcc = 0; qN = 0;
  if (avg > .024 && qLevel < 3) {
    qLevel++;
    if (qLevel === 1) { renderer.setPixelRatio(Math.min(DPR, K.coarse ? 1.25 : 1)); K.DPRr = renderer.getPixelRatio(); onResize(); }
    else if (qLevel === 2) { K.W && K.W.sun && (K.W.sun.shadow.mapSize.set(1024, 1024), K.W.sun.shadow.map && (K.W.sun.shadow.map.dispose(), K.W.sun.shadow.map = null)); }
    else if (qLevel === 3) { renderer.setPixelRatio(.8); onResize(); }
  }
};

/* ---------------- toon materials ---------------- */
function grad(steps) { const d = new Uint8Array(steps.length * 4); steps.forEach((v, i) => { d[i * 4] = d[i * 4 + 1] = d[i * 4 + 2] = v; d[i * 4 + 3] = 255; });
  const t = new T.DataTexture(d, steps.length, 1, T.RGBAFormat); t.minFilter = t.magFilter = T.NearestFilter; t.needsUpdate = true; return t; }
K.grad3 = grad([95, 170, 255]);
K.grad4 = grad([80, 140, 205, 255]);
const tcache = new Map();
K.toon = function (color, o) {
  o = o || {};
  const key = (typeof color === 'string' ? color : color.getHexString()) + JSON.stringify(o, (k, v) => (v && v.isTexture) ? v.uuid : v);
  let m = tcache.get(key);
  if (!m) { m = new T.MeshToonMaterial(Object.assign({ color, gradientMap: K.grad3 }, o)); tcache.set(key, m); }
  return m;
};
K.canvasTex = function (w, h, draw, repeat) {
  const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h);
  const t = new T.CanvasTexture(c); t.flipY = true; t.encoding = T.sRGBEncoding; t.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  if (repeat) t.wrapS = t.wrapT = T.RepeatWrapping; return t;
};
const texVariants = new WeakMap();
K.textureVariant = function (tex, flipY) { if (!tex || tex.flipY === flipY) return tex; let variants = texVariants.get(tex); if (!variants) { variants = {}; texVariants.set(tex, variants); } const key = String(flipY); if (!variants[key]) { const t = tex.clone(); t.flipY = flipY; t.needsUpdate = true; variants[key] = t; } return variants[key]; };
K.surfaceTexture = function (tex, mesh, gltf = true) {
  if (!tex) return tex;
  const geo = mesh.geometry || mesh, pos = geo.attributes && geo.attributes.position, uv = geo.attributes && geo.attributes.uv;
  let flip = !gltf;
  if (pos && uv && pos.count === uv.count) {
    if (mesh.updateWorldMatrix) mesh.updateWorldMatrix(true, false);
    const v = new T.Vector3(); let sy = 0, sv = 0, syv = 0, syy = 0; const n = pos.count;
    for (let i = 0; i < n; i++) { v.fromBufferAttribute(pos, i); if (mesh.matrixWorld) v.applyMatrix4(mesh.matrixWorld); const y = v.y, vv = uv.getY(i); sy += y; sv += vv; syv += y * vv; syy += y * y; }
    const variance = syy - sy * sy / n, covariance = syv - sy * sv / n;
    if (variance > 1e-6 && Math.abs(covariance) > 1e-6) flip = covariance > 0;
  }
  return K.textureVariant(tex, flip);
};
/* Convert a loaded glTF subtree to toon materials. Materials keep their name for recoloring. */
K.toonify = function (root, opt) {
  opt = opt || {};
  const conv = new Map();
  root.traverse(o => {
    if (!o.isMesh) return;
    o.castShadow = opt.cast !== false; o.receiveShadow = opt.receive !== false;
    const one = src => {
      const k = src.uuid + (o.isSkinnedMesh ? 's' : '') + (o.geometry.attributes.color ? 'v' : '');
      if (conv.has(k)) return conv.get(k);
      const m = new T.MeshToonMaterial({ color: src.color ? src.color.clone() : new T.Color(1, 1, 1), map: src.map || null, gradientMap: K.grad3,
        skinning: !!o.isSkinnedMesh, vertexColors: !!o.geometry.attributes.color, transparent: src.transparent, opacity: src.opacity, side: src.side, alphaTest: src.alphaTest, alphaMap: src.alphaMap, depthWrite: src.depthWrite, morphTargets: !!o.morphTargetInfluences, morphNormals: !!o.morphTargetInfluences });
      if (src.emissive && (src.emissive.r + src.emissive.g + src.emissive.b) > 0) m.emissive = src.emissive.clone();
      m.emissiveMap = src.emissiveMap || null; m.emissiveIntensity = src.emissiveIntensity == null ? 1 : src.emissiveIntensity; m.name = src.name; conv.set(k, m); return m;
    };
    o.material = Array.isArray(o.material) ? o.material.map(one) : one(o.material);
  });
  return root;
};
/* Give a clone its own copies of named materials so they can be recolored independently. */
K.ownMaterials = function (root) {
  const map = new Map();
  root.traverse(o => {
    if (!o.isMesh) return;
    const one = m => { if (!map.has(m)) { const c = m.clone(); map.set(m, c); } return map.get(m); };
    o.material = Array.isArray(o.material) ? o.material.map(one) : one(o.material);
  });
  const byName = {};
  map.forEach(m => { const n = m.name.replace(/^(h_|kyoto_|lg_)/, ''); (byName[n] = byName[n] || []).push(m); });
  return byName;
};

/* Inverted-hull ink outline generated at runtime (robust vs. exported shells). */
const inkMat = new T.MeshBasicMaterial({ color: '#241634', side: T.BackSide });
K.inkShell = function (root, thick) {
  const shells = [];
  root.traverse(o => { if (!o.isMesh || o.userData.ink || /_ink$/.test(o.name)) return; const g = o.geometry.clone(); if (!g.attributes.normal) g.computeVertexNormals();
    const p = g.attributes.position, n = g.attributes.normal; for (let i = 0; i < p.count; i++) { p.setXYZ(i, p.getX(i) + n.getX(i) * thick, p.getY(i) + n.getY(i) * thick, p.getZ(i) + n.getZ(i) * thick); }
    const s = new T.Mesh(g, inkMat); s.userData.ink = true; s.position.copy(o.position); s.quaternion.copy(o.quaternion); s.scale.copy(o.scale); shells.push([o.parent, s]); });
  shells.forEach(([p, s]) => p.add(s));
  root.traverse(o => { if (/_ink$/.test(o.name)) o.visible = false; });
  return root;
};

/* ---------------- assets ---------------- */
K.assets = {};
/* Hosts whose CSP connect-src omits blob:/data: (e.g. claude.ai artifacts) block THREE.ImageBitmapLoader's fetch() of
   glTF-embedded images. Decode those in memory instead, so no request is made; other URLs keep the stock path. */
(function () {
  const blobs = new Map(), mk = URL.createObjectURL, rv = URL.revokeObjectURL;
  URL.createObjectURL = function (o) { const u = mk.call(URL, o); if (o instanceof Blob) blobs.set(u, o); return u; };
  URL.revokeObjectURL = function (u) { blobs.delete(u); return rv.call(URL, u); };
  const dataBlob = u => { const i = u.indexOf(','), head = u.slice(5, i), body = u.slice(i + 1), s = /;base64/.test(head) ? atob(body) : decodeURIComponent(body);
    const a = new Uint8Array(s.length); for (let j = 0; j < s.length; j++) a[j] = s.charCodeAt(j); return new Blob([a], { type: head.split(';')[0] }); };
  const load = T.ImageBitmapLoader.prototype.load;
  T.ImageBitmapLoader.prototype.load = function (url, onLoad, onProgress, onError) {
    const u = this.manager.resolveURL((this.path || '') + (url || '')), blob = blobs.get(u) || (/^data:/.test(u) ? dataBlob(u) : null);
    if (!blob) return load.call(this, url, onLoad, onProgress, onError);
    this.manager.itemStart(u);
    createImageBitmap(blob, Object.assign({}, this.options, { colorSpaceConversion: 'none' }))
      .then(b => { onLoad && onLoad(b); this.manager.itemEnd(u); }, e => { onError && onError(e); this.manager.itemError(u); this.manager.itemEnd(u); });
  };
})();
const loader = new T.GLTFLoader();
/* Boot status line (loading screen): phase text + a detail line; no invented percentages. */
K.loadStatus = function (msg, detail, keep) { const m = document.getElementById('loadMsg'), d = document.getElementById('loadDetail'); if (m && msg != null) m.textContent = msg; if (detail != null && !keep) K.loadStatus.detail = detail; if (d && detail != null) d.textContent = detail; };
K.loadAll = function (list, onProgress) {
  let done = 0, failed = 0; const bytes = {};
  const info = () => { let b = 0; for (const k in bytes) b += bytes[k]; return { done, total: list.length, failed, bytes: b }; };
  return Promise.all(list.map(([key, url]) => new Promise((res) => {
    let settled = false, timer;
    // Three.js reports transfer progress for model files; reset their timeout on activity.
    // Image elements expose no progress callback, so give them a longer fixed deadline.
    const timeoutMs = /\.(glb|gltf|json)(\?|$)/.test(url) ? 30000 : 120000;
    const armTimeout = () => { clearTimeout(timer); timer = setTimeout(() => fin(null), timeoutMs); };
    armTimeout();
    const fin = v => { if (settled) return; settled = true; clearTimeout(timer); K.assets[key] = v; done++; if (!v) failed++; onProgress && onProgress(done / list.length, key, info()); res(v); };
    const prog = e => { if (settled || !e || !(e.loaded >= 0)) return; armTimeout(); bytes[key] = e.loaded; onProgress && onProgress(done / list.length, null, info()); };
    if (/\.(glb|gltf|json)(\?|$)/.test(url)) loader.load(url, g => { K.toonify(g.scene); fin(g); }, prog, e => { console.warn('asset failed', url, e); fin(null); });
    else { const im = new Image(); im.onload = () => fin(im); im.onerror = () => { console.warn('img failed', url); fin(null); }; im.src = url; }
  })));
};
/* Find a named node inside a gltf scene. */
K.node = (g, name) => g && g.scene.getObjectByName(name);
/* Clone a skinned rig from a gltf; returns {root, mixer, actions, play(name, fade), mats} */
/* Drive one skeleton with another rig's clips (same bone names): keep rotations, re-base the root (hips) translation on the
   target's rest position, drop the other translation/scale tracks (they would impose the source rig's proportions). */
K.retarget = function (src, dst, root) {
  root = root || 'hips';
  const rp = (g, n) => { const b = g.scene.getObjectByName(n); return b ? b.position.clone() : new T.Vector3(); };
  const d = rp(dst, root).sub(rp(src, root));
  return (src.animations || []).map(c => {
    const tracks = [];
    c.tracks.forEach(t => {
      if (/\.quaternion$/.test(t.name)) tracks.push(t.clone());
      else if (t.name === root + '.position') { const n = t.clone(); for (let i = 0; i < n.values.length; i += 3) { n.values[i] += d.x; n.values[i + 1] += d.y; n.values[i + 2] += d.z; } tracks.push(n); }
    });
    return new T.AnimationClip(c.name, c.duration, tracks);
  });
};
K.rigClone = function (g, opts) {
  opts = opts || {};
  if (!g || !g.scene) throw new Error('Required character model is missing. Restore models/ and reload.');
  const root = T.SkeletonUtils.clone(g.scene);
  const mats = K.ownMaterials(root);
  const mixer = new T.AnimationMixer(root);
  const actions = {};
  (opts.clips || g.animations || []).forEach(c => { actions[c.name] = mixer.clipAction(c); });
  const r = { root, mixer, actions, mats, cur: null, finished: null,
    clearOnce() { if (r.finished) { mixer.removeEventListener('finished', r.finished); r.finished = null; } },
    play(name, fade = 0.2, speed = 1) {
      const a = actions[name]; if (!a) return;
      a.timeScale = speed;
      if (r.cur === a) return;
      r.clearOnce(); a.setLoop(T.LoopRepeat, Infinity); a.clampWhenFinished = false; a.reset(); a.enabled = true; a.setEffectiveWeight(1); a.play();
      if (r.cur) r.cur.crossFadeTo(a, fade, false);
      r.cur = a; r.curName = name;
    },
    once(name, fade = 0.1, then) {
      const a = actions[name]; if (!a) return;
      r.clearOnce(); a.reset(); a.enabled = true; a.setEffectiveWeight(1); a.setLoop(T.LoopOnce, 1); a.clampWhenFinished = true; a.play();
      if (r.cur && r.cur !== a) r.cur.crossFadeTo(a, fade, false);
      r.cur = a; r.curName = name;
      const f = e => { if (e.action === a) { r.clearOnce(); if (then) then(); } }; r.finished = f; mixer.addEventListener('finished', f);
    },
    show(names) { root.traverse(o => { if (o.name && o.name.startsWith('acc_')) o.visible = names.includes(o.name) || names.some(n => n.endsWith('*') && o.name.startsWith(n.slice(0, -1))); }); },
    color(name, c) { (mats[name] || []).forEach(m => m.color.set(c)); },
    tex(name, t) { (mats[name] || []).forEach(m => { m.map = K.textureVariant(t, false); m.color.set('#ffffff'); m.needsUpdate = true; }); },
  };
  root.traverse(o => { if (o.isMesh) { o.frustumCulled = false; o.castShadow = true; } });
  return r;
};

/* ---------------- input ---------------- */
const keys = K.keys = {};
const inp = K.inp = { mx: 0, mz: 0, sprint: false, jump: false, act: false, bark: false, camYaw: 0, camPitch: 0, dragging: false, lastManual: -99 };
const PRESS = new Set();
K.pressed = c => PRESS.has(c);
K.consumeKey = c => { PRESS.delete(c); keys[c] = false; };
K.testKey = c => { if (!keys[c]) PRESS.add(c); keys[c] = true; };
const ACT_KEYS = K.ACT_KEYS = { ArrowUp: 'Space', ArrowDown: 'KeyB', ArrowLeft: 'KeyQ', ArrowRight: 'KeyE' };   // ↑ jump · ↓ bark · ← Kyotoken · → act
addEventListener('keydown', e => {
  if (e.code === 'Escape' && K.locked) { K.unlock(true); e.preventDefault(); return; }
  if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Tab'].includes(e.code)) e.preventDefault();
  const code = ACT_KEYS[e.code] || e.code;   // arrows are action keys: WASD moves
  if (!e.repeat) { PRESS.add(code); if (K.sfx) { K.sfx.init(); K.sfx.resume(); } }
  keys[code] = true;
});
addEventListener('keyup', e => { keys[ACT_KEYS[e.code] || e.code] = false; });
K.resetInput = () => { pointer = null; dragDistance = 0; mouseInside = mouseSeeded = false; orbitX = orbitY = edgeTurn = 0; inp.mouseOrbit = false; for (const k in keys) keys[k] = false; PRESS.clear(); Object.assign(inp, { mx: 0, mz: 0, sprint: false, jump: false, act: false, bark: false, camYaw: 0, dragging: false }); if (K.touch) Object.assign(K.touch, { x: 0, z: 0, sprint: false }); if (K.resetTouch) K.resetTouch(); };
addEventListener('blur', () => { K.resetInput(); K.onBlur && K.onBlur(); });
K.endFrameInput = () => { PRESS.clear(); inp.jump = inp.act = inp.bark = false; };
// Free mouse orbit, with optional pointer lock. Touch keeps its own look surface.
const cv = renderer.domElement;
let lastX = 0, lastY = 0, downAt = 0, pointer = null, dragDistance = 0;
let mouseInside = false, mouseSeeded = false, orbitX = 0, orbitY = 0, edgeTurn = 0;
const canOrbit = () => K.game && K.game.state === 'play' && !(K.agent && K.agent.open);
const playing = () => canOrbit() && !K.testMode;
const trackMouse = e => {
  mouseInside = true;
  const rect = cv.getBoundingClientRect(), edge = Math.min(64, rect.width * .065);
  const x = e.clientX - rect.left;
  edgeTurn = x < edge ? Math.pow(U.clamp(1 - x / edge, 0, 1), 2) : x > rect.width - edge ? -Math.pow(U.clamp((x - rect.width + edge) / edge, 0, 1), 2) : 0;
};
cv.addEventListener('pointerenter', e => { if (e.pointerType !== 'mouse') return; mouseSeeded = true; lastX = e.clientX; lastY = e.clientY; trackMouse(e); });
cv.addEventListener('pointerleave', () => { mouseInside = mouseSeeded = false; edgeTurn = 0; });
cv.addEventListener('pointerdown', e => {
  if ((e.pointerType === 'touch' && K.game && K.game.state === 'play') || (e.button !== 0 && e.button !== 2) || pointer !== null || K.locked) return;
  pointer = e.pointerId; dragDistance = 0; inp.dragging = true; mouseSeeded = true;
  lastX = e.clientX; lastY = e.clientY; downAt = performance.now(); cv.setPointerCapture(e.pointerId);
});
cv.addEventListener('contextmenu', e => e.preventDefault());
cv.addEventListener('pointermove', e => {
  K.mouse = { x: e.clientX, y: e.clientY };
  if (e.pointerType === 'touch') return;
  const dx = K.locked ? e.movementX : mouseSeeded ? e.clientX - lastX : 0;
  const dy = K.locked ? e.movementY : mouseSeeded ? e.clientY - lastY : 0;
  lastX = e.clientX; lastY = e.clientY; mouseSeeded = true; trackMouse(e);
  if (inp.dragging) dragDistance += Math.hypot(dx, dy);
  if (!canOrbit()) return;
  orbitX -= U.clamp(dx, -200, 200) * .0032; orbitY += U.clamp(dy, -200, 200) * .0024;
  if (dx || dy) inp.lastManual = performance.now();
});
K.updateMouseOrbit = dt => {
  inp.mouseOrbit = canOrbit() && inp.dragging;
  if (!canOrbit()) { orbitX = orbitY = 0; return; }
  const t = 1 - Math.exp(-24 * dt), x = orbitX * t, y = orbitY * t;
  orbitX -= x; orbitY -= y;
  const edge = 0;   // resting the cursor near an edge must not spin the view (auto-follow owns the camera between mouse moves)
  inp.camYaw += x + edge; inp.camPitch = U.clamp(inp.camPitch + y, -.5, .7);
  if (Math.abs(x) + Math.abs(y) + Math.abs(edge) > .00001) inp.lastManual = performance.now();
};
const endPointer = e => {
  if (e.pointerId !== pointer) return;
  const click = e.type === 'pointerup' && inp.dragging && dragDistance < 6 && performance.now() - downAt < 350;
  pointer = null; inp.dragging = false;
  if (click && e.button === 0 && playing() && e.pointerType === 'mouse' && cv.requestPointerLock) {
    try { const r = cv.requestPointerLock(); if (r && r.catch) r.catch(() => {}); } catch (_) {} return;
  }
  if (click) K.onClick && K.onClick(e.clientX, e.clientY);
};
// Lock denial/release is an input transition, never a pause request.
document.addEventListener('pointerlockchange', () => { K.locked = document.pointerLockElement === cv; K.silentUnlock = false; mouseInside = mouseSeeded = false; orbitX = orbitY = edgeTurn = 0; });
document.addEventListener('pointerlockerror', () => { K.locked = false; });
K.unlock = (silent = false) => { if (document.pointerLockElement && document.exitPointerLock) { K.silentUnlock = silent; document.exitPointerLock(); } };
cv.addEventListener('pointerup', endPointer); cv.addEventListener('pointercancel', endPointer); cv.addEventListener('lostpointercapture', endPointer);
cv.addEventListener('wheel', e => { K.zoom = U.clamp((K.zoom || 1) + e.deltaY * 0.0012, 0.55, 1.8); }, { passive: true });
K.readMove = function () {
  const k = keys;
  let x = (k.KeyD ? 1 : 0) - (k.KeyA ? 1 : 0);
  let z = (k.KeyW ? 1 : 0) - (k.KeyS ? 1 : 0);
  if (K.touch && Math.hypot(K.touch.x, K.touch.z) >= .12) { x += K.touch.x; z += K.touch.z; }
  let l = Math.hypot(x, z); if (l < .12) { x = z = l = 0; } if (l > 1) { x /= l; z /= l; }
  inp.mx = x; inp.mz = z;
  inp.sprint = !!(k.ShiftLeft || k.ShiftRight || (K.touch && K.touch.sprint));
  if (PRESS.has('Space')) inp.jump = true;
  if (PRESS.has('KeyE') || PRESS.has('Enter')) inp.act = true;
  if (PRESS.has('KeyB')) inp.bark = true;
};

/* ---------------- sfx ---------------- */
const Sfx = K.sfx = (() => {
  let ctx = null, master = null, sfxGain = null, musicGain = null, muted = typeof location !== "undefined" && /[?&](test|mute)=1\b/.test(location.search), nb = null;   // dev & review runs are silent
  function init() {
    if (ctx) return;
    try {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      master = ctx.createGain(); master.gain.value = muted ? 0 : .9; master.connect(ctx.destination);
      sfxGain = ctx.createGain(); sfxGain.gain.value = 0.55; sfxGain.connect(master);
      musicGain = ctx.createGain(); musicGain.gain.value = 0.6; musicGain.connect(master);
      nb = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate); const a = nb.getChannelData(0); for (let i = 0; i < a.length; i++) a[i] = Math.random() * 2 - 1;
    } catch (e) { ctx = null; }
  }
  function tone(f, d, type, v, f2, delay) {
    if (!ctx || muted) return; const t = ctx.currentTime + (delay || 0);
    const o = ctx.createOscillator(), g = ctx.createGain(); o.type = type || 'sine'; o.frequency.setValueAtTime(f, t);
    if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + d);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(v || .15, t + 0.008); g.gain.exponentialRampToValueAtTime(.0001, t + d);
    o.connect(g); g.connect(sfxGain); o.start(t); o.stop(t + d + .03);
  }
  function noise(d, v, freq, type, delay) {
    if (!ctx || muted) return; const t = ctx.currentTime + (delay || 0);
    const s = ctx.createBufferSource(); s.buffer = nb; const f = ctx.createBiquadFilter(); f.type = type || 'bandpass'; f.frequency.value = freq; f.Q.value = 1.1;
    const g = ctx.createGain(); g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(.0001, t + d);
    s.connect(f); f.connect(g); g.connect(sfxGain); s.start(t, Math.random() * 0.5); s.stop(t + d + .03);
  }
  function woof(pitch, delay) { pitch = pitch || 1; delay = delay || 0; tone(420 * pitch, .14, 'sawtooth', .16, 170 * pitch, delay); tone(300 * pitch, .12, 'square', .06, 140 * pitch, delay); noise(.1, .16, 900 * pitch, 'bandpass', delay); }
  return {
    init, get ctx() { return ctx; }, get musicOut() { return musicGain; },
    resume() { if (ctx && (ctx.state === 'suspended' || ctx.state === 'interrupted')) ctx.resume().catch(() => {}); },
    suspend() { if (ctx && ctx.state === 'running') ctx.suspend().catch(() => {}); },
    get muted() { return muted; }, set muted(m) { muted = m; if (master) master.gain.value = m ? 0 : 0.9; },
    coin(p) { const k = p || 1; tone(1175 * k, .06, 'square', .05); tone(1760 * k, .1, 'square', .05, null, .05); },
    letter() { [523, 659, 784, 1047, 1319].forEach((f, i) => tone(f, .22, 'triangle', .12, null, i * .08)); },
    bark() { woof(1); woof(1.06, .16); },
    yip() { woof(1.4); },
    boing() { tone(140, .45, 'sine', .28, 820); },
    hug() { tone(520, .2, 'sine', .1, 380); tone(660, .3, 'sine', .08, 440, .12); },
    thud() { tone(120, .2, 'square', .12, 50); noise(.16, .18, 260); },
    gulp() { tone(300, .1, 'sine', .15, 520); tone(260, .12, 'sine', .15, 440, .11); },
    honk() { tone(440, .22, 'square', .07); tone(554, .22, 'square', .07); },
    bell() { [1568, 2093].forEach((f, i) => { tone(f, .5, 'triangle', .09, null, i * .02); }); tone(1568, .5, 'triangle', .07, null, .3); },
    yoink() { tone(600, .16, 'triangle', .12, 1400); },
    zap() { tone(900, .25, 'sawtooth', .06, 180); },
    hack() { for (let i = 0; i < 6; i++) tone(400 + Math.random() * 1200, .05, 'square', .04, null, i * .04); },
    deploy() { tone(220, .12, 'square', .06, 440); tone(330, .12, 'square', .06, 660, .1); },
    flap() { noise(.08, .08, 1400, 'highpass'); },
    click() { tone(900, .04, 'square', .05); },
    whoosh() { noise(.45, .12, 700, 'bandpass'); },
    squawk() { tone(1600, .12, 'sawtooth', .05, 900); tone(1400, .1, 'sawtooth', .04, 800, .1); },
    arf() { tone(260, .12, 'sawtooth', .09, 180); noise(.08, .1, 500); },
    vespa() { tone(95, .5, 'sawtooth', .04, 130); },
    shutter() { noise(.03, .32, 5200, 'highpass'); tone(2300, .02, 'square', .05); noise(.05, .24, 2600, 'bandpass', .08); tone(1500, .03, 'square', .045, null, .08); },
    snap() { noise(.09, .36, 2600, 'highpass'); tone(1500, .18, 'sawtooth', .07, 90); tone(210, .22, 'square', .06, 60, .03); },
    zoom() { tone(480, .55, 'sawtooth', .035, 1500); tone(720, .55, 'triangle', .03, 2100); noise(.5, .1, 1700, 'bandpass'); },
    album() { [784, 988, 1175, 1568].forEach((f, i) => tone(f, .16, 'triangle', .09, null, i * .06)); },
  };
})();

K.$ = s => document.querySelector(s);
/* plug-in hooks for feature modules (src/feat_*.js): K.on('build'|'start'|'step'|'frame'|'bark'|'end', fn) */
K.hooks = K.hooks || {};
K.on = (n, f) => (K.hooks[n] = K.hooks[n] || []).push(f);
K.emit = (n, a, b, c) => { const L = K.hooks[n]; if (L) for (const f of L) { try { f(a, b, c); } catch (e) { console.error('hook ' + n, e); } } };
})(window.K);
