"""Revision 4, run in the open Blender revision-3 scene."""
import bpy,ast,json,math,re,datetime
from pathlib import Path
from mathutils import Matrix,Vector
ROOT=Path('D:/Project/LPQ Al-Fath Maulana/.codex-local/building-tour')
OUT=Path('D:/Project/LPQ Al-Fath Maulana 3D');WEB=ROOT/'public/models'
assert bpy.context.scene.get('revision')==3
backup=OUT/('lpq-before-revision4-'+datetime.datetime.now().strftime('%Y%m%d-%H%M%S')+'.blend')
bpy.ops.wm.save_as_mainfile(filepath=str(backup),copy=True)
bpy.ops.scene.new(type='FULL_COPY');scene=bpy.context.scene;scene.name='LPQ - Revisi 4 sirkulasi dan lingkungan';scene['revision']=4
cam=scene.camera;scene.frame_set(1);COL=None;MESH={}
parsed=ast.parse((ROOT/'tools/build-lpq-building.py').read_text())
exec(compile(ast.Module(body=[n for n in parsed.body if isinstance(n,ast.FunctionDef)],type_ignores=[]),'helpers','exec'),globals())
white=bpy.data.materials['Putih hangat'];cream=bpy.data.materials['Dinding interior putih'];blue=bpy.data.materials['Cat biru fasad'];steel=bpy.data.materials['Baja galvanis'];tiles=bpy.data.materials['Nat keramik'];asphalt=bpy.data.materials['Aspal bertekstur']
collection('R4 Aspal samping','Asphalt continues around both sides beyond the building footprint')
plane('Aspal sisi kiri',(-6.3,3.45,-.025),4.4,17.1,asphalt,(4.4/3,17.1/3))
plane('Aspal sisi kanan',(23.0,3.45,-.025),5.0,17.1,asphalt,(5/3,17.1/3))
collection('R4 Sambungan aula','Rear return wall closes the gap left by shortening the classrooms')
box('Dinding sambung belakang aula',(11.25,7.30,5.0),(1.86,.16,2.8),cream)
box('Lis sambungan aula',(11.25,7.30,6.43),(1.86,.22,.12),white)
box('Pelat sambungan aula',(11.22,7.0,3.50),(1.80,.80,.2),white)
plane('Keramik sambungan aula',(11.22,7.0,3.64),1.8,.8,tiles,(3,1.33))
bpy.context.view_layer.update()


collection('R4 Flora realistis CC0','Poly Haven Jacaranda Tree and Potted Plant 01; optimized shared meshes')
asset_collection=COL
# Archive the procedural tree crowns and branches; retain flowers and vines.
for obj in list(scene.objects):
    if not obj.get('webExclude') and obj.name.startswith(('Flora_pohon batang','Flora_cabang','Flora_tajuk')):
        obj['webExclude']=True;obj.hide_render=True;obj.hide_set(True)

def import_optimized(asset_id,target_triangles,placements):
    before=set(scene.objects)
    bpy.ops.import_scene.gltf(filepath=str(OUT/'free-assets'/asset_id/(asset_id+'.gltf')))
    sources=[o for o in set(scene.objects)-before if o.type=='MESH']
    bpy.context.view_layer.update()
    points=[o.matrix_world@Vector(v) for o in sources for v in o.bound_box]
    low=Vector((min(p.x for p in points),min(p.y for p in points),min(p.z for p in points)))
    high=Vector((max(p.x for p in points),max(p.y for p in points),max(p.z for p in points)))
    origin=Vector(((low.x+high.x)/2,(low.y+high.y)/2,low.z));height=high.z-low.z
    total=sum(sum(len(p.vertices)-2 for p in o.data.polygons) for o in sources)
    for source in sources:
        source['webExclude']=True
        if 'pebbles' in source.name:
            source.hide_render=True;source.hide_set(True);continue
        source.modifiers.clear()
        dec=source.modifiers.new('Web simplification','DECIMATE');dec.ratio=min(1,target_triangles/max(1,total));dec.use_collapse_triangulate=True
        bpy.context.view_layer.update()
        mesh=bpy.data.meshes.new_from_object(source.evaluated_get(bpy.context.evaluated_depsgraph_get()))
        mesh.name='CC0 '+asset_id+' '+source.name
        for material_ in mesh.materials:
            if material_ and material_.use_nodes:
                for node in material_.node_tree.nodes:
                    if node.type=='TEX_IMAGE' and node.image:
                        image=node.image
                        if max(image.size)>512:image.scale(512,512)
                        image.pack()
        for index,(x,y,z,h,angle) in enumerate(placements):
            obj=bpy.data.objects.new(asset_id+' instance '+str(index),mesh);asset_collection.objects.link(obj)
            obj.matrix_world=Matrix.Translation((x,y,z))@Matrix.Rotation(angle,4,'Z')@Matrix.Scale(h/height,4)@Matrix.Translation(-origin)@source.matrix_world
            obj['asset_instance']=True;obj['asset_source']='https://polyhaven.com/a/'+asset_id;obj['license']='CC0-1.0'
        source.hide_render=True;source.hide_set(True)
    return len(sources)

