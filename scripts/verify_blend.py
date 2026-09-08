"""Read-only reopen check. Run Blender -b 'deliverables/After Rain.blend' --python scripts/verify_blend.py."""
import bpy, json, math
from pathlib import Path
from mathutils import Vector
root=Path(__file__).resolve().parents[1]
scene=bpy.context.scene
rig=bpy.data.objects.get('Athlete_Rig')
assert rig and rig.type=='ARMATURE'
assert len(rig.data.bones)==163
assert rig.animation_data and rig.animation_data.action
assert scene.render.fps==60 and scene.frame_end==361
images=[i for i in bpy.data.images if i.source=='FILE']
assert all(i.packed_file or i.packed_files for i in images)
motion=json.loads((root/'public/assets/motion.json').read_text())
flight=json.loads((root/'public/assets/default-flight.json').read_text())
ball=next(o for o in scene.objects if o.name.startswith('Basketball / radius') and o.type=='MESH')
checks=[]
scene.frame_set(1)
def bounds(obj):
 evaluated=obj.evaluated_get(bpy.context.evaluated_depsgraph_get())
 mesh=evaluated.to_mesh()
 points=[evaluated.matrix_world@v.co for v in mesh.vertices]
 evaluated.to_mesh_clear()
 return [(min(p[i] for p in points),max(p[i] for p in points)) for i in range(3)]
court=bounds(next(o for o in scene.objects if o.name.startswith('Court asphalt')))
board=bounds(next(o for o in scene.objects if o.name.startswith('Backboard /')))
rim=bounds(next(o for o in scene.objects if o.name.startswith('Rim /')))
bb=bounds(ball)
measured={'courtWidth':court[0][1]-court[0][0],'courtLength':court[1][1]-court[1][0],'boardWidth':board[0][1]-board[0][0],'boardHeight':board[2][1]-board[2][0],'boardFrontZ':-board[1][1],'rimTop':rim[2][1],'ballDiameter':bb[0][1]-bb[0][0]}
expected={'courtWidth':15.24,'courtLength':28.6512,'boardWidth':1.8288,'boardHeight':1.0668,'boardFrontZ':4.572,'rimTop':3.048,'ballDiameter':.238}
for k,v in measured.items():assert abs(v-expected[k])<.0002,(k,v,expected[k])
release=motion['release'];release_frame=round(release*60)+1
for frame in [1,19,55,70,release_frame,release_frame+1,133,193,240,361]:
 scene.frame_set(frame)
 t=(frame-1)/60
 if t<release:p=motion['ballTrack'][frame-1]
 else:
  s=flight['samples'][min(len(flight['samples'])-1,round((t-release)*600))];p=[s['x'],s['y'],s['z']]
 actual=[ball.location.x,ball.location.z,-ball.location.y]
 err=max(abs(a-b) for a,b in zip(p,actual));assert err<1e-5
 assert all(math.isfinite(v) for b in rig.pose.bones for row in b.matrix for v in row)
 checks.append({'frame':frame,'time':t,'ballPositionErrorMetres':err})
report={'blender':bpy.app.version_string,'sceneReopened':True,'bones':len(rig.data.bones),'frames':[scene.frame_start,scene.frame_end],'fps':scene.render.fps,'packedImages':len(images),'cameraCount':sum(o.type=='CAMERA' for o in scene.objects),'measuredGeometryMetres':measured,'checks':checks}
(root/'validation/blender-reopen.json').write_text(json.dumps(report,indent=2))
print(json.dumps(report,indent=2))
