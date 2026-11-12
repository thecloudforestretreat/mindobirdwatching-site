(function(){
  "use strict";
  const root=document.body;
  const lang=root.dataset.pageLanguage==="es"?"es":"en";
  const q=new URLSearchParams(location.search);
  const get=(short,long,fallback="")=>q.get(short)||q.get(long)||fallback;
  const data={
    type:get("k","type","day"),
    tour:get("t","tour",lang==="es"?"Experiencia de naturaleza en Mindo":"Mindo nature experience"),
    date:get("d","date",lang==="es"?"Según confirmación":"As confirmed"),
    start:get("s","start",lang==="es"?"Según confirmación":"As confirmed"),
    duration:get("du","duration",lang==="es"?"Según reserva":"As booked"),
    meeting:get("m","meeting",lang==="es"?"Según confirmación":"As confirmed"),
    guide:get("g","guide",lang==="es"?"Guía local asignado":"Assigned local guide"),
    guidePhone:get("gp","guide_phone",""),
    contact:get("c","contact","+1 305 458 5402")
  };
  const text={
    en:{
      guide:"Your guide",mbw:"Mindo Bird Watching",whatsapp:"Message on WhatsApp",directions:"Open directions",ready:"Please be ready at the confirmed meeting point. If pickup was arranged, be ready 15 minutes before the confirmed start.",
      packDay:["Closed-toe walking shoes with reliable traction","Light rain jacket or poncho","Water and a small snack","Binoculars or camera, if you have them","Quiet, neutral-colored clothing","Sun protection and insect repellent"],
      packNight:["Closed-toe shoes with reliable traction","Rain jacket or poncho for a damp evening","Long pants and comfortable layers","Your own headlamp if available","Water in a reusable bottle","Insect repellent"],
      stepsDay:[["Meet your guide","Confirm the route, pace, current weather and target wildlife."],["Enter the cloud forest","Your guide adapts the route to recent activity, elevation and conditions."],["Observe responsibly","Move quietly, follow the guide’s positioning and keep wildlife welfare first."],["Return as confirmed","Timing can shift slightly with weather, road access and wildlife activity."]],
      stepsNight:[["Meet your guide","Review the trail, weather and equipment before entering the forest."],["Walk after dark","Search slowly for frogs, insects, spiders, owls and other nocturnal wildlife."],["Observe responsibly","Stay with the guide, use lights carefully and avoid touching wildlife."],["Return as confirmed","The exact finish time can vary with trail conditions and group pace."]]
    },
    es:{
      guide:"Tu guía",mbw:"Mindo Bird Watching",whatsapp:"Escribir por WhatsApp",directions:"Abrir indicaciones",ready:"Llega al punto de encuentro confirmado. Si coordinaste recogida, debes estar listo 15 minutos antes de la hora de inicio confirmada.",
      packDay:["Calzado cerrado para caminar con buena tracción","Chaqueta impermeable ligera o poncho","Agua y un refrigerio pequeño","Binoculares o cámara, si tienes","Ropa silenciosa de colores neutros","Protección solar y repelente"],
      packNight:["Calzado cerrado con buena tracción","Chaqueta impermeable o poncho para una noche húmeda","Pantalón largo y capas cómodas","Tu propia linterna frontal, si tienes","Agua en una botella reutilizable","Repelente"],
      stepsDay:[["Encuentro con tu guía","Confirmen la ruta, el ritmo, el clima y la fauna de interés."],["Ingreso al bosque nublado","El guía adapta la ruta según la actividad reciente, la elevación y las condiciones."],["Observación responsable","Camina en silencio, sigue las indicaciones del guía y prioriza el bienestar de la fauna."],["Regreso según lo confirmado","El horario puede variar ligeramente por el clima, el acceso y la actividad de la fauna."]],
      stepsNight:[["Encuentro con tu guía","Revisen el sendero, el clima y el equipo antes de entrar al bosque."],["Caminata después del anochecer","Busquen con calma ranas, insectos, arañas, búhos y otra fauna nocturna."],["Observación responsable","Permanece con el guía, usa las luces con cuidado y no toques la fauna."],["Regreso según lo confirmado","La hora exacta de finalización puede variar por el sendero y el ritmo del grupo."]]
    }
  }[lang];
  const set=(id,value)=>{const node=document.getElementById(id);if(node)node.textContent=value;};
  const phone=value=>String(value||"").replace(/[^\d+]/g,"");
  const wa=(number,message)=>`https://wa.me/${phone(number).replace(/^\+/,"")}?text=${encodeURIComponent(message)}`;
  const message=lang==="es"?`Hola, tengo una pregunta sobre mi experiencia: ${data.tour}.`:`Hello, I have a question about my experience: ${data.tour}.`;
  set("tripName",data.tour);set("tripDate",data.date);set("tripStart",data.start);set("tripDuration",data.duration);set("meetingName",data.meeting);set("guideName",data.guide);set("guidePhoneText",data.guidePhone||text.whatsapp);set("mbwPhoneText",data.contact);set("meetingNote",text.ready);
  const directions=document.getElementById("directionsLink");if(directions){directions.textContent=text.directions;directions.href=`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(data.meeting+", Mindo, Ecuador")}`;}
  const guideLink=document.getElementById("guideWhatsApp");if(guideLink){guideLink.textContent=text.whatsapp;guideLink.href=data.guidePhone?wa(data.guidePhone,message):wa(data.contact,message);}
  const mbwLink=document.getElementById("mbwWhatsApp");if(mbwLink){mbwLink.textContent=text.whatsapp;mbwLink.href=wa(data.contact,message);}
  const night=/night|noche|nocturn/i.test(data.type+" "+data.tour);
  const packing=document.getElementById("packingList");if(packing)(night?text.packNight:text.packDay).forEach(item=>{const li=document.createElement("li");li.textContent=item;packing.appendChild(li);});
  const itinerary=document.getElementById("itinerary");if(itinerary)(night?text.stepsNight:text.stepsDay).forEach(([title,body])=>{const li=document.createElement("li");const box=document.createElement("div");const h=document.createElement("h3");const p=document.createElement("p");h.textContent=title;p.textContent=body;box.append(h,p);li.appendChild(box);itinerary.appendChild(li);});
  const query=location.search;
  const switcher=document.getElementById("languageSwitch");if(switcher)switcher.href=(lang==="es"?"/field-pass-companion/":"/es/guia-del-pase-de-campo/")+query;
})();
