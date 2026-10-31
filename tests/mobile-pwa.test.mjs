import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

test("MBW Nest uses the dedicated gold home-screen icon and conservative CRM syncing", () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(root, "admin/site.webmanifest"), "utf8"));
  const index = fs.readFileSync(path.join(root, "admin/app/index.html"), "utf8");
  const worker = fs.readFileSync(path.join(root, "admin/app/sw.js"), "utf8");
  const app = fs.readFileSync(path.join(root, "admin/app/app.mjs"), "utf8");
  assert.equal(manifest.name, "MBW Nest");
  assert.equal(manifest.short_name, "MBW Nest");
  assert.equal(manifest.start_url, "/app/?installed=nest-v6");
  assert.equal(manifest.scope, "/app/");
  assert.deepEqual(manifest.icons.map(icon => icon.src), [
    "https://mindobirdwatching.com/assets/images/mbw-nest-ios-public-v2-192.png",
    "https://mindobirdwatching.com/assets/images/mbw-nest-ios-public-v2-512.png",
  ]);
  assert.match(index, /apple-mobile-web-app-title" content="MBW Nest"/);
  assert.match(index, /apple-touch-icon[^>]+\/assets\/images\/app\/mbw-app-gold-transparent-180\.png\?v=nest-ios-20261020-v3/);
  assert.match(index, /apple-touch-icon-precomposed[^>]+\/assets\/images\/app\/mbw-app-gold-transparent-180\.png\?v=nest-ios-20261020-v3/);
  assert.match(index, /rel="icon"[^>]+\/assets\/images\/app\/mbw-app-gold-transparent-192\.png\?v=nest-favicon-20261023-v1/);
  assert.match(index, /<img src="\/assets\/images\/app\/mbw-header-logo-160\.png[^\"]*" alt="">/);
  assert.match(index, /<small>Nest<\/small>/);
  assert.match(worker, /mbw-mobile-shell-v31/);
  assert.match(worker, /app\.css\?v=nest-20261029-v22/);
  assert.match(worker, /app\.mjs\?v=nest-20261029-v24/);
  assert.match(index, /id="guideViewPanel"[^>]+data-owner-only/);
  assert.match(index, />Guide View</);
  assert.match(app, /\/guide\/\?provider=/);
  assert.match(app, /actionRepFilter/);
  assert.match(app, /guestRepFilter/);
  assert.match(index, /id="previousGuest"/);
  assert.match(index, /id="nextGuest"/);
  assert.match(app, /AUTO_SYNC_INTERVAL_MS = 10 \* 60 \* 1000/);
  assert.match(app, /FOREGROUND_SYNC_MIN_AGE_MS = 5 \* 60 \* 1000/);
  assert.match(app, /setInterval\(updateConnectionAge, 30 \* 1000\)/);
  const headerIcon = path.join(root, "admin/assets/images/app/mbw-header-logo-160.png"), headerBytes = fs.readFileSync(headerIcon);
  assert.equal(headerBytes.readUInt8(25), 6, "header logo should preserve transparent pixels");
  for (const file of ["mbw-nest-ios-public-v2-180.png", "mbw-nest-ios-public-v2-192.png", "mbw-nest-ios-public-v2-512.png"]) {
    const iconPath = path.join(root, "assets/images", file), bytes = fs.readFileSync(iconPath);
    assert.ok(fs.statSync(iconPath).size > 10_000, `${file} should be a real icon asset`);
    assert.equal(bytes.readUInt8(25), 6, `${file} should use RGBA color`);
  }
});
