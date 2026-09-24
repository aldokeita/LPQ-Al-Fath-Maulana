"""Run in Blender with the revision-2 LPQ scene active. Originals are preserved."""
import ast
import bpy
import bmesh
import datetime
import json
import math
import re
from pathlib import Path
from mathutils import Matrix, Vector

ROOT = Path('D:/Project/LPQ Al-Fath Maulana/.codex-local/building-tour')
OUT = Path('D:/Project/LPQ Al-Fath Maulana 3D')
WEB = ROOT / 'public/models'
assert bpy.context.scene.get('revision') == 2, 'Select the revision-2 LPQ scene first.'
backup = OUT / ('lpq-before-revision3-' + datetime.datetime.now().strftime('%Y%m%d-%H%M%S') + '.blend')
bpy.ops.wm.save_as_mainfile(filepath=str(backup), copy=True)
for file, names in [
    ('build-lpq-building.py', None),
    ('revise-lpq-building.py', {'side_class_wall'}),
]:
    parsed = ast.parse((ROOT / 'tools' / file).read_text(encoding='utf-8'))
    functions = [node for node in parsed.body if isinstance(node, ast.FunctionDef) and (names is None or node.name in names)]
    exec(compile(ast.Module(body=functions, type_ignores=[]), file, 'exec'), globals())

bpy.ops.scene.new(type='FULL_COPY')
scene = bpy.context.scene
scene.name = 'LPQ - Revisi 3 identitas dan kantor'
scene['revision'] = 3
scene.frame_set(1)
cam = scene.camera
cam.animation_data_clear(); cam.data.animation_data_clear()
COL = None
MESH = {}
for var, name in {
    'blue': 'Cat biru fasad', 'white': 'Putih hangat', 'cream': 'Dinding interior putih',
    'navy': 'Dado biru interior', 'steel': 'Baja galvanis', 'dark': 'Besi pagar',
    'glass': 'Kaca gelap', 'concrete': 'Beton halaman', 'tile': 'Keramik terang',
    'wood': 'Kayu alami', 'gold': 'Aksen emas', 'green': 'Daun', 'soil': 'Tanah',
    'cloth': 'Jaring peneduh hitam', 'cushion': 'Bantal biru', 'paper': 'Kertas',
    'terracotta': 'Pot tanah', 'stone': 'Pilar batu', 'warm': 'Lampu hangat',
    'rug': 'Karpet geometri biru emas', 'tiles': 'Nat keramik', 'weave': 'Anyaman jaring',
}.items():
    globals()[var] = bpy.data.materials[name]
bookmats = [bpy.data.materials['Buku ' + str(i)] for i in range(4)]

def live_collection(prefix):
    return next(c for c in scene.collection.children if c.name.startswith(prefix) and not c.hide_render)

def retire(obj):
    obj.hide_render = True
    obj.hide_set(True)
    obj['webExclude'] = True

def archive(collection_):
    collection_.hide_render = True
    collection_.hide_viewport = True
    for obj in collection_.all_objects:
        obj['webExclude'] = True

def pose_objects(objects, transform):
    # Newly created objects have not necessarily updated matrix_world yet.
    for obj in list(objects):
        obj.matrix_world = transform @ Matrix.LocRotScale(obj.location.copy(), obj.rotation_euler.to_quaternion(), obj.scale.copy())

def image_mat(name, filename, alpha=False):
    mat = material(name, (1, 1, 1), .84)
    image = bpy.data.images.load(str(WEB / 'branding' / filename), check_existing=True)
    image.pack()
    node = mat.node_tree.nodes.new('ShaderNodeTexImage'); node.image = image
    shader = mat.node_tree.nodes.get('Principled BSDF')
    mat.node_tree.links.new(node.outputs['Color'], shader.inputs['Base Color'])
    if alpha:
        mat.node_tree.links.new(node.outputs['Alpha'], shader.inputs['Alpha'])
        mat.surface_render_method = 'DITHERED'
    return mat

