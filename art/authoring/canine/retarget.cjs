'use strict';
const fs=require('fs'),path=require('path'),crypto=require('crypto');
const {T,load}=require('./rig.cjs'),{loadBVH}=require('./bvh.cjs');
const SOURCE=process.argv[2],START=+process.argv[3],END=+process.argv[4],NAME=process.argv[5]||'run',LABEL=process.argv[6]||'probe',OUT=path.join(process.env.KYOTO_CANINE_BUILD||path.join(__dirname,'.build'),LABEL);fs.mkdirSync(OUT,{recursive:true});
const original=process.env.KYOTO_CANINE_ORIGINAL||path.join(__dirname,'.build/kyoto-original-exact.json'),base=process.argv[7]||original,d=load(base),b=loadBVH(SOURCE),N=120;
const p=d.g.meshes[0].primitives[0],v=d.accessor(p.attributes.POSITION),si=d.accessor(p.attributes.JOINTS_0),sw=d.accessor(p.attributes.WEIGHTS_0),joints=d.g.skins[0].joints,inv=d.accessor(d.g.skins[0].inverseBindMatrices).map(x=>new T.Matrix4().fromArray(x));
function skin(i){const base=new T.Vector3().fromArray(v[i]),out=new T.Vector3();for(let j=0;j<4;j++)if(sw[i][j])out.addScaledVector(base.clone().applyMatrix4(new T.Matrix4().multiplyMatrices(d.nodes[joints[si[i][j]]].matrixWorld,inv[si[i][j]])),sw[i][j]);return out;}
const Y=new T.Vector3(0,1,0),X=new T.Vector3(1,0,0),chains=[];
for(const pre of ['fl','bl'])for(const side of ['L','R']){
 const names=pre==='fl'?['Arm','ForeArm','Hand','Hand_End']:['UpLeg','Leg','Foot','Foot_End'],prefix=side==='L'?'Left':'Right',ids=['up','lo','paw'].map(n=>d.find(pre+'_'+n+'.'+side)),bi=joints.indexOf(ids[2]);
 const all=v.map((_,i)=>i).filter(i=>si[i].some((x,j)=>x===bi&&sw[i][j]>.4)),low=Math.min(...all.map(i=>v[i][1])),sole=all.filter(i=>v[i][1]<=low+.035),centre=sole.reduce((a,i)=>a.add(skin(i)),new T.Vector3()).divideScalar(sole.length);
 chains.push({pre,side,ids,src:names.map(n=>prefix+n),sole,centre,restFootDir:centre.clone().sub(d.rest[ids[2]].wp).normalize()});
}
function reset(){d.nodes.forEach((o,i)=>{o.position.copy(d.rest[i].p);o.quaternion.copy(d.rest[i].q);o.scale.copy(d.rest[i].s);});d.root.updateMatrixWorld(true);}
function canonical(frame){b.pose(frame);const center=b.world('Hips'),forward=b.world('Neck').sub(b.world('Spine'));forward.y=0;forward.normalize();const yaw=Math.atan2(forward.x,forward.z),q=new T.Quaternion().setFromAxisAngle(Y,-yaw);const points=Object.fromEntries(b.nodes.map(o=>[o.name,b.world(o.name).sub(center).applyQuaternion(q)]));return{points,center,yaw};}
const source=[];for(let f=0;f<=N;f++)source.push(canonical(START+(END-START)*f/N));
const meanVec=(a,z)=>source.slice(0,N).reduce((s,f)=>s.add(f.points[z].clone().sub(f.points[a]).normalize()),new T.Vector3()).divideScalar(N).normalize();
const meanHipY=source.slice(0,N).reduce((s,f)=>s+f.center.y,0)/N;
const scales=chains.map(c=>{const s=source[0].points;return(d.rest[c.ids[0]].wp.distanceTo(d.rest[c.ids[1]].wp)+d.rest[c.ids[1]].wp.distanceTo(d.rest[c.ids[2]].wp))/(s[c.src[0]].distanceTo(s[c.src[1]])+s[c.src[1]].distanceTo(s[c.src[2]]));});
const scale=scales.reduce((a,b)=>a+b,0)/scales.length,bodyPairs=[['back','Hips','Spine1'],['front','Spine1','Neck'],['neck','Neck','Head'],['head','Head','Head_End']],meanBody=Object.fromEntries(bodyPairs.map(([n,a,z])=>[n,meanVec(a,z)]));
const floors=Object.fromEntries(chains.map(c=>{const a=source.map(s=>s.points[c.src[3]].y+s.center.y).sort((a,b)=>a-b);return[c.src[3],a[Math.floor(a.length*.05)]];}));
function setWorld(ni,q){d.nodes[ni].quaternion.copy(d.nodes[ni].parent.getWorldQuaternion(new T.Quaternion()).normalize().invert().multiply(q).normalize());d.root.updateMatrixWorld(true);}
function direction(ni,restDir,dir){
 // A signed anatomical hinge avoids shortest-arc axis flips when the folded paw
 // approaches the opposite of its bind direction. Tiny bounded adduction remains.
 const pitch=Math.atan2(restDir.y*dir.z-restDir.z*dir.y,restDir.y*dir.y+restDir.z*dir.z);
 const roll=T.MathUtils.clamp(-dir.x/(Math.abs(dir.y)>.3?dir.y:(dir.y<0?-.3:.3)),-.045,.045);
 const q=new T.Quaternion().setFromAxisAngle(new T.Vector3(0,0,1),roll).multiply(new T.Quaternion().setFromAxisAngle(X,pitch)).multiply(d.rest[ni].wq.clone().normalize()).normalize();setWorld(ni,q);
}
const frames=[],raw=[],correction=[];
for(let f=0;f<=N;f++){
 reset();const s=source[f],points=s.points;
 d.nodes[d.find('root')].position.y-=.06;d.nodes[d.find('root')].position.y+=(s.center.y-meanHipY)*scale;
 d.root.updateMatrixWorld(true);
 for(const[n,a,z]of bodyPairs){const delta=new T.Quaternion().setFromUnitVectors(meanBody[n],points[z].clone().sub(points[a]).normalize());setWorld(d.find(n),delta.multiply(d.rest[d.find(n)].wq.clone().normalize()).normalize());}
 for(const c of chains){
  // Kyoto's forearm is proportionally longer than the captured dog's. Limit only
  // lateral adduction; preserve the recorded sagittal fold/reach/push timing.
  const remap=dir=>{dir.x*=c.pre==='fl'?.40:.70;return dir.normalize();};
  for(let j=0;j<2;j++)direction(c.ids[j],d.rest[c.ids[j+1]].wp.clone().sub(d.rest[c.ids[j]].wp),remap(points[c.src[j+1]].clone().sub(points[c.src[j]])));
  direction(c.ids[2],c.restFootDir,remap(points[c.src[3]].clone().sub(points[c.src[2]])));
 }
 // Preserve identity-tail silhouette; only source-relative small secondary response.
 const tailSource=points.Tail1.clone().sub(points.Tail).normalize(),tailMean=meanVec('Tail','Tail1'),tailDelta=new T.Quaternion().setFromUnitVectors(tailMean,tailSource);tailDelta.slerp(new T.Quaternion(),.6);setWorld(d.find('tail1'),tailDelta.multiply(d.rest[d.find('tail1')].wq.clone().normalize()));
 d.root.updateMatrixWorld(true);
 const contacts=chains.filter(c=>points[c.src[3]].y+s.center.y<=floors[c.src[3]]+3.5),soles=Object.fromEntries(chains.map(c=>[c.src[3],Math.min(...c.sole.map(i=>skin(i).y))]));
 const minSupport=contacts.length?Math.min(...contacts.map(c=>soles[c.src[3]])):null;
 correction.push(minSupport===null?null:.005-minSupport);raw.push({phase:f/N,sourceFrame:START+(END-START)*f/N,sourceHipY:s.center.y,contacts:contacts.map(c=>c.src[3]),soles});frames.push(d.nodes.map(o=>({p:o.position.toArray(),q:o.quaternion.toArray(),s:o.scale.toArray()})));
}
// A phase-continuous BODY translation, not a foot swing path, seats changed proportions.
let last=0;for(let f=0;f<=N;f++){if(correction[f]!==null)last=correction[f];else correction[f]=last;}
for(let f=0;f<=N;f++){
 let sum=0,w=0;for(let j=-4;j<=4;j++){const k=(f+j+N)%N,a=Math.exp(-j*j/8);sum+=a*correction[k];w+=a;}frames[f][d.find('root')].p[1]+=sum/w;
}
// Close the measured source-cut offset while retaining the recorded endpoint
// velocity. Blending toward a constant first pose would create a visible hold.
const overlap=16,end=JSON.parse(JSON.stringify(frames[N]));
for(let j=0;j<=overlap;j++){const index=N-overlap+j,u=j/overlap,t=u*u*(3-2*u);for(let ni=0;ni<d.nodes.length;ni++){const a=frames[index][ni],z=frames[0][ni],e=end[ni],delta=new T.Quaternion().fromArray(e.q).invert().multiply(new T.Quaternion().fromArray(z.q)).normalize(),blend=new T.Quaternion().slerp(delta,t);a.q=new T.Quaternion().fromArray(a.q).multiply(blend).normalize().toArray();a.p=a.p.map((x,k)=>x+(z.p[k]-e.p[k])*t);}}
let buffer=Buffer.from(d.bin);
function append(values,k,type){const padding=(4-buffer.length%4)%4;if(padding)buffer=Buffer.concat([buffer,Buffer.alloc(padding)]);const offset=buffer.length,bytes=Buffer.alloc(values.length*4);values.forEach((v,i)=>bytes.writeFloatLE(v,i*4));buffer=Buffer.concat([buffer,bytes]);const bv=d.g.bufferViews.length;d.g.bufferViews.push({buffer:0,byteOffset:offset,byteLength:bytes.length});const idx=d.g.accessors.length,a={bufferView:bv,componentType:5126,count:values.length/k,type};if(type==='SCALAR'){a.min=[Math.min(...values)];a.max=[Math.max(...values)];}d.g.accessors.push(a);return idx;}
const duration=(END-START)*b.dt,time=append(frames.map((_,i)=>duration*i/N),1,'SCALAR'),clip={name:NAME,samplers:[],channels:[],extras:{provenance:'Direct canine joint direction retarget of Zhang et al. SIGGRAPH2018 raw dog motion capture; no IK-shaped swing',source:path.basename(SOURCE),sourceFrames:[START,END],license:'CC-BY-NC-4.0'}};
for(const ni of joints)for(const[prop,key,k,type]of [['rotation','q',4,'VEC4'],['translation','p',3,'VEC3'],['scale','s',3,'VEC3']]){const values=frames.flatMap(f=>f[ni][key]);if(!values.every(Number.isFinite))throw Error('Nonfinite retarget');const i=clip.samplers.length;clip.samplers.push({input:time,output:append(values,k,type),interpolation:'LINEAR'});clip.channels.push({sampler:i,target:{node:ni,path:prop}});}
d.g.animations=d.g.animations.filter(a=>a.name!==NAME).concat(clip);d.g.buffers[0].uri='data:application/octet-stream;base64,'+buffer.toString('base64');d.g.buffers[0].byteLength=buffer.length;
const model=path.join(OUT,'kyoto-retarget.json');fs.writeFileSync(model,JSON.stringify(d.g));
const first=canonical(START),lastSource=canonical(END),travel=lastSource.center.clone().sub(first.center);travel.y=0;
const report={source:SOURCE,sourceSHA:crypto.createHash('sha256').update(fs.readFileSync(SOURCE)).digest('hex'),original,base,model,name:NAME,frames:[START,END],duration,scale,sourceTravel:travel.length(),targetStride:travel.length()*scale,sourceMeanHipY:meanHipY,originalBinaryPrefixPreserved:buffer.subarray(0,d.bin.length).equals(d.bin),identityObjectsUnchanged:['nodes','meshes','skins','materials','textures','images','scenes'].every(k=>JSON.stringify(d.g[k])===JSON.stringify(load(original).g[k])),contactBodyCorrectionRange:[Math.min(...correction),Math.max(...correction)],raw,limits:'Staged direct-direction prototype. No contact-only IK yet; source cut overlap not accepted; flight height/proportion/contact result needs pixels. Original static hierarchy/skin identity unchanged, legacy actions unchanged.'};fs.writeFileSync(path.join(OUT,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({model,duration,targetStride:report.targetStride,identityPreserved:report.identityObjectsUnchanged,bodyCorrection:report.contactBodyCorrectionRange}));
