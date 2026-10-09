"""Refresh homepage header snapshots after editing assets/includes/header.html."""
from pathlib import Path
import re
import json
root = Path(__file__).resolve().parents[1]
header = (root / "assets/includes/header.html").read_text().strip()
pages = ["index.html", "es/index.html"]
for pair in json.loads((root / "scripts/revenue-pages.json").read_text()):
    pages.extend(pair)
for name in pages:
    path = root / name
    source = path.read_text()
    source, count = re.subn(r"<!-- MBW static header start -->.*?<!-- MBW static header end -->", lambda _: "<!-- MBW static header start -->\n" + header + "\n<!-- MBW static header end -->", source, flags=re.S)
    if count != 1:
        raise RuntimeError(f"Expected one header snapshot in {name}")
    if "<!-- MBW static footer start -->" in source:
        footer = (root / "assets/includes/footer.html").read_text().strip()
        source = re.sub(r"<!-- MBW static footer start -->.*?<!-- MBW static footer end -->", lambda _: "<!-- MBW static footer start -->\n" + footer + "\n<!-- MBW static footer end -->", source, flags=re.S)
    path.write_text(source)