lpq_mark = image_mat('Logo LPQ resmi', 'lpq-logo.png', True)
qiroati_mark = image_mat('Logo Qiroati resmi', 'qiroati-logo.png', True)
font_regular = bpy.data.fonts.load('C:/Windows/Fonts/segoeui.ttf', check_existing=True)
font_bold = bpy.data.fonts.load('C:/Windows/Fonts/segoeuib.ttf', check_existing=True)
font_regular.pack(); font_bold.pack()
QUOTE = "Jangan wariskan bacaan Qur'an yang salah, karena yang benar itu mudah. - K.H Dachlan Salim Zarkasyi"

def modern_text(name, body, position, size, mat=navy, bold=False):
    obj = text(name, body, position, size, mat)
    obj.data.font = font_bold if bold else font_regular
    obj.data.extrude = 0
    obj.data.resolution_u = 3
    obj.data.space_line = 1.12
    return obj

def vertical_image(name, position, width, height, mat):
    mesh = bpy.data.meshes.new(name + ' mesh')
    mesh.from_pydata([(-width/2,0,-height/2),(width/2,0,-height/2),(width/2,0,height/2),(-width/2,0,height/2)], [], [(0,1,2,3)])
    mesh.materials.append(mat)
    uv = mesh.uv_layers.new()
    for i, point in enumerate([(0,0),(1,0),(1,1),(0,1)]): uv.data[i].uv = point
    obj = bpy.data.objects.new(name, mesh); COL.objects.link(obj); obj.location = position
    return obj

def branding(room, width, depth, floor):
    cx, yy = width/2, depth-.145
    panel = box('Identitas ' + room, (cx, yy, floor+1.965), (2.60,.028,1.45), white)
    panel['brand_panel'] = room
    box('Aksen identitas', (cx-1.285, yy-.02, floor+1.965), (.015,.012,1.39), blue)
    vertical_image('Logo LPQ ' + room, (cx,yy-.033,floor+2.39), .52,.52,lpq_mark)
    modern_text('Nama LPQ ' + room, 'LPQ Al-Fath Maulana', (cx,yy-.045,floor+1.99), .167, bold=True)
    quote = modern_text('Kutipan ' + room, "Jangan wariskan bacaan Qur'an yang salah,\nkarena yang benar itu mudah.", (cx,yy-.045,floor+1.685), .087)
    quote['approved_quote'] = QUOTE
    modern_text('Atribusi ' + room, '- K.H Dachlan Salim Zarkasyi', (cx,yy-.045,floor+1.40), .076)

def slim_shelf(width, depth, floor, room):
    x, y = width-.24, depth*.54
    for yy in [y-.60,y+.60]: box('Rak ramping sisi', (x,yy,floor+.56), (.26,.025,1.03), wood)
    for zz in [.065,.39,.71,1.065]:
        obj = box('Rak ramping papan', (x,y,floor+zz), (.26,1.225,.025), wood)
        obj['slim_shelf'] = room
    for j in range(10):
        book = box('Buku rak ramping', (x-.035,y-.47+j*.092,floor+.845), (.17,.052,.235), bookmats[j%4])
        book.rotation_euler.x = .025 * (j%3-1)

OLD_DECOR = ('Rak alas','Rak atas','Rak sekat','Rak tengah','Buku belajar','Halaman buku',
             'Identitas kelas','Bingkai geometri','Isi bingkai','Motif bintang')

def refresh_class(room, width, depth, floor, transform, existing=None):
    global COL
    if existing is None:
        furniture('R3 Interior ' + room, 0, 0, floor, width, depth)
        interior = COL
        for obj in list(interior.objects):
            if obj.name.startswith(OLD_DECOR): retire(obj)
            if obj.name.startswith(('Dinding dalam putih','Dinding belakang dalam')):
                ceiling = 2.74 if floor else 3.31
                obj.location.z = floor+(1.16+ceiling)/2
                obj.dimensions.z = ceiling-1.16
        slim_shelf(width, depth, floor, room)
        branding(room, width, depth, floor)
        pose_objects([o for o in interior.objects if not o.get('webExclude')], transform)
    else:
        for obj in existing.objects:
            if obj.name.startswith(OLD_DECOR): retire(obj)
        collection('R3 Identitas dan rak ' + room, 'Supplied LPQ logo and user-approved quotation')
        slim_shelf(width, depth, floor, room); branding(room, width, depth, floor)
        pose_objects(COL.objects, transform)

