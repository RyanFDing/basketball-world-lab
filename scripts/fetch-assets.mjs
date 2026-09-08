import { mkdir, writeFile } from "node:fs/promises";
const root = new URL("../assets/source/", import.meta.url);
await mkdir(root, { recursive: true });
const files = {
  "base.obj": "3dobjs/base.obj",
  "default.mhskel": "rigs/default.mhskel",
  "default_weights.mhw": "rigs/default_weights.mhw",
  "male.target": "targets/macrodetails/african-male-young.target",
  "athletic.target":
    "targets/macrodetails/universal-male-young-maxmuscle-averageweight.target",
};
for (const [name, path] of Object.entries(files)) {
  const url =
    "https://raw.githubusercontent.com/makehumancommunity/makehuman/master/makehuman/data/" +
    path;
  const r = await fetch(url);
  if (!r.ok) throw Error(url + " " + r.status);
  await writeFile(new URL(name, root), Buffer.from(await r.arrayBuffer()));
  console.log(name);
}
