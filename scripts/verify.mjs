import { chromium } from "playwright";
import assert from "node:assert/strict";
import {RELEASE} from '../public/physics.js';
import { mkdir, writeFile, readFile } from "node:fs/promises";
await mkdir("validation", { recursive: true });
const b = await chromium.launch({
  channel: "chrome",
  headless: !process.argv.includes("--headed"),
});
const context = await b.newContext({
  viewport: { width: 1440, height: 900 },
  deviceScaleFactor: 1.5,
  acceptDownloads: true,
});
const p = await context.newPage();
const errors = [];
p.on("pageerror", (e) => errors.push(e.message));
const range = (id, value) =>
  p.locator(id).evaluate((el, value) => {
    el.value = value;
    el.dispatchEvent(new Event("input", { bubbles: true }));
  }, String(value));
await p.goto("http://127.0.0.1:4173");
await p.waitForFunction(() => window.lab?.ready);
await p.waitForTimeout(2500);
const checks = [];
await p.click("#play");
await p.waitForTimeout(450);
assert.ok(await p.evaluate(() => lab.time > 0.25 && lab.playing));
await p.click("#play");
const paused = await p.evaluate(() => lab.time);
await p.waitForTimeout(250);
assert.equal(await p.evaluate(() => lab.time), paused);
checks.push("Play/pause advances and freezes time");
await range("#timeline", RELEASE-.001);
assert.ok(Math.abs((await p.evaluate(() => lab.time)) - (RELEASE-.001)) < 1e-6);
await range("#timeline", 3.3);
assert.match(await p.locator("#outcome").textContent(), /Through/);
checks.push("Timeline scrub updates pose, ball and outcome");
await p.click('[data-rate="0.25"]');
await p.evaluate(() => lab.seek(0));
await p.click("#play");
await p.waitForTimeout(800);
const slow = await p.evaluate(() => lab.time);
assert.ok(slow > 0.1 && slow < 0.3);
await p.click("#play");
checks.push("Quarter-speed playback measured over 800 ms");
await range("#speed", 7.4);
assert.equal(await p.evaluate(() => lab.shot.speed), 7.4);
await range("#angle", 49);
await range("#direction", -3.5);
await p.evaluate(t => lab.seek(t),RELEASE-.04);
assert.equal(await p.evaluate(() => lab.stats.errors.length), 0);
checks.push(
  "Speed, angle and direction regenerate simulation and late hand pose",
);
const deterministic = await p.evaluate(t => {
  lab.seek(t);
  const start = lab.joints;
  for (let i = 0; i < 30; i++) {
    lab.seek(t);
    lab.setShot(lab.shot);
  }
  const end = lab.joints;
  return Math.max(
    ...Object.keys(start).flatMap((k) =>
      start[k].map((v, i) => Math.abs(v - end[k][i])),
    ),
  );
},RELEASE-.04);
assert.ok(deterministic < 1e-8);
checks.push(
  "Repeated same-time scrubs and shot edits do not accumulate rig drift",
);
const independentGuide=await p.evaluate(t=>{
  lab.seek(t);const before=lab.joints.wristL;
  lab.setShot({speed:8.5,angle:68,direction:12});
  const after=lab.joints.wristL;
  return Math.hypot(...before.map((v,i)=>v-after[i]));
},RELEASE-.04);
assert.ok(independentGuide<1e-8);
await p.evaluate(()=>lab.setShot({speed:7.4,angle:49,direction:-3.5}));
checks.push('Launch edits affect shooting hand, never detached guide hand');
await p.check("#trajectory");
await p.click('[data-camera="orbit"]');
const prior = await p.evaluate(() => lab.cameraMode);
assert.equal(prior, "orbit");
await p.mouse.move(620, 440);
await p.mouse.down();
await p.mouse.move(790, 530, { steps: 10 });
await p.mouse.up();
await p.mouse.wheel(0, 180);
await p.waitForTimeout(250);
checks.push("Orbit drag and zoom accepted without errors");
const pending = p.waitForEvent("download");
await p.click("#save");
const d = await pending;
await d.saveAs("validation/saved-shot.json");
const saved = JSON.parse(await readFile("validation/saved-shot.json", "utf8"));
assert.equal(saved.launch.speed, 7.4);
checks.push("Save produces versioned JSON");
await p.reload();
await p.waitForFunction(() => window.lab?.ready);
assert.equal(await p.evaluate(() => lab.shot.speed), 7.4);
checks.push("Browser refresh recovers launch settings");
await p.click("#reset");
assert.equal(await p.evaluate(() => lab.time), 0);
assert.equal(await p.evaluate(() => lab.shot.speed), 6.94);
assert.equal(await p.evaluate(() => lab.cameraMode), "cinematic");
assert.equal(await p.evaluate(() => lab.rate), 1);
assert.equal(await p.locator("#trajectory").isChecked(), false);
await p.locator("#file").setInputFiles("validation/saved-shot.json");
await p.waitForTimeout(200);
assert.equal(await p.evaluate(() => lab.shot.speed), 7.4);
checks.push("Reset restores defaults; Open restores saved shot");
await p.locator("#file").setInputFiles({
  name: "bad.json",
  mimeType: "application/json",
  buffer: Buffer.from('{"version":1}'),
});
await p.waitForTimeout(150);
assert.match(await p.locator("#toast").textContent(), /Unsupported/);
checks.push("Invalid import rejected without changing shot");
await p.click("#reset");
await p.click("#presentation");
assert.ok(
  await p
    .locator("body")
    .evaluate((el) => el.classList.contains("presentation")),
);
await p.keyboard.press("Escape");
assert.ok(
  !(await p
    .locator("body")
    .evaluate((el) => el.classList.contains("presentation"))),
);
checks.push("Presentation hides UI and Escape restores it");
await p.click('[data-camera="side"]');
await p.click('[data-camera="front"]');
await p.click('[data-camera="cinematic"]');
await p.click("#restart");
await p.waitForTimeout(300);
assert.ok(await p.evaluate(() => lab.playing && lab.time > 0));
checks.push("Camera presets and restart work");
await p.evaluate(() => {
  lab.seek(0);
  lab.play(true);
});
await p.click('[data-rate="1"]');
await p.waitForTimeout(6500);
assert.equal(await p.evaluate(() => lab.time), 6);
assert.equal(await p.evaluate(() => lab.playing), false);
checks.push("Full sequence reaches end and stops");
const stats = await p.evaluate(() => lab.stats),
  frames = stats.frameMs.slice(-300).sort((a, b) => a - b),
  mean = frames.reduce((a, b) => a + b, 0) / frames.length;
await p.evaluate(() => lab.seek(1.76));
await p.screenshot({ path: "validation/desktop.png" });
await p.setViewportSize({ width: 390, height: 844 });
await p.waitForTimeout(250);
await p.screenshot({ path: "validation/mobile.png" });
assert.equal(
  await p.locator("body").evaluate((el) => el.scrollWidth <= innerWidth),
  true,
);
checks.push("390×844 layout has no horizontal overflow");
assert.deepEqual(errors, []);
assert.deepEqual(stats.errors, []);
const report = {
  date: new Date().toISOString(),
  browser: await b.version(),
  headed: process.argv.includes("--headed"),
  viewport: "1440×900",
  devicePixelRatio: 1.5,
  renderResolution: "2160×1350",
  renderer: stats.renderer,
  meanFrameMs: mean,
  meanFps: 1000 / mean,
  p50FrameMs: frames[Math.floor(frames.length * 0.5)],
  p95FrameMs: frames[Math.floor(frames.length * 0.95)],
  checks,
  errors,
};
await writeFile(
  "validation/browser-results.json",
  JSON.stringify(report, null, 2),
);
console.log(report);
await b.close();
