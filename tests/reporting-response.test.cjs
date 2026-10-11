const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync('admin/portfolio/dashboard.js','utf8').split('const config=')[0];
const context=vm.createContext({Error});vm.runInContext(source,context);const read=context.readReportingJSON;
const response=(type,data,extra={})=>({status:200,headers:{get:()=>type},json:async()=>data,...extra});
test('accepts actual reporting JSON',async()=>assert.deepEqual(await read(response('application/json',{ok:true})),{ok:true}));
test('HTML fallback never surfaces a JSON parser error',async()=>assert.rejects(read(response('text/html',null,{json:()=>{throw Error('must not parse')}})),/webpage instead of data/));
test('expired sessions and login redirects explain reauthentication',async()=>{
 await assert.rejects(read(response('text/html',null,{status:401})),/Sign in again/);
 await assert.rejects(read(response('text/html',null,{redirected:true,url:'https://example.com/login'})),/Sign in again/);
});
test('malformed JSON gives a controlled failure',async()=>assert.rejects(read(response('application/json',null,{json:async()=>{throw SyntaxError('Unexpected token')}})),/invalid data/));