import_optimized('jacaranda_tree',24000,[(-5.4,4.8,0,5.6,0),(-4.8,9.2,0,6,1.3),(2.5,10.1,0,6.4,2.7),(9.6,10.3,0,6.1,1),(17,10,0,5.8,3.2),(22.7,6.7,0,6.2,2),(23.2,.8,0,4.4,.6)])
import_optimized('potted_plant_01',3500,[(.8,-4.4,0,.85,0),(9.7,-4.4,0,1.05,1),(19.35,-4.4,0,1.15,2),(21.3,3,0,1.2,0),(21.3,6.2,0,1.1,1),(11.3,6.6,3.64,1.2,2),(19.1,6.45,3.64,1.3,3)])
# Retire older small pots displaced by the new realistic specimens.
for obj in list(scene.objects):
    if obj.get('webExclude') or obj.get('asset_instance') or not obj.name.startswith('Flora_'):continue
    if any((obj.matrix_world.translation-Vector((x,y,.45))).length<.72 for x,y in [(.6,-4.45),(9.7,-4.58),(19.35,-4.5),(21.3,3),(21.3,6.2)]):
        obj['webExclude']=True;obj.hide_render=True;obj.hide_set(True)
bpy.context.view_layer.update()


# Weld imported split vertices before final simplification, once per shared mesh.
import bmesh
seen_meshes=set()
for obj in scene.objects:
 if obj.get('asset_instance') and 'jacaranda' in obj.name and obj.data not in seen_meshes:
  mesh=obj.data;seen_meshes.add(mesh)
  bm=bmesh.new();bm.from_mesh(mesh);bmesh.ops.remove_doubles(bm,verts=list(bm.verts),dist=.0005);bm.to_mesh(mesh);bm.free()
  dec=obj.modifiers.new('Final web simplification','DECIMATE');dec.ratio=.45;dec.use_collapse_triangulate=True
  bpy.context.view_layer.update();optimized=bpy.data.meshes.new_from_object(obj.evaluated_get(bpy.context.evaluated_depsgraph_get()));obj.modifiers.clear()
  for other in scene.objects:
   if other.get('asset_instance') and other.data==mesh:other.data=optimized
  seen_meshes.add(optimized)

# PBR textures carry the appearance; unused vertex colors inflate the web export.
for obj in scene.objects:
 if obj.get('asset_instance'):
  for attribute in list(obj.data.color_attributes):obj.data.color_attributes.remove(attribute)

for mat in bpy.data.materials:
 if mat.name.startswith(('jacaranda_tree','potted_plant_01')) and mat.use_nodes:
  shader=next((n for n in mat.node_tree.nodes if n.type=='BSDF_PRINCIPLED'),None)
  diffuse=next((n for n in mat.node_tree.nodes if n.type=='TEX_IMAGE' and n.image and '_diff' in n.image.name),None)
  if shader and diffuse:
   mat.node_tree.links.new(diffuse.outputs['Color'],shader.inputs['Base Color'])
   if 'leaves' in mat.name:mat.node_tree.links.new(diffuse.outputs['Alpha'],shader.inputs['Alpha'])
