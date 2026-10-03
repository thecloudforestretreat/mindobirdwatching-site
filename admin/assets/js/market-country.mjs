const names = new Intl.DisplayNames(['en'], { type: 'region' });
const aliases = new Map();
// Intl also recognizes retired codes; avoid letting DD claim Germany before DE.
const retired=new Set('AN BU CS DD DY FX HV NH NT QU RH SU TP UK VD YD YU ZR'.split(' '));
for (let a = 65; a <= 90; a++) for (let b = 65; b <= 90; b++) {
  const code = String.fromCharCode(a, b), name = names.of(code);
  if (name !== code && !retired.has(code)) { if(!aliases.has(name.toLowerCase()))aliases.set(name.toLowerCase(), code); aliases.set(code.toLowerCase(), code); }
}
Object.entries({usa:'US',us:'US','united states of america':'US',uk:'GB','united kingdom':'GB',england:'GB',scotland:'GB',wales:'GB','great britain':'GB','czech republic':'CZ','south korea':'KR','north korea':'KP',russia:'RU',taiwan:'TW',vietnam:'VN',turkey:'TR','the netherlands':'NL','ivory coast':'CI','congo - kinshasa':'CD','congo - brazzaville':'CG'}).forEach(([name,code])=>aliases.set(name,code));
Object.entries({'hong kong':'HK',macao:'MO',macau:'MO',palestine:'PS','cape verde':'CV','swaziland':'SZ','east timor':'TL','republic of the congo':'CG','democratic republic of the congo':'CD','the bahamas':'BS'}).forEach(([name,code])=>aliases.set(name,code));
export function country(value) {
  const input = String(value || '').trim();
  const code = aliases.get(input.toLowerCase());
  return code ? {code, country:names.of(code)} : {code:'', country:input && !['(not set)','unknown','n/a','-'].includes(input.toLowerCase()) ? 'Unmapped country' : 'Unknown country'};
}
