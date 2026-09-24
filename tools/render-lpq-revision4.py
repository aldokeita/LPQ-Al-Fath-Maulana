import bpy,json,struct
bpy.context.window.scene=scene
scene.render.engine='CYCLES';scene.cycles.samples=24;scene.cycles.use_denoising=True
scene.render.resolution_x=1200;scene.render.resolution_y=760;scene.render.resolution_percentage=100;scene.render.image_settings.file_format='PNG'
for name,frame in [('exterior',1),('terrace',1001)]:
    for o in scene.objects:
        if o.get('tour_reveal') and not o.get('webExclude'):o.hide_render=name!='exterior'
    scene.frame_set(frame);scene.render.filepath=str(OUT/('R4-'+name+'.png'));bpy.ops.render.render(write_still=True)
for o in scene.objects:
    if o.get('tour_reveal') and not o.get('webExclude'):o.hide_render=False
scene.frame_set(1);scene.render.resolution_x=1500;scene.render.resolution_y=950;scene.cycles.samples=48
check_scene=bpy.data.scenes.new('R4 GLB roundtrip');bpy.context.window.scene=check_scene
bpy.ops.import_scene.gltf(filepath=str(WEB/'lpq-building.glb'))
meshes=[o for o in check_scene.objects if o.type=='MESH']
source=(WEB/'lpq-building.glb').read_bytes();document=json.loads(source[20:20+struct.unpack_from('<I',source,12)[0]])
expected=sum('mesh' in node for node in document['nodes'])
assert len(meshes)==expected
report=json.loads((OUT/'model-validation-revision4.json').read_text());report['roundtrip']={'success':True,'meshObjects':len(meshes),'expected':expected}
(OUT/'model-validation-revision4.json').write_text(json.dumps(report,indent=2))
bpy.context.window.scene=scene
textblock=bpy.data.texts.new('Revisi 4 source');textblock.write((ROOT/'tools/revise-lpq-building-v4.py').read_text())
bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'lpq-al-fath-maulana-revisi-4.blend'))
print('R4 RENDERS AND ROUNDTRIP COMPLETE')
