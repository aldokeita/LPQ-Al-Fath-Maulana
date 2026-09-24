"""Apply photo-based corrections to a copy of the active original LPQ scene.
Keeps the original scene and saves a timestamped backup before changes.
Run once after build-lpq-building.py, from Blender Text Editor.
"""
import bpy, math, json, ast, datetime
from pathlib import Path
from mathutils import Vector, Matrix
assert not bpy.context.scene.get('revision'), 'Select the original LPQ scene before running this revision.'
assert bpy.context.scene.get('ground_floor_classrooms') == 5 and bpy.context.scene.camera, 'Select the original LPQ building scene.'
output=Path('D:/Project/LPQ Al-Fath Maulana 3D')
stamp=datetime.datetime.now().strftime('%Y%m%d-%H%M%S')
backup=output/('lpq-before-corrections-'+stamp+'.blend')
bpy.ops.wm.save_as_mainfile(filepath=str(backup),copy=True)
base_source=Path('D:/Project/LPQ Al-Fath Maulana/.codex-local/building-tour/tools/build-lpq-building.py').read_text(encoding='utf-8')
helpers=ast.Module(body=[n for n in ast.parse(base_source).body if isinstance(n,ast.FunctionDef)],type_ignores=[])
exec(compile(helpers,'LPQ helpers','exec'),globals())
original_scene=bpy.context.scene
bpy.ops.scene.new(type='FULL_COPY');scene=bpy.context.scene;scene.name='LPQ Al-Fath Maulana - Revisi foto lantai 2'
scene.frame_set(1);cam=scene.camera;cam.animation_data_clear();cam.data.animation_data_clear()
COL=None;MESH={}
materials={'blue':'Cat biru fasad','white':'Putih hangat','cream':'Dinding interior putih','navy':'Dado biru interior','steel':'Baja galvanis','dark':'Besi pagar','glass':'Kaca gelap','concrete':'Beton halaman','tile':'Keramik terang','wood':'Kayu alami','gold':'Aksen emas','green':'Daun','soil':'Tanah','cloth':'Jaring peneduh hitam','cushion':'Bantal biru','paper':'Kertas','terracotta':'Pot tanah','stone':'Pilar batu','warm':'Lampu hangat','rug':'Karpet geometri biru emas','tiles':'Nat keramik','weave':'Anyaman jaring'}
for var,name in materials.items():globals()[var]=bpy.data.materials[name]
bookmats=[bpy.data.materials['Buku '+str(i)] for i in range(4)]
def col(prefix):return next(c for c in scene.collection.children if c.name.startswith(prefix))
def retire(o):
 o.hide_render=True;o.hide_set(True);o['webExclude']=True

def archive(c):
 c.hide_render=True;c.hide_viewport=True
 for o in c.all_objects:o['webExclude']=True
for i,o in enumerate(sorted([o for o in scene.objects if o.get('classroom_door','').startswith('Door_L1')],key=lambda o:o.location.x)):
 o['room_number']=5-i;o['classroom_door']='Door_L1_'+str(5-i);o.name='L1 - Pintu kelas '+str(5-i)
for o in col('01 ').objects:
 if o.type=='FONT' and o.data.body in ['1','2','3','4','5']:
  o.data=o.data.copy();o.data.body=str(5-min(4,int(o.location.x/4)))
for o in col('10 ').objects:
 if o.name.startswith(('Meja kayu selasar','Kaki meja selasar','Bangku selasar','Kaki bangku')):
  o.matrix_world=Matrix.Translation((2,-2.7,0))@Matrix.Rotation(math.pi/2,4,'Z')@Matrix.Translation((-13.1,3,0))@o.matrix_world
for o in col('05 ').objects:
 if o.name.startswith('SHADE_porch'):
  o.location.x=8.8;o.name='SHADE_porch_center'
reflection=Matrix.Translation((-4.1,0,0))@Matrix.Diagonal(Vector((-1,1,1,1)))
for o in col('02 ').objects:
 if o.name.startswith(('Anak tangga','Lis anak tangga','Handrail','Tiang railing','Palang railing')):
  o.matrix_world=reflection@o.matrix_world
 if o.name.startswith(('Akses koridor','Pengaman akses','Handrail akses','Bordes atas')):retire(o)
