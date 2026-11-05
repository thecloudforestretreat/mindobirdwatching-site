"""Build and persist Inquiry Studio records through the local MBW n8n API."""

from __future__ import annotations

import hashlib
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
        prior_plan = _parse(record.get("final_plan_json"), {})
        prior_prices = prior_plan.get("sell_prices") if isinstance(prior_plan.get("sell_prices"), dict) else {}
        updated["final_plan_json"] = {
            "source": "guide_trip_builder",
            "quote_id": selected.get("quote_id"),
            "quote_version": selected.get("version"),
            "provider_id": selected.get("provider_id"),
            "provider_name": selected.get("provider_name"),
            "brand_id": selected.get("brand_id", "mbw"),
            "currency": selected.get("currency", "USD"),
            "net_options": selected.get("options", []),
            "selected_option_id": prior_plan.get("selected_option_id", ""),
            "default_markup_percent": prior_plan.get("default_markup_percent", 30),
            "sell_prices": prior_prices,
            "admin_days": prior_plan.get("admin_days", []),
            "workflow": prior_plan.get("workflow", {}),
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
        plan = _parse(record.get("final_plan_json"), {})
        if plan:
            workflow = plan.get("workflow") if isinstance(plan.get("workflow"), dict) else {}
            events = workflow.get("events") if isinstance(workflow.get("events"), list) else []
            events.append({"action": "guide_revision_requested", "at": timestamp, "by": str(reviewer or "MBW Admin")[:120], "note": selected["revision_note"]})
            workflow.update({"stage": "guide_final_confirmation", "events": events[-50:]})
            plan["workflow"] = workflow
            plan["pricing_status"] = "guide_reconfirmation_required"
            plan["updated_at"] = timestamp
            updated["final_plan_json"] = plan
    save(updated, opener)
    return normalize_record(updated)


WORKFLOW_ACTIONS = {
    "mark_preliminary_sent": "guest_review",
    "record_guest_changes": "guest_changes_received",
    "mark_guest_preliminary_approved": "guide_final_confirmation",
    "mark_guide_final_confirmed": "guest_final_confirmation",
    "mark_guest_final_confirmed": "invoice_ready",
    "mark_invoice_sent": "invoice_sent",
    "record_deposit_received": "deposit_received",
    "mark_supplier_holds": "supplier_holds",
    "mark_reservations_confirmed": "reservations_confirmed",
    "mark_operations_ready": "operations_ready",
    "mark_completed": "completed",
    "mark_cancelled": "cancelled",
}

WORKFLOW_PREVIOUS = {
    "mark_preliminary_sent": {"admin_proposal"},
    "record_guest_changes": {"guest_review"},
    "mark_guest_preliminary_approved": {"guest_review"},
    "mark_guide_final_confirmed": {"guide_final_confirmation"},
    "mark_guest_final_confirmed": {"guest_final_confirmation"},
    "mark_invoice_sent": {"invoice_ready"},
    "record_deposit_received": {"invoice_sent"},
    "mark_supplier_holds": {"deposit_received"},
    "mark_reservations_confirmed": {"supplier_holds"},
    "mark_operations_ready": {"reservations_confirmed"},
    "mark_completed": {"operations_ready"},
    "mark_cancelled": {"guest_review", "guest_changes_received", "guide_final_confirmation", "guest_final_confirmation", "invoice_ready", "invoice_sent", "deposit_received", "supplier_holds", "reservations_confirmed", "operations_ready"},
}


def _source_option(record, quote_id, option_id):
    quotes = _parse(record.get("guide_quotes_json"), [])
    quote = next((item for item in quotes if str(item.get("quote_id") or "") == str(quote_id or "") and item.get("admin_status") == "approved"), None)
    if not quote:
        raise ValueError("Approve a submitted guide quote before adding admin pricing")
    options = quote.get("options") if isinstance(quote.get("options"), list) else []
    option = next((item for item in options if str(item.get("option_id") or "") == str(option_id or "")), None)
    if not option and len(options) == 1:
        option = options[0]
    if not option:
        raise ValueError("Choose the guide option to price")
    return quote, option


def save_admin_plan(record, payload, reviewer="MBW Admin", opener=urlopen):
    """Save private sell prices and admin itinerary edits without changing the guide quote."""
    current = _parse(record.get("final_plan_json"), {})
    quote_id = str(payload.get("quote_id") or current.get("quote_id") or "").strip()
    option_id = str(payload.get("selected_option_id") or current.get("selected_option_id") or "").strip()
    quote, option = _source_option(record, quote_id, option_id)
    option_id = str(option.get("option_id") or option_id)
    markup = max(0, min(float(payload.get("default_markup_percent", current.get("default_markup_percent", 30)) or 0), 500))
    submitted_prices = payload.get("sell_prices") if isinstance(payload.get("sell_prices"), dict) else {}
    prior_prices = current.get("sell_prices") if isinstance(current.get("sell_prices"), dict) else {}
    submitted_days = payload.get("admin_days") if isinstance(payload.get("admin_days"), list) else []
    edits_by_id = {str(day.get("day_id") or ""): day for day in submitted_days if isinstance(day, dict)}
    sell_prices = {}
    admin_days = []
    net_total = 0.0
    sell_total = 0.0
    pending = 0
    for source_day in option.get("days", []):
        day_id = str(source_day.get("day_id") or "")
        edits = edits_by_id.get(day_id, {})
        day_net = 0.0
        day_sell = 0.0
        for cost in source_day.get("costs", []):
            cost_id = str(cost.get("cost_id") or "")
            net = round(float(cost.get("amount") or 0) * float(cost.get("quantity") or 0), 2)
            default_sell = net if cost.get("category") == "accommodation" else round(net * (1 + markup / 100), 2)
            raw_sell = submitted_prices.get(cost_id, prior_prices.get(cost_id, default_sell))
            try:
                sell = max(0, min(float(raw_sell), 999999))
            except (TypeError, ValueError):
                sell = default_sell
            sell = round(sell, 2)
            sell_prices[cost_id] = sell
            day_net += net
            day_sell += sell
            if cost.get("status") in {"estimate", "verify"}:
                pending += 1
        net_total += day_net
        sell_total += day_sell
        admin_days.append({
            "day_id": day_id,
            "day_number": source_day.get("day_number"),
            "date": str(edits.get("date", source_day.get("date", "")))[:20],
            "title": str(edits.get("title", source_day.get("title", "")))[:180],
            "agenda": str(edits.get("agenda", source_day.get("agenda", "")))[:3000],
            "start_location": str(edits.get("start_location", source_day.get("start_location", "")))[:240],
            "end_location": str(edits.get("end_location", source_day.get("end_location", "")))[:240],
            "net_total": round(day_net, 2),
            "sell_total": round(day_sell, 2),
            "profit": round(day_sell - day_net, 2),
        })
    timestamp = now()
    workflow = current.get("workflow") if isinstance(current.get("workflow"), dict) else {}
    workflow.setdefault("stage", "admin_proposal")
    events = workflow.get("events") if isinstance(workflow.get("events"), list) else []
    events.append({"action": "admin_plan_saved", "at": timestamp, "by": str(reviewer or "MBW Admin")[:120]})
    workflow["events"] = events[-50:]
    plan = {
        **current,
        "source": "guide_trip_builder",
        "quote_id": quote.get("quote_id"),
        "quote_version": quote.get("version"),
        "provider_id": quote.get("provider_id"),
        "provider_name": quote.get("provider_name"),
        "brand_id": quote.get("brand_id", "mbw"),
        "currency": "USD",
        "selected_option_id": option_id,
        "selected_option_name": option.get("name", "Recommended"),
        "default_markup_percent": markup,
        "sell_prices": sell_prices,
        "admin_days": admin_days,
        "net_total": round(net_total, 2),
        "sell_total": round(sell_total, 2),
        "gross_profit": round(sell_total - net_total, 2),
        "gross_margin_percent": round((sell_total - net_total) / sell_total * 100, 2) if sell_total else 0,
        "pending_cost_count": pending,
        "pricing_status": "ready" if not pending else "pending_verification",
        "workflow": workflow,
        "updated_at": timestamp,
        "updated_by": str(reviewer or "MBW Admin")[:120],
    }
    updated = dict(record)
    updated["final_plan_json"] = plan
    updated["status"] = "proposal_ready" if not pending else "proposal_pricing_review"
    updated["updated_at"] = timestamp
    updated["revision"] = int(record.get("revision") or 0) + 1
    handoff = _parse(record.get("handoff_json"), {})
    handoff["itinerary_status"] = "proposal_ready" if not pending else "pricing_verification_required"
    updated["handoff_json"] = handoff
    save(updated, opener)
    return normalize_record(updated)


def advance_workflow(record, action, note="", reviewer="MBW Admin", opener=urlopen, artifact=None):
    if action not in WORKFLOW_ACTIONS:
        raise ValueError("Choose a supported workflow action")
    plan = _parse(record.get("final_plan_json"), {})
    if not plan.get("selected_option_id"):
        raise ValueError("Save the admin proposal before advancing the workflow")
    if action in {"mark_preliminary_sent", "mark_guest_final_confirmed"} and plan.get("pricing_status") != "ready":
        raise ValueError("Verify pending guide costs before sending or final approval")
    workflow = plan.get("workflow") if isinstance(plan.get("workflow"), dict) else {}
    current_stage = workflow.get("stage", "admin_proposal")
    if current_stage not in WORKFLOW_PREVIOUS[action]:
        raise ValueError("Complete the current workflow step before advancing")
    note = str(note or "").strip()
    if action in {"record_guest_changes", "mark_invoice_sent", "record_deposit_received", "mark_cancelled"} and not note:
        raise ValueError("Add a note describing the changes or invoice reference")
    timestamp = now()
    events = workflow.get("events") if isinstance(workflow.get("events"), list) else []
    events.append({"action": action, "at": timestamp, "by": str(reviewer or "MBW Admin")[:120], "note": note[:2000]})
    workflow.update({"stage": WORKFLOW_ACTIONS[action], "events": events[-50:]})
    plan["workflow"] = workflow
    plan["updated_at"] = timestamp
    updated = dict(record)
    updated["final_plan_json"] = plan
    updated["status"] = WORKFLOW_ACTIONS[action]
    updated["updated_at"] = timestamp
    updated["revision"] = int(record.get("revision") or 0) + 1
    if action in {"mark_preliminary_sent", "mark_guest_final_confirmed", "mark_invoice_sent"}:
        handoff = _parse(record.get("handoff_json"), {})
        artifacts = handoff.get("sent_artifacts") if isinstance(handoff.get("sent_artifacts"), list) else []
        guest_snapshot = {
            "action": action,
            "created_at": timestamp,
            "created_by": str(reviewer or "MBW Admin")[:120],
            "quote_id": plan.get("quote_id"),
            "quote_version": plan.get("quote_version"),
            "workflow_stage": WORKFLOW_ACTIONS[action],
            "sell_total": plan.get("sell_total"),
            "admin_days": plan.get("admin_days", []),
            "sell_prices": plan.get("sell_prices", {}),
            "note": note[:2000],
            "artifact": artifact if isinstance(artifact, dict) else {},
        }
        fingerprint = json.dumps(guest_snapshot, sort_keys=True, ensure_ascii=False).encode()
        guest_snapshot["sha256"] = hashlib.sha256(fingerprint).hexdigest()
        artifacts.append(guest_snapshot)
        handoff["sent_artifacts"] = artifacts[-30:]
        updated["handoff_json"] = handoff
    save(updated, opener)
    return normalize_record(updated)


def save_case_context(record, context, reviewer="MBW Admin", opener=urlopen):
    """Persist the human-owned memory shared by Studio and downstream tools."""
    if not isinstance(context, dict):
        raise ValueError("Missing case context")

    def clean(value, limit=2000):
        return str(value or "").strip()[:limit]

    def string_list(value, limit=50):
        if not isinstance(value, list):
            return []
        return [clean(item, 1000) for item in value if clean(item, 1000)][:limit]

    accommodations = []
    for item in context.get("accommodations") or []:
        if not isinstance(item, dict):
            continue
        try:
            deposit_percent = min(100, max(0, float(item.get("deposit_percent") or 0)))
            net_total = max(0, float(item.get("net_total") or 0))
        except (TypeError, ValueError):
            raise ValueError("Accommodation totals and deposits must be numbers")
        accommodations.append({
            "location": clean(item.get("location"), 160),
            "property": clean(item.get("property"), 240),
            "check_in": clean(item.get("check_in"), 10),
            "check_out": clean(item.get("check_out"), 10),
            "net_total": round(net_total, 2),
            "deposit_percent": round(deposit_percent, 2),
            "deposit_amount": round(net_total * deposit_percent / 100, 2),
            "status": clean(item.get("status"), 80) or "researching",
            "hold_expires_at": clean(item.get("hold_expires_at"), 40),
            "booking_owner": clean(item.get("booking_owner"), 120),
            "confirmation_code": clean(item.get("confirmation_code"), 120),
            "notes": clean(item.get("notes"), 1000),
        })
    if len(accommodations) > 30:
        raise ValueError("Too many accommodation records")

    suppliers = []
    for index, item in enumerate(context.get("suppliers") or []):
        if not isinstance(item, dict):
            continue
        try:
            net_cost = max(0, float(item.get("net_cost") or 0))
            deposit_percent = min(100, max(0, float(item.get("deposit_percent") or 0)))
        except (TypeError, ValueError):
            raise ValueError("Supplier costs and deposits must be numbers")
        supplier_id = clean(item.get("supplier_id"), 128) or f"SUP-{index + 1}"
        suppliers.append({
            "supplier_id": supplier_id,
            "provider_id": clean(item.get("provider_id"), 128),
            "name": clean(item.get("name"), 180),
            "role": clean(item.get("role"), 80) or "other",
            "service": clean(item.get("service"), 240),
            "service_date": clean(item.get("service_date"), 10),
            "start_time": clean(item.get("start_time"), 8),
            "end_time": clean(item.get("end_time"), 8),
            "pickup_location": clean(item.get("pickup_location"), 240),
            "dropoff_location": clean(item.get("dropoff_location"), 240),
            "net_cost": round(net_cost, 2),
            "deposit_percent": round(deposit_percent, 2),
            "deposit_amount": round(net_cost * deposit_percent / 100, 2),
            "availability": clean(item.get("availability"), 80) or "unverified",
            "verified_at": clean(item.get("verified_at"), 40),
            "valid_until": clean(item.get("valid_until"), 10),
            "hold_expires_at": clean(item.get("hold_expires_at"), 40),
            "status": clean(item.get("status"), 80) or "researching",
            "evidence_source": clean(item.get("evidence_source"), 500),
            "notes": clean(item.get("notes"), 1000),
        })
    if len(suppliers) > 50:
        raise ValueError("Too many supplier records")

    try:
        budget_ceiling = max(0, float(context.get("budget_ceiling") or 0))
    except (TypeError, ValueError):
        raise ValueError("Budget ceiling must be a number")
    handoff = _parse(record.get("handoff_json"), {})
    previous = handoff.get("case_context") if isinstance(handoff.get("case_context"), dict) else {}
    timestamp = now()
    case_context = {
        **previous,
        "case_owner": {
            "name": clean((context.get("case_owner") or {}).get("name"), 120),
            "phone": clean((context.get("case_owner") or {}).get("phone"), 80),
            "email": clean((context.get("case_owner") or {}).get("email"), 240),
        },
        "guest_timezone": clean(context.get("guest_timezone"), 120),
        "preferred_contact": clean(context.get("preferred_contact"), 120),
        "contact_window": clean(context.get("contact_window"), 240),
        "budget_ceiling": budget_ceiling,
        "confirmed_facts": string_list(context.get("confirmed_facts")),
        "open_decisions": string_list(context.get("open_decisions")),
        "commitments": string_list(context.get("commitments")),
        "next_action": clean(context.get("next_action"), 1000),
        "next_action_due": clean(context.get("next_action_due"), 10),
        "accommodations": accommodations,
        "suppliers": suppliers,
        "updated_at": timestamp,
        "updated_by": clean(reviewer, 120),
    }
    handoff["case_context"] = case_context
    events = handoff.get("case_context_events") if isinstance(handoff.get("case_context_events"), list) else []
    events.append({"action": "case_context_saved", "at": timestamp, "by": clean(reviewer, 120)})
    handoff["case_context_events"] = events[-50:]
    updated = dict(record)
    updated["handoff_json"] = handoff
    updated["updated_at"] = timestamp
    updated["revision"] = int(record.get("revision") or 0) + 1
    save(updated, opener)
    inquiry_id = str(record.get("inquiry_id") or "").strip()
    if inquiry_id and (case_context.get("next_action_due") or case_context.get("next_action")):
        patch = {
            "inquiry_id": inquiry_id,
            "followup_date": case_context.get("next_action_due", ""),
            "next_action": case_context.get("next_action", ""),
        }
        request_n8n({"action": "update_inquiry", "record": patch, "inquiry_row": patch}, opener)
    return normalize_record(updated)


def list_interactions(record, opener=urlopen):
    result = request_n8n({
        "action": "list_interactions",
        "guest_id": str(record.get("guest_id") or ""),
        "inquiry_id": "",
    }, opener)
    inquiry_id = str(record.get("inquiry_id") or "")
    rows = [item for item in _records(result) if not inquiry_id or str(item.get("inquiry_id") or "") == inquiry_id]
    return sorted(rows, key=lambda item: str(item.get("occurred_at") or item.get("created_at") or ""), reverse=True)


def add_interaction(record, payload, reviewer="MBW Admin", opener=urlopen):
    note = str(payload.get("note") or "").strip()
    if not note:
        raise ValueError("Enter a communication note")
    timestamp = now()
    external_message_id = str(payload.get("external_message_id") or "").strip()[:500]
    if external_message_id:
        note = f"{note}\nExternal message ID: {external_message_id}"
    interaction = {
        "interaction_id": "",
        "guest_id": str(record.get("guest_id") or "")[:128],
        "inquiry_id": str(record.get("inquiry_id") or "")[:128],
        "booking_id": "",
        "occurred_at": str(payload.get("occurred_at") or timestamp)[:40],
        "direction": str(payload.get("direction") or "internal")[:40],
        "channel": str(payload.get("channel") or "other")[:40],
        "interaction_type": str(payload.get("interaction_type") or "internal_note")[:80],
        "note": note[:5000],
        "created_by": str(reviewer or "MBW Admin")[:120],
        "followup_required": "Yes" if payload.get("followup_at") else "No",
        "followup_at": str(payload.get("followup_at") or "")[:40],
    }
    result = request_n8n({"action": "create_interaction", "interaction": interaction}, opener)
    return result.get("record") or interaction


def create_operations_assignments(record, guest_name="", guest_phone="", reviewer="MBW Admin", opener=urlopen):
    plan = _parse(record.get("final_plan_json"), {})
    workflow = plan.get("workflow") if isinstance(plan.get("workflow"), dict) else {}
    if workflow.get("stage") not in {"reservations_confirmed", "operations_ready"}:
        raise ValueError("Confirm reservations before creating final Guide Nest assignments")
    quote, option = _source_option(record, plan.get("quote_id"), plan.get("selected_option_id"))
    inquiry_id = str(record.get("inquiry_id") or "")
    studio_id = str(record.get("inquiry_studio_id") or "")
    group_id = f"OPS-{studio_id}"[:128]
    existing = _records(request_n8n({"action": "list_assignments", "inquiry_id": inquiry_id}, opener))
    existing_keys = {(str(item.get("assignment_group_id") or ""), str(item.get("service_item_id") or "")) for item in existing}
    profile = _parse(record.get("guest_profile_json"), {})
    created = []

    def create(item):
        key = (group_id, item["service_item_id"])
        if key in existing_keys:
            return
        result = request_n8n({"action": "create_assignment", "assignment": item}, opener)
        created.append(result.get("record") or item)
        existing_keys.add(key)

    edits = {str(item.get("day_id") or ""): item for item in plan.get("admin_days", []) if isinstance(item, dict)}
    for day in option.get("days", []):
        day_id = str(day.get("day_id") or f"DAY-{day.get('day_number')}")
        edit = edits.get(day_id, {})
        provider_cost = sum(float(cost.get("amount") or 0) * float(cost.get("quantity") or 0) for cost in day.get("costs", []) if cost.get("category") == "guide")
        create({
            "assignment_id": "", "assignment_group_id": group_id, "assignment_kind": "assignment", "service_item_id": day_id,
            "guest_id": str(record.get("guest_id") or ""), "inquiry_id": inquiry_id, "booking_id": "",
            "service_date": str(edit.get("date") or day.get("date") or "")[:10], "start_time": "", "end_time": "",
            "service_type": "Custom Tour", "product_selected": str(edit.get("title") or day.get("title") or "Custom tour day")[:240],
            "guest_name": str(guest_name or "")[:180], "guest_phone": str(guest_phone or "")[:80], "guest_count": str(profile.get("party_size") or "")[:20],
            "provider_id": str(quote.get("provider_id") or "")[:128], "provider_role": "guide", "provider_name": str(quote.get("provider_name") or "")[:180],
            "pickup_location": str(edit.get("start_location") or day.get("start_location") or "")[:240], "dropoff_location": str(edit.get("end_location") or day.get("end_location") or "")[:240],
            "provider_cost": round(provider_cost, 2), "extra_cost": 0, "currency": "USD", "assignment_status": "confirmed",
            "provider_informed": "No", "provider_informed_by": "", "internal_note": f"[STUDIO_FINAL studio={studio_id} quote={plan.get('quote_id')} version={plan.get('quote_version')}]",
            "confirmation_note": str(edit.get("agenda") or day.get("agenda") or "")[:2000], "created_by": str(reviewer or "MBW Admin")[:120],
        })
    context = _parse(record.get("handoff_json"), {}).get("case_context", {})
    for supplier in context.get("suppliers", []) if isinstance(context, dict) else []:
        if not supplier.get("service_date") or not supplier.get("name"):
            continue
        service_id = str(supplier.get("supplier_id") or "supplier")
        create({
            "assignment_id": "", "assignment_group_id": group_id, "assignment_kind": "assignment", "service_item_id": service_id,
            "guest_id": str(record.get("guest_id") or ""), "inquiry_id": inquiry_id, "booking_id": "", "service_date": supplier.get("service_date"),
            "start_time": supplier.get("start_time", ""), "end_time": supplier.get("end_time", ""), "service_type": supplier.get("service") or supplier.get("role") or "Supplier",
            "product_selected": supplier.get("service") or supplier.get("name"), "guest_name": str(guest_name or "")[:180], "guest_phone": str(guest_phone or "")[:80],
            "guest_count": str(profile.get("party_size") or "")[:20], "provider_id": supplier.get("provider_id", ""), "provider_role": supplier.get("role", "other"),
            "provider_name": supplier.get("name"), "pickup_location": supplier.get("pickup_location", ""), "dropoff_location": supplier.get("dropoff_location", ""),
            "provider_cost": supplier.get("net_cost", 0), "extra_cost": 0, "currency": "USD", "assignment_status": "confirmed", "provider_informed": "No",
            "internal_note": f"[STUDIO_SUPPLIER studio={studio_id} source={service_id}]", "confirmation_note": supplier.get("notes", ""), "created_by": str(reviewer or "MBW Admin")[:120],
        })
    verified = _records(request_n8n({"action": "list_assignments", "inquiry_id": inquiry_id}, opener))
    final_rows = [item for item in verified if str(item.get("assignment_group_id") or "") == group_id]
    if not final_rows:
        raise ValueError("Final assignments were not verified in Guide Nest")
    handoff = _parse(record.get("handoff_json"), {})
    handoff["operations_assignments"] = [{"assignment_id": item.get("assignment_id"), "service_item_id": item.get("service_item_id"), "provider_name": item.get("provider_name"), "service_date": item.get("service_date")} for item in final_rows]
    handoff["operations_assignments_updated_at"] = now()
    updated = dict(record)
    updated["handoff_json"] = handoff
    updated["updated_at"] = now()
    updated["revision"] = int(record.get("revision") or 0) + 1
    save(updated, opener)
    return normalize_record(updated), final_rows


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
