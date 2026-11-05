"""Small local, review-only supplier knowledge bank for future custom proposals."""

import hashlib
import json
import os
import threading
from datetime import datetime, timezone
from pathlib import Path

LOCK = threading.Lock()
PATH = Path(__file__).resolve().parent / "private" / "tour-knowledge.json"


def now():
    return datetime.now(timezone.utc).isoformat()


def read():
    with LOCK:
        if not PATH.exists():
            return []
        try:
            value = json.loads(PATH.read_text(encoding="utf8"))
            return value if isinstance(value, list) else []
        except (OSError, json.JSONDecodeError):
            return []


def publish(items, inquiry_id="", reviewer="MBW Admin"):
    if not isinstance(items, list):
        raise ValueError("Missing knowledge items")
    timestamp = now()
    clean_items = []
    for item in items[:100]:
        if not isinstance(item, dict) or not str(item.get("name") or "").strip():
            continue
        verified_at = str(item.get("verified_at") or "").strip()
        evidence = str(item.get("evidence_source") or "").strip()
        if not verified_at or not evidence:
            raise ValueError("Only supplier facts with a verification date and evidence source can enter the knowledge bank")
        key = "|".join([str(item.get("name") or "").strip().casefold(), str(item.get("service") or "").strip().casefold(), str(item.get("role") or "").strip().casefold()])
        clean_items.append({
            "knowledge_id": str(item.get("knowledge_id") or f"KB-{hashlib.sha256(key.encode()).hexdigest()[:16].upper()}")[:128],
            "key": key,
            "name": str(item.get("name") or "").strip()[:180],
            "role": str(item.get("role") or "other").strip()[:80],
            "service": str(item.get("service") or "").strip()[:240],
            "net_cost": max(0, float(item.get("net_cost") or 0)),
            "currency": "USD",
            "verified_at": verified_at[:40],
            "valid_until": str(item.get("valid_until") or "").strip()[:10],
            "evidence_source": evidence[:500],
            "notes": str(item.get("notes") or "").strip()[:1000],
            "source_inquiry_id": str(inquiry_id or "")[:128],
            "published_at": timestamp,
            "published_by": str(reviewer or "MBW Admin")[:120],
            "reuse_rule": "Reverify price and availability before every proposal",
        })
    with LOCK:
        existing = []
        if PATH.exists():
            try:
                existing = json.loads(PATH.read_text(encoding="utf8"))
            except (OSError, json.JSONDecodeError):
                existing = []
        by_key = {str(item.get("key") or item.get("knowledge_id")): item for item in existing if isinstance(item, dict)}
        for item in clean_items:
            by_key[item["key"]] = item
        output = sorted(by_key.values(), key=lambda item: (str(item.get("name") or "").casefold(), str(item.get("service") or "").casefold()))
        PATH.parent.mkdir(mode=0o700, parents=True, exist_ok=True)
        temp = PATH.with_suffix(".tmp")
        temp.write_text(json.dumps(output, ensure_ascii=False, indent=2), encoding="utf8")
        os.chmod(temp, 0o600)
        os.replace(temp, PATH)
    return clean_items
