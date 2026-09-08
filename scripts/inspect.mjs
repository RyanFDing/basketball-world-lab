import { chromium } from "playwright";
import { mkdir, writeFile } from "node:fs/promises";
const dir = "validation";
await mkdir(dir, { recursive: true });
const b = await chromium.launch({ channel: "chrome", headless: true });
const p = await b.newPage({ viewport: { width: 1600, height: 1000 } });
const errors = [];
p.on("pageerror", (e) => errors.push(e.message));
await p.goto("http://127.0.0.1:4173");
await p.waitForFunction(() => window.lab?.ready);
await p.waitForTimeout(1200);
for (const [name, t, mode] of [
  ["hero", 1.15, "cinematic"],
  ["front-settle", 0, "front"],
  ["front-gather", .3, "front"],
  ["side-set", 1.15, "side"],
  ["side-release", 1.25, "side"],
  ["front-finish", 1.53, "front"],
  ["hero-flight", 1.9, "cinematic"],
]) {
  await p.evaluate(
    ({ t, mode }) => {
      lab.present(true);
      lab.mode(mode);
      lab.seek(t);
    },
    { t, mode },
  );
  await p.waitForTimeout(500);
  await p.screenshot({ path: `${dir}/${name}.png` });
}
await writeFile(
  `${dir}/initial-browser.json`,
  JSON.stringify(
    await p.evaluate(() => ({
      errors: lab.stats.errors,
      renderer: lab.stats.renderer,
      events: lab.simulation.events,
      joints: lab.joints,
    })),
    null,
    2,
  ),
);
console.log({ errors });
await b.close();
