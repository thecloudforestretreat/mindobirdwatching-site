"""Read-only CRM refresh using existing AI-OS Google Keychain authorization."""
import fcntl,json,os,tempfile,time
from pathlib import Path
from datetime import datetime,timezone
ROOT=Path(__file__).resolve().parent
PRIVATE=ROOT/'private'
SPREADSHEET='1rdPmYmhCehx_3bI737dkg8NyiutwIu3NAav7B-mbwlw'
SHEET='crm_pipeline_review'
SHEET_ID=302848462
CRM_SHEET='crm_inquiries'
CRM_SHEET_ID=613590723
FIELDS='inquiry_id created_at updated_at source_tab source_row status last_contacted_at followup_date next_action priority first_name last_name full_name email phone_normalized requested_date_start requested_date_end requested_date_text guest_count tour_type tour_category grouping_preference grouping_status accommodation_needs transportation_needed pickup_location special_interests message_questions'.split()
CRM_MERGE_FIELDS='guest_id assigned_to guest_count_text country home_country message_questions inquiry_studio_id inquiry_studio_status inquiry_studio_updated_at'.split()
def atomic(path,data):
 fd,name=tempfile.mkstemp(prefix='.crm-',dir=path.parent)
 try:
  with os.fdopen(fd,'w') as f:
   json.dump(data,f,ensure_ascii=False,indent=2);f.write('\n');f.flush();os.fsync(f.fileno())
  os.replace(name,path)
 finally:
  if os.path.exists(name):os.unlink(name)
def normalize(values):
 if not values or values[0]!=FIELDS:raise ValueError('CRM column layout changed; previous snapshot retained')
 records=[];seen=set()
 for values_row in values[1:]:
  if not any(str(v).strip() for v in values_row):continue
  if len(values_row)>len(FIELDS):raise ValueError('Unexpected CRM columns')
  row=dict(zip(FIELDS,[str(v) for v in values_row]+['']*(len(FIELDS)-len(values_row))))
  identifier=row['inquiry_id'].strip()
  if not identifier or identifier in seen:raise ValueError('Missing or duplicate inquiry ID; previous snapshot retained')
  row['inquiry_id']=identifier;seen.add(identifier);records.append(row)
 if not records:raise ValueError('CRM returned no inquiries; previous snapshot retained')
 return records
def merge_crm(records,values):
 if not values or 'inquiry_id' not in values[0]:raise ValueError('CRM inquiry layout changed; previous snapshot retained')
 header=values[0]
 if len(set(header))!=len(header):raise ValueError('CRM inquiry columns are duplicated')
 lookup={}
 for source in values[1:]:
  row=dict(zip(header,[str(v) for v in source]+['']*(len(header)-len(source))))
  identifier=row.get('inquiry_id','').strip()
  if identifier:lookup[identifier]=row
 for record in records:
  source=lookup.get(record['inquiry_id'],{})
  for field in CRM_MERGE_FIELDS:
   if source.get(field,'').strip() or field.startswith('inquiry_studio_'):
    record[field]=source.get(field,'')
 return records
def refresh_once(service=None,private=PRIVATE):
 private.mkdir(mode=0o700,exist_ok=True)
 with (private/'.crm-sync.lock').open('w') as lock:
  fcntl.flock(lock,fcntl.LOCK_EX|fcntl.LOCK_NB)
  try:
   if service is None:
    from ai_os.google_workspace.config import load_google_workspace_configuration
    from ai_os.google_workspace.credentials import GoogleSystemKeyringStore
    from ai_os.google_workspace.oauth import GoogleOAuthManager
    from googleapiclient.discovery import build
    credentials=GoogleOAuthManager(GoogleSystemKeyringStore()).credentials(load_google_workspace_configuration().account('mbw-primary'))
    service=build('sheets','v4',credentials=credentials,cache_discovery=False)
   api=service.spreadsheets()
   metadata=api.get(spreadsheetId=SPREADSHEET,fields='sheets.properties').execute()
   prop=next((x['properties'] for x in metadata['sheets'] if x['properties'].get('sheetId')==SHEET_ID),None)
   crm_prop=next((x['properties'] for x in metadata['sheets'] if x['properties'].get('sheetId')==CRM_SHEET_ID),None)
   if not prop or prop['title']!=SHEET:raise ValueError('Expected CRM tab missing or renamed')
   if not crm_prop or crm_prop['title']!=CRM_SHEET:raise ValueError('Expected crm_inquiries tab missing or renamed')
   limit=prop['gridProperties']['rowCount']
   if not 2<=limit<=20000:raise ValueError('CRM row capacity needs review')
   header=api.values().get(spreadsheetId=SPREADSHEET,range=f"'{SHEET}'!A1:AB1").execute().get('values',[])
   values=list(header)
   for start in range(2,limit+1,1000):
    values.extend(api.values().get(spreadsheetId=SPREADSHEET,range=f"'{SHEET}'!A{start}:AB{min(start+999,limit)}",valueRenderOption='FORMATTED_VALUE').execute().get('values',[]))
   records=normalize(values)
   crm_limit=crm_prop['gridProperties']['rowCount']
   if not 2<=crm_limit<=20000:raise ValueError('crm_inquiries row capacity needs review')
   crm_values=[]
   for start in range(1,crm_limit+1,500):
    crm_values.extend(api.values().get(spreadsheetId=SPREADSHEET,range=f"'{CRM_SHEET}'!A{start}:DP{min(start+499,crm_limit)}",valueRenderOption='FORMATTED_VALUE').execute().get('values',[]))
   records=merge_crm(records,crm_values)
   now=datetime.now(timezone.utc).isoformat()
   data={'source':{'spreadsheet_id':SPREADSHEET,'sheet':SHEET,'range':f'A1:AB{limit}','details_sheet':CRM_SHEET,'details_range':f'A1:DP{crm_limit}','imported_at':now,'mode':'read-only CRM sync','refresh_interval_seconds':300},'records':records}
   current=private/'inquiries.json'
   original=private/'inquiries-before-live-sync.json'
   if current.exists() and not original.exists():atomic(original,json.loads(current.read_text()))
   atomic(current,data)
   status={'ok':True,'checked_at':now,'records':len(records)}
   atomic(private/'crm-sync-status.json',status)
   return status
  except Exception as exc:
   # Do not expose credential/network exception payloads or replace last-valid data.
   atomic(private/'crm-sync-status.json',{'ok':False,'checked_at':datetime.now(timezone.utc).isoformat(),'error':'CRM refresh failed; showing the last successful copy.','error_type':type(exc).__name__})
   raise
def refresh(service=None,private=PRIVATE,attempts=3):
 for attempt in range(attempts):
  try:return refresh_once(service,private)
  except BlockingIOError:raise
  except Exception:
   if attempt+1==attempts:raise
   time.sleep(2)

if __name__=='__main__':
 os.umask(0o077)
 try:print(json.dumps(refresh()))
 except Exception as exc:
  print(json.dumps({'ok':False,'error_type':type(exc).__name__,'error':'CRM refresh failed; previous snapshot retained'}));raise SystemExit(1)