# Remove coplanar floor overlap at the new rear wall.
for obj in scene.objects:
 if obj.name.startswith('Keramik sambungan aula'):obj.location.z=3.646

with bpy.data.libraries.load(str(OUT/'free-assets/jacaranda_tree/source.blend'),link=False) as (src,dst):
 dst.objects=['jacaranda_tree_LOD1']
lod=dst.objects[0];scene.collection.objects.link(lod);lod['webExclude']=True;lod.hide_render=True;lod.hide_set(True);bpy.context.view_layer.update()
from collections import Counter
me=lod.data
parents=list(range(len(me.vertices)))
def root(i):
 while parents[i]!=i:
  parents[i]=parents[parents[i]];i=parents[i]
 return i
for edge in me.edges:
 a,b=edge.vertices;ra=root(a);rb=root(b)
 if ra!=rb:parents[rb]=ra
counts=Counter()
for face in me.polygons:
 if 'leaves' in me.materials[face.material_index].name:counts[root(face.vertices[0])]+=len(face.vertices)-2
print('LEAF COMPONENTS',len(counts),'triangle distribution',Counter(counts.values()).most_common(12))

import numpy as np,bmesh
from collections import defaultdict
selected=set(sorted(counts)[::7]);groups=defaultdict(list);uvdata=me.uv_layers.active.data
for face in me.polygons:
 key=root(face.vertices[0])
 if key in selected and 'leaves' in me.materials[face.material_index].name:
  for li in face.loop_indices:
   groups[key].append((tuple(uvdata[li].uv),tuple(me.vertices[me.loops[li].vertex_index].co)))
verts=[];faces=[];texcoords=[]
for samples in groups.values():
 uv=np.array([p[0] for p in samples]);xyz=np.array([p[1] for p in samples]);lo=uv.min(axis=0);hi=uv.max(axis=0)
 if np.min(hi-lo)<1e-5:continue
 coeff=np.linalg.lstsq(np.column_stack((uv,np.ones(len(uv)))),xyz,rcond=None)[0]
 corners=np.array([[lo[0],lo[1]],[hi[0],lo[1]],[hi[0],hi[1]],[lo[0],hi[1]]])
 points=np.column_stack((corners,np.ones(4)))@coeff;center=points.mean(axis=0);points=center+(points-center)*1.8
 start=len(verts);verts.extend([tuple(lod.matrix_world@Vector(point)) for point in points]);texcoords.extend(corners.tolist());faces.append(tuple(range(start,start+4)))
foliage=bpy.data.meshes.new('Jacaranda leaf cards LOD');foliage.from_pydata(verts,[],faces);foliage.materials.append(bpy.data.materials['jacaranda_tree_leaves']);uvlayer=foliage.uv_layers.new()
for loop in foliage.loops:uvlayer.data[loop.index].uv=texcoords[loop.vertex_index]
foliage.validate(clean_customdata=False)
base_instances=[o for o in scene.objects if o.get('asset_instance') and o.name.startswith('jacaranda_tree instance')]
woody=base_instances[0].data.copy();bm=bmesh.new();bm.from_mesh(woody);remove=[f for f in bm.faces if 'leaves' in woody.materials[f.material_index].name];bmesh.ops.delete(bm,geom=remove,context='FACES');bm.to_mesh(woody);bm.free();woody.validate(clean_customdata=False)
for obj in base_instances:
 obj.data=woody
 crown=bpy.data.objects.new('Jacaranda canopy CC0',foliage);asset_collection.objects.link(crown);crown.matrix_world=obj.matrix_world.copy();crown['asset_instance']=True;crown['asset_source']='https://polyhaven.com/a/jacaranda_tree';crown['license']='CC0-1.0'
print('CANOPY',len(foliage.polygons),'cards')

