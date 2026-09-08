import http from "node:http";
import { readFile, stat } from "node:fs/promises";
import { resolve, extname, sep } from "node:path";
import { execFile } from "node:child_process";
const root = resolve(import.meta.dirname, ".."),
  port = Number(process.env.PORT || 4173);
const types = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".mjs": "text/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".glb": "model/gltf-binary",
  ".jpg": "image/jpeg",
  ".png": "image/png",
  ".hdr": "application/octet-stream",
  ".mp4": "video/mp4",
};
http
  .createServer(async (req, res) => {
    try {
      let path = decodeURIComponent(
        new URL(req.url, "http://localhost").pathname,
      );
      const base = path.startsWith("/node_modules/")
        ? root
        : resolve(root, "public");
      let file = resolve(base, "." + (path === "/" ? "/index.html" : path));
      if (!file.startsWith(base + sep)) {
        res.writeHead(403);
        return res.end();
      }
      let data = await readFile(file);
      res.writeHead(200, {
        "Content-Type": types[extname(file)] || "application/octet-stream",
        "Cache-Control": "no-cache",
      });
      res.end(data);
    } catch {
      res.writeHead(404);
      res.end("Not found");
    }
  })
  .listen(port, "127.0.0.1", () => {
    const url = `http://127.0.0.1:${port}`;
    console.log(`After Rain — ${url}`);
    if (process.env.AFTER_RAIN_OPEN === "1" && process.platform === "darwin")
      execFile("open", ["-a", "Google Chrome", url], (error) => {
        if (error) execFile("open", [url]);
      });
  });
