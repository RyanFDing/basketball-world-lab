"""Blender 5.x: reproducible CC0 athlete, authored shot, editable outdoor court.
Run: Blender -b --python scripts/build_scene.py
All world dimensions are metres. Blender coordinates: X across, -Y toward rim, Z up.
"""
import bpy, bmesh, math, json, os, sys, random, subprocess
from pathlib import Path
from mathutils import Vector, Matrix, Quaternion
ROOT=Path(__file__).resolve().parents[1]
subprocess.run(['node',str(ROOT/'scripts/export-physics.mjs')],check=True)
SRC=ROOT/'assets/source'; OUT=ROOT/'public/assets'; OUT.mkdir(parents=True,exist_ok=True)
(ROOT/'deliverables').mkdir(exist_ok=True)
random.seed(27)
bpy.ops.object.select_all(action='SELECT'); bpy.ops.object.delete(use_global=False)
sc=bpy.context.scene; sc.unit_settings.system='METRIC'; sc.unit_settings.scale_length=1
sc.render.fps=60; sc.frame_start=1; sc.frame_end=361
def W(x,h,f):return Vector((x,-f,h))
def smooth(obj):
 if obj.type=='MESH':
  for p in obj.data.polygons:p.use_smooth=True
 return obj
def material(name,color,rough=.5,metal=0,texture=None):
 m=bpy.data.materials.new(name);m.diffuse_color=(*color,1);m.use_nodes=True
 p=m.node_tree.nodes.get('Principled BSDF');p.inputs['Base Color'].default_value=(*color,1);p.inputs['Roughness'].default_value=rough;p.inputs['Metallic'].default_value=metal
 if texture:
  n=m.node_tree.nodes.new('ShaderNodeTexImage');n.image=bpy.data.images.load(str(texture));m.node_tree.links.new(n.outputs['Color'],p.inputs['Base Color'])
 return m
def mesh(name,vs,fs,mat,uvs=None):
 d=bpy.data.meshes.new(name);d.from_pydata(vs,[],fs);d.update();o=bpy.data.objects.new(name,d);sc.collection.objects.link(o)
 if mat:o.data.materials.append(mat)
 if uvs:
  uv=d.uv_layers.new(name='UVMap')
  for p,coords in zip(d.polygons,uvs):
   for i,co in zip(p.loop_indices,coords):uv.data[i].uv=co
 return o
def box(name,loc,scale,mat,bevel=0):
 bpy.ops.mesh.primitive_cube_add(size=1,location=loc);o=bpy.context.object;o.name=name;o.dimensions=scale;bpy.ops.object.transform_apply(location=False,rotation=False,scale=True);o.data.materials.append(mat)
 if bevel:
  m=o.modifiers.new('Soft manufactured edges','BEVEL');m.width=bevel;m.segments=3
  bpy.context.view_layer.objects.active=o;bpy.ops.object.modifier_apply(modifier=m.name)
  m=o.modifiers.new('Weighted corner normals','WEIGHTED_NORMAL')
 return o
def tube(name,pts,r,mat,cyclic=False):
 c=bpy.data.curves.new(name,'CURVE');c.dimensions='3D';c.resolution_u=1;c.bevel_depth=r;c.resolution_u=1;c.bevel_resolution=2
 p=c.splines.new('POLY');p.points.add(len(pts)-1)
 for v,co in zip(p.points,pts):v.co=(*co,1)
 p.use_cyclic_u=cyclic;o=bpy.data.objects.new(name,c);sc.collection.objects.link(o);o.data.materials.append(mat);return o
def uv_sphere(name,loc,scale,mat):
 bpy.ops.mesh.primitive_uv_sphere_add(segments=32,ring_count=20,location=loc);o=bpy.context.object;o.name=name;o.scale=scale;o.data.materials.append(mat);return smooth(o)
def read_obj(path):
 vs=[];uv=[];fs=[];fuv=[];groups=[];g=''
 for line in Path(path).read_text().splitlines():
  s=line.split()
  if not s:continue
  if s[0]=='v':vs.append(Vector(map(float,s[1:4])))
  elif s[0]=='vt':uv.append(tuple(map(float,s[1:3])))
  elif s[0]=='g':g=s[1]
  elif s[0]=='f':
   ids=[p.split('/') for p in s[1:]];fs.append([int(p[0])-1 for p in ids]);fuv.append([uv[int(p[1])-1] if len(p)>1 and p[1] else (0,0) for p in ids]);groups.append(g)
 return vs,fs,fuv,groups
base,faces,uvs,groups=read_obj(SRC/'base.obj');verts=[v.copy() for v in base]
for file,amount in [('male.target',1),('athletic.target',.65)]:
 for line in (SRC/file).read_text().splitlines():
  s=line.split()
  if s and s[0].isdigit():verts[int(s[0])]+=Vector(map(float,s[1:4]))*amount
body_ids=set(i for f,g in zip(faces,groups) if g=='body' for i in f)
lo=min(verts[i].y for i in body_ids); hi=max(verts[i].y for i in body_ids);scale=1.90/(hi-lo)
def conv(v):return Vector((v.x*scale,-v.z*scale+.30,(v.y-lo)*scale+.025))
vworld=[conv(v) for v in verts]
surface_normals=[Vector() for _ in verts]
for f,g in zip(faces,groups):
 if g!='body':continue
 n=(vworld[f[1]]-vworld[f[0]]).cross(vworld[f[2]]-vworld[f[0]]).normalized()
 for i in f:surface_normals[i]+=n
surface_normals=[n.normalized() if n.length>0 else Vector((0,0,1)) for n in surface_normals]
skel=json.loads((SRC/'default.mhskel').read_text());weights=json.loads((SRC/'default_weights.mhw').read_text())['weights']
def joint(key):return sum((vworld[i] for i in skel['joints'][key]),Vector())/len(skel['joints'][key])
bpy.ops.object.armature_add();rig=bpy.context.object;rig.name='Athlete_Rig';bpy.ops.object.mode_set(mode='EDIT');rig.data.edit_bones.remove(rig.data.edit_bones[0])
for name,b in skel['bones'].items():
 e=rig.data.edit_bones.new(name);e.head=joint(b['head']);e.tail=joint(b['tail'])
 if (e.tail-e.head).length<.0001:e.tail=e.head+Vector((0,0,.01))
for name,b in skel['bones'].items():
 if b['parent']:rig.data.edit_bones[name].parent=rig.data.edit_bones[b['parent']]
bpy.ops.object.mode_set(mode='OBJECT');rig.show_in_front=True
rest={b.name:b.matrix_local.copy() for b in rig.data.bones};heads={b.name:b.head_local.copy() for b in rig.data.bones};tails={b.name:b.tail_local.copy() for b in rig.data.bones}
weight_by_vertex=[{} for _ in verts]
for b,items in weights.items():
 for i,w in items:weight_by_vertex[i][b]=w
