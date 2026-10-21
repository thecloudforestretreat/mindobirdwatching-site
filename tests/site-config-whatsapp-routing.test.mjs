import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

function loadSiteConfig(){
  const source=fs.readFileSync(new URL('../assets/js/site-config.js',import.meta.url),'utf8');
  const document={
    readyState:'loading',
    body:{getAttribute:()=>''},
    documentElement:{getAttribute:()=>'',childNodes:[]},
    head:{appendChild:()=>{}},
    addEventListener:()=>{},
    querySelector:()=>null,
    querySelectorAll:()=>[],
    createElement:()=>({setAttribute:()=>{},addEventListener:()=>{}})
  };
  const context={
    console,
    document,
    Intl,
    Date,
    Promise,
    Blob,
    URL,
    encodeURIComponent,
    setTimeout,
    clearTimeout,
    navigator:{},
    location:{href:'https://mindobirdwatching.com/tours/',pathname:'/tours/'},
    MBWAttribution:{prepareContactUrl:url=>({url,contact_intent_id:'ci_test'})}
  };
  context.window=context;
  vm.runInNewContext(source,context,{filename:'site-config.js'});
  return context.MBW_SITE_CONFIG;
}

test('scheduled routing changes at 7:00 and 19:00 in Ecuador',()=>{
  const config=loadSiteConfig();
  const active=config.getActiveWhatsAppContact;

  assert.equal(active(new Date('2026-10-21T11:59:00Z')).numberDigits,'593969076501');
  assert.equal(active(new Date('2026-10-21T12:00:00Z')).numberDigits,'13054585402');
  assert.equal(active(new Date('2026-10-21T23:59:00Z')).numberDigits,'13054585402');
  assert.equal(active(new Date('2026-10-22T00:00:00Z')).numberDigits,'593969076501');
});

test('single mode can return either contact for 24-hour coverage',()=>{
  const config=loadSiteConfig();
  config.whatsappRouting.mode='single';

  config.whatsappRouting.singleContactKey='day';
  assert.equal(config.getActiveWhatsAppContact(new Date('2026-10-22T03:00:00Z')).numberDigits,'13054585402');
  assert.match(config.buildWhatsAppUrl('default_en'),/^https:\/\/wa\.me\/13054585402\?/);

  config.whatsappRouting.singleContactKey='night';
  assert.equal(config.getActiveWhatsAppContact(new Date('2026-10-21T15:00:00Z')).numberDigits,'593969076501');
  assert.match(config.buildWhatsAppUrl('default_en'),/^https:\/\/wa\.me\/593969076501\?/);
});

test('scheduled contacts retain stable attribution identities',()=>{
  const config=loadSiteConfig();
  const day=config.getActiveWhatsAppContact(new Date('2026-10-21T12:00:00Z'));
  const night=config.getActiveWhatsAppContact(new Date('2026-10-22T00:00:00Z'));

  assert.equal(day.agentId,'susana');
  assert.equal(day.shift,'day_shift');
  assert.equal(night.agentId,'mbw_admin');
  assert.equal(night.shift,'night_shift');
});
