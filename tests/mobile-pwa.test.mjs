import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

test("the installable Action Desk uses the dedicated gold MBW home-screen icon", () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(root, "admin/site.webmanifest"), "utf8"));
  const index = fs.readFileSync(path.join(root, "admin/app/index.html"), "utf8");
  const worker = fs.readFileSync(path.join(root, "admin/app/sw.js"), "utf8");
  assert.equal(manifest.start_url, "/app/");
  assert.equal(manifest.scope, "/app/");
  assert.deepEqual(manifest.icons.map(icon => icon.src), [
    "/assets/images/app/mbw-app-gold-192.png",
    "/assets/images/app/mbw-app-gold-512.png",
    "/assets/images/app/mbw-app-gold-512.png",
  ]);
  assert.match(index, /apple-touch-icon[^>]+mbw-app-gold-180\.png/);
  assert.match(worker, /mbw-mobile-shell-v7/);
  for (const file of ["mbw-app-gold-180.png", "mbw-app-gold-192.png", "mbw-app-gold-512.png"]) {
    assert.ok(fs.statSync(path.join(root, "admin/assets/images/app", file)).size > 10_000, `${file} should be a real icon asset`);
  }
});