def skin_obj(o,vertex_weights):
 o.parent=rig;mod=o.modifiers.new('Athlete skin weights','ARMATURE');mod.object=rig
 vg={}
 for i,ws in enumerate(vertex_weights):
  total=sum(ws.values())
  for n,w in ws.items():
   if n not in vg:vg[n]=o.vertex_groups.new(name=n)
   if w>0:vg[n].add([i],w/max(total,1e-8),'REPLACE')
 return smooth(o)
skin=material('Skin / CC0 scanned diffuse',(.34,.17,.105),.55,texture=SRC/'system/skins/young_african_male/young_darkskinned_male_diffuse.png')
p=skin.node_tree.nodes.get('Principled BSDF');p.inputs['Subsurface Weight'].default_value=.075
cream=material('Ivory technical knit',(.63,.69,.66),.9);teal=material('Deep petrol woven shorts',(.025,.09,.105),.82);trim=material('Warm white piping',(.85,.78,.59),.64)
hairmat=material('Close cropped hair',(.013,.009,.007),.95)
def subset(name,indices,mat,offset=0,cloth=False):
 selected=sorted(set(i for j in indices for i in faces[j]));mapping={v:i for i,v in enumerate(selected)}
 coords=[]
 for i in selected:
  v=vworld[i].copy()
  if cloth:
   v+=surface_normals[i]*offset
   v.y+=math.sin(v.z*51+v.x*38)*.0025
  elif offset:v+=Vector((v.x,v.y-.30,0)).normalized()*offset
  coords.append(v)
 o=mesh(name,coords,[[mapping[i] for i in faces[j]] for j in indices],mat,[uvs[j] for j in indices]);skin_obj(o,[weight_by_vertex[i] for i in selected]);return o
bodyface=[i for i,g in enumerate(groups) if g=='body']
jersey=[];shorts=[];visible=[];hair=[]
for i in bodyface:
 c=sum((vworld[j] for j in faces[i]),Vector())/len(faces[i]);z=c.z;x=abs(c.x)
 isjersey=1.08<z<1.64 and x<(.175 if z>1.43 else .255) and not (z>1.52 and x<.078)
 isshorts=.68<z<1.105 and x<.29
 if isjersey:jersey.append(i)
 if isshorts:shorts.append(i)
 if z>.13:visible.append(i)
 if z>1.817 and (c.y>.302 or z>1.87):hair.append(i)
body=subset('Athlete / continuous anatomical mesh',visible,skin)
jerseyobj=subset('Sleeveless practice jersey',jersey,cream,.026,True)
# Keep the tank's straps on the torso, outside the moving upper-arm skin.
# The old shoulder/arm weights pulled the opening into a folded cap sleeve.
for v in jerseyobj.data.vertices:
 if v.co.z>1.39:
  for group in jerseyobj.vertex_groups:group.remove([v.index])
  blend=min(1,max(0,(v.co.z-1.39)/.18))*.95
  side='L' if v.co.x>0 else 'R'
  for name,amount in [('spine01',1-blend),('shoulder01.'+side,blend)]:
   group=jerseyobj.vertex_groups.get(name) or jerseyobj.vertex_groups.new(name=name)
   group.add([v.index],amount,'REPLACE')
shortsobj=subset('Basketball shorts',shorts,teal,.036,True)
hair=subset('Sculpted close crop',hair,hairmat,.004)
garment_paths=[]
for o in [body,jerseyobj,shortsobj,hair]:
 if o in [jerseyobj,shortsobj]:
  # Smooth cut boundaries into sewn openings instead of jagged face-selection edges.
  ec={}
  for poly in o.data.polygons:
   for a,b in poly.edge_keys:ec[tuple(sorted((a,b)))]=ec.get(tuple(sorted((a,b))),0)+1
  adjacency={}
  for (a,b),count in ec.items():
   if count==1:adjacency.setdefault(a,[]).append(b);adjacency.setdefault(b,[]).append(a)
  for _ in range(12):
   changes={i:o.data.vertices[i].co*.35+sum((o.data.vertices[j].co for j in js),Vector())/len(js)*.65 for i,js in adjacency.items()}
   for i,v in changes.items():o.data.vertices[i].co=v
 sub=o.modifiers.new('Surface refinement','SUBSURF');sub.levels=1;sub.render_levels=1
 if o!=body and o!=hair:
  so=o.modifiers.new('Cloth edge thickness','SOLIDIFY');so.thickness=.003
 # Bake the surface refinement at rest, retaining interpolated bone weights.
 bpy.context.view_layer.objects.active=o
 for mod in list(o.modifiers):
  if mod.type!='ARMATURE':
   kind=mod.type;bpy.ops.object.modifier_apply(modifier=mod.name)
   if kind=='SUBSURF' and o in [jerseyobj,shortsobj]:
    # Bind trim to the *refined* edge. The cage edge otherwise floats away
    # from the subdivided fabric during shoulder elevation.
    ec={}
    for poly in o.data.polygons:
     for edge in poly.edge_keys:ec[tuple(sorted(edge))]=ec.get(tuple(sorted(edge)),0)+1
    adjacency={}
    for (a,b),count in ec.items():
     if count==1:adjacency.setdefault(a,[]).append(b);adjacency.setdefault(b,[]).append(a)
    seen=set();paths=[]
    for start in adjacency:
     if start in seen:continue
     path=[];previous=None;current=start
     while current not in seen:
      seen.add(current);path.append(current);choices=[n for n in adjacency[current] if n!=previous]
      if not choices:break
      previous,current=current,choices[0]
     if len(path)>5:paths.append([(o.data.vertices[i].co.copy(),{o.vertex_groups[g.group].name:g.weight for g in o.data.vertices[i].groups}) for i in path])
    garment_paths.append((o.name,paths,teal if o==jerseyobj else trim))
for name,paths,mat in garment_paths:
 vs=[];fs=[];ww=[]
 for path in paths:
  offset=len(vs);length=len(path)
  for i,(p,w) in enumerate(path):
   tangent=(path[(i+1)%length][0]-path[(i-1)%length][0]).normalized();ref=Vector((0,0,1)) if abs(tangent.z)<.9 else Vector((1,0,0));u=tangent.cross(ref).normalized();v=tangent.cross(u).normalized()
   for k in range(8):vs.append(p+.0028*(u*math.cos(k*math.tau/8)+v*math.sin(k*math.tau/8)));ww.append(w)
   for k in range(8):fs.append([offset+i*8+k,offset+i*8+(k+1)%8,offset+((i+1)%length)*8+(k+1)%8,offset+((i+1)%length)*8+k])
 skin_obj(mesh(name+' / sewn binding',vs,fs,mat),ww)
