"""Pack authored private fit surface into the one owned runtime module."""
import json,struct,base64,pathlib
root=pathlib.Path(__file__).resolve().parents[2];d=json.load(open(root/'art/hoodie/fit-surface.json'));n=len(d['p'])//3
def smooth(a,b,x):
 t=max(0,min(1,(x-a)/(b-a)));return t*t*(3-2*t)
scalar=[]
for i in range(n):
 x,y,z=d['p'][i*3:i*3+3];ws={j:w for j,w in zip(d['j'][i*4:i*4+4],d['w'][i*4:i*4+4])};head=sum(ws.get(j,0)for j in (18,19,20));tail=sum(ws.get(j,0)for j in(8,9));side=-1 if x<0 else 1
 brisket=.94+.16*smooth(.25,1.0,z);neck=1.85-.37*smooth(.45,.85,z)*(1-smooth(.02,.40,abs(x)))-y;radial=((x-side*.283)/.257)**2+((z-.73)/.295)**2;armhole=(radial-1)*.2+.22*smooth(1.24,1.40,y)
 scalar.append(min(z-(-.196+.4*max(0,1.02-y)),y-brisket,neck,armhole,(.75-head)*.45,(.30-tail)*.45))
tri=[];used=set()
for i in range(0,len(d['i']),3):
 t=d['i'][i:i+3]
 if max(scalar[k]for k in t)>-.05:tri.append(t);used.update(t)
used=sorted(used);r={v:i for i,v in enumerate(used)};out={k:[d[k][i*w+j]for i in used for j in range(w)]for k,w in [('p',3),('n',3),('j',4),('w',4)]};out['i']=[r[v]for t in tri for v in t];out['provenance']=d['provenance'];out['provenance']['crop']='privatefit donor triangles within50mm of garment cut; runtime exact clipping'
json.dump(out,open(root/'art/hoodie/fit-surface.json','w'),separators=(',',':'))
b=struct.pack('<II',len(used),len(out['i']))
for key,fmt in [('p','f'),('n','f'),('j','H'),('w','f'),('i','I')]:b+=struct.pack('<'+fmt*len(out[key]),*out[key])
code='''// Authored private fit surface, original-geometry hash and method in art/hoodie/fit-surface.json.
// Its rig weights come from closest ORIGINAL skin triangles using barycentric coordinates.
const fitGeometry = (() => {
 const raw=atob('__DATA__'),bytes=new Uint8Array(raw.length);for(let i=0;i<raw.length;i++)bytes[i]=raw.charCodeAt(i);
 const header=new Uint32Array(bytes.buffer,0,2),n=header[0],m=header[1];let o=8;const g=new T.BufferGeometry();
 for(const [name,Type,size]of [['position',Float32Array,3],['normal',Float32Array,3],['skinIndex',Uint16Array,4],['skinWeight',Float32Array,4]]){const a=new Type(bytes.buffer,o,n*size);o+=a.byteLength;g.setAttribute(name,new T.BufferAttribute(a,size));}
 g.setIndex(new T.BufferAttribute(new Uint32Array(bytes.buffer,o,m),1));return g;
})();
'''.replace('__DATA__',base64.b64encode(b).decode())
p=root/'src/feat_hoodie.js';s=p.read_text();start=s.find('// Authored private fit surface,');end=s.find('/* ---- cut fields')
if start>=0:s=s[:start]+s[end:]
s=s.replace('/* ---- cut fields',code+'\n/* ---- cut fields',1);p.write_text(s);print('PACKED',len(used),len(tri),len(b))
