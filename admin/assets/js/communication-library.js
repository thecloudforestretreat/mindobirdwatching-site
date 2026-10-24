/* Shared communication catalog. Update from verified Staff Info, never per brand. */
(function(global){
"use strict";
const catalog={
  "version": 1,
  "checkedAt": "2026-10-24",
  "source": "Staff Info Library live feed",
  "experiences": [
    {
      "id": "tour-jewels",
      "productCode": "MBW004",
      "sourceId": "en-0005",
      "brands": [
        "mbw",
        "mindo-tours",
        "choco-andino"
      ],
      "price": 60,
      "minGuests": 2,
      "model": "per_person",
      "duration": "Half Day",
      "time": "6:00 AM - 10:00 AM",
      "group": "tours",
      "title": {
        "en": "Half Day Tour 2 - Jewels of the Morning Forest",
        "es": "Half Day Tour 2 - Jewels of the Morning Forest"
      },
      "image": "https://mindobirdwatching.com/assets/images/pages/tours/promos/wide/mbw_tour_promos_HDT_mbw004_en.jpg",
      "url": "https://mindobirdwatching.com/tours/jewels-morning-forest-birding/"
    },
    {
      "id": "tour-andean",
      "productCode": "MBW005",
      "sourceId": "en-0003",
      "brands": [
        "mbw",
        "mindo-tours",
        "choco-andino"
      ],
      "price": 85,
      "minGuests": 2,
      "model": "per_person",
      "duration": "Half Day",
      "time": "5:00 AM - 10:00 AM",
      "group": "tours",
      "title": {
        "en": "Half Day Tour 1 - Dance of the Andean Cock-of-the-Rock",
        "es": "Half Day Tour 1 - Dance of the Andean Cock-of-the-Rock"
      },
      "image": "https://mindobirdwatching.com/assets/images/pages/tours/promos/wide/mbw_tour_promos_HDT_mbw005_en.jpg",
      "url": "https://mindobirdwatching.com/tours/andean-cock-of-the-rock-dawn/"
    },
    {
      "id": "tour-full-day",
      "productCode": "MBW006",
      "sourceId": "en-0001",
      "brands": [
        "mbw",
        "mindo-tours",
        "choco-andino"
      ],
      "price": 115,
      "minGuests": 2,
      "model": "per_person",
      "duration": "Full Day",
      "time": "5:00 AM - 3:00 PM",
      "group": "tours",
      "title": {
        "en": "Full Day Tour - Quest for Five Toucans & the Andean Cock-of-the-Rock",
        "es": "Full Day Tour - Quest for Five Toucans & the Andean Cock-of-the-Rock"
      },
      "image": "https://mindobirdwatching.com/assets/images/pages/tours/promos/wide/mbw_tour_promos_FDT_mbw006_en.jpg",
      "url": "https://mindobirdwatching.com/tours/quest-five-toucans-guide/"
    },
    {
      "id": "tour-hummingbird",
      "productCode": "MBW019",
      "sourceId": "en-mbw019",
      "brands": [
        "mbw",
        "mindo-tours",
        "choco-andino"
      ],
      "price": 60,
      "minGuests": 2,
      "model": "per_person",
      "duration": "3 Hours",
      "time": "11:00 AM - 2:00 PM",
      "group": "tours",
      "title": {
        "en": "Mindo Hummingbird Tour",
        "es": "Tour de Colibries en Mindo"
      },
      "image": "https://mindobirdwatching.com/assets/images/tours/mbw-tour-hummingbirds-001.jpeg",
      "soloPrice": 75,
      "url": "https://mindobirdwatching.com/tours/mindo-hummingbird-tour/"
    },
    {
      "id": "tour-bear-half-day",
      "productCode": "OSO001",
      "sourceId": "en-0113",
      "brands": [
        "mbw",
        "mindo-tours",
        "choco-andino"
      ],
      "price": 150,
      "minGuests": 2,
      "model": "per_person",
      "duration": "Extended Half Day",
      "time": "6:00 AM - 1:00 PM",
      "group": "tours",
      "title": {
        "en": "Extended Half-Day Spectacled Bear Tour",
        "es": "Extended Half-Day Spectacled Bear Tour"
      },
      "image": "https://mindobirdwatching.com/assets/images/tours/mbw-tour-spectacled-bear-001.jpeg",
      "url": "https://mindobirdwatching.com/tours/spectacled-bear-tour-ecuador/"
    },
    {
      "id": "tour-bear-full-day",
      "productCode": "OSO002",
      "sourceId": "en-0115",
      "brands": [
        "mbw",
        "mindo-tours",
        "choco-andino"
      ],
      "price": 200,
      "minGuests": 2,
      "model": "per_person",
      "duration": "Full Day",
      "time": "6:00 AM - 6:00 PM",
      "group": "tours",
      "title": {
        "en": "Full-Day Spectacled Bear, Condor and Andean Wildlife Tour",
        "es": "Full-Day Spectacled Bear, Condor and Andean Wildlife Tour"
      },
      "image": "https://mindobirdwatching.com/assets/images/tours/mbw-tour-spectacled-bear-001.jpeg",
      "url": "https://mindobirdwatching.com/tours/spectacled-bear-tour-ecuador/"
    },
    {
      "id": "night-walk",
      "productCode": "MBW016",
      "sourceId": "en-0043",
      "brands": [
        "mbw",
        "mindo-tours",
        "choco-andino"
      ],
      "price": 35,
      "minGuests": 2,
      "model": "per_person",
      "duration": "Evening",
      "time": "",
      "group": "activities",
      "title": {
        "en": "Night Walk",
        "es": "Caminata Nocturna"
      },
      "image": "https://mindobirdwatching.com/assets/images/pages/tours/promos/wide/mbw_tour_promos_night_walk_wide_en.jpg",
      "url": "https://mindobirdwatching.com/activities/night-walk/"
    },
    {
      "id": "activity-chocolate",
      "productCode": "MBW011",
      "sourceId": "en-0023",
      "brands": [
        "mbw",
        "mindo-tours",
        "choco-andino"
      ],
      "price": 15,
      "minGuests": 1,
      "model": "per_person",
      "duration": "Flexible",
      "time": "",
      "group": "activities",
      "title": {
        "en": "Chocolate Tour",
        "es": "Chocolate Tour"
      },
      "image": "https://mindobirdwatching.com/assets/images/pages/activities/chocolate-tour/chocolate_tour_horizontal_01.jpg",
      "url": "https://mindobirdwatching.com/activities/chocolate-tour/"
    },
    {
      "id": "activity-butterfly",
      "productCode": "MBW015",
      "sourceId": "en-0027",
      "brands": [
        "mbw",
        "mindo-tours",
        "choco-andino"
      ],
      "price": 10,
      "minGuests": 1,
      "model": "per_person",
      "duration": "Flexible",
      "time": "",
      "group": "activities",
      "title": {
        "en": "Butterfly Tour",
        "es": "Butterfly Tour"
      },
      "image": "https://mindobirdwatching.com/assets/images/pages/activities/butterly-tour/mbw_butterflies_0001.jpg",
      "url": "https://mindobirdwatching.com/activities/butterfly-tour/"
    },
    {
      "id": "activity-canopy",
      "productCode": "MBW014",
      "sourceId": "en-0021",
      "brands": [
        "mbw",
        "mindo-tours",
        "choco-andino"
      ],
      "price": 30,
      "minGuests": 1,
      "model": "per_person",
      "duration": "Flexible",
      "time": "",
      "group": "activities",
      "title": {
        "en": "Canopy / Ziplining",
        "es": "Canopy / tirolesa"
      },
      "image": "https://mindobirdwatching.com/assets/images/activities/mbw-activities-canopy-001.jpeg",
      "description": {
        "en": "Canopy and ziplining in Mindo. Confirm availability and participation requirements before booking.",
        "es": "Canopy y tirolesa en Mindo. Consulte la disponibilidad y los requisitos de participación antes de reservar."
      },
      "url": "https://mindobirdwatching.com/activities/ziplining/"
    },
    {
      "id": "activity-canyoning",
      "productCode": "ACT013",
      "sourceId": "en-0041",
      "brands": [
        "mbw",
        "mindo-tours",
        "choco-andino"
      ],
      "price": 25,
      "minGuests": 2,
      "model": "per_person",
      "duration": "Flexible",
      "time": "",
      "group": "activities",
      "title": {
        "en": "Canyoning",
        "es": "Canyoning"
      },
      "image": "https://mindobirdwatching.com/assets/images/activities/mbw-activities-canyoning-001.jpeg",
      "description": {
        "en": "Waterfall descent near Mindo with specialized guides and safety equipment.",
        "es": "Descenso de cascadas cerca de Mindo con guías especializados y equipo de seguridad."
      },
      "url": "https://mindobirdwatching.com/activities/canyoning/"
    },
    {
      "id": "activity-coffee",
      "productCode": "MBW012",
      "sourceId": "en-0025",
      "brands": [
        "mbw",
        "mindo-tours",
        "choco-andino"
      ],
      "price": 15,
      "minGuests": 1,
      "model": "per_person",
      "duration": "Flexible",
      "time": "",
      "group": "activities",
      "title": {
        "en": "Coffee Tour",
        "es": "Tour de café"
      },
      "image": "https://mindobirdwatching.com/assets/images/activities/mbw-activities-coffee-tour-002.jpeg",
      "description": {
        "en": "Follow the coffee process from plant to cup on a local coffee farm.",
        "es": "Conozca el proceso del café, desde la planta hasta la taza, en una finca local."
      },
      "url": "https://mindobirdwatching.com/activities/coffee-tour/"
    },
    {
      "id": "activity-flora",
      "productCode": "MBW009",
      "sourceId": "en-mbw009",
      "brands": [
        "mbw",
        "mindo-tours",
        "choco-andino"
      ],
      "price": 50,
      "minGuests": 1,
      "model": "per_person",
      "duration": "Half Day",
      "time": "",
      "group": "activities",
      "title": {
        "en": "Flora Excursion",
        "es": "Excursión botánica"
      },
      "image": "https://mindobirdwatching.com/assets/images/activities/mbw-activities-flora-excursion-001.jpeg",
      "description": {
        "en": "Half-day flora excursion. The final quote depends on the duration confirmed with our team.",
        "es": "Excursión botánica de medio día. La cotización final depende de la duración acordada con nuestro equipo."
      },
      "url": "https://mindobirdwatching.com/activities/",
      "priceNote": {
        "en": "Half-day base price; final price depends on confirmed duration.",
        "es": "Tarifa base de medio día; el precio final depende de la duración confirmada."
      }
    },
    {
      "id": "activity-horseback",
      "productCode": "ACT016",
      "sourceId": "en-0047",
      "brands": [
        "mbw",
        "mindo-tours",
        "choco-andino"
      ],
      "price": 25,
      "minGuests": 1,
      "model": "per_person",
      "duration": "Flexible",
      "time": "",
      "group": "activities",
      "title": {
        "en": "Horseback Riding",
        "es": "Paseo a caballo"
      },
      "image": "https://mindobirdwatching.com/assets/images/activities/mbw-activities-horseback-riding-001.jpeg",
      "description": {
        "en": "A guided horseback ride along local routes around Mindo. Horse availability must be confirmed.",
        "es": "Paseo guiado a caballo por rutas de los alrededores de Mindo. Es necesario confirmar la disponibilidad de caballos."
      },
      "url": "https://mindobirdwatching.com/activities/horseback-riding/"
    },
    {
      "id": "activity-macro",
      "productCode": "ACT021",
      "sourceId": "en-act021",
      "brands": [
        "mbw",
        "mindo-tours",
        "choco-andino"
      ],
      "price": 110,
      "minGuests": 1,
      "model": "per_person",
      "duration": "Custom",
      "time": "",
      "group": "activities",
      "title": {
        "en": "Private Insect & Macro Wildlife Search",
        "es": "Búsqueda privada de insectos y fauna macro"
      },
      "image": "https://mindobirdwatching.com/assets/images/activities/mbw-activities-macro-001.jpeg",
      "description": {
        "en": "A private search focused on insects and small wildlife. Timing and target species are arranged with our team. Sightings are not guaranteed.",
        "es": "Búsqueda privada de insectos y fauna pequeña. El horario y las especies de interés se coordinan con nuestro equipo. No se garantizan avistamientos."
      },
      "url": "https://mindobirdwatching.com/activities/private-insect-macro-wildlife-search/",
      "priceNote": {
        "en": "Per person, per private session. Additional sessions quoted separately.",
        "es": "Por persona y por sesión privada. Las sesiones adicionales se cotizan por separado."
      }
    },
    {
      "id": "activity-orchid",
      "productCode": "ACT009",
      "sourceId": "en-0029",
      "brands": [
        "mbw",
        "mindo-tours",
        "choco-andino"
      ],
      "price": 10,
      "minGuests": 1,
      "model": "per_person",
      "duration": "Flexible",
      "time": "",
      "group": "activities",
      "title": {
        "en": "Orchid Garden Tour",
        "es": "Visita al jardín de orquídeas"
      },
      "image": "https://mindobirdwatching.com/assets/images/activities/mbw-activities-orchid-tour-001.jpeg",
      "description": {
        "en": "Visit a garden with native orchid species and seasonal blooms.",
        "es": "Visite un jardín con especies de orquídeas nativas y flores de temporada."
      },
      "url": "https://mindobirdwatching.com/activities/orchid-garden-tour/"
    },
    {
      "id": "activity-paintball",
      "productCode": "ACT015",
      "sourceId": "en-0045",
      "brands": [
        "mbw",
        "mindo-tours",
        "choco-andino"
      ],
      "price": 20,
      "minGuests": 1,
      "model": "per_person",
      "duration": "Flexible",
      "time": "",
      "group": "activities",
      "title": {
        "en": "Paintball",
        "es": "Paintball"
      },
      "image": "https://mindobirdwatching.com/assets/images/activities/mbw-activities-paintball-001.jpeg",
      "description": {
        "en": "Play paintball in a forest setting with friends, family or a group.",
        "es": "Juegue paintball en un entorno de bosque con amigos, familiares o su grupo."
      },
      "url": "https://mindobirdwatching.com/activities/paintball/"
    },
    {
      "id": "activity-quad",
      "productCode": "ACT004",
      "sourceId": "en-0019",
      "brands": [
        "mbw",
        "mindo-tours",
        "choco-andino"
      ],
      "price": 30,
      "minGuests": 1,
      "model": "per_quad",
      "duration": "Flexible",
      "time": "",
      "group": "activities",
      "title": {
        "en": "Quad Tour",
        "es": "Paseo en cuatrimoto"
      },
      "image": "https://mindobirdwatching.com/assets/images/activities/mbw-activities-quad-tour-001.jpeg",
      "description": {
        "en": "A quad outing in Mindo, priced per quad. Up to two guests may share a quad; participation requirements must be confirmed.",
        "es": "Paseo en cuatrimoto en Mindo, con tarifa por cuatrimoto. Pueden compartirla hasta dos personas; consulte los requisitos de participación."
      },
      "url": "https://mindobirdwatching.com/activities/quad-tour/"
    },
    {
      "id": "activity-tubing",
      "productCode": "ACT011",
      "sourceId": "en-0033",
      "brands": [
        "mbw",
        "mindo-tours",
        "choco-andino"
      ],
      "price": 10,
      "minGuests": 4,
      "model": "per_person",
      "duration": "Flexible",
      "time": "",
      "group": "activities",
      "title": {
        "en": "Tubing — Mindo River, Level I",
        "es": "Tubing — río Mindo, nivel I"
      },
      "image": "https://mindobirdwatching.com/assets/images/activities/mbw-activities-tubing-001.jpeg",
      "description": {
        "en": "A river tubing outing near Mindo. Route suitability depends on river and weather conditions. Four-person minimum billing applies.",
        "es": "Recorrido de tubing cerca de Mindo. La ruta depende de las condiciones del río y del clima. Se aplica un cobro mínimo de cuatro personas."
      },
      "url": "https://mindobirdwatching.com/activities/tubing/",
      "priceNote": {
        "en": "$40 group minimum (4 guests).",
        "es": "Cobro mínimo de $40 por grupo (4 personas)."
      }
    },
    {
      "id": "activity-frog-concert",
      "productCode": "ACT010",
      "sourceId": "en-0031",
      "brands": [
        "mbw",
        "mindo-tours",
        "choco-andino"
      ],
      "price": 10,
      "minGuests": 2,
      "model": "per_person",
      "duration": "Evening",
      "time": "",
      "group": "activities",
      "title": {
        "en": "Frog Concert",
        "es": "Concierto de ranas"
      },
      "description": {
        "en": "An evening activity focused on the sounds and wildlife of Mindo’s cloud forest. Sightings vary.",
        "es": "Actividad nocturna centrada en los sonidos y la fauna del bosque nublado de Mindo. Los avistamientos varían."
      },
      "url": "https://mindobirdwatching.com/activities/frog-concert/",
      "image": "https://mindobirdwatching.com/assets/images/pages/tours/promos/wide/mbw_tour_promos_night_walk_wide_en.jpg"
    },
    {
      "id": "rate-MBW007",
      "productCode": "MBW007",
      "sourceId": "en-mbw007",
      "brands": [
        "mbw",
        "mindo-tours",
        "choco-andino"
      ],
      "price": 125,
      "minGuests": 1,
      "model": "per_person",
      "rateOnly": true,
      "image": "https://mindobirdwatching.com/assets/images/pages/mbw_custom_tour_01.jpg"
    },
    {
      "id": "rate-MBW008",
      "productCode": "MBW008",
      "sourceId": "en-mbw008",
      "brands": [
        "mbw",
        "mindo-tours",
        "choco-andino"
      ],
      "price": 175,
      "minGuests": 1,
      "model": "per_person",
      "rateOnly": true,
      "image": "https://mindobirdwatching.com/assets/images/pages/mbw_custom_tour_01.jpg"
    },
    {
      "id": "rate-MBW010",
      "productCode": "MBW010",
      "sourceId": "en-mbw010",
      "brands": [
        "mbw",
        "mindo-tours",
        "choco-andino"
      ],
      "price": 99,
      "minGuests": 1,
      "model": "per_person",
      "rateOnly": true
    },
    {
      "id": "rate-MBW017",
      "productCode": "MBW017",
      "sourceId": "en-mbw017",
      "brands": [
        "mbw",
        "mindo-tours",
        "choco-andino"
      ],
      "price": 50,
      "minGuests": 1,
      "model": "per_person",
      "rateOnly": true
    },
    {
      "id": "rate-TRANS05",
      "productCode": "TRANS05",
      "sourceId": "en-trans05",
      "brands": [
        "mbw",
        "mindo-tours",
        "choco-andino"
      ],
      "price": 50,
      "minGuests": 1,
      "model": "flat",
      "rateOnly": true
    }
  ]
};
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const brands=Object.freeze({
 'mbw':{id:'mbw',name:'Mindo Bird Watching',site:'https://mindobirdwatching.com',logo:'https://mindobirdwatching.com/assets/images/logo/mbw-logo-mark-1024.png',email:'mindobirdwatching@gmail.com',tagline:{en:'Private & group cloud forest tours',es:'Tours privados y grupales en el bosque nublado'}},
 'mindo-tours':{id:'mindo-tours',name:'Mindo Tours',site:'https://mindotours.com',logo:'https://mindotours.com/assets/logo/mindo_tours_logo_512.png',email:'mindobirdwatching@gmail.com',tagline:{en:'Mindo activities & day trips',es:'Actividades y excursiones en Mindo'}},
 'choco-andino':{id:'choco-andino',name:'Chocó Andino Tours',site:'https://chocoandinotours.com',logo:'https://chocoandinotours.com/assets/logo/choco_andino_tours_logo_512.png',email:'mindobirdwatching@gmail.com',tagline:{en:'Experiences in the Chocó Andino',es:'Experiencias en el Chocó Andino'}}
});
const brand=id=>brands[id]||brands.mbw;
const allows=(item,id)=>!item.brands||item.brands.includes(brand(id).id);
const byCode=code=>catalog.experiences.find(x=>x.productCode===code);
const byId=id=>catalog.experiences.find(x=>x.id===id);
function priceText(item,lang='en'){
 const unit=item.model==='per_quad'?(lang==='es'?'por cuatrimoto':'per quad'):(lang==='es'?'por persona':'per person');
 return '$'+item.price+' '+unit+(item.productCode==='ACT021'?(lang==='es'?' por sesión privada':' per private session'):'');
}
function block(base,item,lang='en',id='mbw'){
 const extra={};
 if(item){
  if(item.image)extra.image=item.image;
  if(item.description)extra.description=item.description[lang]||item.description.en;
  if(item.title)extra.title=item.title[lang]||item.title.en;
  if(item.url)extra.url=item.url;
  extra.price=priceText(item,lang);
  extra.duration=item.time||item.duration;
  extra.minimum=item.minGuests>1?(lang==='es'?'Mínimo '+item.minGuests+' personas':'Minimum '+item.minGuests+' guests'):'';
  extra.privatePrice=item.soloPrice?(lang==='es'?'Tarifa individual: $':'Solo rate: $')+item.soloPrice:'';
  extra.priceNote=item.priceNote?.[lang]||'';
  if(extra.priceNote)extra.ctaNote=extra.priceNote;
  extra.productCode=item.productCode;
  extra.brands=item.brands;
 }
 const result={...base,...extra};
 if(result.id==='social-links'&&brand(id).id!=='mbw'){
  result.title=lang==='es'?'Reseñas, fotos y videos de Mindo Bird Watching':'Mindo Bird Watching reviews, photos & videos';
  result.description=lang==='es'?'Consulte reseñas de huéspedes, fotos y videos de Mindo Bird Watching.':'Read Mindo Bird Watching guest reviews and explore its photos and videos.';
 }
 if(lang==='es')result.duration=({'Half Day':'Medio día','Extended Half Day':'Medio día extendido','Full Day':'Día completo','3 Hours':'3 horas','Flexible':'Flexible','Custom':'A convenir','Evening':'Por la noche'})[result.duration]||result.duration;
 if(brand(id).id!=='mbw'&&result.group==='tours')result.group='activities';
 return result;
}
function emailCatalog(base,id='mbw',lang='en'){
 const map=new Map(base.blocks.map(x=>[x.id,x]));
 for(const x of catalog.experiences.filter(x=>!x.rateOnly&&allows(x,id))){
  if(!map.has(x.id))map.set(x.id,{id:x.id,group:x.group,type:x.group==='tours'?'tour':'activity',primaryCta:lang==='es'?'Ver actividad':'View activity'});
 }
 const blocks=[...map.values()].filter(x=>allows(byId(x.id)||x,id)).map(x=>block(x,byId(x.id),lang,id));
 return {...base,brand:{...base.brand,...brand(id)},groups:base.groups.map(x=>({...x,label:x.id==='activities'?(lang==='es'?'Actividades y experiencias':'Activities & experiences'):x.label})),blocks};
}
function applyItineraryCatalog(options,defaults,rules,labels){
 for(const x of catalog.experiences){
  const key=Object.keys(defaults).find(k=>k.startsWith(x.productCode+' - '));
  if(!key)continue;
  rules[x.productCode]={...rules[x.productCode],model:x.model,price:x.price,minGuests:x.minGuests,minimumBilledQuantity:x.productCode==='ACT011'?4:1,soloPrice:x.soloPrice||null};
  defaults[key]={...defaults[key],unitPrice:x.price};
  if(x.description){defaults[key].note=x.description.en+(x.priceNote?' '+x.priceNote.en:'');defaults[key].duration=x.duration;}
  if(x.title&&labels)labels[key]=x.productCode+' - '+x.title.es;
 }
}
function experienceFor(item){const code=String(item.productPreset||item.name||'').match(/^([A-Z0-9-]+)\s+-\s+/)?.[1];return byCode(code);}
function imageRow(item,lang='en'){const x=experienceFor(item);return x?.image?`<tr><td colspan="3" style="padding:0;"><img src="${esc(x.image)}" width="600" alt="${esc(x.title?.[lang]||x.title?.en||'Activity')}" style="display:block;width:100%;max-width:600px;height:auto;border:0;"></td></tr>`:'';}
function header(id,lang='en'){
 const b=brand(id);return `<tr><td style="padding:0 20px 10px;"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#fff;border:1px solid #d9e2d5;border-radius:18px;"><tr><td style="padding:14px 18px;"><table role="presentation" cellspacing="0" cellpadding="0" border="0"><tr><td style="padding-right:12px;"><a href="${b.site}"><img src="${b.logo}" width="78" height="78" alt="${esc(b.name)}" style="display:block;width:78px;height:78px;object-fit:contain;border:0;"></a></td><td><a href="${b.site}" style="text-decoration:none;color:#0D5925;"><strong style="display:block;font-family:Georgia,serif;font-size:25px;line-height:29px;">${esc(b.name)}</strong><span style="display:block;margin-top:3px;color:#536067;font-size:12px;line-height:17px;">${esc(b.tagline[lang]||b.tagline.en)}</span></a></td></tr></table></td></tr></table></td></tr>`;
}
function iconsFor(id,icons,whatsapp){const b=brand(id);return b.id==='mbw'?icons:[{href:b.site,img:b.logo,w:28,h:28,alt:b.name},{href:whatsapp,img:'https://i.imgur.com/0sfOKs8.png',w:28,h:28,alt:'WhatsApp'}];}
function signature(id,lang,icons=[],whatsapp=''){
 const b=brand(id);return `<tr><td style="padding:0 20px 10px;"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#fff;border:1px solid #d9e2d5;border-radius:18px;"><tr><td style="padding:18px;"><p style="margin:0 0 10px;font-size:14px;line-height:20px;">${lang==='es'?'Saludos cordiales,':'Warm regards,'}<br><strong>${esc(b.name)}</strong></p><table role="presentation" cellspacing="0" cellpadding="0" border="0"><tr>${iconsFor(id,icons,whatsapp).map(x=>`<td style="padding:0 7px 7px 0;"><a href="${esc(x.href)}"><img src="${esc(x.img)}" width="28" height="28" alt="${esc(x.alt)}" style="display:block;width:28px;height:28px;object-fit:contain;border:0;"></a></td>`).join('')}</tr></table><p style="margin:5px 0 0;font-size:12px;line-height:18px;">Ecuador<br><a href="${b.site}">${esc(new URL(b.site).hostname)}</a> | <a href="mailto:${b.email}">${b.email}</a></p></td></tr></table></td></tr>`;
}
function footer(id){const b=brand(id);return `<tr><td align="center" style="padding:14px 24px 6px;font-size:11px;line-height:16px;color:#32453d;"><a href="${b.site}" style="text-decoration:none;color:inherit;">${esc(b.name)} © ${new Date().getFullYear()}</a></td></tr>`;}
function mountSelector(anchor,selected,onChange){
 const bar=document.createElement('section');bar.className='communicationBrandBar';bar.setAttribute('aria-label','Communication brand');
 const label=document.createElement('label');label.textContent='Communication brand';const select=document.createElement('select');select.id='communicationBrand';
 for(const b of Object.values(brands)){const option=document.createElement('option');option.value=b.id;option.textContent=b.name;select.append(option);}select.value=brand(selected).id;label.append(select);
 const note=document.createElement('span');note.textContent='Shared activities, images and standard prices · branding changes only';bar.append(label,note);anchor.before(bar);
 select.addEventListener('change',()=>onChange(select.value));return select;
}
global.MBW_COMMUNICATIONS=Object.freeze({catalog,brands,brand,allows,byCode,byId,block,emailCatalog,applyItineraryCatalog,experienceFor,imageRow,header,signature,footer,mountSelector});

})(window);
