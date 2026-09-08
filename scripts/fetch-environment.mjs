import { mkdir, writeFile } from "node:fs/promises";
const root = new URL("../public/assets/", import.meta.url);
await mkdir(root, { recursive: true });
for (const [asset, types] of [
  ["asphalt_02", ["Diffuse", "nor_gl", "Rough"]],
  ["qwantani_dusk_2_puresky", ["hdri"]],
]) {
  const j = await (
    await fetch("https://api.polyhaven.com/files/" + asset)
  ).json();
  console.log(asset, Object.keys(j));
  for (const type of types) {
    const a = j[type]?.["1k"];
    if (!a) continue;
    const f = type === "hdri" ? a.hdr : a.jpg;
    const r = await fetch(f.url);
    if (!r.ok) throw Error(f.url);
    await writeFile(
      new URL(type === "hdri" ? "dusk.hdr" : type + ".jpg", root),
      Buffer.from(await r.arrayBuffer()),
    );
  }
}
