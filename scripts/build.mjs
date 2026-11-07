import { cp, mkdir, readdir, rm } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

const STATIC_FILES = [
  "index.html",
  "view_ratings.html",
  "admin.html",
  "faq.html",
  "privacy.html",
  "terms.html",
  "routeData.js",
];

const publicDir = path.join(root, "public");
await rm(publicDir, { recursive: true, force: true });
await mkdir(publicDir, { recursive: true });

for (const file of STATIC_FILES) {
  await cp(path.join(root, file), path.join(publicDir, file));
}

const jsDir = path.join(root, "js");
const publicJsDir = path.join(publicDir, "js");
await mkdir(publicJsDir, { recursive: true });
const jsFiles = (await readdir(jsDir).catch(() => [])).filter((f) => f.endsWith(".js"));
for (const file of jsFiles) {
  await cp(path.join(jsDir, file), path.join(publicJsDir, file));
}

console.log(
  `build: copied ${STATIC_FILES.length} static file(s) and ${jsFiles.length} JS module(s) to public/`
);

const migrate = spawnSync(process.execPath, ["scripts/migrate.mjs"], {
  cwd: root,
  stdio: "inherit",
  env: process.env,
});
if (migrate.status !== 0) {
  process.exit(migrate.status ?? 1);
}

console.log("build: complete");
