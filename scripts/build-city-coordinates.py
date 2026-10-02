"""Build server-only approximate city centers from GeoNames cities15000.zip.
Usage: python3 scripts/build-city-coordinates.py <zip> <admin1CodesASCII.txt>
Sources: https://download.geonames.org/export/dump/ (CC BY 4.0)
"""
import json, sys, unicodedata, zipfile
from pathlib import Path

def norm(value):
    return ''.join(c for c in unicodedata.normalize('NFKD', value) if not unicodedata.combining(c)).lower().replace('’', "'").strip()
regions = {}
for line in Path(sys.argv[2]).read_text().splitlines():
    parts = line.split('\t')
    if len(parts) >= 2:
        regions[parts[0]] = parts[1]
cities = {}
with zipfile.ZipFile(sys.argv[1]) as source:
    for line in source.read('cities15000.txt').decode().splitlines():
        row = line.split('\t')
        code, region = row[8], regions.get(row[8] + '.' + row[10], row[10])
        value = [round(float(row[4]), 3), round(float(row[5]), 3), region, int(row[14])]
        for name in set([norm(row[1]), norm(row[2])]):
            if name:
                cities.setdefault(code + '|' + name, []).append(value)
output = Path(__file__).resolve().parents[1] / 'functions/lib/city-coordinates.mjs'
output.write_text('// GeoNames cities15000, CC BY 4.0; approximate city centers. See maps README.\nexport default ' + json.dumps(cities, ensure_ascii=False, separators=(',', ':')) + ';\n')
print(f'{len(cities)} lookup names written to {output}')
