import importlib.util,unittest,tempfile
from pathlib import Path
spec=importlib.util.spec_from_file_location('scan',Path(__file__).resolve().parents[1]/'scripts/refresh-whatsapp-resources.py');scan=importlib.util.module_from_spec(spec);spec.loader.exec_module(scan)
class ResourceScan(unittest.TestCase):
 def test_sitemap_alternates_and_external_rejection(self):
  urls,children=scan.parse_sitemap('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:x="http://www.w3.org/1999/xhtml"><url><loc>https://mindobirdwatching.com/tours/</loc><x:link hreflang="es" href="https://mindobirdwatching.com/es/tours/"/></url><url><loc>https://bad.example/</loc></url></urlset>');self.assertEqual(len(urls),2);self.assertFalse(children);self.assertFalse(scan.safe_url('https://mindobirdwatching.com/admin/'));self.assertFalse(scan.safe_url('https://mindobirdwatching.com/%2E%2E/secrets/'))
 def test_missing_and_http_failure_disable_curated_recommendation(self):
  catalog={'resources':[{'id':'t','url':'https://mindobirdwatching.com/tours/','approved':True}], 'futureSources':{'immich':'not_configured'}}
  with tempfile.TemporaryDirectory() as root:
   output=scan.build({},catalog,Path(root));self.assertFalse(output['items'][0]['available']);self.assertTrue(output['items'][0]['approved'])
   def fail(url):raise OSError('offline')
   output=scan.build({'https://mindobirdwatching.com/tours/':''},catalog,Path(root),True,fail);self.assertFalse(output['items'][0]['available']);self.assertEqual(output['items'][0]['verification'],'http_unavailable')
 def test_metadata_is_text_and_never_approves_discovered_page(self):
  parser=scan.Metadata();parser.feed('<title>Birds &amp; Tours</title><meta name="description" content="Public information">');self.assertEqual(parser.result()['title'],'Birds & Tours')
  with tempfile.TemporaryDirectory() as root:
   output=scan.build({'https://mindobirdwatching.com/birds/':''},{'resources':[],'futureSources':{}},Path(root));self.assertFalse(output['items'][0]['approved'])
if __name__=='__main__':unittest.main()
