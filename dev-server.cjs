// Minimal static dev server for local preview (not needed for GitHub Pages).
// Serves this folder via __dirname so it works regardless of launch cwd.
const http = require("http");
const fs = require("fs");
const path = require("path");

const ROOT = __dirname;
const PORT = process.env.PORT || 4175;
const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".cjs": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".ico": "image/x-icon",
  ".webp": "image/webp",
  ".woff2": "font/woff2",
};

http
  .createServer((req, res) => {
    let p = decodeURIComponent((req.url || "/").split("?")[0]);
    if (p === "/" || p.endsWith("/")) p += "index.html";
    const fp = path.join(ROOT, path.normalize(p));
    if (!fp.startsWith(ROOT)) {
      res.writeHead(403);
      return res.end("Forbidden");
    }
    fs.readFile(fp, (err, data) => {
      if (err) {
        res.writeHead(404, { "Content-Type": "text/plain" });
        return res.end("Not found");
      }
      res.writeHead(200, { "Content-Type": MIME[path.extname(fp)] || "application/octet-stream" });
      res.end(data);
    });
  })
  .listen(PORT, () => console.log("bodies-of-work dev server on http://localhost:" + PORT));
