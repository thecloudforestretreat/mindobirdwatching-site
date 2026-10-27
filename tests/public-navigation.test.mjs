import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
const root=path.resolve(import.meta.dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const data=JSON.parse(read('assets/data/navigation.json'));
const destinations=[...data.groups.flatMap(g=>g.sections.flatMap(s=>s.items)),data.contact,data.book];
test('Every navigation destination exists in both languages and matches sitemap pairing',()=>{
 const sitemap=read('sitemap.xml');
 for(const item of destinations){
  for(const route of [item.path,item.espath])assert.ok(fs.existsSync(path.join(root,route,'index.html')),route);
  const block=sitemap.match(new RegExp('<url>\\s*<loc>https://mindobirdwatching\\.com'+item.path.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'</loc>[\\s\\S]*?</url>'))?.[0];
  assert.ok(block,item.path);assert.ok(block.includes('href="https://mindobirdwatching.com'+item.espath+'"'),item.espath);
 }
});
test('Desktop and mobile include the same complete navigation destinations',()=>{
 const html=read('assets/includes/header.html');
 for(const item of destinations){assert.ok(html.split('data-href-en="'+item.path+'"').length>=3,item.path);assert.ok(html.includes('data-label-es="'+item.es+'"'));}
 assert.ok(!html.includes('data-label-en="Home"'));
 for(const g of data.groups){assert.ok(html.includes('aria-controls="nav-'+g.id+'"'));assert.ok(html.includes('id="nav-'+g.id+'" hidden'));}
});
test('Embedded header snapshots and styles are synchronized',()=>{
 const header=read('assets/includes/header.html').trim(),css=read('assets/css/header.css');
 const pages=['index.html','es/index.html',...JSON.parse(read('scripts/revenue-pages.json')).flat()];
 for(const page of pages){const html=read(page);assert.equal(html.match(/<!-- MBW static header start -->\s*([\s\S]*?)\s*<!-- MBW static header end -->/)[1],header,page);assert.equal(html.match(/<style id="mbwHeaderCSS">([\s\S]*?)<\/style>/)[1],css,page);}
});
