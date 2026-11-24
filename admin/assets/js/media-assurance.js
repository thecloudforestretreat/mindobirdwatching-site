(function(root,factory){
  var api=factory();
  if(typeof module==="object"&&module.exports)module.exports=api;
  if(root)root.MBWMediaAssurance=api;
})(typeof window!=="undefined"?window:globalThis,function(){
  "use strict";
  function clean(value){return String(value==null?"":value).trim()}
  function truthy(value){return value===true||["true","1","yes","y","on"].includes(clean(value).toLowerCase())}
  function has(value){return clean(value)!==""}
  function normalizeDate(value){
    var text=clean(value),match=text.match(/^(\d{4})-(\d{2})-(\d{2})(?:[T\s].*)?$/);
    if(!match){
      match=text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
      if(match)match=[match[0],match[3],String(match[1]).padStart(2,"0"),String(match[2]).padStart(2,"0")];
    }
    if(!match)return"";
    var year=Number(match[1]),month=Number(match[2]),day=Number(match[3]),candidate=new Date(Date.UTC(year,month-1,day));
    if(candidate.getUTCFullYear()!==year||candidate.getUTCMonth()!==month-1||candidate.getUTCDate()!==day)return"";
    return String(year).padStart(4,"0")+"-"+String(month).padStart(2,"0")+"-"+String(day).padStart(2,"0");
  }
  function validDate(value){return Boolean(normalizeDate(value))}
  function time24(value){
    var text=clean(value),match=text.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
    if(match){var hour=Number(match[1])%12+(match[3].toUpperCase()==="PM"?12:0);return String(hour).padStart(2,"0")+":"+match[2]}
    return /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(text)?text:"";
  }
  function easternNow(date){
    var parts=new Intl.DateTimeFormat("en-US",{timeZone:"America/New_York",year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit",hourCycle:"h23"}).formatToParts(date||new Date()),values={};
    parts.forEach(function(part){values[part.type]=part.value});
    return{date:values.year+"-"+values.month+"-"+values.day,time:values.hour+":"+values.minute};
  }
  function minuteKey(date,time){return Date.parse(date+"T"+time+":00Z")/60000}
  function selected(type,row){
    var definitions=type==="carousel"?
      [{key:"instagram",flag:"post_to_instagram"},{key:"facebook",flag:"post_to_facebook"}]:
      [{key:"instagram",flag:"post_to_instagram"},{key:"facebook",flag:"post_to_facebook"},{key:"youtube",flag:"post_on_youtube"}];
    return definitions.filter(function(definition){return truthy(row[definition.flag])||has(row[definition.key+"_post_id"])||has(row[definition.key+"_published_date"])})
  }
  function receipts(type,row){
    return selected(type,row).map(function(definition){
      var key=definition.key,state=clean(row[key+"_publish_state"]).toUpperCase(),id=clean(row[key+"_post_id"]),date=clean(row[key+"_published_date"]),claim=clean(row[key+"_publish_claim_id"]),verified=Boolean(id||date||state==="PUBLISHED"),ambiguous=!verified&&Boolean(claim||["CLAIMED","PUBLISHING","UNKNOWN","RECONCILE"].includes(state));
      return{platform:key,verified:verified,ambiguous:ambiguous,id:id,date:date,state:state|| (verified?"PUBLISHED":"PENDING")}
    })
  }
  function imageUrls(row){
    var urls=[];
    try{var parsed=JSON.parse(row.images_json||"[]");if(Array.isArray(parsed))parsed.forEach(function(image){var url=clean(image&& (image.delivery_url||image.original_url||image.url||image));if(url)urls.push(url)})}catch(error){}
    if(!urls.length)for(var i=1;i<=10;i++){var value=clean(row["image_"+i+"_url"]);if(value)urls.push(value)}
    return urls;
  }
  function copyReady(type,row,destinations){
    if(type==="carousel")return has(row.carousel_title)&&(!destinations.some(function(x){return x.key==="instagram"})||(has(row.caption)&&has(row.instagram_hashtags)))&&(!destinations.some(function(x){return x.key==="facebook"})||(has(row.facebook_caption||row.caption)&&has(row.facebook_hashtags||row.instagram_hashtags)));
    var socialReady=!destinations.some(function(x){return x.key==="instagram"||x.key==="facebook"})||has(row.instagram_caption_final||row.instagram_caption_raw),youtubeReady=!destinations.some(function(x){return x.key==="youtube"})||(has(row.youtube_title)&&has(row.youtube_description||row.blurb||row.instagram_caption_raw));
    return socialReady&&youtubeReady;
  }
  function approvalReady(type,row){
    var approval=clean(row.approval_status).toUpperCase(),review=clean(row.copy_review_status).toUpperCase(),score=Number(row.quality_score||0);
    if(type==="carousel")return approval==="APPROVED"&&["PASS","HUMAN_EDITED"].includes(review)&&(review==="HUMAN_EDITED"||score>=92);
    return approval==="APPROVED"&&["FINAL","PASS","HUMAN_EDITED"].some(function(value){return review.includes(value)})&&(review.includes("HUMAN_EDITED")||score>=92);
  }
  function lifecycle(row,type,checks,platforms,context){
    var submittedAt=clean(row.submitted_at||row.created_at),approvedAt=clean(row.approval_timestamp||row.approved_at),claimTimes=platforms.map(function(platform){return clean(row[platform.platform+"_publish_claimed_at"])}).filter(Boolean),hasClaim=claimTimes.length>0||platforms.some(function(platform){return platform.ambiguous||platform.verified}),steps=[
      {key:"queue",label:"Added to queue",state:submittedAt?"complete":"pending",at:submittedAt},
      {key:"schedule",label:"Schedule recorded",state:checks.find(function(check){return check.key==="schedule"}).ok?"complete":"attention",at:[clean(row.scheduled_date),clean(row.scheduled_time)].filter(Boolean).join(" ")},
      {key:"approval",label:"Approved for publishing",state:checks.find(function(check){return check.key==="approval"}).ok?"complete":"attention",at:approvedAt},
      {key:"claim",label:"Publishing attempt started",state:hasClaim?"complete":context.minutesUntil!=null&&context.minutesUntil<0?"attention":"pending",at:claimTimes.sort()[0]||clean(row.publishing_lock)}
    ];
    platforms.forEach(function(platform){steps.push({key:platform.platform,label:platform.platform.charAt(0).toUpperCase()+platform.platform.slice(1)+" receipt",state:platform.verified?"complete":platform.ambiguous?"attention":"pending",at:platform.date||platform.id})});
    steps.push({key:"verification",label:"All selected platforms verified",state:context.verified?"complete":context.verificationOverdue||context.partial||context.ambiguous?"attention":"pending",at:""});
    var nextAction="No action needed.";
    if(context.verified)nextAction="Publication is complete on every selected platform.";
    else if(context.ambiguous)nextAction="Reconcile the existing platform claim before any retry.";
    else if(context.partial)nextAction="Review the missing platform receipt; successful destinations must not be reposted.";
    else if(context.verificationOverdue)nextAction="Inspect the latest publisher execution and confirm the missing platform receipt.";
    else if(!context.ready)nextAction="Complete the failed readiness checks before the scheduled time.";
    else if(context.preflightWindow)nextAction="No action needed; this post passed preflight.";
    else nextAction="No action needed until the scheduled publisher pass.";
    return{steps:steps,next_action:nextAction};
  }
  function evaluate(row,type,options){
    row=row||{};options=options||{};
    var now=options.now||easternNow(),date=normalizeDate(row.scheduled_date),time=time24(row.scheduled_time),destinations=selected(type,row),platforms=receipts(type,row),checks=[];
    checks.push({key:"schedule",label:"Eastern schedule recorded",ok:validDate(date)&&Boolean(time)});
    checks.push({key:"destinations",label:"At least one automated destination",ok:destinations.length>0});
    if(type==="carousel"){
      var urls=imageUrls(row);checks.push({key:"media",label:"2–10 unique carousel images",ok:urls.length>=2&&urls.length<=10&&new Set(urls).size===urls.length})
    }else checks.push({key:"media",label:"Playable HTTPS video (MP4, MOV or M4V)",ok:/^https:\/\/.+\.(?:mp4|mov|m4v)(?:[?#].*)?$/i.test(clean(row.video_url))});
    checks.push({key:"copy",label:"Selected-platform copy complete",ok:copyReady(type,row,destinations)});
    checks.push({key:"approval",label:"Approved copy passed review",ok:approvalReady(type,row)});
    var scheduled=validDate(date)&&Boolean(time),minutesUntil=scheduled?minuteKey(date,time)-minuteKey(now.date,now.time):null,ready=checks.every(function(check){return check.ok}),verified=platforms.length>0&&platforms.every(function(platform){return platform.verified}),partial=platforms.some(function(platform){return platform.verified})&&!verified,ambiguous=platforms.some(function(platform){return platform.ambiguous}),verificationOverdue=scheduled&&minutesUntil<=-10&&!verified,preflightWindow=scheduled&&minutesUntil>=0&&minutesUntil<=60;
    var tone="ready",label="Ready for scheduled publishing";
    if(verified){label="All selected platforms verified"}
    else if(partial||ambiguous||verificationOverdue){tone="error";label="Platform verification needs attention"}
    else if(!ready){tone=preflightWindow?"error":"warning";label=preflightWindow?"Scheduled within 60 minutes but not ready":"Preparation is incomplete"}
    else if(preflightWindow){label="Preflight passed for the next 60 minutes"}
    else if(scheduled&&minutesUntil<0){tone="warning";label="Waiting for platform receipts"}
    var history=lifecycle(row,type,checks,platforms,{ready:ready,verified:verified,partial:partial,ambiguous:ambiguous,verificationOverdue:verificationOverdue,preflightWindow:preflightWindow,minutesUntil:minutesUntil});
    return{type:type,ready:ready,verified:verified,partial:partial,ambiguous:ambiguous,verification_overdue:verificationOverdue,preflight_window:preflightWindow,minutes_until:minutesUntil,checks:checks,platforms:platforms,timeline:history.steps,next_action:history.next_action,tone:tone,label:label};
  }
  return{evaluate:evaluate,easternNow:easternNow,time24:time24,normalizeDate:normalizeDate};
});