def proxy(folder,name,mat,rigid=None):
 path=SRC/'system'/folder/name;pv,pf,pu,pg=read_obj(path/(name+'.obj'))
 lines=(path/(name+'.mhclo')).read_text().splitlines();reading=False;refs=[];axis=[1.,1.,1.]
 for l in lines:
  s=l.split()
  if not s or s[0].startswith('#'):continue
  if s[0] in ['x_scale','y_scale','z_scale']:
   ax='xyz'.index(s[0][0]);axis[ax]=abs(verts[int(s[1])][ax]-verts[int(s[2])][ax])/float(s[3])
  elif s[0]=='verts':reading=True
  elif s[0] in ['material','vertexboneweights_file']:continue
  elif reading and s[0].lstrip('-').isdigit():
   if len(s)==1:refs.append(([int(s[0])],[1],Vector()))
   elif len(s)>=9:refs.append((list(map(int,s[:3])),list(map(float,s[3:6])),Vector(float(s[k+6])*axis[k] for k in range(3))))
  elif reading:break
 fitted=[];ww=[]
 for ids,ws,off in refs[:len(pv)]:
  fitted.append(conv(sum((verts[i]*w for i,w in zip(ids,ws)),Vector())+off));d={}
  for i,w in zip(ids,ws):
   for b,bw in weight_by_vertex[i].items():d[b]=d.get(b,0)+max(w,0)*bw
  ww.append({rigid:1} if rigid else d)
 o=mesh(name,fitted,pf,mat,pu);skin_obj(o,ww);return o
eye=material('Warm brown eyes',(.6,.55,.45),.2,texture=SRC/'system/eyes/materials/brown_eye.png')
# Spherical eye inserts with dark irises sit behind the modeled eyelids.
eyewhite=material('Sclera',(.49,.49,.43),.32);iris=material('Brown iris',(.037,.017,.009),.27);pupil=material('Pupil',(.002,.002,.001),.2)
for side in ['L','R']:
 c=heads['eye.'+side];o=uv_sphere('Eyeball '+side,c,(.0115,.0115,.0115),eyewhite);skin_obj(o,[{'head':1} for _ in o.data.vertices])
 o=uv_sphere('Iris '+side,c+W(0,.0015,.0107),(.0048,.0012,.0048),iris);skin_obj(o,[{'head':1} for _ in o.data.vertices])
 o=uv_sphere('Pupil '+side,c+W(0,.0015,.0117),(.0023,.0007,.0023),pupil);skin_obj(o,[{'head':1} for _ in o.data.vertices])
shoe=material('Ivory canvas trainers',(.8,.8,.75),.73,texture=OUT/'shoes-ivory.png')
shoes=proxy('clothes','shoes02',shoe)
sole=min(v.co.z for v in shoes.data.vertices)
for v in shoes.data.vertices:
 v.co.z-=sole
# The source footwear includes socks. Remove those polygons before rigid foot
# weighting; separate flexible, continuous socks are built below.
bm=bmesh.new();bm.from_mesh(shoes.data)
bmesh.ops.delete(bm,geom=[f for f in bm.faces if f.calc_center_median().z>.12],context='FACES')
bm.to_mesh(shoes.data);bm.free()
shoes.vertex_groups.clear();left=shoes.vertex_groups.new(name='foot.L');right=shoes.vertex_groups.new(name='foot.R')
rubber=material('Ivory rubber midsoles',(.70,.73,.68),.81);shoes.data.materials.append(rubber)
for poly in shoes.data.polygons:
 if sum(shoes.data.vertices[i].co.z for i in poly.vertices)/len(poly.vertices)<.035:poly.material_index=1
for v in shoes.data.vertices:
 (left if v.co.x>0 else right).add([v.index],1,'REPLACE')
# Closed circumference, smooth level cuff; use nearby skin weights, not a rigid
# foot attachment, so fabric follows the lower leg through the knee bend.
for side in ['L','R']:
 sign=1 if side=='L' else -1;vs=[];fs=[];ww=[]
 legids=[i for i in body_ids if vworld[i].x*sign>0 and .08<vworld[i].z<.32]
 for ring,z in enumerate([.095,.11,.14,.18,.22,.26,.275]):
  band=[vworld[i] for i in legids if abs(vworld[i].z-z)<.018]
  if not band:band=sorted([vworld[i] for i in legids],key=lambda v:abs(v.z-z))[:20]
  xmin,xmax=min(v.x for v in band),max(v.x for v in band);ymin,ymax=min(v.y for v in band),max(v.y for v in band)
  cx,cy=(xmin+xmax)/2,(ymin+ymax)/2;rx,ry=(xmax-xmin)/2+.006,(ymax-ymin)/2+.006
  for k in range(40):
   a=k*math.tau/40;v=Vector((cx+rx*math.cos(a),cy+ry*math.sin(a),z));vs.append(v)
   nearest=min(legids,key=lambda i:(vworld[i]-v).length_squared);ww.append(weight_by_vertex[nearest])
   if ring:fs.append([(ring-1)*40+k,(ring-1)*40+(k+1)%40,ring*40+(k+1)%40,ring*40+k])
 sockobj=skin_obj(mesh('Ribbed crew sock '+side,vs,fs,cream),ww)
 sub=sockobj.modifiers.new('Smooth woven cuffs','SUBSURF');sub.levels=1;bpy.context.view_layer.objects.active=sockobj;bpy.ops.object.modifier_apply(modifier=sub.name)
def bone_parent(o,name):
 # Armature modifier gives a reliable rigid attachment and portable glTF skin.
 if o.type!='MESH':
  bpy.context.view_layer.objects.active=o;o.select_set(True);bpy.ops.object.convert(target='MESH');o=bpy.context.object
 bpy.context.view_layer.objects.active=o;o.select_set(True);bpy.ops.object.transform_apply(location=True,rotation=True,scale=True)
 skin_obj(o,[{name:1} for _ in o.data.vertices]);return o
def text_obj(name,text,loc,size,mat):
 c=bpy.data.curves.new(name,'FONT');c.body=text;c.align_x='CENTER';c.size=size;c.extrude=.0004;o=bpy.data.objects.new(name,c);sc.collection.objects.link(o);o.location=loc;o.rotation_euler=(math.pi/2,0,0);o.data.materials.append(mat);return o
ink=material('Jersey print',(.023,.083,.092),.88)
bone_parent(text_obj('Chest wordmark','AFTER RAIN',W(0,1.465,-.082),.025,ink),'spine01')
actor=[o for o in sc.objects]
# Author the motion by solving limbs at 60 Hz with fixed foot contacts.
def interp(keys,t):
 if t<=keys[0][0]:return keys[0][1]
 for (a,x),(b,y) in zip(keys,keys[1:]):
  if t<=b:
   u=(t-a)/(b-a);u=u*u*(3-2*u);return x+(y-x)*u
 return keys[-1][1]
def ramp(a,b,t):
 u=max(0,min(1,(t-a)/(b-a)));return u*u*u*(10+u*(-15+6*u))
