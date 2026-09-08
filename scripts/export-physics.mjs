import { writeFile } from "node:fs/promises";
import { simulate, DEFAULT } from "../public/physics.js";
await writeFile(
  new URL("../public/assets/default-flight.json", import.meta.url),
  JSON.stringify(simulate({ x: -0.12, y: 2.22, z: 0.19 }, DEFAULT)),
);
