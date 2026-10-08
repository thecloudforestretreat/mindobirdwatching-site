"""Version the portfolio's three script assets to prevent mixed cached releases."""
from pathlib import Path
import hashlib
import re
root = Path(__file__).resolve().parents[2] / 'admin' / 'portfolio'
index = (root / 'index.html').read_text()
for name in ('dashboard', 'improvements', 'micro'):
    source = (root / f'{name}.js').read_bytes()
    asset = f'{name}-{hashlib.sha256(source).hexdigest()[:12]}.js'
    for old in root.glob(f'{name}-*.js'):
        if re.fullmatch(rf'{name}-[0-9a-f]{{12}}\.js', old.name) and old.name != asset:
            old.unlink()
    (root / asset).write_bytes(source)
    index = re.sub(rf'src="{name}(?:-[0-9a-f]{{12}})?\.js(?:\?v=\d+)?"', f'src="{asset}"', index)
(root / 'index.html').write_text(index)
