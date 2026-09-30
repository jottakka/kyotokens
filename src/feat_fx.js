/* FX worker: batched pickup halos, pooled comic particles, shoreline ribbons.
 * Runtime wrapper: A.addTokens calls its original with the same receiver/arguments,
 * then adds visual feedback. A.addToken calls its original then registers newly
 * spawned tokens immediately. Pickups/letters/photos are observed, never replaced.
 * Kyoto's cloned toon materials get a small view-dependent honey rim. No gameplay,
 * post shader, shared geometry, input, or actor transform is modified.
 */
(function (K) {
'use strict';
// Baseline/debug opt-out is available only in the existing review/test mode.
if (/[?&]test=1\b/.test(location.search) && /[?&]fx=0\b/.test(location.search)) return;
const T = K.T, TAU = Math.PI * 2, MAX_AURA = 1600, MAX_PART = 512;
const palette = { token: [1,.73,.18], beer: [1,.43,.1], pretzel: [1,.62,.25], burrito: [1,.45,.27], bone: [.8,1,.62], letter: [1,.32,.65], photo: [.2,.94,1] };
const FX = K.fxJuice = { enabled: true, stats: { bursts: 0, confetti: 0, landings: 0, particles: 0, auras: 0 } };
let root, auraGeo, particleGeo, auraMat, particleMat, foamMat, cursor = 0, clock = 0, scanT = 0, dustT = 0, ambientT = 0, wasGround = true, lastMode = 'walk';
let seen = new WeakMap(), watched = [], rimUniform = { value: 1 }, windows = [];
const pos = new Float32Array(MAX_PART * 3), rgb = new Float32Array(MAX_PART * 3), sizes = new Float32Array(MAX_PART), kinds = new Float32Array(MAX_PART), alpha = new Float32Array(MAX_PART);
const vx = new Float32Array(MAX_PART), vy = new Float32Array(MAX_PART), vz = new Float32Array(MAX_PART), life = new Float32Array(MAX_PART), ttl = new Float32Array(MAX_PART);
const center = new Float32Array(MAX_AURA * 3), tint = new Float32Array(MAX_AURA * 3), scale = new Float32Array(MAX_AURA), phase = new Float32Array(MAX_AURA), style = new Float32Array(MAX_AURA);
const viewSize = new T.Vector2();
const cueRims = new WeakMap(), litRims = [];
let hydrantRim;
const auraAttrs=['aCenter','aTint','aScale','aPhase','aStyle'], particleAttrs=['position','aColor','aSize','aKind','aAlpha'];
const dustColor=[1,.87,.68],fogColor=[.79,.87,.94],speedColor=[1,.98,.81],heatColor=[1,.64,.32],leafColor=[.95,.68,.22],windowColor=new T.Color('#ffb35a');
function emit(x,y,z,color,size,kind,dx,dy,dz,duration) {
  if (!FX.enabled || K.reduceMotion && kind !== 1) return;
  const i = cursor++ % MAX_PART, j = i * 3;
  pos[j]=x;pos[j+1]=y;pos[j+2]=z;rgb[j]=color[0];rgb[j+1]=color[1];rgb[j+2]=color[2];
  sizes[i]=size;kinds[i]=kind;vx[i]=dx;vy[i]=dy;vz[i]=dz;life[i]=ttl[i]=duration;alpha[i]=1;
}
function burst(x,y,z,color,n,confetti) {
  if (!FX.enabled || K.reduceMotion) return;
  FX.stats.bursts++; if(confetti) FX.stats.confetti++;
  for(let i=0;i<n;i++) {const a=i*2.39996, speed=1.5+Math.random()*3, c=confetti ? palette[['letter','photo','token','bone'][i%4]] : color;
    emit(x,y,z,c,confetti?.19:.28,confetti?2:0,Math.cos(a)*speed,2+Math.random()*4,Math.sin(a)*speed,confetti?1.4+Math.random()*.6:.45+Math.random()*.45);}
}
function active(o,type) { return type==='item' ? o.active !== false : !o.got; }
function observe(reset) {
  const A=K.A;
  if(reset) { seen=new WeakMap();watched.length=0; }
  for(const type of ['item','letter','photo']) { const list=type==='item'?A.items:type==='letter'?A.letters:A.photos;
    if(!list)continue;
    for(const o of list) if(!seen.has(o)) { const rec={o,type,on:active(o,type)}; seen.set(o,rec);watched.push(rec); }
  }
}
function checkPickups() {
  for(let i=watched.length-1;i>=0;i--) { const r=watched[i], o=r.o, on=active(o,r.type);
    if(r.on&&!on) { const c=palette[r.type==='item'?o.kind:r.type]||palette.token;
      burst(o.x,o.y+(r.type==='photo'?3.1:0),o.z,c,r.type==='letter'?52:r.type==='photo'?28:14,r.type==='letter'); }
    r.on=on;
    if(o.temp&&(o.life<=0||!on))watched.splice(i,1);
  }
}
function addAura(x,y,z,c,s,p,type) {
  const i=FX.stats.auras;if(i>=MAX_AURA)return;
  const j=i*3;center[j]=x;center[j+1]=y;center[j+2]=z;tint[j]=c[0];tint[j+1]=c[1];tint[j+2]=c[2];scale[i]=s;phase[i]=p;style[i]=type;FX.stats.auras++;
}
function refreshAuras() {
  const P=K.A.player,C=K.camera.position;
  FX.stats.auras=0;
  for(let i=0;i<watched.length;i++) { const r=watched[i],o=r.o;if(!active(o,r.type))continue;
    const dx=o.x-C.x,dz=o.z-C.z,dist=dx*dx+dz*dz, token=o.kind==='token';
    if(dist>(token?150*150:220*220))continue;
    const c=palette[r.type==='item'?o.kind:r.type]||palette.token,p=o.ph||i*.71;
    let y=o.y;if(o.mesh&&o.mesh.visible)y=o.mesh.position.y;else if(r.type==='letter'&&o.g)y=o.g.position.y;else if(token)y+=Math.sin(K.game.time*2.2+p)*.2;
    const close=Math.max(0,1-Math.hypot(o.x-P.x,o.z-P.z)/13),s=(r.type==='letter'?4.3:r.type==='photo'?4.8:token?2.2:3.2)*(1+close*.14);
    addAura(o.x,y+(r.type==='photo'?3.1:0),o.z,c,s,p,0);
    if(dist<65*65||!token) addAura(o.x,y-(r.type==='photo'?-.04:token?.62:.75),o.z,c,s*.64,p,1);
  }
  // One batched draw covers collectible drops and close action halos as well.
  const dropAura = (o,c,size) => {
    if(!o || !o.root || !o.root.visible || !o.root.parent || Math.hypot(o.x-C.x,o.z-C.z)>180)return;
    addAura(o.x,o.root.position.y+.35,o.z,c,size,0,0);
    addAura(o.x,o.y+.08,o.z,c,size*.72,0,1);
  };
  if(K.life){for(const d of K.life.drops)dropAura(d,palette.letter,3.6);dropAura(K.life.secret,palette.letter,3.8);}
  if(K.ceos && K.ceos.rocket && K.ceos.rocket.dropped)dropAura(K.ceos.rocket,palette.token,4);
  for(const c of K.A.cars)if(c.kind==='waymo' && c.mode!=='driven' && Math.hypot(c.x-P.x,c.z-P.z)<45){
    addAura(c.x,(c.bot||0)+2.65,c.z,palette.photo,2.1,c.x,1);
  }
  for(const t of K.UI.actionCues || []) {
    const c=t.key==='F'?palette.token:t.key==='B'?palette.letter:palette.photo;
    addAura(t.x,t.y+.08,t.z,c,t.o.kind==='waymo'?5:t.key==='F'?1.45:2.5,0,1);
  }
  auraGeo.instanceCount=FX.stats.auras;
  for(const n of auraAttrs)auraGeo.attributes[n].needsUpdate=true;
}
function buildAuras() {
  const plane=new T.PlaneGeometry(1,1);auraGeo=new T.InstancedBufferGeometry();auraGeo.instanceCount=0;auraGeo.index=plane.index;auraGeo.attributes.position=plane.attributes.position;auraGeo.attributes.uv=plane.attributes.uv;
  for(const [n,a,s] of [['aCenter',center,3],['aTint',tint,3],['aScale',scale,1],['aPhase',phase,1],['aStyle',style,1]])auraGeo.setAttribute(n,new T.InstancedBufferAttribute(a,s).setUsage(T.DynamicDrawUsage));
  auraMat=new T.ShaderMaterial({transparent:true,depthWrite:false,blending:T.AdditiveBlending,side:T.DoubleSide,
    uniforms:{time:{value:0},player:{value:new T.Vector2()},motion:{value:1}},
    vertexShader:`attribute vec3 aCenter,aTint;attribute float aScale,aPhase,aStyle;uniform float time,motion;uniform vec2 player;varying vec2 vUv;varying vec3 col;varying float ph,style,nearby,fade;
      void main(){vUv=uv;col=aTint;ph=aPhase;style=aStyle;nearby=1.-smoothstep(2.,14.,distance(aCenter.xz,player));float pulse=1.+(.035+nearby*.07)*sin(time*3.5+aPhase)*motion;vec4 mv=viewMatrix*vec4(aCenter,1.);fade=1.-smoothstep(115.,220.,length(mv.xyz));
      if(aStyle<.5){mv.xy+=position.xy*aScale*pulse;}else{vec2 p=position.xy*aScale*pulse;float a=time*.65*motion+aPhase;p=mat2(cos(a),-sin(a),sin(a),cos(a))*p;mv=viewMatrix*vec4(aCenter+vec3(p.x,0.,p.y),1.);}gl_Position=projectionMatrix*mv;}`,
    fragmentShader:`uniform float time,motion;varying vec2 vUv;varying vec3 col;varying float ph,style,nearby,fade;
      void main(){vec2 p=vUv-.5;float d=length(p),a=0.;if(style<.5){a=exp(-d*d*19.)*.37*(1.-smoothstep(.36,.5,d));
        for(int i=0;i<3;i++){float fi=float(i);vec2 sp=vec2(sin(ph+fi*2.1+time*.8*motion)*.28,fract(time*.24*motion+ph*.17+fi*.33)*.8-.35);vec2 q=abs(p-sp);float star=max(0.,1.-min(q.x*95.+q.y*24.,q.x*24.+q.y*95.));a+=star*.65;}}
      else{float ring=(1.-smoothstep(.012,.03,abs(d-.4)));float arc=.45+.55*step(.12,sin(atan(p.y,p.x)*3.+ph));a=ring*arc*.62;}
      a*=fade*(.72+nearby*.28);if(a<.004)discard;gl_FragColor=vec4(col,a);}`});
  const mesh=new T.Mesh(auraGeo,auraMat);mesh.frustumCulled=false;mesh.renderOrder=4;root.add(mesh);
}
function buildParticles() {
  particleGeo=new T.BufferGeometry();
  for(const [n,a,s] of [['position',pos,3],['aColor',rgb,3],['aSize',sizes,1],['aKind',kinds,1],['aAlpha',alpha,1]])particleGeo.setAttribute(n,new T.BufferAttribute(a,s).setUsage(T.DynamicDrawUsage));
  particleMat=new T.ShaderMaterial({transparent:true,depthWrite:false,uniforms:{pixelScale:{value:700},time:{value:0}},
    vertexShader:`attribute vec3 aColor;attribute float aSize,aKind,aAlpha;uniform float pixelScale;varying vec3 col;varying float kind,opacity;void main(){col=aColor;kind=aKind;opacity=aAlpha;vec4 mv=modelViewMatrix*vec4(position,1.);gl_PointSize=clamp(aSize*pixelScale/max(1.,-mv.z),1.,100.);if(aAlpha<=0.)gl_PointSize=0.;gl_Position=projectionMatrix*mv;}`,
    fragmentShader:`uniform float time;varying vec3 col;varying float kind,opacity;void main(){if(opacity<=0.)discard;vec2 p=gl_PointCoord-.5;float a;
      if(kind<.5){p=abs(p);a=1.-smoothstep(.12,.5,min(p.x*4.+p.y,p.x+p.y*4.));}
      else if(kind<1.5){a=(1.-smoothstep(.15,.5,length(p)))*.32;}
      else if(kind<2.5){float t=time*5.+col.r*7.;p=mat2(cos(t),-sin(t),sin(t),cos(t))*p;a=(1.-smoothstep(.2,.28,abs(p.x)))*(1.-smoothstep(.31,.39,abs(p.y)));}
      else if(kind<3.5){p=mat2(.7,-.7,.7,.7)*p;p.x*=4.;a=1.-smoothstep(.18,.46,length(p));}
      else if(kind<4.5){p.x+=sin(p.y*13.+time*7.)*.1;a=(1.-smoothstep(.05,.18,abs(p.x)))*(1.-smoothstep(.15,.5,abs(p.y)))*.22;}else{float t=sin(time*2.+col.r)*.9;p=mat2(cos(t),-sin(t),sin(t),cos(t))*p;p.x*=1.8;a=1.-smoothstep(.24,.46,length(p));}
      if(a*opacity<.008)discard;gl_FragColor=vec4(col,a*opacity);}`});
  const mesh=new T.Points(particleGeo,particleMat);mesh.frustumCulled=false;mesh.renderOrder=5;root.add(mesh);
}
function buildShore() {
  const verts=[],uvs=[],W=K.W;
  // Sample only actual open water alongside the source shoreline; piers remain dry.
  for(let i=0;i<W.SHORE.length;i++){const a=W.SHORE[i],b=W.SHORE[(i+1)%W.SHORE.length],dx=b[0]-a[0],dz=b[1]-a[1],len=Math.hypot(dx,dz),nx=dz/len,nz=-dx/len;
    for(let t=0;t<len;t+=9){const end=Math.min(t+8,len),mx=a[0]+dx/len*(t+end)*.5,mz=a[1]+dz/len*(t+end)*.5;let side=W.inLand(mx+nx*3,mz+nz*3,0)?-1:1;
      if(W.inLand(mx+nx*side*3,mz+nz*side*3,0))continue;
      const q=[];for(const [u,v] of [[t,1.3],[end,1.3],[end,5],[t,5]])q.push([a[0]+dx/len*u+nx*v*side,-1.54,a[1]+dz/len*u+nz*v*side]);
      for(const k of [0,1,2,0,2,3]){verts.push(...q[k]);uvs.push(k===0||k===3?0:1,k<2?0:1);}
    }
  }
  const geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute(verts,3));geo.setAttribute('uv',new T.Float32BufferAttribute(uvs,2));
  foamMat=new T.ShaderMaterial({transparent:true,depthWrite:false,side:T.DoubleSide,uniforms:{time:{value:0}},vertexShader:`varying vec2 vUv;varying float dist;void main(){vUv=uv;vec4 mv=modelViewMatrix*vec4(position,1.);dist=length(mv.xyz);gl_Position=projectionMatrix*mv;}`,fragmentShader:`uniform float time;varying vec2 vUv;varying float dist;void main(){float wave=sin(vUv.x*10.+time*1.4)*.06;float lane=fract(vUv.y*2.-time*.18+wave);float line=(1.-smoothstep(.035,.095,abs(lane-.48)));float a=line*sin(vUv.x*3.14159)*sin(vUv.y*3.14159)*.38*(1.-smoothstep(70.,180.,dist));if(a<.005)discard;gl_FragColor=vec4(.64,.98,1.,a);}`});
  const mesh=new T.Mesh(geo,foamMat);root.add(mesh);
}
function installRim() {
  const materials=new Map();K.A.kyoto.root.traverse(o=>{if(!o.isMesh||!o.material||o.material.isShaderMaterial)return;
    const adapt=original=>{if(!original.isMeshToonMaterial)return original;if(materials.has(original))return materials.get(original);
      const mat=original.clone(), prior=original.onBeforeCompile;
      mat.onBeforeCompile=function(shader,renderer){if(prior)prior.call(this,shader,renderer);shader.uniforms.fxRim=rimUniform;shader.fragmentShader='uniform float fxRim;\n'+shader.fragmentShader;shader.fragmentShader=shader.fragmentShader.replace('#include <dithering_fragment>','gl_FragColor.rgb += vec3(1.0, 0.60, 0.22) * pow(1.0 - abs(dot(normalize(normal), normalize(vViewPosition))), 3.0) * 0.17 * fxRim;\n#include <dithering_fragment>');};mat.customProgramCacheKey=()=> 'fx-honey-rim-v1';materials.set(original,mat);return mat;};
    o.material=Array.isArray(o.material)?o.material.map(adapt):adapt(o.material);
  });
  // Residential glass lives in the world's minor-detail batches; never warm an
  // entire glass tower, a vehicle windshield, or the shared imported material.
  const glowMats=new Map();
  if(K.W.LODS)for(const cell of K.W.LODS.values())for(const o of cell.minor){
    const original=o.material;if(!original||original.name!=='glass'||!original.emissive)continue;
    let m=glowMats.get(original);if(!m){m=original.clone();m.emissive.set('#ffb35a');m.emissiveIntensity=.12;glowMats.set(original,m);windows.push({m,base:.12,originalIntensity:original.emissiveIntensity,originalColor:original.emissive.clone()});}o.material=m;
  }
  FX.stats.windowMaterials=windows.length;
}
// Clone only the materials of an offered target. Shared vehicle/NPC materials
// remain untouched; cached uniforms go dark immediately when readiness ends.
function actionRim(target) {
  if(!target || !target.traverse)return null;
  if(cueRims.has(target))return cueRims.get(target);
  const uniform={value:0}, colors={value:new T.Color('#77fff0')}, copies=new Map();
  target.traverse(o=>{
    if(!o.isMesh)return;
    const adapt=original=>{
      if(!original || !original.isMeshToonMaterial)return original;
      if(copies.has(original))return copies.get(original);
      const mat=original.clone(), prior=original.onBeforeCompile, priorKey=original.customProgramCacheKey ? original.customProgramCacheKey() : '';
      mat.onBeforeCompile=function(shader,renderer){
        if(prior)prior.call(this,shader,renderer);
        shader.uniforms.hudRim=uniform;shader.uniforms.hudTint=colors;
        shader.fragmentShader='uniform float hudRim; uniform vec3 hudTint;\n'+shader.fragmentShader;
        shader.fragmentShader=shader.fragmentShader.replace('#include <dithering_fragment>', 'gl_FragColor.rgb += hudTint * (0.08 + pow(1.0 - abs(dot(normalize(normal),normalize(vViewPosition))),2.0) * 0.85) * hudRim;\n#include <dithering_fragment>');
      };
      mat.customProgramCacheKey=()=>priorKey+'-hud-action-rim-v1';copies.set(original,mat);return mat;
    };
    o.material=Array.isArray(o.material)?o.material.map(adapt):adapt(o.material);
  });
  const rec={uniform,colors};cueRims.set(target,rec);return rec;
}
function updateActionRims() {
  for(const r of litRims)r.uniform.value=0;litRims.length=0;
  if(hydrantRim)hydrantRim.visible=false;
  if(!FX.enabled)return;
  for(const t of K.UI.actionCues || []) {
    const r=actionRim(t.root);
    if(r){r.uniform.value=1;r.colors.value.set(t.key==='B'?'#ffafde':'#77fff0');litRims.push(r);}
    else if(t.key==='F'){
      // Hydrants are instanced: outline only this available hydrant, never the batch.
      if(!hydrantRim){hydrantRim=new T.Mesh(new T.CylinderGeometry(.34,.34,.95,12,1,true),new T.MeshBasicMaterial({color:'#ffe179',side:T.BackSide,transparent:true,opacity:.8,depthWrite:false}));root.add(hydrantRim);}
      hydrantRim.visible=true;hydrantRim.position.set(t.x,t.y+.54,t.z);
    }
  }
}
function ambient(P) {
  const W=K.W,x=P.x+(Math.random()-.5)*48,z=P.z+(Math.random()-.5)*48,park=W.parkAt&&W.parkAt(x,z);
  if(park&&!park.plaza&&!park.beach)emit(x,W.terrainH(x,z)+2+Math.random()*5,z,leafColor,.3,5,.65,-.5,.3,4);
  if(!W.inLand(x,z,0)){emit(x,-1.47,z,palette.photo,.25,0,0,.015,0,1.7);if(Math.random()<.22)emit(x,.1+Math.random()*1.2,z,fogColor,6,1,.55,.06,.1,4);}
}
K.on('build',()=>{
  root=new T.Group();root.name='FX juice (batched)';K.scene.add(root);buildAuras();buildParticles();buildShore();installRim();observe(true);
  const addToken=K.A.addToken;K.A.addToken=function(){const n=this.items.length,out=addToken.apply(this,arguments);if(this.items.length>n){const o=this.items[this.items.length-1],r={o,type:'item',on:active(o,'item')};seen.set(o,r);watched.push(r);}return out;};
  const original=K.A.addTokens;if(original)K.A.addTokens=function(v,why){const out=original.apply(this,arguments),P=K.A.player;if(v>0&&K.game.state==='play')burst(P.x,P.y+1.3,P.z,palette.token,10,false);return out;};
});
K.on('start',()=>{clock=0;scanT=0;dustT=0;ambientT=0;if(K.post.speed)K.post.speed.value=0;life.fill(0);alpha.fill(0);wasGround=true;lastMode='walk';observe(true);});
K.on('step',(dt)=>{
  if(!root)return;const P=K.A.player;clock+=dt;
  scanT-=dt;if(scanT<=0){observe(false);scanT=.2;}checkPickups();
  if(FX.enabled){
    if(!wasGround&&P.onGround&&P.mode==='walk'&&lastMode==='walk'){FX.stats.landings++;for(let i=0;i<12;i++){const a=i*TAU/12;emit(P.x,P.y+.13,P.z,dustColor,.65,1,Math.cos(a)*2.8,.4+Math.random(),Math.sin(a)*2.8,.55);}}
    dustT-=dt;const sprint=P.mode==='walk'&&P.onGround&&P.speed>18;
    if(P.mode==='walk'&&P.onGround&&P.speed>7&&dustT<=0){dustT=sprint?.055:.11;const bx=-Math.sin(P.heading),bz=-Math.cos(P.heading);emit(P.x+bx*.5,P.y+.15,P.z+bz*.5,dustColor,sprint?.8:.5,1,bx*1.2,.7,bz*1.2,.5);
      if(sprint)emit(P.x+bx+(Math.random()-.5)*1.2,P.y+.7,P.z+bz+(Math.random()-.5)*1.2,speedColor,.8,3,bx*4,.05,bz*4,.2);}
    ambientT-=dt;if(ambientT<=0){ambientT=.12;ambient(P);}
    const pz=K.A.pascal;if(pz.surge>0&&clock% .1<dt)emit(pz.x-Math.sin(pz.heading)*.9,(pz.y||0)+1.1,pz.z-Math.cos(pz.heading)*.9,heatColor,2.4,4,-Math.sin(pz.heading)*.4,.8,-Math.cos(pz.heading)*.4,.6);
  }
  wasGround=P.onGround;lastMode=P.mode;
  let count=0;for(let i=0;i<MAX_PART;i++){if(life[i]<=0)continue;life[i]-=dt;if(life[i]<=0){alpha[i]=0;continue;}count++;const j=i*3;pos[j]+=vx[i]*dt;pos[j+1]+=vy[i]*dt;pos[j+2]+=vz[i]*dt;
    if(kinds[i]===5){pos[j]+=Math.sin(clock*2+i)*dt*.3;pos[j+2]+=Math.cos(clock+i)*dt*.2;}
    if(kinds[i]===2)vy[i]-=3*dt;else if(kinds[i]===0)vy[i]-=2*dt;
    alpha[i]=Math.min(1,life[i]/ttl[i]*3);if(kinds[i]===1)sizes[i]+=dt*.65;}
  FX.stats.particles=count;
});
function frameFX(dt,tt){
  if(!root)return;root.visible=FX.enabled;rimUniform.value=FX.enabled?1:0;
  if(K.post.speed){const target=FX.enabled&&!K.reduceMotion&&K.A.player.mode==='walk'?Math.max(0,Math.min(1,(K.A.player.speed-18)/6)):0;K.post.speed.value+= (target-K.post.speed.value)*(1-Math.exp(-8*dt));if(!FX.enabled||K.reduceMotion)K.post.speed.value=0;}
  for(let i=0;i<windows.length;i++){const w=windows[i];w.m.emissive.copy(FX.enabled?windowColor:w.originalColor);w.m.emissiveIntensity=FX.enabled?w.base*(1+.12*Math.sin((K.reduceMotion?0:clock)*1.8+i)*Math.sin((K.reduceMotion?0:clock)*.7+i)):w.originalIntensity;}
  updateActionRims();
  if(!FX.enabled)return;const t=K.reduceMotion?0:clock,P=K.A.player;
  auraMat.uniforms.time.value=t;auraMat.uniforms.motion.value=K.reduceMotion?0:1;auraMat.uniforms.player.value.set(P.x,P.z);particleMat.uniforms.time.value=t;foamMat.uniforms.time.value=t;
  K.renderer.getDrawingBufferSize(viewSize);particleMat.uniforms.pixelScale.value=viewSize.y/(2*Math.tan(K.camera.fov*Math.PI/360));
  refreshAuras();for(const n of particleAttrs)particleGeo.attributes[n].needsUpdate=true;
}
K.on('frame',frameFX);
K.on('bark',P=>{burst(P.x,P.y+.7,P.z,palette.bone,12,false);});
K.on('end',()=>{checkPickups();frameFX(0,0);if(K.post.speed)K.post.speed.value=0;});
K.scenes=K.scenes||{};
K.scenes.fx=h=>{
  h.play();h.go(-345,-200);h.P.heading=-.35;h.pz.wait=999;h.st(2);
  // Stage real collectible objects using their normal draw/pickup paths, review only.
  const A=K.A,W=K.W,types=['token','beer','pretzel','bone'];
  types.forEach((kind,i)=>{const o=A.items.find(v=>v.kind===kind&&!v.temp);o.x=-353+i*3.2;o.z=-207+(i%2)*1.1;o.y=W.terrainH(o.x,o.z)+1.3;o.active=true;});
  const l=A.letters[0];l.x=-337;l.z=-201;l.y=W.terrainH(l.x,l.z)+2.6;l.g.position.set(l.x,l.y,l.z);l.beam.position.set(l.x,l.y+130,l.z);
  const photo=A.photos[0];photo.x=-358;photo.z=-206;photo.y=W.terrainH(photo.x,photo.z);photo.g.position.set(photo.x,photo.y,photo.z);
  h.st(4);burst(-341,h.P.y+1.6,-202,palette.letter,32,true);h.st(7);
  K.sceneCam={noClip:true,pos:new T.Vector3(-347,h.P.y+7.5,-187),look:new T.Vector3(-347,h.P.y+1.3,-205)};h.st(1);K.$('#banner').hidden=true;
};
// Exercise production pickup and movement paths; the capture log records asserts.
K.scenes.fxchecks=h=>{
  h.play();h.go(-345,-200);h.pz.wait=999;h.st(2);
  const A=K.A,P=h.P,stats=FX.stats;
  const assert=(ok,message)=>{if(!ok)throw new Error('FX check: '+message);};
  let before=h.g.tokens;A.addTokens(123,'FX review');assert(h.g.tokens===before+123,'token wrapper preserves award');
  let bursts=stats.bursts;const token=A.items.find(o=>o.kind==='token'&&!o.temp);Object.assign(token,{x:P.x,z:P.z,y:P.y+1,active:true});h.st(1);assert(!token.active&&stats.bursts>bursts,'normal token pickup burst');
  bursts=stats.bursts;A.addToken(P.x,P.z,true,P.y);h.st(1);assert(stats.bursts>bursts,'same-step temporary token burst');
  const confetti=stats.confetti,l=A.letters[0];l.x=P.x;l.z=P.z;l.y=P.y+1;l.g.position.set(l.x,l.y,l.z);h.st(1);assert(l.got&&stats.confetti===confetti+1,'letter confetti once');
  const photo=A.photos[0];photo.x=P.x;photo.z=P.z;photo.y=P.y;photo.g.position.set(P.x,P.y,P.z);h.st(40);assert(photo.got,'photo hold path');
  h.st(35);const landings=stats.landings;h.st(1,['Space']);h.st(45);assert(stats.landings>landings,'jump landing puff');
  h.st(12,['KeyW','ShiftLeft']);assert(stats.particles>0&&(!K.post.speed||K.post.speed.value>.01),'sprint particles and post speed lines');
  const motion=K.reduceMotion;K.reduceMotion=true;bursts=stats.bursts;K.emit('bark',P,10);assert(stats.bursts===bursts,'reduced motion suppresses burst');K.reduceMotion=motion;
  h.g.start(true);assert(life.every(v=>v===0),'restart clears particle pool');
  console.warn('FX_CHECKS PASS 9 production-path assertions');
};
// Frozen review benchmark: paired renders request gl.finish(), include all render
// passes, and this module's upload/update work. No browser or background loop.
K.scenes.fxperf=h=>{
  K.scenes.fx(h);const r=K.renderer,gl=r.getContext(),reset=r.info.autoReset;
  r.info.autoReset=false;const off=[],on=[],cpuOff=[],cpuOn=[],draw=[];
  try{
    for(let i=0;i<32;i++)for(let k=0;k<2;k++){
      const enabled=(i%2===0?k===1:k===0);FX.enabled=enabled;gl.finish();
      r.info.reset();const t=performance.now();frameFX(0,0);K.render(12);const cpu=performance.now()-t;gl.finish();const wall=performance.now()-t;
      if(i>=8){(enabled?on:off).push(wall);(enabled?cpuOn:cpuOff).push(cpu);draw[enabled?1:0]=r.info.render.calls;}
    }
    const median=a=>{a.sort((a,b)=>a-b);return +a[Math.floor(a.length/2)].toFixed(2);};
    console.warn('FX_PERF '+JSON.stringify({samples:on.length,size:[K.VW,K.VH],calls:draw,renderMs:[median(off),median(on)],submitMs:[median(cpuOff),median(cpuOn)],auras:FX.stats.auras,particles:FX.stats.particles,windowMaterials:FX.stats.windowMaterials}));
  }finally{r.info.autoReset=reset;FX.enabled=true;frameFX(0,0);}
};
})(window.K);
