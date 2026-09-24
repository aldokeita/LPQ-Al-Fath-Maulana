"""Run in Blender's Text Editor to rebuild the editable scene and web export.

All dimensions are estimates. The two exterior photos describe visible geometry;
the classroom image supplies a conceptual interior style, not measured evidence.
The existing scene is preserved when this script creates its new LPQ scene.
"""
import bpy, math, json
from mathutils import Vector
from pathlib import Path
scene=bpy.data.scenes.new('LPQ Al-Fath Maulana - Konsep 3D')
bpy.context.window.scene=scene
scene.unit_settings.system='METRIC'
scene['reference_note']='Exterior from supplied photographs. Dimensions and all interiors are conceptual estimates.'
scene['ground_floor_classrooms']=5
scene['upper_floor_classrooms']=4
COL=None
MESH={}
def collection(name, evidence):
 global COL
 COL=bpy.data.collections.new(name); scene.collection.children.link(COL); COL['evidence']=evidence
 return COL
def material(name,color,rough=.6,metal=0):
 m=bpy.data.materials.new(name); m.diffuse_color=(*color,1); m.use_nodes=True
 p=m.node_tree.nodes.get('Principled BSDF'); p.inputs['Base Color'].default_value=(*color,1); p.inputs['Roughness'].default_value=rough; p.inputs['Metallic'].default_value=metal
 return m
blue=material('Cat biru fasad',(0.012,.32,.58)); white=material('Putih hangat',(.87,.86,.79)); cream=material('Dinding interior putih',(.79,.77,.70)); navy=material('Dado biru interior',(.038,.13,.27)); steel=material('Baja galvanis',(.47,.51,.52),.36,.65); dark=material('Besi pagar',(.065,.078,.083),.46,.55); glass=material('Kaca gelap',(.026,.06,.069),.18,.25); concrete=material('Beton halaman',(.39,.40,.36)); tile=material('Keramik terang',(.76,.77,.71),.36); wood=material('Kayu alami',(.44,.27,.12),.58); gold=material('Aksen emas',(.61,.41,.15),.4,.3); green=material('Daun',(.10,.26,.08)); soil=material('Tanah',(.08,.06,.035)); cloth=material('Jaring peneduh hitam',(.027,.033,.038),.96); cushion=material('Bantal biru',(.047,.10,.19)); paper=material('Kertas',(.76,.72,.60)); terracotta=material('Pot tanah',(.27,.17,.09)); stone=material('Pilar batu',(.43,.34,.25)); warm=material('Lampu hangat',(.98,.75,.38)); warm.node_tree.nodes.get('Principled BSDF').inputs['Emission Color'].default_value=(1,.72,.35,1); warm.node_tree.nodes.get('Principled BSDF').inputs['Emission Strength'].default_value=2
bookmats=[material('Buku '+str(i),c) for i,c in enumerate([(.03,.22,.19),(.40,.055,.06),(.12,.17,.35),(.39,.27,.05)])]
def box(name,loc,size,mat,rot=0):
 key=(tuple(round(v,5) for v in size),mat.name)
 if key not in MESH:
  sx,sy,sz=[v/2 for v in size]
  me=bpy.data.meshes.new(name+' mesh'); me.from_pydata([(-sx,-sy,-sz),(-sx,-sy,sz),(-sx,sy,-sz),(-sx,sy,sz),(sx,-sy,-sz),(sx,-sy,sz),(sx,sy,-sz),(sx,sy,sz)],[],[(2,6,4,0),(5,7,3,1),(4,5,1,0),(3,7,6,2),(1,3,2,0),(6,7,5,4)]); me.materials.append(mat); MESH[key]=me
 o=bpy.data.objects.new(name,MESH[key]); COL.objects.link(o); o.location=loc; o.rotation_euler.z=rot; return o
def beam(name,a,b,width,mat):
 a,b=Vector(a),Vector(b); o=box(name,(a+b)/2,(width,width,(b-a).length),mat); o.rotation_euler=(b-a).to_track_quat('Z','Y').to_euler(); return o
def cylinder(name,loc,radius,depth,mat,vertices=12):
 verts=[(radius*math.cos(i*2*math.pi/vertices),radius*math.sin(i*2*math.pi/vertices),z) for z in [-depth/2,depth/2] for i in range(vertices)]
 faces=[tuple(range(vertices-1,-1,-1)),tuple(range(vertices,vertices*2))]+[(i,(i+1)%vertices,(i+1)%vertices+vertices,i+vertices) for i in range(vertices)]
 me=bpy.data.meshes.new(name+' mesh'); me.from_pydata(verts,[],faces); me.materials.append(mat); o=bpy.data.objects.new(name,me); COL.objects.link(o); o.location=loc; return o
def text(name,body,loc,size,mat,rot=(math.pi/2,0,0)):
 d=bpy.data.curves.new(name,'FONT'); d.body=body; d.size=size; d.align_x='CENTER'; d.align_y='CENTER'; d.extrude=.001; d.materials.append(mat); o=bpy.data.objects.new(name,d); COL.objects.link(o); o.location=loc; o.rotation_euler=rot; return o
