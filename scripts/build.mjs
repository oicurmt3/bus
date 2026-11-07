import { cp, mkdir, rm } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

const STATIC_FILES = [
  "index.html",
  "view_ratings.html",
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

console.log(`build: copied ${STATIC_FILES.length} files to public/`);

const migrate = spawnSync(process.execPath, ["scripts/migrate.mjs"], {
  cwd: root,
  stdio: "inherit",
  env: process.env,
});
if (migrate.status !== 0) {
  process.exit(migrate.status ?? 1);
}

console.log("build: complete");
