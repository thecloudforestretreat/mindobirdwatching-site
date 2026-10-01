import json,tempfile,unittest
from pathlib import Path
import crm_sync
from unittest.mock import patch
class Fake:
 def __init__(self,rows,fail=False):self.rows=rows;self.fail=fail;self.request={}
 def spreadsheets(self):return self
 def values(self):return self
 def get(self,**kwargs):self.request=kwargs;return self
 def execute(self):
  if self.fail:raise RuntimeError('secret detail must not appear in status')
  if 'fields' in self.request:return {'sheets':[
   {'properties':{'sheetId':crm_sync.SHEET_ID,'title':crm_sync.SHEET,'gridProperties':{'rowCount':20}}},
   {'properties':{'sheetId':crm_sync.CRM_SHEET_ID,'title':crm_sync.CRM_SHEET,'gridProperties':{'rowCount':20}}}
  ]}
  if crm_sync.CRM_SHEET in self.request['range']:return {'values':[['inquiry_id']+crm_sync.CRM_MERGE_FIELDS]}
  return {'values':[crm_sync.FIELDS] if self.request['range'].endswith('AB1') else self.rows}
class SyncTests(unittest.TestCase):
 def test_transient_failure_retries_successfully(self):
  with patch('crm_sync.refresh_once',side_effect=[ValueError('temporary'),{'ok':True}]) as call,patch('crm_sync.time.sleep'):
   self.assertTrue(crm_sync.refresh()['ok']);self.assertEqual(call.call_count,2)
 def test_duplicate_and_missing_ids_rejected(self):
  for rows in [[['a'],['a']],[['','guest']]]:
   with self.assertRaises(ValueError):crm_sync.normalize([crm_sync.FIELDS]+rows)
 def test_empty_and_changed_schema_rejected(self):
  for values in [[],[crm_sync.FIELDS],[['inquiry_id']]]:
   with self.assertRaises(ValueError):crm_sync.normalize(values)
 def test_merge_studio_link_from_crm_source(self):
  records=[{'inquiry_id':'INQ-1','message_questions':''}]
  values=[['inquiry_id','message_questions','inquiry_studio_id'],['INQ-1','Full request','IST-1']]
  result=crm_sync.merge_crm(records,values)
  self.assertEqual(result[0]['message_questions'],'Full request')
  self.assertEqual(result[0]['inquiry_studio_id'],'IST-1')
 def test_success_preserves_drafts_and_original(self):
  with tempfile.TemporaryDirectory() as td:
   p=Path(td);old={'records':[{'inquiry_id':'old'}]};(p/'inquiries.json').write_text(json.dumps(old));(p/'saved-draft.json').write_text('unchanged')
   crm_sync.refresh(Fake([['new'],['second']]),p)
   self.assertEqual(len(json.loads((p/'inquiries.json').read_text())['records']),2)
   self.assertEqual(json.loads((p/'inquiries-before-live-sync.json').read_text()),old)
   self.assertEqual((p/'saved-draft.json').read_text(),'unchanged')
 def test_network_failure_keeps_last_good_copy_and_redacts_error(self):
  with tempfile.TemporaryDirectory() as td:
   p=Path(td);(p/'inquiries.json').write_text('last good copy')
   with self.assertRaises(RuntimeError):crm_sync.refresh(Fake([],fail=True),p,attempts=1)
   self.assertEqual((p/'inquiries.json').read_text(),'last good copy')
   status=(p/'crm-sync-status.json').read_text();self.assertNotIn('secret detail',status);self.assertFalse(json.loads(status)['ok'])
if __name__=='__main__':unittest.main()