for number in [2,3,4,5]:
    refresh_class('L1 kelas '+str(number),4,7.4,0,Matrix.Translation(((5-number)*4,0,0)),live_collection('R2 Interior L1 kelas '+str(number)))

# Preserve the front entrance; close the open right return of the terrace.
collection('R3 Pagar samping kanan', 'Right side closed; existing front entrance retained')
for zz in [.18,1.65]: box('Pagar kanan palang',(20.4,-2.55,zz),(.08,5.1,.085),dark)
box('Pagar kanan panel bawah',(20.4,-2.55,.36),(.05,5.1,.52),dark)
for i in range(37): box('Pagar kanan bilah',(20.4,-5.1+i*.14,1.04),(.034,.025,1.22),dark)
for obj in live_collection('10 ').objects:
    if obj.name.startswith(('Meja kayu selasar','Kaki meja selasar','Bangku selasar','Kaki bangku')):
        obj.location.x += 16

def prism(name, center_x, width, profile, mat):
    count = len(profile)
    vertices = [(x,y,z) for x in [center_x-width/2,center_x+width/2] for y,z in profile]
    faces = [tuple(range(count-1,-1,-1)), tuple(range(count,count*2))]
    faces += [(i,(i+1)%count,(i+1)%count+count,i+count) for i in range(count)]
    mesh=bpy.data.meshes.new(name+' mesh');mesh.from_pydata(vertices,[],faces)
    bm=bmesh.new();bm.from_mesh(mesh);bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces));bm.to_mesh(mesh);bm.free()
    mesh.materials.append(mat);obj=bpy.data.objects.new(name,mesh);COL.objects.link(obj)
    return obj

collection('R3 Penutup tangga', 'Solid white infill beneath both flights and blue outer safety wall')
prism('Tangga dalam bawah putih',-1.15,1.465,[(.35,0),(-3.85,0),(-3.85,1.8)],white)
prism('Tangga luar bawah putih',-2.95,1.465,[(-3.85,0),(.35,0),(.35,3.6),(-3.85,1.8)],white)
box('Penutup bawah bordes putih',(-2.05,-4.3,.82),(3.3,1.0,1.64),white)
prism('Tembok biru kiri tangga kedua',-3.80,.18,[(-4.8,0),(1.8,0),(1.8,4.68),(.35,4.68),(-3.85,2.88),(-4.8,2.88)],blue)

collection('R3 Rak buku dekat pintu', 'Five shallow, small bookshelves beside the ground-floor doors')
for number in range(1,6):
    x=(5-number)*4+2.80
    for xx in [x-.215,x+.215]: box('Rak pintu sisi',(xx,-.24,.45),(.022,.24,.87),wood)
    for zz in [.04,.31,.59,.89]:
        obj=box('Rak pintu papan',(x,-.24,zz),(.452,.24,.022),wood)
        if zz==.04: obj['door_rack']=number
    for j in range(6): box('Buku di samping pintu',(x-.16+j*.064,-.25,.73),(.044,.155,.25),bookmats[j%4])

# Move whole potted assemblies, not isolated flowers, into varied positions.
flora = live_collection('R2 Flora')
pots = sorted([o for o in flora.objects if o.name.startswith('Flora_pot') and o.location.y < -5.3 and o.location.z < .5], key=lambda o:o.location.x)
targets=[(-4.3,-5.55),(.6,-4.45),(4.0,-5.55),(5.15,-4.65),(7.7,-5.8),(9.7,-4.58),(10.8,-5.45),(12.3,-4.52),(14.6,-5.9),(19.35,-4.5),(21.0,-5.4)]
parts=('Flora_pot','Flora_media','Flora_kelopak','Flora_putik','Flora_batang kecil','Flora_daun hias','Flora_daun tegak')
groups=[]
for pot in pots:
    center=pot.location.copy();center.z=0
    members=[o for o in flora.objects if o.name.startswith(parts) and o.location.z<1.5 and (Vector((o.location.x,o.location.y,0))-center).length<.55]
    groups.append((center,members))
