from pathlib import Path
import shutil,json
repo=Path('/tmp/mbw-crm-readonly-review');dest=Path('/tmp/mbw-crm-review-preview');shutil.copytree(repo/'admin',dest,dirs_exist_ok=True)
s=(dest/'guest-crm/index.html').read_text()
records=[]
def make(id,name,status,date,product,service='Birdwatching',**extras):
 row=dict(inquiry_id=id,guest_id='G-'+id,full_name=name,first_name=name.split()[0],status=status,assigned_to='JPG',tour_type='Birdwatching',service_type=service,product_selected=product,requested_date=date,guest_count='2',phone_number='+593991234567',pickup_location='QA Lodge',quote_status='accepted',payment_status='paid',followup_date='2026-10-10',**extras);records.append(row);return row
make('qa-ready','QA Ready Tour','booked','2026-10-12','MBW004 - Jewels of the Morning Forest')
make('qa-multi','QA Multi Day','booked','2026-10-13','MBW006 - Quest for Five Toucans & the Andean Cock-of-the-Rock',tour_items_json=json.dumps([dict(id='primary',product_selected='MBW006 - Quest for Five Toucans & the Andean Cock-of-the-Rock',service_type='Birdwatching',tour='Birdwatching',date='2026-10-13',guests='2',status='booked',pickup_location='QA Lodge'),dict(id='transport',product_selected='TRANS03 - Quito -> Mindo -> Quito',service_type='Transportation',tour='Transportation Requested',date='2026-10-14',guests='2',status='booked',pickup_location='Quito QA Hotel',dropoff_location='QA Lodge'),dict(id='bike',product_selected='ACT017 - Mountain Biking',service_type='Activity',tour='Other Activity or Tour',date='2026-10-15',guests='2',status='booked',pickup_location='QA Lodge')]))
make('qa-missing','QA Missing Details','booked','2026-10-16','MBW016 - Night Walk','Activity');records[-1]['phone_number']='';records[-1]['assigned_to']='';records[-1]['pickup_location']=''
make('qa-flex','QA Flexible Activity','booked','2026-10-17','ACT017 - Mountain Biking','Activity')
for status in ['completed','cancelled']:
 make('qa-'+status,'QA '+status.title(),status,'2026-10-18','MBW005 - Dance of the Andean Cock-of-the-Rock')
make('qa-past','QA Past Tour','booked','2020-01-01','MBW004 - Jewels of the Morning Forest')
make('qa-quote','QA Quoted Inquiry','quoted','2026-10-22','MBW004 - Jewels of the Morning Forest');records[-1]['quote_status']='sent';records[-1]['payment_status']='unpaid'
assignments=[dict(assignment_id='qa-assignment',inquiry_id='qa-ready',guest_id='G-qa-ready',product_selected='MBW004 - Jewels of the Morning Forest',service_date='2026-10-12',provider_name='QA Guide',provider_role='guide',provider_informed='Yes',assignment_status='confirmed')]
mock='''
 const previewRecords=RECORDS, previewAssignments=ASSIGNMENTS;
 api=async function(action,data){if(action==='list_inquiries')return {ok:true,records:previewRecords};if(action==='list_assignments')return {ok:true,records:previewAssignments};if(action==='list_interactions'||action==='list_providers')return {ok:true,records:[]};throw new Error('Read-only preview: changes are disabled.');};
'''.replace('RECORDS',json.dumps(records)).replace('ASSIGNMENTS',json.dumps(assignments))
s=s.replace('<h1>', '<h1>')
s=s.replace('<main', '<main',1)
s=s.replace('<h1', '<p class="reviewAlert">Synthetic test records · Read-only preview · Live CRM unchanged · WhatsApp sending disabled</p><h1',1)
s=s.replace('    })();',mock+'    })();');s=s.replace('  <script>','  <script>window.MBW_CRM_READ_ONLY_PREVIEW=true;</script>\n  <script>',1)
(dest/'guest-crm/index.html').write_text(s)
print(dest)
