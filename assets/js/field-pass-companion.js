(function(){
  "use strict";
  const root=document.body;
  const lang=root.dataset.pageLanguage==="es"?"es":"en";
  const q=new URLSearchParams(location.search);
  const get=(short,long,fallback="")=>q.get(short)||q.get(long)||fallback;
  const siteContact=(window.MBW_SITE_CONFIG&&window.MBW_SITE_CONFIG.contact)||{};
  const configuredContact=String(siteContact.whatsappDisplayNumber||siteContact.whatsappNumberDigits||"").trim();
  const data={
    type:get("k","type","day"),
    tour:get("t","tour",lang==="es"?"Experiencia de naturaleza en Mindo":"Mindo nature experience"),
    date:get("d","date",lang==="es"?"Según confirmación":"As confirmed"),
    start:get("s","start",lang==="es"?"Según confirmación":"As confirmed"),
    end:get("e","end",""),
    duration:get("du","duration",lang==="es"?"Según reserva":"As booked"),
    meeting:get("m","meeting",lang==="es"?"Según confirmación":"As confirmed"),
    map:get("ml","map",""),
    guide:get("g","guide",lang==="es"?"Guía local asignado":"Assigned local guide"),
    guidePhone:get("gp","guide_phone",""),
    contact:get("c","contact",configuredContact),
    inclusions:get("i","inclusions",""),
    access:get("an","access_note","")
  };
  const text={
    en:{
      guide:"Your guide",mbw:"Mindo Bird Watching",whatsapp:"Message on WhatsApp",directions:"Open directions",ready:"Please be ready at the confirmed meeting point. If pickup was arranged, be ready 15 minutes before the confirmed start.",
      calendar:"Add to calendar",calendarFile:"mindo-field-pass",calendarDescription:"Confirmed Mindo Bird Watching experience. Your written confirmation remains the final reference.",
      packDay:["Closed-toe walking shoes with reliable traction","Light rain jacket or poncho","Water and a small snack","Binoculars or camera, if you have them","Quiet, neutral-colored clothing","Sun protection and insect repellent"],cameraOnly:"Camera, if you would like to take photos",
      packNight:["Closed-toe shoes with reliable traction","Rain jacket or poncho for a damp evening","Long pants and comfortable layers","Your own headlamp if available","Water in a reusable bottle","Insect repellent"],
      stepsDay:[["Meet your guide","Confirm the route, pace, current weather and target wildlife."],["Enter the cloud forest","Your guide adapts the route to recent activity, elevation and conditions."],["Observe responsibly","Move quietly, follow the guide’s positioning and keep wildlife welfare first."],["Return as confirmed","Timing can shift slightly with weather, road access and wildlife activity."]],
      stepsNight:[["Meet your guide","Review the trail, weather and equipment before entering the forest."],["Walk after dark","Search slowly for frogs, insects, spiders, owls and other nocturnal wildlife."],["Observe responsibly","Stay with the guide, use lights carefully and avoid touching wildlife."],["Return as confirmed","The exact finish time can vary with trail conditions and group pace."]]
    },
    es:{
      guide:"Tu guía",mbw:"Mindo Bird Watching",whatsapp:"Escribir por WhatsApp",directions:"Abrir indicaciones",ready:"Llega al punto de encuentro confirmado. Si coordinaste recogida, debes estar listo 15 minutos antes de la hora de inicio confirmada.",
      calendar:"Agregar al calendario",calendarFile:"pase-de-campo-mindo",calendarDescription:"Experiencia confirmada con Mindo Bird Watching. Tu confirmación escrita sigue siendo la referencia final.",
      packDay:["Calzado cerrado para caminar con buena tracción","Chaqueta impermeable ligera o poncho","Agua y un refrigerio pequeño","Binoculares o cámara, si tienes","Ropa silenciosa de colores neutros","Protección solar y repelente"],cameraOnly:"Cámara, si deseas tomar fotografías",
      packNight:["Calzado cerrado con buena tracción","Chaqueta impermeable o poncho para una noche húmeda","Pantalón largo y capas cómodas","Tu propia linterna frontal, si tienes","Agua en una botella reutilizable","Repelente"],
      stepsDay:[["Encuentro con tu guía","Confirmen la ruta, el ritmo, el clima y la fauna de interés."],["Ingreso al bosque nublado","El guía adapta la ruta según la actividad reciente, la elevación y las condiciones."],["Observación responsable","Camina en silencio, sigue las indicaciones del guía y prioriza el bienestar de la fauna."],["Regreso según lo confirmado","El horario puede variar ligeramente por el clima, el acceso y la actividad de la fauna."]],
      stepsNight:[["Encuentro con tu guía","Revisen el sendero, el clima y el equipo antes de entrar al bosque."],["Caminata después del anochecer","Busquen con calma ranas, insectos, arañas, búhos y otra fauna nocturna."],["Observación responsable","Permanece con el guía, usa las luces con cuidado y no toques la fauna."],["Regreso según lo confirmado","La hora exacta de finalización puede variar por el sendero y el ritmo del grupo."]]
    }
  }[lang];
  const set=(id,value)=>{const node=document.getElementById(id);if(node)node.textContent=value;};
  const displayDate=value=>{
    if(!/^\d{4}-\d{2}-\d{2}$/.test(String(value||"")))return value;
    const date=new Date(`${value}T12:00:00`);
    return new Intl.DateTimeFormat(lang==="es"?"es-EC":"en-US",{year:"numeric",month:"long",day:"numeric"}).format(date);
  };
  const phone=value=>String(value||"").replace(/[^\d+]/g,"");
  const list=value=>String(value||"").split(/;|\|/).map(item=>item.trim()).filter(Boolean).slice(0,8);
  const safeUrl=value=>{try{const url=new URL(value);return /^https?:$/.test(url.protocol)?url.href:"";}catch(_){return"";}};
  const wa=(number,message)=>`https://wa.me/${phone(number).replace(/^\+/,"")}?text=${encodeURIComponent(message)}`;
  const message=lang==="es"?`Hola, tengo una pregunta sobre mi experiencia: ${data.tour}.`:`Hello, I have a question about my experience: ${data.tour}.`;
  set("tripName",data.tour);set("tripDate",displayDate(data.date));set("tripStart",data.start);set("tripDuration",data.duration);set("meetingName",data.meeting);set("guideName",data.guide);set("guidePhoneText",data.guidePhone||text.whatsapp);set("mbwPhoneText",data.contact);set("meetingNote",text.ready);
  const directions=document.getElementById("directionsLink");if(directions){directions.textContent=text.directions;directions.href=safeUrl(data.map)||`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(data.meeting+", Mindo, Ecuador")}`;}
  const guideLink=document.getElementById("guideWhatsApp");if(guideLink){guideLink.textContent=text.whatsapp;guideLink.href=data.guidePhone?wa(data.guidePhone,message):wa(data.contact,message);}
  const mbwLink=document.getElementById("mbwWhatsApp");if(mbwLink){mbwLink.textContent=text.whatsapp;mbwLink.href=wa(data.contact,message);}
  const night=/night|noche|nocturn/i.test(data.type+" "+data.tour);
  const included=list(data.inclusions),opticsIncluded=included.some(item=>/binocular|binocul/i.test(item));
  const packing=document.getElementById("packingList");if(packing)(night?text.packNight:text.packDay).map(item=>opticsIncluded&&/binocular|binocul/i.test(item)?text.cameraOnly:item).forEach(item=>{const li=document.createElement("li");li.textContent=item;packing.appendChild(li);});
  const inclusionsPanel=document.getElementById("inclusionsPanel"),inclusionsList=document.getElementById("inclusionsList");if(included.length&&inclusionsPanel&&inclusionsList){included.forEach(item=>{const li=document.createElement("li");li.textContent=item;inclusionsList.appendChild(li);});inclusionsPanel.hidden=false;}
  if(data.access)set("accessNote",data.access);
  const itinerary=document.getElementById("itinerary");if(itinerary)(night?text.stepsNight:text.stepsDay).forEach(([title,body])=>{const li=document.createElement("li");const box=document.createElement("div");const h=document.createElement("h3");const p=document.createElement("p");h.textContent=title;p.textContent=body;box.append(h,p);li.appendChild(box);itinerary.appendChild(li);});
  const parseTime=value=>{const match=String(value||"").trim().match(/^(\d{1,2})(?::(\d{2}))?\s*(a\.?\s*m\.?|p\.?\s*m\.?)?$/i);if(!match)return null;let hour=Number(match[1]),minute=Number(match[2]||0);const meridiem=(match[3]||"").replace(/[.\s]/g,"").toLowerCase();if(meridiem==="pm"&&hour<12)hour+=12;if(meridiem==="am"&&hour===12)hour=0;if(hour>23||minute>59)return null;return{hour,minute};};
  const icsEscape=value=>String(value||"").replace(/\\/g,"\\\\").replace(/\n/g,"\\n").replace(/,/g,"\\,").replace(/;/g,"\\;");
  const icsDateTime=(date,time)=>`${date.replace(/-/g,"")}T${String(time.hour).padStart(2,"0")}${String(time.minute).padStart(2,"0")}00`;
  const downloadCalendar=()=>{if(!/^\d{4}-\d{2}-\d{2}$/.test(data.date))return;const start=parseTime(data.start);const lines=["BEGIN:VCALENDAR","VERSION:2.0","PRODID:-//Mindo Bird Watching//Field Pass Companion//EN","CALSCALE:GREGORIAN","METHOD:PUBLISH","BEGIN:VEVENT",`UID:${Date.now()}-field-pass@mindobirdwatching.com`,`DTSTAMP:${new Date().toISOString().replace(/[-:]/g,"").replace(/\.\d{3}Z$/,"Z")}`,`SUMMARY:${icsEscape(data.tour)}`,`LOCATION:${icsEscape(data.meeting)}`,`DESCRIPTION:${icsEscape(text.calendarDescription)}`];if(start){lines.push(`DTSTART;TZID=America/Guayaquil:${icsDateTime(data.date,start)}`);const end=parseTime(data.end);if(end)lines.push(`DTEND;TZID=America/Guayaquil:${icsDateTime(data.date,end)}`);}else{const dateOnly=data.date.replace(/-/g,"");lines.push(`DTSTART;VALUE=DATE:${dateOnly}`);}lines.push("END:VEVENT","END:VCALENDAR");const blob=new Blob([lines.join("\r\n")],{type:"text/calendar;charset=utf-8"});const link=document.createElement("a");link.href=URL.createObjectURL(blob);link.download=`${text.calendarFile}.ics`;document.body.appendChild(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(link.href),1000);};
  const calendarButton=document.getElementById("calendarButton");if(calendarButton){if(/^\d{4}-\d{2}-\d{2}$/.test(data.date)){calendarButton.textContent=text.calendar;calendarButton.addEventListener("click",downloadCalendar);}else calendarButton.hidden=true;}
  const printButton=document.getElementById("printButton");if(printButton)printButton.addEventListener("click",()=>window.print());
  const ecuadorToday=()=>{const parts=new Intl.DateTimeFormat("en-CA",{timeZone:"America/Guayaquil",year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(new Date());const values=Object.fromEntries(parts.map(part=>[part.type,part.value]));return`${values.year}-${values.month}-${values.day}`;};
  const reviewPrompt=document.getElementById("reviewPrompt");if(reviewPrompt&&(q.get("review")==="1"||(/^\d{4}-\d{2}-\d{2}$/.test(data.date)&&data.date<ecuadorToday())))reviewPrompt.hidden=false;
  const query=location.search;
  const switcher=document.getElementById("languageSwitch");if(switcher)switcher.href=(lang==="es"?"/field-pass-companion/":"/es/guia-del-pase-de-campo/")+query;
})();