COL=col('02 ')
box('Bordes atas baru',(-1.85,.8,3.5),(4.0,1.8,.2),white)
archive(col('06 '));collection('R2 Pagar - satu bukaan kanan','User confirmed: one opening near former door 5, now door 1')
for lo,hi in [(-3.8,3.7),(3.7,11.8),(11.8,16.0),(17.5,20.4)]:
 for z in [.18,1.65]:box('Palang pagar revisi',((lo+hi)/2,-5.1,z),(hi-lo,.08,.085),dark)
 box('Panel bawah pagar revisi',((lo+hi)/2,-5.1,.36),(hi-lo,.05,.52),dark)
 for j in range(int((hi-lo)/.14)+1):box('Bilah pagar revisi',(lo+j*.14,-5.1,1.04),(.025,.034,1.22),dark)
 cx=(lo+hi)/2
 for sg in [-1,1]:
  beam('Ornamen pagar revisi',(cx-.3,-5.16,1.08),(cx,-5.16,1.08+sg*.35),.032,steel);beam('Ornamen pagar revisi',(cx,-5.16,1.08+sg*.35),(cx+.3,-5.16,1.08),.032,steel)
scene['gate_opening_x']=[16.0,17.5];scene['room_order_left_to_right']='5,4,3,2,1';scene['stair_first_flight']='inner'
print('REVISI L1 selesai. Backup:',str(backup))
archive(col('03 '))
for c in list(scene.collection.children):
 if c.name.startswith('08 '):archive(c)
archive(col('09 '))
collection('R2 Lantai 2 - selasar dan empat kelas','2+2 classrooms; 1.8m front walkway turns right from stair landing')
box('Pelat tambahan sisi kiri',(-1.9,3.7,3.5),(3.8,7.4,.2),white)
for yy in [1.8,7.25]:box('Kolom penopang sisi kiri',(-3.65,yy,1.7),(.25,.25,3.4),blue)
plane('Keramik selasar L2',(4.1,.9,3.625),15.8,1.64,tiles,(26,3))
plane('Keramik koridor tengah L2',(4.2,4.6,3.63),1.6,5.6,tiles,(3,9))
box('Dinding di depan bordes',(4.1,1.8,5.0),(15.8,.16,2.8),blue)
box('Dinding belakang kelas L2',(4.1,7.4,5.0),(15.8,.16,2.8),cream)
for xx in [-3.8,12]:box('Dinding samping kelas L2',(xx,4.6,5.0),(.16,5.6,2.8),cream)
for cx,width in [(-.2,7.2),(8.5,7.0)]:box('Pembagi dua kelas',(cx,4.6,5.0),(width,.16,2.8),cream)
# The front passage opens into the perpendicular middle aisle.
# Split the front wall into three pieces rather than leave a wall across the aisle.
front=next(o for o in COL.objects if o.name.startswith('Dinding di depan bordes'));retire(front)
box('Dinding depan kelas kiri',(-.2,1.8,5.0),(7.2,.16,2.8),blue)
box('Dinding depan kelas kanan',(8.5,1.8,5.0),(7.0,.16,2.8),blue)
box('Balok atas mulut koridor',(4.2,1.8,6.23),(1.6,.16,.34),cream)
def side_class_wall(number,x,y0,y1,left_side):
 before=set(COL.objects)
 frontwall('Dinding pintu kelas '+str(number),y0,y1,-x,3.6,2.8,[((y0+y1)/2,.98,0,2.25)],cream)
 door('Door_L2_'+str(number),(y0+y1)/2,-x,3.6,angle=105 if left_side else -105)
 box('Ventilasi atas pintu',((y0+y1)/2,-x-.095,6.12),(.72,.035,.28),glass)
 for o in set(COL.objects)-before:o.matrix_world=Matrix.Rotation(math.pi/2,4,'Z')@Matrix.LocRotScale(o.location.copy(),o.rotation_euler.to_quaternion(),o.scale.copy())
for row,(y0,y1) in enumerate([(1.8,4.6),(4.6,7.4)]):
 side_class_wall(row+1,3.4,y0,y1,True)
 side_class_wall(row+3,5.0,y0,y1,False)
