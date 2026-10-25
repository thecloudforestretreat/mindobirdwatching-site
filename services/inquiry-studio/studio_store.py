"""Build and persist Inquiry Studio records through the local MBW n8n API."""

from __future__ import annotations

import json
import re
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


def _records(result):
    for key in ("records", "data", "rows", "items"):
        value = result.get(key)
        if isinstance(value, list):
            return [item.get("json", item) if isinstance(item, dict) else item for item in value]
    return []


def list_guides(opener=urlopen):
    rows = _records(request_n8n({"action": "list_providers"}, opener))
    guides = []
    for row in rows:
        if not isinstance(row, dict):
            continue
        role = str(row.get("provider_role") or "").strip().lower()
        active = str(row.get("active", row.get("is_active", "yes"))).strip().lower()
        name = str(row.get("provider_name_other") if row.get("provider_name") == "Other" else row.get("provider_name") or "").strip()
        if role == "guide" and name and active not in {"no", "false", "0", "inactive"}:
            guides.append({"provider_id": str(row.get("provider_id") or "").strip(), "provider_name": name})
    return sorted(guides, key=lambda item: item["provider_name"].casefold())


def create_guide_quote_request(record, provider_id, provider_name, brand_id="mbw", response_due_at="", opener=urlopen):
    inquiry_id = str(record.get("inquiry_id") or "").strip()
    studio_id = str(record.get("inquiry_studio_id") or "").strip()
    provider_id = str(provider_id or "").strip()[:128]
    provider_name = str(provider_name or "").strip()[:160]
    brand_id = brand_id if brand_id in {"mbw", "mindo-tours", "choco-andino"} else "mbw"
    if not inquiry_id or not studio_id:
        raise ValueError("Save and link the Inquiry Studio record before sending it to a guide")
    if not provider_name:
        raise ValueError("Choose a guide")
    existing = _records(request_n8n({"action": "list_assignments", "inquiry_id": inquiry_id}, opener))
    for row in existing:
        same_provider = (provider_id and str(row.get("provider_id") or "") == provider_id) or str(row.get("provider_name") or "").casefold() == provider_name.casefold()
        active = str(row.get("assignment_status") or "pending").lower() not in {"cancelled", "canceled", "completed"}
        kind = str(row.get("assignment_kind") or "").lower() == "quote_request" or str(row.get("assignment_group_id") or "").startswith("QUOTE-")
        if same_provider and active and kind:
            raise ValueError("This guide already has an active quote request for this inquiry")
    timestamp = now()
    dates = _iso_dates(_parse(record.get("requested_dates_json"), []))
    assignment = {
        "assignment_id": "",
        "assignment_group_id": f"QUOTE-{studio_id}"[:128],
        "assignment_kind": "quote_request",
        "service_item_id": studio_id,
        "inquiry_id": inquiry_id,
        "guest_id": str(record.get("guest_id") or "")[:128],
        "service_date": dates[0] if dates else "",
        "start_time": "",
        "end_time": "",
        "service_type": "Guide Trip Quote",
        "product_selected": str(record.get("source_subject") or "Custom trip request")[:240],
        "provider_id": provider_id,
        "provider_role": "guide",
        "provider_name": provider_name,
        "pickup_location": "",
        "dropoff_location": "",
        "currency": "USD",
        "assignment_status": "pending",
        "provider_informed": "Yes",
        "provider_informed_by": "JPG",
        "internal_note": f"[TRIP_BUILDER studio={studio_id} brand={brand_id}{' due='+str(response_due_at)[:30] if response_due_at else ''}]",
        "confirmation_note": "Custom trip quote request. Complete the agenda and net costs in Guide Nest.",
        "guide_response": "pending",
        "created_by": "JPG",
        "created_at": timestamp,
        "updated_at": timestamp,
    }
    result = request_n8n({"action": "create_assignment", "assignment": assignment}, opener)
    verified_rows = _records(request_n8n({"action": "list_assignments", "inquiry_id": inquiry_id}, opener))
    verified = next((row for row in verified_rows if str(row.get("assignment_group_id") or "") == assignment["assignment_group_id"] and ((provider_id and str(row.get("provider_id") or "") == provider_id) or str(row.get("provider_name") or "").casefold() == provider_name.casefold())), None)
    if not verified:
        raise ValueError("The Guide Nest quote request was not verified. Refresh before retrying")
    handoff = _parse(record.get("handoff_json"), {})
    requests = handoff.get("guide_quote_requests") if isinstance(handoff.get("guide_quote_requests"), list) else []
    requests.append({
        "provider_id": provider_id,
        "provider_name": provider_name,
        "brand_id": brand_id,
        "sent_at": timestamp,
        "response_due_at": str(response_due_at or "")[:80],
        "status": "sent",
    })
    handoff.update({"brand_id": brand_id, "guide_quote_requests": requests})
    updated = dict(record)
    updated["handoff_json"] = handoff
    updated["status"] = "awaiting_guide_quote"
    updated["updated_at"] = timestamp
    updated["revision"] = int(record.get("revision") or 0) + 1
    save(updated, opener)
    return normalize_record(updated), {**result, "record": verified}


def review_guide_quote(record, quote_id, decision, note="", reviewer="MBW Admin", opener=urlopen):
    if decision not in {"approve", "request_revision"}:
        raise ValueError("Choose approve or request revision")
    quotes = _parse(record.get("guide_quotes_json"), [])
    selected = next((item for item in quotes if str(item.get("quote_id") or "") == str(quote_id or "")), None)
    if not selected or selected.get("status") != "submitted":
        raise ValueError("Choose a submitted guide quote")
    timestamp = now()
    selected["admin_status"] = "approved" if decision == "approve" else "revision_requested"
    selected["reviewed_at"] = timestamp
    selected["reviewed_by"] = str(reviewer or "MBW Admin")[:120]
    selected["revision_note"] = str(note or "").strip()[:3000]
    updated = dict(record)
    updated["guide_quotes_json"] = quotes
    updated["updated_at"] = timestamp
    updated["revision"] = int(record.get("revision") or 0) + 1
    if decision == "approve":
        updated["status"] = "guide_quote_approved"
        updated["final_plan_json"] = {
            "source": "guide_trip_builder",
            "quote_id": selected.get("quote_id"),
            "quote_version": selected.get("version"),
            "provider_id": selected.get("provider_id"),
            "provider_name": selected.get("provider_name"),
            "brand_id": selected.get("brand_id", "mbw"),
            "currency": selected.get("currency", "USD"),
            "net_options": selected.get("options", []),
            "approved_at": timestamp,
            "approved_by": str(reviewer or "MBW Admin")[:120],
            "pricing_status": "markup_required",
        }
        handoff = _parse(record.get("handoff_json"), {})
        handoff.update({"approved_quote_id": selected.get("quote_id"), "approved_quote_version": selected.get("version"), "itinerary_status": "awaiting_markup"})
        updated["handoff_json"] = handoff
    else:
        if not selected["revision_note"]:
            raise ValueError("Explain what the guide should revise")
        updated["status"] = "guide_revision_requested"
    save(updated, opener)
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