for index,((center,members),(x,y)) in enumerate(zip(groups,targets)):
    scale=[.94,1.08,.90,1.02,1.0][index%5]
    transform=Matrix.Translation((x,y,0))@Matrix.Rotation(.19*(index%5-2),4,'Z')@Matrix.Diagonal(Vector((scale,scale,scale,1)))@Matrix.Translation(-center)
    for obj in members: obj.matrix_world=transform@obj.matrix_world

collection('R3 Jalan aspal', 'Textured asphalt outside the fence')
asphalt=image_mat('Aspal bertekstur','asphalt-color.jpg')
asphalt.node_tree.nodes.get('Principled BSDF').inputs['Roughness'].default_value=.96
normal_image=bpy.data.images.load(str(WEB/'branding/asphalt-normal.png'),check_existing=True);normal_image.colorspace_settings.name='Non-Color';normal_image.pack()
tex=asphalt.node_tree.nodes.new('ShaderNodeTexImage');tex.image=normal_image
normal=asphalt.node_tree.nodes.new('ShaderNodeNormalMap');normal.inputs['Strength'].default_value=.45
asphalt.node_tree.links.new(tex.outputs['Color'],normal.inputs['Color'])
asphalt.node_tree.links.new(normal.outputs['Normal'],asphalt.node_tree.nodes.get('Principled BSDF').inputs['Normal'])
plane('Jalan aspal luar pagar',(8.5,-8.03,-.025),34,5.86,asphalt,(34/3,5.86/3))
for obj in live_collection('01 ').objects:
    if obj.name.startswith('Tapak beton'): obj.dimensions.y=23;obj.location.y=.5

# Administration room replaces the former room-1 classroom furniture.
archive(live_collection('R2 Interior L1 kelas 1'))
collection('R3 Kantor admin ruang 1', 'Visitor chairs left of entrance, facing entrance; long sofa at right wall')
office=COL
plane('Keramik kantor',(18,3.7,.065),3.82,7.22,tiles,(4/.6,7.4/.6))
for xx in [16.095,19.905]:
    box('Dinding dalam kantor',(xx,3.7,1.72),(.03,7.22,3.25),cream)
    box('Lis kantor',(xx,3.7,.12),(.045,7.22,.13),navy)
box('Dinding belakang kantor',(18,7.30,1.72),(3.82,.03,3.25),cream)
box('Plafon kantor',(18,3.7,3.30),(3.82,7.22,.045),white)
for xx in [16.18,19.82]: box('Lampu cove kantor',(xx,3.7,3.25),(.035,7.0,.025),warm)
desk=box('Meja admin',(16.82,2.55,.75),(.82,1.65,.055),wood);desk['office_item']='desk'
for xx in [16.48,17.16]:
    for yy in [1.82,3.28]: box('Kaki meja admin',(xx,yy,.38),(.045,.045,.71),dark)
box('Laci admin',(16.75,3.04,.39),(.62,.58,.65),white)
for zz in [.24,.43,.61]: box('Tarikan laci',(17.075,3.04,zz),(.018,.21,.014),steel)
screen=material('Layar komputer admin',(.055,.22,.28),.32)
screen.node_tree.nodes.get('Principled BSDF').inputs['Emission Color'].default_value=(.04,.18,.23,1)
screen.node_tree.nodes.get('Principled BSDF').inputs['Emission Strength'].default_value=.3
monitor=box('Monitor admin',(16.78,2.52,1.14),(.045,.67,.43),dark);monitor['office_item']='computer'
box('Layar monitor',(16.807,2.52,1.14),(.012,.60,.36),screen)
for j in range(4): box('Baris layar admin',(16.816,2.51,1.24-j*.062),(.006,.43,.014),white)
beam('Stand monitor',(16.77,2.52,.79),(16.77,2.52,.97),.043,dark)
box('Alas monitor',(16.78,2.52,.792),(.21,.27,.027),dark)
box('Keyboard',(17.035,2.53,.80),(.22,.53,.018),dark)
for row in range(4):
    for key in range(12): box('Tombol keyboard',(16.963+row*.044,2.32+key*.038,.813),(.029,.029,.008),steel)
