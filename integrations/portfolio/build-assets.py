"""Version the portfolio's script assets to prevent mixed cached releases."""
from pathlib import Path
import hashlib
import re
root = Path(__file__).resolve().parents[2] / 'admin' / 'portfolio'
index = (root / 'index.html').read_text()
for name in ('dashboard', 'improvements', 'micro', 'charts', 'upgrades'):
    source = (root / f'{name}.js').read_bytes()
    asset = f'{name}-{hashlib.sha256(source).hexdigest()[:12]}.js'
    # Retain published hashes so an older open page still has its exact assets.
    (root / asset).write_bytes(source)
    index = re.sub(rf'src="{name}(?:-[0-9a-f]{{12}})?\.js(?:\?v=\d+)?"', f'src="{asset}"', index)
(root / 'index.html').write_text(index)