def frontwall(name,x0,x1,y,z,h,openings,mat):
 last=x0
 for cx,w,bottom,height in sorted(openings):
  lo,hi=cx-w/2,cx+w/2
  if lo>last: box(name+' pier',((last+lo)/2,y,z+h/2),(lo-last,.16,h),mat)
  if bottom>0: box(name+' sill',(cx,y,z+bottom/2),(w,.16,bottom),mat)
  if bottom+height<h: box(name+' lintel',(cx,y,z+(bottom+height+h)/2),(w,.16,h-bottom-height),mat)
  last=hi
 if last<x1: box(name+' pier',((last+x1)/2,y,z+h/2),(x1-last,.16,h),mat)
def frame(name,x,y,z,w,h):
 for dx in [-w/2,w/2]: box(name+' jamb',(x+dx,y,z+h/2),(.08,.22,h+.08),white)
 box(name+' head',(x,y,z+h),(w+.08,.22,.08),white)
def door(name,x,y,z,w=.98,h=2.25,angle=0):
 frame(name,x,y,z,w,h)
 hinge=Vector((x-w/2,y,z)); ang=math.radians(angle)
 pos=hinge+Vector((math.cos(ang)*w/2,math.sin(ang)*w/2,h/2))
 leaf=box(name,pos,(w-.06,.055,h-.04),white,ang); leaf['classroom_door']=name
 for zz in [.48,1.17,1.86]:
  px=hinge.x+math.cos(ang)*w/2; py=hinge.y+math.sin(ang)*w/2
  box(name+' panel',(px,py-.036,z+zz),(w-.19,.016,.42),cream,ang)
 return leaf
def roof(name,x0,x1,y0,y1,z0,z1,mat):
 n=int((x1-x0)/.09); verts=[]
 for i in range(n+1):
  x=x0+(x1-x0)*i/n; off=.035 if i%2 else 0
  verts.extend([(x,y0,z0+off),(x,y1,z1+off)])
 faces=[(2*i,2*i+2,2*i+3,2*i+1) for i in range(n)]
 me=bpy.data.meshes.new(name+' mesh'); me.from_pydata(verts,[],faces); me.materials.append(mat); o=bpy.data.objects.new(name,me); COL.objects.link(o); return o
collection('01 Bentuk teramati - Lantai 1','Two supplied exterior photos; five doors confirmed by user')
box('Tapak beton',(8,-.3,-.19),(28,19,.28),concrete)
box('Lantai satu',(10,3.7,-.035),(20,7.4,.15),tile)
box('Lantai selasar',(8.1,-2.35,-.065),(24,4.7,.12),concrete)
box('Tepi keramik selasar',(10,-.6,.016),(20,1.2,.04),tile)
box('Dinding belakang',(10,7.4,1.72),(20,.20,3.44),blue)
for x in [0,4,8,12,16,20]: box('Dinding ruang L1',(x,3.7,1.72),(.16,7.4,3.44),blue)
for i in range(5):
 x=i*4; openings=[(x+.68,.52,.35,1.8),(x+2,.98,0,2.25),(x+3.33,.52,.35,1.8)]
 frontwall('Fasad L1 '+str(i+1),x,x+4,0,0,3.44,openings,blue)
 door('Door_L1_'+str(i+1),x+2,-.01,0,angle=-105 if i in [0,2,4] else 0)
 for xx in [x+.68,x+3.33]:
  frame('Jendela',xx,-.025,.35,.52,1.8); box('Kaca jendela',(xx,.015,1.25),(.44,.035,1.69),glass)
  for vz in [.77,1.26,1.75]: box('Teralis',(xx,-.055,vz),(.44,.025,.022),dark)
 for xx in [x+.5,x+1.25,x+2.7,x+3.5]:
  box('Bingkai ventilasi',(xx,-.096,2.77),(.22,.04,.44),white); box('Lubang ventilasi',(xx,-.125,2.77),(.115,.012,.32),glass)
 box('Nomor ruang',(x+2,-.16,2.48),(.28,.025,.15),navy); text('Nomor',str(i+1),(x+2,-.179,2.48),.11,white)
box('Pelat lantai dua',(10,3.7,3.51),(20.25,7.6,.22),white)
box('Balok fasad putih',(10,-.19,3.51),(20.3,.4,.40),white)
for x in [0,4,8,12,16,20]: box('Konsol beton',(x,-.52,3.25),(.25,1.0,.24),white)
for x in [7,15]:
 box('Outdoor AC',(x,-.30,2.99),(1.0,.38,.62),white)
 fan=cylinder('Kipas AC',(x-.16,-.515,3.0),.22,.03,dark,24); fan.rotation_euler.x=math.pi/2
 for a in range(8): beam('Kisi AC',(x-.16-.20*math.cos(a*math.pi/4),-.54,3-.20*math.sin(a*math.pi/4)),(x-.16+.20*math.cos(a*math.pi/4),-.54,3+.20*math.sin(a*math.pi/4)),.012,steel)