def quintic(p0,v0,a0,p1,v1,a1,span,u):
 # Endpoint position, velocity AND acceleration. Same polynomial in physics.js.
 u=max(0,min(1,u));c0=p0;c1=v0*span;c2=a0*(span*span/2)
 d=p1-c0-c1-c2;v=v1*span-c1-c2*2;a=a1*span*span-c2*2
 return c0+c1*u+c2*u*u+(d*10-v*4+a*.5)*u**3+(-d*15+v*7-a)*u**4+(d*6-v*3+a*.5)*u**5
def track(keys,t):
 if t<=keys[0][0]:return keys[0][1]
 for (a,p,v,acc),(b,q,w,dd) in zip(keys,keys[1:]):
  if t<=b:return quintic(p,v,acc,q,w,dd,b-a,(t-a)/(b-a))
 return keys[-1][1]
def ik(a,c,l1,l2,pole):
 d=c-a;dist=min(d.length,l1+l2-.0001);n=d.normalized();proj=(l1*l1-l2*l2+dist*dist)/(2*max(dist,.00001));h=math.sqrt(max(0,l1*l1-proj*proj));p=(pole-n*pole.dot(n)).normalized();return a+n*proj+p*h
def arm_ik(a,c,l1,l2,pole,fwd,normal):
 # Solve elbow swivel jointly with wrist bend and radioulnar rotation. The
 # fixed-length circle keeps the elbow a hinge; no sideways elbow bend/scale.
 d=c-a;n=d.normalized();dist=d.length
 along=(l1*l1-l2*l2+dist*dist)/(2*dist);height=math.sqrt(max(0,l1*l1-along*along));center=a+n*along
 p=(pole-n*pole.dot(n)).normalized();q=n.cross(p).normalized();x=fwd.cross(normal).normalized()
 def candidate(angle):return center+height*(p*math.cos(angle)+q*math.sin(angle))
 def cost(angle):
  e=candidate(angle);u=(e-a).normalized();f=(c-e).normalized()
  flex=math.degrees(math.atan2(-f.dot(normal),f.dot(fwd)));dev=math.degrees(math.asin(max(-1,min(1,f.dot(x)))))
  flexdir=(u-f*u.dot(f)).normalized();neutral=f.cross(flexdir).normalized()
  palm=fwd.rotation_difference(f)@normal
  roll=math.degrees(math.atan2(f.dot(neutral.cross(palm)),neutral.dot(palm)))
  # Left neutral palm is mirrored.
  if normal.x<-.9:roll=(roll+360)%360-180
  bendlimit=59 if flex<0 else 74
  coupled=(flex/bendlimit)**2+(dev/20)**2
  penalty=max(0,coupled-1)**2*400+max(0,-74-roll)**2+max(0,roll-79)**2
  return penalty*100+dev*dev*.1+(1-math.cos(angle))*100
 step=math.tau/96;best=min(range(96),key=lambda i:cost(-math.pi+i*step));lo=-math.pi+(best-1)*step;hi=lo+2*step
 for _ in range(20):
  m1=lo+(hi-lo)/3;m2=hi-(hi-lo)/3
  if cost(m1)<cost(m2):hi=m2
  else:lo=m1
 return candidate((lo+hi)/2)
def set_transform(name,q,origin,restorigin):
 rig.pose.bones[name].matrix=Matrix.Translation(origin)@q.to_matrix().to_4x4()@Matrix.Translation(-restorigin)@rest[name]
 bpy.context.view_layer.update()
def limb(names,a,b):
 r0=heads[names[0]];r1=tails[names[-1]];q=(r1-r0).rotation_difference(b-a)
 for n in names:set_transform(n,q,a,r0)
def frame_basis(axis,normal):
 axis=axis.normalized();normal=(normal-axis*normal.dot(axis)).normalized()
 return Matrix((axis.cross(normal).normalized(),axis,normal)).transposed()
def arm_pose(side,shoulder,elbow,wrist,fwd,normal):
 s0=heads['upperarm01.'+side];e0=heads['lowerarm01.'+side];w0=heads['wrist.'+side]
 u0=(e0-s0).normalized();f0=(w0-e0).normalized();u=(elbow-shoulder).normalized();f=(wrist-elbow).normalized()
 upper=(frame_basis(u,u.cross(f))@frame_basis(u0,u0.cross(f0)).inverted()).to_quaternion()
 for name in ['upperarm01.','upperarm02.']:set_transform(name+side,upper,shoulder,s0)
 h0=(heads['finger3-1.'+side]-w0).normalized();across=heads['finger2-1.'+side]-heads['finger5-1.'+side]
 palm0=h0.cross(across).normalized()*(-1 if side=='R' else 1)
 # Swing the hand straight to identify radioulnar roll independently of wrist
 # flexion/deviation. Spread that roll over the two forearm deformation bones.
 lower=(frame_basis(f,fwd.rotation_difference(f)@normal)@frame_basis(f0,h0.rotation_difference(f0)@palm0).inverted()).to_quaternion()
 swing=f0.rotation_difference(f);twist=lower@swing.inverted()
 set_transform('lowerarm01.'+side,Quaternion((1,0,0,0)).slerp(twist,.5)@swing,elbow,e0)
 set_transform('lowerarm02.'+side,lower,elbow,e0)
def hand(side,wrist,fwd,normal,curl):
 n='wrist.'+side;r0=heads[n];rf=(heads['finger3-1.'+side]-r0).normalized()
 # Palm basis from anatomical landmarks; normal chosen toward the palmar side.
 across=heads['finger2-1.'+side]-heads['finger5-1.'+side];rn=-rf.cross(across).normalized()
 if side=='L':rn=-rn
 rx=rf.cross(rn).normalized();rn=rx.cross(rf).normalized();fwd=fwd.normalized();xx=fwd.cross(normal).normalized();nn=xx.cross(fwd).normalized()
 rb=Matrix((rx,rf,rn)).transposed();tb=Matrix((xx,fwd,nn)).transposed();q=(tb@rb.inverted()).to_quaternion()
 set_transform(n,q,wrist,r0)
 for f in range(1,6):
  prev=None;total=0
  for seg in range(1,4):
   bn=f'finger{f}-{seg}.{side}'
   if bn not in rest:continue
   h=wrist+q@(heads[bn]-r0) if prev is None else prev
   total+=curl*(.55 if f==1 else 1)*([.48,.7,.5][seg-1]);qq=Quaternion(xx,total)@q
   set_transform(bn,qq,h,heads[bn]);prev=h+qq@(tails[bn]-heads[bn])
