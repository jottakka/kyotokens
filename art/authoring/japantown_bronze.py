"""Bake Kyoto's original sit pose into a static cast-bronze memorial. No source writes."""
import bpy, bmesh, math, hashlib, json
from mathutils import Vector
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SOURCE = ROOT / 'models/kyoto.json'
OUTPUT = ROOT / 'art/japantown/kyoto-bronze.glb'
assert hashlib.sha256(SOURCE.read_bytes()).hexdigest() == 'cce437ab421c0c75b470b043332d3fd3875f8b29a6952222176c87c7f1304c2e'
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=str(SOURCE))
rig = bpy.data.objects['Kyoto_rig']
for track in rig.animation_data.nla_tracks:
    track.mute = True
rig.animation_data.action = bpy.data.actions['sit']
rig.animation_data.action_slot = bpy.data.actions['sit'].slots[0]
bpy.context.scene.frame_set(24)
bpy.context.view_layer.update()
original = bpy.data.objects['Kyoto']
baked = bpy.data.meshes.new_from_object(original.evaluated_get(bpy.context.evaluated_depsgraph_get()), depsgraph=bpy.context.evaluated_depsgraph_get())
sculpture = bpy.data.objects.new('Kyoto_cast_bronze_static', baked)
bpy.context.collection.objects.link(sculpture)
sculpture.matrix_world = original.matrix_world.copy()
# The animated sit tail hangs below the paws. Recast it as a gently lifted seated tail
# before grounding the feet, rather than using the hanging tail tip as the floor.
local_up = original.matrix_world.to_3x3().inverted() @ Vector((0,0,1))
for source_vertex, cast_vertex in zip(original.data.vertices, baked.vertices):
    weights={original.vertex_groups[g.group].name:g.weight for g in source_vertex.groups}
    fore=sum(w for name,w in weights.items() if name.startswith('fl_'))
    cast_vertex.co += local_up * (.70*weights.get('tail2',0.) + .40*weights.get('tail1',0.) - .161*fore)
for obj in list(bpy.data.objects):
    if obj != sculpture:
        bpy.data.objects.remove(obj, do_unlink=True)
bpy.context.view_layer.objects.active = sculpture
sculpture.select_set(True)
# Cast relief is small enough to keep the original eyes, muzzle, ears and silhouette.
# Weld original render seams so the casting has a genuinely continuous surface.
bm=bmesh.new();bm.from_mesh(sculpture.data);bmesh.ops.remove_doubles(bm,verts=list(bm.verts),dist=.00005);bm.to_mesh(sculpture.data);bm.free();sculpture.data.update()
# A smooth casting and shallow chased fur grooves distinguish this from the live dog.
smooth = sculpture.modifiers.new('Soft cast surface', 'SMOOTH')
smooth.factor = .45
smooth.iterations = 3
bpy.ops.object.modifier_apply(modifier=smooth.name)
baked = sculpture.data
for vertex in baked.vertices:
    x, y, z = vertex.co
    wave = math.sin(y * 23 + z * 8) * math.sin(z * 19 - x * 11)
    mask = max(0., min(1., (1.20 - abs(y)) * .55))
    vertex.co += vertex.normal * (.005 * wave * mask)
for poly in baked.polygons:
    poly.use_smooth = True
colors = baked.color_attributes.new(name='CastPatina', type='FLOAT_COLOR', domain='POINT')
for vertex, color in zip(baked.vertices, colors.data):
    x, y, z = vertex.co
    crease = max(0., math.sin(y * 8.3 + z * 5.7) * math.sin(x * 13.1 - z * 4.3))
    amount = .21 * crease + .045 * (1. - max(0., vertex.normal.z))
    bronze = (.28, .155, .058)
    verdigris = (.12, .235, .18)
    color.color = tuple(a * (1. - amount) + b * amount for a, b in zip(bronze, verdigris)) + (1.,)
material = bpy.data.materials.new('Cast bronze with restrained verdigris')
material.use_nodes = True
bsdf = material.node_tree.nodes.get('Principled BSDF')
bsdf.inputs['Metallic'].default_value = .72
bsdf.inputs['Roughness'].default_value = .48
attribute = material.node_tree.nodes.new('ShaderNodeVertexColor')
attribute.layer_name = 'CastPatina'
material.node_tree.links.new(attribute.outputs['Color'], bsdf.inputs['Base Color'])
baked.materials.clear()
baked.materials.append(material)
sculpture.location.z -= min((sculpture.matrix_world @ Vector(c)).z for c in sculpture.bound_box)
OUTPUT.parent.mkdir(parents=True, exist_ok=True)
bpy.ops.export_scene.gltf(filepath=str(OUTPUT), export_format='GLB', use_selection=True, export_animations=False, export_skins=False, export_yup=True, export_apply=True)
record = {'source_sha256': hashlib.sha256(SOURCE.read_bytes()).hexdigest(), 'asset_sha256': hashlib.sha256(OUTPUT.read_bytes()).hexdigest(), 'pose': 'original sit frame24; static tail lift and .161m weighted fore-paw grounding' , 'vertices': len(baked.vertices), 'polygons': len(baked.polygons), 'static': True, 'animations': 0, 'armatures': 0, 'author': 'GPT-6.1', 'sculpture': 'baked sit pose with gently lifted cast tail and grounded feet, welded smooth casting, chased relief, bronze/verdigris'}
(OUTPUT.parent / 'kyoto-bronze.provenance.json').write_text(json.dumps(record, indent=2) + '\n')
print('JP_BRONZE', json.dumps(record))
