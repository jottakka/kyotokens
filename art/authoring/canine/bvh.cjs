'use strict';
const fs=require('fs'),T=require('./three.cjs');
function loadBVH(file){
 const text=fs.readFileSync(file,'utf8'),parts=text.split(/\bMOTION\b/),tok=parts[0].match(/[{}]|[^\s{}]+/g);let i=0,channelCount=0;const nodes=[],map={};
 if(tok[i++]!=='HIERARCHY')throw Error('BVH HIERARCHY');
 function node(parent){
  const kind=tok[i++];if(!['ROOT','JOINT','End'].includes(kind))throw Error('BVH node '+kind);
  const name=kind==='End'?(i++,parent.name+'_End'):tok[i++],o=new T.Object3D();o.name=name;o.channels=[];o.start=channelCount;
  if(tok[i++]!=='{')throw Error('BVH brace');
  while(tok[i]!=='}'){
   const t=tok[i++];if(t==='OFFSET')o.position.set(+tok[i++],+tok[i++],+tok[i++]);
   else if(t==='CHANNELS'){const n=+tok[i++];o.channels=tok.slice(i,i+n);i+=n;o.start=channelCount;channelCount+=n;}
   else if(['JOINT','End'].includes(t)){i--;node(o);}else throw Error('BVH token '+t);
  }i++;o.offset=o.position.clone();nodes.push(o);map[name]=o;if(parent)parent.add(o);return o;
 }
 const root=node(null);root.updateMatrixWorld(true);
 const motion=parts[1],framesN=+motion.match(/Frames:\s*(\d+)/)[1],dt=+motion.match(/Frame Time:\s*([\d.]+)/)[1];
 const lines=motion.trim().split(/\r?\n/).slice(2),values=lines.map(l=>l.trim().split(/\s+/).map(Number));if(values.length!==framesN||values.some(v=>v.length!==channelCount))throw Error('BVH frame length');
 const axes={X:new T.Vector3(1,0,0),Y:new T.Vector3(0,1,0),Z:new T.Vector3(0,0,1)},qu=new T.Quaternion();
 function pose(f){f=T.MathUtils.clamp(f,0,framesN-1);const a=Math.floor(f),b=Math.min(a+1,framesN-1),u=f-a;
  for(const o of nodes){o.position.copy(o.offset);o.quaternion.identity();for(let j=0;j<o.channels.length;j++){const c=o.channels[j],x=values[a][o.start+j],y=values[b][o.start+j];let v=x+(y-x)*u;if(c.includes('rotation')){let delta=((y-x+180)%360+360)%360-180;v=x+delta*u;o.quaternion.multiply(qu.setFromAxisAngle(axes[c[0]],v*Math.PI/180));}else o.position[c[0].toLowerCase()]+=v;}o.quaternion.normalize();}
  root.updateMatrixWorld(true);return root;
 }
 function world(name){return map[name].getWorldPosition(new T.Vector3());}
 pose(0);return{file,root,nodes,map,framesN,dt,values,pose,world,channelCount};
}
module.exports={T,loadBVH};
if(require.main===module){const b=loadBVH(process.argv[2]);b.pose(+process.argv[3]||0);console.log(JSON.stringify({frames:b.framesN,dt:b.dt,nodes:b.nodes.map(o=>({name:o.name,world:b.world(o.name).toArray(),local:o.position.toArray()}))},null,2));}
