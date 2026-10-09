"""Refresh homepage header snapshots after editing assets/includes/header.html."""
from pathlib import Path
import re
root = Path(__file__).resolve().parents[1]
header = (root / "assets/includes/header.html").read_text().strip()
for name in ["index.html", "es/index.html"]:
    path = root / name
    source = path.read_text()
    source, count = re.subn(r"<!-- MBW static header start -->.*?<!-- MBW static header end -->", lambda _: "<!-- MBW static header start -->\n" + header + "\n<!-- MBW static header end -->", source, flags=re.S)
    if count != 1:
        raise RuntimeError(f"Expected one header snapshot in {name}")
    path.write_text(source)
