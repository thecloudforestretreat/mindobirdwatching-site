"""Bounded local handling for images and PDFs submitted to Inquiry Studio."""

from __future__ import annotations

import base64
import hashlib
import json
import os
import re
import subprocess
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent
EXTRACTOR = ROOT / "document_extract"
SOURCE = ROOT / "document_extract.swift"
ALLOWED = {
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
    "application/pdf": ".pdf",
}
MAX_FILES = 5
MAX_FILE_BYTES = 8 * 1024 * 1024
MAX_TOTAL_BYTES = 24 * 1024 * 1024
MAX_IMAGES = 8


def _safe_name(value):
    value = re.sub(r"[^A-Za-z0-9._ -]+", "_", str(value or "attachment"))
    return value.strip(" .")[:120] or "attachment"


def decode_attachments(items, workdir):
    if not isinstance(items, list) or len(items) > MAX_FILES:
        raise ValueError(f"Upload at most {MAX_FILES} attachments")
    total = 0
    stored = []
    for index, item in enumerate(items):
        if not isinstance(item, dict):
            raise ValueError("Invalid attachment")
        content_type = str(item.get("type") or "").lower()
        if content_type not in ALLOWED:
            raise ValueError("Only PDF, JPG, PNG and WebP attachments are supported")
        encoded = str(item.get("data") or "")
        if encoded.startswith("data:"):
            encoded = encoded.split(",", 1)[-1]
        try:
            data = base64.b64decode(encoded, validate=True)
        except Exception as error:
            raise ValueError("Invalid attachment encoding") from error
        if not data or len(data) > MAX_FILE_BYTES:
            raise ValueError("Each attachment must be between 1 byte and 8 MB")
        total += len(data)
        if total > MAX_TOTAL_BYTES:
            raise ValueError("Attachments exceed the 24 MB total limit")
        display_name = _safe_name(item.get("name"))
        path = Path(workdir) / f"{index + 1:02d}{ALLOWED[content_type]}"
        with open(path, "wb") as handle:
            handle.write(data)
        os.chmod(path, 0o600)
        stored.append(
            {
                "path": path,
                "name": display_name,
                "content_type": content_type,
                "size": len(data),
                "sha256": hashlib.sha256(data).hexdigest(),
            }
        )
    return stored


def _extract(path, output_dir):
    command = [str(EXTRACTOR), str(path), str(output_dir)]
    if not EXTRACTOR.exists():
        command = ["/usr/bin/xcrun", "swift", str(SOURCE), str(path), str(output_dir)]
    result = subprocess.run(command, check=True, capture_output=True, text=True, timeout=120)
    return json.loads(result.stdout)


def prepare_attachments(items):
    manifest = []
    text_parts = []
    image_bytes = []
    with tempfile.TemporaryDirectory(prefix="mbw-studio-") as directory:
        root = Path(directory)
        stored = decode_attachments(items, root)
        for item in stored:
            entry = {
                "name": item["name"],
                "content_type": item["content_type"],
                "size": item["size"],
                "sha256": item["sha256"],
            }
            if item["content_type"].startswith("image/"):
                entry["extraction"] = "vision"
                if len(image_bytes) < MAX_IMAGES:
                    image_bytes.append(base64.b64encode(item["path"].read_bytes()).decode())
            else:
                extracted = _extract(item["path"], root / f"pdf-{len(manifest) + 1}")
                text = str(extracted.get("text") or "").strip()
                images = [Path(value) for value in extracted.get("images", [])]
                if text:
                    text_parts.append(f"Attachment: {item['name']}\n{text[:30000]}")
                    entry["extraction"] = "pdf_text"
                    entry["extracted_characters"] = len(text)
                else:
                    entry["extraction"] = "pdf_pages_to_vision"
                    for image in images:
                        if len(image_bytes) >= MAX_IMAGES:
                            break
                        image_bytes.append(base64.b64encode(image.read_bytes()).decode())
                entry["rendered_pages"] = len(images)
            manifest.append(entry)
    return {
        "manifest": manifest,
        "text": "\n\n".join(text_parts),
        "images": image_bytes,
    }

