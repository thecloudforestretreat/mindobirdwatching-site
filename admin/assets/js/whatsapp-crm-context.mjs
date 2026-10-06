export function reviewedCrmContext(record,now=Date.now()){
 if(!record||!record.inquiryId||!Number.isFinite(Date.parse(record.checkedAt))||now-Date.parse(record.checkedAt)>600000||Date.parse(record.checkedAt)>now+60000)return null;
 return {source:'linked_crm',checkedAt:record.checkedAt,tour:String(record.tour||'').slice(0,200),date:/^20\d{2}-\d{2}-\d{2}$/.test(record.date)?record.date:'',guests:/^(?:[1-9]|[1-9]\d)$/.test(String(record.guests))?String(record.guests):''};
}
export function bookingContext(messages,record,infer){const crm=reviewedCrmContext(record),suggested=infer(messages);return {crm,missing:['tour','date','guests'].filter(k=>!suggested[k]&&!crm?.[k])};}
