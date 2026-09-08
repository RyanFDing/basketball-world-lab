"""Focused pose math check; run in Blender against the supplied rest rig.
Uses the build's motion definitions without rebuilding the court or rendering.
"""
import ast, bpy, json, math
from pathlib import Path
from mathutils import Vector, Matrix, Quaternion
ROOT=Path(__file__).resolve().parents[1]
rig=bpy.data.objects['Athlete_Rig']
heads={b.name:b.head_local.copy() for b in rig.data.bones}
tails={b.name:b.tail_local.copy() for b in rig.data.bones}
def W(x,h,f):return Vector((x,-f,h))
source=(ROOT/'scripts/build_scene.py').read_text()
section=source[source.index('def interp('):source.index('for frame in range(1,362):')]
exec(compile(section,'motion definitions','exec'))
tree=ast.parse(source)
loop=next(n for n in tree.body if isinstance(n,ast.For) and ast.unparse(n.target)=='frame')
values={};rows=[]
def record(name,v):values.setdefault(name,[]).append(float(v))
def deg(a,b):return math.degrees(a.angle(b))
for frame in range(1,362):
 t=(frame-1)/60
 # Read the root's three scalar/vector assignments directly from the builder.
 for n in loop.body:
  if isinstance(n,ast.Assign) and ast.unparse(n.targets[0]) in ['drop','backward','shift']:
   exec(compile(ast.Module(body=[n],type_ignores=[]),'root motion','exec'))
 for side in ['R','L']:
  if side=='R':fwd,normal,along,curl,contact=shooting_grip(t);wrist=right_wrist(t)
  else:
   fwd,normal=guide_grip(t);wrist=attached_guide(min(t,guide_detach))
   if t>guide_brake:wrist.y=-quintic(-gw_brake.y,-gw_brake_v.y,0,guide_z_stop,0,0,guide_detach-guide_brake,(t-guide_brake)/(guide_detach-guide_brake))
   if t>guide_detach:wrist=quintic(gw_detach,gw_velocity,zero,gw_finish,zero,zero,.30,(t-guide_detach)/.30)
  lift=W(0,.095,.08)*ramp(.65,release,t)*(1 if side=='R' else .65)
  wrist+=W(0,-.008,-.025)*ramp(2.2,4.6,t)
  a=heads['upperarm01.'+side]+shift+lift;e0=heads['lowerarm01.'+side]
  e=arm_ik(a,wrist,(e0-heads['upperarm01.'+side]).length,(heads['wrist.'+side]-e0).length,W(.08 if side=='R' else .45,-1,.45),fwd,normal)
  u=(e-a).normalized();f=(wrist-e).normalized();h=fwd.normalized();n=normal.normalized();x=h.cross(n).normalized()
  out={'elbow':deg(u,f),'wristFlex':math.degrees(math.atan2(-f.dot(n),f.dot(h))),'deviation':math.degrees(math.asin(max(-1,min(1,f.dot(x))))),'shoulder':deg(u,W(0,-1,0)),'reach':(wrist-a).length}
  # Neutral forearm: thumb points along the elbow flexion direction; the palm
  # lies perpendicular to the hinge plane. Rotation is radioulnar, not wrist yaw.
  flexdir=(u-f*u.dot(f)).normalized()
  neutral=f.cross(flexdir).normalized()*(1 if side=='R' else -1)
  palm=h.rotation_difference(f)@n
  out['forearmRoll']=math.degrees(math.atan2(f.dot(neutral.cross(palm)),neutral.dot(palm)))
  hip=heads['upperleg01.'+side]+shift;ankle=heads['foot.'+side];k0=heads['lowerleg01.'+side]
  knee=ik(hip,ankle,(k0-heads['upperleg01.'+side]).length,(ankle-k0).length,W(0,0,1))
  out['knee']=deg(knee-hip,ankle-knee)
  out['ankleSagittal']=math.degrees(math.atan2(-(knee-ankle).y,(knee-ankle).z))
  for k,v in out.items():record(side+'.'+k,v)
  if frame in [1,19,37,55,64,70,76,84,93]:rows.append({'t':t,'side':side,**out})
summary={k:{'min':min(v),'max':max(v),'minTime':v.index(min(v))/60,'peakTime':v.index(max(v))/60} for k,v in values.items()}
(ROOT/'validation/anatomy-draft.json').write_text(json.dumps({'summary':summary,'poses':rows},indent=2))
print(json.dumps(summary,indent=2))
