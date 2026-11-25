const clean = value => String(value ?? "").trim();
const money = value => {
  const amount = clean(value).replace(/[$,\s]/g, "").replace(/^\((.*)\)$/, "-$1");
  return amount && Number.isFinite(Number(amount)) ? Math.round(Number(amount) * 100) : null;
};
function day(value) {
  const raw = clean(value);
  const local = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  return local ? `${local[3]}-${local[1].padStart(2,"0")}-${local[2].padStart(2,"0")}` : raw.match(/^\d{4}-\d{2}-\d{2}(?:$|T)/)?.[0].slice(0,10) || "";
}
const inactive = value => /^(?:(?:guest|operator|provider)[ _-]+)?(?:void(?:ed)?|cancel(?:led|ed)|refunded|reversed|deleted)\b/i.test(clean(value));
const keyOf = row => clean(row.tour_key);
const expenseKeyOf = row => keyOf(row) || clean(row.expense_key).match(/^service\|(.+)$/)?.[1] || "";
const providerPayable = row => /^(guide (payout|tip payable|reimbursement)|transportation|lodging pass-through)$/i.test(clean(row.expense_type));

export function freshness(value, now, limitMinutes) {
  const ms = Date.parse(value);
  if (!Number.isFinite(ms) || ms > now + 120000) return { status:"unknown", at:null, age_minutes:null };
  const age = Math.max(0,(now-ms)/60000);
  return {status:age>limitMinutes?"delayed":"current",at:new Date(ms).toISOString(),age_minutes:Math.floor(age)};
}

export function accountingExceptions(tabs, columns, today, snapshotHealth, now = Date.now()) {
  const has = (tab,...names) => Array.isArray(columns?.[tab]) && names.every(name => columns[tab].includes(name));
  const strong = snapshotHealth.status==="current";
  const coverage = {
    metadata: has("invoices","invoice_no","home_country","service_type","product_selected"),
    provider_expenses: has("invoices","tour_key","tour_guide","total_amount_owed_to_guide","amount_received") && has("expenses","tour_key","expense_type","amount","expense_status"),
    guide_queue: has("guide_payment_queue","tour_key","guide","payment_status","amount_due"),
  };
  coverage.guide_queue &&= coverage.provider_expenses;
  if (!strong) return {status:"snapshot_not_current",issues:[],counts:{},coverage,total:0};

  // Give the scheduled accounting run time to post and reconcile a new payment.
  const paidGraceMs = 45 * 60000;
  const previousDay = new Date(Date.parse(`${today}T12:00:00Z`) - 86400000).toISOString().slice(0,10);
  const cutoff = new Date(Date.parse(`${today}T12:00:00Z`) - 90 * 86400000).toISOString().slice(0,10);
  const issues = [], counts = {}, seen = new Set();
  const add = (code,row,detail) => {
    const key=keyOf(row), invoice=clean(row.invoice_no)||key.split("|")[0]||"Not identified";
    const product=clean(row.product_selected), date=day(row.tour_date);
    const identity=JSON.stringify([code,invoice,key,product,date,detail]);
    if(seen.has(identity))return;
    seen.add(identity);
    counts[code]=(counts[code]||0)+1;
    issues.push({code,invoice,product,tour_date:date,detail});
  };
  const collect = (rows,keyFn,filter=()=>true) => {
    const out = new Map();
    for(const row of rows){
      const key=keyFn(row);
      if(!key||!filter(row))continue;
      if(!out.has(key))out.set(key,[]);
      out.get(key).push(row);
    }
    return out;
  };
  const invoices = tabs.invoices || [];
  const active = row => !inactive(row.booking_status) && !inactive(row.revenue_status);
  const duplicates=collect(invoices,keyOf,active);
  const obligations=collect(tabs.expenses||[],expenseKeyOf,row=>!inactive(row.expense_status)&&providerPayable(row)&&money(row.amount)<0);
  const queue=collect(tabs.guide_payment_queue||[],keyOf,row=>!inactive(row.payment_status));
  for(const row of invoices){
    const paid=day(row.date_paid)||day(row.paid_at), paidAt=clean(row.paid_at), paidMs=paidAt.includes("T")?Date.parse(paidAt):NaN;
    if(!active(row)||!paid||paid>today||paid<cutoff||/^DEP/i.test(clean(row.product_selected))||money(row.amount_received)<0)continue;
    if(Number.isFinite(paidMs) ? now-paidMs<paidGraceMs : paid>previousDay)continue;
    const key=keyOf(row), date=day(row.tour_date), product=clean(row.product_selected), provider=clean(row.tour_guide), payout=money(row.total_amount_owed_to_guide);
    if((duplicates.get(key)?.length||0)>1) {
      add("duplicate_service_key",row,"Multiple active invoice rows share this service key. Review before posting or paying.");
      continue;
    }
    if(coverage.metadata){
      const missing=[["country",row.home_country],["service type",row.service_type],["product",product]].filter(([,value])=>!clean(value)).map(([label])=>label);
      if(missing.length) add("missing_invoice_fields",row,`Verify ${missing.join(", ")} against the CRM and catalog.`);
    }
    if(!coverage.provider_expenses||!product)continue;
    if(provider && clean(row.total_amount_owed_to_guide) && payout===null){
      add("provider_rate_review",row,"Provider amount is not numeric; review the rate and formulas.");
      continue;
    }
    if(!(payout>0))continue;
    if(!key||!provider||!date){
      add("provider_details_missing",row,"A provider amount is present but the service key, date, or payee is missing.");
      continue;
    }
    const matches=obligations.get(key)||[];
    if(!matches.length) add("missing_provider_expense",row,"No active provider expense matches the invoice service key.");
    else if(matches.length>1) add("provider_expense_review",row,"Multiple active provider expenses match this service key. Verify before paying.");
    else if(clean(matches[0].paid_to)&&clean(matches[0].paid_to).toLowerCase()!==provider.toLowerCase()){
      add("provider_expense_review",row,"The matching expense has a different payee. Compare it with the current provider assignment.");
    }
    // The queue intentionally does not backfill services already completed
    // or in the past. Past due obligations are still checked in expenses.
    if(coverage.guide_queue&&!matches.some(expense=>/^yes$/i.test(clean(expense.reconciled)))&&date>=today&&!/^yes$/i.test(clean(row.tour_completed))){
      const queued=queue.get(key)||[];
      if(!queued.length)add("missing_guide_queue",row,"No active queue entry for this upcoming provider obligation.");
      else if(queued.length>1)add("guide_queue_review",row,"Multiple active queue entries share this service key.");
      else if(clean(queued[0].guide).toLowerCase()!==provider.toLowerCase()||money(queued[0].amount_due)!==payout){
        add("guide_queue_review",row,"The queued provider or original amount differs from the invoice. Verify adjustments and settlements before acting.");
      }
    }
  }
  issues.sort((a,b)=> (a.tour_date||"9999").localeCompare(b.tour_date||"9999") || a.invoice.localeCompare(b.invoice) || a.code.localeCompare(b.code));
  return {status:Object.values(coverage).every(Boolean)?"available":"partial",coverage,counts,total:issues.length,issues:issues.slice(0,100),lookback_days:90};
}