box('Papan nama lembaga',(17.8,-.41,3.02),(3.6,.06,.82),white)
text('Nama lembaga',"LEMBAGA PENDIDIKAN AL-QUR'AN",(17.8,-.455,3.17),.125,navy)
text('Nama lokasi','AL-FATH MAULANA BATURAJA',(17.8,-.455,2.92),.145,navy)
collection('02 Bentuk teramati - tangga','Left switchback stair reconstructed from photo 2')
for flight,(xx,start,end) in enumerate([(-2.95,.35,-3.85),(-1.15,-3.85,.35)]):
 for j in range(12):
  y=start+(end-start)*(j+.5)/12; z=(flight*1.8)+(j+1)*.15
  box('Anak tangga', (xx,y,z/2 if flight==0 else z-.10),(1.45,abs(end-start)/12+.015,z if flight==0 else .20),white)
  box('Lis anak tangga',(xx,y-(.15 if flight==0 else -.15),z+.008),(1.45,.04,.02),blue)
 for side in [-.74,.74]:
  a=(xx+side,start,flight*1.8+.95); b=(xx+side,end,(flight+1)*1.8+.95)
  beam('Handrail',a,b,.045,steel)
  for j in range(5):
   t=j/4; yy=start+(end-start)*t; zz=flight*1.8+1.8*t
   beam('Tiang railing',(xx+side,yy,zz+.08),(xx+side,yy,zz+.95),.045,dark)
  for dz in [.26,.51,.75]: beam('Palang railing',(xx+side,start,flight*1.8+dz),(xx+side,end,(flight+1)*1.8+dz),.024,steel)
box('Bordes putar',(-2.05,-4.3,1.70),(3.3,1.0,.20),blue)
box('Bordes atas',(-1.03,.87,3.50),(1.7,1.0,.20),white)
box('Akses koridor lantai dua',(-.65,2.55,3.50),(1.25,3.4,.20),white)
beam('Pengaman bordes',(-3.7,-4.8,2.72),(-.4,-4.8,2.72),.05,steel)
for yy in [1.5,2.5,3.5]: beam('Pengaman akses',(-1.25,yy,3.6),(-1.25,yy,4.6),.04,steel)
beam('Handrail akses',(-1.25,1.15,4.6),(-1.25,4.25,4.6),.05,steel)
collection('03 Interpretasi - empat kelas lantai dua','Two classrooms on each side of a central corridor, as requested')
for yy in [0,7.4]: box('Dinding luar L2',(6,yy,5.02),(12,.18,2.82),blue)
for xx in [0,6,12]:
 for cy,dep in [(1.5,3.0),(5.95,2.9)]: box('Pemisah kelas L2',(xx,cy,5.02),(.16,dep,2.82),cream)
for side,(yy,ang) in enumerate([(3,-105),(4.5,105)]):
 for i in range(2):
  xx=6*i
  frontwall('Dinding koridor',xx,xx+6,yy,3.6,2.82,[(xx+3,.98,0,2.25)],cream)
  door('Door_L2_'+str(side*2+i+1),xx+3,yy,3.6,angle=ang)
  for x in [xx+1.0,xx+4.8]:
   box('Jendela L2',(x,-.105 if side==0 else 7.505,5.15),(.64,.03,1.05),glass)
   frame('Bingkai L2',x,-.12 if side==0 else 7.52,4.6,.68,1.1)
box('Atap kelas',(6,3.7,6.46),(12.3,7.7,.12),white)
for yy in [-.1,7.5]: box('Parapet putih',(6,yy,6.67),(12.35,.16,.35),white)
collection('04 Bentuk teramati - atap dan rangka','Exterior canopy, white fascia, steel trusses and taller right roof')
roof('Atap selasar',-4,20.65,-4.95,.1,4.82,5.64,white)
for x in [-3.65,.1,4.1,8.1,12.1,16.1,20.25]:
 beam('Kuda-kuda atas',(x,-4.8,4.8),(x,0,5.6),.07,steel); beam('Kuda-kuda bawah',(x,-4.8,4.68),(x,0,4.68),.07,steel)
 for j in range(4):
  y=-4.8+j*1.2; beam('Diagonal rangka',(x,y,4.69),(x,y+1.2,4.8+(j+1)*.2),.047,steel)
for y in [-4.8,-3.6,-2.4,-1.2,0]: beam('Gording',(-4,y,4.82+(y+4.8)/4.8*.8),(20.5,y,4.82+(y+4.8)/4.8*.8),.055,steel)
box('Fascia putih depan',(8.3,-4.99,4.60),(24.6,.075,.48),white)
for x in [-3.7,3.8,11.8,20.3]: box('Tiang kanopi',(x,-4.8,2.4),(.095,.095,4.8),steel)
for x in [-3.7,3.8,11.8]: box('Kaki tiang batu',(x,-4.8,.65),(.30,.30,1.30),stone)
roof('Atap tinggi depan',11.75,20.6,-.35,3.7,6.92,7.84,steel)
roof('Atap tinggi belakang',11.75,20.6,3.7,7.75,7.84,6.92,steel)
for x in [12,16,20.2]:
 for yy in [0,7.4]: box('Tiang ruang semi indoor',(x,yy,5.32),(.09,.09,3.44),steel)
 beam('Kuda-kuda teras',(x,-.2,6.88),(x,3.7,7.80),.06,steel); beam('Kuda-kuda teras',(x,3.7,7.80),(x,7.6,6.88),.06,steel); beam('Ikat teras',(x,0,6.87),(x,7.4,6.87),.055,steel)
collection('05 Peneduh yang dapat dibuka','Black shade cloth visible in photo 1; reveal during interior tour')
for yy in [0,7.4]:
 box('Parapet teras',(16.1,yy,4.12),(8.2,.16,1.05),blue)
 o=box('SHADE_upper_'+str(yy),(16.1,yy,5.80),(8.15,.022,2.23),cloth); o['tour_reveal']=True