release=1.25;release_index=round(release*60);balltrack=[];posechecks=[];handchecks=[]
zero=W(0,0,0);approach=1.15;approach_p=W(-.23,1.96,.10);approach_v=W(.2,1.8,1.0);approach_a=W(0,8,15)
# One lift, no set-point hold: the set is a passing pose on the continuous curve.
ballkeys=[(0,W(-.14,1.25,.07),zero,zero),(.30,W(-.17,1.15,.08),zero,W(0,4,0)),(.92,W(-.20,1.66,.23),W(-.06,1.55,-.15),zero),(approach,approach_p,approach_v,approach_a)]
release_v=W(6.94*math.cos(math.radians(52))*math.sin(math.radians(1.72)),6.94*math.sin(math.radians(52)),6.94*math.cos(math.radians(52))*math.cos(math.radians(1.72)))
def authored_ball(t):
 if t<approach:return track(ballkeys,t)
 return quintic(approach_p,approach_v,approach_a,W(-.12,2.22,.19),release_v,W(0,-9.81,0),release-approach,(t-approach)/(release-approach))
def shooting_grip(t):
 # Brief palm-over pickup, then the right palm carries underneath/behind the ball.
 theta=track([(0,.45,0,0),(.30,.55,.5,0),(.85,1.10,2,0),(1.10,1.90,0,0),(release,.90,-5,0),(release+.28,.50,0,0)],t)
 tilt=.60-.40*ramp(1.10,release,t)
 normal=W(tilt,-math.cos(theta),math.sin(theta)).normalized();fwd=W(.25,math.sin(theta),math.cos(theta));fwd=(fwd-normal*fwd.dot(normal)).normalized()
 along=track([(0,.105,0,0),(release-.035,.105,0,0),(release,.220,7.84,0)],min(t,release))
 curl=.40-.27*ramp(release-.035,release,t)+.42*ramp(release,release+.28,t)
 # Millimetre-scale contact calibration from the actual skinned finger pads.
 contact=track([(0,.17486,0,0),(release-.035,.17486,0,0),(release-1/60,.1712,.25,0),(release,.174,-1.70,0)],min(t,release))
 return fwd,normal,along,curl,contact
def attached_wrist(t):
 f,n,along,c,contact=shooting_grip(t);return authored_ball(t)-n*contact-f*along
rw_release=attached_wrist(release)
rw_velocity=(attached_wrist(release)-attached_wrist(release-.0001))/.0001
rw_finish=rw_release+W(0,.032,.060)
def right_wrist(t):
 if t<=release:return attached_wrist(t)
 return quintic(rw_release,rw_velocity,zero,rw_finish,zero,zero,.16,(t-release)/.16)
def guide_grip(t):
 # Side-only alignment: no under-ball shelf, forward palm normal or wrist flick.
 angle=track([(0,-.25,0,0),(.30,-.20,.3,0),(guide_detach,.95,0,0),(guide_detach+.30,.25,0,0)],t)
 normal=W(-1,0,0);fwd=W(0,math.sin(angle),math.cos(angle))
 return fwd,normal
guide_detach=1.05
def attached_guide(t):
 f,n=guide_grip(t)
 return authored_ball(t)-n*.1706-f*.12+W(.07,0,0)*ramp(.96,1.12,t)
gw_detach=attached_guide(guide_detach)
gw_velocity=(gw_detach-attached_guide(guide_detach-.0001))/.0001
gw_finish=W(.38,1.38,-gw_detach.y-.06)
# Brake the forward component before separation; thereafter it only retreats.
guide_brake=.90;gw_brake=attached_guide(guide_brake)
gw_brake_v=(gw_brake-attached_guide(guide_brake-.0001))/.0001
guide_z_stop=-gw_brake.y+min(0,-gw_brake_v.y)*.075
gw_detach.y=-guide_z_stop;gw_velocity.y=0;gw_finish.y=-(guide_z_stop-.06)
for frame in range(1,362):
 t=(frame-1)/60;sc.frame_set(frame)
 for b in rig.pose.bones:b.matrix_basis=Matrix.Identity(4)
 drop=-.010-.045*ramp(0,.30,t)+.043*ramp(.30,release,t)-.008*ramp(2.2,4.6,t)
 backward=-.035*ramp(0,.30,t)+.07*ramp(.30,release,t)-.025*ramp(2.2,4.6,t)
 shift=W(0,drop,backward);rig.pose.bones['root'].matrix=Matrix.Translation(shift)@rest['root'];bpy.context.view_layer.update()
 set_transform('head',Quaternion(Vector((1,0,0)),math.radians(-6)),heads['head']+shift,heads['head'])
 for side in ['R','L']:
  hip=heads['upperleg01.'+side]+shift;ankle=heads['foot.'+side];krest=heads['lowerleg01.'+side]
  knee=ik(hip,ankle,(krest-heads['upperleg01.'+side]).length,(heads['foot.'+side]-krest).length,W(0,0,1))
  limb(['upperleg01.'+side,'upperleg02.'+side],hip,knee);limb(['lowerleg01.'+side,'lowerleg02.'+side],knee,ankle)
  rig.pose.bones['foot.'+side].matrix=rest['foot.'+side]
 bpy.context.view_layer.update()
 ball=authored_ball(min(t,release));balltrack.append([round(float(v),6) for v in (ball.x,ball.z,-ball.y)])
 for side in ['R','L']:
  if side=='R':
   fwd,normal,along,curl,contact=shooting_grip(t);wrist=right_wrist(t)
  else:
   fwd,normal=guide_grip(t);wrist=attached_guide(min(t,guide_detach))
   if t>guide_brake:
    wrist.y=-quintic(-gw_brake.y,-gw_brake_v.y,0,guide_z_stop,0,0,guide_detach-guide_brake,(t-guide_brake)/(guide_detach-guide_brake))
   # The guide withdraws sideways/down/back; it never follows the launch thrust.
   if t>guide_detach:wrist=quintic(gw_detach,gw_velocity,zero,gw_finish,zero,zero,.30,(t-guide_detach)/.30)
   curl=.34-.09*ramp(guide_detach,release+.25,t)
  lift=W(0,.095,.08)*ramp(.65,release,t)
  # Held arms settle with the torso, preserving reach rather than stretching.
  wrist+=W(0,-.008,-.025)*ramp(2.2,4.6,t)
  if side=='L':lift*=.65
  set_transform('shoulder01.'+side,Quaternion((1,0,0,0)),heads['shoulder01.'+side]+shift+lift,heads['shoulder01.'+side])
  shoulder=heads['upperarm01.'+side]+shift+lift;elbowrest=heads['lowerarm01.'+side]
  el=arm_ik(shoulder,wrist,(elbowrest-heads['upperarm01.'+side]).length,(heads['wrist.'+side]-elbowrest).length,W(.08 if side=='R' else .45,-1,.45),fwd,normal)
  arm_pose(side,shoulder,el,wrist,fwd,normal);hand(side,wrist,fwd,normal,curl)
  handchecks.append({'t':round(t,6),'side':side,'wrist':[wrist.x,wrist.z,-wrist.y],'palmNormal':[normal.x,normal.z,-normal.y],'reach':(wrist-shoulder).length})
 bpy.context.view_layer.update()
 for b in rig.pose.bones:
  b.rotation_mode='QUATERNION';b.keyframe_insert('location',frame=frame);b.keyframe_insert('rotation_quaternion',frame=frame);b.keyframe_insert('scale',frame=frame)
 if frame in [1,72,107,139,170,240]:posechecks.append({'frame':frame,'ball':balltrack[-1],'rootDrop':drop})