mouse=cylinder('Mouse',(17.03,3.04,.815),.043,.022,dark,16);mouse.scale.y=1.45

def office_chair(name,x,y,angle=0,staff=False):
    before=set(COL.objects)
    seat=box(name+' dudukan',(0,0,.46),(.48,.46,.085),cushion)
    seat['office_item']='staff-chair' if staff else 'visitor-chair'
    box(name+' sandaran',(0,.19,.76),(.47,.07,.51),cushion)
    if staff:
        beam(name+' tiang',(0,0,.1),(0,0,.43),.055,steel)
        for i in range(5):
            a=i*math.tau/5;beam(name+' kaki',(0,0,.10),(.29*math.cos(a),.29*math.sin(a),.07),.035,dark)
    else:
        for xx in [-.18,.18]:
            for yy in [-.16,.16]:box(name+' kaki',(xx,yy,.23),(.033,.033,.42),dark)
    pose_objects(set(COL.objects)-before,Matrix.Translation((x,y,0))@Matrix.Rotation(angle,4,'Z'))

office_chair('Kursi petugas',17.67,2.55,-math.pi/2,True)
office_chair('Kursi pengunjung kiri A',16.72,.85)
office_chair('Kursi pengunjung kiri B',17.35,.85)
sofa=box('Sofa tamu panjang',(19.49,3.5,.29),(.79,3.42,.35),navy);sofa['office_item']='sofa'
box('Sandaran sofa',(19.83,3.5,.76),(.13,3.42,.67),navy)
for yy in [1.76,5.24]: box('Lengan sofa',(19.48,yy,.56),(.86,.14,.56),navy)
for yy in [2.23,3.07,3.91,4.75]:
    for name,pos,size in [('Bantal duduk sofa',(19.40,yy,.51),(.65,.77,.14)),('Bantal sandar sofa',(19.72,yy,.80),(.13,.77,.46))]:
        obj=box(name,pos,size,cushion);bevel=obj.modifiers.new('Sudut kain','BEVEL');bevel.width=.045;bevel.segments=2
for xx in [19.15,19.78]:
    for yy in [2.05,4.96]:box('Kaki sofa',(xx,yy,.075),(.055,.055,.15),dark)
box('Kabinet arsip tipis',(16.28,5.65,.63),(.30,1.2,1.2),white)
for yy in [5.35,5.95]: box('Pegangan kabinet',(16.44,yy,.73),(.023,.025,.18),steel)
for i in range(7):box('Map arsip',(16.27,5.2+i*.115,1.38),(.22,.06,.28),bookmats[i%4])
branding('kantor admin',4,7.4,0)
new_brand=[o for o in COL.objects if o.name.startswith(('Identitas kantor','Aksen identitas','Logo LPQ kantor','Nama LPQ kantor','Kutipan kantor','Atribusi kantor'))]
pose_objects(new_brand,Matrix.Translation((16,0,0)))
light=bpy.data.lights.new('Lampu kantor','AREA');light.energy=260;light.shape='RECTANGLE';light.size=3;light.size_y=6
obj=bpy.data.objects.new('Lampu kantor',light);COL.objects.link(obj);obj.location=(18,3.7,3.13)

# Rebuild the upstairs room envelope with shorter lengths and wider front/back bays.
archive(live_collection('R2 Lantai 2'))
for old in list(scene.collection.children):
    if old.name.startswith('R2 Interior L2') and not old.hide_render: archive(old)
