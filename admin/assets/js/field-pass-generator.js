(function(){
  "use strict";

  const APP_SCRIPT_URL="https://script.google.com/macros/s/AKfycbyMkE-1Dh2zXp6FcDuu59PpuIU38FrJBs0y1iK0vBce3fMRYa_W8cD_ibjn3gTG_LQ1QQ/exec";
  const DAY_DESIGNS=[
    {code:"COTR",name:"Andean Cock-of-the-Rock",src:"/assets/images/tour-field-passes/01-andean-cock-of-the-rock-field-pass.png"},
    {code:"GHQ",name:"Golden-headed Quetzal",src:"/assets/images/tour-field-passes/02-golden-headed-quetzal-field-pass.png"},
    {code:"TBAR",name:"Toucan Barbet",src:"/assets/images/tour-field-passes/03-toucan-barbet-field-pass.png"},
    {code:"CTOU",name:"Choco Toucan",src:"/assets/images/tour-field-passes/04-choco-toucan-field-pass.png"},
    {code:"PMAR",name:"Pale-mandibled Aracari",src:"/assets/images/tour-field-passes/05-pale-mandibled-aracari-field-pass.png"},
    {code:"PBMT",name:"Plate-billed Mountain-Toucan",src:"/assets/images/tour-field-passes/06-plate-billed-mountain-toucan-field-pass.png"},
    {code:"RTOU",name:"Rainforest Toucan",src:"/assets/images/tour-field-passes/07-rainforest-toucan-field-pass.png"},
    {code:"VTS",name:"Violet-tailed Sylph",src:"/assets/images/tour-field-passes/08-violet-tailed-sylph-field-pass.png"}
  ];
  const NIGHT_DESIGN={code:"NIGHT",name:"Mindo After Dark",src:"/assets/images/tour-field-passes/09-mindo-after-dark-night-walk-pass.png"};
  const GUIDES=[
    {name:"Chicho",phone:"+593 98 600 5054"},
    {name:"Neicer",phone:"+593 98 095 5817"},
    {name:"Anderson",phone:"+593 99 078 5026"},
    {name:"Abel",phone:"+593 99 098 0074"},
    {name:"Juan",phone:""},{name:"Javier",phone:""},{name:"Other",phone:""}
  ];
  const state={records:[],passes:[],active:0};
  const $=id=>document.getElementById(id);
  const ids=["bookingSelect","guestNamesInput","bookingRefInput","passTypeInput","tourNameInput","tourDateInput","startInput","durationInput","meetingInput","guideInput","guidePhoneInput","tourContactInput","designInput","previewGuestInput","heroImage","outGuest","outDate","outStart","outMeeting","outDuration","outGuide","outGuidePhone","outFieldId","outTourContact","ticketScale","previewStage","testSummary","statusText","refreshBtn","downloadBtn","downloadAllBtn"];
  const el={};

  document.addEventListener("DOMContentLoaded",init);
  window.addEventListener("resize",scalePreview);

  function init(){ids.forEach(id=>el[id]=$(id));renderGuideOptions();renderDesignOptions();bind();rebuild();loadRecords();}
  function bind(){
    ["guestNamesInput","bookingRefInput","passTypeInput","tourNameInput","tourDateInput","startInput","durationInput","meetingInput","guidePhoneInput","tourContactInput","designInput"].forEach(id=>{
      el[id].addEventListener("input",rebuild);el[id].addEventListener("change",rebuild);
    });
    el.guideInput.addEventListener("change",()=>{const guide=GUIDES.find(g=>g.name===el.guideInput.value);if(guide&&guide.phone)el.guidePhoneInput.value=guide.phone;rebuild();});
    el.passTypeInput.addEventListener("change",()=>{if(el.passTypeInput.value==="night"){el.tourNameInput.value="Mindo Night Walk";el.startInput.value="As confirmed";el.durationInput.value="As booked";el.meetingInput.value="As confirmed";}rebuild();});
    el.previewGuestInput.addEventListener("change",()=>{state.active=Number(el.previewGuestInput.value)||0;renderActive();});
    el.bookingSelect.addEventListener("change",onRecordSelect);el.refreshBtn.addEventListener("click",loadRecords);
    el.downloadBtn.addEventListener("click",downloadCurrent);el.downloadAllBtn.addEventListener("click",downloadAll);
  }
  function renderGuideOptions(){GUIDES.forEach(g=>{const o=document.createElement("option");o.value=g.name;o.textContent=g.name;el.guideInput.appendChild(o);});el.guideInput.value="Chicho";}
  function renderDesignOptions(){DAY_DESIGNS.forEach(d=>{const o=document.createElement("option");o.value=d.code;o.textContent=d.name;el.designInput.appendChild(o);});}
  function names(){return el.guestNamesInput.value.split(/\n|;/).map(v=>v.trim()).filter(Boolean).slice(0,8).length?el.guestNamesInput.value.split(/\n|;/).map(v=>v.trim()).filter(Boolean).slice(0,8):["Test Guest"];}
  function hash(value){let h=2166136261;for(const c of String(value)){h^=c.charCodeAt(0);h=Math.imul(h,16777619);}return h>>>0;}
  function initials(value){const parts=String(value).trim().split(/\s+/).filter(Boolean);return (parts[0]?.[0]||"G")+(parts.length>1?(parts.at(-1)?.[0]||""):"");}
  function safe(value){return String(value||"TEST").toUpperCase().replace(/[^A-Z0-9]+/g,"-").replace(/^-|-$/g,"").slice(0,24)||"TEST";}
  function assignedDesigns(guestNames){
    if(el.passTypeInput.value==="night")return guestNames.map(()=>NIGHT_DESIGN);
    const selected=el.designInput.value;const start=selected==="auto"?hash(el.bookingRefInput.value||guestNames.join("|"))%DAY_DESIGNS.length:Math.max(0,DAY_DESIGNS.findIndex(d=>d.code===selected));
    return guestNames.map((_,i)=>DAY_DESIGNS[(start+i)%DAY_DESIGNS.length]);
  }
  function rebuild(){
    const guestNames=names(),designs=assignedDesigns(guestNames);const ref=safe(el.bookingRefInput.value);
    state.passes=guestNames.map((guest,i)=>({guest,design:designs[i],fieldId:`${designs[i].code}-${ref}-${initials(guest).toUpperCase()}`}));
    state.active=Math.min(state.active,state.passes.length-1);renderGuestOptions();renderActive();
    const unique=new Set(state.passes.map(p=>p.design.code)).size;
    el.testSummary.textContent=`${state.passes.length} test pass${state.passes.length===1?"":"es"} prepared · ${unique} wildlife design${unique===1?"":"s"} · delivery disabled`;
  }
  function renderGuestOptions(){const selected=state.active;el.previewGuestInput.innerHTML="";state.passes.forEach((p,i)=>{const o=document.createElement("option");o.value=String(i);o.textContent=`${p.guest} · ${p.design.name}`;el.previewGuestInput.appendChild(o);});el.previewGuestInput.value=String(selected);}
  function renderActive(){
    const pass=state.passes[state.active]||state.passes[0];if(!pass)return;
    el.heroImage.src=pass.design.src;el.outGuest.textContent=pass.guest;el.outDate.textContent=formatDate(el.tourDateInput.value);el.outStart.textContent=el.startInput.value||"As confirmed";el.outMeeting.textContent=el.meetingInput.value||"As confirmed";el.outDuration.textContent=el.durationInput.value||"As booked";el.outGuide.textContent=el.guideInput.value==="Other"?"Assigned local guide":el.guideInput.value;el.outGuidePhone.textContent=el.guidePhoneInput.value?`WhatsApp ${el.guidePhoneInput.value}`:"WhatsApp to be confirmed";el.outFieldId.textContent=pass.fieldId;el.outTourContact.textContent=`WhatsApp ${el.tourContactInput.value}`;scalePreview();
  }
  function scalePreview(){if(!el.previewStage||!el.ticketScale)return;const width=Math.max(280,el.previewStage.clientWidth-36);const scale=Math.min(1,width/944);el.ticketScale.style.transform=`scale(${scale})`;el.ticketScale.style.width=`${944*scale}px`;el.ticketScale.style.height=`${1672*scale}px`;}
  function formatDate(value){if(!value)return"As confirmed";const d=new Date(`${value}T12:00:00`);return Number.isNaN(d.getTime())?value:d.toLocaleDateString("en-US",{month:"long",day:"numeric",year:"numeric"});}
  function val(row,keys,fallback=""){for(const key of keys){if(row&&String(row[key]??"").trim())return row[key];}return fallback;}
  function loadRecords(){setStatus("Loading confirmation list…");jsonp(APP_SCRIPT_URL,{action:"data"}).then(data=>{state.records=Array.isArray(data.confirmations)?data.confirmations:[];renderRecordOptions();setStatus(`Loaded ${state.records.length} confirmations. Still in test mode.`);}).catch(()=>setStatus("CRM list unavailable. Manual test mode remains ready."));}
  function renderRecordOptions(){el.bookingSelect.innerHTML='<option value="manual">Manual test</option>';state.records.forEach((r,i)=>{const o=document.createElement("option");o.value=String(i);o.textContent=`${val(r,["guest_name","Guest Name","Guests"],"Unnamed")} · ${val(r,["tour_date","Tour Date"],"")}`;el.bookingSelect.appendChild(o);});}
  function onRecordSelect(){if(el.bookingSelect.value==="manual")return;const r=state.records[Number(el.bookingSelect.value)];if(!r)return;const primary=val(r,["guest_name","Guest Name"],"");const others=val(r,["other_guest_names","Other Guest Names"],"");el.guestNamesInput.value=[primary,...String(others).split(/,|&/)].map(v=>v.trim()).filter(Boolean).join("\n")||"Test Guest";el.bookingRefInput.value=val(r,["invoice_no","confirmation_id","source_record_id"],"TEST");const tour=val(r,["combined_tour_display","tour_type_1","Tour Type 1"],"");el.tourNameInput.value=tour;el.passTypeInput.value=/night\s*walk/i.test(tour)?"night":"day";el.tourDateInput.value=toIsoDate(val(r,["tour_date","Tour Date"],""));el.startInput.value=val(r,["pickup_time","Pickup Time"],"As confirmed");el.durationInput.value=val(r,["tour_length","Length"],"As booked");el.meetingInput.value=val(r,["pickup_location","Pickup Location"],"As confirmed");const guide=val(r,["tour_guide","Guide"],"Chicho");if(!Array.from(el.guideInput.options).some(o=>o.value===guide)){const o=document.createElement("option");o.value=guide;o.textContent=guide;el.guideInput.appendChild(o);}el.guideInput.value=guide;el.guidePhoneInput.value=val(r,["guide_phone","Contact #"],"");rebuild();setStatus("CRM data loaded into a local test preview. Nothing was written back.");}
  function toIsoDate(value){const raw=String(value||"").trim();if(/^\d{4}-\d{2}-\d{2}$/.test(raw))return raw;const d=new Date(raw);return Number.isNaN(d.getTime())?"":`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;}
  function jsonp(url,params){return new Promise((resolve,reject)=>{const cb=`mbwFieldPass_${Date.now()}_${Math.random().toString(36).slice(2)}`;const script=document.createElement("script");const timer=setTimeout(()=>finish(new Error("timeout")),12000);function finish(err,data){clearTimeout(timer);delete window[cb];script.remove();err?reject(err):resolve(data);}window[cb]=data=>finish(null,data);script.onerror=()=>finish(new Error("load failed"));const q=new URLSearchParams({...params,callback:cb});script.src=`${url}?${q}`;document.head.appendChild(script);});}
  async function capture(){if(!window.html2canvas)throw new Error("Image export library did not load");return window.html2canvas($("fieldPass"),{backgroundColor:null,scale:1,useCORS:true,logging:false});}
  async function downloadCurrent(){try{setStatus("Rendering test JPG…");const canvas=await capture();downloadCanvas(canvas,state.passes[state.active]);setStatus("Test JPG downloaded locally. Nothing was sent.");}catch(err){setStatus(`Export failed: ${err.message}`);}}
  async function downloadAll(){const original=state.active;try{setStatus("Rendering all test JPGs…");for(let i=0;i<state.passes.length;i++){state.active=i;renderActive();await nextFrame();const canvas=await capture();downloadCanvas(canvas,state.passes[i]);await new Promise(r=>setTimeout(r,180));}setStatus(`${state.passes.length} test JPGs downloaded locally. Nothing was sent.`);}catch(err){setStatus(`Export failed: ${err.message}`);}finally{state.active=original;renderGuestOptions();renderActive();}}
  function downloadCanvas(canvas,pass){const a=document.createElement("a");a.download=`mbw-field-pass-${safe(pass.guest).toLowerCase()}-${pass.design.code.toLowerCase()}-test.jpg`;a.href=canvas.toDataURL("image/jpeg",.95);a.click();}
  function nextFrame(){return new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));}
  function setStatus(text){el.statusText.textContent=text;}
})();