source_tree=next(o for o in scene.objects if o.name.startswith('jacaranda_tree_LOD0') and o.get('webExclude'))
for obj in scene.objects:
 if obj.name.startswith('Jacaranda canopy CC0') and obj.get('asset_instance'):obj.matrix_world=obj.matrix_world@source_tree.matrix_world.inverted()
mat=bpy.data.materials['jacaranda_tree_leaves'];shader=next(n for n in mat.node_tree.nodes if n.type=='BSDF_PRINCIPLED')
alpha=bpy.data.images.load(str(OUT/'free-assets/jacaranda_tree/textures/leaves-alpha.png'));alpha.colorspace_settings.name='Non-Color';alpha.scale(512,512);alpha.pack()
node=mat.node_tree.nodes.new('ShaderNodeTexImage');node.image=alpha;mat.node_tree.links.new(node.outputs['Color'],shader.inputs['Alpha'])

# FINAL_VALIDATION
for obj in scene.objects:
 if obj.get('asset_instance'):obj.data.validate(clean_customdata=False)
for image in bpy.data.images:
 if image.name.startswith('asphalt-normal') and max(image.size)>256:image.scale(256,256);image.pack()

# EXPORT
route=[[0, [33, -36, 13.2], [8.5, 1.8, 3.2], 52], [0.023544, [24, -19, 8], [9, 0, 2.5], 52], [0.053883, [16.75, -6.3, 1.75], [18, -1, 1.7], 62], [0.075166, [16.75, -4.5, 1.75], [19.15, -2, 1.7], 62], [0.104607, [19.15, -4.05, 1.72], [19.15, -1.2, 1.7], 62], [0.13489, [19.15, -1.2, 1.72], [18, 0.5, 1.7], 62], [0.151979, [18, -1.15, 1.7], [18, 4, 1.5], 72], [0.174806, [18.2, 0.8, 1.65], [17.25, 2.5, 1.1], 85], [0.186923, [18.4, 1.55, 1.65], [18, 5.2, 1.4], 85], [0.197935, [18, 0.4, 1.7], [18, 5.5, 1.5], 72], [0.231854, [18, -1.2, 1.7], [7, -1.2, 1.7], 65], [0.321327, [7, -1.2, 1.7], [2, 0.3, 1.65], 62], [0.377807, [2, -0.8, 1.7], [2, 5.8, 1.7], 62], [0.388643, [2, 0.55, 1.7], [2, 6.5, 1.55], 65], [0.396158, [1.7, 1.2, 1.6], [2.1, 5.6, 1.02], 78], [0.404116, [2, 0.5, 1.7], [2, 6.5, 1.6], 65], [0.439599, [2, -1.3, 1.7], [-0.2, -1.3, 1.8], 62], [0.478156, [-0.2, -1.3, 1.72], [-0.2, 0.7, 1.8], 62], [0.515138, [-0.2, 0.7, 1.72], [-1.15, 0.7, 1.8], 62], [0.543642, [-1.15, 0.65, 1.72], [-1.15, -3.8, 3.25], 62], [0.561562, [-1.15, -2.0, 2.8], [-1.15, -4.1, 3.5], 62], [0.60466, [-1.15, -4.25, 3.48], [-2.95, -3.0, 3.8], 65], [0.628875, [-2.95, -4.25, 3.48], [-2.95, 0.5, 5.2], 65], [0.645847, [-2.95, -1.9, 4.5], [-2.95, 0.8, 5.25], 62], [0.667658, [-2.95, 0.8, 5.25], [-2.95, 1.8, 5.2], 62], [0.692925, [-2.35, 0.9, 5.25], [5, 0.9, 5.25], 62], [0.755131, [4.2, 0.9, 5.25], [4.2, 3.2, 5.25], 65], [0.793884, [4.2, 3.45, 5.25], [1.8, 3.2, 5.05], 65], [0.804197, [2.8, 3.45, 5.25], [-1.4, 3.5, 4.8], 72], [0.809171, [2.5, 3.45, 5.2], [-1.4, 3.5, 4.8], 78], [0.814144, [3.1, 3.45, 5.25], [-1.4, 3.5, 4.8], 72], [0.842619, [4.2, 3.45, 5.25], [4.2, 0.9, 5.25], 65], [0.879957, [4.2, 0.9, 5.25], [14, 0.9, 5.25], 62], [0.944287, [12.9, 0.9, 5.25], [16.5, 4.2, 4.7], 65], [0.993428, [17.5, 1.1, 5.3], [14.8, 4.4, 4.7], 76], [1.0, [18.3, 0.8, 5.5], [14.4, 4.9, 4.9], 80]]
stages=[{'id': 'exterior', 'label': 'Tampak depan', 'progress': 0}, {'id': 'admin', 'label': 'Kantor admin', 'progress': 0.174806}, {'id': 'ground', 'label': 'Kelas lantai 1', 'progress': 0.396158}, {'id': 'stairs', 'label': 'Tangga dan selasar', 'progress': 0.628875}, {'id': 'upper', 'label': 'Kelas lantai 2', 'progress': 0.809171}, {'id': 'terrace', 'label': 'Ruang semi indoor', 'progress': 1.0}]
cam.animation_data_clear();cam.data.animation_data_clear()
for t,pos,target,fov in route:
 fr=round(t*1000)+1;cam.location=pos;cam.rotation_euler=(Vector(target)-Vector(pos)).to_track_quat('-Z','Y').to_euler();cam.data.angle=math.radians(fov);cam.keyframe_insert(data_path='location',frame=fr);cam.keyframe_insert(data_path='rotation_euler',frame=fr);cam.data.keyframe_insert(data_path='lens',frame=fr)
