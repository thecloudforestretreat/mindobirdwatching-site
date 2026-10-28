import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import {fileURLToPath, pathToFileURL} from "node:url";

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"..");
const modulePath=path.join(root,"admin/assets/js/media-watermark.js");
await import(pathToFileURL(modulePath).href+"?qa="+Date.now());

const watermark=globalThis.MBWMediaWatermark;

test("watermark variants are optional and named predictably",()=>{
  assert.equal(watermark.variantSuffix({}),"");
  assert.equal(watermark.variantSuffix({logo:true}),"-logo");
  assert.equal(watermark.variantSuffix({url:true}),"-url");
  assert.equal(watermark.variantSuffix({logo:true,url:true}),"-logo-url");
});

test("1080 by 1350 layout matches the approved centered treatment",()=>{
  const both=watermark.layout(1080,1350,{logo:true,url:true});
  assert.equal(both.logoOpacity,.6);
  assert.equal(both.logoSize,173);
  assert.equal(both.logoX,454);
  assert.ok(both.logoY>=1030&&both.logoY<=1045);
  assert.equal(both.urlX,540);
  assert.ok(both.urlBaseline>=1265&&both.urlBaseline<=1275);
  const logoOnly=watermark.layout(1080,1350,{logo:true});
  assert.ok(logoOnly.logoY>both.logoY,"logo-only download should sit lower without URL text");
});

test("Media Studio keeps clean downloads as the default and brands single or ZIP downloads",()=>{
  const source=fs.readFileSync(path.join(root,"admin/assets/js/media-studio.js"),"utf8");
  assert.match(source,/downloadBranding:\{logo:false,url:false\}/);
  assert.match(source,/preparedSlide\(url,options\)/);
  assert.match(source,/slides\.map\(function\(url\)\{return preparedSlide\(url,options\)\}\)/);
  assert.match(source,/Publishing images remain unchanged\./);
});

test("Media Studio loads the watermark helper before the download controller",()=>{
  const html=fs.readFileSync(path.join(root,"admin/media/index.html"),"utf8");
  assert.match(html,/media-studio\.css\?v=19/);
  const helper=html.indexOf("media-watermark.js?v=1");
  const analytics=html.indexOf("media-analytics.js?v=3");
  const controller=html.indexOf("media-studio.js?v=18");
  assert.ok(helper>=0&&analytics>helper&&controller>analytics);
});

test("watermark preview overrides the publishing-image canvas background",()=>{
  const css=fs.readFileSync(path.join(root,"admin/assets/css/media-studio.css"),"utf8");
  assert.match(css,/\.brandPreview img\{[^}]*background:transparent/);
});

test("the local watermark logo is the high-resolution 1024px asset",()=>{
  const png=fs.readFileSync(path.join(root,"admin/assets/images/app/mbw-watermark-logo.png"));
  assert.equal(png.readUInt32BE(16),1024);
  assert.equal(png.readUInt32BE(20),1024);
});
