const text=v=>String(v??'').trim();
export function money(v){if(v===null||v===undefined||text(v)==='')return null;const n=Number(text(v).replace(/[$,\s]/g,''));return Number.isFinite(n)&&n>=0?Math.round(n*100)/100:null;}
const sum=values=>values.reduce((s,n)=>s+(n??0),0);
const max=values=>values.some(n=>n!==null)?Math.max(...values.filter(n=>n!==null)):null;
const day=v=>/^\d{4}-\d{2}-\d{2}$/.test(text(v).slice(0,10))?text(v).slice(0,10):'';
const psAlias=p=>[['invoice_id',p.invoice_id],['invoice_no',p.invoice_no],['transaction_id',p.transaction_id],['payment_id',p.payment_id]].filter(([,v])=>text(v)).map(([k,v])=>k+':'+text(v).toUpperCase().replace(/[^A-Z0-9]/g,''));
const terminal=r=>/^(void|uncollectible|cancelled|refunded)$/i.test(text(r.payment_status));
export function buildBalances({inquiries=[],payments=[],deposits=[],now=new Date()}={}){
 const today=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Guayaquil',year:'numeric',month:'2-digit',day:'2-digit'}).format(now);
 const ids=new Set(inquiries.map(r=>text(r.inquiry_id)));let unmatched=deposits.filter(d=>!ids.has(text(d.inquiry_id))).length;
 const records=inquiries.filter(r=>!['duplicate','archived','cancelled','did_not_book'].includes(text(r.status))).map(r=>{
  const id=text(r.inquiry_id),ds=deposits.filter(d=>text(d.inquiry_id)===id),issues=[];
  const unique=new Map();
  for(const p of payments.filter(p=>text(p.inquiry_id)===id)){
   const key=text(p.invoice_id)||text(p.invoice_no)||text(p.transaction_id)||text(p.payment_id);if(!key){issues.push('Unidentified payment needs review');continue;}
   const alias=psAlias(p);const existing=[...unique.entries()].find(([,row])=>psAlias(row).some(v=>alias.includes(v)));const canonical=existing?.[0]||key;const old=unique.get(canonical);if(!old||text(p.created_at)>text(old.created_at)||(text(p.created_at)===text(old.created_at)&&terminal(p)))unique.set(canonical,p);
  }
  const ps=[...unique.values()].filter(p=>!terminal(p));
  const depUnique=new Map();for(const d of ds){const key=text(d.stripe_payment_intent_id)||text(d.deposit_id);if(key)depUnique.set(key,d);}
  const dd=[...depUnique.values()];
  if(dd.length>1)issues.push('Multiple accounting deposits require review');
  // Accounting totals are cumulative snapshots, never additional payments.
  const externalDeposit=sum(dd.map(d=>money(d.deposit_amount_paid)));
  const includedDeposit=sum(ps.map(p=>money(p.deposit_amount_paid)));
  const invoiceTotal=ps.length&&ps.every(p=>money(p.total_booking_price)!==null)?sum(ps.map(p=>money(p.total_booking_price))):null;
  const invoicePaid=ps.length&&ps.every(p=>money(p.total_amount_paid)!==null)?sum(ps.map(p=>money(p.total_amount_paid))):null;
  if(ps.some(p=>money(p.total_booking_price)===null||money(p.total_amount_paid)===null))issues.push('Invoice amounts are incomplete');
  const ledgerTotal=max(dd.map(d=>money(d.total_booking_price)));
  const ledgerPaid=max(dd.map(d=>money(d.total_amount_paid)??money(d.deposit_amount_paid)));
  const quote=text(r.quote_status)==='accepted'?money(r.accepted_quote_total):null;
  const total=max([ledgerTotal,invoiceTotal,quote]);
  const paid=max([ledgerPaid,invoicePaid===null?(dd.some(d=>money(d.deposit_amount_paid)!==null)?externalDeposit:null):invoicePaid+Math.max(0,externalDeposit-includedDeposit)]);
  const deposit=max([dd.length?externalDeposit:null,ps.length?includedDeposit:null]);
  let balance=total!==null&&paid!==null?Math.max(0,Math.round((total-paid)*100)/100):null;
  if(total!==null&&paid!==null&&paid>total){issues.push('Recorded payments exceed booking total');balance=null;}
  const dueDates=[...new Set(dd.map(d=>day(d.balance_due_date)).filter(Boolean))].sort();
  if(dueDates.length>1)issues.push('Conflicting due dates');
  const dueDate=dueDates.length===1?dueDates[0]:'';
  const diff=dueDate?(Date.parse(dueDate)-Date.parse(today))/86400000:null;
  const status=issues.length?'review':balance===0?'paid':balance===null?'unknown':!dueDate?'undated':diff<0?'overdue':diff<=7?'due_soon':'upcoming';
  return {inquiryId:id,name:text(r.full_name)||[r.first_name,r.last_name].filter(Boolean).join(' ')||id,rep:text(r.assigned_to||r.assigned_rep),tourDate:day(r.tour_date||r.requested_date||r.requested_date_start),completed:text(r.status)==='completed',total,paid,deposit,balance,dueDate,status,issues,sourceCount:dd.length+ps.length};
 });
 return {records,unmatched,checkedAt:now.toISOString(),currency:'USD'};
}
