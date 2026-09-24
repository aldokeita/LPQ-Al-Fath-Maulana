import bpy
from pathlib import Path
scene=bpy.context.scene
assert scene.get('revision')==3
out=Path('D:/Project/LPQ Al-Fath Maulana 3D')
scene.render.engine='CYCLES'
scene.cycles.samples=24
scene.cycles.use_denoising=True
scene.render.resolution_x=1200
scene.render.resolution_y=760
scene.render.resolution_percentage=100
scene.render.image_settings.file_format='PNG'
for label,frame in [('exterior',1),('admin',161),('ground',311),('stairs',551),('upper',771),('terrace',1001)]:
    for obj in scene.objects:
        if obj.get('tour_reveal') and not obj.get('webExclude'): obj.hide_render=label!='exterior'
    scene.frame_set(frame)
    scene.render.filepath=str(out/('R3-'+label+'.png'))
    bpy.ops.render.render(write_still=True)
for obj in scene.objects:
    if obj.get('tour_reveal') and not obj.get('webExclude'): obj.hide_render=False
scene.frame_set(1)
scene.render.resolution_x=1500
scene.render.resolution_y=950
scene.cycles.samples=48
bpy.ops.wm.save_as_mainfile(filepath=str(out/'lpq-al-fath-maulana-revisi-3.blend'))
print('SIX R3 RENDERS COMPLETE')
