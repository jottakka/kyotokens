/* Kyoto(kens) — character shaders: hand-drawn fur strokes (triplanar, bind-space) + skinned ink hull. Loaded after core.js. */
(function () {
  const T = THREE;
  const furTex = new T.TextureLoader().load('tex/fur_strokes.png');
  furTex.wrapS = furTex.wrapT = T.RepeatWrapping; furTex.anisotropy = 4;
  K.furTex = furTex;
  K.gradFur = (function (steps) { const d = new Uint8Array(steps.length * 4); steps.forEach((v, i) => { d[i * 4] = d[i * 4 + 1] = d[i * 4 + 2] = v; d[i * 4 + 3] = 255; });
    const t = new T.DataTexture(d, steps.length, 1, T.RGBAFormat); t.minFilter = t.magFilter = T.NearestFilter; t.needsUpdate = true; return t; })([172, 222, 255]);

  /* Fur: strokes sampled triplanar in bind space (they ride the skin), stronger in shadow like ink hatching. */
  K.furify = function (m, o) {
    o = Object.assign({ scale: 1.5, strength: .7, ink: new T.Color('#6a3510'), rim: .3, fill: .14 }, o);
    m.gradientMap = K.gradFur;
    m.onBeforeCompile = sh => {
      sh.uniforms.furTex = { value: furTex }; sh.uniforms.furScale = { value: o.scale }; sh.uniforms.furStrength = { value: o.strength };
      sh.uniforms.furInk = { value: o.ink }; sh.uniforms.furRim = { value: o.rim }; sh.uniforms.furFill = { value: o.fill };
      sh.vertexShader = 'varying vec3 vFurP; varying vec3 vFurN;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n  vFurP = position; vFurN = normal;');
      sh.fragmentShader = 'uniform sampler2D furTex; uniform float furScale, furStrength, furRim, furFill; uniform vec3 furInk; varying vec3 vFurP; varying vec3 vFurN;\n' +
        sh.fragmentShader.replace('#include <output_fragment>', `
  { vec3 fw = pow(abs(normalize(vFurN)), vec3(4.0)); fw /= (fw.x + fw.y + fw.z + 1e-4);
    vec3 fp = vFurP * furScale;
    float fs = texture2D(furTex, fp.zy).r * fw.x + texture2D(furTex, fp.xz).r * fw.y + texture2D(furTex, fp.xy).r * fw.z;
    float lum = dot(outgoingLight, vec3(.299, .587, .114)) / max(dot(diffuseColor.rgb, vec3(.299, .587, .114)), 1e-3);
    float shd = 1.0 - smoothstep(.55, .95, lum);
    outgoingLight *= mix(vec3(1.0), vec3(1.16, .95, .74), shd * .85);
    float amt = furStrength * mix(1.0, .4, smoothstep(.75, 1.05, lum));
    outgoingLight = mix(outgoingLight, outgoingLight * furInk, (1.0 - fs) * amt);
    float rim = pow(1.0 - clamp(dot(normalize(vNormal), normalize(vViewPosition)), 0.0, 1.0), 3.0);
    outgoingLight += diffuseColor.rgb * (rim * furRim + furFill); }
  #include <output_fragment>`);
    };
    m.customProgramCacheKey = () => 'fur';
    m.userData.fur = true; m.userData.furOpt = { scale: o.scale, strength: o.strength, ink: '#' + o.ink.getHexString(), rim: o.rim, fill: o.fill };
    m.needsUpdate = true; return m;
  };
  function inkPatch(m, w) {
    m.onBeforeCompile = sh => { sh.uniforms.inkW = { value: w }; sh.vertexShader = 'uniform float inkW;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n  transformed += normalize(normal) * inkW;'); };
    m.customProgramCacheKey = () => 'skinInk' + w; m.userData.inkW = w; m.needsUpdate = true; return m;
  }

  /* Fuzzy fur fringe: back-face shells whose extrusion spikes (cellular noise, bind space) along the fur flow, scaled by _fluff. */
  const FR = { freq: 4.6, base: .014, amp: .17 };
  const frGLSL = `attribute float _fluff; uniform float frFreq, frBase, frAmp, frInk;
vec3 frH(vec3 p){ p = vec3(dot(p, vec3(127.1, 311.7, 74.7)), dot(p, vec3(269.5, 183.3, 246.1)), dot(p, vec3(113.5, 271.9, 124.6))); return fract(sin(p) * 43758.5453); }
float frCell(vec3 x){ vec3 p = floor(x), f = fract(x); float d = 8.0;
  for (int k = -1; k <= 1; k++) for (int j = -1; j <= 1; j++) for (int i = -1; i <= 1; i++) { vec3 b = vec3(float(i), float(j), float(k)); vec3 r = b - f + frH(p + b); d = min(d, dot(r, r)); }
  return 1.0 - clamp(sqrt(d) * 1.35, 0.0, 1.0); }
`;
  const frExtrude = `
  { float sp = pow(frCell(position * frFreq), 2.2);
    vec3 fdir = normalize(normalize(normal) + vec3(0.0, -.85, -.35) * .9);
    transformed += fdir * (_fluff * (frBase + frAmp * sp)) + normalize(normal) * frInk; }`;
  function frPatch(sh, ink, amp) {
    sh.uniforms.frFreq = { value: FR.freq }; sh.uniforms.frBase = { value: FR.base }; sh.uniforms.frAmp = { value: amp == null ? FR.amp : amp }; sh.uniforms.frInk = { value: ink };
    sh.vertexShader = frGLSL + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>' + frExtrude);
  }
  K.skinFringe = function (mesh, groupFilter, inkW) {
    const g = subGeo(mesh.geometry, groupFilter);
    if (!g.attributes._fluff) return null;
    const src = (Array.isArray(mesh.material) ? mesh.material : [mesh.material]).find(mm => mm && /_coat/.test(mm.name));
    const map = src && src.map, vc = !!g.attributes.color;   // painted coats: the fringe samples the same texture
    const fm = new T.MeshToonMaterial({ vertexColors: vc, map: vc ? null : map, color: vc || map ? 0xffffff : (src ? src.color : 0xffffff), skinning: true, side: T.BackSide, gradientMap: K.gradFur });
    const amp = map ? FR.amp * .72 : FR.amp;   // painted coats already carry the fur detail: softer spikes
    fm.onBeforeCompile = sh => frPatch(sh, 0.0, amp); fm.customProgramCacheKey = () => 'fringe' + amp; fm.name = 'fur_fringe'; fm.userData.fringe = 1; fm.userData.frAmp = amp;
    const im = new T.MeshBasicMaterial({ color: new T.Color('#1e1026').convertSRGBToLinear(), side: T.BackSide, skinning: true });
    im.onBeforeCompile = sh => frPatch(sh, inkW, amp); im.customProgramCacheKey = () => 'fringeInk' + inkW + amp; im.name = 'fur_fringe_ink'; im.userData.fringe = 2; im.userData.inkW = inkW; im.userData.frAmp = amp;
    const out = [];
    for (const m of [fm, im]) {
      const s = new T.SkinnedMesh(g, m); s.name = mesh.name + (m === fm ? '_fringe' : '_fringeInk'); s.userData.ink = true; s.castShadow = false; s.receiveShadow = false;
      s.position.copy(mesh.position); s.quaternion.copy(mesh.quaternion); s.scale.copy(mesh.scale); s.bind(mesh.skeleton, mesh.bindMatrix); s.frustumCulled = mesh.frustumCulled;
      mesh.parent.add(s); out.push(s);
    }
    return out;
  };
  function subGeo(src, groupFilter) {
    const g = new T.BufferGeometry();
    for (const k of ['position', 'normal', 'uv', 'skinIndex', 'skinWeight', 'color', '_fluff']) if (src.attributes[k]) g.setAttribute(k, src.attributes[k]);
    if (src.index && src.groups.length && groupFilter) {
      const idx = [], I = src.index.array;
      src.groups.forEach(gr => { if (groupFilter(gr.materialIndex)) for (let i = gr.start; i < gr.start + gr.count; i++) idx.push(I[i]); });
      g.setIndex(idx);
    } else if (src.index) g.setIndex(src.index);
    return g;
  }
  /* Ink hull for a skinned mesh: back faces pushed out along bind-space normals, skinned with the same skeleton. */
  const inkCache = new Map();
  K.skinInk = function (mesh, w, color, groupFilter) {
    const key = (color || '#241634') + w;
    let m = inkCache.get(key);
    if (!m) {
      m = inkPatch(new T.MeshBasicMaterial({ color: new T.Color(color || '#241634').convertSRGBToLinear(), side: T.BackSide, skinning: true }), w); m.name = 'ink_hull'; inkCache.set(key, m);
    }
    const src = mesh.geometry, g = new T.BufferGeometry();
    for (const k of ['position', 'normal', 'skinIndex', 'skinWeight']) if (src.attributes[k]) g.setAttribute(k, src.attributes[k]);
    if (src.index && src.groups.length && groupFilter) {
      const idx = [], I = src.index.array;
      src.groups.forEach(gr => { if (groupFilter(gr.materialIndex)) for (let i = gr.start; i < gr.start + gr.count; i++) idx.push(I[i]); });
      g.setIndex(idx);
    } else if (src.index) g.setIndex(src.index);
    const s = new T.SkinnedMesh(g, m); s.name = mesh.name + '_hull'; s.userData.ink = true; s.castShadow = false; s.receiveShadow = false;
    s.position.copy(mesh.position); s.quaternion.copy(mesh.quaternion); s.scale.copy(mesh.scale);
    s.bind(mesh.skeleton, mesh.bindMatrix); s.frustumCulled = mesh.frustumCulled;
    mesh.parent.add(s); return s;
  };


  /* Clothing prints (gingham, plaid, knee-sock stripes…) on UV-less character meshes: triplanar in bind space so the pattern rides the body. */
  const TRI_SCALE = { h_socks: 1.25 };
  function triPatch(m) {
    const sc = TRI_SCALE[m.name] || 2.0; m.userData.tri = sc;
    m.onBeforeCompile = sh => {
      sh.uniforms.triScale = { value: sc };
      sh.vertexShader = 'varying vec3 vTriP; varying vec3 vTriN;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n  vTriP = position; vTriN = normal;');
      sh.fragmentShader = 'varying vec3 vTriP; varying vec3 vTriN; uniform float triScale;\n' + sh.fragmentShader.replace('#include <map_fragment>', `#ifdef USE_MAP
  { vec3 tw = pow(abs(normalize(vTriN)), vec3(4.0)); tw /= (tw.x + tw.y + tw.z + 1e-4); vec3 tp = vTriP * triScale;
    vec4 texelColor = texture2D(map, tp.zy) * tw.x + texture2D(map, tp.xz) * tw.y + texture2D(map, tp.xy) * tw.z;
    texelColor = mapTexelToLinear(texelColor); diffuseColor *= texelColor; }
#endif`);
    };
    m.customProgramCacheKey = () => 'tri' + sc; m.needsUpdate = true; return m;
  }
  const TRI_RE = /^h_(shirt|sleeve|socks|coat|vest|pants_up|pants_lo|hat|bag)$/;
  const FURTINT = { cream: '#f6dcaa', gold: '#efc27a', ear: '#d69040' };


  /* ---------- shared animated uniforms (updated from a K.render wrapper) ---------- */
  const FXT = { value: 0 };
  const baseRender = K.render;
  K.render = function (t) {
    FXT.value = t;
    const P = K.A && K.A.player, g = K.game;
    if (K.post.speed) { const sp = P && g && g.state === 'play' && !K.reduceMotion ? K.U.clamp((Math.abs(P.speed || 0) - 17) / 5, 0, 1) : 0; K.post.speed.value += (sp - K.post.speed.value) * .12; }
    baseRender(t);
  };
  /* Foliage wind sway: leaves bend with height, phase from the instance position (trees are instanced). */
  K.windify = function (m) {
    if (!m || m.userData.wind) return m; m.userData.wind = 1;
    const prev = m.onBeforeCompile;
    m.onBeforeCompile = sh => {
      if (prev && prev !== T.Material.prototype.onBeforeCompile) prev(sh);
      sh.uniforms.fxTime = FXT;
      sh.vertexShader = 'uniform float fxTime;\n' + sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
  { vec3 wo = vec3(0.0);
  #ifdef USE_INSTANCING
    wo = instanceMatrix[3].xyz;
  #endif
    float h = max(0.0, transformed.y - 1.2), ph = wo.x * .13 + wo.z * .17;
    float sw = sin(fxTime * 1.6 + ph) * .6 + sin(fxTime * 3.7 + ph * 1.7) * .25;
    transformed.x += sw * .035 * h * h / (1.0 + h * .35); transformed.z += cos(fxTime * 1.3 + ph) * .02 * h * h / (1.0 + h * .35); }`);
    };
    const key = m.customProgramCacheKey ? m.customProgramCacheKey() : '';
    m.customProgramCacheKey = () => key + '|wind'; m.needsUpdate = true; return m;
  };

  /* ---------- World detail: CC0 textures (tex/assets, Poly Haven) applied triplanar in world space, luminance-only, faded with distance ---------- */
  const DET = { brick: [.335, 2.6], sidewalk: [.377, 3.2], asphalt: [.336, 4.0], grass: [.229, 3.4], planks: [.569, 2.8], rooftiles: [.358, 3.0], stucco: [.63, 4.2], cobble: [.393, 3.0], sand: [.441, 4.0], bark: [.322, 1.6] };
  const detTex = {};
  function dtex(n) { if (!detTex[n]) { const t = new T.TextureLoader().load('tex/assets/' + n + '.jpg'); t.wrapS = t.wrapT = T.RepeatWrapping; t.anisotropy = 4; detTex[n] = t; } return detTex[n]; }
  const detVS = `
  { vec4 dwp = vec4(transformed, 1.0); vec3 dn = objectNormal;
  #ifdef USE_INSTANCING
    dwp = instanceMatrix * dwp; dn = mat3(instanceMatrix) * dn;
  #endif
    dwp = modelMatrix * dwp; vDetW = dwp.xyz; vDetN = normalize(mat3(modelMatrix) * dn); }`;
  const detFSHead = 'varying vec3 vDetW; varying vec3 vDetN; uniform float detStrength; uniform float fxTime;\n' +
    'vec3 detW3(){ vec3 w = pow(abs(normalize(vDetN)), vec3(4.0)); return w / (w.x + w.y + w.z + 1e-4); }\n' +
    'float detS(sampler2D t, float sc, float mean){ vec3 w = detW3(); vec3 c = texture2D(t, vDetW.zy / sc).rgb * w.x + texture2D(t, vDetW.xz / sc).rgb * w.y + texture2D(t, vDetW.xy / sc).rgb * w.z; return dot(c, vec3(.299, .587, .114)) / mean; }\n' +
    'float detFade(){ return 1.0 - smoothstep(55.0, 170.0, length(vDetW - cameraPosition)); }\n' +
    'float cvn(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f); float a = fract(sin(dot(i, vec2(127.1, 311.7))) * 43758.5), b = fract(sin(dot(i + vec2(1, 0), vec2(127.1, 311.7))) * 43758.5), c = fract(sin(dot(i + vec2(0, 1), vec2(127.1, 311.7))) * 43758.5), d = fract(sin(dot(i + vec2(1, 1), vec2(127.1, 311.7))) * 43758.5); return mix(mix(a, b, f.x), mix(c, d, f.x), f.y); }\n' +
    'float cloudShade(){ vec2 q = vDetW.xz * .0065 + vec2(fxTime * .012, fxTime * .004); float n = cvn(q) * .65 + cvn(q * 2.3 + 7.1) * .35; return mix(1.0, .8, smoothstep(.56, .7, n)); }\n';
  K.detailify = function (m, names, opt) {
    if (!m || m.userData.detail) return m;
    opt = opt || {}; const list = [].concat(names); m.userData.detail = list.join('+');
    const prev = m.onBeforeCompile;
    m.onBeforeCompile = sh => {
      if (prev && prev !== T.Material.prototype.onBeforeCompile) prev(sh);
      list.forEach((n, i) => { sh.uniforms['detMap' + i] = { value: dtex(n) }; });
      sh.uniforms.detStrength = { value: opt.strength == null ? .55 : opt.strength }; sh.uniforms.fxTime = FXT;
      sh.vertexShader = 'varying vec3 vDetW; varying vec3 vDetN;\n' + sh.vertexShader.replace('#include <worldpos_vertex>', '#include <worldpos_vertex>' + detVS);
      let body;
      if (opt.terrain) body = `{ float gr = clamp((diffuseColor.g - max(diffuseColor.r * .92, diffuseColor.b * 1.05)) * 6.0, 0.0, 1.0);
        float sd = 1.0 - smoothstep(.05, .11, distance(diffuseColor.rgb, vec3(.957, .863, .651)));   // sand = the terrain's sand vertex colour
        float d = mix(mix(detS(detMap1, ${DET[list[1]][1].toFixed(2)}, ${DET[list[1]][0].toFixed(3)}), detS(detMap0, ${DET[list[0]][1].toFixed(2)}, ${DET[list[0]][0].toFixed(3)}), gr), detS(detMap2, ${DET[list[2]][1].toFixed(2)}, ${DET[list[2]][0].toFixed(3)}), sd);
        diffuseColor.rgb *= mix(1.0, clamp(d, .45, 1.6), detStrength * detFade()) * cloudShade(); }`;
      else body = `{ float d = detS(detMap0, ${DET[list[0]][1].toFixed(2)}, ${DET[list[0]][0].toFixed(3)}); diffuseColor.rgb *= mix(1.0, clamp(d, .45, 1.6), detStrength * detFade()) * cloudShade(); }`;
      sh.fragmentShader = detFSHead + list.map((n, i) => 'uniform sampler2D detMap' + i + ';\n').join('') + sh.fragmentShader.replace('#include <color_fragment>', '#include <color_fragment>\n' + body);
    };
    const key = m.customProgramCacheKey ? m.customProgramCacheKey() : '';
    m.customProgramCacheKey = () => key + '|det:' + m.userData.detail + (opt.terrain ? 'T' : '');
    m.needsUpdate = true; return m;
  };
  const BYNAME = { brick: 'brick', wall: 'stucco', stone: 'sidewalk', roof: 'rooftiles', bark: 'bark', bark_dark: 'bark', bark_light: 'bark', wood: 'planks', wood_dark: 'planks', concrete: 'sidewalk', deck: 'planks', road: 'asphalt', lombard: 'cobble' };
  K.applyWorldDetail = function (root) {
    const seen = new Set();
    root.traverse(o => {
      if (!o.isMesh || o.isSkinnedMesh) return;
      (Array.isArray(o.material) ? o.material : [o.material]).forEach(m => {
        if (!m || seen.has(m) || !(m.isMeshToonMaterial || m.isMeshStandardMaterial)) return; seen.add(m);
        if (m.name === 'terrain') K.detailify(m, ['grass', 'sidewalk', 'sand'], { terrain: true, strength: .6 });
        else if (BYNAME[m.name]) K.detailify(m, BYNAME[m.name], { strength: m.name === 'wall' ? .4 : .55 });
        if (/^leaf/.test(m.name)) K.windify(m);
      });
    });
  };

  /* Hook: characters with a *_coat material get fur + hull at load time (clones inherit them). */
  const baseToonify = K.toonify;
  K.toonify = function (root, opt) {
    baseToonify(root, opt);
    const todo = [];
    root.traverse(o => {
      if (!o.isSkinnedMesh || o.userData.ink) return;
      const mats = Array.isArray(o.material) ? o.material : [o.material];
      const coat = mats.findIndex(mm => mm && /_coat/.test(mm.name));
      if (coat < 0) return;
      mats.forEach(mm => { if (mm && /_coat/.test(mm.name) && !mm.userData.fur) K.furify(mm, mm.map ? { strength: .1, fill: .04, rim: .26 } : undefined); });
      todo.push([o, mats.length > 1 ? (i => i === coat) : null]);
    });
    todo.forEach(([o, f]) => { const painted = (Array.isArray(o.material) ? o.material : [o.material]).some(mm => mm && mm.map && /_coat/.test(mm.name)); if (o.geometry.attributes._fluff) K.skinFringe(o, f, painted ? .0075 : .013); else K.skinInk(o, .016, '#1e1026', f); });
    root.traverse(o => {   // painted fur cards: alpha-tested, double-sided, warm shading, no shadow casting
      if (!o.isMesh) return;
      (Array.isArray(o.material) ? o.material : [o.material]).forEach(m => {
        if (m && TRI_RE.test(m.name) && !m.userData.tri) triPatch(m);
        if (m && /^kyoto_(iris|white)$/.test(m.name) && !m.userData.eyeLit) { m.emissive = m.color.clone().multiplyScalar(.75); m.userData.eyeLit = 1; }
        const mt = m && /_fur(?:_(\w+))?$/.exec(m.name);
        if (!mt || m.userData.fur) return;
        m.color.set(FURTINT[mt[1]] || '#f6dcaa').convertSRGBToLinear();
        m.alphaTest = .5; m.side = T.DoubleSide; m.transparent = false; K.furify(m, { strength: 0, rim: .22 }); o.castShadow = false;
      });
    });
    return root;
  };
  /* Material.clone() drops onBeforeCompile: restore shader patches on per-instance copies. */
  const baseOwn = K.ownMaterials;
  K.ownMaterials = function (root) {
    const r = baseOwn(root);
    root.traverse(o => { if (!o.isMesh) return; (Array.isArray(o.material) ? o.material : [o.material]).forEach(m => {
      if (m.userData.fur && m.onBeforeCompile === T.Material.prototype.onBeforeCompile) { const f = m.userData.furOpt || {}; K.furify(m, { scale: f.scale, strength: f.strength, ink: new T.Color(f.ink || '#7a4418'), rim: f.rim, fill: f.fill }); }
      if (m.userData.tri && m.onBeforeCompile === T.Material.prototype.onBeforeCompile) triPatch(m);
      if (m.userData.fringe && m.onBeforeCompile === T.Material.prototype.onBeforeCompile) { const w = m.userData.fringe === 2 ? m.userData.inkW : 0; const amp = m.userData.frAmp; m.onBeforeCompile = sh => frPatch(sh, w, amp); m.customProgramCacheKey = () => 'fringe' + m.userData.fringe + w + amp; m.needsUpdate = true; }
      else if (m.userData.inkW && m.onBeforeCompile === T.Material.prototype.onBeforeCompile) inkPatch(m, m.userData.inkW); }); });
    return r;
  };
})();
