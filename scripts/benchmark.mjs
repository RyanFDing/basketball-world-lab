import { chromium } from "playwright";
import { writeFile } from "node:fs/promises";

// Run alone: close other test/render processes before collecting these numbers.
const browser = await chromium.launch({ channel: "chrome", headless: false });
const results = [];
for (const spec of [
  { width: 1440, height: 900, dpr: 1.5 },
  { width: 1920, height: 1080, dpr: 1 },
]) {
  const context = await browser.newContext({
    viewport: { width: spec.width, height: spec.height },
    deviceScaleFactor: spec.dpr,
  });
  const page = await context.newPage();
  await page.goto("http://127.0.0.1:4173");
  await page.waitForFunction(() => window.lab?.ready);
  await page.evaluate(() => {
    lab.mode("cinematic");
    lab.play(true);
  });
  await page.waitForTimeout(3000);
  await page.evaluate(() => {
    lab.stats.frameMs.length = 0;
    lab.stats.renderMs.length = 0;
    lab.seek(0);
    lab.play(true);
    window.benchmarkLoop = setInterval(() => {
      if (!lab.playing) lab.play(true);
    }, 50);
  });
  await page.waitForTimeout(12000);
  const result = await page.evaluate(() => {
    clearInterval(window.benchmarkLoop);
    lab.play(false);
    const s = lab.stats,
      a = s.frameMs.slice(1).sort((a, b) => a - b);
    const mean = a.reduce((x, y) => x + y, 0) / a.length;
    return {
      samples: a.length,
      meanFrameMs: mean,
      meanFps: 1000 / mean,
      p50FrameMs: a[Math.floor(a.length * 0.5)],
      p95FrameMs: a[Math.floor(a.length * 0.95)],
      renderer: s.renderer,
      errors: s.errors,
    };
  });
  results.push({
    ...spec,
    renderResolution: `${spec.width * spec.dpr}×${spec.height * spec.dpr}`,
    ...result,
  });
  await context.close();
}
const report = {
  date: new Date().toISOString(),
  browser: await browser.version(),
  headed: true,
  method:
    "12 seconds of repeated shot playback after 3-second warmup. Measured requestAnimationFrame wall-clock intervals; no screenshots or other project render jobs during sampling. Not a GPU timer.",
  results,
};
await writeFile("validation/performance.json", JSON.stringify(report, null, 2));
console.log(report);
await browser.close();