box('Atap empat kelas',(4.1,4.6,6.46),(16.1,5.9,.12),white)
for yy in [1.65,7.55]:box('Lis atap kelas',(4.1,yy,6.62),(16.1,.13,.28),white)
for x in [.12,5.8,11.75]:box('Kolom selasar depan',(x,.08,4.16),(.15,.15,1.12),blue)
box('Parapet selasar depan',(6,.02,4.03),(12,.12,.86),blue)
beam('Handrail selasar depan',(0,.02,4.62),(12,.02,4.62),.045,steel)
for y in [3.2,6.0]:
 box('Jendela sisi ruang kelas',(12.09,y,5.15),(.025,.68,1.24),glass)
 for yy in [y-.38,y+.38]:box('Bingkai jendela ruang kelas',(12.12,yy,5.15),(.05,.065,1.34),white)
 for zz in [4.48,5.82]:box('Bingkai jendela ruang kelas',(12.12,y,zz),(.05,.82,.065),white)
 box('Ventilasi kelas ke aula',(12.12,y,6.14),(.04,.75,.25),glass)
for row,(y0,y1) in enumerate([(1.8,4.6),(4.6,7.4)]):
 for left_side,number,width,origin,angle in [(True,row+1,7.2,(3.4,y0,0),math.pi/2),(False,row+3,7,(5,y1,0),-math.pi/2)]:
  furniture('R2 Interior L2 kelas '+str(number),0,0,3.6,2.8,width,1)
  for o in COL.objects:
   if o.name.startswith(('Dinding dalam putih','Dinding belakang dalam')):o.location.z=3.6+(1.16+2.74)/2;o.dimensions.z=2.74-1.16
   o.matrix_world=Matrix.Translation(origin)@Matrix.Rotation(angle,4,'Z')@Matrix.LocRotScale(o.location.copy(),o.rotation_euler.to_quaternion(),o.scale.copy())
collection('R2 Semi outdoor sesuai IMG_2617','Architecture and furnishing only; people and markup excluded')
plane('Keramik aula semi outdoor',(16.05,3.7,3.635),7.95,7.2,tiles,(13,12))
for yy in [.105,7.285]:box('Dinding rendah putih bagian dalam',(16.1,yy,4.08),(8,.035,.94),white)
box('Dinding rendah putih samping',(20.0,3.7,4.08),(.035,7.3,.94),white)
for xx in [12.12,16,20.0]:
 for yy in [.12,7.28]:
  box('Kolom biru aula',(xx,yy,4.85),(.22,.22,2.5),blue)
  beam('Sambungan kolom atap',(xx,yy,6.1),(xx,yy,6.9),.065,steel)
for yy in [.1,7.3]:
 for zz in [4.62,4.83,5.72,6.75]:beam('Railing dan rangka horizontal',(12.12,yy,zz),(20.0,yy,zz),.035,steel)
 for xx in [13.2,14.6,17.4,18.8]:beam('Rangka kisi vertikal',(xx,yy,4.6),(xx,yy,6.85),.035,steel)
for zz in [4.62,4.83,5.72,6.75]:beam('Rangka samping aula',(20.0,.1,zz),(20.0,7.3,zz),.035,steel)
for yy in [1.2,2.8,4.5,6.1]:
 beam('Gording tambahan aula',(12,yy,6.92+(.92*(1-abs(yy-3.7)/3.7))),(20.2,yy,6.92+(.92*(1-abs(yy-3.7)/3.7))),.055,steel)
def mat_pattern(u,v,base):
 edge=min(u,1-u,v,1-v)
 if edge<.025 or .055<edge<.069:return (.70,.75,.63,1)
 if edge<.10 and abs(math.sin(u*90)+math.cos(v*90))<.45:return (.04,.07,.06,1)
 uu=(u*3)%1-.5;vv=(v*3)%1-.5;r=math.sqrt(uu*uu+vv*vv)
 if .31<r<.35 or .19<r<.205:return (.79,.82,.68,1)
 if abs(r-(.245+.026*math.sin(math.atan2(vv,uu)*12)))<.012:return (.03,.08,.07,1)
 return (*base,1)