for owner in [cam,cam.data]:
 action=owner.animation_data.action
 curves=list(action.fcurves) if hasattr(action,'fcurves') else [fc for layer in action.layers for strip in layer.strips for bag in strip.channelbags for fc in bag.fcurves]
 for fc in curves:
  for kp in fc.keyframe_points:kp.interpolation='LINEAR'
scene.frame_set(1)
import re
bpy.context.window.scene=scene;scene.frame_set(1);bpy.context.view_layer.update();dg=bpy.context.evaluated_depsgraph_get()
active=[o for o in scene.objects if not o.get('webExclude') and o.type in {'MESH','FONT','CURVE'}]
buckets={}
for ob in active:
 if ob.get('asset_instance'):continue
 ev=ob.evaluated_get(dg);me=ev.to_mesh();uv=me.uv_layers.active;normal_matrix=ob.matrix_world.to_3x3().inverted().transposed();reverse=ob.matrix_world.to_3x3().determinant()<0
 for poly in me.polygons:
  mat=me.materials[poly.material_index] if me.materials else white;canonical=re.sub(r'\.\d{3}$','',mat.name)
  group='SHADE_REVEAL' if ob.get('tour_reveal') else 'BUILDING';key=(group,canonical)
  if key not in buckets:buckets[key]={'vertices':[],'faces':[],'uv':[],'normals':[],'lookup':{},'mat':mat}
  b=buckets[key];indices=[]
  for li in (list(poly.loop_indices)[::-1] if reverse else poly.loop_indices):
   vert=me.vertices[me.loops[li].vertex_index];p=tuple(round(v,6) for v in ob.matrix_world@vert.co);n=tuple(round(v,5) for v in (normal_matrix@(vert.normal if poly.use_smooth else poly.normal)).normalized());tex=tuple(round(v,6) for v in uv.data[li].uv) if uv else (0,0);vk=(p,n,tex)
   if vk not in b['lookup']:
    b['lookup'][vk]=len(b['vertices']);b['vertices'].append(p);b['normals'].append(n);b['uv'].append(tex)
   indices.append(b['lookup'][vk])
  b['faces'].append(tuple(indices))
 ev.to_mesh_clear()
