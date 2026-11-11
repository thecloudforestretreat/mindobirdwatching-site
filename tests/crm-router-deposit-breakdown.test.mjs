import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source=fs.readFileSync(new URL('../deployment/multi-invoice-ledger/crm-router.gs',import.meta.url),'utf8');
const context={console};
vm.createContext(context);
vm.runInContext(source,context);

test('CRM payment routing separates an applied deposit from the balance payment',()=>{
  const result=context.invoicePaymentBreakdown_({amount_received:'$250.00',deposit_applied_amount:'100'});
  assert.deepEqual(JSON.parse(JSON.stringify(result)),{total:'250.00',deposit:'100',additional:'150.00'});
});

test('CRM payment routing leaves a no-deposit invoice intact',()=>{
  const result=context.invoicePaymentBreakdown_({amount_received:'75',deposit_applied_amount:''});
  assert.deepEqual(JSON.parse(JSON.stringify(result)),{total:'75',deposit:'',additional:'75.00'});
});