collection('R3 Empat kelas lantai 2','Approximately 3.3m wide by 5.4-5.5m long; front access retained')
box('Pelat kiri dan bordes',(-1.9,4.2,3.50),(3.8,8.4,.2),white)
box('Pelat pelebaran belakang',(5.2,7.92,3.50),(10.7,1.04,.2),white)
for xx in [-2.0,4.2,10.2]: box('Penopang belakang',(xx,8.22,1.7),(.22,.22,3.4),blue)
plane('Keramik selasar atas',(4.1,.9,3.63),15.8,1.64,tiles,(26,3))
plane('Keramik koridor empat kelas',(4.2,5.1,3.635),1.6,6.6,tiles,(3,11))
box('Dinding depan kiri sekaligus bordes',(-.2,1.8,5.0),(7.2,.16,2.8),blue)
box('Dinding depan kanan',(7.7,1.8,5.0),(5.4,.16,2.8),blue)
box('Balok mulut koridor',(4.2,1.8,6.23),(1.6,.16,.34),cream)
box('Dinding belakang empat kelas',(4.15,8.4,5.0),(12.5,.16,2.8),cream)
for xx in [-2.1,10.4]:box('Dinding samping kelas baru',(xx,5.1,5.0),(.16,6.6,2.8),cream)
for cx,width in [(.65,5.5),(7.7,5.4)]:box('Sekat antar kelas baru',(cx,5.1,5.0),(width,.16,2.8),cream)
for row,(y0,y1) in enumerate([(1.8,5.1),(5.1,8.4)]):
    side_class_wall(row+1,3.4,y0,y1,True)
    side_class_wall(row+3,5.0,y0,y1,False)
box('Atap kelas baru',(4.1,5.1,6.46),(16.1,6.9,.12),white)
for yy in [1.65,8.55]:box('Lis atap kelas baru',(4.1,yy,6.62),(16.1,.13,.28),white)
box('Parapet selasar baru',(6,.02,4.03),(12,.12,.86),blue)
beam('Handrail selasar baru',(0,.02,4.62),(12,.02,4.62),.045,steel)
for xx in [.12,5.8,11.75]:box('Kolom selasar baru',(xx,.08,4.16),(.15,.15,1.12),blue)
for yy in [3.45,6.75]:
    box('Jendela aula ke kelas',(10.49,yy,5.15),(.025,.68,1.24),glass)
    for y in [yy-.38,yy+.38]:box('Kusen aula ke kelas',(10.52,y,5.15),(.05,.065,1.34),white)
    for zz in [4.48,5.82]:box('Kusen aula ke kelas',(10.52,yy,zz),(.05,.82,.065),white)
    box('Ventilasi aula ke kelas',(10.52,yy,6.14),(.04,.75,.25),glass)
for row,(y0,y1) in enumerate([(1.8,5.1),(5.1,8.4)]):
    refresh_class('L2 kelas '+str(row+1),3.3,5.5,3.6,Matrix.Translation((3.4,y0,0))@Matrix.Rotation(math.pi/2,4,'Z'))
    refresh_class('L2 kelas '+str(row+3),3.3,5.4,3.6,Matrix.Translation((5,y1,0))@Matrix.Rotation(-math.pi/2,4,'Z'))

collection('R3 Dekorasi semi outdoor','Small additions: two suspended planters, clock and warm lamps')
plane('Keramik tambahan dekat aula',(11.2,4.6,3.64),1.6,5.6,tiles,(1.6/.6,5.6/.6))
for x,y in [(11.2,6.6),(19.3,6.6)]:
    cylinder('Pot gantung',(x,y,5.45),.16,.25,terracotta,16)
    for angle in [0,2.1,4.2]:beam('Tali pot gantung',(x+math.cos(angle)*.13,y+math.sin(angle)*.13,5.57),(x,y,6.38),.009,dark)
    for i in range(8):
        angle=i*2.4
        beam('Daun menjuntai',(x,y,5.53),(x+.22*math.cos(angle),y+.22*math.sin(angle),5.18+.03*(i%3)),.038,green)
clock=cylinder('Jam aula',(10.54,5.10,6.05),.19,.04,white,32);clock.rotation_euler.y=math.pi/2
beam('Jarum jam panjang',(10.568,5.10,6.05),(10.568,5.10,6.18),.012,navy)
beam('Jarum jam pendek',(10.570,5.10,6.05),(10.570,5.19,6.05),.015,navy)
for xx in [13.5,16,18.5]:
    beam('Kabel lampu aula',(xx,4.0,7.55),(xx,4.0,6.85),.012,dark)
    cylinder('Lampu hangat aula',(xx,4.0,6.80),.045,.10,warm,12)