box('Parapet sisi teras',(20.1,3.7,4.12),(.16,7.4,1.05),blue)
o=box('SHADE_upper_right',(20.11,3.7,5.80),(.02,7.4,2.23),cloth); o['tour_reveal']=True
box('SHADE_porch_left',(1.2,-4.87,3.05),(5.0,.02,2.60),cloth)
collection('06 Bentuk teramati - pagar','Dark metal railings, masonry posts, open access to porch')
for lo,hi in [(-3.8,3.7),(4,11.65),(14.3,20.4)]:
 for z in [.18,1.65]: box('Palang pagar',((lo+hi)/2,-5.1,z),(hi-lo,.08,.085),dark)
 box('Panel bawah pagar',((lo+hi)/2,-5.1,.36),(hi-lo,.05,.52),dark)
 for j in range(int((hi-lo)/.14)+1): box('Bilah pagar',(lo+j*.14,-5.1,1.04),(.025,.034,1.22),dark)
 cx=(lo+hi)/2
 for sign in [-1,1]:
  beam('Ornamen pagar',(cx-.35,-5.16,1.03),(cx,-5.16,1.03+sign*.39),.035,steel); beam('Ornamen pagar',(cx,-5.16,1.03+sign*.39),(cx+.35,-5.16,1.03),.035,steel)
print('LPQ: struktur, sembilan pintu, tangga, atap dan pagar selesai. Objects:',len(scene.objects))
def image_material(name,n,pixel):
 im=bpy.data.images.new(name,width=n,height=n,alpha=True); values=[]
 for j in range(n):
  for i in range(n): values.extend(pixel(i/n,j/n))
 im.pixels.foreach_set(values); im.pack(); m=material(name,(1,1,1)); tex=m.node_tree.nodes.new('ShaderNodeTexImage'); tex.image=im; m.node_tree.links.new(tex.outputs['Color'],m.node_tree.nodes.get('Principled BSDF').inputs['Base Color']); return m
def rug_pixel(u,v):
 edge=min(u,1-u,v,1-v); base=(.045,.13,.245,1); gilt=(.72,.59,.32,1)
 if edge<.012 or .034<edge<.043 or .10<edge<.107: return gilt
 if .045<edge<.095:
  a=(u*34)%1-.5; b=(v*52)%1-.5
  if abs(abs(a)+abs(b)-.42)<.085: return gilt
 a=(u*13)%1-.5; b=(v*23)%1-.5
 if abs(abs(a)+abs(b)-.43)<.025: return (.18,.29,.39,1)
 return base
rug=image_material('Karpet geometri biru emas',512,rug_pixel)
def tile_pixel(u,v):
 if u<.012 or v<.012: return (.52,.54,.51,1)
 return (.83,.83,.79,1)
tiles=image_material('Nat keramik',128,tile_pixel)
def plane(name,loc,w,d,mat,uvscale=(1,1)):
 me=bpy.data.meshes.new(name+' mesh'); me.from_pydata([(-w/2,-d/2,0),(w/2,-d/2,0),(w/2,d/2,0),(-w/2,d/2,0)],[],[(0,1,2,3)]); me.materials.append(mat); uv=me.uv_layers.new(name='UVMap')
 for k,co in enumerate([(0,0),(uvscale[0],0),uvscale,(0,uvscale[1])]): uv.data[k].uv=co
 o=bpy.data.objects.new(name,me); COL.objects.link(o); o.location=loc; return o
def plant(x,y,z,scale=1):
 cylinder('Pot tanaman',(x,y,z+.22*scale),.18*scale,.44*scale,white)
 cylinder('Tanah pot',(x,y,z+.445*scale),.16*scale,.02,soil)
 for i in range(7):
  a=i*2.4; h=(.55+.11*(i%4))*scale
  beam('Daun tegak',(x,y,z+.42*scale),(x+math.cos(a)*.15*scale,y+math.sin(a)*.15*scale,z+.42*scale+h),.055*scale,green)
