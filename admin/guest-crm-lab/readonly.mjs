import './daily-workflows.mjs?v=3';
const B=window.MbwCrmLab;
const status=document.createElement('p');status.id='labDataFreshness';status.className='lab-data-freshness';status.setAttribute('role','status');document.querySelector('.lab-saved-views')?.before(status);
let refreshing=false,lastAttempt=Date.now();
function update(){const s=B.snapshot(),time=s.lastRefresh?new Intl.DateTimeFormat('en-US',{dateStyle:'medium',timeStyle:'short',timeZone:'America/New_York'}).format(new Date(s.lastRefresh))+' ET':'not yet loaded';status.textContent=s.liveLoaded?`Live CRM · Read only · Last successful sync ${time} · Refreshes every 5 minutes while visible.`:`Connecting to live CRM · Read only · ${s.records.length?'Showing cached records until the connection succeeds.':'Waiting for records.'}`;status.dataset.connected=String(s.liveLoaded);}
async function refresh(){if(document.hidden||refreshing||Date.now()-lastAttempt<285000)return;refreshing=true;lastAttempt=Date.now();try{await B.refresh()}finally{refreshing=false;update()}}
document.addEventListener('mbw-lab-render',update);document.addEventListener('visibilitychange',refresh);setInterval(refresh,30000);update();
const mobile=matchMedia('(max-width:720px)'),nav=document.querySelector('.lab-sidebar nav'),navMenu=document.createElement('details');navMenu.className='lab-mobile-menu';navMenu.innerHTML='<summary>Sections · Today & statuses</summary>';nav.before(navMenu);navMenu.append(nav);
const presets=document.querySelector('.lab-view-presets'),presetMenu=document.createElement('details');presetMenu.className='lab-mobile-presets';presetMenu.innerHTML='<summary>Priority filters</summary>';presets.before(presetMenu);presetMenu.append(presets);
function layout(){navMenu.open=presetMenu.open=!mobile.matches;}
layout();mobile.addEventListener('change',layout);nav.addEventListener('click',e=>{const b=e.target.closest('[data-view]');if(b){navMenu.querySelector('summary').textContent='Sections · '+b.textContent;if(mobile.matches)navMenu.open=false}});
let mobileCalendarOpened=false;nav.addEventListener('click',e=>{if(mobile.matches&&!mobileCalendarOpened&&e.target.closest('[data-view="calendar"]')){mobileCalendarOpened=true;document.getElementById('labDayView')?.click()}});
