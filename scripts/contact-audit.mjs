import { chromium } from "playwright";
import { writeFile } from "node:fs/promises";
import assert from 'node:assert/strict';
import {RELEASE} from '../public/physics.js';
const b = await chromium.launch({ channel: "chrome", headless: true });
const p = await b.newPage({ viewport: { width: 1280, height: 800 } });
await p.goto("http://127.0.0.1:4173");
await p.waitForFunction(() => window.lab?.ready);
const report = [];
for (const t of [0,.15,.30,.60,.90,1.05,1.15,RELEASE-.05,RELEASE-2/60,RELEASE-.025,RELEASE-1/60,RELEASE-1/120,RELEASE,RELEASE+.02,RELEASE+.1,RELEASE+.3,3.2]) for(const side of ['R','L']) {
  report.push(
    await p.evaluate(async ({t,side}) => {
      const THREE = await import("three");
      lab.seek(t);
      const j = lab.joints,
        ball = lab.ballPosition;
      const meshes = lab.meshes;
      const wr=new THREE.Vector3(...j['wrist'+side]),
        forward=new THREE.Vector3(...j['finger3-1'+side]).sub(wr).normalize(),
        across=new THREE.Vector3(...j['finger2-1'+side]).sub(new THREE.Vector3(...j['finger5-1'+side])),
        palmar=forward.clone().cross(across).normalize().multiplyScalar(side==='R'?-1:1),
        toward=new THREE.Vector3(...ball).sub(wr.clone().addScaledVector(forward,.075)).normalize();
      let normalCorrection=-Infinity, min = Infinity,
        closest = null,
        inside = 0,
        handverts = 0,
        feet = { minY: Infinity, maxY: -Infinity, maxZ: -Infinity };
      for (const o of meshes) {
        if (!o.isSkinnedMesh) continue;
        o.skeleton.update();
        if (/shoes0[12]/.test(o.name)) {
          for (let i = 0; i < o.geometry.attributes.position.count; i++) {
            let v = o
              .getVertexPosition(i, new THREE.Vector3())
              .applyMatrix4(o.matrixWorld);
            feet.minY = Math.min(feet.minY, v.y);
            feet.maxY = Math.max(feet.maxY, v.y);
            feet.maxZ = Math.max(feet.maxZ, v.z);
          }
        }
        if (!/continuous/.test(o.name)) continue;
        const si = o.geometry.attributes.skinIndex,
          sw = o.geometry.attributes.skinWeight;
        for (let i = 0; i < si.count; i++) {
          let w = 0;
          for (let k = 0; k < 4; k++) {
            const n = o.skeleton.bones[si.getComponent(i, k)]?.name || "";
            if (
              (n.startsWith("finger") || n.startsWith("wrist")) &&
              n.endsWith(side)
            )
              w += sw.getComponent(i, k);
          }
          if (w < 0.5) continue;
          let v = o
              .getVertexPosition(i, new THREE.Vector3())
              .applyMatrix4(o.matrixWorld),
            d = v.distanceTo(new THREE.Vector3(...ball));
          handverts++;
          const rel=v.clone().sub(new THREE.Vector3(...ball)),normalDistance=rel.dot(palmar),tangentSq=rel.lengthSq()-normalDistance*normalDistance;
          if(tangentSq<.119**2) normalCorrection=Math.max(normalCorrection,normalDistance+Math.sqrt(.119**2-tangentSq));
          if (d < 0.119) inside++;
          if (d < min) {
            min = d;
            closest = v.toArray();
          }
        }
      }
      return {
        t, side, palmFacingBall:palmar.dot(toward), palmar:palmar.toArray(),normalCorrection,
        ball,
        wrist: j['wrist'+side],
        minHandBallDistance: min,
        surfaceGap: min - 0.119,
        closest,
        inside,
        handverts,
        feet,
      };
    }, {t,side}),
  );
}
await writeFile(
  "validation/contact-audit.json",
  JSON.stringify(report, null, 2),
);
for(const row of report) {
  assert.ok(row.feet.minY > -.001 && row.feet.minY < .001);
  if(row.t<=RELEASE && row.side==='R') {
    assert.ok(row.surfaceGap > -.005 && row.surfaceGap < .006, `Shooting contact at ${row.t}: ${row.surfaceGap}`);
    assert.ok(row.palmFacingBall > .7, `Inverted shooting palm at ${row.t}`);
  }
  if(row.t<=.9 && row.side==='L') {
    assert.ok(row.surfaceGap > -.005 && row.surfaceGap < .006);
    assert.ok(row.palmFacingBall > .9, `Inverted guide palm at ${row.t}`);
  }
}
console.log(
  report.map((x) => ({
    t: x.t,side:x.side,palmFacingBall:x.palmFacingBall,
    gap: x.surfaceGap,
    feet: x.feet.minY,
    wrist: x.wrist,
    ball: x.ball,
  })),
);
await b.close();
