"""Generate only a private garment-fit surface. Never writes Kyoto's model or rig.
Run with Blender --background --python art/hoodie/author_fit.py -- CHECKOUT.
Voxel surface resolves original fur-card topology; nearest original skin transfers rig weights.
"""
import bpy,json,base64,struct,sys,hashlib
from mathutils import Vector
from mathutils.bvhtree import BVHTree
from mathutils.geometry import barycentric_transform
root=sys.argv[sys.argv.index('--')+1];src=root+'/models/kyoto.json';D=json.load(open(src));B=base64.b64decode(D['buffers'][0]['uri'].split(',')[1]);fmt={5126:('f',4),5123:('H',2),5125:('I',4),5121:('B',1)};arity={'SCALAR':1,'VEC3':3,'VEC4':4,'MAT4':16}
def attr(i):
 a=D['accessors'][i];v=D['bufferViews'][a['bufferView']];f,w=fmt[a['componentType']];n=arity[a['type']];o=v.get('byteOffset',0)+a.get('byteOffset',0);s=v.get('byteStride',n*w)
 return [struct.unpack_from('<'+f*n,B,o+j*s)for j in range(a['count'])]
pr=D['meshes'][0]['primitives'][0];P=attr(pr['attributes']['POSITION']);J=attr(pr['attributes']['JOINTS_0']);W=attr(pr['attributes']['WEIGHTS_0']);I=[x[0]for x in attr(pr['indices'])];F=[I[i:i+3]for i in range(0,len(I),3)]
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
me=bpy.data.meshes.new('private_garment_fit');me.from_pydata(P,[],F);me.update();ob=bpy.data.objects.new('private_garment_fit',me);bpy.context.collection.objects.link(ob);bpy.context.view_layer.objects.active=ob;ob.select_set(True)
mod=ob.modifiers.new('resolve_skin_fur','REMESH');mod.mode='VOXEL';mod.voxel_size=.030;mod.use_smooth_shade=True;bpy.ops.object.modifier_apply(modifier=mod.name)
mod=ob.modifiers.new('tailoring_surface','SMOOTH');mod.factor=.85;mod.iterations=7;bpy.ops.object.modifier_apply(modifier=mod.name)
# Triangulation fixes the same topology in every JS runtime.
mod=ob.modifiers.new('triangulate','TRIANGULATE');bpy.ops.object.modifier_apply(modifier=mod.name)
bvh=BVHTree.FromPolygons(P,F,all_triangles=True);pts=[];joints=[];weights=[];normals=[]
for v in ob.data.vertices:
 p=v.co;pts.extend(round(x,6)for x in p);normals.extend(round(x,6)for x in v.normal);m={}
 co,no,face,d=bvh.find_nearest(p);ids=F[face]
 bary=barycentric_transform(co,Vector(P[ids[0]]),Vector(P[ids[1]]),Vector(P[ids[2]]),Vector((1,0,0)),Vector((0,1,0)),Vector((0,0,1)))
 for i,mult in zip(ids,bary):
  for j,w in zip(J[i],W[i]):m[j]=m.get(j,0)+w*max(0,mult)
 top=sorted(m.items(),key=lambda x:x[1],reverse=True)[:4];total=sum(w for j,w in top)
 while len(top)<4:top.append((0,0))
 joints.extend(j for j,w in top);weights.extend(round(w/total,7)for j,w in top)
tri=[v for f in ob.data.polygons for v in f.vertices]
o={'provenance':{'dogSHA256':hashlib.sha256(open(src,'rb').read()).hexdigest(),'method':'Blender voxel .030 + smooth .85 x7, closest original triangle barycentric skin weights','scope':'private garment fit surface; never renders as or replaces original dog'},'p':pts,'n':normals,'j':joints,'w':weights,'i':tri}
json.dump(o,open(root+'/art/hoodie/fit-surface.json','w'),separators=(',',':'));print('HOODIE_FIT',len(pts)//3,len(tri)//3)
