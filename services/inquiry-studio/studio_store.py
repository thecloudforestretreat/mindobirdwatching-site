"""Build and persist Inquiry Studio records through the local MBW n8n API."""

from __future__ import annotations

import json
import re
import secrets
from datetime import datetime, timezone
from urllib.request import Request, urlopen

from guide_quotes import parse_guide_quote

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


def _crm_ids(studio_id):
    parts = str(studio_id or new_id()).split("-")
    stamp = parts[1] if len(parts) > 1 else datetime.now(timezone.utc).strftime("%Y%m%d%H%M%S")
    suffix = parts[-1][-6:].upper()
    return f"INQ-{stamp}-{suffix}", f"G-{stamp}-{suffix}"


def _name_parts(full_name):
    parts = str(full_name or "").strip().split()
    if not parts:
        return "", ""
    return parts[0], " ".join(parts[1:])


def _iso_dates(values):
    dates = []
    for value in values if isinstance(values, list) else []:
        match = re.search(r"\b20\d{2}-\d{2}-\d{2}\b", str(value))
        if match:
            dates.append(match.group(0))
    return dates


def create_crm_guest_and_inquiry(row, source, analysis, studio_id, opener=urlopen):
    """Create the main CRM guest and inquiry for a standalone Studio intake."""
    timestamp = now()
    inquiry_id, guest_id = _crm_ids(studio_id)
    full_name = str(row.get("full_name") or "").strip()
    first_name, last_name = _name_parts(full_name)
    email = str(row.get("email") or "").strip().lower()
    phone = str(row.get("phone_number") or row.get("phone_normalized") or "").strip()
    phone_normalized = "".join(character for character in phone if character.isdigit())
    profile = analysis.get("guest_profile") if isinstance(analysis.get("guest_profile"), dict) else {}
    party_size = profile.get("party_size") or profile.get("guest_count") or ""
    country = profile.get("country") or profile.get("home_country") or ""
    dates = _iso_dates(analysis.get("requested_dates"))
    requested_text = "; ".join(str(value) for value in analysis.get("requested_dates", []) if str(value).strip())
    targets = "; ".join(str(value) for value in analysis.get("target_species", []) if str(value).strip())
    inquiry = {
        "inquiry_id": inquiry_id,
        "guest_id": guest_id,
        "created_at": timestamp,
        "updated_at": timestamp,
        "source_type": "inquiry_studio",
        "source_tab": "inquiry_studio",
        "status": "new",
        "stage_changed_at": timestamp,
        "next_action": "Review Inquiry Studio draft and obtain missing details",
        "first_name": first_name,
        "last_name": last_name,
        "full_name": full_name,
        "email": email,
        "email_normalized": email,
        "phone_raw": phone,
        "phone_normalized": phone_normalized,
        "requested_date_start": dates[0] if dates else "",
        "requested_date_end": dates[-1] if dates else "",
        "requested_date_text": requested_text,
        "guest_count": str(party_size),
        "guest_count_text": str(party_size),
        "tour_type": "Custom Tour",
        "tour_category": "Custom Tour",
        "transportation_needed": "Unknown",
        "special_interests": targets,
        "message_questions": source.get("message", ""),
        "internal_notes": f"Created from Inquiry Studio {studio_id}; all AI output requires review.",
        "availability_status": "pending",
        "quote_status": "not_sent",
        "payment_status": "unpaid",
        "grouping_preference": "unknown",
        "grouping_status": "unmatched",
        "inquiry_studio_id": studio_id,
        "inquiry_studio_status": "draft",
        "inquiry_studio_updated_at": timestamp,
    }
    guest = {
        "guest_id": guest_id,
        "phone_number": phone_normalized or phone,
        "phone_raw": phone,
        "phone_normalized": phone_normalized,
        "first_name": first_name,
        "last_name": last_name,
        "full_name": full_name,
        "country": country,
        "home_country": country,
        "email": email,
        "guest_email": email,
        "notes": "Created from Inquiry Studio custom-tour intake.",
        "status": "active",
        "guest_type": "Inquiry Studio",
        "total_inquiries": "1",
        "total_confirmed_bookings": "0",
        "created_at": timestamp,
        "updated_at": timestamp,
    }
    result = request_n8n(
        {"action": "create_guest_and_inquiry", "guest_row": guest, "inquiry_row": inquiry},
        opener,
    )
    return result.get("record") or inquiry


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
        "trip_profile": analysis.get("trip_profile", {}),
        "requested_dates": analysis.get("requested_dates", []),
        "target_species": analysis.get("target_species", []),
        "requirements": analysis.get("requirements", []),
        "unknowns": analysis.get("unknowns", []),
        "assumptions": analysis.get("assumptions", []),
        "recommendations": analysis.get("recommendations", []),
        "knowledge_profile_ids": analysis.get("knowledge_profile_ids", []),
        "knowledge_version": analysis.get("knowledge_version", ""),
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
    received_at = now()
    guide_name = str(sender or "Guide")[:120]
    messages = _parse(record.get("guide_responses_json"), [])
    messages.append({"received_at": received_at, "sender": guide_name, "message": text})
    proposed_days = _parse(record.get("proposed_days_json"), [])
    parsed_quote = parse_guide_quote(text, proposed_days, guide_name, received_at)
    quotes = _parse(record.get("guide_quotes_json"), [])
    quotes.append(parsed_quote)
    updated = dict(record)
    updated["guide_responses_json"] = messages
    updated["guide_quotes_json"] = quotes
    updated["final_plan_json"] = {
        "status": "supplier_quote_received",
        "review_required": True,
        "guest_facing_price_approved": False,
        "known_supplier_subtotal_usd": parsed_quote["known_supplier_subtotal_usd"],
        "global_excluded": parsed_quote["global_excluded"],
        "global_pending": parsed_quote["global_pending"],
        "review_flags": parsed_quote["review_flags"],
        "days": parsed_quote["merged_days"],
    }
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
    # Legacy CRM actions return the row directly and omit the newer `ok`
    # envelope. Only an explicit rejection is a failure; accepting a missing
    # `ok` keeps Inquiry Studio compatible with the existing Guest CRM API.
    if result.get("ok") is False:
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
