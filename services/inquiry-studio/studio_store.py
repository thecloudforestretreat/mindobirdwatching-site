"""Build and persist Inquiry Studio records through the local MBW n8n API."""

from __future__ import annotations

import json
import secrets
from datetime import datetime, timezone
from urllib.request import Request, urlopen

N8N_URL = "http://127.0.0.1:5681/webhook/mbw-crm-admin-api"

FIELDS = [
    "inquiry_studio_id",
    "inquiry_id",
    "guest_id",
    "created_at",
    "updated_at",
    "created_by",
    "assigned_to",
    "status",
    "inquiry_complexity",
    "revision",
    "source_type",
    "source_subject",
    "source_message",
    "input_language",
    "output_language",
    "attachment_manifest_json",
    "extracted_request_json",
    "request_summary",
    "guest_profile_json",
    "requested_dates_json",
    "target_species_json",
    "requirements_json",
    "unknowns_json",
    "assumptions_json",
    "validation_flags_json",
    "proposed_days_json",
    "guest_reply_draft",
    "guide_brief_draft",
    "internal_summary",
    "guide_responses_json",
    "guide_quotes_json",
    "final_plan_json",
    "handoff_json",
    "ai_model",
    "prompt_version",
    "validation_status",
    "validation_notes",
    "last_analyzed_at",
    "approved_at",
    "approved_by",
]

JSON_FIELDS = {
    "attachment_manifest_json",
    "extracted_request_json",
    "guest_profile_json",
    "requested_dates_json",
    "target_species_json",
    "requirements_json",
    "unknowns_json",
    "assumptions_json",
    "validation_flags_json",
    "proposed_days_json",
    "guide_responses_json",
    "guide_quotes_json",
    "final_plan_json",
    "handoff_json",
}


def now():
    return datetime.now(timezone.utc).isoformat()


def new_id():
    stamp = datetime.now(timezone.utc).strftime("%Y%m%d%H%M%S")
    return f"IST-{stamp}-{secrets.token_hex(3).upper()}"


def _json(value):
    return json.dumps(value, ensure_ascii=False, separators=(",", ":"))


def _parse(value, fallback):
    if isinstance(value, type(fallback)):
        return value
    try:
        parsed = json.loads(value or "")
        return parsed if isinstance(parsed, type(fallback)) else fallback
    except (TypeError, ValueError):
        return fallback


def build_record(row, source, analysis, attachment_manifest, existing=None):
    existing = existing or {}
    timestamp = now()
    revision = int(existing.get("revision") or 0) + 1
    extracted = {
        "summary": analysis.get("request_summary", ""),
        "guest_profile": analysis.get("guest_profile", {}),
        "requested_dates": analysis.get("requested_dates", []),
        "target_species": analysis.get("target_species", []),
        "requirements": analysis.get("requirements", []),
        "unknowns": analysis.get("unknowns", []),
        "assumptions": analysis.get("assumptions", []),
        "proposed_days": analysis.get("proposed_days", []),
    }
    record = {
        "inquiry_studio_id": existing.get("inquiry_studio_id") or new_id(),
        "inquiry_id": row.get("inquiry_id", ""),
        "guest_id": row.get("guest_id", ""),
        "created_at": existing.get("created_at") or timestamp,
        "updated_at": timestamp,
        "created_by": existing.get("created_by") or "MBW Admin",
        "assigned_to": row.get("assigned_to", ""),
        "status": "draft",
        "inquiry_complexity": analysis.get("inquiry_complexity", "custom_tour"),
        "revision": revision,
        "source_type": source.get("source_type", "manual_text"),
        "source_subject": source.get("subject", ""),
        "source_message": source.get("message", ""),
        "input_language": analysis.get("input_language", ""),
        "output_language": analysis.get("output_language", "en"),
        "attachment_manifest_json": attachment_manifest,
        "extracted_request_json": extracted,
        "request_summary": analysis.get("request_summary", ""),
        "guest_profile_json": analysis.get("guest_profile", {}),
        "requested_dates_json": analysis.get("requested_dates", []),
        "target_species_json": analysis.get("target_species", []),
        "requirements_json": analysis.get("requirements", []),
        "unknowns_json": analysis.get("unknowns", []),
        "assumptions_json": analysis.get("assumptions", []),
        "validation_flags_json": analysis.get("validation_flags", []),
        "proposed_days_json": analysis.get("proposed_days", []),
        "guest_reply_draft": analysis.get("guest_reply_draft", ""),
        "guide_brief_draft": analysis.get("guide_brief_draft", ""),
        "internal_summary": analysis.get("internal_summary", ""),
        "guide_responses_json": _parse(existing.get("guide_responses_json"), []),
        "guide_quotes_json": _parse(existing.get("guide_quotes_json"), []),
        "final_plan_json": _parse(existing.get("final_plan_json"), {}),
        "handoff_json": _parse(existing.get("handoff_json"), {}),
        "ai_model": analysis.get("ai_model", ""),
        "prompt_version": analysis.get("prompt_version", ""),
        "validation_status": analysis.get("validation_status", "needs_review"),
        "validation_notes": existing.get("validation_notes", ""),
        "last_analyzed_at": analysis.get("last_analyzed_at", timestamp),
        "approved_at": existing.get("approved_at", ""),
        "approved_by": existing.get("approved_by", ""),
    }
    return normalize_record(record)


def add_guide_response(record, response_text, sender="Guide"):
    text = str(response_text or "").strip()
    if not text:
        raise ValueError("Guide response is empty")
    if len(text) > 20000:
        raise ValueError("Guide response is too long")
    messages = _parse(record.get("guide_responses_json"), [])
    messages.append({"received_at": now(), "sender": str(sender or "Guide")[:120], "message": text})
    updated = dict(record)
    updated["guide_responses_json"] = messages
    updated["updated_at"] = now()
    updated["revision"] = int(record.get("revision") or 0) + 1
    updated["status"] = "guide_response_received"
    return normalize_record(updated)


def normalize_record(record):
    normalized = {}
    for field in FIELDS:
        value = record.get(field, "")
        normalized[field] = _json(value) if field in JSON_FIELDS and not isinstance(value, str) else value
    return normalized


def request_n8n(payload, opener=urlopen):
    request = Request(
        N8N_URL,
        data=json.dumps(payload).encode(),
        headers={"Content-Type": "application/json"},
    )
    with opener(request, timeout=90) as response:
        result = json.load(response)
    if not result.get("ok"):
        raise ValueError(result.get("error") or "The CRM storage workflow rejected the request")
    return result


def save(record, opener=urlopen):
    result = request_n8n({"action": "save_inquiry_studio", "record": normalize_record(record)}, opener)
    inquiry_id = str(record.get("inquiry_id") or "").strip()
    if inquiry_id:
        request_n8n(
            {
                "action": "update_inquiry",
                "inquiry_row": {
                    "inquiry_id": inquiry_id,
                    "inquiry_studio_id": record["inquiry_studio_id"],
                    "inquiry_studio_status": record.get("status", "draft"),
                    "inquiry_studio_updated_at": record.get("updated_at", now()),
                },
            },
            opener,
        )
    return result


def get(inquiry_id="", inquiry_studio_id="", opener=urlopen):
    result = request_n8n(
        {
            "action": "get_inquiry_studio",
            "inquiry_id": inquiry_id,
            "inquiry_studio_id": inquiry_studio_id,
        },
        opener,
    )
    return result.get("record") or {}

