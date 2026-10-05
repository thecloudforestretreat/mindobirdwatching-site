import unittest,json
import whatsapp_suggest as w
class SuggestTests(unittest.TestCase):
 def body(self):return {'language':'en','variant':'short','messages':[{'direction':'in','text':'How much is Jewels?'}],'reference':'Jewels: $60/person.'}
 def call(self,text):return lambda payload:{'message':{'content':json.dumps({'reply':text})}}
 def test_reference_inserted_without_model_prices(self):
  r=w.generate(self.body(),'test',self.call('Hello!\n{{reference}}'));self.assertEqual(r['reply'],'Hello!\nJewels: $60/person.');self.assertFalse(r['sendingEnabled']);self.assertFalse(r['crmContextIncluded'])
 def test_amounts_links_and_unknown_placeholders_rejected(self):
  for text in ['It is $90','It is 90 dollars','Visit https://wrong.test','Hi {{guest}}','Your tour is confirmed','The tour is available for two people']:
   with self.assertRaises(ValueError):w.generate(self.body(),'test',self.call(text))
 def test_missing_reference_cannot_be_invented(self):
  b=self.body();b['reference']=''
  with self.assertRaises(ValueError):w.generate(b,'test',self.call('{{reference}}'))
 def test_invalid_inputs_and_no_guest_message(self):
  for changes in [{'language':'fr'},{'variant':'bad'},{'messages':[]},{'messages':[{'direction':'out','text':'Only staff'}]},{'reference':'x'*4001}]:
   with self.assertRaises(ValueError):w.prepare(dict(self.body(),**changes))
 def test_model_context(self):
  def call(payload):
   context=json.loads(payload['messages'][1]['content']);self.assertNotIn('verified_reference',context);self.assertTrue(context['verified_reference_available']);self.assertIn('reviewed_reply_rules',context)
   return {'message':{'content':json.dumps({'reply':'Hello!\n{{reference}}'})}}
  self.assertIn('$60',w.generate(self.body(),'test',call)['reply'])
 def test_relevant_patterns_follow_requested_language(self):
  body=self.body();body.update(language='es',messages=[{'direction':'in','text':'Necesito transporte desde Quito.'}])
  def call(payload):
   context=json.loads(payload['messages'][1]['content']);patterns=context['editorial_patterns']
   self.assertEqual([p['topic'] for p in patterns],['transportation'])
   self.assertTrue(patterns[0]['example'].startswith('¿Nos compartes'))
   self.assertNotIn('sent_mail',context);self.assertNotIn('topic_counts',context)
   return {'message':{'content':json.dumps({'reply':'Gracias. {{reference}}'})}}
  self.assertTrue(w.generate(body,'test',call)['ok'])
 def test_optional_reference_appended_once(self):
  r=w.generate(self.body(),'test',self.call('Please tell us your dates.'));self.assertEqual(r['reply'].count('Jewels:'),1)
if __name__=='__main__':unittest.main()
