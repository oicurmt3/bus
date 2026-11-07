import http from "node:http";
import { createReadStream, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { DEV_CLIENT_IP_HEADER } from "../lib/http.js";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const port = Number(process.env.PORT || 8765);

const apiHandlers = {
  "/api/log_rating": () => import("../api/log_rating.js"),
  "/api/ratings": () => import("../api/ratings.js"),
};

const mime = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json",
  ".svg": "image/svg+xml",
  ".png": "image/png",
};

function webRequest(req) {
  const host = req.headers.host || `127.0.0.1:${port}`;
  const url = new URL(req.url || "/", `http://${host}`);
  const headers = new Headers();
  for (const [key, value] of Object.entries(req.headers)) {
    if (value === undefined) continue;
    const lower = key.toLowerCase();
    if (lower === "x-forwarded-for" || lower === "x-real-ip") continue;
    headers.set(key, Array.isArray(value) ? value.join(", ") : String(value));
  }
  headers.delete(DEV_CLIENT_IP_HEADER);
  const remote = req.socket?.remoteAddress?.replace(/^::ffff:/, "") || "127.0.0.1";
  headers.set(DEV_CLIENT_IP_HEADER, remote);
  return new Request(url.toString(), { method: req.method, headers, duplex: "half" });
}

async function readBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  return Buffer.concat(chunks);
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url || "/", `http://${req.headers.host || "127.0.0.1"}`);
    const handlerLoader = apiHandlers[url.pathname];
    if (handlerLoader) {
      const mod = await handlerLoader();
      let request = webRequest(req);
      if (req.method === "POST" || req.method === "PUT" || req.method === "PATCH") {
        const body = await readBody(req);
        request = new Request(request.url, {
          method: request.method,
          headers: request.headers,
          body,
        });
      }
      const method = req.method || "GET";
      const fn = mod[method];
      if (typeof fn !== "function") {
        res.writeHead(405, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ status: "error", message: "Method not allowed" }));
        return;
      }
      const response = await fn(request);
      res.writeHead(response.status, Object.fromEntries(response.headers.entries()));
      res.end(Buffer.from(await response.arrayBuffer()));
      return;
    }

    const blockedPrefixes = [
      "/lib/",
      "/api/",
      "/migrations/",
      "/scripts/",
      "/node_modules/",
      "/cpanel/",
      "/data/",
    ];
    const blockedFiles = new Set([
      "/package.json",
      "/package-lock.json",
      "/cursor-app.json",
      "/log_rating.php",
      "/view_ratings.php",
    ]);
    if (url.pathname.toLowerCase().endsWith(".php")) {
      res.writeHead(404);
      res.end("Not found");
      return;
    }
    if (
      blockedPrefixes.some((p) => url.pathname.startsWith(p)) ||
      blockedFiles.has(url.pathname)
    ) {
      res.writeHead(404);
      res.end("Not found");
      return;
    }

    let filePath = url.pathname === "/" ? "/index.html" : url.pathname;
    filePath = path.normalize(filePath).replace(/^(\.\.(\/|\\|$))+/, "");
    const abs = path.join(root, filePath);
    if (!abs.startsWith(root) || !existsSync(abs) || abs.includes("..")) {
      res.writeHead(404);
      res.end("Not found");
      return;
    }
    const ext = path.extname(abs);
    res.writeHead(200, { "Content-Type": mime[ext] || "application/octet-stream" });
    createReadStream(abs).pipe(res);
  } catch (error) {
    console.error(error);
    res.writeHead(500);
    res.end("Server error");
  }
});

server.listen(port, "127.0.0.1", () => {
  console.log(`Ride Rate dev server at http://127.0.0.1:${port}`);
});