rig.animation_data.action.name='Authored stationary free throw / 6 seconds'
for frame,name in [(1,'PICKUP'),(19,'LOAD / LIFT BEGINS'),(64,'GUIDE WITHDRAWS'),(70,'PASSING SET POINT'),(release_index+1,'RIGHT-HAND RELEASE'),(93,'FOLLOW THROUGH'),(133,'BASKET')]:sc.timeline_markers.new(name,frame=frame)
def browser_vec(v):return [v.x,v.z,-v.y]
(OUT/'motion.json').write_text(json.dumps({'fps':60,'release':release,'duration':6,'guideDetach':guide_detach,'guideBrake':guide_brake,'ballDriver':'right-hand authored attachment','guideImpulse':[0,0,0],'ballTrack':balltrack,'ballKeys':[[t,browser_vec(p),browser_vec(v),browser_vec(a)] for t,p,v,a in ballkeys],'approachStart':approach,'approachPosition':browser_vec(approach_p),'approachVelocity':browser_vec(approach_v),'approachAcceleration':browser_vec(approach_a),'releaseVelocity':browser_vec(release_v),'poseChecks':posechecks,'handChecks':handchecks},separators=(',',':')))
sc.frame_set(1)
# Editable environment.
asphalt=material('Rain-darkened asphalt',(.24,.28,.28),.56,texture=OUT/'Diffuse.jpg')
nodes=asphalt.node_tree.nodes;links=asphalt.node_tree.links;p=nodes.get('Principled BSDF')
n=nodes.new('ShaderNodeTexImage');n.image=bpy.data.images.load(str(OUT/'nor_gl.jpg'));n.image.colorspace_settings.name='Non-Color';nm=nodes.new('ShaderNodeNormalMap');nm.inputs['Strength'].default_value=.6;links.new(n.outputs['Color'],nm.inputs['Color']);links.new(nm.outputs['Normal'],p.inputs['Normal'])
floor=mesh('Court asphalt / 28.6512 x 15.24 m',[W(-7.62,0,-22.86),W(7.62,0,-22.86),W(7.62,0,5.7912),W(-7.62,0,5.7912)],[[3,2,1,0]],asphalt,[[(0,14.326),(7.62,14.326),(7.62,0),(0,0)]])
outer=material('Perimeter concrete',(.08,.09,.095),.9);box('Raised court foundation',W(0,-.13,-8.53),(18,32,.25),outer,.12)
white=material('Weathered court paint',(.67,.72,.70),.76);paint=material('Worn petrol key',(.025,.10,.105),.61)
mesh('Painted lane',[W(-2.4384,.003,0),W(2.4384,.003,0),W(2.4384,.003,5.7912),W(-2.4384,.003,5.7912)],[[3,2,1,0]],paint)
def line(name,pts,width=.025,mat=white):
 vs=[];fs=[]
 for i,(x,z) in enumerate(pts):
  a=Vector(pts[max(0,i-1)]);b=Vector(pts[min(len(pts)-1,i+1)]);d=(b-a).normalized();n=Vector((-d.y,d.x))*width
  vs.extend([W(x+n.x,.009,z+n.y),W(x-n.x,.009,z-n.y)])
  if i:fs.append([2*i,2*i+1,2*i-1,2*i-2])
 return mesh(name,vs,fs,mat)
line('Court boundary',[(-7.62,-22.86),(7.62,-22.86),(7.62,5.7912),(-7.62,5.7912),(-7.62,-22.86)])
line('Lane boundary',[(-2.4384,5.7912),(-2.4384,0),(2.4384,0),(2.4384,5.7912)])
line('Free throw circle',[(1.8288*math.cos(a),1.8288*math.sin(a)) for a in [i*math.pi/64 for i in range(65,129)]])
line('Restricted area',[(1.2192*math.cos(a),4.191-1.2192*math.sin(a)) for a in [i*math.pi/48 for i in range(49)]])
line('Three point arc',[(7.239*math.cos(a),4.191-7.239*math.sin(a)) for a in [i*math.pi/96 for i in range(8,89)]])
line('Half court',[(-7.62,-8.5344),(7.62,-8.5344)])
for x in [-2.60,2.60]:
 for z in [1.10,2.03,2.94,3.85]:line('Lane hash',[(x-.10,z),(x+.10,z)],.024)
orange=material('Orange powder coated rim',(.82,.17,.025),.28,.5);steel=material('Galvanised steel',(.15,.19,.20),.35,.8);dark=material('Black padded support',(.015,.025,.029),.8);netmat=material('Braided nylon net',(.83,.80,.66),.84)
glass=material('Backboard glass',(.67,.82,.83),.035,.08);p=glass.node_tree.nodes.get('Principled BSDF');p.inputs['Transmission Weight'].default_value=.94;p.inputs['IOR'].default_value=1.5
box('Backboard / 1.8288 x 1.0668 m',W(0,3.5814,4.585),(1.8288,.026,1.0668),glass,.007)
for x in [-.929,.929]:tube('Backboard frame',[W(x,3.048,4.584),W(x,4.115,4.584)],.024,steel)
for h in [3.048,4.115]:tube('Backboard frame',[W(-.929,h,4.584),W(.929,h,4.584)],.024,steel)
tube('Target rectangle',[W(-.3048,3.098,4.565),W(-.3048,3.555,4.565),W(.3048,3.555,4.565),W(.3048,3.098,4.565)],.019,white)
tube('Rim / 0.4572 m clear inside',[W(.238125*math.cos(a),3.038475,4.191+.238125*math.sin(a)) for a in [i*math.tau/96 for i in range(96)]],.009525,orange,True)
box('Rim mounting plate',W(0,3.07,4.56),(.19,.06,.14),orange,.008);tube('Rim bracket',[W(0,3.03,4.53),W(0,3.025,4.38)],.027,orange)
box('Hoop post',W(0,1.70,6.49),(.23,.30,3.4),steel,.024);box('Safety pad',W(0,1.02,6.31),(.40,.25,1.80),dark,.06)
tube('Cantilever support',[W(0,3.40,6.49),W(0,3.88,5.53),W(0,3.75,4.65)],.10,steel)
for side in [-1,1]:tube('Board brace',[W(0,3.54,5.84),W(side*.73,3.72,4.62)],.033,steel)
for k in range(12):
 a=k*math.tau/12
 for sign in [-1,1]:
  pts=[]
  for j in range(9):
   u=j/8;r=.227*(1-u)+.105*u;ang=a+sign*u*.72;pts.append(W(r*math.cos(ang),3.0285-.43*u,4.191+r*math.sin(ang)))
  tube('Net strand',pts,.0026,netmat)
