// Authored kinematic envelope, not a clinical musculoskeletal model.
import { Vector3, Quaternion, Matrix4, MathUtils } from 'three';
const deg=MathUtils.radToDeg, clamp=MathUtils.clamp;
export const LIMITS={elbow:145,extension:60,flexion:75,deviation:20,pronation:75,supination:80,shoulder:165,knee:135,ankle:15};
export function basis(axis,normal){
 const y=axis.clone().normalize(),z=normal.clone().addScaledVector(y,-normal.dot(y)).normalize();
 return new Matrix4().makeBasis(y.clone().cross(z).normalize(),y,z);
}
export function metrics(a,e,w,h,n,side='R'){
 const u=e.clone().sub(a).normalize(),f=w.clone().sub(e).normalize(),x=h.clone().cross(n).normalize();
 const flexdir=u.clone().addScaledVector(f,-u.dot(f)).normalize();
 const neutral=f.clone().cross(flexdir).normalize().multiplyScalar(side==='R'?1:-1);
 const palm=n.clone().applyQuaternion(new Quaternion().setFromUnitVectors(h,f));
 const flex=deg(Math.atan2(-f.dot(n),f.dot(h))),deviation=deg(Math.asin(clamp(f.dot(x),-1,1)));
 return {elbow:deg(u.angleTo(f)),wristFlex:flex,deviation,
  forearmRoll:deg(Math.atan2(f.dot(neutral.clone().cross(palm)),neutral.dot(palm))),
  shoulder:deg(u.angleTo(new Vector3(0,-1,0))),
  wristEnvelope:(flex/(flex<0?LIMITS.extension:LIMITS.flexion))**2+(deviation/LIMITS.deviation)**2};
}
export function solveArm(a,c,l1,l2,pole,h,normal,side='R'){
 const d=c.clone().sub(a),dist=d.length(),n=d.normalize();
 const along=(l1*l1-l2*l2+dist*dist)/(2*dist),height=Math.sqrt(Math.max(0,l1*l1-along*along));
 const center=a.clone().addScaledVector(n,along),p=pole.clone().addScaledVector(n,-pole.dot(n)).normalize(),q=n.clone().cross(p).normalize();
 const candidate=angle=>center.clone().addScaledVector(p,height*Math.cos(angle)).addScaledVector(q,height*Math.sin(angle));
 const cost=angle=>{
  const m=metrics(a,candidate(angle),c,h,normal,side);
  const coupled=(m.wristFlex/(m.wristFlex<0?59:74))**2+(m.deviation/20)**2;
  const penalty=Math.max(0,coupled-1)**2*400+Math.max(0,-74-m.forearmRoll)**2+Math.max(0,m.forearmRoll-79)**2;
  return penalty*100+m.deviation*m.deviation*.1+(1-Math.cos(angle))*100;
 };
 const step=Math.PI*2/96;let best=0,value=Infinity;
 for(let i=0;i<96;i++){const v=cost(-Math.PI+i*step);if(v<value){value=v;best=i}}
 let lo=-Math.PI+(best-1)*step,hi=lo+2*step;
 for(let i=0;i<20;i++){const m1=lo+(hi-lo)/3,m2=hi-(hi-lo)/3;if(cost(m1)<cost(m2))hi=m2;else lo=m1}
 return candidate((lo+hi)/2);
}
