import { chromium } from "playwright";
import { spawn, execFileSync } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { once } from "node:events";
import {RELEASE} from '../public/physics.js';
const root = process.cwd();
await mkdir("deliverables/stills", { recursive: true });
const ffmpeg = execFileSync(
  root + "/.venv/bin/python",
  ["-c", "import imageio_ffmpeg;print(imageio_ffmpeg.get_ffmpeg_exe())"],
  { encoding: "utf8" },
).trim();
execFileSync(root + "/.venv/bin/python", ["scripts/make_audio.py"]);
const b = await chromium.launch({ channel: "chrome", headless: true });
const p = await b.newPage({
  viewport: { width: 1920, height: 1080 },
  deviceScaleFactor: 1,
});
const errors = [];
p.on("pageerror", (e) => errors.push(e.message));
await p.goto("http://127.0.0.1:4173");
await p.waitForFunction(() => window.lab?.ready);
await p.waitForTimeout(1500);
await p.evaluate(() => {
  lab.present(true);
  document.querySelector("#present-hint").style.display = "none";
  lab.setShot({ speed: 6.94, angle: 52, direction: 1.72 });
  lab.play(false);
});
await p.waitForTimeout(600);
for (const [name, t, pos, target, fov] of [
  ["01-courtside", 1.15, [-4.3, 2.3, -4.6], [0, 1.65, 1.6], 38],
  ["02-the-release", RELEASE-.005, [-2.1, 1.9, 1.7], [-0.1, 1.55, 0], 43],
  ["03-the-basket", RELEASE+.91, [-2.1, 2.75, 1.45], [0, 3.12, 4.1], 43],
]) {
  await p.evaluate(
    ({ t, pos, target, fov }) => {
      lab.setCamera(pos, target, fov);
      lab.seek(t);
    },
    { t, pos, target, fov },
  );
  await p.waitForTimeout(500);
  await p.screenshot({ path: `deliverables/stills/${name}.png` });
}
const args = [
  "-y",
  "-f",
  "image2pipe",
  "-vcodec",
  "mjpeg",
  "-r",
  "30",
  "-i",
  "pipe:0",
  "-i",
  "deliverables/ambience.wav",
  "-c:v",
  "libx264",
  "-preset",
  "medium",
  "-crf",
  "18",
  "-pix_fmt",
  "yuv420p",
  "-c:a",
  "aac",
  "-b:a",
  "160k",
  "-shortest",
  "-movflags",
  "+faststart",
  "deliverables/After-Rain.mp4",
];
const enc = spawn(ffmpeg, args, { stdio: ["pipe", "ignore", "pipe"] });
let log = "";
enc.stderr.on("data", (d) => (log += d));
const done = once(enc, "exit");
function movieTime(s) {
  // Three complete 1x takes. Camera cuts occur ONLY between takes, never speed ramps.
  if(s<1)return 0;
  if(s<7)return s-1;
  if(s<13)return s-7;
  if(s<19)return s-13;
  return 6;
}
for (let frame = 0; frame < 600; frame++) {
  const s = frame / 30,
    t = movieTime(s);
  const data = await p.evaluate(
    ({ s, t }) => {
      if (s>=7 && s<13) {
        lab.setCamera([-2.65,1.8,.6],[-.06,1.55,.10],40);
      } else if(s>=13 && s<19) {
        lab.setCamera([-1.5,1.8,2.6],[-.06,1.55,.05],40);
      } else {
        lab.mode("cinematic");
      }
      const src = lab.renderFrame(t, "image/jpeg"),
        image = new Image();
      return new Promise((resolve) => {
        image.onload = () => {
          const c = document.createElement("canvas");
          c.width = 1920;
          c.height = 1080;
          const ctx = c.getContext("2d");
          ctx.drawImage(image, 0, 0);
          const v = ctx.createRadialGradient(960, 520, 300, 960, 520, 1150);
          v.addColorStop(0, "rgba(0,7,12,0)");
          v.addColorStop(1, "rgba(0,7,12,.35)");
          ctx.fillStyle = v;
          ctx.fillRect(0, 0, 1920, 1080);
          if (s < 3) {
            ctx.globalAlpha = Math.min(1, s / 0.4, (3 - s) / 0.5);
            ctx.fillStyle = "#e8e6da";
            ctx.font = "18px Arial";
            ctx.fillText("A F T E R   R A I N", 54, 60);
            ctx.font = "11px Arial";
            ctx.fillStyle = "#a8bcbf";
            ctx.fillText("RIGHT HAND SHOOTS / LEFT HAND GUIDES / REAL-TIME 1x", 54, 83);
          }
          if (s > 17.8) {
            ctx.globalAlpha = Math.min(1, (s - 17.8) / 0.5);
            ctx.font = "11px Arial";
            ctx.fillStyle = "#c8d2d0";
            ctx.fillText("AUTHORED ATHLETE  /  HYPOTHETICAL PHYSICS", 54, 1032);
          }
          if((s>=7&&s<8.7)||(s>=13&&s<14.7)) {
            ctx.globalAlpha=1;ctx.fillStyle='#d6dedc';ctx.font='12px Arial';
            ctx.fillText(s<13?'SIDE REPLAY / 1x / NO SPEED RAMP':'FRONT REPLAY / 1x / NO SPEED RAMP',54,60);
          }
          resolve(c.toDataURL("image/jpeg", 0.96).split(",")[1]);
        };
        image.src = src;
      });
    },
    { s, t },
  );
  if (!enc.stdin.write(Buffer.from(data, "base64")))
    await once(enc.stdin, "drain");
  if (frame % 60 === 0) console.log(`Rendered ${frame}/600 frames`);
}
enc.stdin.end();
const [code] = await done;
if (code !== 0) throw Error(log.slice(-3000));
await writeFile(
  "validation/video-render.json",
  JSON.stringify(
    {
      frames: 600,
      fps: 30,
      width: 1920,
      height: 1080,
      duration: 20,
      errors,
      method:
        "Three complete 1x takes, no speed ramps; deterministic browser rendering and original synthesized ambience.",
    },
    null,
    2,
  ),
);
await b.close();
console.log("Video and three stills ready.");
