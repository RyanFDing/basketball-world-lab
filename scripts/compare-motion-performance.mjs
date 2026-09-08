// Read-only A/B against the pre-revision character export; run without render jobs.
import {chromium} from 'playwright';
import {readFile,writeFile} from 'node:fs/promises';
const browser=await chromium.launch({channel:'chrome',headless:false});
const rows=[];
for(const old of [true,false]) {
 const context=await browser.newContext({viewport:{width:1920,height:1080},deviceScaleFactor:1});
 const p=await context.newPage();
 if(old) await p.route('**/assets/athlete.glb',async route=>route.fulfill({body:await readFile('revisions/2026-09-08-before-hand-fix/athlete.glb'),contentType:'model/gltf-binary'}));
 await p.goto('http://127.0.0.1:4173');await p.waitForFunction(()=>window.lab?.ready);await p.bringToFront();
 await p.evaluate(()=>{lab.mode('cinematic');lab.play(true)});await p.waitForTimeout(3000);
 await p.evaluate(()=>{lab.seek(0);lab.stats.frameMs.length=0;lab.stats.renderMs.length=0;lab.play(true)});
 await p.waitForTimeout(5000);
 rows.push({asset:old?'pre-hand-fix':'hand-fix',...await p.evaluate(()=>{
  const mean=a=>a.reduce((s,v)=>s+v,0)/a.length;
  return {fps:1000/mean(lab.stats.frameMs.slice(1)),renderMs:mean(lab.stats.renderMs),frames:lab.stats.frameMs.length};
 })});
 await context.close();
}
await browser.close();await writeFile('validation/motion-performance-comparison.json',JSON.stringify({date:new Date().toISOString(),rows},null,2));console.log(rows);
