import { chromium } from "playwright";
import { mkdtemp, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawn, execFileSync } from "node:child_process";
import assert from "node:assert/strict";

const dest = await mkdtemp(join(tmpdir(), "after-rain-unpack-test-"));
execFileSync("/usr/bin/ditto", [
  "-x",
  "-k",
  "deliverables/After-Rain-Project.zip",
  dest,
]);
const project = join(dest, "After-Rain");
const server = spawn(process.execPath, ["scripts/serve.mjs"], {
  cwd: project,
  env: { ...process.env, PORT: "4174", AFTER_RAIN_OPEN: "0" },
  stdio: "ignore",
});
let browser;
try {
  for (let i = 0; i < 50; i++) {
    try {
      if ((await fetch("http://127.0.0.1:4174")).ok) break;
    } catch {}
    await new Promise((r) => setTimeout(r, 100));
  }
  browser = await chromium.launch({ channel: "chrome", headless: true });
  const page = await browser.newPage({
    viewport: { width: 1280, height: 800 },
  });
  const external = [];
  await page.route("**/*", (route) => {
    if (new URL(route.request().url()).hostname === "127.0.0.1")
      return route.continue();
    external.push(route.request().url());
    return route.abort();
  });
  await page.goto("http://127.0.0.1:4174");
  await page.waitForFunction(() => window.lab?.ready);
  assert.equal(await page.evaluate(() => lab.shot.speed), 6.94);
  await page.evaluate(() => lab.seek(3.3));
  assert.match(await page.locator("#outcome").textContent(), /Through/);
  assert.deepEqual(await page.evaluate(() => lab.stats.errors), []);
  assert.deepEqual(external, []);
  const included = {};
  for (const name of [
    "deliverables/After Rain.blend",
    "deliverables/After-Rain.mp4",
    "deliverables/stills/01-courtside.png",
    "deliverables/stills/02-the-release.png",
    "deliverables/stills/03-the-basket.png",
    "node_modules/three/LICENSE",
    "README.md",
    "scripts/build_scene.py",
  ]) {
    included[name] = (await stat(join(project, name))).size;
    assert.ok(included[name] > 0);
  }
  const report = {
    date: new Date().toISOString(),
    archiveExtracted: true,
    viewerBooted: true,
    externalRequests: external,
    defaultShotThroughRim: true,
    included,
  };
  await writeFile(
    "validation/package-results.json",
    JSON.stringify(report, null, 2),
  );
  console.log(report);
} finally {
  if (browser) await browser.close();
  server.kill("SIGTERM");
}