# The supplied logos are used on the banner; no artwork is invented.
for obj in live_collection('01 ').objects:
    if obj.name.startswith(('Papan nama lembaga','Nama lembaga','Nama lokasi')):retire(obj)
collection('R3 Banner resmi di atas ruang 1','LPQ left, Qiroati right, modern typography')
box('Banner identitas resmi',(18,-.44,3.0),(3.82,.06,1.02),white)
box('Aksen banner',(18,-.478,2.515),(3.82,.018,.028),blue)
for name,xx,mat in [('LPQ',16.55,lpq_mark),('Qiroati',19.45,qiroati_mark)]:
    obj=vertical_image('Logo banner '+name,(xx,-.485,3.01),.58,.58,mat);obj['banner_logo']=name
modern_text('Banner lembaga','LEMBAGA PENDIDIKAN AL-QUR\'AN',(18,-.49,3.29),.090)
modern_text('Banner nama','LPQ Al-Fath Maulana',(18,-.49,3.035),.172,bold=True)
modern_text('Banner lokasi','BATURAJA',(18,-.49,2.77),.115,bold=True)

scene['ground_floor_rooms']=5;scene['ground_floor_classrooms']=4;scene['upper_floor_classrooms']=4
scene['admin_room']=1;scene['shelf_depth']=.26;scene['upper_room_width']=3.3
scene['upper_room_lengths']=[5.5,5.4];scene['side_fence_closed']=True;scene['table_room']=1
print('REVISION 3 GEOMETRY READY',len(scene.objects))

# Stronger contrast for small lettering, shared across all nine rooms.
ink = material('Tipografi biru tua', (.006,.018,.035), .85)
for obj in scene.objects:
    if not obj.get('webExclude') and obj.type == 'FONT' and obj.name.startswith(('Nama LPQ','Kutipan','Atribusi','Banner nama','Banner lokasi')):
        obj.data.materials.clear(); obj.data.materials.append(ink)
for obj in scene.objects:
    if obj.get('tour_reveal') and not obj.get('webExclude'): obj.hide_render=False