for u in [.25,.5,.75,1]:tube('Net knots ring',[W((.227*(1-u)+.105*u)*math.cos(k*math.tau/36),3.0285-.43*u,4.191+(.227*(1-u)+.105*u)*math.sin(k*math.tau/36)) for k in range(36)],.0015,netmat,True)
# Fence behind the basket and on the long edges.
fencemat=material('Dark zinc fence',(.055,.08,.084),.61,.6)
for x in range(-8,9,2):tube('Fence post',[W(x,0,7.9),W(x,3.6,7.9)],.034,steel)
for h in [.18,3.5]:tube('Fence rail',[W(-9,h,7.9),W(9,h,7.9)],.024,steel)
for i in range(-90,91):
 x=i*.20
 for sign in [-1,1]:
  pts=[]
  for h in [0,3.5]:pts.append(W(x+sign*h*.52,h,7.9))
  if all(abs(p.x)<9.5 for p in pts):tube('Chain link',pts,.0022,fencemat)
em=material('Warm lamp diffusers',(1,.65,.26),.3);p=em.node_tree.nodes.get('Principled BSDF');p.inputs['Emission Color'].default_value=(1,.54,.19,1);p.inputs['Emission Strength'].default_value=6
for x,z in [(-6.4,3.5),(6.4,3.5),(-6.4,-6.0),(6.4,-6.0)]:
 tube('Court light mast',[W(x,0,z),W(x,7.3,z)],.062,steel)
 box('Lamp housing',W(x,7.25,z),(.72,.38,.12),dark,.04);box('Lamp luminous panel',W(x,7.17,z),(.62,.30,.024),em,.018)
 ld=bpy.data.lights.new('3200 K court light','AREA');ld.energy=1050;ld.color=(1,.65,.36);ld.shape='DISK';ld.size=3.0;lo=bpy.data.objects.new(ld.name,ld);sc.collection.objects.link(lo);lo.location=W(x,7.1,z)
for x in [-3.7,4.8]:
 tube('Path lamp mast',[W(x,0,10.5),W(x,4.62,10.5)],.037,steel)
 box('Path lamp housing',W(x,4.66,10.5),(.48,.32,.09),dark,.02)
 box('Path lamp glass',W(x,4.60,10.5),(.40,.26,.025),em,.012)
# Restrained backdrop: dark trunks and layered tree canopies.
leaf=material('Dusk foliage',(.023,.048,.040),.97);bark=material('Bark',(.05,.038,.028),1)
for i in range(15):
 x=-28+i*4.1;z=22+random.uniform(0,12);h=random.uniform(5,8)
 tube('Tree trunk',[W(x,0,z),W(x,h*.67,z)],.10,bark)
 vs=[];fs=[]
 for k in range(8):
  a=k*math.tau/8;tip=W(x+math.cos(a)*1.8,h*.68+random.random()*1.5,z+math.sin(a)*1.8)
  tube('Tree branch',[W(x,h*.40,z),W(x+math.cos(a)*.6,h*.63,z+math.sin(a)*.6),tip],.025,bark)
 for k in range(1400):
  # Thin, individually modeled leaves create a broken, natural silhouette.
  a=random.random()*math.tau;r=math.sqrt(random.random())*2.2;yy=random.uniform(-1.4,1.4)
  center=W(x+math.cos(a)*r,h-1+yy,z+math.sin(a)*r)
  normal=Vector((random.uniform(-1,1),random.uniform(-1,1),random.uniform(.1,1))).normalized();u=normal.cross(Vector((0,0,1))).normalized()*random.uniform(.09,.19);v=normal.cross(u).normalized()*random.uniform(.045,.095)
  idx=len(vs);vs.extend([center-u,center-v,center+u,center+v,center+normal*.014]);fs.extend([[idx,idx+1,idx+4],[idx+1,idx+2,idx+4],[idx+2,idx+3,idx+4],[idx+3,idx,idx+4]])
 mesh('Fine park foliage',vs,fs,leaf)
groundmat=material('Dark park ground',(.023,.037,.032),1)
box('Surrounding park ground',W(0,-.23,0),(240,240,.2),groundmat)
# Low distant buildings give the court a grounded urban horizon.
facade=material('Distant concrete facades',(.035,.05,.065),.94)
windows=material('Distant warm windows',(.4,.22,.085),.6);wp=windows.node_tree.nodes.get('Principled BSDF');wp.inputs['Emission Color'].default_value=(.8,.39,.12,1);wp.inputs['Emission Strength'].default_value=.65
for i in range(13):
 x=-44+i*7;h=random.uniform(5,14);z=49+random.uniform(0,12);width=random.uniform(4,6)
 box('Distant building',W(x,h/2,z),(width,6,h),facade,.05)
 for floor in range(1,int(h/1.4)):
  for col in range(3):
   if random.random()<.33:box('Apartment window',W(x-width*.3+col*width*.3,floor*1.35,z-3.02),(.45,.025,.62),windows)
# Continue the park boundary behind the viewing cameras as well.
for o in list(sc.objects):
 if o.name.startswith(('Fence post','Fence rail','Chain link')):
  copy=o.copy();copy.data=o.data;sc.collection.objects.link(copy);copy.location+=W(0,0,-32.6);copy.name='Far '+o.name
for i in range(11):
 x=-36+i*7;h=random.uniform(5,11);z=-43-random.uniform(0,9)
 box('Far park building',W(x,h/2,z),(5,5,h),facade,.04)
 for floor in range(1,int(h/1.5)):
  if random.random()<.4:box('Far window',W(x,1.5*floor,z+2.52),(.30,.025,.40),windows)
# Low, hazy side silhouettes break the empty side-camera horizon.
for side in [-1,1]:
 for i in range(12):
  x=side*random.uniform(36,48);z=-35+i*6;h=random.uniform(3,7)
  box('Side park silhouette',W(x,h/2,z),(random.uniform(3,6),5,h),facade,.06)
water=material('Shallow rain water / Blender reflection',(.03,.06,.072),.07,.18);water.node_tree.nodes.get('Principled BSDF').inputs['Coat Weight'].default_value=.8
for i in range(22):
 x=random.choice([-1,1])*random.uniform(3.0,7.1);f=random.uniform(-9,5);rx=random.uniform(.25,1.1);rz=random.uniform(.3,1.5);vs=[W(x,.006,f)]
 for k in range(48):
  a=k*math.tau/48;r=1+.13*math.sin(a*5+i)+.09*math.sin(a*9+i*2);vs.append(W(x+math.cos(a)*rx*r,.006,f+math.sin(a)*rz*r))
 mesh('Blender water patch',vs,[[0,(k+1)%48+1,k+1] for k in range(48)],water)
