import json,pathlib
root=pathlib.Path(__file__).parent
path=root/'workflow.json'
workflow=json.loads(path.read_text())
for node in workflow['nodes']:
 if node['name'] in ['Build report requests','Format portfolio']:
  filename='requests.js' if node['name']=='Build report requests' else 'format.js'
  node['parameters']['jsCode']=(root/filename).read_text()
path.write_text(json.dumps(workflow,indent=2)+'\n')