def furniture(name,x0,y0,z,w,d,direction=1):
 collection(name,'Interior concept from supplied design image; not measured documentation')
 def p(x,y,zz): return (x0+x,y0+direction*y,z+zz)
 def b(n,x,y,zz,sx,sy,sz,m): return box(n,p(x,y,zz),(sx,sy,sz),m)
 plane('Lantai keramik',p(w/2,d/2,.065),w-.18,d-.15,tiles,(w/.6,d/.6))
 for x in [.095,w-.095]:
  b('Dinding dalam putih',x,d/2,1.83,.026,d-.18,1.46,cream)
  b('Dado biru',x,d/2,.62,.031,d-.18,1.08,navy)
  b('Lis dinding',x,d/2,1.19,.046,d-.18,.04,white)
 b('Dinding belakang dalam',w/2,d-.095,1.83,w-.18,.026,1.46,cream)
 b('Dado belakang',w/2,d-.11,.62,w-.18,.035,1.08,navy)
 b('Lis belakang',w/2,d-.12,1.19,w-.18,.035,.04,white)
 h=3.31 if z==0 else 2.74
 b('Plafon',w/2,d/2,h,w-.18,d-.18,.045,cream)
 for x in [.19,w-.19]: b('Cahaya cove',x,d/2,h-.06,.035,d-.38,.032,warm)
 b('Cahaya belakang',w/2,d-.19,h-.06,w-.38,.035,.032,warm)
 rw=w-1.15; rd=max(d-1.05,1.6)
 plane('Karpet belajar',p(w/2-.23,d/2,.09),rw,rd,rug)
 b('Meja pengajar',w/2-.15,d-.78,.53,1.1,.56,.045,white)
 for dx in [-.43,.43]:
  for dy in [-.20,.20]: b('Kaki meja',w/2-.15+dx,d-.78+dy,.30,.046,.046,.46,wood)
 rows=3 if d>4 else 1
 for row in range(rows):
  yy=.93+row*1.27
  for xx in [w*.28,w*.57]:
   o=b('Bantal duduk',xx,yy,.145,.57,.48,.11,cushion); mod=o.modifiers.new('Tepi kain lembut','BEVEL');mod.width=.045;mod.segments=2
 sx=w-.44; sy=d/2; sh=1.04; sw=.68; sd=min(2.0,d-1)
 b('Rak alas',sx,sy,.13,sw,sd,.065,wood); b('Rak atas',sx,sy,sh,sw,sd,.065,wood)
 for yy in [sy-sd/2,sy,sy+sd/2]: b('Rak sekat',sx,yy,.59,sw,.045,.9,wood)
 b('Rak tengah',sx,sy,.57,sw,sd,.045,wood)
 for j in range(7):
  yy=sy-sd*.4+j*.095
  b('Buku belajar',sx,yy,1.22,.21,.065,.31,bookmats[j%4]); b('Halaman buku',sx-.013,yy,1.22,.19,.046,.28,paper)
 plant(*p(w-.45,d-.46,0),.65)
 b('Bingkai geometri',w*.26,d-.15,2.03,.68,.035,.78,gold)
 b('Isi bingkai',w*.26,d-.175,2.03,.61,.02,.70,navy)
 for a in range(4):
  aa=a*math.pi/2; ab=(a+1)*math.pi/2
  beam('Motif bintang',p(w*.26+.19*math.cos(aa),d-.196,2.03+.24*math.sin(aa)),p(w*.26+.19*math.cos(ab),d-.196,2.03+.24*math.sin(ab)),.013,gold)
 text('Identitas kelas','AL-FATH MAULANA',p(w*.61,d-.17,2.13),min(.15,w*.028),navy,(math.pi/2 if direction==1 else -math.pi/2,0,0))
 f=cylinder('Kipas dinding',p(.17,.68,2.45),.25,.055,dark,24); f.rotation_euler.y=math.pi/2
 for j in range(5):
  a=j*math.pi*2/5; beam('Kisi kipas',p(.21,.68-.24*math.cos(a),2.45-.24*math.sin(a)),p(.21,.68+.24*math.cos(a),2.45+.24*math.sin(a)),.013,steel)
 ld=bpy.data.lights.new('Lampu ruang','AREA'); ld.energy=100 if z else 220;ld.shape='RECTANGLE';ld.size=w*.7;ld.size_y=d*.7;lo=bpy.data.objects.new('Lampu ruang',ld);COL.objects.link(lo);lo.location=p(w/2,d/2,h-.14)
for i in range(5): furniture('07 Interior konsep - L1 kelas '+str(i+1),i*4,0,0,4,7.4)
for i in range(2):
 furniture('08 Interior konsep - L2 kelas '+str(i+1),i*6,3,3.6,6,3,-1)
 furniture('08 Interior konsep - L2 kelas '+str(i+3),i*6,4.5,3.6,6,2.9,1)
collection('09 Interior konsep - ruang mengajar semi indoor','Imagined learning terrace to the right of the upstairs classrooms')
plane('Lantai teras',(16.05,3.7,3.64),7.95,7.2,tiles,(13,12))
plane('Karpet teras',(16.2,3.9,3.67),5.6,4.6,rug)
for x in [14.3,16.3,18.3]:
 box('Meja rendah teras',(x,4.2,4.12),(1.05,.65,.07),wood)
 for dx in [-.42,.42]:
  for dy in [-.25,.25]:box('Kaki meja teras',(x+dx,4.2+dy,3.9),(.06,.06,.48),wood)
 for yy in [3.4,4.9]:box('Bantal teras',(x,yy,3.74),(.64,.52,.13),cushion)
for x in [13,19.25]:plant(x,6.65,3.6,1.2)
box('Rak teras',(16.2,7.1,4.0),(3.0,.43,.8),wood)
for i in range(18):box('Buku teras',(14.9+i*.14,6.85,4.55),(.085,.20,.31),bookmats[i%4])
collection('10 Kelengkapan selasar','Low detail props informed by photos')
for x in [1,3,15.6,19.2]:plant(x,-4.55,.02,.75)
box('Meja kayu selasar',(13.1,-3.0,.77),(2.1,.82,.11),wood)
for x in [12.4,13.8]:box('Kaki meja selasar',(x,-3.0,.40),(.16,.55,.75),wood)
for yy in [-3.72,-2.3]:
 box('Bangku selasar',(13.1,yy,.45),(2.25,.36,.09),wood)
 for x in [12.3,13.9]:box('Kaki bangku',(x,yy,.24),(.12,.26,.42),wood)
for x in [1,5,9,13,17]:
 beam('Kabel lampu',(x,-2.6,5.14),(x,-2.6,4.88),.015,dark)
 cylinder('Bohlam gantung',(x,-2.6,4.82),.045,.10,warm)