export_scene=bpy.data.scenes.new('LPQ - Export Web Revisi 4')
for (group,name),b in buckets.items():
 me=bpy.data.meshes.new(group+' '+name);me.from_pydata(b['vertices'],[],b['faces']);me.materials.append(b['mat']);me.update();me.validate(clean_customdata=False);uv=me.uv_layers.new()
 for loop in me.loops:uv.data[loop.index].uv=b['uv'][loop.vertex_index]
 for p in me.polygons:p.use_smooth=True
 if hasattr(me,'normals_split_custom_set_from_vertices'):me.normals_split_custom_set_from_vertices(b['normals'])
 ob=export_scene.objects.get(group+' '+name)
 if ob:ob.data=me
 else:
  ob=bpy.data.objects.new(group+' '+name,me);export_scene.collection.objects.link(ob)
 ob['tourReveal']=group=='SHADE_REVEAL'
for original in active:
 if original.get('asset_instance'):
  instance=original.copy();instance.data=original.data;export_scene.collection.objects.link(instance);instance.hide_render=False;instance.hide_set(False)
bpy.context.window.scene=export_scene;bpy.context.view_layer.update();dg=bpy.context.evaluated_depsgraph_get()
collisions=[]
for i in range(len(route)-1):
 a=Vector(route[i][1]);b=Vector(route[i+1][1]);delta=b-a
 if delta.length<.001:continue
 hit,p,normal,index,obj,matrix=export_scene.ray_cast(dg,a,delta.normalized(),distance=delta.length)
 if hit:collisions.append({'segment':i,'object':obj.name,'point':[round(v,3) for v in p]})
def ray(origin,direction,distance):return export_scene.ray_cast(dg,Vector(origin),Vector(direction),distance=distance)[0]
checks={'gateAtRoom4Closed':ray((6,-6,.4),(0,1,0),1.2),'rightFenceClosed':ray((18,-6,.4),(0,1,0),1.2),'onlyEntranceClear':not ray((16.75,-6,.4),(0,1,0),1.2),'wallAheadAtLanding':ray((-2.95,.8,5.25),(0,1,0),1.2),'rightWalkwayClear':not ray((-2.95,.9,5.25),(1,0,0),15.85)}
web=Path('D:/Project/LPQ Al-Fath Maulana/.codex-local/building-tour/public/models')
bpy.ops.export_scene.gltf(filepath=str(web/'lpq-building.glb'),export_format='GLB',export_extras=True,export_animations=False,export_cameras=False,export_lights=False,use_active_scene=True,export_yup=True)


bpy.context.window.scene=scene
manifest=json.loads((WEB/'lpq-building-tour.json').read_text())
manifest['revision']=4;manifest['stages']=stages
convert=lambda v:[round(v[0],5),round(v[2],5),round(-v[1],5)]
manifest['keyframes']=[{'progress':t,'position':convert(p),'target':convert(target),'fov':round(math.degrees(2*math.atan(math.tan(math.radians(fov)/2)/(1500/950))),4)} for t,p,target,fov in route]
manifest['layout'].update({'sideRoads':True,'hallRearReturnClosed':True})
manifest['pacing']={'scrollViewportHeights':9,'method':'distance and turn weighted; floor one emphasis'}
(WEB/'lpq-building-tour.json').write_text(json.dumps(manifest,indent=2))
bpy.context.window.scene=export_scene;dg=bpy.context.evaluated_depsgraph_get()
checks['leftAsphalt']=ray((-6,0,1),(0,0,-1),1.1)
checks['rightAsphalt']=ray((23,0,1),(0,0,-1),1.1)
checks['hallReturnWall']=ray((11.25,6.9,5.2),(0,1,0),.6)
report={'revision':4,'checks':checks,'cameraCollisions':collisions,'glbBytes':(WEB/'lpq-building.glb').stat().st_size,'exportMeshes':len(export_scene.objects),'backup':str(backup)}
(OUT/'model-validation-revision4.json').write_text(json.dumps(report,indent=2))
assert all(checks.values()) and not collisions
assert report['glbBytes']<12*1024*1024
bpy.context.window.scene=scene;scene.frame_set(1)
scene.timeline_markers.clear()
for stage in stages:scene.timeline_markers.new(stage['label'],frame=round(stage['progress']*1000)+1)
bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'lpq-al-fath-maulana-revisi-4.blend'))
print('R4 VALIDATED',report)
