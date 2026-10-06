// Isolated restore drill only. Creates a NEW SQLite file; never connects to D1 or CRM.
import fs from 'node:fs';import {DatabaseSync} from 'node:sqlite';import {pathToFileURL} from 'node:url';
import {SCHEMA} from '../functions/api/whatsapp/workspace.js';
import {inspectSnapshot,unpackBackup,decryptBackup} from '../admin/assets/js/whatsapp-continuity.mjs';
export function restoreToFile(snapshot,output){
 const summary=inspectSnapshot(snapshot);fs.closeSync(fs.openSync(output,'wx',0o600));let db;
 try{
  db=new DatabaseSync(output);db.exec('BEGIN');for(const sql of SCHEMA)db.exec(sql);
  for(const t of snapshot.threads){const {revision,...data}=t;db.prepare('INSERT INTO wa_test_threads(id,revision,data) VALUES(?,?,?)').run(t.id,Number.isInteger(revision)&&revision>0?revision:1,JSON.stringify(data));}
  for(const s of snapshot.staff||[])db.prepare('INSERT INTO wa_test_staff(email,name,seen,thread_id,editing) VALUES(?,?,?,?,?)').run(s.email,s.name,s.seen||'1970-01-01T00:00:00Z',s.thread_id||'',s.editing?1:0);
  for(const r of snapshot.replies)db.prepare('INSERT INTO wa_test_replies(id,revision,data) VALUES(?,?,?)').run(r.id,r.revision||1,JSON.stringify(r));
  for(const e of snapshot.events)db.prepare('INSERT INTO wa_test_events(id,thread_id,actor,action,at,data) VALUES(?,?,?,?,?,?)').run(e.id,e.thread_id||'',e.actor,e.action,e.at,e.data||null);
  for(const h of snapshot.learningHistory)db.prepare('INSERT INTO wa_test_learning(id,version,actor,at,data) VALUES(?,?,?,?,?)').run(h.id,h.version,h.actor,h.at,h.data);
  if(Number(db.prepare('SELECT COUNT(*) n FROM wa_test_threads').get().n)!==summary.conversations)throw Error('Restore count mismatch');
  db.exec('COMMIT');db.close();return summary;
 }catch(error){try{db?.close();}catch{}fs.unlinkSync(output);throw error;}
}
async function main(){const [input,output]=process.argv.slice(2);if(!input||!output)throw Error('Usage: node scripts/restore-whatsapp-test-backup.mjs encrypted-backup.json NEW-test-restore.sqlite');const size=fs.statSync(input).size;if(size>20*1024*1024)throw Error('File exceeds test limit');let value=JSON.parse(fs.readFileSync(input,'utf8'));if(value.format==='mbw-whatsapp-encrypted-backup')value=await decryptBackup(value,process.env.MBW_BACKUP_PASSPHRASE||'');const {snapshot}=await unpackBackup(value);console.log(JSON.stringify({mode:'isolated_restore_drill',...restoreToFile(snapshot,output)}));}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)main().catch(error=>{console.error(error.message);process.exitCode=1;});
