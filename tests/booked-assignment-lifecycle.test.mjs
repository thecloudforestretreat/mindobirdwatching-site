import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const html=fs.readFileSync(new URL("../admin/guest-crm/index.html",import.meta.url),"utf8");

test("CRM JavaScript parses",()=>{
  const scripts=[...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi)].map(match=>match[1]).filter(source=>source.trim());
  assert.ok(scripts.length);
  scripts.forEach(source=>new Function(source));
});

test("Booked queue considers unfinished assignments before treating a trip as past",()=>{
  const match=html.match(/function isPastTourRecord\(record\)\{([\s\S]*?)\n\s*\}/);
  assert.ok(match,"isPastTourRecord must exist");
  assert.match(match[1],/currentAssignmentRows\(record\)/);
  assert.match(match[1],/assignment_status/);
  assert.match(match[1],/!=="completed"/);
  assert.match(match[1],/normalizeStatus\(record\.status\)==="booked"&&hasUnfinishedAssignment/);
  assert.match(match[1],/assignments\.map\(item=>toDateValue\(item\.service_date\)\)/);
});

test("assignment services use catalog times, stable item IDs, and chronological time parsing",()=>{
  assert.match(html,/MBW004:\{start_time:"06:00",end_time:"09:00"\}/);
  assert.match(html,/MBW006:\{start_time:"05:00",end_time:"15:00"\}/);
  assert.match(html,/MBW016:\{start_time:"19:00",end_time:"21:00"\}/);
  assert.match(html,/schedule\.start_time\|\|defaultAssignmentStart/);
  assert.match(html,/schedule\.end_time/);
  assert.match(html,/service_item_id:serviceItemId/);
  assert.match(html,/match\[3\]==="pm"&&hour<12/);
  assert.match(html,/assignmentDisplayProduct\(item\)/);
});
