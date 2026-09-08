import { chromium } from "playwright";
import { writeFile } from "node:fs/promises";
import assert from "node:assert/strict";
const b = await chromium.launch({ channel: "chrome", headless: true });
const p = await b.newPage({ viewport: { width: 1280, height: 800 } });
await p.goto("http://127.0.0.1:4173");
await p.waitForFunction(() => window.lab?.ready);
const report = await p.evaluate(() => {
  const distances = {},
    samples = [];
  const pairs = [
    ["upperarm01R", "lowerarm01R"],
    ["lowerarm01R", "wristR"],
    ["upperarm01L", "lowerarm01L"],
    ["lowerarm01L", "wristL"],
    ["upperleg01R", "lowerleg01R"],
    ["lowerleg01R", "footR"],
  ];
  for (let frame = 0; frame <= 360; frame++) {
    lab.seek(frame / 60);
    const j = lab.joints;
    for (const [a, b] of pairs) {
      const d = Math.hypot(...j[a].map((x, i) => x - j[b][i]));
      const key = a + " → " + b;
      if (!distances[key]) distances[key] = [];
      distances[key].push(d);
    }
    samples.push({
      time: frame / 60,
      ball: lab.ballPosition,
      footR: j.footR,
      footL: j.footL,
      wristL:j.wristL,
      wristR:j.wristR,
    });
  }
  return {
    samples,
    limbs: Object.fromEntries(
      Object.entries(distances).map(([k, v]) => [
        k,
        {
          min: Math.min(...v),
          max: Math.max(...v),
          variation: Math.max(...v) - Math.min(...v),
        },
      ]),
    ),
    errors: lab.stats.errors,
    guideDetach:lab.motion.guideDetach,
  };
});
assert.equal(report.samples.length, 361);
assert.deepEqual(report.errors, []);
for (const s of report.samples)
  assert.ok([...s.ball, ...s.footR, ...s.footL].every(Number.isFinite));
report.maxFootJointDrift = Math.max(
  ...report.samples.flatMap((s) =>
    ["footR", "footL"].map((k) =>
      Math.hypot(...s[k].map((v, i) => v - report.samples[0][k][i])),
    ),
  ),
);
assert.ok(report.maxFootJointDrift < 0.001);
for (const limb of Object.values(report.limbs))
  assert.ok(limb.variation < 0.001);
const guideSamples=report.samples.filter(s=>s.time>=report.guideDetach);
report.maxGuideForwardStep=Math.max(...guideSamples.slice(1).map((s,i)=>s.wristL[2]-guideSamples[i].wristL[2]));
assert.ok(report.maxGuideForwardStep < .00001, 'Guide hand must not push toward the basket after detaching');
await writeFile(
  "validation/motion-audit.json",
  JSON.stringify(report, null, 2),
);
console.log({
  samples: report.samples.length,
  limbs: report.limbs,
  maxFootJointDrift: report.maxFootJointDrift,
});
await b.close();
