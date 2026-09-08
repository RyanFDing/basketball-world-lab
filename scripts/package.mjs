import {
  cp,
  mkdir,
  mkdtemp,
  readFile,
  writeFile,
  readdir,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";

// Generated archives only; the source project and previous user work are untouched.
const root = process.cwd();
await mkdir("licenses", { recursive: true });
await cp("node_modules/three/LICENSE", "licenses/THREE-LICENSE.txt");
const staging = await mkdtemp(join(tmpdir(), "after-rain-share-"));
const project = join(staging, "After-Rain");
await mkdir(project);
for (const name of [
  "public",
  "scripts",
  "tests",
  "licenses",
  "package.json",
  "package-lock.json",
  "requirements.txt",
  "launch.command",
  "README.md",
  "MODEL_NOTES.md",
  "ANATOMY.md",
  "ASSET_LICENSES.md",
  "VALIDATION.md",
  "VISUAL_TARGET.md",
  "RESUME.md",
])
  await cp(name, join(project, name), { recursive: true });
await mkdir(join(project, "node_modules"), { recursive: true });
await cp("node_modules/three", join(project, "node_modules/three"), {
  recursive: true,
});
await mkdir(join(project, "assets/source"), { recursive: true });
for (const name of [
  "base.obj",
  "default.mhskel",
  "default_weights.mhw",
  "male.target",
  "athletic.target",
  "system",
])
  await cp("assets/source/" + name, join(project, "assets/source", name), {
    recursive: true,
  });
await mkdir(join(project, "deliverables"), { recursive: true });
for (const name of ["After Rain.blend", "After-Rain.mp4", "stills"])
  await cp("deliverables/" + name, join(project, "deliverables", name), {
    recursive: true,
  });
await mkdir(join(project, "validation"), { recursive: true });
await cp('validation/anatomy',join(project,'validation/anatomy'),{recursive:true,filter:(p)=>!p.endsWith('.png')});
for (const name of await readdir("validation"))
  if (name.endsWith(".json"))
    await cp("validation/" + name, join(project, "validation", name));
execFileSync("/usr/bin/ditto", [
  "-c",
  "-k",
  "--norsrc",
  "--keepParent",
  project,
  join(root, "deliverables/After-Rain-Project.zip"),
]);
const site = join(staging, "site");
await cp("public", site, { recursive: true });
await mkdir(join(site, "node_modules"), { recursive: true });
await cp("node_modules/three", join(site, "node_modules/three"), {
  recursive: true,
});
await cp("ASSET_LICENSES.md", join(site, "ASSET_LICENSES.md"));
execFileSync("/usr/bin/ditto", [
  "-c",
  "-k",
  "--norsrc",
  site,
  join(root, "deliverables/After-Rain-Site.zip"),
]);
const hashes = {};
for (const name of [
  "After Rain.blend",
  "After-Rain.mp4",
  "After-Rain-Project.zip",
  "After-Rain-Site.zip",
])
  hashes[name] = createHash("sha256")
    .update(await readFile("deliverables/" + name))
    .digest("hex");
await writeFile("deliverables/SHA256.json", JSON.stringify(hashes, null, 2));
console.log({
  staging,
  projectArchive: "deliverables/After-Rain-Project.zip",
  siteArchive: "deliverables/After-Rain-Site.zip",
});
