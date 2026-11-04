/* Lab-only storage adapter: full guest records stay in memory, not a second disk cache. */
(()=>{'use strict';const memory=new Map(),recordKey='mbwCrmLabRecords';let unavailable=false;
function browser(){try{return window.localStorage}catch{unavailable=true;return null}}
const store={getItem(key){key=String(key);if(memory.has(key))return memory.get(key);if(key===recordKey)return null;try{return browser()?.getItem(key)??null}catch{unavailable=true;return null}},setItem(key,value){key=String(key);value=String(value);memory.set(key,value);if(key===recordKey)return;try{const storage=browser();if(storage)storage.setItem(key,value)}catch{unavailable=true}},removeItem(key){key=String(key);memory.delete(key);try{browser()?.removeItem(key)}catch{unavailable=true}},get sessionOnly(){return unavailable}};
// Remove only the obsolete Lab duplicate. Never clear storage or the working CRM cache.
try{browser()?.removeItem(recordKey)}catch{unavailable=true}
window.MbwLabStorage=store;
})();