mat_green=image_material('Karpet hijau aula',512,lambda u,v:mat_pattern(u,v,(.025,.31,.23)))
mat_teal=image_material('Karpet toska aula',512,lambda u,v:mat_pattern(u,v,(.04,.49,.50)))
plane('Karpet hijau seperti foto',(14.75,4.5,3.67),4.75,4.8,mat_green)
plane('Karpet toska seperti foto',(18.1,3.1,3.675),3.1,4.8,mat_teal)
def standing_fan(x,y):
 base=cylinder('Kipas berdiri - alas',(x,y,3.70),.29,.07,dark,24)
 beam('Kipas berdiri - tiang',(x,y,3.72),(x,y,4.58),.035,steel)
 fan=cylinder('Kipas berdiri - pelindung',(x,y,4.89),.29,.08,dark,32);fan.rotation_euler.x=math.pi/2
 inner=cylinder('Kipas berdiri - pusat',(x,y-.055,4.89),.075,.09,dark,16);inner.rotation_euler.x=math.pi/2
 for i in range(12):
  a=i*math.pi/12;beam('Kisi kipas aula',(x-.28*math.cos(a),y-.065,4.89-.28*math.sin(a)),(x+.28*math.cos(a),y-.065,4.89+.28*math.sin(a)),.007,steel)
 for i in range(3):
  a=i*math.pi*2/3;beam('Bilah kipas aula',(x,y-.035,4.89),(x+.23*math.cos(a),y-.035,4.89+.23*math.sin(a)),.045,dark)
standing_fan(14.0,1.6);standing_fan(16.1,2.0)
scene['front_walkway_width']=1.8;scene['upper_layout']='2+2 around perpendicular middle aisle; front access turns right from stairs'
print('Lantai 2 dan aula semi outdoor diperbarui.')
import bmesh, random
collection('R2 Flora - lanskap dan tanaman rambat','Conceptual landscaping requested by user; no people modelled')
leaf_mats=[material('Flora hijau '+str(i),c) for i,c in enumerate([(.025,.13,.035),(.055,.25,.055),(.13,.34,.055)])]
bark=material('Kulit pohon',(.19,.09,.035));flower_mats=[material('Bunga '+str(i),c) for i,c in enumerate([(.63,.045,.22),(.83,.39,.035),(.78,.67,.16),(.42,.16,.54),(.86,.78,.68)])]
flora_mesh={}
def ellipsoid(name,position,scale,mat,angle=0):
 if mat.name not in flora_mesh:
  bm=bmesh.new();bmesh.ops.create_icosphere(bm,subdivisions=2,radius=1);me=bpy.data.meshes.new(name+' mesh');bm.to_mesh(me);bm.free();me.materials.append(mat)
  for p in me.polygons:p.use_smooth=True
  flora_mesh[mat.name]=me
 o=bpy.data.objects.new(name,flora_mesh[mat.name]);COL.objects.link(o);o.location=position;o.scale=scale;o.rotation_euler.z=angle;return o

def blossom(x,y,z,r,mat):
 for i in range(5):
  a=i*math.tau/5;ellipsoid('Flora_kelopak',(x+math.cos(a)*r*.62,y+math.sin(a)*r*.62,z),(.60*r,.38*r,.22*r),mat,a)
 ellipsoid('Flora_putik',(x,y,z+.025*r),(.22*r,.22*r,.21*r),gold)

def ornamental(x,y,z,s=1,color=None,seed=1):
 rng=random.Random(seed)
 cylinder('Flora_pot',(x,y,z+.19*s),.20*s,.38*s,terracotta if seed%2 else white,16)
 cylinder('Flora_media',(x,y,z+.385*s),.18*s,.012,soil,16)
 for i in range(6):
  a=i*2.4;h=(.38+rng.random()*.28)*s;xx=x+math.cos(a)*.13*s;yy=y+math.sin(a)*.13*s
  beam('Flora_batang kecil',(x,y,z+.35*s),(xx,yy,z+.35*s+h),.017*s,leaf_mats[0])
  for k in [0,1]:
   zz=z+.43*s+h*(.15+.35*k);ellipsoid('Flora_daun hias',(xx+math.cos(a)*.08*s,yy+math.sin(a)*.08*s,zz),(.18*s,.065*s,.045*s),leaf_mats[(i+k)%3],a)
  if color is not None:blossom(xx,yy,z+.35*s+h,.095*s,flower_mats[color%5])
  else:ellipsoid('Flora_daun tegak',(xx,yy,z+.35*s+h*.70),(.065*s,.055*s,.26*s),leaf_mats[i%3],a)