collection('11 Kamera dan pencahayaan','Presentation only')
world=bpy.data.worlds.new('Langit lembut');world.use_nodes=True;world.node_tree.nodes.get('Background').inputs[0].default_value=(.62,.76,.88,1);world.node_tree.nodes.get('Background').inputs[1].default_value=.45;scene.world=world
ld=bpy.data.lights.new('Matahari','SUN');ld.energy=2.0;ld.angle=.12;lo=bpy.data.objects.new('Matahari',ld);COL.objects.link(lo);lo.rotation_euler=(.42,-.6,-.5)
ld=bpy.data.lights.new('Fill selasar','AREA');ld.energy=2200;ld.shape='RECTANGLE';ld.size=18;ld.size_y=6;lo=bpy.data.objects.new('Fill selasar',ld);COL.objects.link(lo);lo.location=(9,-6,8);lo.rotation_euler=(.35,0,0)
cd=bpy.data.cameras.new('Kamera tur');cam=bpy.data.objects.new('Kamera tur',cd);COL.objects.link(cam);scene.camera=cam;cd.lens=32;cd.clip_start=.06;cd.clip_end=180
cam.location=(30,-31,15);cam.rotation_euler=(Vector((8.5,1.1,2.7))-cam.location).to_track_quat('-Z','Y').to_euler()
scene.render.engine='CYCLES';scene.cycles.samples=24;scene.cycles.use_denoising=True;scene.render.resolution_x=1500;scene.render.resolution_y=950;scene.render.resolution_percentage=100
scene.view_settings.view_transform='AgX'
print('LPQ interior lengkap. Total objek',len(scene.objects))
collection('12 Jalur kamera','Native scroll tour waypoints; Blender XYZ converted to glTF Y-up on export')
route=[
(0,(30,-31,15),(8.5,1.1,2.7),50),
(.065,(20,-17,8),(9,0,2.5),52),
(.12,(12.5,-6.2,1.75),(9,-.5,1.7),62),
(.15,(12.5,-4.15,1.75),(7,-1.2,1.8),62),
(.19,(7,-1.5,1.7),(2,.3,1.65),62),
(.23,(2,-1.25,1.7),(2,5.8,1.7),62),
(.26,(2,.55,1.7),(2,6.5,1.55),65),
(.31,(2,2.6,1.7),(2,6.5,1.6),65),
(.35,(2,.5,1.7),(2,6.5,1.6),65),
(.39,(2,-1.25,1.7),(-2,-.1,2.1),62),
(.43,(-2.95,-.45,2.0),(-2.95,-3.8,3.25),62),
(.48,(-2.95,-2.0,2.8),(-2.3,-4.1,3.5),62),
(.52,(-2.95,-4.25,3.48),(-1.15,-3.0,3.8),65),
(.55,(-1.15,-4.25,3.48),(-1.15,.5,5.2),65),
(.60,(-1.15,-1.9,4.5),(-1.15,1.5,5.3),62),
(.64,(-.65,.9,5.25),(-.65,3.75,5.25),62),
(.68,(-.65,3.75,5.25),(5,3.75,5.25),62),
(.72,(3,3.75,5.25),(3,1,5.1),62),
(.77,(3,2.0,5.25),(3,.3,5.05),68),
(.81,(3,3.75,5.25),(12,3.75,5.1),62),
(.87,(10.8,3.75,5.25),(16,4,4.5),62),
(.93,(14,2.4,5.25),(17,4.3,4.45),65),
(1,(15.8,1.35,5.45),(16.9,4.8,4.3),65)]
scene.frame_start=1;scene.frame_end=1001
for t,pos,target,fov in route:
 frame_num=1+round(t*1000);cam.location=pos;cam.rotation_euler=(Vector(target)-Vector(pos)).to_track_quat('-Z','Y').to_euler();cam.data.angle=math.radians(fov);cam.keyframe_insert(data_path='location',frame=frame_num);cam.keyframe_insert(data_path='rotation_euler',frame=frame_num);cam.data.keyframe_insert(data_path='lens',frame=frame_num)
for name,frame_num in [('Fasad',1),('Kelas lantai 1',311),('Tangga',551),('Kelas lantai 2',771),('Semi indoor',1001)]:scene.timeline_markers.new(name,frame=frame_num)
scene.frame_set(1)
output=Path('D:/Project/LPQ Al-Fath Maulana 3D');output.mkdir(parents=True,exist_ok=True)
scene.render.filepath=str(output/'01-fasad.png')
scene['master_output']=str(output)
print('Kamera tur: 23 titik. Scene siap diperiksa.')
collection('13 Detail fasad','Small details visible on the supplied exterior photos')
box('Jendela sisi kanan',(20.106,2.9,1.5),(.03,.48,1.82),glass)
for yy in [2.62,3.18]:box('Kusen samping',(20.13,yy,1.5),(.06,.06,1.9),white)
for zz in [.55,2.45]:box('Kusen samping',(20.13,2.9,zz),(.06,.61,.06),white)
for yy in [1,2.3,3.6,4.9,6.2]:box('Ventilasi samping',(20.20,yy,4.34),(.035,.13,.38),white)
beam('Pipa air hujan',(20.3,-.15,5.55),(20.3,-.15,.15),.065,white)
for xx in [4,11.8]:
 for zz in [.15,.4,.65,.9,1.15]:
  for dx in [-.075,.075]:box('Pecahan batu pilar',(xx+dx,-4.963,zz),(.12,.022,.16),white if int(zz*10)%2 else terracotta)
