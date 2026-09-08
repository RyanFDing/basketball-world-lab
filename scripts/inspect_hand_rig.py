import bpy,json
from mathutils import Vector
rig=bpy.data.objects['Athlete_Rig']
def world(v):return [round(v.x,5),round(v.z,5),round(-v.y,5)]
for side in ['R','L']:
 heads={n:rig.data.bones[n+'.'+side].head_local for n in ['wrist','finger1-1','finger2-1','finger3-1','finger5-1','upperarm01','lowerarm01']}
 forward=(heads['finger3-1']-heads['wrist']).normalized()
 normal=forward.cross(heads['finger2-1']-heads['finger5-1']).normalized()
 print(side,json.dumps({'heads':{n:world(v) for n,v in heads.items()},'forward':world(forward),'crossNormal':world(normal)}))