def tree(x,y,h,seed):
 rng=random.Random(seed);cylinder('Flora_pohon batang',(x,y,h*.30),h*.026,h*.60,bark,12)
 for i in range(5):
  a=i*math.tau/5+.3;end=(x+math.cos(a)*h*.22,y+math.sin(a)*h*.22,h*(.68+rng.random()*.12))
  beam('Flora_cabang',(x,y,h*.40),end,h*.020,bark)
 for i in range(20):
  a=i*2.399;rr=(.3+rng.random()*.75)*h*.25;zz=h*.67+rng.random()*h*.22
  ellipsoid('Flora_tajuk',(x+math.cos(a)*rr,y+math.sin(a)*rr,zz),(h*.14,h*.13,h*.115),leaf_mats[i%3],a)

for i,(x,y,h) in enumerate([(-5.4,4.8,5.6),(-4.8,9.2,6.0),(2.5,10.1,6.4),(9.6,10.3,6.1),(17,10,5.8),(22.7,6.7,6.2),(23.2,.8,4.4)]):tree(x,y,h,2617+i)
for i,x in enumerate([-3.5,-1.2,3.6,5.5,7.4,9.3,11.2,13.2,15.2,19.7,21.2]):ornamental(x,-5.6,0,.95,i%5,100+i)
for i,y in enumerate([1.4,3.0,4.6,6.2]):ornamental(21.3,y,0,1.15,i%5,200+i)
for i,x in enumerate([13.1,14.05,15.0,16.9,17.85,18.8,19.55]):
 ornamental(x,7.08,4.61,.62,None,300+i)
 ornamental(x,.29,4.61,.55,None,330+i)
for post,(x,y) in enumerate([(3.8,-4.8),(11.8,-4.8),(20.3,-4.8)]):
 previous=None
 for j in range(30):
  zz=.35+j*.145;a=j*.9;point=(x+.12*math.cos(a),y+.12*math.sin(a),zz)
  if previous:beam('Flora_rambat batang',previous,point,.018,leaf_mats[0])
  ellipsoid('Flora_rambat daun',(point[0]+.07*math.cos(a),point[1]+.07*math.sin(a),zz),(.14,.075,.035),leaf_mats[j%3],a)
  if j%5==0:blossom(point[0],point[1]-.10,zz+.05,.105,flower_mats[post%3])
  previous=point
for o in col('01 ').objects:
 if o.name.startswith('Tapak beton'):o.dimensions=(34,21,.28);o.location.x=8.5;o.location.y=1.0
scene['flora_tree_count']=7;scene['flora_has_climbers']=True;scene['flora_color_count']=5
print('Flora ditambahkan: 7 pohon, pot warna-warni, tanaman rambat, dan pot aula.')
route=[
(0,(33,-36,13.2),(8.5,1.8,3.2),52),(.065,(24,-19,8),(9,0,2.5),52),
(.12,(16.75,-6.2,1.75),(13,-.5,1.7),62),(.15,(16.75,-3.8,1.75),(8,-1.1,1.8),62),
(.19,(7,-1.1,1.7),(2,.3,1.65),62),(.23,(2,-.8,1.7),(2,5.8,1.7),62),
(.26,(2,.55,1.7),(2,6.5,1.55),65),(.31,(1.7,1.2,1.60),(2.1,5.6,1.02),78),
(.35,(2,.5,1.7),(2,6.5,1.6),65),(.38,(2,-1.3,1.7),(-.2,-1.3,1.8),62),
(.41,(-.20,-1.3,1.72),(-.20,.7,1.8),62),(.42,(-.20,.7,1.72),(-1.15,.7,1.8),62),(.43,(-1.15,.65,1.72),(-1.15,-3.8,3.25),62),
(.48,(-1.15,-2.0,2.8),(-1.15,-4.1,3.5),62),(.52,(-1.15,-4.25,3.48),(-2.95,-3.0,3.8),65),
(.55,(-2.95,-4.25,3.48),(-2.95,.5,5.2),65),(.60,(-2.95,-1.9,4.5),(-2.95,.8,5.25),62),
(.64,(-2.95,.8,5.25),(-2.95,1.8,5.2),62),(.665,(-2.35,.9,5.25),(5,.9,5.25),62),
(.695,(4.2,.9,5.25),(4.2,3.2,5.25),65),(.72,(4.2,3.2,5.25),(1.8,3.2,5.05),65),
(.75,(2.8,3.2,5.25),(-2.8,3.4,4.8),72),(.77,(1.3,3.2,5.2),(-2.8,3.4,4.8),78),
(.80,(3.1,3.2,5.25),(-2.8,3.4,4.8),72),(.82,(4.2,3.2,5.25),(4.2,.9,5.25),65),
(.85,(4.2,.9,5.25),(14,.9,5.25),62),(.90,(12.9,.9,5.25),(16.5,4.2,4.7),65),
(.95,(17.5,1.1,5.3),(14.8,4.4,4.7),76),(1,(18.3,.8,5.5),(14.4,4.9,4.9),80)]
cam.animation_data_clear();cam.data.animation_data_clear()
for t,pos,target,fov in route:
 fr=round(t*1000)+1;cam.location=pos;cam.rotation_euler=(Vector(target)-Vector(pos)).to_track_quat('-Z','Y').to_euler();cam.data.angle=math.radians(fov);cam.keyframe_insert(data_path='location',frame=fr);cam.keyframe_insert(data_path='rotation_euler',frame=fr);cam.data.keyframe_insert(data_path='lens',frame=fr)
