import {chromium} from 'playwright';
import {mkdir,writeFile} from 'node:fs/promises';
const b=await chromium.launch({channel:'chrome',headless:true});
const p=await b.newPage({viewport:{width:900,height:1000}});
await mkdir('validation/hand-fix',{recursive:true});
await p.goto('http://127.0.0.1:4173');await p.waitForFunction(()=>window.lab?.ready);
await p.evaluate(()=>{lab.play(false);lab.present(true);document.querySelector('#present-hint').style.display='none'});
await p.waitForTimeout(1200);
const times=[0,.30,.60,.90,1.05,1.15,1.25,1.38,1.53];
const data=[];
for(const view of ['front','side'])for(const t of times){
 await p.evaluate(({t,view})=>{
  lab.seek(t);lab.setCamera(view==='front'?[-1.1,1.85,2.4]:[-2.6,1.75,.15],[-.04,1.60,-.08],35);
 },{t,view});
 await p.waitForTimeout(100);
 await p.screenshot({path:`validation/hand-fix/${view}-${t.toFixed(2)}.png`});
 if(view==='front')data.push(await p.evaluate(()=>({t:lab.time,ball:lab.ballPosition,joints:lab.joints})));
}
await writeFile('validation/hand-fix/joints.json',JSON.stringify(data,null,2));
await b.close();