# CAMERA_AND_EXPORT
route=[(0, (33, -36, 13.2), (8.5, 1.8, 3.2), 52), (0.04, (24, -19, 8), (9, 0, 2.5), 52), (0.07, (16.75, -6.3, 1.75), (18, -1, 1.7), 62), (0.085, (16.75, -4.5, 1.75), (19.15, -2, 1.7), 62), (0.1, (19.15, -4.05, 1.72), (19.15, -1.2, 1.7), 62), (0.12, (19.15, -1.2, 1.72), (18, 0.5, 1.7), 62), (0.14, (18, -1.15, 1.7), (18, 4, 1.5), 72), (0.16, (18.2, 0.8, 1.65), (17.25, 2.5, 1.1), 85), (0.175, (18.4, 1.55, 1.65), (18, 5.2, 1.4), 85), (0.185, (18, 0.4, 1.7), (18, 5.5, 1.5), 72), (0.195, (18, -1.2, 1.7), (7, -1.2, 1.7), 65), (0.21, (7, -1.2, 1.7), (2, 0.3, 1.65), 62), (0.23, (2, -0.8, 1.7), (2, 5.8, 1.7), 62), (0.26, (2, 0.55, 1.7), (2, 6.5, 1.55), 65), (0.31, (1.7, 1.2, 1.6), (2.1, 5.6, 1.02), 78), (0.35, (2, 0.5, 1.7), (2, 6.5, 1.6), 65), (0.38, (2, -1.3, 1.7), (-0.2, -1.3, 1.8), 62), (0.41, (-0.2, -1.3, 1.72), (-0.2, 0.7, 1.8), 62), (0.42, (-0.2, 0.7, 1.72), (-1.15, 0.7, 1.8), 62), (0.43, (-1.15, 0.65, 1.72), (-1.15, -3.8, 3.25), 62), (0.48, (-1.15, -2.0, 2.8), (-1.15, -4.1, 3.5), 62), (0.52, (-1.15, -4.25, 3.48), (-2.95, -3.0, 3.8), 65), (0.55, (-2.95, -4.25, 3.48), (-2.95, 0.5, 5.2), 65), (0.6, (-2.95, -1.9, 4.5), (-2.95, 0.8, 5.25), 62), (0.64, (-2.95, 0.8, 5.25), (-2.95, 1.8, 5.2), 62), (0.665, (-2.35, 0.9, 5.25), (5, 0.9, 5.25), 62), (0.695, (4.2, 0.9, 5.25), (4.2, 3.2, 5.25), 65), (0.72, (4.2, 3.45, 5.25), (1.8, 3.2, 5.05), 65), (0.75, (2.8, 3.45, 5.25), (-1.4, 3.5, 4.8), 72), (0.77, (2.5, 3.45, 5.2), (-1.4, 3.5, 4.8), 78), (0.8, (3.1, 3.45, 5.25), (-1.4, 3.5, 4.8), 72), (0.82, (4.2, 3.45, 5.25), (4.2, 0.9, 5.25), 65), (0.85, (4.2, 0.9, 5.25), (14, 0.9, 5.25), 62), (0.9, (12.9, 0.9, 5.25), (16.5, 4.2, 4.7), 65), (0.95, (17.5, 1.1, 5.3), (14.8, 4.4, 4.7), 76), (1, (18.3, 0.8, 5.5), (14.4, 4.9, 4.9), 80)]
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
export_scene=bpy.data.scenes.new('LPQ - Export Web Revisi 3')
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
manifest=json.loads((WEB/'lpq-building-tour.json').read_text(encoding='utf-8'))
convert=lambda v:[round(v[0],5),round(v[2],5),round(-v[1],5)]
manifest['stages'].insert(1, {'id':'admin','label':'Kantor admin','progress':.16}) if not any(x['id']=='admin' for x in manifest['stages']) else None
manifest['revision']=3
manifest['keyframes']=[{'progress':t,'position':convert(p),'target':convert(target),'fov':round(math.degrees(2*math.atan(math.tan(math.radians(fov)/2)/(1500/950))),4)} for t,p,target,fov in route]
doors=[o for o in active if o.get('classroom_door')]
ground=sorted([o for o in doors if o.get('classroom_door').startswith('Door_L1')],key=lambda o:o.location.x)
manifest['roomCounts']={'ground':len(ground),'upper':len(doors)-len(ground)}
manifest['layout'].update({'tableRoom':1,'sideFenceClosed':True,'adminRoom':1,'upperRoomWidth':3.3,'upperRoomLengths':[5.5,5.4],'shelfDepth':.26,'brandingPanels':sum(bool(o.get('brand_panel')) for o in active),'doorRacks':sum(bool(o.get('door_rack')) for o in active),'stairsClosedUnderneath':True})
manifest['roomUses']={'ground':{'1':'admin','2':'classroom','3':'classroom','4':'classroom','5':'classroom'},'upper':'four classrooms'}
(WEB/'lpq-building-tour.json').write_text(json.dumps(manifest,indent=2),encoding='utf-8')
bpy.context.window.scene=export_scene;dg=bpy.context.evaluated_depsgraph_get()
checks['sideFenceClosed']=ray((21,-2.4,.4),(-1,0,0),1)
checks['stairInnerSolid']=ray((-1.15,-2,.4),(1,0,0),1)
checks['stairOuterSolid']=ray((-2.95,-2,.8),(1,0,0),1)
checks['outerBlueWall']=ray((-4.2,-2,2),(1,0,0),.6)
report={'revision':3,'roomCounts':manifest['roomCounts'],'layout':manifest['layout'],'checks':checks,'cameraCollisions':collisions,'glbBytes':(WEB/'lpq-building.glb').stat().st_size,'exportMeshes':len(export_scene.objects),'backup':str(backup)}
(OUT/'model-validation-revision3.json').write_text(json.dumps(report,indent=2),encoding='utf-8')
bpy.context.window.scene=scene;scene.frame_set(1)
bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'lpq-al-fath-maulana-revisi-3.blend'))
assert manifest['roomCounts']=={'ground':5,'upper':4}
assert all(checks.values()) and not collisions
assert report['glbBytes'] < 12*1024*1024
print('R3 VALIDATION',report)
