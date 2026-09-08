import {chromium} from 'playwright';
import {mkdir,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const browser=await chromium.launch({channel:'chrome',headless:true});
try {
 const page=await browser.newPage({viewport:{width:900,height:1000}});
 await page.goto('http://127.0.0.1:4173');await page.waitForFunction(()=>window.lab?.ready);
 const report=await page.evaluate(async()=>{
  const {Vector3:V}=await import('three'),{metrics,LIMITS}=await import('/anatomy.js');
  const v=a=>new V(...a),values={},failures=[],samples=[];let foot0,previous;
  lab.play(false);lab.setShot({speed:6.94,angle:52,direction:1.72});
  function inspect(t,label){
   lab.seek(t);const j=lab.joints,pose={t,label};
   for(const side of ['R','L']){
    const a=v(j['upperarm01'+side]),e=v(j['lowerarm01'+side]),w=v(j['wrist'+side]);
    const h=v(j['finger3-1'+side]).sub(w).normalize(),ac=v(j['finger2-1'+side]).sub(v(j['finger5-1'+side]));
    const n=h.clone().cross(ac).normalize().multiplyScalar(side==='R'?-1:1),m=metrics(a,e,w,h,n,side);
    const hip=v(j['upperleg01'+side]),knee=v(j['lowerleg01'+side]),ankle=v(j['foot'+side]);
    m.knee=hip.clone().sub(knee).negate().angleTo(ankle.clone().sub(knee))*180/Math.PI;
    m.ankleSagittal=Math.atan2(knee.z-ankle.z,knee.y-ankle.y)*180/Math.PI;
    m.upperLength=a.distanceTo(e);m.forearmLength=e.distanceTo(w);
    const limits=m.elbow<=145.1&&m.elbow>=0&&m.wristFlex>=-60.1&&m.wristFlex<=75.1&&Math.abs(m.deviation)<=20.1&&m.forearmRoll>=-75.1&&m.forearmRoll<=80.1&&m.shoulder<=165.1&&m.knee<=135&&m.ankleSagittal<=15.1;
    if(!limits)failures.push({t,label,side,...m});
    for(const[k,x]of Object.entries(m))(values[side+'.'+k]??=[]).push(x);
    pose[side]={elbowPosition:e.toArray(),wrist:w.toArray(),...m};
   }
   if(label==='default'){
    foot0??=[...j.footR,...j.footL];
    (values.footDrift??=[]).push(Math.hypot(...[...j.footR,...j.footL].map((x,i)=>x-foot0[i])));
    if(previous)for(const side of ['R','L'])(values[side+'.elbowStep']??=[]).push(v(pose[side].elbowPosition).distanceTo(v(previous[side].elbowPosition)));
    if(t>=1.05&&previous?.t>=1.05)(values.guideForwardStep??=[]).push(pose.L.wrist[2]-previous.L.wrist[2]);
    previous=pose;samples.push(pose);
   }
  }
  for(let f=0;f<=360;f++)inspect(f/60,'default');
  // Only the 0.10-second release-adaptation window changes with launch edits.
  for(const speed of [5.5,8.5])for(const angle of [38,68])for(const direction of [-12,12]){
   lab.setShot({speed,angle,direction});for(let f=138;f<=150;f++)inspect(f/120,`${speed}/${angle}/${direction}`);
  }
  lab.setShot({speed:6.94,angle:52,direction:1.72});lab.seek(0);
  // A fast but continuous elbow can travel >8 cm per 60 Hz sample. Check
  // actual temporal joins at a small epsilon, not an arbitrary speed cap.
  for(const t of [.30,.85,1.10,1.15,1.25,1.53]){
   lab.seek(t-1e-5);const before=lab.joints;lab.seek(t+1e-5);const after=lab.joints;
   for(const key of ['wristR','lowerarm01R','wristL','lowerarm01L'])(values.joinDisplacement??=[]).push(v(before[key]).distanceTo(v(after[key])));
  }
  lab.seek(0);
  return {limits:LIMITS,failures,errors:lab.stats.errors,summary:Object.fromEntries(Object.entries(values).map(([k,v])=>[k,{min:Math.min(...v),max:Math.max(...v)}])),samples};
 });
 await mkdir('validation/anatomy',{recursive:true});
 await writeFile('validation/anatomy/report.json',JSON.stringify(report,null,2));
 await page.evaluate(()=>{lab.present(true);document.querySelector('#present-hint').style.display='none'});
 for(const view of ['front','side'])for(const t of [.30,.92,1.10,1.25,1.53]){
  await page.evaluate(({t,view})=>{lab.seek(t);lab.setCamera(view==='front'?[-1.1,1.85,2.4]:[-2.6,1.75,.15],[-.04,1.60,-.08],35)},{t,view});
  await page.screenshot({path:`validation/anatomy/${view}-${t.toFixed(2)}.png`});
 }
 console.log(JSON.stringify({summary:report.summary,failures:report.failures.slice(0,6),failureCount:report.failures.length},null,2));
 assert.deepEqual(report.errors,[]);assert.equal(report.failures.length,0);
 assert.ok(report.summary.footDrift.max<.001);
  assert.ok(report.summary.guideForwardStep.max<.00001);
  assert.ok(report.summary.joinDisplacement.max<.0005,'Joint position discontinuity at a motion join');
  for(const side of ['R','L']){
  for(const part of ['upperLength','forearmLength']){const r=report.summary[side+'.'+part];assert.ok(r.max-r.min<.001,'Arm stretch')}
 }
 console.log('Focused anatomy check passed: 361 clip samples + 104 launch-window samples.');
} finally {await browser.close()}
