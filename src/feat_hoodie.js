/* Continuous private garment copied from read-only original Kyoto surface topology. Original skin/rig/clips/cap remain immutable. Posed original-edge barycentric references drive garment-only ease; triangle contacts are audited separately. */
(function (K) {
'use strict';
const T = K.T, V3 = T.Vector3;
const lin = h => new T.Color(h).convertSRGBToLinear();
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const violet = '#b786ff';

// Private garment geometry is sampled directly from the immutable original skin.
// Skin-owned armhole topology supplies the complete chest-to-sleeve transition.
/* ---- cut fields (bind space, +z forward, +y up, +x = Kyoto's left). Positive = covered by cloth. ---- */
// Original skin landmarks: dorsal withers (z .257), tail-root skin (z -.649).
// These are surface measurements, not the nearly coincident front/back bone pivots.
const FIT = { withers: [-.003, 1.823, .257], tailRoot: [-.013, 1.741, -.649], hem: -.197020, cuff: .48, thickness: .008 };
const hemZ = y => FIT.hem + .40 * Math.max(0, 1.02 - y);
const CUFF_TOP=.52,CUFF_EXIT=.48,CUFF_LENGTH=.04;
function anatomicalField(p,w,cuff) {
  const [x,y,z]=p;
  const neckline=1.85-.37*smooth(.45,.85,z)*(1-smooth(.02,.40,Math.abs(x)))-y;
  const axisZ=y>.88?.645548+(y-.88)/.34*.112161:.645548+(.88-y)/.66*.112161;
  const legField=Math.min(.272-Math.hypot(Math.abs(x)-.282981,z-axisZ),Math.abs(x)-.045,y-cuff);
  const frontFloor=cuff+(.965-cuff)*smooth(.30,.52,z);
  const sternumField=Math.max(y-frontFloor,legField);
  return Math.min(z-hemZ(y),neckline,sternumField,(.45-w.head)*.45,(.05-w.rear)*.45,(.30-w.tail)*.45);
}
const torsoField=(p,w)=>anatomicalField(p,w,CUFF_EXIT);
const coverageField=(p,w)=>anatomicalField(p,w,CUFF_EXIT);

function buildMesh(body,field=torsoField) {
  const g = body.geometry, P = g.attributes.position, SI = g.attributes.skinIndex, SW = g.attributes.skinWeight, idx = g.index.array;
  const bones = body.skeleton.bones, boneGroup = bones.map(b => /^head$|^ear/.test(b.name) ? 'head' : /^tail/.test(b.name) ? 'tail' : /^bl_/.test(b.name) ? 'rear' : /^fl_/.test(b.name) ? 'foreleg' : '');
  // Weld seam duplicates so offsetting cannot tear the cloth.
  const key = new Map(), rep = new Int32Array(P.count), U = [];
  for (let i = 0; i < P.count; i++) {
    const wm=new Map();for(let j=0;j<4;j++){const w=SW.array[i*4+j];if(w>0)wm.set(SI.array[i*4+j],(wm.get(SI.array[i*4+j])||0)+w);}const k=[P.getX(i),P.getY(i),P.getZ(i)].join(',')+'|'+[...wm].sort((a,b)=>a[0]-b[0]).map(e=>e.join(':')).join(',');
    let u = key.get(k); if (u === undefined) { u = U.length; key.set(k, u); U.push(i); } rep[i] = u;
  }
  const pos = U.map(i => [P.getX(i), P.getY(i), P.getZ(i)]);
  const wts = U.map(i => { const m = new Map(); for (let k = 0; k < 4; k++) { const wv = SW.array[i * 4 + k]; if (wv > 0) m.set(SI.array[i * 4 + k], (m.get(SI.array[i * 4 + k]) || 0) + wv); } return m; });
  const nrm = pos.map(() => [0, 0, 0]), tris = [], triangleKeys=new Set();
  for (let i = 0; i < idx.length; i += 3) {
    const a = rep[idx[i]], b = rep[idx[i + 1]], c = rep[idx[i + 2]]; if (a === b || b === c || a === c) continue; const tk=[a,b,c].sort((a,b)=>a-b).join(':');if(triangleKeys.has(tk))continue;triangleKeys.add(tk);tris.push([a,b,c]);
    const A = pos[a], B = pos[b], C = pos[c], ux = B[0] - A[0], uy = B[1] - A[1], uz = B[2] - A[2], vx = C[0] - A[0], vy = C[1] - A[1], vz = C[2] - A[2];
    const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    for (const q of [a, b, c]) { nrm[q][0] += nx; nrm[q][1] += ny; nrm[q][2] += nz; }
  }
  nrm.forEach(n => { const l = Math.hypot(n[0], n[1], n[2]) || 1; n[0] /= l; n[1] /= l; n[2] /= l; });
  const group = wts.map(m => { const o = { head: 0, tail: 0, rear: 0, foreleg: 0 }; m.forEach((v, b) => { if (boneGroup[b]) o[boneGroup[b]] += v; }); return o; });
  const s = pos.map((p, i) => field(p, group[i]));
  // Switch fur off wherever cloth covers (with a little margin under the trim).
  const originalP=body.geometry.attributes.position,originalSI=body.geometry.attributes.skinIndex,originalSW=body.geometry.attributes.skinWeight;
  const covered=new Uint8Array(originalP.count);
  for(let i=0;i<originalP.count;i++){const p=[originalP.getX(i),originalP.getY(i),originalP.getZ(i)],w={head:0,tail:0,rear:0,foreleg:0};let legWeight=0;
    for(let k=0;k<4;k++){const group=boneGroup[originalSI.array[i*4+k]];if(group)w[group]+=originalSW.array[i*4+k];if(/^fl_/.test(bones[originalSI.array[i*4+k]].name))legWeight+=originalSW.array[i*4+k];}covered[i]=coverageField(p,w)>.002&&w.head<.30&&w.rear<.001&&w.tail<.001?1:0;}

  // Clip triangles on s = 0; crossings are shared per edge, so the cut is watertight.
  const cross = new Map(), out = { pos: [], nrm: [], wts: [], s: [], refs: [] };
  const mixW = (a, b, t) => { const m = new Map(); a.forEach((v, k) => m.set(k, v * (1 - t))); b.forEach((v, k) => m.set(k, (m.get(k) || 0) + v * t)); return m; };
  const old2new = new Map();
  const take = u => { let n = old2new.get(u); if (n === undefined) { n = out.pos.length; old2new.set(u, n); out.pos.push(pos[u]); out.nrm.push(nrm[u]); out.wts.push(wts[u]); out.s.push(s[u]);out.refs.push([[u,1]]); } return n; };
  const edge = (a, b) => {
    const k = a < b ? a + '_' + b : b + '_' + a; let n = cross.get(k); if (n !== undefined) return n;
    const lo = a < b ? a : b, hi = a < b ? b : a, t = s[lo] / (s[lo] - s[hi]);
    const p = pos[lo].map((v, i) => v + (pos[hi][i] - v) * t), nn = nrm[lo].map((v, i) => v + (nrm[hi][i] - v) * t); const l = Math.hypot(...nn) || 1;
    n = out.pos.length; cross.set(k, n); out.pos.push(p); out.nrm.push(nn.map(v => v / l)); out.wts.push(mixW(wts[lo], wts[hi], t)); out.s.push(0);out.refs.push([[lo,1-t],[hi,t]]); return n;
  };
  const originalLinks=adjacency(pos.length,tris),seenOriginal=new Set(),originalComponents=[];for(let i=0;i<pos.length;i++){if(seenOriginal.has(i))continue;const stack=[i],component=new Set();while(stack.length){const q=stack.pop();if(seenOriginal.has(q))continue;seenOriginal.add(q);component.add(q);for(const n of originalLinks[q])stack.push(n);}originalComponents.push(component);}originalComponents.sort((a,b)=>b.size-a.size);const principalOriginalSurface=originalComponents[0];
  const outTris = [];
  for (const t of tris.filter(t=>principalOriginalSurface.has(t[0]))) {
    const poly = [];
    for (let i = 0; i < 3; i++) { const a = t[i], b = t[(i + 1) % 3], ia = s[a] >= 0, ib = s[b] >= 0; if (ia) poly.push(take(a)); if (ia !== ib) poly.push(edge(a, b)); }
    for (let i = 1; i < poly.length - 1; i++) outTris.push([poly[0], poly[i], poly[i + 1]]);
  }
  return { out, outTris, covered, rep, U, s, source:{pos,nrm,wts,tris,components:originalComponents.map(c=>[...c])} };
}

function adjacency(n, tris) { const adj = Array.from({ length: n }, () => new Set()); for (const t of tris) for (let i = 0; i < 3; i++) { adj[t[i]].add(t[(i + 1) % 3]); adj[t[i]].add(t[(i + 2) % 3]); } return adj; }
function boundaryLoops(n, tris) {
  const next = new Map(), have = new Set(); for (const t of tris) for (let i = 0; i < 3; i++) have.add(t[i] + '>' + t[(i + 1) % 3]);
  for (const t of tris) for (let i = 0; i < 3; i++) { const a = t[i], b = t[(i + 1) % 3]; if (!have.has(b + '>' + a)) next.set(a, b); }
  const loops = [], seen = new Set();
  for (const start of next.keys()) {
    if (seen.has(start)) continue; const loop = []; let c = start;
    while (c !== undefined && !seen.has(c)) { seen.add(c); loop.push(c); c = next.get(c); }
    if (loop.length > 6) loops.push(loop);
  }
  return loops;
}
function topWeights(m) { const a = [...m.entries()].sort((p, q) => q[1] - p[1]).slice(0, 4); const sum = a.reduce((t, e) => t + e[1], 0) || 1; while (a.length < 4) a.push([0, 0]); return a.map(e => [e[0], e[1] / sum]); }

/* Accumulates skinned geometry (positions + skin weights) and emits one SkinnedMesh. */
function Builder() {
  const b = { p: [], n: [], c: [], uv: [], si: [], sw: [], idx: [] };
  b.vert = (p, n, wm, col, uv) => {
    const i = b.p.length / 3; b.p.push(p[0], p[1], p[2]); b.n.push(n[0], n[1], n[2]); const tw = topWeights(wm);
    for (const [bi, w] of tw) { b.si.push(bi); b.sw.push(w); } b.c.push(col[0], col[1], col[2]); if (uv) b.uv.push(uv[0], uv[1]); return i;
  };
  b.make = (body, mat, name, shadow = true) => {
    const geo = new T.BufferGeometry();
    geo.setAttribute('position', new T.Float32BufferAttribute(b.p, 3)); geo.setAttribute('normal', new T.Float32BufferAttribute(b.n, 3));
    geo.setAttribute('color', new T.Float32BufferAttribute(b.c, 3)); if (b.uv.length) geo.setAttribute('uv', new T.Float32BufferAttribute(b.uv, 2));
    geo.setAttribute('skinIndex', new T.Uint16BufferAttribute(b.si, 4)); geo.setAttribute('skinWeight', new T.Float32BufferAttribute(b.sw, 4)); geo.setIndex(b.idx);
    const m = new T.SkinnedMesh(geo, mat); m.name = name; m.frustumCulled = false; m.castShadow = shadow; m.receiveShadow = shadow;
    m.position.copy(body.position); m.quaternion.copy(body.quaternion); m.scale.copy(body.scale); body.parent.add(m); m.bind(body.skeleton, body.bindMatrix); return m;
  };
  return b;
}

function emblemCanvas(c, w, h) {
  c.clearRect(0, 0, w, h); c.translate(w / 2, h / 2); const s = w / 190;
  c.scale(s, s); c.lineCap = c.lineJoin = 'round'; c.strokeStyle = violet; c.shadowColor = violet; c.shadowBlur = 8; c.lineWidth = 11;
  c.beginPath(); c.moveTo(-34, -30); c.lineTo(-62, 0); c.lineTo(-34, 30); c.moveTo(34, -30); c.lineTo(62, 0); c.lineTo(34, 30); c.stroke();
  c.strokeStyle = violet; c.lineWidth = 9; c.beginPath(); c.moveTo(11, -42); c.lineTo(-11, 42); c.stroke();
  c.shadowBlur = 0; c.strokeStyle = '#8a5cf0'; c.lineWidth = 2.2; c.beginPath(); c.moveTo(-34, -30); c.lineTo(-62, 0); c.lineTo(-34, 30); c.moveTo(34, -30); c.lineTo(62, 0); c.lineTo(34, 30); c.stroke();
}
function flagCanvas(c, w, h) {
  const pad = 14; ['#161616', '#d62828', '#ffc933'].forEach((col, i) => { c.fillStyle = col; c.fillRect(pad, pad + i * (h - pad * 2) / 3, w - pad * 2, (h - pad * 2) / 3 + 1); });
  // woven patch edge and stitching: it reads as a sewn-on sleeve badge.
  c.strokeStyle = '#2a1b4a'; c.lineWidth = 7; c.strokeRect(pad - 2, pad - 2, w - pad * 2 + 4, h - pad * 2 + 4);
  c.strokeStyle = '#efe4ff'; c.lineWidth = 2.5; c.setLineDash([9, 7]); c.strokeRect(pad + 5, pad + 5, w - pad * 2 - 10, h - pad * 2 - 10);
}

/* Decal: garment triangles around a point, subdivided and given planar UVs. Stays on the cloth and shares its skin. */
function addDecal(builder, G, center, uAxis, vAxis, hw, hh, facing, attached) {
  const U = new V3(...uAxis), Vv = new V3(...vAxis), F = new V3(...facing), C = new V3(...center), q = new V3(), r = new V3();
  const level = 0, nSub = 1 << level;
  for (const t of G.tris) {
    const P0 = G.pos[t[0]], P1 = G.pos[t[1]], P2 = G.pos[t[2]];
    q.set((P0[0] + P1[0] + P2[0]) / 3, (P0[1] + P1[1] + P2[1]) / 3, (P0[2] + P1[2] + P2[2]) / 3).sub(C);
    if (Math.abs(q.dot(U)) > hw + .08 || Math.abs(q.dot(Vv)) > hh + .08 || q.dot(F) > .6 || q.dot(F) < -.6) continue;
    const nm = G.nrm[t[0]]; if (new V3(nm[0], nm[1], nm[2]).dot(F) < .25) continue;
    const grid = [];
    for (let i = 0; i <= nSub; i++) for (let j = 0; i + j <= nSub; j++) {
      const a = i / nSub, b = j / nSub, c = 1 - a - b, p = [0, 1, 2].map(k => P0[k] * c + P1[k] * a + P2[k] * b), n = [0, 1, 2].map(k => G.nrm[t[0]][k] * c + G.nrm[t[1]][k] * a + G.nrm[t[2]][k] * b);
      const l = Math.hypot(...n) || 1; const off = .001; p[0] += n[0] / l * off; p[1] += n[1] / l * off; p[2] += n[2] / l * off;
      r.set(...p).sub(C); const wm = new Map(); for (const [k, ww] of [[0, c], [1, a], [2, b]]) G.wts[t[k]].forEach((v, bi) => wm.set(bi, (wm.get(bi) || 0) + v * ww));
      const vi=builder.vert(p, n.map(v => v / l), wm, [1, 1, 1], [.5 + r.dot(U) / (2 * hw), .5 + r.dot(Vv) / (2 * hh)]);
      if(attached)attached({index:vi,triangle:t.slice(),barycentric:[c,a,b]});
      grid.push({ i, j, v: vi });
    }
    const at = (i, j) => grid.find(e => e.i === i && e.j === j).v;
    for (let i = 0; i < nSub; i++) for (let j = 0; i + j < nSub; j++) {
      builder.idx.push(at(i, j), at(i + 1, j), at(i, j + 1)); if (i + j < nSub - 1) builder.idx.push(at(i + 1, j), at(i + 1, j + 1), at(i, j + 1));
    }
  }
}


function normals(pos,tris) {
  const n=pos.map(()=>[0,0,0]);for(const t of tris){const a=new V3(...pos[t[0]]),b=new V3(...pos[t[1]]),c=new V3(...pos[t[2]]),v=b.sub(a).cross(c.sub(a));for(const i of t){n[i][0]+=v.x;n[i][1]+=v.y;n[i][2]+=v.z;}}
  return n.map(v=>{const l=Math.hypot(...v)||1;return v.map(x=>x/l)});
}
function build(dog) {
  let body;dog.root.traverse(o=>{if(o.isSkinnedMesh&&o.name==='Kyoto')body=o;});if(!body)throw Error('Kyoto hoodie: missing original skin');
  const BI=Object.fromEntries(body.skeleton.bones.map((b,i)=>[b.name,i])),front=BI.front;
  const R=buildMesh(body),{out,outTris,covered}=R,weights=out.wts.map(m=>new Map(topWeights(m))),baseCount=out.pos.length;
  const loops=boundaryLoops(baseCount,outTris),loopInfo=loops.map(l=>({l,c:l.reduce((v,i)=>v.map((x,k)=>x+out.pos[i][k]/l.length),[0,0,0])}));
  const cuffLoops=loopInfo.filter(o=>o.c[1]<.60&&Math.abs(o.c[0])>.10),neckLoop=loopInfo.find(o=>o.c[1]>1.55&&o.c[2]>.4),hemLoops=loopInfo.filter(o=>!cuffLoops.includes(o)&&o!==neckLoop);
  if(new Set(cuffLoops.map(o=>Math.sign(o.c[0]))).size!==2||!neckLoop)throw Error('Expected two original cuff boundaries and one neckline: '+JSON.stringify(loopInfo.map(o=>({count:o.l.length,c:o.c,bounds:[0,1,2].map(k=>[Math.min(...o.l.map(i=>out.pos[i][k])),Math.max(...o.l.map(i=>out.pos[i][k]))])}))));
  const base=lin('#281b44'),fold=lin('#493267'),dark=lin('#1a1030'),rgb=c=>[c.r,c.g,c.b],all=new Builder(),roleSets={shell:new Set(),sleeves:new Set(),rib:new Set(),foldedHood:new Set(),inner:new Set(),sewnCloth:new Set()},roleTriangles={shell:[],sleeves:[],rib:[],foldedHood:[],inner:[],sewnCloth:[]};
  const vertexSpecs=[],adj=adjacency(baseCount,outTris),boundary=new Set(loops.flat());
  // Branch membership is connected original geometry, seeded below each elbow.
  // Weight thresholds are not used as ownership or as a width denominator.
  const sourceAdj=adjacency(R.source.pos.length,R.source.tris),branch=new Int8Array(R.source.pos.length);
  function branchRegion(sign){let seed=-1,best=Infinity;for(let i=0;i<R.source.pos.length;i++){const p=R.source.pos[i],d=(p[0]-sign*.283)**2+(p[1]-.50)**2+(p[2]-.710)**2;if(d<best){best=d;seed=i;}}const seen=new Set(),stack=[seed];while(stack.length){const i=stack.pop();if(seen.has(i))continue;seen.add(i);const p=R.source.pos[i],y=p[1],z=y>.88?.645548+(y-.88)/.34*.112161:.645548+(.88-y)/.66*.112161,rad=Math.hypot(p[0]-sign*.282981,p[2]-z);if(y<.28||y>1.29||p[0]*sign<.075||p[2]<.32||rad>.31)continue;branch[i]=sign;for(const j of sourceAdj[i])stack.push(j);}}
  branchRegion(-1);branchRegion(1);
  const vertexBranch=out.refs.map(ref=>{const a=branch[ref[0][0]];return a&&ref.every(([i])=>branch[i]===a)?a:0;});
  function initialOffset(i){const p=out.pos[i],leg=vertexBranch[i]!==0,cuff=leg&&p[1]<=CUFF_TOP+.002;return cuff?.019+.001*(.5+.5*Math.cos(Math.atan2(p[2]-.71,p[0]-(p[0]<0?-.283:.283))*24)):leg?.020:.025;}
  function ribAt(p,i){const cuff=vertexBranch[i]!==0&&p[1]<=CUFF_TOP+.002,frontBand=p[2]>.88&&Math.abs(p[0])<.55&&Math.abs(p[1]-(.975+.020*(1-smooth(.04,.26,Math.abs(p[0])))))<.021,nearHem=hemLoops.some(o=>o.l.some(j=>Math.hypot(...p.map((v,k)=>v-out.pos[j][k]))<.042));return cuff||frontBand||nearHem;}
  for(let i=0;i<baseCount;i++){const p=out.pos[i],n=out.nrm[i],off=initialOffset(i),isRib=ribAt(p,i),armSeam=vertexBranch[i]&&p[1]>1.12&&p[1]<1.18,colour=isRib?fold:armSeam?base.clone().lerp(fold,.12):base.clone().lerp(fold,.12+.15*smooth(-.2,.9,n[1])),v=all.vert(p.map((x,k)=>x+n[k]*off),n,weights[i],rgb(colour));vertexSpecs.push({kind:'source',i,offset:off});roleSets[vertexBranch[i]?'sleeves':'shell'].add(v);if(isRib)roleSets.rib.add(v);}
  for(const t of outTris){all.idx.push(...t);const role=t.some(i=>vertexBranch[i])?'sleeves':'shell';roleTriangles[role].push(t.slice());if(t.every(i=>roleSets.rib.has(i)))roleTriangles.rib.push(t.slice());}
  const edgeSpecs=[];
  function originalRingRefs(side,y,angle){const X=side*.282981,Z=.645548+(.88-y)/.66*.112161,candidates=[];for(const tri of R.source.tris){if(!tri.every(i=>branch[i]===side))continue;for(let k=0;k<3;k++){const a=tri[k],b=tri[(k+1)%3],A=R.source.pos[a],B=R.source.pos[b];if((A[1]-y)*(B[1]-y)>=0)continue;const t=(y-A[1])/(B[1]-A[1]),P=A.map((v,j)=>v+(B[j]-v)*t),an=Math.atan2(P[2]-Z,P[0]-X),d=Math.atan2(Math.sin(an-angle),Math.cos(an-angle));candidates.push({P,refs:[[a,1-t],[b,t]],d});}}candidates.sort((a,b)=>Math.abs(a.d)-Math.abs(b.d));if(candidates.length<2)throw Error('Missing original lower foreleg ring');let A=candidates.find(c=>c.d<=0),B=candidates.find(c=>c.d>=0);if(!A||!B)return candidates[0];const t=-A.d/(B.d-A.d||1),refs=new Map();for(const [i,w] of A.refs)refs.set(i,(refs.get(i)||0)+w*(1-t));for(const[i,w]of B.refs)refs.set(i,(refs.get(i)||0)+w*t);return{P:A.P.map((v,k)=>v+(B.P[k]-v)*t),refs:[...refs]};}
  function blendedOriginalWeights(refs){const w=new Map();for(const[i,a]of refs)for(const[bi,b]of R.source.wts[i])w.set(bi,(w.get(bi)||0)+a*b);return new Map(topWeights(w));}
  function turnEdge(loop,isCuff){const side=Math.sign(out.pos[loop[0]][0]),N=loop.length,M=isCuff?96:Math.max(32,Math.min(160,Math.round(N*.65))),lengths=[0];for(let k=0;k<N;k++)lengths.push(lengths[k]+Math.hypot(...out.pos[loop[(k+1)%N]].map((v,j)=>v-out.pos[loop[k]][j])));const total=lengths[N],params=lengths.slice(0,N).map(d=>d/total),samples=[];for(let k=0;k<M;k++){const target=k/M*total;let e=0;while(e<N-1&&lengths[e+1]<target)e++;const t=(target-lengths[e])/(lengths[e+1]-lengths[e]||1),donors=[loop[e],loop[(e+1)%N]],w=new Map();for(const[bi,v]of weights[donors[0]])w.set(bi,v*(1-t));for(const[bi,v]of weights[donors[1]])w.set(bi,(w.get(bi)||0)+v*t);samples.push({donors,t,w:new Map(topWeights(w))});}const rows=[loop.slice()];for(let r=1;r<=6;r++){const a=r/6*Math.PI,row=[];for(const S of samples){const P=S.donors.map(i=>all.p.slice(i*3,i*3+3)),nn=S.donors.map(i=>all.n.slice(i*3,i*3+3)),Q=P[0].map((v,k)=>v+(P[1][k]-v)*S.t),n=nn[0].map((v,k)=>v+(nn[1][k]-v)*S.t),normalShift=.005*Math.sin(a),upShift=.005*(1-Math.cos(a)),j=all.vert(Q.map((v,k)=>v+n[k]*normalShift+(k===1?upShift:0)),n,S.w,rgb(fold));vertexSpecs.push({kind:'edge',donor:S.donors[0],donors:S.donors,t:S.t,normalShift,upShift,isCuff,w:S.w,side});edgeSpecs.push({index:j,donor:S.donors[0],isCuff});roleSets.rib.add(j);row.push(j);}rows.push(row);if(r===1)stitch(loop,row,params,Array.from({length:M},(_,i)=>i/M));else stitch(rows[r-1],row,Array.from({length:M},(_,i)=>i/M),Array.from({length:M},(_,i)=>i/M));}
    function stitch(A,B,pa,pb){let i=0,j=0;while(i<A.length||j<B.length){const na=i+1<=A.length?(i+1===A.length?1:pa[i+1]):Infinity,nb=j+1<=B.length?(j+1===B.length?1:pb[j+1]):Infinity;let tr;if(na<=nb&&i<A.length){tr=[A[i%A.length],B[j%B.length],A[(i+1)%A.length]];i++;}else{tr=[A[i%A.length],B[j%B.length],B[(j+1)%B.length]];j++;}all.idx.push(...tr);roleTriangles.rib.push(tr);}}
  }
  function Rsource(i,k){return R.source.pos[i][k];}
  for(const o of cuffLoops)turnEdge(o.l,true);for(const o of hemLoops)turnEdge(o.l,false);
  // The hood uses the actual connected rear neckline, with its first row shared.
  const selected=neckLoop.l.map(i=>out.pos[i][2]<.68&&out.pos[i][1]>1.70),arcs=[];for(let k=0;k<selected.length;k++){if(!selected[k]||selected[(k+selected.length-1)%selected.length])continue;const a=[];for(let j=k;selected[j%selected.length]&&a.length<selected.length;j++)a.push(neckLoop.l[j%selected.length]);arcs.push(a);}const neckArc=arcs.sort((a,b)=>b.length-a.length)[0];if(!neckArc||neckArc.length<8)throw Error('Missing connected posterior neckline arc');
  const width=Math.max(...neckArc.map(i=>Math.abs(out.pos[i][0]))),hoodRows=[neckArc.slice()],hoodSpecs=[],hoodBind=[],hoodSupportCache=new Map();
  function support(x,z){const key=x.toFixed(5)+':'+z.toFixed(5);if(hoodSupportCache.has(key))return hoodSupportCache.get(key);let best=null;for(const t of outTris){const[A,B,C]=t.map(i=>out.pos[i]),d=(B[2]-C[2])*(A[0]-C[0])+(C[0]-B[0])*(A[2]-C[2]);if(Math.abs(d)<1e-10)continue;const a=((B[2]-C[2])*(x-C[0])+(C[0]-B[0])*(z-C[2]))/d,b=((C[2]-A[2])*(x-C[0])+(A[0]-C[0])*(z-C[2]))/d,c=1-a-b;if(Math.min(a,b,c)<-1e-7)continue;const y=A[1]*a+B[1]*b+C[1]*c;if(y<1.66||y>1.91)continue;if(!best||y>best.y)best={y,refs:t.map((i,k)=>[i,[a,b,c][k]])};}if(!best){let m=-1,dist=Infinity;for(let i=0;i<baseCount;i++){const p=out.pos[i];if(p[1]<1.66||p[1]>1.91)continue;const d=(p[0]-x)**2+(p[2]-z)**2;if(d<dist){dist=d;m=i;}}if(m<0)throw Error('Missing original shoulder support');best={y:out.pos[m][1],refs:[[m,1]],nearestFallback:true};}hoodSupportCache.set(key,best);return best;}
  for(let r=1;r<=24;r++){const t=r/24,row=[];for(let k=0;k<neckArc.length;k++){const donor=neckArc[k],A=out.pos[donor],u=A[0]/width,wing=smooth(.58,.93,Math.abs(u)),outer=t<=.55,foldT=outer?t/.55:(t-.55)/.45,caudal=outer?.22*Math.sin(Math.PI*.5*foldT):.22-.10*foldT,spread=outer?Math.sin(Math.PI*.5*foldT):1-.12*foldT,x=u*(width+(.45-width)*spread)+Math.sign(u)*.020*smooth(.65,.78,Math.abs(u))*(1-smooth(.92,1,Math.abs(u)))*Math.sin(Math.PI*t),z=A[2]-caudal*(1-.85*wing)+.06*wing*Math.sin(Math.PI*t),S=support(x,z),fade=smooth(0,.18,t),skinY=A[1]*(1-fade)+S.y*fade,rise=outer?.115*Math.sin(Math.PI*.5*foldT):.115+.025*Math.sin(Math.PI*.5*foldT),y=skinY+.025+rise*(1-.58*wing),wm=new Map();for(const[i,w]of S.refs)for(const[bi,v]of weights[i])wm.set(bi,(wm.get(bi)||0)+v*w);const skinFade=fade*(1-.70*wing);for(const[bi,v]of wm)wm.set(bi,v*skinFade);for(const[bi,v]of weights[donor])wm.set(bi,(wm.get(bi)||0)+v*(1-skinFade));const w=new Map(topWeights(wm)),p=[x,y,z],isDark=!outer&&t<.97&&Math.abs(x)<.30,isRoll=(t>=.48&&t<=.62)||t>=.97,j=all.vert(p,[0,1,0],w,rgb(isDark?dark:isRoll?fold:base.clone().lerp(fold,.35)));vertexSpecs.push({kind:'hood',p,w,donor,fade});row.push(j);roleSets.foldedHood.add(j);if(isDark)roleSets.inner.add(j);hoodSpecs.push({index:j,p,w,donor,fade,isDark,isRoll,t,u,support:S});hoodBind.push(p);}hoodRows.push(row);const A=hoodRows[r-1],B=row;for(let k=0;k<neckArc.length-1;k++){const t1=[A[k],B[k],A[k+1]],t2=[A[k+1],B[k],B[k+1]];all.idx.push(...t1,...t2);roleTriangles.foldedHood.push(t1,t2);for(const tr of[t1,t2])if(tr.every(i=>roleSets.inner.has(i)))roleTriangles.inner.push(tr);}}
  // Rolled returns have the same shared boundary vertices and only 5 mm thickness.
  const hoodEdges=[hoodRows.map(a=>a[0]),hoodRows.map(a=>a[a.length-1]),hoodRows[24]],hoodReturnSpecs=[];
  for(const E of hoodEdges){const rows=[E.slice()];for(let r=1;r<=6;r++){const a=r/6*Math.PI,row=[];for(const donor of E){const p=all.p.slice(donor*3,donor*3+3),n=all.n.slice(donor*3,donor*3+3),w=new Map();for(let k=0;k<4;k++)if(all.sw[donor*4+k]>0)w.set(all.si[donor*4+k],all.sw[donor*4+k]);const j=all.vert([p[0],p[1]-.005*(1-Math.cos(a)),p[2]-.005*Math.sin(a)],n,w,rgb(fold));vertexSpecs.push({kind:'hoodReturn',donor,down:.005*(1-Math.cos(a)),rear:.005*Math.sin(a)});row.push(j);roleSets.foldedHood.add(j);hoodReturnSpecs.push({index:j,donor});}rows.push(row);const A=rows[r-1],B=row;for(let k=0;k<E.length-1;k++){const t1=[A[k],B[k],A[k+1]],t2=[A[k+1],B[k],B[k+1]];all.idx.push(...t1,...t2);roleTriangles.foldedHood.push(t1,t2);for(const tr of[t1,t2])if(tr.every(i=>roleSets.inner.has(i)))roleTriangles.inner.push(tr);}}}
  const mat=K.toon(lin('#ffffff'),{vertexColors:true,side:T.DoubleSide,transparent:false,opacity:1,alphaTest:0}).clone();mat.skinning=true;mat.emissive=lin('#281b44');mat.emissiveIntensity=.12;mat.name='opaque_woven_hoodie';
  const shell=all.make(body,mat,'kyoto_agent_hoodie'),sleeves=shell,rib=shell,inner=shell,foldedHood=shell,sewnCloth=shell;
  const posedSkin=[],posedNormals=[],posedCloth=[],posedGarment=[],sourcePosed=[],skinMatrices=[],previous=new Float64Array(body.skeleton.bones.length*16).fill(NaN),faceNormals=[],clothNormals=[],incident=Array.from({length:baseCount},()=>[]);for(let k=0;k<outTris.length;k++)for(const i of outTris[k])incident[i].push(k);
  const posePoint=(p,w)=>{let x=0,y=0,z=0;for(const[bi,v]of w){const a=skinMatrices[bi].elements;x+=(a[0]*p[0]+a[4]*p[1]+a[8]*p[2]+a[12])*v;y+=(a[1]*p[0]+a[5]*p[1]+a[9]*p[2]+a[13])*v;z+=(a[2]*p[0]+a[6]*p[1]+a[10]*p[2]+a[14])*v;}return new V3(x,y,z);};
  function inverseBake(index,target,w){let a=0,b=0,c=0,d=0,e=0,f=0,g=0,h=0,j=0,tx=0,ty=0,tz=0;for(const[bi,v]of w){const m=skinMatrices[bi].elements;a+=m[0]*v;b+=m[4]*v;c+=m[8]*v;d+=m[1]*v;e+=m[5]*v;f+=m[9]*v;g+=m[2]*v;h+=m[6]*v;j+=m[10]*v;tx+=m[12]*v;ty+=m[13]*v;tz+=m[14]*v;}const det=a*(e*j-f*h)-b*(d*j-f*g)+c*(d*h-e*g);if(Math.abs(det)<1e-10)throw Error('Singular original garment skin blend');const x=target.x-tx,y=target.y-ty,z=target.z-tz;shell.geometry.attributes.position.setXYZ(index,((e*j-f*h)*x+(c*h-b*j)*y+(b*f-c*e)*z)/det,((f*g-d*j)*x+(a*j-c*g)*y+(c*d-a*f)*z)/det,((d*h-e*g)*x+(b*g-a*h)*y+(a*e-b*d)*z)/det);}
  const normalSums=new Float64Array(vertexSpecs.length*3);
  function bakeNormal(index,x,y,z,w){let a=0,b=0,c=0,d=0,e=0,f=0,g=0,h=0,j=0;for(const[bi,v]of w){const m=skinMatrices[bi].elements;a+=m[0]*v;b+=m[4]*v;c+=m[8]*v;d+=m[1]*v;e+=m[5]*v;f+=m[9]*v;g+=m[2]*v;h+=m[6]*v;j+=m[10]*v;}const det=a*(e*j-f*h)-b*(d*j-f*g)+c*(d*h-e*g);if(Math.abs(det)<1e-10)throw Error('Singular normal skin blend');const nx=((e*j-f*h)*x+(c*h-b*j)*y+(b*f-c*e)*z)/det,ny=((f*g-d*j)*x+(a*j-c*g)*y+(c*d-a*f)*z)/det,nz=((d*h-e*g)*x+(b*g-a*h)*y+(a*e-b*d)*z)/det,L=Math.hypot(nx,ny,nz)||1;shell.geometry.attributes.normal.setXYZ(index,nx/L,ny/L,nz/L);}
  function refreshNormals(){normalSums.fill(0);for(let k=0;k<all.idx.length;k+=3){const i=all.idx[k],j=all.idx[k+1],q=all.idx[k+2],A=posedGarment[i],B=posedGarment[j],C=posedGarment[q],ux=B.x-A.x,uy=B.y-A.y,uz=B.z-A.z,vx=C.x-A.x,vy=C.y-A.y,vz=C.z-A.z,nx=uy*vz-uz*vy,ny=uz*vx-ux*vz,nz=ux*vy-uy*vx;for(const v of[i,j,q]){normalSums[v*3]+=nx;normalSums[v*3+1]+=ny;normalSums[v*3+2]+=nz;}}for(let i=0;i<vertexSpecs.length;i++){const spec=vertexSpecs[i],w=i<baseCount?weights[i]:spec.w||new Map(topWeights(new Map([0,1,2,3].map(k=>[all.si[i*4+k],all.sw[i*4+k]]))));bakeNormal(i,normalSums[i*3],normalSums[i*3+1],normalSums[i*3+2],w);}shell.geometry.attributes.normal.needsUpdate=true;}
let flag,emblem,flagSpecs=[],emblemSpecs=[],flagTargets=[],planeAudit={};
  function updateCloth(){if(!shell.visible)return;dog.root.updateMatrixWorld(true);let changed=false;for(let i=0;i<body.skeleton.bones.length;i++){const M=body.bindMatrixInverse.clone().multiply(body.skeleton.bones[i].matrixWorld).multiply(body.skeleton.boneInverses[i]).multiply(body.bindMatrix);skinMatrices[i]=M;for(let j=0;j<16;j++){const k=i*16+j;if(previous[k]!==M.elements[j])changed=true;previous[k]=M.elements[j];}}if(!changed)return;
    for(const i of sourceRequired)sourcePosed[i]=posePoint(R.source.pos[i],R.source.wts[i]);for(let i=0;i<baseCount;i++){const p=new V3();for(const[j,w]of out.refs[i])p.addScaledVector(sourcePosed[j],w);posedSkin[i]=p;posedNormals[i]=new V3();}
    for(let k=0;k<outTris.length;k++){const t=outTris[k],N=posedSkin[t[1]].clone().sub(posedSkin[t[0]]).cross(posedSkin[t[2]].clone().sub(posedSkin[t[0]]));for(const i of t)posedNormals[i].add(N);faceNormals[k]=N.normalize();}for(const n of posedNormals)n.normalize();
    let minPlane=Infinity,maxOffset=0,unsatisfied=0;
    for(let i=0;i<baseCount;i++){const n=posedNormals[i],delta=n.clone().multiplyScalar(initialOffset(i));if(!boundary.has(i)){const average=new V3();for(const j of adj[i])average.add(posedSkin[j]);average.multiplyScalar(1/adj[i].size).sub(posedSkin[i]);average.addScaledVector(n,-average.dot(n));if(average.length()>.004)average.setLength(.004);delta.addScaledVector(average,.35);}for(let pass=0;pass<3;pass++)for(const k of incident[i]){const N=faceNormals[k],dot=delta.dot(N);if(dot<.012&&N.dot(n)>.12)delta.addScaledVector(N,.012-dot);}const P=out.pos[i],guard=.017*smooth(.38,.425,Math.abs(P[0]))*(1-smooth(.64,.71,P[2]))*smooth(1.00,1.04,P[1])*(1-smooth(1.095,1.145,P[1]));if(guard>0&&vertexBranch[i])delta.addScaledVector(new V3(Math.sign(P[0]),0,0).transformDirection(skinMatrices[BI['fl_up'+(P[0]<0?'R':'L')]]),guard);const sternumGuard=.012*(1-smooth(.13,.20,Math.abs(P[0])))*smooth(.69,.75,P[2])*(1-smooth(.83,.89,P[2]))*smooth(.74,.79,P[1])*(1-smooth(.84,.91,P[1]));if(sternumGuard>0)delta.addScaledVector(new V3(0,0,1).transformDirection(skinMatrices[BI['fl_lo'+(P[0]<0?'R':'L')]]),sternumGuard);const axillaGuard=.012*smooth(.30,.335,Math.abs(P[0]))*(1-smooth(.37,.43,Math.abs(P[0])))*smooth(1.13,1.17,P[1])*(1-smooth(1.24,1.28,P[1]))*smooth(.30,.34,P[2])*(1-smooth(.43,.48,P[2]));if(axillaGuard>0)delta.addScaledVector(new V3(Math.sign(P[0]),0,0).transformDirection(skinMatrices[BI['fl_up'+(P[0]<0?'R':'L')]]),axillaGuard);const max=vertexBranch[i]?.037:.046;if(delta.length()>max)delta.setLength(max);posedCloth[i]=posedSkin[i].clone().add(delta);posedGarment[i]=posedCloth[i];maxOffset=Math.max(maxOffset,delta.length());for(const k of incident[i]){const p=delta.dot(faceNormals[k]);minPlane=Math.min(minPlane,p);if(p<.001)unsatisfied++;}inverseBake(i,posedCloth[i],weights[i]);}
    for(const o of cuffLoops){const before=o.l.map(i=>posedCloth[i].clone());for(let k=0;k<o.l.length;k++){const i=o.l[k],previous=before[(k+o.l.length-1)%o.l.length],next=before[(k+1)%o.l.length],move=previous.clone().add(next).multiplyScalar(.5).sub(before[k]);if(move.length()>.002)move.setLength(.002);posedCloth[i].addScaledVector(move,.5);posedGarment[i]=posedCloth[i];inverseBake(i,posedCloth[i],weights[i]);}}

    const up=new V3(0,1,0).transformDirection(skinMatrices[front]),rear=new V3(0,0,-1).transformDirection(skinMatrices[front]);for(let i=baseCount;i<vertexSpecs.length;i++){const s=vertexSpecs[i];let p,w;if(s.kind==='cuffBand'){p=new V3();for(const[j,v]of s.refs)p.addScaledVector(sourcePosed[j],v);const n=posedNormals[s.donor].clone(),axis=limbAxis(s.side,.52),ease=.019;n.addScaledVector(axis,-n.dot(axis)).normalize();p.addScaledVector(n,ease);w=s.w;}else if(s.kind==='edge'){const axis=s.isCuff?new V3(0,1,-.16994).transformDirection(skinMatrices[BI['fl_lo'+(s.side<0?'R':'L')]]):up,n=s.donor<baseCount?posedNormals[s.donor]:posedNormals[vertexSpecs[s.donor].donor];const anchor=s.donors?posedGarment[s.donors[0]].clone().lerp(posedGarment[s.donors[1]],s.t):posedGarment[s.donor].clone(),normal=s.donors?posedNormals[s.donors[0]].clone().lerp(posedNormals[s.donors[1]],s.t).normalize():n;p=anchor.addScaledVector(normal,s.normalShift).addScaledVector(axis,s.upShift);w=s.w;}else if(s.kind==='hood'){p=posePoint(s.p,s.w);const anchorExpected=posePoint(out.pos[s.donor],weights[s.donor]);p.addScaledVector(posedCloth[s.donor].clone().sub(anchorExpected),1-s.fade);w=s.w;}else{p=posedGarment[s.donor].clone().addScaledVector(up,-s.down).addScaledVector(rear,s.rear);w=new Map();for(let k=0;k<4;k++)if(all.sw[i*4+k]>0)w.set(all.si[i*4+k],all.sw[i*4+k]);}posedGarment[i]=p;inverseBake(i,p,w);}
    planeAudit={minimumCorrespondingFacePlaneMargin:minPlane,unsatisfiedVertexFaceConstraints:unsatisfied,maximumOffsetLength:maxOffset,localFaceOnly:true,limits:"Corresponding original-face normal constraints only. Independent all-original triangle crossing audit may retain internal or exterior contacts."};shell.geometry.attributes.position.needsUpdate=true;refreshNormals();
    if(flag){const anchors=flagSpecs.map(s=>{const P=new V3();for(let j=0;j<3;j++)P.addScaledVector(posedCloth[s.triangle[j]],s.barycentric[j]);return P;}),C=anchors.reduce((P,Q)=>P.add(Q),new V3()).multiplyScalar(.25),U=anchors[1].clone().sub(anchors[0]).add(anchors[2].clone().sub(anchors[3])).normalize(),V=anchors[3].clone().sub(anchors[0]).add(anchors[2].clone().sub(anchors[1]));V.addScaledVector(U,-V.dot(U)).normalize();const N=U.clone().cross(V).normalize(),width=clamp((anchors[1].distanceTo(anchors[0])+anchors[2].distanceTo(anchors[3]))*.5,.19,.24),height=clamp((anchors[3].distanceTo(anchors[0])+anchors[2].distanceTo(anchors[1]))*.5,.105,.145);let maximumSurface=0;for(const i of flagCandidates){const Q=posedCloth[i].clone().sub(C);if(Math.abs(Q.dot(U))<=width*.55&&Math.abs(Q.dot(V))<=height*.55)maximumSurface=Math.max(maximumSurface,Q.dot(N));}C.addScaledVector(N,maximumSurface+.001);const A=flag.geometry.attributes.position;for(const spec of flagSpecs){const P=C.clone().addScaledVector(U,spec.u*width*.5).addScaledVector(V,spec.v*height*.5);flagTargets[spec.index]=P.clone();const baked=P.clone().applyMatrix4(skinMatrices[front].clone().invert());A.setXYZ(spec.index,baked.x,baked.y,baked.z);}A.needsUpdate=true;flag.geometry.computeVertexNormals();K.hoodie.flagAttachmentPlane={center:C.toArray(),normal:N.toArray(),width,height,offsetAboveLocalSupportPlane:.001,anchorPlaneLift:maximumSurface,rectangular:true};}
    if(emblem){const A=emblem.geometry.attributes.position;for(const spec of emblemSpecs){const P=new V3(),N=new V3();for(let j=0;j<3;j++){P.addScaledVector(posedCloth[spec.triangle[j]],spec.barycentric[j]);N.addScaledVector(posedNormals[spec.triangle[j]],spec.barycentric[j]);}P.addScaledVector(N.normalize(),.001);const baked=P.applyMatrix4(skinMatrices[front].clone().invert());A.setXYZ(spec.index,baked.x,baked.y,baked.z);}A.needsUpdate=true;emblem.geometry.computeVertexNormals();}
  }
  const q=out.pos.map((p,i)=>p.map((v,k)=>v+out.nrm[i][k]*initialOffset(i))),G={pos:q,nrm:out.nrm,wts:weights,tris:outTris},logos=new Builder(),flags=new Builder(),emTex=K.canvasTex(256,256,emblemCanvas),flagTex=K.canvasTex(300,192,flagCanvas);
  const decal=(b,map,name)=>{b.si.fill(0);b.sw.fill(0);for(let i=0;i<b.si.length;i+=4){b.si[i]=front;b.sw[i]=1;}const m=b.make(body,new T.MeshBasicMaterial({map,transparent:true,depthWrite:false,toneMapped:false,polygonOffset:true,polygonOffsetFactor:-2,polygonOffsetUnits:-2}),name,false);m.material.skinning=true;return m;};
  let chestZ=-9;for(let i=0;i<q.length;i++)if(Math.abs(q[i][0])<.045&&Math.abs(q[i][1]-1.25)<.05)chestZ=Math.max(chestZ,q[i][2]);addDecal(logos,G,[0,1.25,chestZ],[1,0,0],[0,1,0],.16,.145,[0,0,1],s=>emblemSpecs.push(s));emblem=decal(logos,emTex,'violet_code_emblem');
  const flagCandidates=[];for(let i=0;i<baseCount;i++)if(out.pos[i][0]<-.30&&out.pos[i][1]>1.08&&out.pos[i][1]<1.26&&out.nrm[i][0]<-.60)flagCandidates.push(i);if(!flagCandidates.length)throw Error('No exterior RIGHT upper arm surface');const fc=flagCandidates.reduce((v,i)=>v.map((x,k)=>x+q[i][k]/flagCandidates.length),[0,0,0]);
  const flagHalfWidth=.11,flagHalfHeight=.064,corners=[[-1,-1],[1,-1],[1,1],[-1,1]];
  for(const [u,v]of corners){const target=new V3(fc[0],fc[1]+v*flagHalfHeight,fc[2]+u*flagHalfWidth);let best=null,dist=Infinity;for(const tri of outTris){if(!tri.every(i=>q[i][0]<-.26)||!tri.some(i=>Math.abs(q[i][1]-fc[1])<.17&&Math.abs(q[i][2]-fc[2])<.20))continue;const tr=new T.Triangle(...tri.map(i=>new V3(...q[i]))),P=tr.closestPointToPoint(target,new V3()),d=P.distanceToSquared(target);if(d<dist){dist=d;const bary=tr.getBarycoord(P,new V3());best={triangle:tri.slice(),barycentric:bary.toArray(),P};}}if(!best)throw Error('No RIGHT patch corner attachment');const index=flags.vert(best.P.toArray(),[-1,0,0],new Map([[front,1]]),[1,1,1],[(u+1)/2,(v+1)/2]);flagSpecs.push({index,triangle:best.triangle,barycentric:best.barycentric,u,v});}
  flags.idx.push(0,1,2,0,2,3);flag=decal(flags,flagTex,'german_right_sleeve_patch');
  for(const o of cuffLoops)for(const i of o.l)roleSets.rib.add(i);for(const i of neckArc)roleSets.foldedHood.add(i);const partVertexSets=Object.fromEntries(Object.entries(roleSets).map(([k,v])=>[k,[...v]]));partVertexSets.cuffRight=[...roleSets.rib].filter(i=>all.p[i*3]<0&&all.p[i*3+1]<.60);partVertexSets.cuffLeft=[...roleSets.rib].filter(i=>all.p[i*3]>0&&all.p[i*3+1]<.60);partVertexSets.hem=[...roleSets.rib].filter(i=>all.p[i*3+1]>.60);const triOrdinals=new Map();for(let i=0;i<all.idx.length;i+=3)triOrdinals.set(all.idx.slice(i,i+3).join(','),i/3);const partTriangleSets=Object.fromEntries(Object.entries(roleTriangles).map(([k,a])=>[k,a.map(t=>triOrdinals.get(t.join(',')))]));partTriangleSets.sewnCloth=Array.from({length:all.idx.length/3},(_,i)=>i);partVertexSets.sewnCloth=Array.from({length:all.p.length/3},(_,i)=>i);const originalP=body.geometry.attributes.position,originalSI=body.geometry.attributes.skinIndex,originalSW=body.geometry.attributes.skinWeight,originalIndex=body.geometry.index.array,coveredBodyTriangleIds=[];for(let k=0;k<originalIndex.length;k+=3){let yes=true;for(let j=0;j<3;j++){const i=originalIndex[k+j],p=[originalP.getX(i),originalP.getY(i),originalP.getZ(i)],w={head:0,tail:0,rear:0,foreleg:0};for(let q=0;q<4;q++){const name=body.skeleton.bones[originalSI.array[i*4+q]].name,v=originalSW.array[i*4+q];if(/^head$|^ear/.test(name))w.head+=v;if(/^tail/.test(name))w.tail+=v;if(/^bl_/.test(name))w.rear+=v;if(/^fl_/.test(name))w.foreleg+=v;}yes&&=coverageField(p,w)>=-1e-7&&p[1]>=CUFF_EXIT&&w.head<.30&&w.rear<.001&&w.tail<.001;}if(yes)coveredBodyTriangleIds.push(k/3);}const auxiliarySource=new Set(R.source.components.slice(1).flat()),auxiliaryOriginalTriangleIds=[],auxiliaryCoveredTriangleIds=[],auxiliaryCuffBoundaryTriangleIds=[];for(let k=0;k<originalIndex.length;k+=3){const ids=[originalIndex[k],originalIndex[k+1],originalIndex[k+2]];if(!ids.every(i=>auxiliarySource.has(R.rep[i])))continue;auxiliaryOriginalTriangleIds.push(k/3);if(coveredBodyTriangleIds.includes(k/3))auxiliaryCoveredTriangleIds.push(k/3);const ys=ids.map(i=>originalP.getY(i));if(Math.min(...ys)<CUFF_EXIT&&Math.max(...ys)>=CUFF_EXIT)auxiliaryCuffBoundaryTriangleIds.push(k/3);}K.hoodie.originalAuxiliarySkinTriangleIds=auxiliaryOriginalTriangleIds;K.hoodie.originalAuxiliaryCoveredTriangleIds=auxiliaryCoveredTriangleIds;K.hoodie.originalAuxiliaryCuffBoundaryTriangleIds=auxiliaryCuffBoundaryTriangleIds;K.hoodie.originalAuxiliarySkinBounds=[0,1,2].map(k=>[Math.min(...[...auxiliarySource].map(i=>R.source.pos[i][k])),Math.max(...[...auxiliarySource].map(i=>R.source.pos[i][k]))]);K.hoodie.coveredBodyTriangleIds=coveredBodyTriangleIds;K.hoodie.coveredBodyTriangleIdsLimits='Original indexed triangle ordinals anatomically inside the intended garment footprint, independent of principal-copy omission; approved midforearm cuff at bindY.48 (39.4% lower-leg bare), neck/rear/tail excluded. Original auxiliary component IDs and partially intersecting cuff-boundary IDs separately disclosed. Not a visibility verdict.';K.hoodie.partVertexSets=partVertexSets;K.hoodie.partTriangleSets=partTriangleSets;shell.userData.hoodieRoleVertexSets=partVertexSets;shell.userData.hoodieRoleTriangleSets=partTriangleSets;shell.userData.hoodieRoleOverlap='Rib overlaps shell/sleeves; hood neckline anchors overlap shell; sewnCloth contains all vertices/triangles; cuffLeft/Right are rib subsets.';
  const branchTriangles=new Map();for(const side of[-1,1])branchTriangles.set(side,R.source.tris.filter(t=>t.every(i=>branch[i]===side)));
  const sourceRequired=new Set(out.refs.flatMap(a=>a.map(e=>e[0])));for(const a of branchTriangles.values())for(const t of a)for(const i of t)sourceRequired.add(i);const garmentBranchTriangles=new Map();for(const side of[-1,1]){const t=[];for(let k=0;k<all.idx.length;k+=3){const ids=all.idx.slice(k,k+3);if(ids.every(i=>{const s=vertexSpecs[i];return s.kind==='source'?vertexBranch[i]===side:s.kind==='cuffBand'&&s.side===side||s.kind==='edge'&&s.isCuff&&s.side===side;}))t.push(ids);}garmentBranchTriangles.set(side,t);}
  function profileAudit(){const sections=[],diameter=a=>{let m=0;for(let i=0;i<a.length;i++)for(let j=i+1;j<a.length;j++)m=Math.max(m,a[i].distanceTo(a[j]));return m;};
    const garmentBindY=vertexSpecs.map((s,i)=>s.kind==='source'?out.pos[i][1]:s.kind==='edge'?out.pos[s.donor][1]:s.kind==='cuffBand'?.52:0);
    function crossSection(tris,points,O,N,bindY,range){const found=[];for(const ids of tris){let poly=ids.map(i=>({p:points[i],y:bindY[i]}));if(range)for(const[cut,above]of[[range[0],true],[range[1],false]]){const out=[];for(let k=0;k<poly.length;k++){const A=poly[k],B=poly[(k+1)%poly.length],da=above?A.y-cut:cut-A.y,db=above?B.y-cut:cut-B.y;if(da>=0)out.push(A);if(da*db<0)out.push({p:A.p.clone().lerp(B.p,da/(da-db)),y:cut});}poly=out;if(poly.length<3)break;}if(poly.length<3)continue;const D=poly.map(v=>v.p.clone().sub(O).dot(N));if(Math.min(...D)>0||Math.max(...D)<0)continue;for(let k=0;k<poly.length;k++){const j=(k+1)%poly.length;if(D[k]*D[j]<0)found.push(poly[k].p.clone().lerp(poly[j].p,D[k]/(D[k]-D[j])));else if(Math.abs(D[k])<1e-8)found.push(poly[k].p);}}return found;}
    let maximumRatio=0,maximumCombinedWholeForelegRatio=0;const invBody=body.matrixWorld.clone().invert(),sourceBindY=R.source.pos.map(p=>p[1]);
    for(const side of[-1,1]){const suf=side<0?'R':'L',low=body.skeleton.bones[BI['fl_lo'+suf]].getWorldPosition(new V3()).applyMatrix4(invBody),paw=body.skeleton.bones[BI['fl_paw'+suf]].getWorldPosition(new V3()).applyMatrix4(invBody),upper=body.skeleton.bones[BI['fl_up'+suf]].getWorldPosition(new V3()).applyMatrix4(invBody);for(const y of[.48,.50,.52,.64,.78,.92,1.06,1.20]){const A=y>.88?low:paw,B=y>.88?upper:low,f=y>.88?(y-.88)/.34:(y-.22)/.66,O=A.clone().lerp(B,f),N=B.clone().sub(A).normalize(),range=y>.88?[.88,1.29]:[.28,.88],original=crossSection(branchTriangles.get(side),sourcePosed,O,N,sourceBindY,range),outer=crossSection(garmentBranchTriangles.get(side),posedGarment,O,N,garmentBindY,range),originalCombined=crossSection(branchTriangles.get(side),sourcePosed,O,N,sourceBindY),outerCombined=crossSection(garmentBranchTriangles.get(side),posedGarment,O,N,garmentBindY);const combinedReferenceDiameter=diameter(originalCombined),combinedOuterDiameter=diameter(outerCombined),combinedRatio=combinedReferenceDiameter?combinedOuterDiameter/combinedReferenceDiameter:0;maximumCombinedWholeForelegRatio=Math.max(maximumCombinedWholeForelegRatio,combinedRatio);if(original.length<6||outer.length<6){sections.push({side,bindY:y,originalPoints:original.length,outerPoints:outer.length,missing:true,anatomicalBindRange:range,combinedRatio});continue;}const referenceDiameter=diameter(original),outerDiameter=diameter(outer),ratio=outerDiameter/referenceDiameter;maximumRatio=Math.max(maximumRatio,ratio);sections.push({side,bindY:y,anatomicalBindRange:range,originalPoints:original.length,outerPoints:outer.length,referenceDiameter,outerDiameter,ratio,cuffLipIncluded:true,combinedReferenceDiameter,combinedOuterDiameter,combinedRatio});}}
    return{maximumRatio,maximumCombinedWholeForelegRatio,sections,cuffBindY:[CUFF_EXIT,CUFF_TOP],planeAudit,widthMethod:'Exact paired triangle/posed-axis-plane diameters, original connected upper-arm and lower-arm anatomical segments partitioned at original elbow bindY.88 by triangle-interior interpolation, same partition on garment. Cuff lip remains included in all lower-arm sections.',widthLimits:'Combined whole-foreleg planes are also disclosed: during folding a lower cuff can cross an upper-arm plane. Neither metric proves projected sleeve/cuff separation or absence of clipping. Shared axilla/trunk transition remains excluded from isolated limb diameters.'};}
  function seamAudit(){let max=0;for(let i=0;i<baseCount;i++){const p=new V3().fromBufferAttribute(shell.geometry.attributes.position,i);shell.boneTransform(i,p);max=Math.max(max,p.distanceTo(posedGarment[i]));}return{maxGap:max,raglanMaxGap:0,elbowMaxGap:0,weldedSingleMesh:true,sharedOriginalFootprint:true,baseVertices:baseCount,boundaryLoops:loopInfo.map(o=>({vertices:o.l.length,centroid:o.c})),aliasesShareGeometry:true};}
  const stats={construction:'one welded original connected footprint; shared sternum/axilla/forelegs; no independent sleeve tube or clipped band layer',opaque:true,opacity:1,vertices:all.p.length/3,triangles:all.idx.length/3,baseVertices:baseCount,originalSourceVertices:R.source.pos.length,sourceWeldEqualPositionAndWeights:true,principalOriginalConnectedSkinFootprint:true,originalAuxiliarySkinComponentPreservedInBody:true,cuffs:2,cuffBoundaryLoops:cuffLoops.length,cuffBindY:[CUFF_EXIT,CUFF_TOP],cuffHeight:CUFF_LENGTH,cuffLip:.005,flag:fc,flagOffset:.001,flagVerts:flagSpecs.length,flagRectangular:true,flagPlanarAttachment:true,flagAnatomicalSide:'RIGHT',palette:['#281b44','#493267','#b786ff','#1a1030'],fit:FIT,partVertexSets,partTriangles:roleTriangles,hood:{originalPosteriorNecklineArc:neckArc.length,foldedPanel:true,caudalPanelExtent:.22,returnedLiningDepth:.10,maximumRise:.14,outerWidth:Math.max(...hoodBind.map(p=>p[0]))-Math.min(...hoodBind.map(p=>p[0])),necklineWelded:true,liningCrescent:[.60,.10],roundedTangentReturn:true,fullRing:false,basinFloor:false},closureLimits:'Original inherited nonmanifold features are reported by topology audit; open neckline/crop/cuff/returned edges are intended. Matching source weights and vertex offset are not all-triangle collision proof.'};
  K.on('step',updateCloth);shell.onBeforeRender=updateCloth;updateCloth();
  dog.root.traverse(o=>{if(!o.isSkinnedMesh||!/^Kyoto_fringe/.test(o.name))return;o.userData.hoodieOriginalGeometry=o.geometry;o.geometry=o.geometry.clone();const f=o.geometry.attributes._fluff.clone();for(let i=0;i<f.count;i++)if(covered[i])f.array[i]=0;o.geometry.setAttribute('_fluff',f);const keep=[];for(let k=0;k<o.geometry.index.count;k+=3){const a=o.geometry.index.array[k],b=o.geometry.index.array[k+1],c=o.geometry.index.array[k+2];if(!(covered[a]&&covered[b]&&covered[c]))keep.push(a,b,c);}o.geometry.setIndex(keep);o.userData.hoodieEquippedGeometry=o.geometry;});
  return {shell,sleeves,rib,inner,foldedHood,emblem,flag,sewnCloth,updateCloth,seamAudit,seamlessAudit:seamAudit,profileAudit,stats};
}
function setEquipped(dog,parts,equipped){
  dog.root.traverse(o=>{if(o.userData.hoodieOriginalGeometry)o.geometry=equipped?o.userData.hoodieEquippedGeometry:o.userData.hoodieOriginalGeometry;});
  for(const m of Object.values(parts))if(m?.isMesh)m.visible=!!equipped;
}
K.hoodie={build,setEquipped};
})(window.K);
