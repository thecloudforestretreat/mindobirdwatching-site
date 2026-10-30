import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const html=fs.readFileSync(new URL('../admin/itinerary-generator/index.html',import.meta.url),'utf8');
function source(name){const start=html.indexOf('function '+name+'(');assert.ok(start>=0,name);const indent=html.slice(html.lastIndexOf('\n',start)+1,start);const end=html.indexOf('\n'+indent+'function ',start+1);return html.slice(start,end<0?undefined:end)}

test('guest itinerary deposit produces an exact remaining balance',()=>{
  const c={itineraryStage:data=>data.itineraryStage};vm.createContext(c);vm.runInContext(source('totals'),c);
  const result=c.totals({itineraryStage:'deposit_received',depositReceivedAmount:100,discount:-25,items:[{quantity:2,unitPrice:125},{quantity:1,unitPrice:180}]});
  assert.deepEqual(JSON.parse(JSON.stringify(result)),{subtotal:430,adjustment:-25,total:405,received:100,balance:305});
  assert.equal(c.totals({...result,itineraryStage:'paid_in_full',items:[{quantity:1,unitPrice:405}],discount:0}).balance,0);
});

test('money fields require direct text entry rather than native number spinners',()=>{
  assert.match(html,/id="discount" type="text" inputmode="decimal"/);
  assert.match(html,/data-money-input data-field="unitPrice"/);
  assert.doesNotMatch(html,/type="number"[^>]*data-field="unitPrice"/);
});

test('saved itinerary retains deposit evidence and balance copy in both languages',()=>{
  for(const field of ['depositReceivedAmount','depositReceivedDate','depositReceivedMethod','depositReceivedReference']) assert.match(html,new RegExp(field));
  for(const text of ['Deposit received','Balance due','Depósito recibido','Saldo pendiente']) assert.ok(html.includes(text),text);
  assert.match(html,/prior_payment_amount:data\.depositPaid/);
  assert.match(html,/paymentStatus === 'paid' \? 'paid_in_full' : savedStage \|\|/);
});

test('confirmed itinerary replaces legacy proposal copy and uses a structured receipt card',()=>{
  assert.ok(html.includes('We received your deposit. The services, dates, and remaining balance are summarized below.'));
  assert.ok(html.includes('Hemos recibido su depósito. A continuación encontrará los servicios, las fechas y el saldo pendiente.'));
  assert.ok(html.includes('Thank you for choosing Mindo Bird Watching. Below is your proposed itinerary.'));
  assert.match(html,/function effectiveOpening\(data\)/);
  assert.match(html,/class="paymentReceipt"/);
  assert.match(html,/class="paymentReceiptItem"/);
  assert.match(html,/\.guestHeroImage\{[^}]*aspect-ratio:16\/7;[^}]*object-fit:cover/);
});

test('confirmed layout removes duplicate dates and redundant deposit messaging',()=>{
  assert.match(html,/stripSubjectDates\(data\.tripTitle \|\| c\.defaultTitle\)/);
  assert.ok(html.includes("paymentTitle:'DEPOSIT RECEIVED'"));
  assert.ok(html.includes("paymentText:'Your deposit has been applied to this reservation.\\nThe remaining balance is shown below.'"));
  assert.match(html,/data\.pricingNote && stage !== 'deposit_received'/);
  assert.match(html,/class="nextStepsCard\$\{stage === 'deposit_received' \? ' confirmedNextSteps' : ''\}"/);
  assert.match(html,/function multilineHtml\(value\)/);
});

test('confirmed itinerary uses full guest names and non-repetitive receipt copy',()=>{
  assert.ok(html.includes("opening:'We received your deposit. The services, dates, and remaining balance are summarized below.'"));
  assert.ok(html.includes("closing:'We look forward to welcoming you.\\nSee you soon!'"));
  assert.match(html,/\$\{escapeHtml\(c\.hi\)\} \$\{escapeHtml\(data\.guestName \|\| c\.guest\)\}/);
  assert.match(html,/const guestName = data\.guestName \|\|/);
  assert.match(html,/const crmFullName = state\.crmRecord\?\.full_name/);
  assert.match(html,/depositReceivedBox/);
  assert.match(html,/depositReceiptHeader/);
});
