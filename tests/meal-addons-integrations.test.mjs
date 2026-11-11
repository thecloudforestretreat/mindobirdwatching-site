import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const read = (path) => fs.readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

const crmMain = read("admin/guest-crm/index.html");
const crmLab = read("admin/guest-crm-lab/index.html");
const workflow = read("admin/guest-crm-lab/workflow-engine.js");
const emailBlocks = read("assets/js/email-blocks.js");
const emailGenerator = read("admin/custom-email-generator/index.html");
const inquirySource = read("services/inquiry-studio/vendor/editor-source.html");
const inquiryPublic = read("services/inquiry-studio/public/editor.html");
const itinerary = read("admin/itinerary-generator/index.html");

test("all CRM workflows expose meals, add-on duration, and the three new staff products", () => {
  for (const source of [crmMain, workflow]) {
    assert.match(source, /MEAL001 - Breakfast/);
    assert.match(source, /MEAL002 - Lunch/);
    assert.match(source, /TRANS007 - Within Mindo Transportation/);
  }
  for (const source of [crmMain, crmLab]) {
    assert.match(source, />Meal</);
    assert.match(source, />Add-on</);
  }
  assert.match(workflow, /"Meal"/);
  assert.match(workflow, /"Add-on"/);
});

test("meal blocks use the approved images in every email generator build", () => {
  for (const source of [emailBlocks, emailGenerator, inquirySource, inquiryPublic]) {
    assert.match(source, /meal-breakfast/);
    assert.match(source, /meal-lunch/);
    assert.match(source, /assets\/images\/food\/mbw_breakfast_001\.jpeg/);
    assert.match(source, /assets\/images\/food\/mbw_lunch_chicken_001\.jpeg/);
  }
});

test("within-Mindo transportation stays out of guest email and itinerary generators", () => {
  for (const source of [emailBlocks, emailGenerator, inquirySource, inquiryPublic, itinerary]) {
    assert.doesNotMatch(source, /TRANS007/);
    assert.doesNotMatch(source, /Within Mindo Transportation/);
  }
});

test("generated inquiry editor contains its pilot bridge and the rebuilt meal catalog", () => {
  assert.match(inquiryPublic, /pilot-save-request/);
  assert.match(inquiryPublic, /pilot-ready/);
  assert.match(inquiryPublic, /meal-breakfast/);
  assert.match(inquiryPublic, /meal-lunch/);
});
