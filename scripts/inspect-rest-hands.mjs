import {chromium} from 'playwright';
const b=await chromium.launch({channel:'chrome',headless:true});
const p=await b.newPage({viewport:{width:800,height:800}});
await p.goto('http://127.0.0.1:4173');await p.waitForFunction(()=>window.lab?.ready);
await p.evaluate(()=>{lab.play(false);lab.present(true);for(const m of lab.meshes)if(m.isSkinnedMesh)m.pose();document.querySelector('#present-hint').style.display='none'});
for(const [name,sign]of [['cross-normal',1],['opposite-normal',-1]]){
 await p.evaluate(sign=>lab.setCamera([-.564-.75*.4*sign,1.161+.662*.4*sign,-.011],[-.564,1.161,-.011],43),sign);
 await p.waitForTimeout(300);await p.screenshot({path:`validation/rest-hand-${name}.png`});
}
await b.close();