for owner in [cam,cam.data]:
 action=owner.animation_data.action
 curves=list(action.fcurves) if hasattr(action,'fcurves') else [fc for layer in action.layers for strip in layer.strips for bag in strip.channelbags for fc in bag.fcurves]
 for fc in curves:
  for kp in fc.keyframe_points:kp.interpolation='LINEAR'
scene.frame_set(1)
refs=col('00 ');im=bpy.data.images.load('C:/Users/ALDO/Pictures/IMG_2617.JPEG',check_existing=True);im.pack();ref=bpy.data.objects.new('Referensi semi outdoor IMG_2617',None);refs.objects.link(ref);ref.empty_display_type='IMAGE';ref.data=im;ref.hide_render=True
print('Jalur kamera baru:',len(route),'titik. Referensi lantai 2 dikemas.')
import re
bpy.context.window.scene=scene;scene.frame_set(1);bpy.context.view_layer.update();dg=bpy.context.evaluated_depsgraph_get()
active=[o for o in scene.objects if not o.get('webExclude') and o.type in {'MESH','FONT','CURVE'}]
buckets={}
for ob in active:
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
export_scene=bpy.data.scenes.new('LPQ - Export Web Revisi 2')
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
manifest=json.loads((web/'lpq-building-tour.json').read_text(encoding='utf-8'));convert=lambda v:[round(v[0],5),round(v[2],5),round(-v[1],5)]
manifest['revision']=2;manifest['keyframes']=[{'progress':t,'position':convert(p),'target':convert(target),'fov':round(math.degrees(2*math.atan(math.tan(math.radians(fov)/2)/(1500/950))),4)} for t,p,target,fov in route]
doors=[o for o in active if o.get('classroom_door')];ground=sorted([o for o in doors if o.get('classroom_door').startswith('Door_L1')],key=lambda o:o.location.x)
manifest['roomCounts']={'ground':len(ground),'upper':len(doors)-len(ground)}
manifest['layout']={'groundRoomOrder':[o['room_number'] for o in ground],'gateOpeningX':list(scene['gate_opening_x']),'frontWalkwayWidth':scene['front_walkway_width'],'firstStairFlight':'inner','tableRoom':5,'tableRotationDegrees':90,'porchShadeCenterX':8.8,'treeCount':7,'hasClimbers':True,'peopleModelled':False}
(web/'lpq-building-tour.json').write_text(json.dumps(manifest,indent=2),encoding='utf-8')
report={'revision':2,'roomCounts':manifest['roomCounts'],'layout':manifest['layout'],'checks':checks,'cameraCollisions':collisions,'glbBytes':(web/'lpq-building.glb').stat().st_size,'exportMeshes':len(export_scene.objects),'backup':str(backup),'newReference':'IMG_2617.JPEG'}
(output/'model-validation-revision2.json').write_text(json.dumps(report,indent=2),encoding='utf-8')
assert all(checks.values()) and not collisions, 'Geometry validation failed; inspect model-validation-revision2.json.'
assert manifest['roomCounts']=={'ground':5,'upper':4}, 'Unexpected classroom count.'
assert report['glbBytes'] < 12*1024*1024, 'GLB exceeds the web asset budget.'
scene['revision']=2;scene.frame_set(1);bpy.ops.wm.save_as_mainfile(filepath=str(output/'lpq-al-fath-maulana-revisi-2.blend'))
print('R2 VALIDATION',report)