weave=image_material('Anyaman jaring',64,lambda u,v: ((.13,.145,.15,.87) if (int(u*64)%4<2 or int(v*64)%4<2) else (.085,.095,.105,.50)))
nt=weave.node_tree;tx=next(n for n in nt.nodes if n.type=='TEX_IMAGE');nt.links.new(tx.outputs['Alpha'],nt.nodes.get('Principled BSDF').inputs['Alpha']);weave.surface_render_method='DITHERED'
for ob in list(scene.objects):
 if not ob.name.startswith('SHADE_'):continue
 sx,sy,sz=ob.dimensions;side=sx<.1;ww=sy if side else sx;hh=sz;verts=[];faces=[];nx=30;nz=14
 for j in range(nz+1):
  v=j/nz
  for i in range(nx+1):
   u=i/nx;off=.035*math.sin(u*math.pi*13)*math.sin(v*math.pi)+.015*math.sin(v*18+u*11)
   verts.append((off,(u-.5)*ww,(v-.5)*hh) if side else ((u-.5)*ww,off,(v-.5)*hh))
 for j in range(nz):
  for i in range(nx):
   k=j*(nx+1)+i;faces.append((k,k+1,k+nx+2,k+nx+1))
 me=bpy.data.meshes.new(ob.name+' drape');me.from_pydata(verts,[],faces);me.materials.append(weave);uv=me.uv_layers.new()
 for poly in me.polygons:
  for li in poly.loop_indices:
   vi=me.loops[li].vertex_index;uv.data[li].uv=((vi%(nx+1))/nx*ww*6,(vi//(nx+1))/nz*hh*6)
 ob.data=me
me=bpy.data.meshes.new('Gable shade mesh');me.from_pydata([(20.13,0,6.92),(20.13,7.4,6.92),(20.13,3.7,7.75)],[],[(0,1,2)]);me.materials.append(cloth);o=bpy.data.objects.new('SHADE_upper_gable',me);COL.objects.link(o);o['tour_reveal']=True
route[0]=(0,(30,-31,10.5),(8.5,1.1,3.15),50)
cam.location=route[0][1];cam.rotation_euler=(Vector(route[0][2])-cam.location).to_track_quat('-Z','Y').to_euler();cam.keyframe_insert(data_path='location',frame=1);cam.keyframe_insert(data_path='rotation_euler',frame=1)
scene.frame_set(1);scene.render.film_transparent=True;scene.cycles.samples=48
scene.render.image_settings.file_format='PNG';scene.render.image_settings.color_mode='RGBA'
print('Detail fasad dan bahan peneduh diperbarui.')
for c in scene.collection.children:
 if not (c.name.startswith('07 ') or c.name.startswith('08 ')):continue
 base=0 if c.name.startswith('07 ') else 3.6;h=3.31 if base==0 else 2.74
 for o in c.objects:
  if o.name.startswith('Dinding dalam putih') or o.name.startswith('Dinding belakang dalam'):
   o.location.z=base+(1.16+h)/2;o.dimensions.z=h-1.16
for o in scene.objects:
 if not o.name.startswith('Daun tegak'):continue
 length=o.dimensions.z;me=bpy.data.meshes.new('Daun runcing');me.from_pydata([(0,0,-length/2),(-.045,.004,-length*.15),(-.037,.013,length*.25),(0,0,length/2),(.037,.013,length*.25),(.045,.004,-length*.15)],[],[(0,1,2,3,4,5)]);me.materials.append(green);o.data=me
route[7]=(.31,(1.7,1.2,1.60),(2.1,5.6,1.02),78)
route[18]=(.77,(3,2.5,5.15),(3,.55,4.2),80)
for idx in [7,18]:
 t,pos,target,fov=route[idx];fr=round(t*1000)+1;cam.location=pos;cam.rotation_euler=(Vector(target)-Vector(pos)).to_track_quat('-Z','Y').to_euler();cam.data.angle=math.radians(fov);cam.keyframe_insert(data_path='location',frame=fr);cam.keyframe_insert(data_path='rotation_euler',frame=fr);cam.data.keyframe_insert(data_path='lens',frame=fr)
scene.frame_set(1)
route[18]=(.77,(3,2.65,5.15),(4.2,.8,4.65),85)
t,pos,target,fov=route[18];cam.location=pos;cam.rotation_euler=(Vector(target)-Vector(pos)).to_track_quat('-Z','Y').to_euler();cam.data.angle=math.radians(fov);cam.keyframe_insert(data_path='location',frame=771);cam.keyframe_insert(data_path='rotation_euler',frame=771);cam.data.keyframe_insert(data_path='lens',frame=771)
COL=bpy.data.collections.get('11 Kamera dan pencahayaan');ld=bpy.data.lights.new('Cahaya lembut teras','AREA');ld.energy=950;ld.shape='RECTANGLE';ld.size=6;ld.size_y=5;lo=bpy.data.objects.new('Cahaya lembut teras',ld);COL.objects.link(lo);lo.location=(16.1,3.7,6.6)
scene.frame_set(1)
refs=collection('00 Referensi pengguna','Original supplied images; hidden from model renders and web export')
for filepath in ['C:/Users/ALDO/Pictures/Bangunan LPQ.png','C:/Users/ALDO/Downloads/PXL_20260407_025707295.jpg','C:/Users/ALDO/Downloads/ChatGPT Image Sep 24, 2026, 06_52_12 PM.png']:
 if Path(filepath).exists():
  im=bpy.data.images.load(filepath,check_existing=True);im.pack();ob=bpy.data.objects.new(Path(filepath).stem,None);refs.objects.link(ob);ob.empty_display_type='IMAGE';ob.data=im;ob.hide_render=True
refs.hide_viewport=True;refs.hide_render=True
from collections import defaultdict
for owner in [cam,cam.data]:
 action=owner.animation_data.action
 curves=list(action.fcurves) if hasattr(action,'fcurves') else [fc for layer in action.layers for strip in layer.strips for bag in strip.channelbags for fc in bag.fcurves]
 for fc in curves:
  for kp in fc.keyframe_points:kp.interpolation='LINEAR'
scene.frame_set(1)
for ob in scene.objects:
 if ob.get('tour_reveal'):
  ob.hide_render=False;ob.keyframe_insert(data_path='hide_render',frame=1)
  ob.hide_render=True;ob.keyframe_insert(data_path='hide_render',frame=730)
scene.frame_set(1)
dg=bpy.context.evaluated_depsgraph_get();collisions=[]
for i in range(len(route)-1):
 a=Vector(route[i][1]);b=Vector(route[i+1][1]);delta=b-a
 hit,where,normal,index,obj,matrix=scene.ray_cast(dg,a,delta.normalized(),distance=delta.length)
 if hit:collisions.append({'segment':i,'object':obj.name,'point':list(where)})
print('CAMERA_COLLISIONS',collisions)
export_scene=bpy.data.scenes.get('LPQ - Export Web') or bpy.data.scenes.new('LPQ - Export Web');buckets={}
for ob in list(scene.objects):
 if ob.type not in {'MESH','FONT','CURVE'}:continue
 ev=ob.evaluated_get(dg);me=ev.to_mesh();uv=me.uv_layers.active
 for poly in me.polygons:
  mat=me.materials[poly.material_index] if me.materials else white
  group='SHADE_REVEAL' if ob.get('tour_reveal') else 'BUILDING'
  key=(group,mat.name)
  if key not in buckets:buckets[key]={'vertices':[],'faces':[],'uv':[],'mat':mat}
  bucket=buckets[key];indices=[]
  for li in poly.loop_indices:
   indices.append(len(bucket['vertices']));bucket['vertices'].append(tuple(ob.matrix_world@me.vertices[me.loops[li].vertex_index].co));bucket['uv'].append(tuple(uv.data[li].uv) if uv else (0,0))
  bucket['faces'].append(tuple(indices))
 ev.to_mesh_clear()
for (group,name),bucket in buckets.items():
 me=bpy.data.meshes.new(group+' '+name);me.from_pydata(bucket['vertices'],[],bucket['faces']);me.materials.append(bucket['mat']);layer=me.uv_layers.new()
 for loop in me.loops:layer.data[loop.index].uv=bucket['uv'][loop.vertex_index]
 ob=export_scene.objects.get(group+' '+name)
 if ob:ob.data=me
 else:
  ob=bpy.data.objects.new(group+' '+name,me);export_scene.collection.objects.link(ob)
 ob['tourReveal']=group=='SHADE_REVEAL'
web=Path('D:/Project/LPQ Al-Fath Maulana/.codex-local/building-tour/public/models');web.mkdir(parents=True,exist_ok=True)
bpy.context.window.scene=export_scene
bpy.ops.export_scene.gltf(filepath=str(web/'lpq-building.glb'),export_format='GLB',export_extras=True,export_animations=False,export_cameras=False,export_lights=False,use_active_scene=True,export_yup=True)
bpy.context.window.scene=scene
convert=lambda v:[round(v[0],5),round(v[2],5),round(-v[1],5)]
manifest={'version':1,'conceptual':True,'units':'meters','upAxis':'Y','roomCounts':{'ground':5,'upper':4},'model':'/models/lpq-building.glb','stages':[{'id':'exterior','label':'Tampak depan','progress':0},{'id':'ground','label':'Kelas lantai 1','progress':.31},{'id':'stairs','label':'Tangga dan selasar','progress':.55},{'id':'upper','label':'Kelas lantai 2','progress':.77},{'id':'terrace','label':'Ruang semi indoor','progress':1}],'keyframes':[{'progress':t,'position':convert(pos),'target':convert(target),'fov':round(math.degrees(2*math.atan(math.tan(math.radians(fov)/2)/(1500/950))),4)} for t,pos,target,fov in route]}
(web/'lpq-building-tour.json').write_text(json.dumps(manifest,indent=2),encoding='utf-8')
report={'doors':[o.name for o in scene.objects if o.get('classroom_door')],'cameraCollisions':collisions,'exportMeshes':len(buckets),'glbBytes':(web/'lpq-building.glb').stat().st_size,'references':['Bangunan LPQ.png','PXL_20260407_025707295.jpg','ChatGPT Image Sep 24, 2026, 06_52_12 PM.png'],'dimensionsEstimated':True}
(output/'model-validation.json').write_text(json.dumps(report,indent=2),encoding='utf-8')
scene.frame_set(1);bpy.ops.wm.save_as_mainfile(filepath=str(output/'lpq-al-fath-maulana.blend'))
print('EXPORT_SAVED',report['glbBytes'],len(report['doors']),len(buckets))
