(function(){
  "use strict";
  const ACCOUNTING_API="https://n8n.mindobirdwatching.com/webhook/mbw-meta-ads-insights";
  const BALANCES_API="/api/crm/balances";
  const $=id=>document.getElementById(id);
  const clean=value=>String(value??"").trim();
  const num=value=>{const n=Number(value);return Number.isFinite(n)?n:0};
  const money=value=>new Intl.NumberFormat("en-US",{style:"currency",currency:"USD"}).format(num(value));
  const integer=value=>new Intl.NumberFormat("en-US",{maximumFractionDigits:0}).format(num(value));
  const esc=value=>clean(value).replace(/[&<>"']/g,ch=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"})[ch]);
  const monthLabel=key=>new Intl.DateTimeFormat("en-US",{month:"short",year:"numeric",timeZone:"UTC"}).format(new Date(key+"-01T12:00:00Z"));
  const todayNY=()=>new Intl.DateTimeFormat("en-CA",{timeZone:"America/New_York",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date());

  document.addEventListener("DOMContentLoaded",()=>{$("refreshBtn").addEventListener("click",load);load()});

  async function json(url){const response=await fetch(url,{credentials:"same-origin",cache:"no-store"});if(!response.ok)throw new Error(url.includes("balances")?"Customer-balance feed unavailable":"Accounting feed unavailable");const body=await response.json();if(body.ok===false)throw new Error(body.error||"Reporting feed unavailable");return body}

  async function load(){
    $("refreshBtn").disabled=true;$("dataState").dataset.tone="loading";$("dataState").textContent="Refreshing live data";$("errorPanel").hidden=true;
    const [accountingResult,balanceResult]=await Promise.allSettled([json(ACCOUNTING_API),json(BALANCES_API)]);
    const accounting=accountingResult.status==="fulfilled"?accountingResult.value:null;
    const balances=balanceResult.status==="fulfilled"?balanceResult.value:null;
    if(accounting)renderAccounting(accounting);else renderAccountingUnavailable();
    renderBalances(balances);
    renderControls(accounting,balances,accountingResult,balanceResult);
    const errors=[accountingResult,balanceResult].filter(item=>item.status==="rejected").map(item=>item.reason.message);
    $("errorPanel").hidden=!errors.length;$("errorCopy").textContent=errors.length?errors.join(" · "):"";
    $("dataState").dataset.tone=errors.length?(accounting||balances?"good":"error"):"good";
    $("dataState").textContent=errors.length?(accounting||balances?"Partial live data":"Feeds unavailable"):"Live sources connected";
    $("refreshBtn").disabled=false;
  }

  function renderAccounting(data){
    const monthly=Array.isArray(data.accounting_monthly)?data.accounting_monthly:[];
    const currentKey=todayNY().slice(0,7),current=monthly.find(row=>row.month===currentKey)||monthly.at(-1)||{};
    const year=currentKey.slice(0,4),ytd=monthly.filter(row=>clean(row.month).startsWith(year+"-")).reduce((out,row)=>{out.collected+=num(row.amount_received);out.gross+=num(row.mbw_gross_actual);out.profit+=num(row.mbw_profit_accrual);out.invoices+=num(row.paid_invoices);return out},{collected:0,gross:0,profit:0,invoices:0});
    const day=Number(todayNY().slice(8,10)),days=new Date(Number(year),Number(currentKey.slice(5,7)),0).getDate(),paceProfit=day?num(current.mbw_profit_accrual)/day*days:0;
    const margin=num(current.mbw_gross_actual)?num(current.mbw_profit_accrual)/num(current.mbw_gross_actual):0;
    const kpis=[
      ["Collected this month",money(current.amount_received),integer(current.paid_invoices)+" paid invoice rows"],
      ["MBW gross this month",money(current.mbw_gross_actual),"After pass-through amounts"],
      ["Earned profit this month",money(current.mbw_profit_accrual),(margin*100).toFixed(1)+"% margin on MBW gross"],
      ["Profit pace run rate",money(paceProfit),"Pace only; excludes future booked profit"],
      ["YTD MBW gross",money(ytd.gross),integer(ytd.invoices)+" paid invoice rows"],
      ["YTD earned profit",money(ytd.profit),ytd.gross?(ytd.profit/ytd.gross*100).toFixed(1)+"% margin":"No gross revenue"]
    ];
    $("kpiGrid").innerHTML=kpis.map(item=>`<article class="kpi"><span>${esc(item[0])}</span><strong>${item[1]}</strong><small>${esc(item[2])}</small></article>`).join("");
    $("asOfLabel").textContent=data.updated_at?"Updated "+new Date(data.updated_at).toLocaleString("en-US",{timeZone:"America/New_York",month:"short",day:"numeric",hour:"numeric",minute:"2-digit"})+" ET":"Live reporting timestamp unavailable";
    renderMonthly(monthly);
    const life=data.lifetime_summary||{},campaign=data.current_campaign_summary||{};
    $("adMetrics").innerHTML=[["Lifetime Meta spend",money(life.spend)],["Current campaign spend",money(campaign.spend)],["Landing views",integer(campaign.landing_page_views)],["Cost per landing view",campaign.landing_page_views?money(num(campaign.spend)/num(campaign.landing_page_views)):"—"]].map(item=>`<div class="stackMetric"><span>${esc(item[0])}</span><strong>${item[1]}</strong></div>`).join("");
  }

  function renderAccountingUnavailable(){
    $("kpiGrid").innerHTML=["Collected this month","MBW gross this month","Earned profit this month","Profit pace run rate","YTD MBW gross","YTD earned profit"].map(label=>`<article class="kpi"><span>${esc(label)}</span><strong>—</strong><small>Accounting feed unavailable</small></article>`).join("");
    $("monthlyChart").innerHTML='<p class="sourceNote">Monthly performance is unavailable.</p>';$("monthlyRows").innerHTML='<tr><td colspan="6">Accounting feed unavailable.</td></tr>';$("adMetrics").innerHTML='<p class="sourceNote">Advertising totals are unavailable.</p>';
  }

  function renderMonthly(rows){
    const visible=rows.slice(-13),max=Math.max(1,...visible.map(row=>num(row.mbw_gross_actual)));
    $("monthlyChart").innerHTML=visible.map(row=>{const gross=num(row.mbw_gross_actual),profit=num(row.mbw_profit_accrual),gh=Math.max(gross?2:0,gross/max*100),ph=Math.max(profit?2:0,profit/max*100);return`<div class="chartMonth" title="${esc(monthLabel(row.month))}: ${money(gross)} gross; ${money(profit)} profit"><i class="gross" style="height:${gh}%"></i><i class="profit" style="height:${ph}%"></i><span>${esc(row.month.slice(5))}</span></div>`}).join("");
    $("monthlyRows").innerHTML=[...visible].reverse().map(row=>{const gross=num(row.mbw_gross_actual),profit=num(row.mbw_profit_accrual);return`<tr><td><strong>${esc(monthLabel(row.month))}</strong></td><td>${integer(row.paid_invoices)}</td><td>${money(row.amount_received)}</td><td>${money(gross)}</td><td>${money(profit)}</td><td>${gross?(profit/gross*100).toFixed(1)+"%":"—"}</td></tr>`}).join("")||'<tr><td colspan="6">No monthly accounting history returned.</td></tr>';
  }

  function renderBalances(data){
    if(!data){$("balanceSummary").textContent="Feed unavailable";$("balanceRows").innerHTML='<tr><td colspan="7">Customer balances could not be loaded.</td></tr>';return}
    const records=Array.isArray(data.records)?data.records:[],open=records.filter(row=>num(row.balance)>0&&row.status!=="paid").sort((a,b)=>{const rank={overdue:0,due_soon:1,review:2,undated:3,upcoming:4,unknown:5};return(rank[a.status]??9)-(rank[b.status]??9)||clean(a.dueDate).localeCompare(clean(b.dueDate))}),total=open.reduce((sum,row)=>sum+num(row.balance),0);
    $("balanceSummary").textContent=money(total)+" across "+open.length+" bookings";
    $("balanceRows").innerHTML=open.slice(0,20).map(row=>`<tr><td><strong>${esc(row.name)}</strong></td><td>${esc(row.tourDate||"—")}</td><td>${row.total==null?"—":money(row.total)}</td><td>${row.paid==null?"—":money(row.paid)}</td><td>${money(row.balance)}</td><td>${esc(row.dueDate||"Not recorded")}</td><td><span class="statusBadge" data-tone="${row.status==="overdue"?"danger":row.status==="due_soon"||row.status==="review"?"warn":"good"}">${esc(clean(row.status).replaceAll("_"," "))}</span></td></tr>`).join("")||'<tr><td colspan="7">No open customer balances were returned.</td></tr>';
  }

  function renderControls(accounting,balances,accountingResult,balanceResult){
    const balanceRows=balances&&Array.isArray(balances.records)?balances.records:[],review=balanceRows.filter(row=>row.status==="review").length,overdue=balanceRows.filter(row=>row.status==="overdue").length,unmatched=num(balances&&balances.unmatched),checks=[
      [accounting?"good":"danger","Invoice reporting feed",accounting?integer(accounting.accounting_summary&&accounting.accounting_summary.paid_invoice_count)+" paid invoice rows verified":"Unavailable: "+clean(accountingResult.reason&&accountingResult.reason.message)],
      [balances?"good":"danger","Customer balance feed",balances?integer(balanceRows.length)+" booking records checked":"Unavailable: "+clean(balanceResult.reason&&balanceResult.reason.message)],
      [overdue?"danger":"good","Overdue customer balances",overdue?integer(overdue)+" require follow-up":"No overdue balances returned"],
      [review?"warn":"good","Balance records needing review",review?integer(review)+" have conflicting or incomplete evidence":"No review flags returned"],
      [unmatched?"warn":"good","Unmatched deposits",unmatched?integer(unmatched)+" deposits are not linked to a CRM inquiry":"No unmatched deposits returned"],
      ["warn","Guide and reconciliation coverage","Guide queue, settlements, bank balances, and card balances are not yet connected"]
    ];
    $("controlList").innerHTML=checks.map(item=>`<div class="control" data-tone="${item[0]}"><i></i><div><strong>${esc(item[1])}</strong><small>${esc(item[2])}</small></div></div>`).join("");
  }
})();
