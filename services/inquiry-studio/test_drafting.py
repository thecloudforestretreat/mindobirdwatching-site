import unittest
import drafting as d
class StructuredTests(unittest.TestCase):
 def row(self,**kwargs):return {'tour_type':'Birdwatching','guest_count':'2','requested_date_text':'2026-11-21',**kwargs}
 def test_transport_order_and_missing_town_address(self):
  p=d.make_plan(self.row(transportation_needed='Yes',pickup_location='Tababela',message_questions='Tanagers. Leave us in Mindo.'))
  self.assertEqual(p['block_ids'],d.PRIORITY+['transport-quito'])
  out=d.assemble(p);self.assertIn('outskirts',out['direct_answer']);self.assertNotIn('share',out['direct_answer']);self.assertIn('drop-off',out['next_steps'])
 def test_deadline_not_flight_time(self):
  p=d.make_plan(self.row(transportation_needed='Yes',pickup_location='Hilton Colon Quito',message_questions='Be back in Quito by 5pm. Flight at 11pm.'))
  out=d.assemble(p);self.assertIn('Quito by 5pm',out['direct_answer']);self.assertNotIn('pickup',out['next_steps']);self.assertNotIn('Tababela',out['direct_answer']);self.assertIn('No schedule feasibility',' '.join(out['review_notes']))
 def test_explicit_full_day(self):
  self.assertEqual(d.make_plan(self.row(message_questions='All day tour for cock of the rock',transportation_needed='No'))['block_ids'],['tour-full-day'])
 def test_half_day_only_overrides_transport_preference(self):
  self.assertEqual(d.make_plan(self.row(message_questions='Morning only, please',transportation_needed='Yes'))['block_ids'],['tour-andean','tour-jewels','transport-quito'])
 def test_specific_tour_only(self):
  self.assertEqual(d.make_plan(self.row(message_questions='Jewels only',transportation_needed='Yes'))['block_ids'],['tour-jewels','transport-quito'])
 def test_spanish(self):
  p=d.make_plan(self.row(message_questions='Hola, queremos observar aves y regresar a Quito antes de las 5pm.',transportation_needed='Sí',pickup_location='Hotel Quito'))
  out=d.assemble(p);self.assertEqual(out['language'],'es');self.assertIn('Quito antes de las 5pm',out['direct_answer']);self.assertNotIn('Please',out['direct_answer'])
 def test_early_return_excludes_full_day(self):
  p=d.make_plan(self.row(transportation_needed='Yes',message_questions='Back in Quito by 12pm, birding please.'))
  self.assertNotIn('tour-full-day',p['block_ids']);self.assertIn('tour-andean',p['block_ids'])
 def test_specialty_not_mapped_to_generic_birding(self):
  self.assertEqual(d.make_plan(self.row(message_questions='Spectacled bear tour please'))['block_ids'],[])
 def test_combined_address_request_without_repetition(self):
  out=d.assemble(d.make_plan(self.row(transportation_needed='Yes',pickup_location='Tababela',message_questions='Leave us in Mindo, tanagers please.')))
  self.assertEqual(out['next_steps'].count('Please share'),1)
  self.assertIn('pickup location and your drop-off location in Mindo',out['next_steps'])
 def test_full_day_not_described_as_shorter_alternative(self):
  out=d.assemble(d.make_plan(self.row(transportation_needed='No',message_questions='Birding please.')))
  self.assertNotIn('shorter outing',out['direct_answer'])
 def test_sales_filler_and_formal_spanish_are_held_back(self):
  for text in ["You'll love spotting toucans.","A great chance to see tanagers.","Esto se adapta a su interés en las aves."]:
   with self.assertRaises(ValueError):d.check_focus(text)
 def test_missing_facts(self):
  p=d.make_plan({'tour_type':'Birdwatching','pickup_location':'PENDING'})
  out=d.assemble(p);self.assertIn('Travel date',out['missing_details']);self.assertNotIn('PENDING',out['direct_answer'])
 def test_unknown_request_not_assigned_birding_tour(self):
  p=d.make_plan({'message_questions':'Chocolate workshop only','tour_type':'Other'})
  self.assertEqual(p['block_ids'],[]);self.assertTrue(p['review_notes'])
 def test_focus_cannot_override_route_or_price(self):
  for s in ['Pickup in Tababela','Only $40','We guarantee sightings','Return by 5pm']:
   with self.assertRaises(ValueError):d.check_focus(s)
 def test_assembly_ignores_model_for_catalog_prices_and_order(self):
  p=d.make_plan(self.row(transportation_needed='Yes'))
  out=d.assemble(p,'Tanagers bring wonderful color to the forest.')
  self.assertEqual(out['block_ids'],d.PRIORITY+['transport-quito']);self.assertNotIn('$',out['direct_answer'])

class GenerationIntegrationTests(unittest.TestCase):
 def test_ai_cannot_change_transport_or_tour_plan(self):
  import server,json,io
  from unittest.mock import patch
  row={'inquiry_id':'synthetic','tour_type':'Birdwatching','guest_count':'2','requested_date_text':'2026-11-21','transportation_needed':'Yes','pickup_location':'Hilton Colon Quito','message_questions':'Back in Quito by 5pm, toucans please.'}
  raw=io.BytesIO(json.dumps({'message':{'content':json.dumps({'focus_sentence':'Pickup in Tababela for $100'})}}).encode())
  with patch('server.urlopen',return_value=raw):out=server.generate(row)
  self.assertIn('Hilton Colon Quito',out['direct_answer']);self.assertIn('Quito by 5pm',out['direct_answer']);self.assertNotIn('Tababela',out['direct_answer']);self.assertNotIn('$',out['direct_answer']);self.assertEqual(out['block_ids'],d.PRIORITY+['transport-quito']);self.assertEqual(out['model'],'structured template')
 def test_local_model_failure_has_explicit_template_fallback(self):
  import server
  from unittest.mock import patch
  with patch('server.urlopen',side_effect=OSError('offline')):
   out=server.generate({'inquiry_id':'synthetic','tour_type':'Birdwatching','message_questions':'All day birding please'})
  self.assertEqual(out['model'],'structured template');self.assertTrue(any('unavailable' in n for n in out['review_notes']))

if __name__=='__main__':unittest.main()