# A simple park bench behind the baseline.
wood=material('Weathered bench slats',(.16,.12,.075),.86)
for i in range(5):box('Bench slat',W(-4.7,.49,6.65+i*.105),(2.1,.085,.05),wood,.018)
for x in [-5.5,-3.9]:tube('Bench leg',[W(x,0,6.75),W(x,.46,6.75)],.045,steel)
# Blender lighting and cameras remain in the .blend.
world=bpy.data.worlds.new('Blue hour sky');world.use_nodes=True;sc.world=world
env=world.node_tree.nodes.new('ShaderNodeTexEnvironment');env.image=bpy.data.images.load(str(OUT/'dusk.hdr'));world.node_tree.links.new(env.outputs['Color'],world.node_tree.nodes['Background'].inputs['Color']);world.node_tree.nodes['Background'].inputs['Strength'].default_value=.10
bg=world.node_tree.nodes.new('ShaderNodeBackground');bg.inputs['Color'].default_value=(.032,.074,.12,1);bg.inputs['Strength'].default_value=.7
lp=world.node_tree.nodes.new('ShaderNodeLightPath');mix=world.node_tree.nodes.new('ShaderNodeMixShader');world.node_tree.links.new(lp.outputs['Is Camera Ray'],mix.inputs[0]);world.node_tree.links.new(world.node_tree.nodes['Background'].outputs[0],mix.inputs[1]);world.node_tree.links.new(bg.outputs[0],mix.inputs[2]);world.node_tree.links.new(mix.outputs[0],world.node_tree.nodes['World Output'].inputs['Surface'])
def camera(name,loc,target,lens):
 d=bpy.data.cameras.new(name);o=bpy.data.objects.new(name,d);sc.collection.objects.link(o);o.location=loc;o.rotation_euler=(target-loc).to_track_quat('-Z','Y').to_euler();d.lens=lens;return o
cam=camera('Cinematic / courtside',W(-4.7,2.25,-5.3),W(0,1.8,1.8),40);sc.camera=cam
camera('Inspection / shooting side',W(-5,1.75,.4),W(0,1.25,.35),48)
camera('Inspection / front',W(0,1.70,4.0),W(0,1.25,0),50)
# Animated editable ball uses the same default gravity and release contract.
ballmat=material('Pebbled basketball',(.60,.205,.047),.8)
ball=uv_sphere('Basketball / radius 0.119 m',W(-.11,1.23,.04),(.119,.119,.119),ballmat)
seammat=material('Basketball recessed seams',(.012,.013,.013),.85)
for axis in range(3):
 pts=[]
 for j in range(128):
  a=j*math.tau/128;v=Vector((.1195*math.cos(a),.1195*math.sin(a),0));v=Quaternion(Vector((1,0,0)) if axis==1 else Vector((0,1,0)),math.pi/2 if axis else 0)@v;pts.append(v)
 o=tube('Ball seam',pts,.0016,seammat,True);o.parent=ball;o.matrix_parent_inverse=Matrix.Identity(4);o.scale=(1/.119,)*3
# Ball itself is excluded from actor glTF: runtime flight is simulated.
flight=json.loads((OUT/'default-flight.json').read_text());swish=next((e['t'] for e in flight['events'] if e['kind']=='through-rim'),99)
net_objects=[o for o in sc.objects if o.name.startswith('Net')]
net_points={o.name:[p.co.copy() for p in o.data.splines[0].points] for o in net_objects}
for frame in range(1,362):
 t=(frame-1)/60;dt=max(0,t-release);p=Vector(balltrack[min(frame-1,release_index)])
 if t>=release:
  index=min(len(flight['samples'])-1,round(dt*600));sample=flight['samples'][index];p=Vector((sample['x'],sample['y'],sample['z']))
 ball.location=W(p.x,p.y,p.z);ball.keyframe_insert('location',frame=frame)
 ball.rotation_euler.x=-dt*9;ball.keyframe_insert('rotation_euler',frame=frame)
 for net in net_objects:
  d=dt-swish;shift=W(math.sin(d*17)*.026*math.exp(-d*2.8) if 0<d<2 else 0,0,math.sin(d*13)*.035*math.exp(-d*2.6) if 0<d<2 else 0)
  for point,baseco in zip(net.data.splines[0].points,net_points[net.name]):
   u=min(1,max(0,(3.0285-baseco.z)/.43))**2;point.co=baseco+Vector((*list(shift*u),0));point.keyframe_insert('co',frame=frame)
sc.frame_set(70)
sc.render.engine='CYCLES';sc.cycles.samples=32;sc.cycles.use_denoising=True
try:
 prefs=bpy.context.preferences.addons['cycles'].preferences;prefs.compute_device_type='METAL';prefs.get_devices()
 for d in prefs.devices:d.use=d.type=='METAL'
 sc.cycles.device='GPU'
except Exception as e:print('Cycles device',e)
sc.render.resolution_x=1600;sc.render.resolution_y=1000;sc.render.resolution_percentage=100
sc.view_settings.view_transform='AgX';sc.view_settings.look='AgX - Medium High Contrast'
# Portable exports; apply non-armature modifiers for meshes.
def export(objs,path,anim):
 bpy.ops.object.select_all(action='DESELECT')
 for o in objs:
  if o.type in ['MESH','ARMATURE','CURVE','FONT']:o.select_set(True)
 bpy.context.view_layer.objects.active=rig
 bpy.ops.export_scene.gltf(filepath=str(path),export_format='GLB',use_selection=True,export_animations=anim,export_frame_range=True,export_force_sampling=True,export_apply=True,export_skins=True,export_yup=True)
export(actor,OUT/'athlete.glb',True)
environment=[o for o in sc.objects if o not in actor and o!=ball and o.parent!=ball and o.type in ['MESH','CURVE'] and not o.name.startswith('Blender water')]
export(environment,OUT/'court.glb',False)
# Pack source textures so the .blend is editable without missing files.
bpy.ops.object.select_all(action='DESELECT');rig.select_set(True);bpy.context.view_layer.objects.active=rig
bpy.ops.file.pack_all();bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'deliverables/After Rain.blend'))
manifest={'units':'metres','athleteHeight':1.90,'courtWidth':15.24,'courtLength':28.6512,'rimHeight':3.048,'rimHeightReference':'upper surface of steel','rimInsideDiameter':.4572,'rimTubeRadius':.009525,'rimCenter':[0,3.038475,4.191],'boardFrontZ':4.572,'boardWidth':1.8288,'boardHeight':1.0668,'ballRadius':.119,'freeThrowLineZ':0,'releaseTime':release,'releasePosition':balltrack[release_index],'gravity':9.81,'bodySourceVertices':len(body_ids),'bones':len(rig.data.bones)}
(OUT/'dimensions.json').write_text(json.dumps(manifest,indent=2));print('DIMENSIONS',manifest)
if '--render' in sys.argv:
 sc.render.filepath=str(ROOT/'deliverables/blender-first.png');bpy.ops.render.render(write_still=True)
print('BUILD COMPLETE')
